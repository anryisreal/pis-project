// ===============================================
// Pattern.ts - Type definitions
// ===============================================

export interface CountConstraint {
  min?: number;
  max?: number;
}

export interface StyleConstraint {
  [key: string]: any;
}

export type Direction = 'row' | 'column' | 'fill';

export interface LocationObject {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  'padding-top'?: string;
  'padding-left'?: string;
  'padding-right'?: string;
  'padding-bottom'?: string;
  'margin-top'?: string;
  'margin-left'?: string;
  'margin-right'?: string;
  'margin-bottom'?: string;

  width?: string;
  height?: string;
}

export type Location = LocationObject | string | string[];

export interface PatternDefinition {
  kind: 'cell' | 'area' | 'array';
  description?: string;
  size?: string;
  content_type?: string;
  extends?: string[];
  direction?: Direction;
  item_pattern?: string;
  item_count?: CountConstraint | string;
  gap?: string;
  style?: StyleConstraint;
}

export interface ComponentPattern {
  pattern?: string;
  pattern_definition?: PatternDefinition;
  location?: Location;
}

// ✅ Экспортируем для PatternAdapter
export type InnerPattern = ComponentPattern;
export type OuterPattern = ComponentPattern;

export interface Pattern {
  kind: 'cell' | 'area' | 'array';
  description?: string;
  size?: string;
  root?: boolean;
  count_in_document?: CountConstraint | string;
  style?: StyleConstraint;

  // Cell specific
  content_type?: string;
  extends?: string[];

  // Area/Array specific
  inner?: { [key: string]: ComponentPattern };
  outer?: { [key: string]: ComponentPattern };

  // Array specific
  direction?: Direction;
  item_pattern?: string;
  item_count?: CountConstraint | string;
  gap?: string;

  // ✅ Canvas editor bounds
  editor_bounds?: {
    width: number;
    height: number;
  };
}