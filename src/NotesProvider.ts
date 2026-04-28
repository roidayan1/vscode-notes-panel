import * as vscode from 'vscode';
import { ExtensionToWebview, WebviewToExtension } from './messages';
import { GlobalNotesStore } from './storage/GlobalNotesStore';
import { LocalNotesStore } from './storage/LocalNotesStore';
import { SplitterRatioStore } from './state/SplitterRatioStore';
import { buildEmptyStateHtml, buildMainHtml } from './ui/html';

export class NotesProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private perResolveDisposables: vscode.Disposable[] = [];

  private readonly localStore: LocalNotesStore;
  private readonly globalStore: GlobalNotesStore;
  private readonly splitterStore: SplitterRatioStore;
  private readonly lifetimeDisposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    const reportError = (msg: string): void => {
      void vscode.window.showErrorMessage(msg);
    };

    this.localStore = new LocalNotesStore(context.storageUri, reportError);
    this.globalStore = new GlobalNotesStore(context.globalStorageUri, reportError);
    this.splitterStore = new SplitterRatioStore(context.workspaceState);

    this.lifetimeDisposables.push(
      this.globalStore,
      this.globalStore.onDidChangeExternally((text) => {
        this.post({ type: 'globalUpdate', text });
      }),
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        this.post({ type: 'trust', localReadOnly: false });
      }),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          void this.globalStore.refreshOnFocus();
        }
      }),
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    this.disposePerResolve();

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'resources')],
    };

    if (!this.context.storageUri) {
      webviewView.webview.html = buildEmptyStateHtml();
      return;
    }

    webviewView.webview.html = buildMainHtml(webviewView.webview, this.context.extensionUri);

    void this.sendInitialLoad();

    this.perResolveDisposables.push(
      webviewView.webview.onDidReceiveMessage((message: WebviewToExtension) => {
        this.handleMessage(message);
      }),
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          this.post({
            type: 'load',
            localText: this.localStore.text,
            globalText: this.globalStore.text,
            localReadOnly: !vscode.workspace.isTrusted,
            splitterRatio: this.splitterStore.get(),
          });
        }
      }),
      webviewView.onDidDispose(() => {
        this.disposePerResolve();
        this.view = undefined;
      }),
    );
  }

  private async sendInitialLoad(): Promise<void> {
    const [localText, globalText] = await Promise.all([
      this.localStore.load(),
      this.globalStore.load(),
    ]);
    this.post({
      type: 'load',
      localText,
      globalText,
      localReadOnly: !vscode.workspace.isTrusted,
      splitterRatio: this.splitterStore.get(),
    });
  }

  private handleMessage(message: WebviewToExtension): void {
    switch (message.type) {
      case 'save':
        if (message.target === 'local') {
          this.localStore.enqueueSave(message.text);
        } else {
          this.globalStore.enqueueSave(message.text);
        }
        return;
      case 'splitter':
        void this.splitterStore.set(message.ratio);
        return;
    }
  }

  private post(message: ExtensionToWebview): void {
    void this.view?.webview.postMessage(message);
  }

  private disposePerResolve(): void {
    while (this.perResolveDisposables.length) {
      const d = this.perResolveDisposables.pop();
      d?.dispose();
    }
  }

  dispose(): void {
    this.disposePerResolve();
    while (this.lifetimeDisposables.length) {
      const d = this.lifetimeDisposables.pop();
      d?.dispose();
    }
  }
}
