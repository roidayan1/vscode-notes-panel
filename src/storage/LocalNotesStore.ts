import * as vscode from 'vscode';
import { LOCAL_NOTES_FILE } from '../constants';
import { ErrorReporter, FileBackedNotesStore } from './FileBackedNotesStore';

export class LocalNotesStore extends FileBackedNotesStore {
  constructor(
    private readonly storageUri: vscode.Uri | undefined,
    reportError: ErrorReporter,
  ) {
    super(reportError);
  }

  protected get directoryUri(): vscode.Uri | undefined {
    return this.storageUri;
  }

  protected get fileUri(): vscode.Uri | undefined {
    return this.storageUri ? vscode.Uri.joinPath(this.storageUri, LOCAL_NOTES_FILE) : undefined;
  }

  protected canWrite(): boolean {
    return vscode.workspace.isTrusted && !!this.storageUri;
  }
}
