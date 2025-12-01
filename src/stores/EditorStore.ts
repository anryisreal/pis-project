import { makeAutoObservable } from 'mobx';
import {type EditorState, type EditorMode, type EditorTool } from '../models/EditorState';
import type {Position} from "../models/VisualElement.ts";

export class EditorStore {
  state: EditorState = {
    selectedElements: [],
    hoveredElement: null,
    mode: 'select',
    tool: 'pointer',
    zoom: 1,
    pan: { x: 0, y: 0 }
  };

  constructor() {
    makeAutoObservable(this);
  }

  // Выбор элемента
  selectElement(id: string, addToSelection: boolean = false) {
    if (addToSelection) {
      if (!this.state.selectedElements.includes(id)) {
        this.state.selectedElements.push(id);
      }
    } else {
      this.state.selectedElements = [id];
    }
  }

  // Снятие выбора
  deselectElement(id: string) {
    this.state.selectedElements = this.state.selectedElements.filter(
      selectedId => selectedId !== id
    );
  }

  // Снятие всех выборов
  deselectAll() {
    this.state.selectedElements = [];
  }

  // Наведение на элемент
  setHoveredElement(id: string | null) {
    this.state.hoveredElement = id;
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
}