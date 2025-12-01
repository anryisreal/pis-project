/**
 * Общие типы
 */
export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Bounds extends Position, Size {}

// Экспорт компонентов
export { Button } from './Button';
export { Input } from './Input';
export { ResizablePanel } from './ResizablePanel';