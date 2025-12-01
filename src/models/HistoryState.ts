import type { Grammar } from "./Grammar";

/**
 * История для Undo/Redo
 */
export interface HistoryState {
  past: GrammarSnapshot[];
  present: GrammarSnapshot;
  future: GrammarSnapshot[];
  maxHistorySize: number;
}

export interface GrammarSnapshot {
  timestamp: number;
  grammar: Grammar;
  description: string; // Описание изменения
}