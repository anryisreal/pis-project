import { GrammarStore } from './GrammarStore';
import { EditorStore } from './EditorStore';
import { HistoryStore } from './HistoryStore';

export class RootStore {
  grammarStore: GrammarStore;
  editorStore: EditorStore;
  historyStore: HistoryStore;

  constructor() {
    this.grammarStore = new GrammarStore();
    this.editorStore = new EditorStore();
    this.historyStore = new HistoryStore();

    this.editorStore.setGrammarStore(this.grammarStore);
  }
}