import type { Position } from "./VisualElement";

/**
 * Состояние редактора
 */
export interface EditorState {
  selectedElements: string[]; // IDs выбранных элементов
  hoveredElement: string | null;
  mode: EditorMode;
  tool: EditorTool;
  zoom: number;
  pan: Position;
}

export type EditorMode = 'select' | 'draw' | 'connect' | 'pan';

export type EditorTool = 
  | 'pointer'
  | 'cell'
  | 'area'
  | 'array'
  | 'connection'
  | 'hand';
