import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useGrammarStore } from '../../../hooks/useStores';
import type { Pattern, LocationObject } from '../../../models/Pattern';
import { Save, Plus, Trash2, AlertCircle } from 'lucide-react';

// ===== ВАЛИДАЦИЯ spacing / size / count_in_document =====
//
// Форматы:
//
// spacing (padding/margin):
//   n        — целое >= 0
//   n+       — >= n
//   n-       — <= n
//   n..m     — от n до m (оба >= 0, дополнительно проверяем, что n < m)
//   + промежуточные значения: "1", "1.", "1..", "1..2"
//
// size:
//   "<A> x <B>"
//   где A и B — как spacing, но:
//     * минимальное значение 1 (нет 0)
//     * нет вариантов с "-"
//     * нет ведущих нулей (01, 002 и т.п.)
//     * ровно один пробел до и после "x", без лишних пробелов в начале/конце
//
// count_in_document:
//   n        — целое >= 1
//   n+       — >= n
//   n..m     — от n до m (оба >= 1, n < m)
//   + промежуточные значения как у spacing
//   * без вариантов с "-"
//   * без ведущих нулей

// ---------- spacing (padding/margin) ----------

const SPACING_INTERMEDIATE_RE = /^(\d+([+-]?)?|\d+\.\.?|\d+\.\.\d*)$/;

export function isAllowedSpacingInput(raw: string): boolean {
  const value = raw;

  // Пустое или только пробелы — промежуточное состояние, разрешаем
  if (value.trim() === '') return true;

  // Любые пробелы внутри считаем недопустимыми
  if (/\s/.test(value)) return false;

  return SPACING_INTERMEDIATE_RE.test(value);
}

// Логическая ошибка диапазона n..m: m <= n + недописанные "n." / "n.."
export function hasLogicalRangeError(raw: string): boolean {
  const value = raw;
  if (value.trim() === '') return false;

  // "n." → считаем ошибкой
  if (/^\d+\.$/.test(value)) return true;

  // "n.." → тоже ошибка
  if (/^\d+\.\.$/.test(value)) return true;

  // Полный диапазон n..m
  const m = /^(\d+)\.\.(\d+)$/.exec(value);
  if (!m) return false;

  const from = parseInt(m[1], 10);
  const to = parseInt(m[2], 10);
  if (Number.isNaN(from) || Number.isNaN(to)) return false;

  return !(from < to);
}

// ---------- count_in_document ----------

// Промежуточные состояния для количества (минимум 1, без ведущих нулей, без "-")
const COUNT_INTERMEDIATE_RE =
  /^([1-9]\d*([+]?)?|[1-9]\d*\.\.?|[1-9]\d*\.\.[1-9]?\d*)$/;

export function isAllowedCountInput(raw: string): boolean {
  const value = raw;

  if (value.trim() === '') return true;

  // Любые пробелы запрещаем
  if (/\s/.test(value)) return false;

  return COUNT_INTERMEDIATE_RE.test(value);
}

export function hasLogicalCountRangeError(raw: string): boolean {
  const value = raw;
  if (value.trim() === '') return false;

  // n. / n.. — считаем ошибкой (как у spacing)
  if (/^[1-9]\d*\.$/.test(value)) return true;
  if (/^[1-9]\d*\.\.$/.test(value)) return true;

  const m = /^([1-9]\d*)\.\.([1-9]\d*)$/.exec(value);
  if (!m) return false;

  const from = parseInt(m[1], 10);
  const to = parseInt(m[2], 10);
  if (Number.isNaN(from) || Number.isNaN(to)) return false;

  return !(from < to);
}

// Полная (итоговая) валидация count_in_document — когда нажимаем "Сохранить"
export function isValidCount(raw: string): boolean {
  const value = raw.trim();
  if (value === '') return false;

  // Запрещаем любые пробелы
  if (/\s/.test(value)) return false;

  // n (целое >= 1, без ведущих нулей)
  if (/^[1-9]\d*$/.test(value)) return true;

  // n+  → >= n
  if (/^[1-9]\d*\+$/.test(value)) return true;

  // n..m → диапазон (оба >=1, m > n)
  const match = /^([1-9]\d*)\.\.([1-9]\d*)$/.exec(value);
  if (match) {
    const from = parseInt(match[1], 10);
    const to = parseInt(match[2], 10);
    return from < to;
  }

  return false;
}


// ---------- size "<A> x <B>" ----------

