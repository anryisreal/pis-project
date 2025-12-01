import type { CellTypeDefinition } from "./CellType";
import type { Pattern } from "./Pattern";

/**
 * Визуальное представление элемента для Canvas
 */
export interface VisualElement {
  id: string;
  name: string; // Имя паттерна из YAML
  type: 'cell' | 'pattern';
  
  // Визуальные свойства
  position: Position;
  size: Size;
  color: string;
  
  // Связи
  children: string[]; // IDs дочерних элементов
  parent: string | null; // ID родителя
  connections: Connection[]; // Пространственные связи
  
  // Данные из грамматики
  patternData: Pattern | CellTypeDefinition;
  
  // UI состояние
  isExpanded: boolean; // Развёрнут ли элемент (для показа детей)
  isSelected: boolean;
  isHovered: boolean;
}

export interface Connection {
  id: string;
  fromElementId: string;
  toElementId: string;
  relationType: RelationType;
  label?: string;
}

export type RelationType = 
  | 'inner'      // Содержит внутри (inner)
  | 'outer'      // Контекст (outer)
  | 'reference'; // Просто ссылка

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}