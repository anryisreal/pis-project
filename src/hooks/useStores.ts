import { createContext, useContext } from 'react';
import type { RootStore } from '../stores/RootStore';

const StoreContext = createContext<RootStore | null>(null);

export const StoreProvider = StoreContext.Provider;

export const useStores = () => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStores must be used within StoreProvider');
  }
  return store;
};

export const useGrammarStore = () => useStores().grammarStore;
export const useEditorStore = () => useStores().editorStore;
export const useHistoryStore = () => useStores().historyStore;