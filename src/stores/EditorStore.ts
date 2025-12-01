import { makeAutoObservable } from 'mobx';
import { type EditorMode, type EditorTool } from '../models/EditorState';
import type { Position } from "../models/VisualElement.ts";

export interface EditorState {
  selectedElements: string[];
  hoveredElement: string | null;
  hoveredInnerOuterElement: string | null; // NEW: для отслеживания наведения на inner/outer
  mode: EditorMode;
  tool: EditorTool;
  zoom: number;
  pan: Position;
  isFocusMode: boolean; // NEW: режим фокуса на паттерне
}

export class EditorStore {
  state: EditorState = {
    selectedElements: [],
    hoveredElement: null,
    hoveredInnerOuterElement: null,
    mode: 'select',
    tool: 'pointer',
    zoom: 1,
    pan: { x: 0, y: 0 },
    isFocusMode: false
  };

  constructor() {
    makeAutoObservable(this);

    // Слушаем нажатие ESC для выхода из режима фокуса
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.state.isFocusMode) {
      this.exitFocusMode();
    }
  };

  // Выбор элемента
  selectElement(id: string, addToSelection: boolean = false) {
    if (addToSelection) {
      if (!this.state.selectedElements.includes(id)) {
        this.state.selectedElements.push(id);
      }
    } else {
      this.state.selectedElements = [id];
    }
    // Входим в режим фокуса при выборе паттерна
    this.state.isFocusMode = true;
  }

  // Снятие выбора
  deselectElement(id: string) {
    this.state.selectedElements = this.state.selectedElements.filter(
      selectedId => selectedId !== id
    );
    if (this.state.selectedElements.length === 0) {
      this.exitFocusMode();
    }
  }

  // Снятие всех выборов
  deselectAll() {
    this.state.selectedElements = [];
    this.exitFocusMode();
  }

  // Выход из режима фокуса
  exitFocusMode() {
    this.state.isFocusMode = false;
    this.state.selectedElements = [];
    this.state.hoveredInnerOuterElement = null;
  }

  // Наведение на элемент
  setHoveredElement(id: string | null) {
    this.state.hoveredElement = id;
  }

  // NEW: Наведение на inner/outer элемент
  setHoveredInnerOuterElement(id: string | null) {
    this.state.hoveredInnerOuterElement = id;
  }

  // Смена режима
  setMode(mode: EditorMode) {
    this.state.mode = mode;
  }

  // Смена инструмента
  setTool(tool: EditorTool) {
    this.state.tool = tool;
  }

  // Зум
  setZoom(zoom: number) {
    this.state.zoom = Math.max(0.1, Math.min(3, zoom));
  }

  zoomIn() {
    this.setZoom(this.state.zoom * 1.2);
  }

  zoomOut() {
    this.setZoom(this.state.zoom / 1.2);
  }

  // Панорамирование
  setPan(pan: Position) {
    this.state.pan = pan;
  }

  // Проверки
  get hasSelection(): boolean {
    return this.state.selectedElements.length > 0;
  }

  get selectedCount(): number {
    return this.state.selectedElements.length;
  }

  isSelected(id: string): boolean {
    return this.state.selectedElements.includes(id);
  }

  isHovered(id: string): boolean {
    return this.state.hoveredElement === id;
  }

  dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }
}