// Одна "осмысленная" часть размера (A или B) — ТОЛЬКО ПОЛНОЕ значение:
//   - целое >= 1, без ведущих нулей: 1, 2, 10
//   - или n+
//   - или диапазон n..m (оба >= 1, без ведущих нулей, n < m проверяем отдельно)
const SIZE_UNIT_FULL_RE = /([1-9]\d*(\+)?|[1-9]\d*\.\.[1-9]\d*)/;

// Полностью валидная строка размера: "<A> x <B>"
const SIZE_FULL_RE = new RegExp(
  `^${SIZE_UNIT_FULL_RE.source} x ${SIZE_UNIT_FULL_RE.source}$`
);

// Полная проверка Size (для сохранения)
export function isValidSize(raw: string): boolean {
  const value = raw;
  if (value.trim() === '') return false;

  // Строго "<A> x <B>" где A и B — ПОЛНЫЕ юниты
  if (!SIZE_FULL_RE.test(value)) return false;

  const [left, right] = value.split(' x ');

  const rangeRe = /^([1-9]\d*)\.\.([1-9]\d*)$/;

  const m1 = rangeRe.exec(left);
  if (m1) {
    const from = parseInt(m1[1], 10);
    const to = parseInt(m1[2], 10);
    if (!(from < to)) return false;
  }

  const m2 = rangeRe.exec(right);
  if (m2) {
    const from = parseInt(m2[1], 10);
    const to = parseInt(m2[2], 10);
    if (!(from < to)) return false;
  }

  return true;
}


export const SIZE_UNIT_INTERMEDIATE_RE =
  /([1-9]\d*(\+)?|[1-9]\d*\.\.?|[1-9]\d*\.\.[1-9]?\d*)/;

export function isAllowedSizeInput(raw: string): boolean {
  const value = raw;

  // Пустая строка — нормальное промежуточное состояние
  if (value === '') return true;

  // Запрещаем переводы строк и табы
  if (/[\r\n\t]/.test(value)) return false;

  // Разрешаем ТОЛЬКО такие формы:
  //
  // 1) "A"
  // 2) "A "
  // 3) "A x"
  // 4) "A x "
  // 5) "A x B"
  //
  // где A и B соответствуют SIZE_UNIT_INTERMEDIATE_RE
  const A = SIZE_UNIT_INTERMEDIATE_RE.source;

  const patterns = [
    new RegExp(`^${A}$`),             // "1", "1+", "1..", "1..2"
    new RegExp(`^${A} $`),            // "1 "
    new RegExp(`^${A} x$`),           // "1 x"
    new RegExp(`^${A} x $`),          // "1 x "
    new RegExp(`^${A} x ${A}$`),      // "1 x 1", "1 x 1..2", "1.. x 1..2"
  ];

  return patterns.some((re) => re.test(value));
}






function cleanupLocation(loc: LocationObject): LocationObject {
  const result: LocationObject = {};
  ([
    'top',
    'left',
    'right',
    'bottom',
    'width',
    'height',
    'padding-top',
    'padding-left',
    'padding-right',
    'padding-bottom',
    'margin-top',
    'margin-left',
    'margin-right',
    'margin-bottom'
  ] as (keyof LocationObject)[]).forEach((key) => {
    const v = loc[key];
    if (v !== undefined && v !== '') {
      result[key] = v;
    }
  });
  return result;
}


const PADDING_KEYS: (keyof LocationObject)[] = [
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left'
];

const MARGIN_KEYS: (keyof LocationObject)[] = [
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left'
];



// карта ошибок: [innerKey/outerKey] -> [fieldName] -> hasError
type SpacingErrorMap = Record<string, Record<string, boolean>>;

interface PatternPropertiesProps {
  patternName: string;
}

