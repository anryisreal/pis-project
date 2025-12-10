import type { Grammar } from '../models/Grammar';
import type { Pattern, InnerPattern, OuterPattern } from '../models/Pattern';
import {
  AbstractPattern,
  CellPattern,
  AreaPattern,
  ArrayPattern,
  ComponentPattern
} from '../models/PatternClasses';

/**
 * Адаптер для конвертации между старым форматом (Pattern) и новыми классами (AbstractPattern)
 *
 * Обеспечивает обратную совместимость и постепенную миграцию
 */
export class PatternAdapter {
  /**
   * Конвертация из старого формата Pattern в класс AbstractPattern
   */
  static fromJSON(name: string, pattern: Pattern, allPatterns: Map<string, AbstractPattern>): AbstractPattern {
    switch (pattern.kind) {
      case 'cell':
        return this.createCellPattern(name, pattern);

      case 'area':
        return this.createAreaPattern(name, pattern, allPatterns);

      case 'array':
        return this.createArrayPattern(name, pattern, allPatterns);

      default:
        throw new Error(`Unknown pattern kind: ${(pattern as any).kind}`);
    }
  }

  /**
   * Создание CellPattern из старого формата
   */
  private static createCellPattern(name: string, pattern: Pattern): CellPattern {
    const cell = new CellPattern(name, pattern.description, pattern.content_type);

    cell.size = pattern.size;
    cell.root = pattern.root;
    cell.count_in_document = pattern.count_in_document;
    cell.style = pattern.style;
    cell.editorBounds = pattern.editor_bounds;  // ✅ УЖЕ ЕСТЬ

    if (Array.isArray((pattern as any).extends)) {
      (cell as any).extends = (pattern as any).extends.slice();
    }

    return cell;
  }

  /**
   * Создание AreaPattern из старого формата
   */
  private static createAreaPattern(
    name: string,
    pattern: Pattern,
    allPatterns: Map<string, AbstractPattern>
  ): AreaPattern {
    const area = new AreaPattern(name, pattern.description);

    area.size = pattern.size;
    area.root = pattern.root;
    area.count_in_document = pattern.count_in_document;
    area.style = pattern.style;
    area.editorBounds = pattern.editor_bounds;  // ✅ ДОБАВЛЕНО

    // Загружаем inner элементы
    if (pattern.inner) {
      Object.entries(pattern.inner).forEach(([key, innerPattern]) => {
        const component = this.createComponentFromInner(key, innerPattern, allPatterns);
        if (component) {
          area.addInner(key, component);
        }
      });
    }

    // Загружаем outer элементы
    if (pattern.outer) {
      Object.entries(pattern.outer).forEach(([key, outerPattern]) => {
        const component = this.createComponentFromOuter(outerPattern, allPatterns);
        if (component) {
          area.addOuter(key, component);
        }
      });
    }

    return area;
  }

  /**
   * Создание ArrayPattern из старого формата
   */
  private static createArrayPattern(
    name: string,
    pattern: Pattern,
    allPatterns: Map<string, AbstractPattern>
  ): ArrayPattern {
    const array = new ArrayPattern(name, pattern.description, pattern.direction);

    array.size = pattern.size;
    array.root = pattern.root;
    array.count_in_document = pattern.count_in_document;
    array.style = pattern.style;
    array.item_count = pattern.item_count;
    array.gap = pattern.gap;
    array.editorBounds = pattern.editor_bounds;  // ✅ ДОБАВЛЕНО

    // Устанавливаем item_pattern: ссылка на AbstractPattern, НЕ ComponentPattern
    if (pattern.item_pattern) {
      const itemPatternObj = allPatterns.get(pattern.item_pattern);
      if (itemPatternObj) {
        array.setItemPattern(itemPatternObj);
      } else {
        // если по имени не нашли, явно обнулим
        array.item_pattern = undefined;
      }
    }

    return array;
  }

  /**
   * Создание ComponentPattern из InnerPattern
   */
  private static createComponentFromInner(
    key: string,
    innerPattern: InnerPattern,
    allPatterns: Map<string, AbstractPattern>
  ): ComponentPattern | null {
    // Если есть прямая ссылка на паттерн
    if (innerPattern.pattern) {
      const referencedPattern = allPatterns.get(innerPattern.pattern);
      if (referencedPattern) {
        const component = new ComponentPattern(referencedPattern, innerPattern.location);
        return component;
      }
    }

    // Если есть inline definition (pattern_definition)
    if (innerPattern.pattern_definition) {
      const def = innerPattern.pattern_definition;

      // Создаём временный паттерн на основе definition
      let inlinePattern: AbstractPattern | null = null;

      if (def.kind === 'cell') {
        // Inline cell
        inlinePattern = new CellPattern(
          `${key}_inline`,
          def.description,
          def.content_type
        );
        if (def.size) inlinePattern.size = def.size;
      } else if (def.kind === 'array') {
        // Inline array
        const arrayPattern = new ArrayPattern(
          `${key}_inline`,
          def.description
        );
        if (def.direction) {
          arrayPattern.direction = def.direction;
        }

        // Ссылаемся на item_pattern — КОНКРЕТНЫЙ PATTERN, НЕ ComponentPattern
        if (def.item_pattern) {
          const itemPattern = allPatterns.get(def.item_pattern);
          if (itemPattern) {
            arrayPattern.setItemPattern(itemPattern);
          } else {
            arrayPattern.item_pattern = undefined;
          }
        }

        if (def.item_count) {
          arrayPattern.item_count = def.item_count;
        }
        if (def.gap !== undefined) {
          arrayPattern.gap = def.gap;
        }

        inlinePattern = arrayPattern;
      } else if (def.kind === 'area') {
        // Inline area
        inlinePattern = new AreaPattern(
          `${key}_inline`,
          def.description
        );
        if (def.size) inlinePattern.size = def.size;
      }

      if (inlinePattern) {
        // Добавляем inline паттерн в общую коллекцию
        allPatterns.set(inlinePattern.name, inlinePattern);

        const component = new ComponentPattern(inlinePattern, innerPattern.location);
        return component;
      }
    }

    return null;
  }

