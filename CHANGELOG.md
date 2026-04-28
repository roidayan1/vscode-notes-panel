# Changelog

## 0.1.2

- Add a second textarea on the right for global notes shared across all VS Code windows
- Real-time cross-window sync of global notes via file watcher on global storage
- Draggable splitter between the two textareas; position saved per-workspace
- Keyboard splitter accessibility (Arrow / Home / End on focused separator)

## 0.1.1

- Retain webview context when hidden to eliminate tab-switch delay

## 0.1.0

- Initial release
- Per-workspace notes stored in a simple textarea in the bottom panel
- Auto-save on every keystroke (debounced)
- Full VS Code theme integration (colors, font)
- Read-only mode in untrusted workspaces
- Tab key inserts tab character
- Scroll position and cursor preserved across panel hide/show
