import type {
  Pattern,
  CountConstraint,
  Location,
  LocationObject,
  Direction,
  StyleConstraint
} from './Pattern';
import type { ValidationError } from './ValidationError';

/**
 * Padding для inner элементов (внутри паттерна)
 */
export interface Padding {
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
}

/**
 * Margin для outer элементов (контекст паттерна)
 */
export interface Margin {
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
}

/**
 * Базовый абстрактный класс для всех паттернов
 */
export abstract class AbstractPattern {
  name: string;
  description?: string;
  abstract kind: 'cell' | 'area' | 'array';
  size?: string;
  root?: boolean;
  count_in_document?: CountConstraint | string;  // ✅ ИСПРАВЛЕНО: добавлен | string
  style?: StyleConstraint;

  // ✅ Canvas editor bounds (для сохранения размера границы)
  editorBounds?: {
    width: number;
    height: number;
  };

  constructor(name: string, description?: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Конвертация в старый формат Pattern (для сериализации)
   */
  abstract toJSON(): Pattern;

  /**
   * Валидация паттерна
   */
  abstract validate(): ValidationError[];

  /**
   * Клонирование паттерна
   */
  abstract clone(): AbstractPattern;
}

/**
 * CellPattern - простая ячейка
 * НЕ имеет inner/outer элементов
 */
export class CellPattern extends AbstractPattern {
  kind: 'cell' = 'cell';
  content_type?: string;
  extends?: string[];

  constructor(name: string, description?: string, contentType?: string) {
    super(name, description);
    this.content_type = contentType;
  }

  /** Добавить родителя, если его ещё нет */
  addParent(name: string) {
    if (!name || typeof name !== 'string') return;

    if (!this.extends) this.extends = [];

    // уникальность
    if (!this.extends.includes(name)) {
      this.extends.push(name);
    }
  }

  /** Удалить родителя */
  removeParent(name: string) {
    if (!this.extends) return;

    this.extends = this.extends.filter((p) => p !== name);
    if (this.extends.length === 0) this.extends = undefined;
  }

  /** Полностью заменить список родителей */
  setParents(list: string[]) {
    if (!Array.isArray(list) || list.length === 0) {
      this.extends = undefined;
      return;
    }

    // уникальные строки
    const uniq = [...new Set(list.filter((x) => typeof x === 'string'))];

    this.extends = uniq.length > 0 ? uniq : undefined;
  }

  /** Полностью очистить наследование */
  clearParents() {
    this.extends = undefined;
  }

  /** Проверка: указан родитель или нет */
  hasParent(name: string): boolean {
    return !!this.extends?.includes(name);
  }

  toJSON(): Pattern {
    return {
      kind: 'cell',
      description: this.description,
      size: this.size,
      root: this.root,
      count_in_document: this.count_in_document,
      extends: this.extends,
      style: this.style,
      content_type: this.content_type,
      editor_bounds: this.editorBounds  // ✅ ДОБАВЛЕНО
    };
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.content_type) {
      errors.push({
        id: `cell-${this.name}-no-content-type`,
        severity: 'warning',
        message: `Cell паттерн "${this.name}" не имеет content_type`,
        elementId: this.name
      });
    }

    return errors;
  }

  clone(): CellPattern {
    const cloned = new CellPattern(this.name, this.description, this.content_type);
    cloned.size = this.size;
    cloned.root = this.root;
    cloned.count_in_document = this.count_in_document;
    cloned.extends = this.extends ? [...this.extends] : undefined;
    cloned.style = this.style ? { ...this.style } : undefined;
    cloned.editorBounds = this.editorBounds;  // ✅ ДОБАВЛЕНО
    return cloned;
  }
}

/**
 * ComponentPattern - обёртка над паттерном для использования в inner/outer
 */
export class ComponentPattern {
  name: string;
  pattern: AbstractPattern;
  location?: Location;

  constructor(pattern: AbstractPattern, location?: Location) {
    this.name = pattern.name;
    this.pattern = pattern;
    this.location = location;
  }

