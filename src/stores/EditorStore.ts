import { makeAutoObservable } from 'mobx';
import { type EditorMode, type EditorTool } from '../models/EditorState';
import type { Position } from "../models/VisualElement.ts";

export interface EditorState {
  selectedElements: string[];
  hoveredElement: string | null;
  hoveredInnerOuterElement: string | null;
  mode: EditorMode;
  tool: EditorTool;
  zoom: number;
  pan: Position;
  isFocusMode: boolean;
  activeInnerElement: string | null; // ✅ Активный inner элемент в режиме фокуса
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
    isFocusMode: false,
    activeInnerElement: null
  };

  grammarStore: any = null;

  constructor() {
    makeAutoObservable(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  setGrammarStore(grammarStore: any) {
    this.grammarStore = grammarStore;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.state.isFocusMode) {
      if (this.state.activeInnerElement) {
        // Первый ESC: снять выбор с inner элемента
        console.log('ESC #1: Clearing active inner element');
        this.setActiveInnerElement(null);
      } else {
        // Второй ESC: выйти из режима фокуса
        console.log('ESC #2: Exiting focus mode');
        this.exitFocusMode();
      }
    }
  };

  selectElement(id: string, addToSelection: boolean = false, skipFocusMode: boolean = false) {
    if (addToSelection) {
      if (!this.state.selectedElements.includes(id)) {
        this.state.selectedElements.push(id);
      }
    } else {
      this.state.selectedElements = [id];
    }

    if (skipFocusMode) {
      this.state.isFocusMode = false;
      return;
    }

    if (this.grammarStore) {
      const pattern = this.grammarStore.findPatternByName(id);

      if (pattern) {
        // ✅ ВСЕ паттерны редактируем на отдельном холсте
        this.state.isFocusMode = true;
        // При входе в фокус — сбрасываем внутреннюю активность
        this.state.activeInnerElement = null;
        this.state.hoveredInnerOuterElement = null;
      }
    }
  }



  deselectElement(id: string) {
    this.state.selectedElements = this.state.selectedElements.filter(
      selectedId => selectedId !== id
    );
    if (this.state.selectedElements.length === 0) {
      this.exitFocusMode();
    }
  }

  deselectAll() {
    this.state.selectedElements = [];
    this.exitFocusMode();
  }

  exitFocusMode() {
    this.state.isFocusMode = false;
    this.state.selectedElements = [];
    this.state.hoveredInnerOuterElement = null;
    this.state.activeInnerElement = null; // ✅ Сбрасываем активный inner элемент
  }

  setHoveredElement(id: string | null) {
    this.state.hoveredElement = id;
  }

  setHoveredInnerOuterElement(id: string | null) {
    this.state.hoveredInnerOuterElement = id;
  }

  setActiveInnerElement(id: string | null) {
    this.state.activeInnerElement = id;
  }

  setMode(mode: EditorMode) {
    this.state.mode = mode;
  }

  setTool(tool: EditorTool) {
    this.state.tool = tool;
  }

  setZoom(zoom: number) {
    this.state.zoom = Math.max(0.1, Math.min(3, zoom));
  }

  zoomIn() {
    this.setZoom(this.state.zoom * 1.2);
  }

  zoomOut() {
    this.setZoom(this.state.zoom / 1.2);
  }

  setPan(pan: Position) {
    this.state.pan = pan;
  }

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

  /**
   * Переименовать id выбранного элемента (для синхронизации с переименованием паттерна)
   */
  renameElementId(oldId: string, newId: string) {
    this.state.selectedElements = this.state.selectedElements.map((id) =>
      id === oldId ? newId : id
    );
  }
}