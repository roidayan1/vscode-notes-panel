# Simple Notes Panel — VS Code Extension

Simple textarea in the bottom panel for per-workspace notes. Auto-saves on keystroke (debounced 200ms). Published to VS Code Marketplace under publisher `roid`.

## Commands

- `yarn dev` — esbuild watch mode for development (press F5 in VS Code to launch Extension Development Host)
- `yarn build` — production build (minified)
- `yarn lint` — ESLint 10 with typescript-eslint
- `yarn format` — Prettier (write)
- `yarn format:check` — Prettier (check only, for CI)
- `yarn validate` — full CI check: format:check + lint + build + test (run before deploying)
- `yarn test` — integration tests in a real VS Code instance via @vscode/test-cli
- `yarn package` — build + produce `.vsix` file for local testing
- `yarn deploy` — publish to VS Code Marketplace (needs VSCE_PAT or will prompt)

## Architecture

```
src/                  → Extension host (TypeScript, bundled by esbuild)
  extension.ts        → Entry point: registers NotesProvider
  NotesProvider.ts    → WebviewViewProvider: load/save/render HTML
  test/               → Integration tests (Mocha, run inside VS Code)
resources/            → Webview assets (plain JS + CSS, NOT bundled, NOT TypeScript)
  script.js           → Textarea behavior: debounce, getState/setState, Tab key
  style.css           → VS Code theme vars for colors and font
out/                  → Build output (gitignored)
  extension.js        → Bundled extension (CJS, vscode external)
esbuild.mjs           → Build config (--watch and --production flags)
```

### Extension host vs Webview

These are two separate execution contexts:

- **Extension host** (`src/`) runs in Node.js inside VS Code. Has access to `vscode` API. Bundled by esbuild into a single `out/extension.js`. The `vscode` module is marked `external` — it's provided at runtime, never bundled.
- **Webview** (`resources/`) runs in a sandboxed iframe. Has NO access to `vscode` API or Node.js. Communicates with the extension via `postMessage`/`onDidReceiveMessage`. Files are served as-is via `webview.asWebviewUri()`.

### Message protocol (extension ↔ webview)

- `{ type: 'load', text: string, readOnly: boolean }` — extension → webview (on resolve and visibility restore)
- `{ type: 'save', text: string }` — webview → extension (on textarea input, debounced 200ms)
- `{ type: 'trust', readOnly: boolean }` — extension → webview (when workspace trust changes)

### Storage

- Location: `context.storageUri` (per-workspace directory managed by VS Code)
- File: `notes.txt` (plain UTF-8 text, LF line endings)
- API: `vscode.workspace.fs` (not Node `fs`) — required for VS Code Remote (SSH/WSL/Containers)
- `storageUri` is `undefined` when no folder is open → webview shows "Open a folder to use Notes"
- Writes are serialized via a promise chain to prevent race conditions

### Webview state persistence

- `vscode.getState()`/`setState()` preserves textarea content, scroll position, and cursor across hide/show cycles
- This avoids `retainContextWhenHidden` which has high memory cost
- On fresh `resolveWebviewView` (VS Code disposed the webview), extension re-sends cached `currentText`

## Important constraints

- CSP uses nonce-based script loading: the nonce in `<script nonce="...">` must match the CSP header
- `acquireVsCodeApi()` can only be called once per webview — store the return value
- Webview resources (CSS/JS) are NOT processed by esbuild — edit them directly, no compilation needed
- `@types/vscode` version must not exceed `engines.vscode` version or vsce will reject packaging
- Underscore-prefixed params (`_context`, `_token`) are used for required-but-unused interface params — ESLint is configured to allow this pattern

## Testing

- `yarn test` — runs integration tests in a headless VS Code instance
- F5 → Extension Development Host for manual testing
- Cmd+Shift+F5 to reload extension after TypeScript changes
- For webview changes (CSS/JS): close and reopen the Notes panel (no rebuild needed)

## Publishing

- Publisher: `roid` (https://marketplace.visualstudio.com/manage/publishers/roid)
- `yarn package` produces a `.vsix` — can be installed locally via `code --install-extension notes-panel-x.y.z.vsix`
- `yarn deploy` publishes to marketplace via CLI (requires PAT), or upload `.vsix` manually at the publisher management page
- `vsce` uses `--no-dependencies` flag because all deps are devDependencies (bundled by esbuild)
- Icon must be PNG (marketplace rejects SVG)
