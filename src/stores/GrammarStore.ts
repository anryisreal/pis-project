// src/stores/GrammarStore.ts
import { makeAutoObservable, reaction } from 'mobx';
import type { Grammar } from '../models/Grammar';
import type { Pattern } from '../models/Pattern';
import { StorageService } from '../services/StorageService';
import {
  AbstractPattern,
  CellPattern,
  AreaPattern,
  ArrayPattern,
  ComponentPattern,
  isCellPattern,
  isAreaPattern,
  isArrayPattern
} from '../models/PatternClasses';
import { PatternAdapter } from '../services/PatternAdapter';

// ---- интеграция истории ----
import { historyStore } from './HistoryStore';


export interface PatternUsages {
  // где этот паттерн указан в extends у других cell-паттернов
  inExtends: string[];

  // где он используется как item_pattern в ArrayPattern
  asArrayItem: string[];

  // где он используется как inner
  asInner: { patternName: string; key: string }[];

  // где он используется как outer
  asOuter: { patternName: string; key: string }[];
}



export class GrammarStore {
  // Текущее состояние грамматики (в формате, пригодном для экспорта / истории)
  grammar: Grammar | null = null;

  // Оригинальный YAML без изменений (для отладки/сравнения)
  originalGrammar: Grammar | null = null;

  isModified: boolean = false;
  lastSaved: Date | null = null;

  // Счётчик для генерации имён pattern_N
  private patternCounter: number = 1;

  // Новая объектная модель: реестр паттернов
  patterns: Map<string, AbstractPattern> = new Map();

  // Флаг, чтобы подавить пуш в историю при применении snapshot (undo/redo)
  private suppressHistory: boolean = false;

  constructor() {
    makeAutoObservable(this);

    // Автосохранение в localStorage при изменениях грамматики
    reaction(
      () => this.grammar,
      (grammar) => {
        if (grammar && this.isModified) {
          StorageService.autoSave(grammar);
        }
      },
      { delay: 1000 }
    );
  }

  // ========== БАЗОВЫЕ ОПЕРАЦИИ С ГРАММАТИКОЙ ==========

  createNew() {
    const now = new Date().toISOString();

    this.patterns = new Map();
    this.patternCounter = 1;

    this.grammar = {
      cell_types_filepath: 'cnf/cell_types.yml',
      patterns: {},
      metadata: {
        name: 'Новая грамматика',
        author: '',
        createdAt: now,
        updatedAt: now
      }
    };

    this.originalGrammar = JSON.parse(JSON.stringify(this.grammar));
    this.isModified = false;
    this.lastSaved = new Date();

    // Инициализация истории начальным snapshot'ом
    try {
      historyStore.clear();
      historyStore.pushState(this.grammar, 'createNew');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('history push failed at createNew', e);
    }
  }

