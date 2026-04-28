# Simple Notes Panel

<p align="center">
  <img src="icon.png" alt="Simple Notes Panel" width="128">
</p>

<p align="center">
  A simple notepad in the VS Code bottom panel.<br>
  Two textareas side by side: one per workspace, one shared across all your VS Code windows.<br>
  No formatting, no folders, no toolbars — just textareas that auto-save.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=roid.notes-panel">
    <img src="https://img.shields.io/visual-studio-marketplace/v/roid.notes-panel" alt="Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=roid.notes-panel">
    <img src="https://img.shields.io/visual-studio-marketplace/i/roid.notes-panel" alt="Installs">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/roidayan1/vscode-notes-panel" alt="License">
  </a>
</p>

## Why

VS Code has no built-in scratchpad. Existing note extensions either store notes globally (same notes in every workspace) or are overcomplicated with folders, markdown preview, and toolbars. This extension gives you both: a per-project notepad on the left and a global scratchpad on the right that stays in sync across every VS Code window.

## Features

- **Two textareas, two scopes** — left is per-workspace, right is global (shared across all your VS Code windows)
- **Real-time cross-window sync** — type into the global pane in one window, see it update live in every other open window
- **Draggable splitter** — resize the two panes; position is remembered per project
- **Auto-save** — saves automatically on every keystroke (debounced 200ms), no manual save needed
- **Theme integration** — matches your VS Code colors and editor font automatically
- **Zero config** — open the Notes tab and start typing
- **Tab support** — Tab key inserts a tab character instead of switching focus
- **Untrusted workspaces** — left (workspace) notes are read-only; the global pane stays editable
- **State preservation** — scroll position and cursor preserved when the panel is hidden and shown
- **Accessible splitter** — focusable separator with `Arrow` / `Home` / `End` keyboard support
- **Lightweight** — no dependencies, no frameworks, no bloat

## Usage

1. Open the **Notes** tab in the bottom panel (next to Terminal, Problems, etc.)
2. Type into the **left** textarea for notes scoped to the current workspace.
3. Type into the **right** textarea for global notes shared across every open VS Code window.
4. Drag the separator between the two panes to resize. The position is saved per workspace.
5. Open a second VS Code window — the right pane stays in sync with the first.

> **Tip:** If no folder is open, the panel shows "Open a folder to use Notes" — the panel always requires a workspace.

## How it works

- **Workspace notes** are stored as `notes.txt` in VS Code's per-workspace storage directory (`context.storageUri`).
- **Global notes** are stored as `notes-global.txt` in `context.globalStorageUri`, which resolves to the same path for every VS Code window of the current user. A `FileSystemWatcher` on that file relays changes to other windows in real time, with self-write echo suppression so your own typing doesn't bounce back.
- **Splitter ratio** is persisted per workspace via `workspaceState`.
- All file I/O uses `vscode.workspace.fs`, so the extension works seamlessly with VS Code Remote (SSH, WSL, Containers). Cross-window sync of the global pane works among windows that share the same host (locally, or attached to the same remote).
- When two windows write to the global pane simultaneously, the last writer wins.

## License

[MIT](LICENSE)
