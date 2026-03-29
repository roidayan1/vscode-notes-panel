import * as vscode from 'vscode';
import { NotesProvider } from './NotesProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new NotesProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('notesPanel.notesView', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up — disposables are handled by VS Code
}