export const PatternProperties: React.FC<PatternPropertiesProps> = observer(
  ({ patternName }) => {
    const grammarStore = useGrammarStore();

    // Актуальный snapshot паттерна
    const pattern = grammarStore.findPatternByName(patternName);

    if (!pattern) {
      return (
        <div className="text-center text-gray-500 py-4">
          Паттерн не найден
        </div>
      );
    }

    const [formData, setFormData] = useState({
      description: pattern.description || '',
      kind: pattern.kind,
      size: pattern.size || '',
      content_type: pattern.content_type || '',
      direction: (pattern as any).direction || 'row',
      item_pattern: (pattern as any).item_pattern || '',
      item_count:
        typeof (pattern as any).item_count === 'object'
          ? JSON.stringify((pattern as any).item_count)
          : ((pattern as any).item_count?.toString() || ''),
      gap: (pattern as any).gap?.toString() || '',
      root: pattern.root || false,
      count_in_document:
        typeof pattern.count_in_document === 'object'
          ? JSON.stringify(pattern.count_in_document)
          : (pattern.count_in_document?.toString() || ''),
      extendsCells: Array.isArray(pattern.extends) ? pattern.extends : [],
      editorBoundsWidth: pattern.editor_bounds?.width?.toString() || '',
      editorBoundsHeight: pattern.editor_bounds?.height?.toString() || ''
    });

    const [newExtend, setNewExtend] = useState('');

    // Локальные драфты локаций inner/outer (вместо прямого обновления grammarStore)
    const [innerDraftPaddings, setInnerDraftPaddings] = useState<
      Record<string, LocationObject>
    >({});
    const [outerDraftMargins, setOuterDraftMargins] = useState<
      Record<string, LocationObject>
    >({});

    // Ошибки логики n..m (m <= n)
    const [innerSpacingErrors, setInnerSpacingErrors] =
      useState<SpacingErrorMap>({});
    const [outerSpacingErrors, setOuterSpacingErrors] =
      useState<SpacingErrorMap>({});

    // Инициализация формы + драфтов ОДИН РАЗ на смену patternName
    useEffect(() => {
      setFormData({
        description: pattern.description || '',
        kind: pattern.kind,
        size: pattern.size || '',
        content_type: pattern.content_type || '',
        direction: (pattern as any).direction || 'row',
        item_pattern: (pattern as any).item_pattern || '',
        item_count:
          typeof (pattern as any).item_count === 'object'
            ? JSON.stringify((pattern as any).item_count)
            : ((pattern as any).item_count?.toString() || ''),
        gap: (pattern as any).gap?.toString() || '',
        root: pattern.root || false,
        count_in_document:
          typeof pattern.count_in_document === 'object'
            ? JSON.stringify(pattern.count_in_document)
            : (pattern.count_in_document?.toString() || ''),
        extendsCells: Array.isArray(pattern.extends) ? pattern.extends : [],
        editorBoundsWidth: pattern.editor_bounds?.width?.toString() || '',
        editorBoundsHeight: pattern.editor_bounds?.height?.toString() || ''
      });

      const innerDraft: Record<string, LocationObject> = {};
      if (pattern.inner) {
        Object.entries(pattern.inner).forEach(([key, inner]: [string, any]) => {
          const loc =
            typeof inner.location === 'object' && !Array.isArray(inner.location)
              ? (inner.location as LocationObject)
              : ({} as LocationObject);
          innerDraft[key] = { ...loc };
        });
      }
      setInnerDraftPaddings(innerDraft);
      setInnerSpacingErrors({});

      const outerDraft: Record<string, LocationObject> = {};
      if (pattern.outer) {
        Object.entries(pattern.outer).forEach(([key, outer]: [string, any]) => {
          const loc =
            typeof outer.location === 'object' &&
            !Array.isArray(outer.location)
              ? (outer.location as LocationObject)
              : ({} as LocationObject);
          outerDraft[key] = { ...loc };
        });
      }
      setOuterDraftMargins(outerDraft);
      setOuterSpacingErrors({});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patternName]);

    const handleChange = (field: string, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value
      }));
    };

    const parseCountConstraint = (value: string) => {
      if (!value) return undefined;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };

    const canHaveInnerOuter = formData.kind === 'area';

    // Есть ли хоть одна логическая ошибка в spacing
    const hasSpacingErrors =
      Object.values(innerSpacingErrors).some((fields) =>
        Object.values(fields).some(Boolean)
      ) ||
      Object.values(outerSpacingErrors).some((fields) =>
        Object.values(fields).some(Boolean)
      );

      const sizeHasError =
      formData.size.trim() !== '' && !isValidSize(formData.size);

      const countHasError =
        formData.count_in_document.trim() !== '' &&
        !isValidCount(formData.count_in_document);

      // 🔹 item_count – те же правила, что и для "Количество в документе"
      const itemCountHasError =
        formData.kind === 'array' &&
        formData.item_count.trim() !== '' &&
        !isValidCount(formData.item_count);

      // 🔹 gap – те же правила, что и для margin/padding
      //   - isAllowedSpacingInput ограничивает то, что вообще можно набрать
      //   - hasLogicalRangeError ловит "1." / "1.." и диапазоны m..n где m >= n
      const gapHasError =
        formData.kind === 'array' &&
        formData.gap.trim() !== '' &&
        (!isAllowedSpacingInput(formData.gap) ||
          hasLogicalRangeError(formData.gap));

      // Общий флаг ошибок для блокировки сохранения
      const hasAnyErrors =
        hasSpacingErrors ||
        sizeHasError ||
        countHasError ||
        itemCountHasError ||
        gapHasError;


      const handleAddExtend = () => {
        if (!newExtend) return;

        setFormData((prev) => {
          if (prev.extendsCells.includes(newExtend)) {
            return prev; // уже есть, не дублируем
          }
          return {
            ...prev,
            extendsCells: [...prev.extendsCells, newExtend]
          };
        });

        setNewExtend('');
      };

      const handleRemoveExtend = (name: string) => {
        setFormData((prev) => ({
          ...prev,
          extendsCells: prev.extendsCells.filter((x) => x !== name)
        }));
      };



      const handleSave = () => {
        if (hasAnyErrors) return;

        const updates: Partial<Pattern> = {
          description: formData.description,
          kind: formData.kind as any,
          size: formData.size.length !== 0 ? formData.size : undefined,
          root: formData.root
        };

        if (formData.kind === 'cell') {
          (updates as any).content_type = formData.content_type || undefined;

          const uniqueExtends = Array.from(new Set(formData.extendsCells)).filter(
            (name) => name && name !== patternName
          );

          (updates as any).extends = uniqueExtends.length > 0 ? uniqueExtends : undefined;
        } else {
          // на всякий случай чистим extends для не-cell
          (updates as any).extends = undefined;
        }

        if (formData.kind === 'array') {
          (updates as any).direction = formData.direction as any;
          (updates as any).item_pattern = formData.item_pattern || undefined;
          (updates as any).item_count = formData.item_count
            ? parseCountConstraint(formData.item_count)
            : undefined;
          const gapTrimmed = formData.gap.trim();
          (updates as any).gap = gapTrimmed !== '' ? gapTrimmed : undefined;
        }

        // ===== Количество по умолчанию: минимум 1 =====
        if (!formData.count_in_document || formData.count_in_document.trim() === '') {
          updates.count_in_document = '1';
        } else {
          updates.count_in_document =
            parseCountConstraint(formData.count_in_document) ?? '1';
        }

        // 1) Обновляем сам паттерн
        grammarStore.updatePattern(patternName, updates);

        // 2) МЕРДЖИМ padding/margin с текущим location, чтобы НЕ потерять width/height/top/left
        // Сохраняем padding/margin, НЕ трогая width/height/top/left
      if (canHaveInnerOuter) {
        const freshPattern = grammarStore.findPatternByName(patternName);
        if (!freshPattern) return;

        // INNER
        if (freshPattern.inner) {
          Object.entries(freshPattern.inner).forEach(([key, inner]: [string, any]) => {
            const baseLoc: LocationObject =
              typeof inner.location === 'object' && !Array.isArray(inner.location)
                ? (inner.location as LocationObject)
                : ({} as LocationObject);

            const draftLoc = innerDraftPaddings[key] || ({} as LocationObject);

            const paddingPart: LocationObject = {};
            for (const k of PADDING_KEYS) {
              if (draftLoc[k] !== undefined) {
                paddingPart[k] = draftLoc[k];
              }
            }

            const mergedRaw: LocationObject = {
              ...baseLoc,   // тут актуальные width/height/top/left из CanvasStage
              ...paddingPart // только padding-*
            };

            const cleaned = cleanupLocation(mergedRaw);
            grammarStore.updateInnerLocation(patternName, key, cleaned);
          });
        }

        // OUTER
        if (freshPattern.outer) {
          Object.entries(freshPattern.outer).forEach(([key, outer]: [string, any]) => {
            const baseLoc: LocationObject =
              typeof outer.location === 'object' && !Array.isArray(outer.location)
                ? (outer.location as LocationObject)
                : ({} as LocationObject);

            const draftLoc = outerDraftMargins[key] || ({} as LocationObject);

            const marginPart: LocationObject = {};
            for (const k of MARGIN_KEYS) {
              if (draftLoc[k] !== undefined) {
                marginPart[k] = draftLoc[k];
              }
            }

            const mergedRaw: LocationObject = {
              ...baseLoc,   // опять же – размер/позиция из CanvasStage
              ...marginPart // только margin-*
            };

            const cleaned = cleanupLocation(mergedRaw);
            grammarStore.updateOuterLocation(patternName, key, cleaned);
          });
        }
      }

    };


    return (
      <div className="space-y-6">
        {/* Основные свойства */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
            Основные свойства
          </h3>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Введите описание паттерна"
            />
          </div>

          {/* Тип паттерна */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип паттерна
            </label>
            <select
              value={formData.kind}
              onChange={(e) => handleChange('kind', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="cell">Cell (ячейка)</option>
              <option value="area">Area (область)</option>
              <option value="array">Array (массив)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              ⚠️ При изменении типа компоненты будут очищены
            </p>
          </div>

          {formData.kind === 'cell' && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Cell паттерны не могут содержать inner или outer элементы
              </p>
            </div>
          )}

          {/* Root */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="root"
              checked={formData.root}
              onChange={(e) => handleChange('root', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="root" className="text-sm text-gray-700">
              Корневой паттерн (root)
            </label>
          </div>

          {/* Размер */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Размер
            </label>
            <input
              type="text"
              value={formData.size}
              onChange={(e) => {
                const val = e.target.value;
                // фильтруем ввод, но не трогаем курсор — сохраняем ровно то, что набрал пользователь
                if (!isAllowedSizeInput(val)) return;
                handleChange('size', val);
              }}
              className={
                'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono ' +
                (sizeHasError ? 'border-red-400 bg-red-50' : 'border-gray-300')
              }
              placeholder='Например: "2 x 3+", "1..2 x 3"'
            />
          </div>


          {/* Количество в документе */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Количество в документе
            </label>
            <input
              type="text"
              value={formData.count_in_document}
              onChange={(e) => {
                const val = e.target.value;
                if (!isAllowedCountInput(val)) return;
                handleChange('count_in_document', val);
              }}
              className={
                'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono ' +
                (countHasError ? 'border-red-400 bg-red-50' : 'border-gray-300')
              }
              placeholder='Например: "1", "3+", "1..5"'
            />
          </div>


          {/* Доп. поля для cell */}
          {formData.kind === 'cell' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип контента
              </label>
              <input
                type="text"
                value={formData.content_type}
                onChange={(e) =>
                  handleChange('content_type', e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                placeholder="teacher, room, discipline..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Ссылка на тип ячейки из cell_types.yml
              </p>
            </div>
          )}

          {/* Доп. поля для array */}
          {formData.kind === 'array' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direction
                </label>
                <select
                  value={formData.direction}
                  onChange={(e) => handleChange('direction', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="row">row</option>
                  <option value="column">column</option>
                  <option value="fill">fill</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Повторяющийся паттерн-элемент
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  value={formData.item_pattern || ''}
                  onChange={(e) =>
                    handleChange('item_pattern', e.target.value || '')
                  }
                >
                  <option value="">— не выбрано —</option>
                  {Array.from(grammarStore.patterns.values())
                    // не даём выбрать сам себя
                    .filter((p) => p.name !== patternName)
                    // если нужно ограничить типы, раскомментируй следующую строку:
                    // .filter((p) => p.kind === 'cell' || p.kind === 'area')
                    .map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.kind})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Выбери паттерн, который будет элементом массива.
                </p>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Количество элементов
                </label>
                <input
                  type="text"
                  value={formData.item_count}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Промежуточная валидация, как у "Количество в документе"
                    if (!isAllowedCountInput(val)) return;
                    handleChange('item_count', val);
                  }}
                  className={
                    'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono ' +
                    (itemCountHasError ? 'border-red-400 bg-red-50' : 'border-gray-300')
                  }
                  placeholder='Например: "3", "1+", "1..5"'
                />

              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Расстояние между элементами
                </label>
                <input
                  type="text"
                  value={formData.gap}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Тот же "живой" валидатор, что и для padding/margin
                    if (!isAllowedSpacingInput(val)) return;
                    handleChange('gap', val);
                  }}
                  className={
                    'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono ' +
                    (gapHasError ? 'border-red-400 bg-red-50' : 'border-gray-300')
                  }
                  placeholder='Например: "0", "10"'
                />
                <p className="mt-1 text-xs text-gray-500">
                  Расстояние между элементами массива (число)
                </p>
              </div>
            </>
          )}

          <button
            onClick={handleSave}
            disabled={hasAnyErrors}
            className={
              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded transition-colors ' +
              (hasAnyErrors
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700')
            }
          >
            <Save size={18} />
            <span>
              {hasAnyErrors
                ? 'Исправьте значения'
                : 'Сохранить изменения'}
            </span>
          </button>
        </div>

        {/* Наследование (extends) только для cell */}
        {formData.kind === 'cell' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Родительские ячейки (extends)
            </label>

            {/* текущий список родителей */}
            <div className="flex flex-wrap gap-2">
              {formData.extendsCells.length === 0 && (
                <span className="text-xs text-gray-400">
                  Родители не заданы
                </span>
              )}

              {formData.extendsCells.map((parentName) => (
                <span
                  key={parentName}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-xs text-blue-700 border border-blue-200"
                >
                  {parentName}
                  <button
                    type="button"
                    onClick={() => handleRemoveExtend(parentName)}
                    className="ml-1 text-[10px] leading-none hover:text-red-500"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            {/* Добавление нового родителя */}
            <div className="flex gap-2">
              <select
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                value={newExtend}
                onChange={(e) => setNewExtend(e.target.value)}
              >
                <option value="">Выберите cell-паттерн…</option>
                {grammarStore.allPatterns
                  .filter(
                    (p) =>
                      p.kind === 'cell' &&
                      p.name !== patternName &&
                      !formData.extendsCells.includes(p.name)
                  )
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={handleAddExtend}
                disabled={!newExtend}
                className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:bg-gray-300"
              >
                Добавить
              </button>
            </div>

            <p className="text-[11px] text-gray-400">
              Можно указать несколько родительских cell-паттернов.
              Один и тот же паттерн нельзя добавить дважды.
            </p>
          </div>
        )}

        {/* Inner / Outer для area */}
        {canHaveInnerOuter && (
          <InnerElementsSection
            patternName={patternName}
            pattern={pattern}
            draftPaddings={innerDraftPaddings}
            spacingErrors={innerSpacingErrors}
            onChangeDraft={(key, loc) => {
              setInnerDraftPaddings((prev) => ({
                ...prev,
                [key]: loc
              }));
            }}
            onChangeError={(key, field, hasError) => {
              setInnerSpacingErrors((prev) => {
                const prevForKey = prev[key] || {};
                return {
                  ...prev,
                  [key]: {
                    ...prevForKey,
                    [field]: hasError
                  }
                };
              });
            }}
          />
        )}

        {canHaveInnerOuter && (
          <OuterElementsSection
            patternName={patternName}
            pattern={pattern}
            draftMargins={outerDraftMargins}
            spacingErrors={outerSpacingErrors}
            onChangeDraft={(key, loc) => {
              setOuterDraftMargins((prev) => ({
                ...prev,
                [key]: loc
              }));
            }}
            onChangeError={(key, field, hasError) => {
              setOuterSpacingErrors((prev) => {
                const prevForKey = prev[key] || {};
                return {
                  ...prev,
                  [key]: {
                    ...prevForKey,
                    [field]: hasError
                  }
                };
              });
            }}
          />
        )}
      </div>
    );
  }
);

// ===== InnerElementsSection =====

interface InnerSectionProps {
  patternName: string;
  pattern: Pattern;
  draftPaddings: Record<string, LocationObject>;
  spacingErrors: SpacingErrorMap;
  onChangeDraft: (key: string, loc: LocationObject) => void;
  onChangeError: (key: string, field: string, hasError: boolean) => void;
}

const InnerElementsSection: React.FC<InnerSectionProps> = observer(
  ({
    patternName,
    pattern,
    draftPaddings,
    spacingErrors,
    onChangeDraft,
    onChangeError
  }) => {
    const grammarStore = useGrammarStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newInnerKey, setNewInnerKey] = useState('');
    const [newInnerRef, setNewInnerRef] = useState('');
    const [newInnerKeyError, setNewInnerKeyError] = useState<string | null>(null);

    const handleAdd = () => {
      const trimmedKey = newInnerKey.trim();

      // Проверяем непустое имя
      if (!trimmedKey) {
        setNewInnerKeyError('Имя компонента не может быть пустым');
        return;
      }

      // Проверяем уникальность только в пространстве имён inner текущего паттерна
      const existingInnerKeys = pattern.inner ? Object.keys(pattern.inner) : [];
      if (existingInnerKeys.includes(trimmedKey)) {
        setNewInnerKeyError('Компонент с таким именем уже существует');
        return;
      }

      // Должен быть выбран паттерн-ссылка
      if (!newInnerRef) {
        // Можно отдельную ошибку сделать, но пока просто не добавляем
        return;
      }

      setNewInnerKeyError(null);

      grammarStore.addInnerElement(patternName, trimmedKey, newInnerRef);
      setNewInnerKey('');
      setNewInnerRef('');
      setIsAdding(false);
    };

    const handleRemove = (key: string) => {
      if (confirm(`Удалить inner элемент "${key}"?`)) {
        grammarStore.removeInnerElement(patternName, key);
      }
    };

    const handlePaddingChange = (
      key: string,
      side: 'top' | 'right' | 'bottom' | 'left',
      value: string
    ) => {
      if (!isAllowedSpacingInput(value)) return;

      const normalized = value.trim();
      const fieldName = `padding-${side}`;

      const currentDraft = draftPaddings[key] || ({} as LocationObject);
      const newLocation: LocationObject = {
        ...currentDraft,
        [fieldName]: normalized
      } as LocationObject;

      onChangeDraft(key, newLocation);

      const logicalError =
        normalized !== '' && hasLogicalRangeError(normalized);
      onChangeError(key, fieldName, logicalError);
    };

    const availablePatterns = grammarStore.allPatterns
      .filter((p) => p.name !== patternName)
      .map((p) => p.name);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Inner элементы (внутри)
          </h3>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>

        {isAdding && (
          <div className="p-3 bg-gray-50 rounded space-y-2">
            <input
              type="text"
              value={newInnerKey}
              onChange={(e) => {
                setNewInnerKey(e.target.value);
                if (newInnerKeyError) setNewInnerKeyError(null);
              }}
              placeholder="Имя (например: title, cell)"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            {newInnerKeyError && (
              <p className="mt-1 text-xs text-red-500">{newInnerKeyError}</p>
            )}

            <select
              value={newInnerRef}
              onChange={(e) => setNewInnerRef(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">Выберите паттерн</option>
              {availablePatterns.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newInnerKey.trim() || !newInnerRef}
              className="
                w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm
                text-white bg-blue-600 hover:bg-blue-700 transition-colors
                disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed
              "
            >
              <Plus size={14} />
              <span>Добавить inner</span>
            </button>
          </div>
        )}

        {pattern.inner && Object.keys(pattern.inner).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(pattern.inner).map(([key, inner]: [string, any]) => {
              const draftLoc: LocationObject =
                draftPaddings[key] ||
                ((typeof inner.location === 'object' &&
                  !Array.isArray(inner.location)
                  ? inner.location
                  : {}) as LocationObject);

              const errorsForKey = spacingErrors[key] || {};

              const paddingTop = draftLoc['padding-top'] ?? '';
              const paddingBottom = draftLoc['padding-bottom'] ?? '';
              const paddingLeft = draftLoc['padding-left'] ?? '';
              const paddingRight = draftLoc['padding-right'] ?? '';

              return (
                <div
                  key={key}
                  className="border border-purple-200 rounded p-2 bg-purple-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <div className="text-xs font-semibold text-purple-800">
                        {key}
                      </div>
                      <div className="text-xs text-purple-600">
                        pattern:{' '}
                        {inner.pattern || inner.pattern_definition?.item_pattern}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(key)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Удалить inner элемент"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-gray-600">
                        padding-top
                      </label>
                      <input
                        type="text"
                        value={paddingTop}
                        placeholder="0"
                        onChange={(e) =>
                          handlePaddingChange(key, 'top', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['padding-top']
                            ? 'border-red-400 bg-red-50'
                            : 'border-purple-300')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        padding-bottom
                      </label>
                      <input
                        type="text"
                        value={paddingBottom}
                        placeholder="0"
                        onChange={(e) =>
                          handlePaddingChange(key, 'bottom', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['padding-bottom']
                            ? 'border-red-400 bg-red-50'
                            : 'border-purple-300')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        padding-left
                      </label>
                      <input
                        type="text"
                        value={paddingLeft}
                        placeholder="0"
                        onChange={(e) =>
                          handlePaddingChange(key, 'left', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['padding-left']
                            ? 'border-red-400 bg-red-50'
                            : 'border-purple-300')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        padding-right
                      </label>
                      <input
                        type="text"
                        value={paddingRight}
                        placeholder="0"
                        onChange={(e) =>
                          handlePaddingChange(key, 'right', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['padding-right']
                            ? 'border-red-400 bg-red-50'
                            : 'border-purple-300')
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Нет inner элементов</p>
        )}
      </div>
    );
  }
);

// ===== OuterElementsSection =====

interface OuterSectionProps {
  patternName: string;
  pattern: Pattern;
  draftMargins: Record<string, LocationObject>;
  spacingErrors: SpacingErrorMap;
  onChangeDraft: (key: string, loc: LocationObject) => void;
  onChangeError: (key: string, field: string, hasError: boolean) => void;
}

const OuterElementsSection: React.FC<OuterSectionProps> = observer(
  ({
    patternName,
    pattern,
    draftMargins,
    spacingErrors,
    onChangeDraft,
    onChangeError
  }) => {
    const grammarStore = useGrammarStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newOuterKey, setNewOuterKey] = useState('');
    const [newOuterRef, setNewOuterRef] = useState('');
    const [newOuterKeyError, setNewOuterKeyError] = useState<string | null>(null);

    const handleAdd = () => {
      
      const trimmedKey = newOuterKey.trim();

      if (!trimmedKey) {
        setNewOuterKeyError('Имя компонента не может быть пустым');
        return;
      }

      const existingOuterKeys = pattern.outer ? Object.keys(pattern.outer) : [];
      if (existingOuterKeys.includes(trimmedKey)) {
        setNewOuterKeyError('Компонент с таким именем уже существует');
        return;
      }

      if (!newOuterRef) {
        return;
      }

      setNewOuterKeyError(null);

      grammarStore.addOuterElement(patternName, trimmedKey, newOuterRef);
      setNewOuterKey('');
      setNewOuterRef('');
      setIsAdding(false);
    };

    const handleRemove = (key: string) => {
      if (confirm(`Удалить outer элемент "${key}"?`)) {
        grammarStore.removeOuterElement(patternName, key);
      }
    };

    const handleMarginChange = (
      key: string,
      side: 'top' | 'right' | 'bottom' | 'left',
      value: string
    ) => {
      if (!isAllowedSpacingInput(value)) return;

      const normalized = value.trim();
      const fieldName = `margin-${side}`;

      const currentDraft = draftMargins[key] || ({} as LocationObject);
      const newLocation: LocationObject = {
        ...currentDraft,
        [fieldName]: normalized
      } as LocationObject;

      onChangeDraft(key, newLocation);

      const logicalError =
        normalized !== '' && hasLogicalRangeError(normalized);
      onChangeError(key, fieldName, logicalError);
    };

    const availablePatterns = grammarStore.allPatterns
      .filter((p) => p.name !== patternName)
      .map((p) => p.name);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Outer элементы (снаружи)
          </h3>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>

        {isAdding && (
          <div className="p-3 bg-gray-50 rounded space-y-2">
            <input
              type="text"
              value={newOuterKey}
              onChange={(e) => {
                setNewOuterKey(e.target.value);
                if (newOuterKeyError) setNewOuterKeyError(null);
              }}
              placeholder="Имя (например: header, footer)"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            {newOuterKeyError && (
              <p className="mt-1 text-xs text-red-500">{newOuterKeyError}</p>
            )}
            <select
              value={newOuterRef}
              onChange={(e) => setNewOuterRef(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="">Выберите паттерн</option>
              {availablePatterns.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newOuterKey.trim() || !newOuterRef}
              className="
                w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm
                text-white bg-amber-500 hover:bg-amber-600 transition-colors
                disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed
              "
            >
              <Plus size={14} />
              <span>Добавить outer</span>
            </button>
          </div>
        )}

        {pattern.outer && Object.keys(pattern.outer).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(pattern.outer).map(([key, outer]: [string, any]) => {
              const draftLoc: LocationObject =
                draftMargins[key] ||
                ((typeof outer.location === 'object' &&
                  !Array.isArray(outer.location)
                  ? outer.location
                  : {}) as LocationObject);

              const errorsForKey = spacingErrors[key] || {};

              const marginTop = draftLoc['margin-top'] ?? '';
              const marginBottom = draftLoc['margin-bottom'] ?? '';
              const marginLeft = draftLoc['margin-left'] ?? '';
              const marginRight = draftLoc['margin-right'] ?? '';

              return (
                <div
                  key={key}
                  className="border border-amber-200 rounded p-2 bg-amber-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <div className="text-xs font-semibold text-amber-800">
                        {key}
                      </div>
                      <div className="text-xs text-amber-600">
                        pattern: {outer.pattern}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(key)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Удалить outer элемент"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-gray-600">
                        margin-top
                      </label>
                      <input
                        type="text"
                        value={marginTop}
                        placeholder="0"
                        onChange={(e) =>
                          handleMarginChange(key, 'top', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['margin-top']
                            ? 'border-red-400 bg-red-50'
                            : 'border-amber-300')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        margin-bottom
                      </label>
                      <input
                        type="text"
                        value={marginBottom}
                        placeholder="0"
                        onChange={(e) =>
                          handleMarginChange(key, 'bottom', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['margin-bottom']
                            ? 'border-red-400 bg-red-50'
                            : 'border-amber-300')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        margin-left
                      </label>
                      <input
                        type="text"
                        value={marginLeft}
                        placeholder="0"
                        onChange={(e) =>
                          handleMarginChange(key, 'left', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['margin-left']
                            ? 'border-red-400 bg-red-50'
                            : 'border-amber-300')
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">
                        margin-right
                      </label>
                      <input
                        type="text"
                        value={marginRight}
                        placeholder="0"
                        onChange={(e) =>
                          handleMarginChange(key, 'right', e.target.value)
                        }
                        className={
                          'w-full px-2 py-1 border rounded text-sm ' +
                          (errorsForKey['margin-right']
                            ? 'border-red-400 bg-red-50'
                            : 'border-amber-300')
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Нет outer элементов</p>
        )}
      </div>
    );
  }
);