  loadGrammar(grammar: Grammar) {
    // Сохраняем исходный YAML
    this.originalGrammar = JSON.parse(JSON.stringify(grammar));

    // Загружаем в объектную модель
    this.patterns = PatternAdapter.loadGrammar(grammar);

    // Нормализованный снапшот для экспорта / истории
    this.grammar = PatternAdapter.saveGrammar(
      this.patterns,
      grammar.cell_types_filepath,
      grammar.metadata
    );

    // Обновляем счётчик имён pattern_N
    const numbersFromNames = Array.from(this.patterns.keys())
      .filter((name) => name.startsWith('pattern_'))
      .map((name) => parseInt(name.replace('pattern_', ''), 10))
      .filter((n) => !Number.isNaN(n));

    this.patternCounter =
      numbersFromNames.length > 0 ? Math.max(...numbersFromNames) + 1 : 1;

    this.isModified = false;
    this.lastSaved = new Date();

    // Инициализация истории: present = загруженная грамматика
    try {
      historyStore.clear();
      if (this.grammar) {
        historyStore.pushState(this.grammar, 'loadGrammar');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('history push failed at loadGrammar', e);
    }
  }

  restoreFromAutoSave(): boolean {
    const autoSave = StorageService.loadAutoSave();
    if (!autoSave) return false;

    this.loadGrammar(autoSave.grammar);
    console.log('✅ Restored from autosave:', new Date(autoSave.timestamp));

    // После restore — инициализировать историю на этом состоянии
    try {
      if (this.grammar) {
        historyStore.clear();
        historyStore.pushState(this.grammar, 'restoreFromAutoSave');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('history push failed at restoreFromAutoSave', e);
    }

    return true;
  }


  addCellPatternClass(name?: string, description?: string): CellPattern {
    const patternName = name || this.generatePatternName();
    const cell = new CellPattern(patternName, description);
    this.patterns.set(patternName, cell);
    this.syncToGrammar();
    this.markAsModified();
    return cell;
  }

  addAreaPatternClass(name?: string, description?: string): AreaPattern {
    const patternName = name || this.generatePatternName();
    const area = new AreaPattern(patternName, description);
    this.patterns.set(patternName, area);
    this.syncToGrammar();
    this.markAsModified();
    return area;
  }

  addArrayPatternClass(name?: string, description?: string): ArrayPattern {
    const patternName = name || this.generatePatternName();
    const array = new ArrayPattern(patternName, description);
    this.patterns.set(patternName, array);
    this.syncToGrammar();
    this.markAsModified();
    return array;
  }


  /**
   * Переименовать паттерн:
   * - меняем ключ в Map
   * - меняем pattern.name
   * - обновляем все строковые ссылки (extends и т.п.)
   */
  renamePattern(oldName: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    if (trimmed === oldName) return true;

    // Имя уже занято другим паттерном
    if (this.patterns.has(trimmed)) return false;

    const pattern = this.patterns.get(oldName);
    if (!pattern) return false;

    // Удаляем старую запись и обновляем имя у объекта
    this.patterns.delete(oldName);
    pattern.name = trimmed;
    this.patterns.set(trimmed, pattern);

    // Обновляем строковые ссылки (extends у cell)
    this.patterns.forEach((p) => {
      if (isCellPattern(p)) {
        const exts: string[] = (p as any).extends || [];
        if (!Array.isArray(exts) || exts.length === 0) return;

        const updated = exts.map((parentName) =>
          parentName === oldName ? trimmed : parentName
        );

        (p as any).extends = updated;
      }
    });

    // inner/outer и item_pattern хранят ссылки на сам объект паттерна,
    // а не строку-имя, поэтому после смены pattern.name они уже "в курсе".

    // MobX-триггер
    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();

    return true;
  }



  /**
   * Получить паттерн-класс по имени
   */
  getPatternClass(name: string): AbstractPattern | null {
    return this.patterns.get(name) || null;
  }

  /**
   * Обновить паттерн-класс целиком
   */
  updatePatternClass(pattern: AbstractPattern): void {
    this.patterns.set(pattern.name, pattern);
    this.syncToGrammar();
    this.markAsModified();
  }

  /**
   * Удалить паттерн-класс
   */
  deletePatternClass(name: string): boolean {
    const deleted = this.patterns.delete(name);
    if (deleted) {
      this.syncToGrammar();
      this.markAsModified();
    }
    return deleted;
  }

  /**
   * Получить все паттерны определённого типа по предикату
   */
  getPatternsByType<T extends AbstractPattern>(
    predicate: (pattern: AbstractPattern) => pattern is T
  ): T[] {
    return Array.from(this.patterns.values()).filter(predicate);
  }

  // ========== ПУБЛИЧНЫЕ МЕТОДЫ, КОТОРЫЕ ИСПОЛЬЗУЕТ UI ==========

  /**
   * Добавить паттерн нужного типа (используется тулбаром)
   */
  addPattern(kind: 'cell' | 'area' | 'array') {
    switch (kind) {
      case 'cell':
        return this.addCellPatternClass().name;
      case 'area':
        return this.addAreaPatternClass().name;
      case 'array':
        return this.addArrayPatternClass().name;
      default:
        return;
    }
  }

  /**
   * Обновление свойств паттерна через UI
   */
  updatePattern(name: string, updates: Partial<Pattern>) {
    const pattern = this.patterns.get(name);
    if (!pattern) return;

    // Вынимаем editor_bounds отдельно, чтобы корректно обработать
    const { editor_bounds, kind, inner, outer, ...restUpdates } = updates as any;

    // -----------------------------------------
    // 1️⃣ Обновляем тип паттерна (если изменился kind)
    // -----------------------------------------
    if (kind && kind !== pattern.kind) {
      let newPattern: AbstractPattern;

      switch (kind) {
        case 'cell': {
          newPattern = new CellPattern(
            name,
            restUpdates.description ?? pattern.description,
            restUpdates.content_type ?? (pattern as any).content_type
          );
          break;
        }

        case 'area': {
          newPattern = new AreaPattern(
            name,
            restUpdates.description ?? pattern.description
          );
          break;
        }

        case 'array': {
          newPattern = new ArrayPattern(
            name,
            restUpdates.description ?? pattern.description,
            restUpdates.direction ??
            (isArrayPattern(pattern) ? pattern.direction : 'row')
          );

          // 🔹 item_pattern: строка из updates → AbstractPattern
          if (typeof (restUpdates as any).item_pattern === 'string') {
            const itemName = (restUpdates as any).item_pattern as string;
            if (itemName) {
              const ref = this.patterns.get(itemName);
              if (ref) {
                (newPattern as ArrayPattern).setItemPattern(ref);
              }
            }
          } else if (isArrayPattern(pattern)) {
            // если из формы ничего не пришло — тащим старое, если оно было
            const oldItem = pattern.getItemPattern();
            if (oldItem) {
              (newPattern as ArrayPattern).setItemPattern(oldItem);
            }
          }

          (newPattern as any).item_count =
            restUpdates.item_count ??
            (isArrayPattern(pattern) ? pattern.item_count : undefined);
          (newPattern as any).gap =
            restUpdates.gap ??
            (isArrayPattern(pattern) ? pattern.gap : undefined);

          break;
        }


        default:
          return;
      }

      // Общие поля
      newPattern.size = restUpdates.size ?? pattern.size;
      newPattern.root =
        restUpdates.root !== undefined ? restUpdates.root : pattern.root;
      newPattern.count_in_document =
        restUpdates.count_in_document ?? pattern.count_in_document;
      newPattern.style = restUpdates.style ?? pattern.style;
      (newPattern as any).editorBounds =
        editor_bounds ?? (pattern as any).editorBounds;

      if (kind === 'cell') {
        (newPattern as any).extends =
          restUpdates.extends !== undefined
            ? restUpdates.extends
            : (pattern as any).extends;
      }

      // Переносим внутренние компоненты, если тип совместим
      if (isAreaPattern(pattern) && isAreaPattern(newPattern)) {
        pattern.getAllInner().forEach(({ key, component }) => {
          newPattern.addInner(key, component.clone());
        });
        pattern.getAllOuter().forEach(({ key, component }) => {
          newPattern.addOuter(key, component.clone());
        });
      }

      if (isArrayPattern(pattern) && isArrayPattern(newPattern)) {
        pattern.inner.forEach((component, key) => {
          newPattern.inner.set(key, component.clone());
        });
        pattern.outer.forEach((component, key) => {
          newPattern.outer.set(key, component.clone());
        });
        const oldItem = pattern.getItemPattern();
        if (oldItem) {
          newPattern.setItemPattern(oldItem.clone());
        }
      }

      this.patterns.set(name, newPattern);

      this.rebindComponentRefs(newPattern);

      this.cleanupExtendsForNonCell(name);
    }

      // -----------------------------------------
      // 2️⃣ Если kind не менялся → обновляем поля на месте
    // -----------------------------------------
    else {
      Object.assign(pattern as any, restUpdates);

      // 🔹 Спец-обработка item_pattern для ArrayPattern
      if (isArrayPattern(pattern) && 'item_pattern' in (restUpdates as any)) {
        const raw = (restUpdates as any).item_pattern;

        if (typeof raw === 'string' && raw) {
          const ref = this.patterns.get(raw);
          if (ref) {
            pattern.setItemPattern(ref);
          } else {
            pattern.item_pattern = undefined;
          }
        } else {
          // пустая строка / null / undefined → очистка
          pattern.item_pattern = undefined;
        }
      }
    }

    // -----------------------------------------
    // 3️⃣ Переносим editor_bounds → editorBounds
    // -----------------------------------------
    if (editor_bounds) {
      (pattern as any).editorBounds = {
        width:
          typeof editor_bounds.width === 'number'
            ? editor_bounds.width
            : (pattern as any).editorBounds?.width,
        height:
          typeof editor_bounds.height === 'number'
            ? editor_bounds.height
            : (pattern as any).editorBounds?.height
      };
    }

    // -----------------------------------------
    // 4️⃣ MobX-триггер: чтобы Canvas и списки перерисовались
    // -----------------------------------------
    this.patterns = new Map(this.patterns);

    // -----------------------------------------
    // 5️⃣ Синхронизируем YAML-структуру
    // -----------------------------------------
    this.syncToGrammar();
    this.markAsModified();
  }


  // Внутри class GrammarStore
  private rebindComponentRefs(updatedPattern: AbstractPattern) {
    const targetName = updatedPattern.name;

    this.patterns.forEach((pattern) => {
      // 1) Area: inner / outer
      if (isAreaPattern(pattern)) {
        pattern.getAllInner().forEach(({ component }) => {
          if ((component as any).pattern?.name === targetName) {
            (component as any).pattern = updatedPattern;
          }
        });

        pattern.getAllOuter().forEach(({ component }) => {
          if ((component as any).pattern?.name === targetName) {
            (component as any).pattern = updatedPattern;
          }
        });
      }

      // 2) Array: inner / outer + item_pattern
      if (isArrayPattern(pattern)) {
        pattern.inner.forEach((component) => {
          if ((component as any).pattern?.name === targetName) {
            (component as any).pattern = updatedPattern;
          }
        });

        pattern.outer.forEach((component) => {
          if ((component as any).pattern?.name === targetName) {
            (component as any).pattern = updatedPattern;
          }
        });

        const item = pattern.getItemPattern();
        if (item && item.name === targetName) {
          pattern.setItemPattern(updatedPattern);
        }
      }
    });
  }

  // Внутри class GrammarStore
  private cleanupExtendsForNonCell(name: string) {
    const updated = this.patterns.get(name);
    if (!updated) return;

    // Если всё ещё cell — ничего не делаем
    if (isCellPattern(updated)) return;

    // Проходим по всем cell-паттернам и вычищаем extends
    this.patterns.forEach((pattern) => {
      if (!isCellPattern(pattern)) return;

      const currentExtends: string[] = (pattern as any).extends || [];
      if (!Array.isArray(currentExtends) || currentExtends.length === 0) return;

      const filtered = currentExtends.filter((parentName) => parentName !== name);
      if (filtered.length !== currentExtends.length) {
        (pattern as any).extends = filtered;
      }
    });
  }

  /**
   * Сгенерировать следующее свободное имя вида pattern_N,
   * начиная с текущего patternCounter и пропуская занятые.
   */
  private generatePatternName(): string {
    if (this.patternCounter < 1) {
      this.patternCounter = 1;
    }

    // ищем первый свободный pattern_N, начиная с patternCounter
    while (this.patterns.has(`pattern_${this.patternCounter}`)) {
      this.patternCounter++;
    }

    const name = `pattern_${this.patternCounter}`;
    this.patternCounter++; // чтобы в следующий раз начать с N+1

    return name;
  }



  /**
   * Удалить паттерн:
   * 1) чистим все ссылки на него
   * 2) удаляем сам паттерн
   */
  deletePattern(name: string) {
    // сначала убираем все ссылки
    this.cleanupReferencesToPattern(name);

    // потом удаляем сам паттерн
    this.deletePatternClass(name);
  }



  /**
   * Вырезать все ссылки на паттерн:
   * - из extends у cell
   * - из item_pattern у array
   * - из inner/outer у area/array
   */
  private cleanupReferencesToPattern(targetName: string) {
    this.patterns.forEach((pattern, ownerName) => {
      // ----- extends у cell -----
      if (isCellPattern(pattern)) {
        const exts: string[] = (pattern as any).extends || [];
        if (Array.isArray(exts) && exts.includes(targetName)) {
          const filtered = exts.filter((n) => n !== targetName);
          (pattern as any).extends = filtered;
        }
      }

      // ----- item_pattern у array -----
      if (isArrayPattern(pattern)) {
        const item = pattern.getItemPattern?.();
        if (item && item.name === targetName) {
          // очищаем ссылку
          (pattern as any).item_pattern = undefined;
        }
      }

      // ----- inner у area -----
      if (isAreaPattern(pattern)) {
        pattern.getAllInner().forEach(({ key, component }) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            // используем уже существующий метод store
            this.removeInnerElement(ownerName, key);
          }
        });

        pattern.getAllOuter().forEach(({ key, component }) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            this.removeOuterElement(ownerName, key);
          }
        });
      }

      // ----- inner/outer у array -----
      if (isArrayPattern(pattern)) {
        pattern.inner.forEach((component, key) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            this.removeInnerElement(ownerName, key);
          }
        });

