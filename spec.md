# Notes Panel — VS Code Extension Spec

A minimal VS Code extension that provides a simple text area in the bottom panel for quick notes, persisted per workspace.

## Why

VS Code has no built-in scratchpad. Existing note extensions either store notes globally (same notes in every workspace) or are overcomplicated with folders, markdown preview, and toolbars. This extension gives you a simple per-project notepad — each workspace gets its own notes.

## User Experience

- A **"Notes"** tab appears in the bottom panel (next to Terminal, Problems, etc.)
- The tab contains a single full-size `<textarea>` — no toolbar, no buttons, no formatting.
- Type anything. Notes auto-save on every keystroke (debounced). No manual save needed.
- Close VS Code, reopen the workspace — notes are exactly as you left them.
- Switch to a different workspace — different notes (or empty if new).
- Works in untrusted workspaces (read-only mode: notes visible but not editable).

## Technical Design

### Storage

- Use VS Code's **`WebviewView.webview`** backed by a plain text file.
- **Per-workspace storage:** write `notes.txt` to `context.storageUri` (workspace-scoped), NOT `context.globalStorageUri`.
- On first activation with no existing file, start with an empty textarea.
- Save on every `input` event, debounced at 200ms.

### Extension Anatomy

```
vscode-notes-panel/
├── src/
│   ├── extension.ts          # activate(): register the webview provider
│   └── NotesProvider.ts      # WebviewViewProvider — load/save/render
├── resources/
│   ├── style.css             # Textarea styling, VS Code theme vars
│   └── script.js             # Textarea ↔ extension messaging + debounce
├── package.json              # Extension manifest + contributes
├── tsconfig.json
├── .vscodeignore
├── LICENSE                   # MIT
├── README.md
└── CHANGELOG.md
```

### package.json — Key Contributes

```jsonc
{
  "contributes": {
    "viewsContainers": {
      "panel": [
        {
          "id": "notesPanel",
          "title": "Notes",
          "icon": "$(note)"
        }
      ]
    },
    "views": {
      "notesPanel": [
        {
          "type": "webview",
          "id": "notesPanel.notesView",
          "name": "Notes"
        }
      ]
    }
  },
  "activationEvents": ["onStartupFinished"],
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "description": "Notes are read-only in untrusted workspaces."
    }
  }
}
```

### NotesProvider (WebviewViewProvider)

Responsibilities:

1. **`resolveWebviewView()`** — set up the webview HTML with a `<textarea>`, link `style.css` and `script.js` via `webview.asWebviewUri()`. Set a strict CSP allowing only the extension's own resources.
2. **Load** — on resolve, read `notes.txt` from `context.storageUri`. If the file doesn't exist, send empty string. Post the content to the webview via `postMessage({ type: 'load', text })`.
3. **Save** — listen for `postMessage({ type: 'save', text })` from the webview. Write to `notes.txt`. Errors shown via `vscode.window.showErrorMessage()`.
4. **Visibility** — when the panel becomes visible again, re-send the current notes to the textarea (handles webview disposal/recreation by VS Code).
5. **Untrusted workspace** — if `!vscode.workspace.isTrusted`, send a flag to the webview that sets the textarea to `readonly`.

### Webview (script.js)

- On `message` event with type `'load'`: set textarea value, enable/disable based on trust flag.
- On textarea `input` event: debounce 200ms, then `postMessage({ type: 'save', text: textarea.value })`.
- Self-executing IIFE, no dependencies.

### Webview (style.css)

- Textarea fills 100% of the panel, no border radius, no margin.
- Uses VS Code CSS variables for full theme integration:
  - `--vscode-input-foreground` / `--vscode-input-background` / `--vscode-input-border`
  - `--vscode-focusBorder` for focus outline
- Font: inherit from `--vscode-editor-font-family` (user's configured editor font).
- Disabled/readonly state: reduced opacity.

## Publish Checklist

- [ ] Pick a unique Marketplace ID (e.g., `roid.notes-panel`)
- [ ] Create a publisher on https://marketplace.visualstudio.com/manage
- [ ] Add `icon.png` (128x128 minimum) to the repo root, reference in `package.json` `"icon"` field
- [ ] Write a concise `README.md` with a screenshot and feature list — this is the Marketplace listing page
- [ ] Add `CHANGELOG.md` with a `## 1.0.0` entry
- [ ] Add `LICENSE` (MIT)
- [ ] `.vscodeignore` to exclude: `src/`, `tsconfig.json`, `node_modules/`, `.vscode/`, `*.ts` (ship only compiled JS + resources)
- [ ] `"main": "./out/extension.js"` in package.json (compiled output)
- [ ] Build: `tsc -p .`
- [ ] Package: `npx @vscode/vsce package`
- [ ] Publish: `npx @vscode/vsce publish`

## Scope Boundaries

**In scope (v1):**
- Single textarea, auto-save, per-workspace persistence.

**Out of scope (maybe later):**
- Multiple notes / tabs
- Markdown preview / formatting
- Global (cross-workspace) notes
- Sync across machines
- Search within notes
