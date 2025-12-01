import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useGrammarStore } from '../../../hooks/useStores';
import type { Pattern, LocationObject } from '../../../models/Pattern';
import { Save, Plus, Trash2, AlertCircle } from 'lucide-react';

interface PatternPropertiesProps {
  patternName: string;
  pattern: Pattern;
}

export const PatternProperties: React.FC<PatternPropertiesProps> = observer(({
                                                                               patternName,
                                                                               pattern
                                                                             }) => {
  const grammarStore = useGrammarStore();

  const [formData, setFormData] = useState({
    description: pattern.description || '',
    kind: pattern.kind,
    size: pattern.size || '',
    content_type: pattern.content_type || '',
    direction: pattern.direction || 'row',
    item_pattern: pattern.item_pattern || '',
    item_count: typeof pattern.item_count === 'object'
      ? JSON.stringify(pattern.item_count)
      : (pattern.item_count?.toString() || ''),
    gap: pattern.gap?.toString() || '',
    root: pattern.root || false,
    count_in_document: typeof pattern.count_in_document === 'object'
      ? JSON.stringify(pattern.count_in_document)
      : (pattern.count_in_document?.toString() || '')
  });

  useEffect(() => {
    setFormData({
      description: pattern.description || '',
      kind: pattern.kind,
      size: pattern.size || '',
      content_type: pattern.content_type || '',
      direction: pattern.direction || 'row',
      item_pattern: pattern.item_pattern || '',
      item_count: typeof pattern.item_count === 'object'
        ? JSON.stringify(pattern.item_count)
        : (pattern.item_count?.toString() || ''),
      gap: pattern.gap?.toString() || '',
      root: pattern.root || false,
      count_in_document: typeof pattern.count_in_document === 'object'
        ? JSON.stringify(pattern.count_in_document)
        : (pattern.count_in_document?.toString() || '')
    });
  }, [pattern]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const updates: Partial<Pattern> = {
      description: formData.description,
      kind: formData.kind as any,
      size: formData.size || undefined,
      root: formData.root,
    };

    if (formData.kind === 'cell') {
      updates.content_type = formData.content_type || undefined;
    }

    if (formData.kind === 'array') {
      updates.direction = formData.direction as any;
      updates.item_pattern = formData.item_pattern || undefined;
      updates.item_count = formData.item_count ? parseCountConstraint(formData.item_count) : undefined;
      updates.gap = formData.gap || undefined;
    }

    if (formData.count_in_document) {
      updates.count_in_document = parseCountConstraint(formData.count_in_document);
    }

    grammarStore.updatePattern(patternName, updates);
  };

  const parseCountConstraint = (value: string) => {
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  // ✅ Проверка: Cell паттерны не имеют inner/outer
  const canHaveInnerOuter = formData.kind !== 'cell';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
          Основные свойства
        </h3>

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
            <option value="array-in-context">Array in Context</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            ⚠️ При изменении типа inner/outer элементы будут очищены
          </p>
        </div>

        {/* ✅ Предупреждение для Cell */}
        {formData.kind === 'cell' && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Cell паттерны не могут содержать inner или outer элементы
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="root"
            checked={formData.root}
            onChange={(e) => handleChange('root', e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="root" className="text-sm font-medium text-gray-700">
            Корневой паттерн (root)
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Размер (size)
          </label>
          <input
            type="text"
            value={formData.size}
            onChange={(e) => handleChange('size', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
            placeholder="8+ x 1, 1 x 2+, 5+ x 59+"
          />
          <p className="mt-1 text-xs text-gray-500">
            Формат: ширина x высота (например: 8+ x 1)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Количество в документе
          </label>
          <input
            type="text"
            value={formData.count_in_document}
            onChange={(e) => handleChange('count_in_document', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
            placeholder='1, "1+", {"min": 1, "max": 5}'
          />
          <p className="mt-1 text-xs text-gray-500">
            Число, строка ("1+", "3..5") или JSON объект
          </p>
        </div>

        {formData.kind === 'cell' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content Type
            </label>
            <input
              type="text"
              value={formData.content_type}
              onChange={(e) => handleChange('content_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
              placeholder="teacher, room, discipline..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Ссылка на тип ячейки из cell_types.yml
            </p>
          </div>
        )}

        {formData.kind === 'array' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Направление (direction)
              </label>
              <select
                value={formData.direction}
                onChange={(e) => handleChange('direction', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="row">Row (строка)</option>
                <option value="column">Column (столбец)</option>
                <option value="fill">Fill (заполнение)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Паттерн элемента (item_pattern)
              </label>
              <select
                value={formData.item_pattern}
                onChange={(e) => handleChange('item_pattern', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Не выбран</option>
                {grammarStore.allPatterns
                  .filter(p => p.name !== patternName)
                  .map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество элементов (item_count)
              </label>
              <input
                type="text"
                value={formData.item_count}
                onChange={(e) => handleChange('item_count', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                placeholder='5, "1+", {"min": 1, "max": 10}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Промежуток (gap)
              </label>
              <input
                type="text"
                value={formData.gap}
                onChange={(e) => handleChange('gap', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                placeholder="0, 1, '5-', '0+'"
              />
            </div>
          </>
        )}

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Save size={18} />
          <span>Сохранить изменения</span>
        </button>
      </div>

      {/* ✅ Inner элементы - только для area и array */}
      {canHaveInnerOuter && (
        <InnerElementsSection patternName={patternName} pattern={pattern} />
      )}

      {/* ✅ Outer элементы - только для area и array */}
      {canHaveInnerOuter && (
        <OuterElementsSection patternName={patternName} pattern={pattern} />
      )}
    </div>
  );
});

// Inner Elements Section - без изменений
const InnerElementsSection: React.FC<{ patternName: string; pattern: Pattern }> = observer(({
                                                                                              patternName,
                                                                                              pattern
                                                                                            }) => {
  const grammarStore = useGrammarStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newInnerKey, setNewInnerKey] = useState('');
  const [newInnerRef, setNewInnerRef] = useState('');

  const handleAdd = () => {
    if (newInnerKey && newInnerRef) {
      grammarStore.addInnerElement(patternName, newInnerKey, newInnerRef);
      setNewInnerKey('');
      setNewInnerRef('');
      setIsAdding(false);
    }
  };

  const handleRemove = (key: string) => {
    if (confirm(`Удалить inner элемент "${key}"?`)) {
      grammarStore.removeInnerElement(patternName, key);
    }
  };

  const handlePaddingChange = (key: string, side: string, value: string) => {
    const innerPattern = pattern.inner?.[key];
    if (!innerPattern) return;

    const currentLocation = (typeof innerPattern.location === 'object' && !Array.isArray(innerPattern.location))
      ? innerPattern.location as LocationObject
      : {} as LocationObject;

    const newLocation: LocationObject = {
      ...currentLocation,
      [`padding-${side}`]: value
    };

    grammarStore.updateInnerLocation(patternName, key, newLocation);
  };

  const availablePatterns = grammarStore.allPatterns
    .filter(p => p.name !== patternName)
    .map(p => p.name);

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
            onChange={(e) => setNewInnerKey(e.target.value)}
            placeholder="Имя (например: title, cell)"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <select
            value={newInnerRef}
            onChange={(e) => setNewInnerRef(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">Выберите паттерн...</option>
            {availablePatterns.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              Добавить
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {pattern.inner && Object.keys(pattern.inner).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(pattern.inner).map(([key, innerPattern]) => {
            const location = (typeof innerPattern.location === 'object' && !Array.isArray(innerPattern.location))
              ? innerPattern.location as LocationObject
              : {} as LocationObject;

            return (
              <div key={key} className="p-3 bg-purple-50 rounded border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-sm text-purple-900">{key}</span>
                    <span className="text-xs text-purple-600 ml-2">→ {innerPattern.pattern}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(key)}
                    className="text-red-600 hover:text-red-800"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-gray-600">padding-top</label>
                    <input
                      type="text"
                      value={location['padding-top'] || '0'}
                      onChange={(e) => handlePaddingChange(key, 'top', e.target.value)}
                      className="w-full px-2 py-1 border border-purple-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">padding-bottom</label>
                    <input
                      type="text"
                      value={location['padding-bottom'] || '0'}
                      onChange={(e) => handlePaddingChange(key, 'bottom', e.target.value)}
                      className="w-full px-2 py-1 border border-purple-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">padding-left</label>
                    <input
                      type="text"
                      value={location['padding-left'] || '0'}
                      onChange={(e) => handlePaddingChange(key, 'left', e.target.value)}
                      className="w-full px-2 py-1 border border-purple-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">padding-right</label>
                    <input
                      type="text"
                      value={location['padding-right'] || '0'}
                      onChange={(e) => handlePaddingChange(key, 'right', e.target.value)}
                      className="w-full px-2 py-1 border border-purple-300 rounded text-sm"
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
});

// Outer Elements Section - без изменений (аналогично)
const OuterElementsSection: React.FC<{ patternName: string; pattern: Pattern }> = observer(({
                                                                                              patternName,
                                                                                              pattern
                                                                                            }) => {
  const grammarStore = useGrammarStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newOuterKey, setNewOuterKey] = useState('');
  const [newOuterRef, setNewOuterRef] = useState('');

  const handleAdd = () => {
    if (newOuterKey && newOuterRef) {
      grammarStore.addOuterElement(patternName, newOuterKey, newOuterRef);
      setNewOuterKey('');
      setNewOuterRef('');
      setIsAdding(false);
    }
  };

  const handleRemove = (key: string) => {
    if (confirm(`Удалить outer элемент "${key}"?`)) {
      grammarStore.removeOuterElement(patternName, key);
    }
  };

  const handleMarginChange = (key: string, side: string, value: string) => {
    const outerPattern = pattern.outer?.[key];
    if (!outerPattern) return;

    const currentLocation = (typeof outerPattern.location === 'object' && !Array.isArray(outerPattern.location))
      ? outerPattern.location as LocationObject
      : {} as LocationObject;

    const newLocation: LocationObject = {
      ...currentLocation,
      [`margin-${side}`]: value
    };

    grammarStore.updateOuterLocation(patternName, key, newLocation);
  };

  const availablePatterns = grammarStore.allPatterns
    .filter(p => p.name !== patternName)
    .map(p => p.name);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          Outer элементы (контекст)
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-sm text-pink-600 hover:text-pink-700 flex items-center gap-1"
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
            onChange={(e) => setNewOuterKey(e.target.value)}
            placeholder="Имя (например: group, week_day)"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <select
            value={newOuterRef}
            onChange={(e) => setNewOuterRef(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option value="">Выберите паттерн...</option>
            {availablePatterns.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 px-3 py-1 bg-pink-600 text-white rounded text-sm"
            >
              Добавить
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {pattern.outer && Object.keys(pattern.outer).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(pattern.outer).map(([key, outerPattern]) => {
            const location = (typeof outerPattern.location === 'object' && !Array.isArray(outerPattern.location))
              ? outerPattern.location as LocationObject
              : {} as LocationObject;

            return (
              <div key={key} className="p-3 bg-pink-50 rounded border border-pink-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-sm text-pink-900">{key}</span>
                    <span className="text-xs text-pink-600 ml-2">→ {outerPattern.pattern}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(key)}
                    className="text-red-600 hover:text-red-800"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-gray-600">margin-top</label>
                    <input
                      type="text"
                      value={location['margin-top'] || '0'}
                      onChange={(e) => handleMarginChange(key, 'top', e.target.value)}
                      className="w-full px-2 py-1 border border-pink-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">margin-bottom</label>
                    <input
                      type="text"
                      value={location['margin-bottom'] || '0'}
                      onChange={(e) => handleMarginChange(key, 'bottom', e.target.value)}
                      className="w-full px-2 py-1 border border-pink-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">margin-left</label>
                    <input
                      type="text"
                      value={location['margin-left'] || '0'}
                      onChange={(e) => handleMarginChange(key, 'left', e.target.value)}
                      className="w-full px-2 py-1 border border-pink-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">margin-right</label>
                    <input
                      type="text"
                      value={location['margin-right'] || '0'}
                      onChange={(e) => handleMarginChange(key, 'right', e.target.value)}
                      className="w-full px-2 py-1 border border-pink-300 rounded text-sm"
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
});