  /**
   * Создание ComponentPattern из OuterPattern
   */
  private static createComponentFromOuter(
    outerPattern: OuterPattern,
    allPatterns: Map<string, AbstractPattern>
  ): ComponentPattern | null {
    if (outerPattern.pattern) {
      const referencedPattern = allPatterns.get(outerPattern.pattern);
      if (referencedPattern) {
        const component = new ComponentPattern(referencedPattern, outerPattern.location);
        return component;
      }
    }

    return null;
  }

  /**
   * Конвертация из класса AbstractPattern в старый формат Pattern
   */
  static toJSON(pattern: AbstractPattern): Pattern {
    return pattern.toJSON();
  }

  /**
   * Загрузка всей грамматики в формат классов
   *
   * @param grammar - старая грамматика
   * @returns Map с паттернами в новом формате
   */
  static loadGrammar(grammar: Grammar): Map<string, AbstractPattern> {
    const patterns = new Map<string, AbstractPattern>();

    if (!grammar.patterns) {
      return patterns;
    }

    // Первый проход: создаём все паттерны БЕЗ связей (чтобы разрешить циклические ссылки)
    Object.entries(grammar.patterns).forEach(([name, pattern]) => {
      switch (pattern.kind) {
        case 'cell':
          patterns.set(name, this.createCellPattern(name, pattern));
          break;
        case 'area':
          patterns.set(name, new AreaPattern(name, pattern.description));
          break;
        case 'array':
          patterns.set(name, new ArrayPattern(name, pattern.description, pattern.direction));
          break;
      }
    });

    // Второй проход: заполняем связи
    Object.entries(grammar.patterns).forEach(([name, pattern]) => {
      const patternObj = patterns.get(name);
      if (!patternObj) return;

      // Копируем базовые поля
      patternObj.size = pattern.size;
      patternObj.root = pattern.root;
      patternObj.count_in_document = pattern.count_in_document;
      patternObj.style = pattern.style;
      patternObj.editorBounds = pattern.editor_bounds;  // ✅ ДОБАВЛЕНО

      // Для Area - заполняем inner/outer
      if (pattern.kind === 'area' && patternObj instanceof AreaPattern) {
        if (pattern.inner) {
          Object.entries(pattern.inner).forEach(([key, innerPattern]) => {
            const component = this.createComponentFromInner(key, innerPattern, patterns);
            if (component) {
              patternObj.addInner(key, component);
            }
          });
        }

        if (pattern.outer) {
          Object.entries(pattern.outer).forEach(([key, outerPattern]) => {
            const component = this.createComponentFromOuter(outerPattern, patterns);
            if (component) {
              patternObj.addOuter(key, component);
            }
          });
        }
      }

      // Для Array - заполняем item_pattern и inner/outer
      if (pattern.kind === 'array' && patternObj instanceof ArrayPattern) {
        patternObj.item_count = pattern.item_count;
        patternObj.gap = pattern.gap;

        // item_pattern: имя → AbstractPattern
        if (pattern.item_pattern) {
          const itemPatternObj = patterns.get(pattern.item_pattern);
          if (itemPatternObj) {
            patternObj.setItemPattern(itemPatternObj);
          } else {
            patternObj.item_pattern = undefined;
          }
        } else {
          patternObj.item_pattern = undefined;
        }

        // inner: кладём ComponentPattern в Map напрямую
        if (pattern.inner) {
          Object.entries(pattern.inner).forEach(([key, innerPattern]) => {
            const component = this.createComponentFromInner(key, innerPattern, patterns);
            if (component) {
              patternObj.inner.set(key, component);
            }
          });
        }

        // outer: аналогично
        if (pattern.outer) {
          Object.entries(pattern.outer).forEach(([key, outerPattern]) => {
            const component = this.createComponentFromOuter(outerPattern, patterns);
            if (component) {
              patternObj.outer.set(key, component);
            }
          });
        }
      }

    });

    return patterns;
  }

  /**
   * Сохранение классов обратно в формат Grammar
   *
   * @param patterns - Map с паттернами в новом формате
   * @param metadata - метаданные грамматики
   * @returns Grammar в старом формате
   */
  static saveGrammar(
    patterns: Map<string, AbstractPattern>,
    cellTypesFilepath?: string,
    metadata?: Grammar['metadata']
  ): Grammar {
    const grammar: Grammar = {
      cell_types_filepath: cellTypesFilepath || 'cnf/cell_types.yml',
      patterns: {},
      metadata
    };

    patterns.forEach((pattern, name) => {
      grammar.patterns[name] = pattern.toJSON();
    });

    return grammar;
  }

  /**
   * Проверка совместимости паттерна с классами
   * (можно ли безопасно конвертировать)
   */
  static isCompatible(pattern: Pattern): boolean {
    // Проверяем базовые требования
    if (!pattern.kind) return false;

    // Для cell - не должно быть inner/outer
    if (pattern.kind === 'cell') {
      if (pattern.inner || pattern.outer) {
        console.warn('Cell pattern has inner/outer - not compatible');
        return false;
      }
    }

    return true;
  }
}