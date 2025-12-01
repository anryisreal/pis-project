/**
 * Узел дерева для Sidebar
 */
export interface TreeNode {
    id: string;
    name: string;
    type: 'cell_type' | 'pattern' | 'inner' | 'outer' | 'array_item';
    icon?: string;

    // Иерархия
    children: TreeNode[];
    parent: TreeNode | null;
    level: number;

    // UI состояние
    isExpanded: boolean;
    isSelected: boolean;

    // Ссылка на данные
    elementId: string; // ID элемента на Canvas
    patternKey?: string; // Ключ в YAML

    patternData?: any; // Данные паттерна
}