  /**
   * Установить padding (для inner)
   */
  setPadding(padding: Padding): void {
    const locationObj: LocationObject = {
      'padding-top': padding.top?.toString() || '0',
      'padding-right': padding.right?.toString() || '0',
      'padding-bottom': padding.bottom?.toString() || '0',
      'padding-left': padding.left?.toString() || '0'
    };
    this.location = locationObj;
  }

  /**
   * Установить margin (для outer)
   */
  setMargin(margin: Margin): void {
    const locationObj: LocationObject = {
      'margin-top': margin.top?.toString() || '0',
      'margin-right': margin.right?.toString() || '0',
      'margin-bottom': margin.bottom?.toString() || '0',
      'margin-left': margin.left?.toString() || '0'
    };
    this.location = locationObj;
  }

  /**
   * Получить padding
   */
  getPadding(): Padding | null {
    if (!this.location || typeof this.location !== 'object' || Array.isArray(this.location)) {
      return null;
    }

    const loc = this.location as LocationObject;
    return {
      top: loc['padding-top'],
      right: loc['padding-right'],
      bottom: loc['padding-bottom'],
      left: loc['padding-left']
    };
  }

  /**
   * Получить margin
   */
  getMargin(): Margin | null {
    if (!this.location || typeof this.location !== 'object' || Array.isArray(this.location)) {
      return null;
    }

    const loc = this.location as LocationObject;
    return {
      top: loc['margin-top'],
      right: loc['margin-right'],
      bottom: loc['margin-bottom'],
      left: loc['margin-left']
    };
  }

  clone(): ComponentPattern {
    return new ComponentPattern(this.pattern.clone(), this.location);
  }
}

/**
 * InnerComponent - inner элемент с padding
 */
export interface InnerComponent {
  key: string;
  component: ComponentPattern;
}

/**
 * OuterComponent - outer элемент с margin
 */
export interface OuterComponent {
  key: string;
  component: ComponentPattern;
}

/**
 * AreaPattern - область с inner/outer элементами
 */
export class AreaPattern extends AbstractPattern {
  kind: 'area' = 'area';
  inner: Map<string, ComponentPattern> = new Map();
  outer: Map<string, ComponentPattern> = new Map();

  constructor(name: string, description?: string) {
    super(name, description);
  }

  /**
   * Добавить inner элемент
   */
  addInner(key: string, component: ComponentPattern, padding?: Padding): void {
    if (padding) {
      component.setPadding(padding);
    }
    this.inner.set(key, component);
  }

  /**
   * Удалить inner элемент
   */
  removeInner(key: string): boolean {
    return this.inner.delete(key);
  }

  /**
   * Получить inner элемент
   */
  getInner(key: string): ComponentPattern | undefined {
    return this.inner.get(key);
  }

  /**
   * Добавить outer элемент
   */
  addOuter(key: string, component: ComponentPattern, margin?: Margin): void {
    if (margin) {
      component.setMargin(margin);
    }
    this.outer.set(key, component);
  }

  /**
   * Удалить outer элемент
   */
  removeOuter(key: string): boolean {
    return this.outer.delete(key);
  }

  /**
   * Получить outer элемент
   */
  getOuter(key: string): ComponentPattern | undefined {
    return this.outer.get(key);
  }

  /**
   * Получить все inner элементы
   */
  getAllInner(): InnerComponent[] {
    return Array.from(this.inner.entries()).map(([key, component]) => ({
      key,
      component
    }));
  }

  /**
   * Получить все outer элементы
   */
  getAllOuter(): OuterComponent[] {
    return Array.from(this.outer.entries()).map(([key, component]) => ({
      key,
      component
    }));
  }

  toJSON(): Pattern {
    const pattern: Pattern = {
      kind: 'area',
      description: this.description,
      size: this.size,
      root: this.root,
      count_in_document: this.count_in_document,
      style: this.style,
      inner: {},
      outer: {},
      editor_bounds: this.editorBounds  // ✅ ДОБАВЛЕНО
    };

    // Конвертируем inner
    this.inner.forEach((component, key) => {
      pattern.inner![key] = {
        pattern: component.pattern.name,
        location: component.location
      };
    });

    // Конвертируем outer
    this.outer.forEach((component, key) => {
      pattern.outer![key] = {
        pattern: component.pattern.name,
        location: component.location
      };
    });

    return pattern;
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Проверяем, что есть хотя бы один inner или outer
    if (this.inner.size === 0 && this.outer.size === 0) {
      errors.push({
        id: `area-${this.name}-empty`,
        severity: 'warning',
        message: `Area паттерн "${this.name}" не содержит inner или outer элементов`,
        elementId: this.name
      });
    }

    return errors;
  }

