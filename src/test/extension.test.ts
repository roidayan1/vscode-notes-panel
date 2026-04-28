import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  DEFAULT_SPLITTER_RATIO,
  ECHO_SUPPRESS_MS,
  GLOBAL_NOTES_FILE,
  LOCAL_NOTES_FILE,
  MAX_SPLITTER_RATIO,
  MIN_SPLITTER_RATIO,
} from '../constants';
import { GlobalNotesStore } from '../storage/GlobalNotesStore';
import { LocalNotesStore } from '../storage/LocalNotesStore';
import { SplitterRatioStore } from '../state/SplitterRatioStore';

function tmpDirUri(suffix: string): vscode.Uri {
  const dir = path.join(os.tmpdir(), `notes-panel-test-${Date.now()}-${suffix}`);
  return vscode.Uri.file(dir);
}

async function readFileUtf8(uri: vscode.Uri): Promise<string> {
  const data = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(data).toString('utf-8');
}

async function tryDelete(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
  } catch {
    /* ignore */
  }
}

class MemoryMemento implements vscode.Memento {
  private readonly map = new Map<string, unknown>();
  keys(): readonly string[] {
    return Array.from(this.map.keys());
  }
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.map.has(key) ? (this.map.get(key) as T) : defaultValue;
  }
  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) this.map.delete(key);
    else this.map.set(key, value);
  }
}

const noopReporter = (): void => {
  /* swallow errors in tests */
};

suite('Notes Panel Extension', () => {
  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('roid.notes-panel');
    assert.ok(extension, 'Extension not found in registry');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('roid.notes-panel');
    assert.ok(extension, 'Extension not found');
    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });

  test('Notes view should be focusable', async () => {
    await vscode.commands.executeCommand('notesPanel.notesView.focus');
  });
});

suite('SplitterRatioStore', () => {
  test('clamp returns default for non-numeric', () => {
    assert.strictEqual(SplitterRatioStore.clamp(undefined), DEFAULT_SPLITTER_RATIO);
    assert.strictEqual(SplitterRatioStore.clamp(NaN), DEFAULT_SPLITTER_RATIO);
    assert.strictEqual(SplitterRatioStore.clamp('0.5'), DEFAULT_SPLITTER_RATIO);
    assert.strictEqual(SplitterRatioStore.clamp(Infinity), DEFAULT_SPLITTER_RATIO);
  });

  test('clamp respects bounds', () => {
    assert.strictEqual(SplitterRatioStore.clamp(-1), MIN_SPLITTER_RATIO);
    assert.strictEqual(SplitterRatioStore.clamp(2), MAX_SPLITTER_RATIO);
    assert.strictEqual(SplitterRatioStore.clamp(0.5), 0.5);
  });

  test('round-trips through Memento (clamped)', async () => {
    const memento = new MemoryMemento();
    const store = new SplitterRatioStore(memento);
    assert.strictEqual(store.get(), DEFAULT_SPLITTER_RATIO);
    await store.set(0.42);
    assert.strictEqual(store.get(), 0.42);
    await store.set(99);
    assert.strictEqual(store.get(), MAX_SPLITTER_RATIO);
  });
});

suite('LocalNotesStore', () => {
  test('load of missing file returns empty', async () => {
    const dir = tmpDirUri('local-missing');
    const store = new LocalNotesStore(dir, noopReporter);
    assert.strictEqual(await store.load(), '');
  });

  test('enqueueSave writes file when trusted (test workspace is trusted)', async () => {
    if (!vscode.workspace.isTrusted) {
      // Test harness opens the workspace as trusted; if not, skip.
      return;
    }
    const dir = tmpDirUri('local-write');
    try {
      const store = new LocalNotesStore(dir, noopReporter);
      store.enqueueSave('hello\nworld');
      await store.flush();
      const content = await readFileUtf8(vscode.Uri.joinPath(dir, LOCAL_NOTES_FILE));
      assert.strictEqual(content, 'hello\nworld');
    } finally {
      await tryDelete(dir);
    }
  });

  test('serializes concurrent writes (last value wins on disk)', async () => {
    if (!vscode.workspace.isTrusted) return;
    const dir = tmpDirUri('local-serial');
    try {
      const store = new LocalNotesStore(dir, noopReporter);
      for (let i = 0; i < 5; i++) {
        store.enqueueSave(`v${i}`);
      }
      await store.flush();
      const content = await readFileUtf8(vscode.Uri.joinPath(dir, LOCAL_NOTES_FILE));
      assert.strictEqual(content, 'v4');
    } finally {
      await tryDelete(dir);
    }
  });

  test('normalizes CRLF on read', async () => {
    const dir = tmpDirUri('local-crlf');
    try {
      await vscode.workspace.fs.createDirectory(dir);
      const fileUri = vscode.Uri.joinPath(dir, LOCAL_NOTES_FILE);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from('a\r\nb\r\nc', 'utf-8'));
      const store = new LocalNotesStore(dir, noopReporter);
      assert.strictEqual(await store.load(), 'a\nb\nc');
    } finally {
      await tryDelete(dir);
    }
  });

  test('returns empty when storageUri is undefined', async () => {
    const store = new LocalNotesStore(undefined, noopReporter);
    assert.strictEqual(await store.load(), '');
    store.enqueueSave('ignored');
    await store.flush(); // must not throw
  });
});

suite('GlobalNotesStore', () => {
  test('echo suppression: own write does not fire onDidChangeExternally', async () => {
    if (!vscode.workspace.isTrusted) return;
    const dir = tmpDirUri('global-echo');
    try {
      await vscode.workspace.fs.createDirectory(dir);
      const store = new GlobalNotesStore(dir, noopReporter);
      let fired = 0;
      const sub = store.onDidChangeExternally(() => {
        fired++;
      });
      try {
        store.enqueueSave('self-write');
        await store.flush();
        // Wait long enough for the watcher event to arrive but well under ECHO_SUPPRESS_MS budget.
        await new Promise((r) => setTimeout(r, ECHO_SUPPRESS_MS / 2));
        assert.strictEqual(fired, 0, 'self-write should be suppressed');
      } finally {
        sub.dispose();
        store.dispose();
      }
    } finally {
      await tryDelete(dir);
    }
  });

  test('external change fires onDidChangeExternally', async () => {
    const dir = tmpDirUri('global-external');
    try {
      await vscode.workspace.fs.createDirectory(dir);
      const store = new GlobalNotesStore(dir, noopReporter);
      try {
        await store.load();
        const received = new Promise<string>((resolve) => {
          const sub = store.onDidChangeExternally((text) => {
            sub.dispose();
            resolve(text);
          });
        });
        // Simulate a write from another window.
        await vscode.workspace.fs.writeFile(
          vscode.Uri.joinPath(dir, GLOBAL_NOTES_FILE),
          Buffer.from('from-other-window', 'utf-8'),
        );
        const text = await Promise.race([
          received,
          new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]);
        assert.strictEqual(text, 'from-other-window');
      } finally {
        store.dispose();
      }
    } finally {
      await tryDelete(dir);
    }
  });
});