        pattern.outer.forEach((component, key) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            this.removeOuterElement(ownerName, key);
          }
        });
      }
    });

    // после пачки правок — пересобираем Map и YAML
    this.patterns = new Map(this.patterns);
    this.syncToGrammar();
    this.markAsModified();
  }



  /**
   * Найти все использования паттерна по имени
   * (extends, item_pattern, inner, outer)
   */
  getPatternUsages(targetName: string): PatternUsages {
    const usages: PatternUsages = {
      inExtends: [],
      asArrayItem: [],
      asInner: [],
      asOuter: []
    };

    this.patterns.forEach((pattern) => {
      const ownerName = pattern.name;

      // ----- extends у cell -----
      if (isCellPattern(pattern)) {
        const exts: string[] = (pattern as any).extends || [];
        if (Array.isArray(exts) && exts.includes(targetName)) {
          usages.inExtends.push(ownerName);
        }
      }

      // ----- item_pattern у array -----
      if (isArrayPattern(pattern)) {
        const item = pattern.getItemPattern?.();
        if (item && item.name === targetName) {
          usages.asArrayItem.push(ownerName);
        }
      }

      // ----- inner / outer у area/array -----
      if (isAreaPattern(pattern)) {
        // AreaPattern: через getAllInner / getAllOuter
        pattern.getAllInner().forEach(({ key, component }) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            usages.asInner.push({ patternName: ownerName, key });
          }
        });

        pattern.getAllOuter().forEach(({ key, component }) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            usages.asOuter.push({ patternName: ownerName, key });
          }
        });
      } else if (isArrayPattern(pattern)) {
        // ArrayPattern: inner/outer — Map<string, ComponentPattern>
        pattern.inner.forEach((component, key) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            usages.asInner.push({ patternName: ownerName, key });
          }
        });

        pattern.outer.forEach((component, key) => {
          const ref = (component as any).pattern;
          if (ref && ref.name === targetName) {
            usages.asOuter.push({ patternName: ownerName, key });
          }
        });
      }
    });

    return usages;
  }

  /**
   * Есть ли вообще хоть какие-то использования
   */
  hasPatternUsages(targetName: string): boolean {
    const u = this.getPatternUsages(targetName);
    return (
      u.inExtends.length > 0 ||
      u.asArrayItem.length > 0 ||
      u.asInner.length > 0 ||
      u.asOuter.length > 0
    );
  }



  /**
   * Найти паттерн по имени и вернуть в "старом" YAML-подобном формате
   * (используется UI: список паттернов, граф, панель свойств, редактор и т.п.)
   */
  findPatternByName(name: string): Pattern | null {
    const pattern = this.patterns.get(name);
    return pattern ? pattern.toJSON() : null;
  }

  /**
   * Можем ли иметь inner/outer у указанного паттерна
   */
  canHaveInnerOuter(patternName: string): boolean {
    const pattern = this.patterns.get(patternName);
    return pattern ? !isCellPattern(pattern) : false;
  }

  /**
   * Добавить inner-элемент (через ComponentPattern) в Area/Array
   */
  addInnerElement(patternName: string, innerKey: string, innerPatternRef: string) {
    const pattern = this.patterns.get(patternName);
    const referenced = this.patterns.get(innerPatternRef);

    if (!pattern || !referenced || isCellPattern(pattern)) {
      console.warn(
        `Cannot add inner element to ${patternName}: pattern is cell or not found`
      );
      return;
    }

    const component = new ComponentPattern(referenced);

    if (isAreaPattern(pattern)) {
      // AreaPattern имеет метод addInner
      pattern.addInner(innerKey, component);
    } else if (isArrayPattern(pattern)) {
      // ArrayPattern — только Map inner
      pattern.inner.set(innerKey, component);
    } else {
      console.warn(
        `Pattern ${patternName} does not support inner elements in current implementation`
      );
      return;
    }

    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();
  }


  /**
   * Удалить inner-элемент
   */
  removeInnerElement(patternName: string, innerKey: string) {
    const pattern = this.patterns.get(patternName);
    if (!pattern || isCellPattern(pattern)) return;

    if (isAreaPattern(pattern)) {
      pattern.removeInner(innerKey);
    } else if (isArrayPattern(pattern)) {
      pattern.inner.delete(innerKey);
    } else {
      return;
    }

    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();
  }


  /**
   * Добавить outer-элемент (через ComponentPattern) в Area/Array
   */
  addOuterElement(patternName: string, outerKey: string, outerPatternRef: string) {
    const pattern = this.patterns.get(patternName);
    const referenced = this.patterns.get(outerPatternRef);

    if (!pattern || !referenced || isCellPattern(pattern)) {
      console.warn(
        `Cannot add outer element to ${patternName}: pattern is cell or not found`
      );
      return;
    }

    const component = new ComponentPattern(referenced);

    if (isAreaPattern(pattern)) {
      pattern.addOuter(outerKey, component);
    } else if (isArrayPattern(pattern)) {
      pattern.outer.set(outerKey, component);
    } else {
      console.warn(
        `Pattern ${patternName} does not support outer elements in current implementation`
      );
      return;
    }

    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();
  }


  /**
   * Удалить outer-элемент
   */
  removeOuterElement(patternName: string, outerKey: string) {
    const pattern = this.patterns.get(patternName);
    if (!pattern || isCellPattern(pattern)) return;

    if (isAreaPattern(pattern)) {
      pattern.removeOuter(outerKey);
    } else if (isArrayPattern(pattern)) {
      pattern.outer.delete(outerKey);
    } else {
      return;
    }

    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();
  }


  /**
   * Обновить location для inner-компонента
   */
  updateInnerLocation(patternName: string, innerKey: string, location: any) {
    const pattern = this.patterns.get(patternName);
    if (!pattern || isCellPattern(pattern)) return;

    let component: ComponentPattern | undefined;

    if (isAreaPattern(pattern)) {
      component = pattern.getInner(innerKey);
    } else if (isArrayPattern(pattern)) {
      component = pattern.inner.get(innerKey);
    }

    if (!component) return;

    component.location = location;

    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();
  }


  /**
   * Обновить location для outer-компонента
   */
  updateOuterLocation(patternName: string, outerKey: string, location: any) {
    const pattern = this.patterns.get(patternName);
    if (!pattern || isCellPattern(pattern)) return;

    let component: ComponentPattern | undefined;

    if (isAreaPattern(pattern)) {
      component = pattern.getOuter(outerKey);
    } else if (isArrayPattern(pattern)) {
      component = pattern.outer.get(outerKey);
    }

    if (!component) return;

    component.location = location;

    this.patterns = new Map(this.patterns);

    this.syncToGrammar();
    this.markAsModified();
  }

  /**
   * Применить snapshot (undo/redo)
   * ВАЖНО: при применении snapshot мы подавляем пуш в историю (suppressHistory),
   * чтобы не "стереть" стек future сразу после undo.
   */
  applySnapshot(snapshotGrammar: Grammar | null) {
    if (!snapshotGrammar) return;

    this.suppressHistory = true;
    try {
      // Загружаем модели напрямую (не вызываем loadGrammar чтобы не перезаписать history)
      this.patterns = PatternAdapter.loadGrammar(snapshotGrammar);

      this.grammar = PatternAdapter.saveGrammar(
        this.patterns,
        snapshotGrammar.cell_types_filepath,
        snapshotGrammar.metadata
      );

      // Обновляем счётчик имён
      const numbersFromNames = Array.from(this.patterns.keys())
        .filter((name) => name.startsWith('pattern_'))
        .map((name) => parseInt(name.replace('pattern_', ''), 10))
        .filter((n) => !Number.isNaN(n));

      this.patternCounter =
        numbersFromNames.length > 0 ? Math.max(...numbersFromNames) + 1 : 1;

      // Пометим редактор как изменённый (undo/redo — изменение)
      this.isModified = true;
      this.lastSaved = null;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('applySnapshot failed', e);
    } finally {
      // снимаем подавление истории — не пушим текущее состояние здесь
      this.suppressHistory = false;
    }
  }



  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  /**
   * Синхронизировать объектную модель с Grammar (используется импорт/экспорт/история)
   */
  private syncToGrammar(): void {
    if (!this.grammar) return;

    this.grammar = PatternAdapter.saveGrammar(
      this.patterns,
      this.grammar.cell_types_filepath,
      this.grammar.metadata
    );
  }

  private markAsModified() {
    this.isModified = true;
    if (this.grammar?.metadata) {
      this.grammar.metadata.updatedAt = new Date().toISOString();
    }

    // push history только если не подавлено (и grammar валидна)
    if (!this.suppressHistory && this.grammar) {
      try {
        historyStore.pushState(this.grammar, 'edit');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('history push failed in markAsModified', e);
      }
    }
  }

  // ========== ГЕТТЕРЫ ДЛЯ UI ==========

  /**
   * Все паттерны в "плоском" формате (используется списком, графом, панели свойств)
   */
  get allPatterns(): (Pattern & { name: string })[] {
    return Array.from(this.patterns.entries()).map(([name, pattern]) => ({
      name,
      ...(pattern.toJSON() as Pattern)
    }));
  }

  /**
   * Фильтрация по типу
   */
  getPatternsByKind(kind: 'cell' | 'area' | 'array') {
    return this.allPatterns.filter((p) => p.kind === kind);
  }

  /**
   * Обновление cell-паттерна (контент-тип и т.п.)
   */
  updateCellType(patternName: string, updates: Partial<Pattern>) {
    this.updatePattern(patternName, updates);
  }

  /**
   * Есть ли хоть один паттерн (можно использовать для дизейбла кнопки экспорта)
   */
  get hasPatterns(): boolean {
    return this.patterns.size > 0;
  }
}