  clone(): AreaPattern {
    const cloned = new AreaPattern(this.name, this.description);
    cloned.size = this.size;
    cloned.root = this.root;
    cloned.count_in_document = this.count_in_document;
    cloned.style = this.style ? { ...this.style } : undefined;
    cloned.editorBounds = this.editorBounds;  // ✅ ДОБАВЛЕНО

    // Клонируем inner
    this.inner.forEach((component, key) => {
      cloned.inner.set(key, component.clone());
    });

    // Клонируем outer
    this.outer.forEach((component, key) => {
      cloned.outer.set(key, component.clone());
    });

    return cloned;
  }
}

/**
 * ArrayPattern - массив элементов
 */
export class ArrayPattern extends AbstractPattern {
  kind: 'array' = 'array';
  direction: Direction = 'row';
  item_pattern?: AbstractPattern;
  item_count?: CountConstraint | string;
  gap?: string;

  // Array также может иметь inner/outer для контекста
  inner: Map<string, ComponentPattern> = new Map();
  outer: Map<string, ComponentPattern> = new Map();

  constructor(
    name: string,
    description?: string,
    direction: Direction = 'row'
  ) {
    super(name, description);
    this.direction = direction;
  }

  /**
   * Установить паттерн элемента массива
   */
  setItemPattern(component: AbstractPattern): void {
    this.item_pattern = component;
  }

  /**
   * Получить паттерн элемента массива
   */
  getItemPattern(): AbstractPattern | undefined {
    return this.item_pattern;
  }

  toJSON(): Pattern {
    const pattern: Pattern = {
      kind: 'array',
      description: this.description,
      size: this.size,
      root: this.root,
      count_in_document: this.count_in_document,
      style: this.style,
      direction: this.direction,
      item_pattern: this.item_pattern?.name,
      item_count: this.item_count,
      gap: this.gap,
      inner: {},
      outer: {},
      editor_bounds: this.editorBounds  // ✅ ДОБАВЛЕНО
    };

    // Конвертируем inner
    this.inner.forEach((component, key) => {
      pattern.inner![key] = {
        pattern: component.pattern.name,
        location: component.location
      };
    });

    // Конвертируем outer
    this.outer.forEach((component, key) => {
      pattern.outer![key] = {
        pattern: component.pattern.name,
        location: component.location
      };
    });

    return pattern;
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.item_pattern) {
      errors.push({
        id: `array-${this.name}-no-item-pattern`,
        severity: 'error',
        message: `Array паттерн "${this.name}" не имеет item_pattern`,
        elementId: this.name
      });
    }

    if (!this.item_count) {
      errors.push({
        id: `array-${this.name}-no-item-count`,
        severity: 'warning',
        message: `Array паттерн "${this.name}" не имеет item_count`,
        elementId: this.name
      });
    }

    return errors;
  }

  clone(): ArrayPattern {
    const cloned = new ArrayPattern(this.name, this.description, this.direction);
    cloned.size = this.size;
    cloned.root = this.root;
    cloned.count_in_document = this.count_in_document;
    cloned.style = this.style ? { ...this.style } : undefined;
    cloned.item_pattern = this.item_pattern?.clone();
    cloned.item_count = this.item_count;
    cloned.gap = this.gap;
    cloned.editorBounds = this.editorBounds;  // ✅ ДОБАВЛЕНО

    return cloned;
  }
}

/**
 * Type guard для проверки типа паттерна
 */
export function isCellPattern(pattern: AbstractPattern): pattern is CellPattern {
  return pattern.kind === 'cell';
}

export function isAreaPattern(pattern: AbstractPattern): pattern is AreaPattern {
  return pattern.kind === 'area';
}

export function isArrayPattern(pattern: AbstractPattern): pattern is ArrayPattern {
  return pattern.kind === 'array';
}