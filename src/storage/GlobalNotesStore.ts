import * as vscode from 'vscode';
import { ECHO_SUPPRESS_MS, GLOBAL_NOTES_FILE } from '../constants';
import { ErrorReporter, FileBackedNotesStore } from './FileBackedNotesStore';

export class GlobalNotesStore extends FileBackedNotesStore implements vscode.Disposable {
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly emitter = new vscode.EventEmitter<string>();
  private lastWrittenText = '';
  private lastWriteAt = 0;

  readonly onDidChangeExternally: vscode.Event<string> = this.emitter.event;

  constructor(
    private readonly globalStorageUri: vscode.Uri,
    reportError: ErrorReporter,
  ) {
    super(reportError);
    const pattern = new vscode.RelativePattern(this.globalStorageUri, GLOBAL_NOTES_FILE);
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = (): void => {
      void this.reloadAndEmit();
    };
    this.watcher.onDidChange(handler);
    this.watcher.onDidCreate(handler);
    this.watcher.onDidDelete(handler);
  }

  protected get directoryUri(): vscode.Uri {
    return this.globalStorageUri;
  }

  protected get fileUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.globalStorageUri, GLOBAL_NOTES_FILE);
  }

  protected canWrite(): boolean {
    return true;
  }

  protected beforeWrite(text: string): void {
    this.lastWrittenText = text;
    this.lastWriteAt = Date.now();
  }

  /** Re-read the file and fire the external-change event if it differs. Skips self-write echoes. */
  async refreshOnFocus(): Promise<void> {
    await this.reloadAndEmit();
  }

  private async reloadAndEmit(): Promise<void> {
    const previous = this.currentText;
    const text = await this.load();
    if (text === previous) {
      return;
    }
    if (text === this.lastWrittenText && Date.now() - this.lastWriteAt < ECHO_SUPPRESS_MS) {
      return;
    }
    this.emitter.fire(text);
  }

  dispose(): void {
    this.watcher.dispose();
    this.emitter.dispose();
  }
}
