export type NotesTarget = 'local' | 'global';

export interface LoadMsg {
  type: 'load';
  localText: string;
  globalText: string;
  localReadOnly: boolean;
  splitterRatio: number;
}

export interface GlobalUpdateMsg {
  type: 'globalUpdate';
  text: string;
}

export interface TrustMsg {
  type: 'trust';
  localReadOnly: boolean;
}

export type ExtensionToWebview = LoadMsg | GlobalUpdateMsg | TrustMsg;

export interface SaveMsg {
  type: 'save';
  target: NotesTarget;
  text: string;
}

export interface SplitterMsg {
  type: 'splitter';
  ratio: number;
}

export type WebviewToExtension = SaveMsg | SplitterMsg;
