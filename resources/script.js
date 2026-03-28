(function () {
  const vscode = acquireVsCodeApi();
  const textarea = document.getElementById('notes');

  // Restore state from previous visibility cycle
  const previousState = vscode.getState();
  if (previousState) {
    textarea.value = previousState.text || '';
    textarea.scrollTop = previousState.scrollTop || 0;
    textarea.selectionStart = previousState.selectionStart || 0;
    textarea.selectionEnd = previousState.selectionEnd || 0;
    if (previousState.readOnly) {
      textarea.readOnly = true;
    }
  }

  // Debounce helper
  let saveTimeout;
  function debounceSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(function () {
      vscode.postMessage({ type: 'save', text: textarea.value });
      saveState();
    }, 200);
  }

  function saveState() {
    vscode.setState({
      text: textarea.value,
      scrollTop: textarea.scrollTop,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      readOnly: textarea.readOnly,
    });
  }

  // Save on every input (debounced)
  textarea.addEventListener('input', debounceSave);

  // Tab key inserts a tab character instead of moving focus
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      debounceSave();
    }
  });

  // Listen for messages from the extension
  window.addEventListener('message', function (event) {
    const message = event.data;

    switch (message.type) {
      case 'load': {
        // Normalize line endings
        const text = (message.text || '').replace(/\r\n/g, '\n');
        textarea.value = text;
        if (message.readOnly !== undefined) {
          textarea.readOnly = message.readOnly;
        }
        saveState();
        break;
      }
      case 'trust': {
        textarea.readOnly = message.readOnly;
        saveState();
        break;
      }
    }
  });
})();
