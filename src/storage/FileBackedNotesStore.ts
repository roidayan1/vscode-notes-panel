import * as vscode from 'vscode';

export type ErrorReporter = (message: string) => void;

export abstract class FileBackedNotesStore {
  protected currentText = '';
  private savePromise: Promise<void> = Promise.resolve();

  constructor(protected readonly reportError: ErrorReporter) {}

  protected abstract get fileUri(): vscode.Uri | undefined;
  protected abstract get directoryUri(): vscode.Uri | undefined;
  protected abstract canWrite(): boolean;
  protected beforeWrite(_text: string): void {}

  get text(): string {
    return this.currentText;
  }

  async load(): Promise<string> {
    const uri = this.fileUri;
    if (!uri) {
      this.currentText = '';
      return '';
    }

    try {
      const data = await vscode.workspace.fs.readFile(uri);
      this.currentText = Buffer.from(data).toString('utf-8').replace(/\r\n/g, '\n');
      return this.currentText;
    } catch {
      this.currentText = '';
      return '';
    }
  }

  enqueueSave(text: string): void {
    this.currentText = text;
    this.savePromise = this.savePromise.then(() => this.writeNow(text));
  }

  /** Used by tests and shutdown paths to await all queued writes. */
  flush(): Promise<void> {
    return this.savePromise;
  }

  private async writeNow(text: string): Promise<void> {
    if (!this.canWrite()) {
      return;
    }
    const uri = this.fileUri;
    const dir = this.directoryUri;
    if (!uri || !dir) {
      return;
    }

    this.beforeWrite(text);

    try {
      await vscode.workspace.fs.createDirectory(dir);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'));
    } catch (err) {
      this.reportError(`Notes Panel: Failed to save notes. ${err}`);
    }
  }
}
