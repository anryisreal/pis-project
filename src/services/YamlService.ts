import * as yaml from 'js-yaml';
import type { Grammar } from '../models/Grammar';

/* ================== Геометрическая нормализация ================== */

const CELL_SIZE = 20;            // должно совпадать с CanvasStage
const DEFAULT_COLS = 4;
const DEFAULT_ROWS = 2;
const DEFAULT_WIDTH = DEFAULT_COLS * CELL_SIZE;
const DEFAULT_HEIGHT = DEFAULT_ROWS * CELL_SIZE;

function safeInt(v: any, fallback: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/**
 * Грубая оценка размера из строки вида "4 x 2", "4+ x 1..2", "4x2" и т.п.
 * Берём ПЕРВОЕ число в каждой части.
 */
function estimateBoundsFromSize(size?: string): { width: number; height: number } {
  if (!size || typeof size !== 'string') {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  const parts = size.split('x');
  if (parts.length !== 2) {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  const pickFirstInt = (raw: string, fallback: number) => {
    const m = raw.match(/(\d+)/);
    if (!m) return fallback;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const cols = pickFirstInt(parts[0], DEFAULT_COLS);
  const rows = pickFirstInt(parts[1], DEFAULT_ROWS);

  return {
    width: Math.max(1, cols) * CELL_SIZE,
    height: Math.max(1, rows) * CELL_SIZE
  };
}

/**
 * Гарантируем editor_bounds.width/height для паттерна
 */
function ensureEditorBounds(pattern: any): { width: number; height: number } {
  let w = safeInt(pattern?.editor_bounds?.width, NaN);
  let h = safeInt(pattern?.editor_bounds?.height, NaN);

  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
    const approx = estimateBoundsFromSize(pattern.size);
    w = approx.width;
    h = approx.height;
  }

  if (!pattern.editor_bounds) pattern.editor_bounds = {};
  pattern.editor_bounds.width = w;
  pattern.editor_bounds.height = h;

  return { width: w, height: h };
}

/**
 * Спец-разбор location, если он задан строкой:
 *   "left, right, top, bottom" или "coinside" → занять целиком родителя
 */
function normalizeLocationString(
  locStr: string | undefined,
  parentWidth: number,
  parentHeight: number
): { left: string; top: string; width: string; height: string } | null {
  if (!locStr) return null;

  const normalized = locStr.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'coinside') {
    return {
      left: '0',
      top: '0',
      width: String(Math.round(parentWidth)),
      height: String(Math.round(parentHeight))
    };
  }

  // "left, right, top, bottom" в любом порядке
  const parts = locStr
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean);

  const set = new Set(parts);
  const hasAll =
    set.has('left') && set.has('right') && set.has('top') && set.has('bottom');

  if (hasAll) {
    return {
      left: '0',
      top: '0',
      width: String(Math.round(parentWidth)),
      height: String(Math.round(parentHeight))
    };
  }

  return null;
}

/**
 * INNER: гарантируем, что все inner лежат ВНУТРИ рамки родителя.
 * Плюс поддерживаем случаи типа location: "left, right, top, bottom" / "coinside".
 */
function normalizeInnerLocations(pattern: any, parentWidth: number, parentHeight: number) {
  const entries = Object.entries(pattern.inner || {}) as [string, any][];

  const effParentW = Math.max(parentWidth || DEFAULT_WIDTH, 10);
  const effParentH = Math.max(parentHeight || DEFAULT_HEIGHT, 10);

  entries.forEach(([, inner], index) => {
    if (!inner) return;

    // ---- 1. location может быть строкой
    if (typeof inner.location === 'string') {
      const fromStr = normalizeLocationString(inner.location, effParentW, effParentH);
      if (fromStr) {
        inner.location = fromStr;
      } else {
        inner.location = {};
      }
    }

    const loc: any =
      typeof inner.location === 'object' && !Array.isArray(inner.location)
        ? { ...inner.location }
        : {};

    // ---- 2. Размеры
    let compW = safeInt(loc.width, DEFAULT_WIDTH);
    let compH = safeInt(loc.height, DEFAULT_HEIGHT);

    // inner не может быть больше родителя
    compW = Math.max(10, Math.min(compW, effParentW));
    compH = Math.max(10, Math.min(compH, effParentH));

    // ---- 3. Позиция
    let x: number;
    let y: number;

    const hasLeft = loc.left !== undefined;
    const hasTop = loc.top !== undefined;

    if (hasLeft || hasTop) {
      x = safeInt(loc.left, 0);
      y = safeInt(loc.top, 0);
    } else {
      // раскладка по сетке внутри родителя
      const col = index % 2;
      const row = Math.floor(index / 2);
      const GAP = 40;
      x = GAP + col * (compW + GAP);
      y = GAP + row * (compH + GAP);
    }

    // ---- 4. Жёсткий кламп внутрь родителя
    const maxX = effParentW - compW;
    const maxY = effParentH - compH;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;

    if (x + compW > effParentW) x = effParentW - compW;
    if (y + compH > effParentH) y = effParentH - compH;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    inner.location = {
      ...loc,
      left: String(Math.round(x)),
      top: String(Math.round(y)),
      width: String(Math.round(compW)),
      height: String(Math.round(compH))
    };
  });
}

/**
 * OUTER: расположить снаружи, при этом слегка ориентируясь на margin-ы.
 */
function normalizeOuterLocations(pattern: any, parentWidth: number, parentHeight: number) {
  const entries = Object.entries(pattern.outer || {}) as [string, any][];

  const effParentW = Math.max(parentWidth || DEFAULT_WIDTH, 10);
  const effParentH = Math.max(parentHeight || DEFAULT_HEIGHT, 10);

  const MARGIN_DEFAULT = 40;

  entries.forEach(([, outer], index) => {
    if (!outer) return;

    const loc: any =
      typeof outer.location === 'object' && !Array.isArray(outer.location)
        ? { ...outer.location }
        : {};

    let compW = safeInt(loc.width, DEFAULT_WIDTH);
    let compH = safeInt(loc.height, DEFAULT_HEIGHT);

    compW = Math.max(10, compW);
    compH = Math.max(10, compH);

    const mTop = safeInt(loc['margin-top'], 0);
    const mBottom = safeInt(loc['margin-bottom'], 0);
    const mLeft = safeInt(loc['margin-left'], 0);
    const mRight = safeInt(loc['margin-right'], 0);

    let vertical: 'top' | 'bottom' | 'center' = 'center';
    let horizontal: 'left' | 'right' | 'center' = 'center';

    if (mTop > 0 && mBottom === 0) vertical = 'top';
    else if (mBottom > 0 && mTop === 0) vertical = 'bottom';
    else if (mTop > 0 && mBottom > 0) vertical = mTop <= mBottom ? 'top' : 'bottom';

    if (mLeft > 0 && mRight === 0) horizontal = 'left';
    else if (mRight > 0 && mLeft === 0) horizontal = 'right';
    else if (mLeft > 0 && mRight > 0) horizontal = mLeft <= mRight ? 'left' : 'right';

    if (vertical === 'center' && horizontal === 'center') {
      const ring = index % 4;
      if (ring === 0) vertical = 'top';
      else if (ring === 1) horizontal = 'right';
      else if (ring === 2) vertical = 'bottom';
      else horizontal = 'left';
    }

    let x = 0;
    let y = 0;

    const gapTop = mTop > 0 ? mTop : MARGIN_DEFAULT;
    const gapBottom = mBottom > 0 ? mBottom : MARGIN_DEFAULT;
    const gapLeft = mLeft > 0 ? mLeft : MARGIN_DEFAULT;
    const gapRight = mRight > 0 ? mRight : MARGIN_DEFAULT;

    if (vertical === 'top') {
      y = -compH - gapTop;
    } else if (vertical === 'bottom') {
      y = effParentH + gapBottom;
    } else {
      y = effParentH / 2 - compH / 2;
    }

    if (horizontal === 'left') {
      x = -compW - gapLeft;
    } else if (horizontal === 'right') {
      x = effParentW + gapRight;
    } else {
      x = effParentW / 2 - compW / 2;
    }

    outer.location = {
      ...loc,
      left: String(Math.round(x)),
      top: String(Math.round(y)),
      width: String(Math.round(compW)),
      height: String(Math.round(compH))
    };
  });
}

/**
 * Общая нормализация одного паттерна:
 *   - editor_bounds
 *   - inner/outer геометрия
 */
function normalizePatternGeometry(pattern: any) {
  const { width, height } = ensureEditorBounds(pattern);

  if (pattern.kind === 'area') {
    normalizeInnerLocations(pattern, width, height);
    normalizeOuterLocations(pattern, width, height);
  }
}

/* ================== Сервис YAML / JSON ================== */

export class YamlService {
  /**
   * Универсальный парсер: пытается сначала JSON, затем YAML.
   * Подходит и для .yml/.yaml, и для .json.
   */
  static parse(content: string): Grammar {
    let parsed: any;

    // 1) Пытаемся как JSON
    try {
      parsed = JSON.parse(content);
      // если это примитив, а не объект — не подходит
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error('JSON is not an object');
      }
    } catch {
      // 2) Падаем обратно на YAML
      try {
        parsed = yaml.load(content) as any;
      } catch (error: any) {
        console.error('YAML/JSON parsing error:', error);
        throw new Error(`Не удалось распознать файл как JSON или YAML: ${error.message}`);
      }
    }

    // Приводим к типу Grammar
    const grammar: Grammar = {
      cell_types_filepath: parsed.cell_types_filepath || 'cnf/cell_types.yml',
      patterns: parsed.patterns || {},
      metadata: parsed.metadata || {
        name: 'Imported Grammar',
        author: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    // Нормализация patterns
    if (grammar.patterns) {
      Object.keys(grammar.patterns).forEach((key) => {
        const pattern = (grammar.patterns as any)[key];

        // Убираем undefined значения
        (Object.keys(pattern) as Array<keyof typeof pattern>).forEach(
          (propKey) => {
            if (pattern[propKey] === undefined) {
              delete pattern[propKey];
            }
          }
        );

        // Нормализация inner (inline definition)
        if (pattern.inner) {
          Object.keys(pattern.inner).forEach((innerKey) => {
            const inner = pattern.inner![innerKey];
            if (inner.pattern_definition && !inner.pattern) {
              console.log(`Pattern ${key}.${innerKey} has inline definition`);
            }
          });
        }

        // Геометрическая нормализация (editor_bounds + inner/outer)
        normalizePatternGeometry(pattern);
      });
    }

    return grammar;
  }

  /**
   * Старое название, для обратной совместимости.
   * Теперь просто вызывает универсальный parse().
   */
  static parseYaml(yamlContent: string): Grammar {
    return YamlService.parse(yamlContent);
  }

  /**
   * Явный метод только для JSON (если вдруг пригодится отдельно)
   */
  static parseJson(jsonContent: string): Grammar {
    return YamlService.parse(jsonContent);
  }

  /**
   * Конвертация Grammar в YAML строку
   */
  static toYaml(grammar: Grammar): string {
    try {
      // Создаем чистую копию без undefined значений
      const cleanGrammar = JSON.parse(JSON.stringify(grammar));

      // Убираем metadata при экспорте (опционально)
      if (cleanGrammar.metadata) {
        delete cleanGrammar.metadata;
      }

      return yaml.dump(cleanGrammar, {
        indent: 2,
        lineWidth: -1, // Без переноса строк
        noRefs: true,  // Без якорей
        sortKeys: false // Сохраняем порядок ключей
      });
    } catch (error: any) {
      console.error('YAML serialization error:', error);
      throw new Error(`Ошибка конвертации в YAML: ${error.message}`);
    }
  }
}

export default YamlService;
