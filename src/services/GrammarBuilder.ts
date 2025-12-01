import type {Grammar} from '../models/Grammar';
import type { VisualElement } from '../models/VisualElement';
import { v4 as uuidv4 } from 'uuid';  // FIX: Импорт uuid

/**
 * Строит визуальное представление грамматики для Canvas
 */
export class GrammarBuilder {
    private static readonly CELL_WIDTH = 150;
    private static readonly CELL_HEIGHT = 80;
    private static readonly PATTERN_WIDTH = 200;
    private static readonly PATTERN_HEIGHT = 120;
    private static readonly SPACING = 50;

    /**
     * Конвертация Grammar в визуальные элементы
     */
    static buildVisualElements(grammar: Grammar): VisualElement[] {
        const elements: VisualElement[] = [];
        let yOffset = 100;

        if (!grammar.patterns) return elements;

        // Создаём визуальные элементы для каждого паттерна
        for (const [name, pattern] of Object.entries(grammar.patterns)) {
            const element = this.createVisualElement(name, pattern, yOffset);
            elements.push(element);
            yOffset += (pattern.kind === 'cell' ? this.CELL_HEIGHT : this.PATTERN_HEIGHT) + this.SPACING;
        }

        return elements;
    }

    /**
     * Создание визуального элемента из паттерна
     */
    private static createVisualElement(
        name: string,
        pattern: any,
        yOffset: number
    ): VisualElement {
        const width = pattern.kind === 'cell' ? this.CELL_WIDTH : this.PATTERN_WIDTH;
        const height = pattern.kind === 'cell' ? this.CELL_HEIGHT : this.PATTERN_HEIGHT;

        return {
            id: uuidv4(),  // FIX: Уникальный ID с uuid вместо Date.now() + random
            name,
            type: 'pattern',
            position: { x: 100, y: yOffset },
            size: { width, height },
            color: this.getColorForKind(pattern.kind),
            children: [],
            parent: null,
            connections: [],
            patternData: pattern,
            isExpanded: false,
            isSelected: false,
            isHovered: false
        };
    }

    /**
     * Получение цвета по типу паттерна
     */
    private static getColorForKind(kind: string): string {
        const colorMap: Record<string, string> = {
            'cell': '#3b82f6',      // blue
            'area': '#10b981',      // green
            'array': '#f59e0b',     // amber
            'array-in-context': '#8b5cf6' // purple
        };
        return colorMap[kind] || '#6b7280'; // gray default
    }
}