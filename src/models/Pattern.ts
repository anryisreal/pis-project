/**
 * Типы для описания паттернов грамматики
 */

export type PatternKind = 'cell' | 'area' | 'array' | 'array-in-context';

export type Direction = 'row' | 'column' | 'fill';

export type CountConstraint =
    | number
    | string
    | { min?: number; max?: number };

export interface LocationObject {
    [key: string]: string | number | undefined;
    'padding-top'?: string | number;
    'padding-right'?: string | number;
    'padding-bottom'?: string | number;
    'padding-left'?: string | number;
    'margin-top'?: string | number;
    'margin-right'?: string | number;
    'margin-bottom'?: string | number;
    'margin-left'?: string | number;
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
}

export type Location =
    | string[]
    | LocationObject
    | string;

export interface StyleConstraint {
    borders?: string | string[];
    [key: string]: any;
}

export interface PatternDefinition {
    kind?: PatternKind;
    direction?: Direction;
    description?: string;
    item_pattern?: string;
    item_count?: CountConstraint;
    gap?: string | number;
    size?: string;
    content_type?: string;
}

export interface InnerPattern {
    pattern?: string; // ✅ Optional - может быть pattern или pattern_definition
    pattern_definition?: PatternDefinition;
    location?: Location;
}

export interface OuterPattern {
    pattern: string; // ✅ Обязательное - outer всегда ссылается на конкретный паттерн
    location?: Location;
}

export interface Pattern {
    description?: string;
    kind: PatternKind;
    root?: boolean;
    count_in_document?: CountConstraint;
    size?: string;
    style?: StyleConstraint;

    // Cell-specific
    content_type?: string;

    // Area/Array
    inner?: Record<string, InnerPattern>;
    outer?: Record<string, OuterPattern>;

    // Array-specific
    direction?: Direction;
    item_pattern?: string;
    item_count?: CountConstraint;
    gap?: string | number;
    pattern_definition?: PatternDefinition;
}

// Вспомогательные типы
export interface PatternWithName extends Pattern {
    name: string;
}

export interface PatternReference {
    patternName: string;
    key: string;
    type: 'inner' | 'outer';
}