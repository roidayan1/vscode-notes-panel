# Simple Notes Panel — VS Code Extension

Two textareas in the bottom panel. Left = per-workspace notes (`notes.txt` in `storageUri`). Right = global notes (`notes-global.txt` in `globalStorageUri`) shared across all VS Code windows in real time. A draggable splitter sits between them; its ratio is saved per workspace. Auto-saves on keystroke (debounced 200 ms). Published to VS Code Marketplace under publisher `roid`.

## Commands

- `yarn dev` — esbuild watch mode for development (press F5 in VS Code to launch Extension Development Host)
- `yarn build` — production build (minified)
- `yarn lint` — ESLint 10 with typescript-eslint
- `yarn format` — Prettier (write)
- `yarn format:check` — Prettier (check only, for CI)
- `yarn validate` — full CI check: format:check + lint + build + test (run before deploying)
- `yarn test` — integration tests in a real VS Code instance via @vscode/test-cli
- `yarn package` — build + produce `.vsix` file for local testing
- `yarn deploy` — publish to VS Code Marketplace
- `yarn deploy:ovsx` — publish to Open VSX (Cursor, etc.)
- `yarn deploy:all` — publish to both

## Architecture

```
src/                              → Extension host (TypeScript, bundled by esbuild)
  extension.ts                    → Entry point: instantiate + register NotesProvider
  constants.ts                    → File names, keys, ratio bounds, timings (single source of truth)
  messages.ts                     → Typed discriminated-union message protocol
  NotesProvider.ts                → WebviewViewProvider: orchestration only
  storage/
    FileBackedNotesStore.ts       → Abstract base: serialized save queue, read/write/normalize
    LocalNotesStore.ts            → Workspace storage; trust-gated writes
    GlobalNotesStore.ts           → Global storage; FS watcher + echo suppression + focus catch-up
  state/
    SplitterRatioStore.ts         → Splitter ratio persisted in workspaceState; clamped
  ui/
    html.ts                       → buildEmptyStateHtml + buildMainHtml (with CSP)
    nonce.ts                      → getNonce()
  test/                           → Integration tests (Mocha, run inside VS Code)
resources/                        → Webview assets (plain JS + CSS, NOT bundled, NOT TypeScript)
  script.js                       → Two textareas, debounced save, splitter (pointer + keyboard)
  style.css                       → Flex layout with --left-width var; VS Code theme colors
out/                              → Build output (gitignored)
  extension.js                    → Bundled extension (CJS, vscode external)
esbuild.mjs                       → Build config (--watch and --production flags)
```

### Extension host vs Webview

These are two separate execution contexts:

- **Extension host** (`src/`) runs in Node.js inside VS Code. Has access to `vscode` API. Bundled by esbuild into a single `out/extension.js`. The `vscode` module is marked `external` — it's provided at runtime, never bundled.
- **Webview** (`resources/`) runs in a sandboxed iframe. Has NO access to `vscode` API or Node.js. Communicates with the extension via `postMessage`/`onDidReceiveMessage`. Files are served as-is via `webview.asWebviewUri()`.

### Message protocol (extension ↔ webview)

Canonical types: [src/messages.ts](src/messages.ts). The webview JS mirrors the string literals; keep both in sync.

Extension → Webview:
- `{ type: 'load', localText, globalText, localReadOnly, splitterRatio }` — initial load and visibility restore
- `{ type: 'globalUpdate', text }` — global notes changed in another window (or via focus catch-up)
- `{ type: 'trust', localReadOnly }` — workspace trust granted

Webview → Extension:
- `{ type: 'save', target: 'local' | 'global', text }` — debounced 200 ms on textarea input
- `{ type: 'splitter', ratio }` — splitter dragged or keyboard-adjusted

### Storage

- **Local notes**: `<storageUri>/notes.txt` (per-workspace). Trust-gated for writes.
- **Global notes**: `<globalStorageUri>/notes-global.txt` (per-user, shared by all windows). Always writable, even in untrusted workspaces — `globalStorageUri` is not gated by workspace trust.
- Plain UTF-8 text, LF line endings (CRLF normalized on read).
- All I/O via `vscode.workspace.fs` (not Node `fs`) — required for VS Code Remote (SSH/WSL/Containers).
- `storageUri` is `undefined` when no folder is open → webview shows "Open a folder to use Notes". `globalStorageUri` is always defined.
- Writes are serialized via a promise chain in `FileBackedNotesStore` to prevent race conditions.

### Cross-window sync (global pane)

- `GlobalNotesStore` creates a `FileSystemWatcher` over `RelativePattern(globalStorageUri, 'notes-global.txt')`. Since `globalStorageUri` resolves to the same on-disk path for every VS Code window of the same user, a write from window A triggers the watcher in window B.
- **Echo suppression**: before writing, `GlobalNotesStore` records `lastWrittenText` and `lastWriteAt`. When the watcher fires, the change is suppressed if the file content equals `lastWrittenText` and the event arrived within `ECHO_SUPPRESS_MS` (300 ms). Otherwise it fires `onDidChangeExternally(text)`, which the provider forwards as a `globalUpdate` message.
- **Focus catch-up**: `vscode.window.onDidChangeWindowState` re-reads the global file when the window gains focus, in case OS throttling or sleep dropped a watcher event.
- **Conflict policy**: last writer wins. Two windows typing simultaneously will overwrite each other.
- In remote scenarios (SSH/WSL/Containers), `globalStorageUri` lives on the remote host, so sync only spans windows attached to the same remote.

