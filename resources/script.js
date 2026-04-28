// Webview-side controller for the Notes panel.
// Message protocol contract: see src/messages.ts (canonical source).
// Constants mirrored from src/constants.ts — keep in sync.
(function () {
  const SAVE_DEBOUNCE_MS = 200;
  const MIN_RATIO = 0.1;
  const MAX_RATIO = 0.9;
  const DEFAULT_RATIO = 2 / 3;
  const KEYBOARD_STEP = 0.02;

  const vscode = acquireVsCodeApi();

  const container = document.getElementById('container');
  const localTa = document.getElementById('notes-local');
  const globalTa = document.getElementById('notes-global');
  const splitter = document.getElementById('splitter');

  let currentRatio = DEFAULT_RATIO;

  function clampRatio(n) {
    if (typeof n !== 'number' || !isFinite(n)) return DEFAULT_RATIO;
    if (n < MIN_RATIO) return MIN_RATIO;
    if (n > MAX_RATIO) return MAX_RATIO;
    return n;
  }

  function applyRatio(ratio) {
    currentRatio = clampRatio(ratio);
    container.style.setProperty('--left-width', currentRatio * 100 + '%');
    splitter.setAttribute('aria-valuenow', String(Math.round(currentRatio * 100)));
  }

  function snapshotTextarea(ta) {
    return {
      text: ta.value,
      scrollTop: ta.scrollTop,
      selectionStart: ta.selectionStart,
      selectionEnd: ta.selectionEnd,
    };
  }

  function restoreTextarea(ta, snap) {
    if (!snap) return;
    ta.value = snap.text || '';
    ta.scrollTop = snap.scrollTop || 0;
    ta.selectionStart = snap.selectionStart || 0;
    ta.selectionEnd = snap.selectionEnd || 0;
  }

  function saveState() {
    vscode.setState({
      local: snapshotTextarea(localTa),
      global: snapshotTextarea(globalTa),
      ratio: currentRatio,
      readOnly: localTa.readOnly,
    });
  }

  // Restore from previous visibility cycle.
  const previousState = vscode.getState();
  if (previousState) {
    restoreTextarea(localTa, previousState.local);
    restoreTextarea(globalTa, previousState.global);
    applyRatio(previousState.ratio != null ? previousState.ratio : DEFAULT_RATIO);
    if (previousState.readOnly) {
      localTa.readOnly = true;
    }
  } else {
    applyRatio(DEFAULT_RATIO);
  }

  function makeDebouncedSaver(target, ta) {
    let timeout;
    return function () {
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        vscode.postMessage({ type: 'save', target: target, text: ta.value });
        saveState();
      }, SAVE_DEBOUNCE_MS);
    };
  }

  const saveLocal = makeDebouncedSaver('local', localTa);
  const saveGlobal = makeDebouncedSaver('global', globalTa);

  localTa.addEventListener('input', saveLocal);
  globalTa.addEventListener('input', saveGlobal);

  function tabHandler(ta, debounced) {
    return function (e) {
      if (e.key !== 'Tab' || ta.readOnly) return;
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + '\t' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 1;
      debounced();
    };
  }
  localTa.addEventListener('keydown', tabHandler(localTa, saveLocal));
  globalTa.addEventListener('keydown', tabHandler(globalTa, saveGlobal));

  // Splitter — pointer drag.
  let dragging = false;
  let pendingFrame = 0;
  let pendingClientX = 0;

  function ratioFromClientX(clientX) {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return currentRatio;
    return clampRatio((clientX - rect.left) / rect.width);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    pendingClientX = e.clientX;
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(function () {
      pendingFrame = 0;
      applyRatio(ratioFromClientX(pendingClientX));
    });
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    if (pendingFrame) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
    }
    if (e && splitter.hasPointerCapture && splitter.hasPointerCapture(e.pointerId)) {
      splitter.releasePointerCapture(e.pointerId);
    }
    vscode.postMessage({ type: 'splitter', ratio: currentRatio });
    saveState();
  }

  splitter.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    dragging = true;
    splitter.classList.add('dragging');
    splitter.setPointerCapture(e.pointerId);
    pendingClientX = e.clientX;
    e.preventDefault();
  });
  splitter.addEventListener('pointermove', onPointerMove);
  splitter.addEventListener('pointerup', endDrag);
  splitter.addEventListener('pointercancel', endDrag);
  splitter.addEventListener('lostpointercapture', function () {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    vscode.postMessage({ type: 'splitter', ratio: currentRatio });
    saveState();
  });

  splitter.addEventListener('keydown', function (e) {
    let next = currentRatio;
    switch (e.key) {
      case 'ArrowLeft':
        next = currentRatio - KEYBOARD_STEP;
        break;
      case 'ArrowRight':
        next = currentRatio + KEYBOARD_STEP;
        break;
      case 'Home':
        next = MIN_RATIO;
        break;
      case 'End':
        next = MAX_RATIO;
        break;
      default:
        return;
    }
    e.preventDefault();
    applyRatio(next);
    vscode.postMessage({ type: 'splitter', ratio: currentRatio });
    saveState();
  });

  // Messages from the extension.
  window.addEventListener('message', function (event) {
    const message = event.data;
    switch (message.type) {
      case 'load': {
        localTa.value = (message.localText || '').replace(/\r\n/g, '\n');
        globalTa.value = (message.globalText || '').replace(/\r\n/g, '\n');
        localTa.readOnly = !!message.localReadOnly;
        applyRatio(message.splitterRatio != null ? message.splitterRatio : DEFAULT_RATIO);
        saveState();
        return;
      }
      case 'globalUpdate': {
        const incoming = (message.text || '').replace(/\r\n/g, '\n');
        if (globalTa.value === incoming) return;
        // Preserve cursor offset (clamped) so a remote update doesn't jump the caret to 0.
        const start = globalTa.selectionStart;
        const end = globalTa.selectionEnd;
        const scroll = globalTa.scrollTop;
        globalTa.value = incoming;
        globalTa.selectionStart = Math.min(start, incoming.length);
        globalTa.selectionEnd = Math.min(end, incoming.length);
        globalTa.scrollTop = scroll;
        saveState();
        return;
      }
      case 'trust': {
        localTa.readOnly = !!message.localReadOnly;
        saveState();
        return;
      }
    }
  });
})();
