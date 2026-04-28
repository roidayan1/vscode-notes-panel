import * as vscode from 'vscode';
import {
  DEFAULT_SPLITTER_RATIO,
  MAX_SPLITTER_RATIO,
  MIN_SPLITTER_RATIO,
  SPLITTER_RATIO_KEY,
} from '../constants';

export class SplitterRatioStore {
  constructor(private readonly workspaceState: vscode.Memento) {}

  static clamp(n: unknown): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      return DEFAULT_SPLITTER_RATIO;
    }
    if (n < MIN_SPLITTER_RATIO) return MIN_SPLITTER_RATIO;
    if (n > MAX_SPLITTER_RATIO) return MAX_SPLITTER_RATIO;
    return n;
  }

  get(): number {
    return SplitterRatioStore.clamp(this.workspaceState.get(SPLITTER_RATIO_KEY));
  }

  async set(n: number): Promise<void> {
    await this.workspaceState.update(SPLITTER_RATIO_KEY, SplitterRatioStore.clamp(n));
  }
}
