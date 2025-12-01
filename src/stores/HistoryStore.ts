import { makeAutoObservable } from 'mobx';
import type { Grammar } from '../models/Grammar';
import type {HistoryState, GrammarSnapshot} from '../models/HistoryState';

export class HistoryStore {
  state: HistoryState = {
    past: [],
    present: null as any,
    future: [],
    maxHistorySize: 50
  };

  constructor() {
    makeAutoObservable(this);
  }

  // Сохранение текущего состояния
  pushState(grammar: Grammar, description: string) {
    const snapshot: GrammarSnapshot = {
      timestamp: Date.now(),
      grammar: JSON.parse(JSON.stringify(grammar)), // Deep clone
      description
    };

    this.state.past.push(this.state.present);
    this.state.present = snapshot;
    this.state.future = [];

    // Ограничение размера истории
    if (this.state.past.length > this.state.maxHistorySize) {
      this.state.past.shift();
    }
  }

  // Отмена
  undo(): Grammar | null {
    if (!this.canUndo) return null;

    const previous = this.state.past.pop()!;
    this.state.future.unshift(this.state.present);
    this.state.present = previous;

    return previous.grammar;
  }

  // Повтор
  redo(): Grammar | null {
    if (!this.canRedo) return null;

    const next = this.state.future.shift()!;
    this.state.past.push(this.state.present);
    this.state.present = next;

    return next.grammar;
  }

  // Очистка истории
  clear() {
    this.state.past = [];
    this.state.future = [];
  }

  // Проверки
  get canUndo(): boolean {
    return this.state.past.length > 0;
  }

  get canRedo(): boolean {
    return this.state.future.length > 0;
  }

  get historySize(): number {
    return this.state.past.length + this.state.future.length + 1;
  }
}