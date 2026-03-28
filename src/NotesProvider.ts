import * as vscode from 'vscode';

export class NotesProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private currentText = '';
  private savePromise = Promise.resolve();

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'resources')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    // Load notes from disk and send to webview
    this.loadNotes().then((text) => {
      const readOnly = !vscode.workspace.isTrusted;
      webviewView.webview.postMessage({ type: 'load', text, readOnly });
    });

    // Listen for save messages from webview
    webviewView.webview.onDidReceiveMessage(
      (message: { type: string; text: string }) => {
        if (message.type === 'save') {
          this.currentText = message.text;
          this.enqueueSave(message.text);
        }
      },
      undefined,
      this.context.subscriptions,
    );

    // Re-send notes when panel becomes visible again
    webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          const readOnly = !vscode.workspace.isTrusted;
          webviewView.webview.postMessage({
            type: 'load',
            text: this.currentText,
            readOnly,
          });
        }
      },
      undefined,
      this.context.subscriptions,
    );

    // Clean up reference on dispose
    webviewView.onDidDispose(
      () => {
        this.view = undefined;
      },
      undefined,
      this.context.subscriptions,
    );

    // Toggle readonly when workspace trust changes
    this.context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        this.view?.webview.postMessage({ type: 'trust', readOnly: false });
      }),
    );
  }

  private getHtml(webview: vscode.Webview): string {
    if (!this.context.storageUri) {
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:var(--vscode-foreground);font-family:var(--vscode-font-family);">
  <p>Open a folder to use Notes.</p>
</body>
</html>`;
    }

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'style.css'),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'script.js'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <textarea id="notes" aria-label="Workspace notes" placeholder="Type your notes here..." spellcheck="false"></textarea>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private async loadNotes(): Promise<string> {
    if (!this.context.storageUri) {
      return '';
    }

    const uri = vscode.Uri.joinPath(this.context.storageUri, 'notes.txt');

    try {
      const data = await vscode.workspace.fs.readFile(uri);
      this.currentText = Buffer.from(data).toString('utf-8');
      // Normalize line endings
      this.currentText = this.currentText.replace(/\r\n/g, '\n');
      return this.currentText;
    } catch {
      // File doesn't exist yet — start with empty
      return '';
    }
  }

  private enqueueSave(text: string): void {
    this.savePromise = this.savePromise.then(() => this.saveNotes(text));
  }

  private async saveNotes(text: string): Promise<void> {
    if (!this.context.storageUri) {
      return;
    }

    if (!vscode.workspace.isTrusted) {
      return;
    }

    try {
      await vscode.workspace.fs.createDirectory(this.context.storageUri);
      const uri = vscode.Uri.joinPath(this.context.storageUri, 'notes.txt');
      await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'));
    } catch (err) {
      vscode.window.showErrorMessage(`Notes Panel: Failed to save notes. ${err}`);
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
