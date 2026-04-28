import * as vscode from 'vscode';
import { DEFAULT_SPLITTER_RATIO, MAX_SPLITTER_RATIO, MIN_SPLITTER_RATIO } from '../constants';
import { getNonce } from './nonce';

export function buildEmptyStateHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:var(--vscode-foreground);font-family:var(--vscode-font-family);">
  <p>Open a folder to use Notes.</p>
</body>
</html>`;
}

export function buildMainHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'style.css'),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'script.js'),
  );
  const nonce = getNonce();
  const minPercent = Math.round(MIN_SPLITTER_RATIO * 100);
  const maxPercent = Math.round(MAX_SPLITTER_RATIO * 100);
  const defaultPercent = Math.round(DEFAULT_SPLITTER_RATIO * 100);

  // 'unsafe-inline' is required for style-src so the webview script can update the CSS variable
  // controlling the splitter position via element.style.setProperty('--left-width', ...).
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="container">
    <textarea id="notes-local" aria-label="Workspace notes" placeholder="Type your notes here..." spellcheck="false"></textarea>
    <div id="splitter" role="separator" aria-orientation="vertical" aria-valuemin="${minPercent}" aria-valuemax="${maxPercent}" aria-valuenow="${defaultPercent}" aria-label="Resize panes" tabindex="0"></div>
    <textarea id="notes-global" aria-label="Global notes (shared across windows)" placeholder="Global notes (shared across windows)..." spellcheck="false"></textarea>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
