# Notes Panel

<p align="center">
  <img src="logo.png" alt="Notes Panel" width="128">
</p>

<p align="center">
  A simple per-workspace notepad in the VS Code bottom panel.<br>
  No formatting, no folders, no toolbars — just a textarea that auto-saves.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=roid.notes-panel">
    <img src="https://img.shields.io/visual-studio-marketplace/v/roid.notes-panel" alt="Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=roid.notes-panel">
    <img src="https://img.shields.io/visual-studio-marketplace/i/roid.notes-panel" alt="Installs">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/roidayan/vscode-notes-panel" alt="License">
  </a>
</p>

## Why

VS Code has no built-in scratchpad. Existing note extensions either store notes globally (same notes in every workspace) or are overcomplicated with folders, markdown preview, and toolbars. This extension gives you a simple per-project notepad — each workspace gets its own notes.

## Features

- **Per-workspace notes** — each project gets its own notepad, stored locally
- **Auto-save** — saves automatically on every keystroke (debounced 200ms), no manual save needed
- **Theme integration** — matches your VS Code colors and editor font automatically
- **Zero config** — open the Notes tab and start typing
- **Tab support** — Tab key inserts a tab character instead of switching focus
- **Untrusted workspaces** — notes are read-only in untrusted workspaces
- **State preservation** — scroll position and cursor preserved when the panel is hidden and shown
- **Lightweight** — no dependencies, no frameworks, no bloat

## Usage

1. Open the **Notes** tab in the bottom panel (next to Terminal, Problems, etc.)
2. Type anything — notes auto-save instantly.
3. Close VS Code, reopen the workspace — your notes are exactly where you left them.
4. Switch to a different workspace — different notes, isolated per project.

> **Tip:** If no folder is open, the panel shows "Open a folder to use Notes" — notes are always tied to a workspace.

## How it works

Notes are stored as a plain `notes.txt` file in VS Code's per-workspace storage directory (`context.storageUri`). The extension uses `vscode.workspace.fs` for all file operations, so it works seamlessly with VS Code Remote (SSH, WSL, Containers).

## License

[MIT](LICENSE)