### Splitter

- Vertical separator between the two textareas. Initial ratio is 2/3 left, clamped to `[0.1, 0.9]`. Persisted per workspace via `workspaceState` under key `splitterRatio` (managed by `SplitterRatioStore`, with clamping at both read and write).
- Implemented with Pointer Events + `setPointerCapture`, throttled with `requestAnimationFrame`. Updates `--left-width` CSS variable on `#container`.
- Accessibility: `role="separator"` with `aria-orientation="vertical"`, `aria-valuemin/max/now`, `tabindex="0"`. Keyboard: `ArrowLeft`/`ArrowRight` (±2 %), `Home`/`End` (snap to bounds).

### Webview state persistence

- `vscode.getState()`/`setState()` preserves both textareas' content, scroll position, cursor, splitter ratio, and readOnly flag across hide/show cycles.
- `webviewOptions.retainContextWhenHidden: true` is set in `extension.ts` to eliminate tab-switch delay.
- On fresh `resolveWebviewView` (VS Code disposed the webview), the extension re-sends a `load` message from cached `currentText`/`currentGlobalText`.

### Disposable lifecycle

- **Lifetime subscriptions** (created in `NotesProvider` constructor): `globalStore` (owns FS watcher), `onDidGrantWorkspaceTrust`, `onDidChangeWindowState`, `globalStore.onDidChangeExternally`. Tracked in `lifetimeDisposables`, freed in `dispose()`.
- **Per-resolve subscriptions** (created in `resolveWebviewView`): `webview.onDidReceiveMessage`, `webviewView.onDidChangeVisibility`, `webviewView.onDidDispose`. Tracked in `perResolveDisposables`, freed when the webview is disposed or before re-resolve.

## Important constraints

- CSP uses nonce-based script loading: the nonce in `<script nonce="...">` must match the CSP header
- CSP `style-src` includes `'unsafe-inline'` so the webview script can update the `--left-width` CSS variable via `element.style.setProperty(...)`. Removing it will break the splitter.
- `acquireVsCodeApi()` can only be called once per webview — store the return value
- Webview resources (CSS/JS) are NOT processed by esbuild — edit them directly, no compilation needed
- Workspace trust gates the **left** (workspace) textarea only. The global pane stays editable in untrusted workspaces (its file is in user-scoped global storage).
- `@types/vscode` version must not exceed `engines.vscode` version or vsce will reject packaging
- Underscore-prefixed params (`_context`, `_token`) are used for required-but-unused interface params — ESLint is configured to allow this pattern
- Constants live in [src/constants.ts](src/constants.ts). The webview JS duplicates a couple of values (`SAVE_DEBOUNCE_MS`, ratio bounds) with a comment pointing back to the canonical file — keep them in sync.

## Testing

- `yarn test` — runs Mocha integration tests in a headless VS Code instance. Covers: extension activation, `SplitterRatioStore` clamping/round-trip, `LocalNotesStore` (trust gate, write serialization, CRLF normalization, undefined storage), `GlobalNotesStore` (echo suppression, external-change event).
- The test tsconfig (`src/test/tsconfig.json`) overrides the parent `exclude` so test files are actually compiled.
- F5 → Extension Development Host for manual testing.
- Cmd+Shift+F5 to reload extension after TypeScript changes.
- For webview changes (CSS/JS): close and reopen the Notes panel (no rebuild needed).
- **Manual cross-window E2E**: F5 to launch one Extension Development Host, then `File → New Window` and open another folder for a second host. Type in the right pane of one and confirm the other updates within ~250 ms.

## Publishing

Published to both registries:
- **VS Code Marketplace:** https://marketplace.visualstudio.com/items?itemName=roid.notes-panel
- **Open VSX (Cursor etc.):** https://open-vsx.org/extension/roid/notes-panel

Commands:
- `yarn package` — produces a `.vsix` for local testing
- `yarn deploy` — publishes to VS Code Marketplace (requires PAT, or upload `.vsix` manually at https://marketplace.visualstudio.com/manage/publishers/roid)
- `yarn deploy:ovsx` — publishes to Open VSX (reads `OVSX_PAT` env var from `~/.zshrc`)
- `yarn deploy:all` — publishes to both registries

Manual upload (alternative to CLI):
- **VS Code Marketplace:** https://marketplace.visualstudio.com/manage/publishers/roid
- **Open VSX:** https://open-vsx.org/user-settings/extensions

Notes:
- `vsce` uses `--no-dependencies` flag because all deps are devDependencies (bundled by esbuild)
- Icon must be PNG (marketplace rejects SVG)
- Open VSX namespace `roid` is claimed
