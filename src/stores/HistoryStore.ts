// src/stores/HistoryStore.ts
import { makeAutoObservable } from 'mobx';
import type { Grammar } from '../models/Grammar';
import type { HistoryState, GrammarSnapshot } from '../models/HistoryState';

/**
 * Исправленный HistoryStore.
 * - не пушит null в past
 * - корректно инициализирует present при первом push
 * - дедупликация snapshot'ов (если одинаковые, не пушим)
 * - защищает undo/redo переходы
 */

export class HistoryStore {
  state: HistoryState = {
    past: [],
    present: null as any,
    future: [],
    maxHistorySize: 50
  };

  constructor(maxHistorySize?: number) {
    if (maxHistorySize && Number.isFinite(maxHistorySize)) {
      this.state.maxHistorySize = Math.max(2, Math.floor(maxHistorySize));
    }
    makeAutoObservable(this);
  }

  private debug(msg: string) {
    // раскомментируй, если нужно детальное логирование
    console.debug('[HistoryStore]', msg, { past: this.state.past.length, present: this.state.present ? 1 : 0, future: this.state.future.length });
  }

  /**
   * Сохранение текущего состояния (snapshot grammar).
   * description опционален — полезен для отладки.
   */
  pushState(grammar: Grammar, description: string = '') {
    if (!grammar) return;

    const snapshot: GrammarSnapshot = {
      timestamp: Date.now(),
      grammar: deepClone(grammar),
      description
    };

    // Если нет present — инициализируем её (не пушим null в past)
    if (!this.state.present) {
      this.state.present = snapshot;
      this.state.past = [];
      this.state.future = [];
      this.debug('init present');
      return;
    }

    // Если snapshot совпадает с present — игнорируем
    if (isGrammarEqual(this.state.present.grammar, snapshot.grammar)) {
      this.debug('pushState: no-op (same as present)');
      return;
    }

    // Пушим текущий present в past
    this.state.past.push(this.state.present);
    // Устанавливаем новый present
    this.state.present = snapshot;
    // Очищаем future при новой ветке
    this.state.future = [];

    // Ограничение длины past
    if (this.state.past.length > this.state.maxHistorySize) {
      this.state.past.shift();
    }

    this.debug('pushed new snapshot');
  }

  // Отмена — возвращает grammar для применения
  undo(): Grammar | null {
    if (!this.canUndo) {
      this.debug('undo: cannot undo');
      return null;
    }

    // Текущий present переходит в начало future
    if (this.state.present) {
      this.state.future.unshift(this.state.present);
    }

    // Берём предыдущий snapshot из past
    const previous = this.state.past.pop()!;
    this.state.present = previous;

    this.debug('undo performed');
    return deepClone(previous.grammar);
  }

  // Повтор — возвращает grammar для применения
  redo(): Grammar | null {
    if (!this.canRedo) {
      this.debug('redo: cannot redo');
      return null;
    }

    // Берём следующий snapshot из future
    const next = this.state.future.shift()!;
    // Текущий present уходит в past (если он есть)
    if (this.state.present) {
      this.state.past.push(this.state.present);
    }
    this.state.present = next;

    // Подрезаем past при необходимости
    if (this.state.past.length > this.state.maxHistorySize) {
      this.state.past.shift();
    }

    this.debug('redo performed');
    return deepClone(next.grammar);
  }

  clear() {
    this.state.past = [];
    this.state.future = [];
    this.state.present = null as any;
    this.debug('cleared history');
  }

  get canUndo(): boolean {
    return this.state.past.length > 0 && !!this.state.present;
  }

  get canRedo(): boolean {
    return this.state.future.length > 0;
  }

  get historySize(): number {
    return this.state.past.length + (this.state.present ? 1 : 0) + this.state.future.length;
  }

  // Для UI/отладки — возвращаем краткую инфу
  getInfo() {
    return {
      past: this.state.past.length,
      present: !!this.state.present,
      future: this.state.future.length
    };
  }
}

/* ---------------- helpers ---------------- */

function deepClone<T>(v: T): T {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    // fallback: shallow clone (лучше, чем падение)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (Object.assign({}, v) as any) as T;
  }
}

function isGrammarEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

/* ---------- Экспорт singleton (удобство) ---------- */

export const historyStore = new HistoryStore();
export default HistoryStore;
