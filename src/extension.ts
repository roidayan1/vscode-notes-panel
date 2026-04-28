import * as vscode from 'vscode';
import { NotesProvider } from './NotesProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new NotesProvider(context);

  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider('notesPanel.notesView', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

export function deactivate(): void {
  // Disposables are handled by VS Code via context.subscriptions.
}
