import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useGrammarStore } from '../../../hooks/useStores';
import { Save } from 'lucide-react';
import type { Pattern } from '../../../models/Pattern';

interface CellPropertiesProps {
    patternName: string;
    pattern: Pattern;
}

export const CellProperties: React.FC<CellPropertiesProps> = observer(({
                                                                           patternName,
                                                                           pattern
                                                                       }) => {
    const grammarStore = useGrammarStore();

    const [formData, setFormData] = useState({
        description: pattern.description || '',
        kind: pattern.kind,
        size: pattern.size || '',
        content_type: pattern.content_type || '',
        count_in_document: typeof pattern.count_in_document === 'object'
            ? JSON.stringify(pattern.count_in_document)
            : (pattern.count_in_document?.toString() || ''),
        root: pattern.root || false
    });

    // Обновляем форму при изменении паттерна
    useEffect(() => {
        setFormData({
            description: pattern.description || '',
            kind: pattern.kind,
            size: pattern.size || '',
            content_type: pattern.content_type || '',
            count_in_document: typeof pattern.count_in_document === 'object'
                ? JSON.stringify(pattern.count_in_document)
                : (pattern.count_in_document?.toString() || ''),
            root: pattern.root || false
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

        // Для cell паттернов
        if (formData.kind === 'cell') {
            updates.content_type = formData.content_type || undefined;
        }

        // Парсим count_in_document
        if (formData.count_in_document) {
            try {
                updates.count_in_document = JSON.parse(formData.count_in_document);
            } catch {
                updates.count_in_document = formData.count_in_document;
            }
        }

        grammarStore.updatePattern(patternName, updates);
        alert('✅ Изменения сохранены!');
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Свойства паттерна
            </h3>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание
                </label>
                <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={2}
                    placeholder="Введите описание паттерна"
                />
            </div>

            {/* Kind */}
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

            {/* Root */}
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

            {/* Size */}
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

            {/* Count in document */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Количество в документе
                </label>
                <input
                    type="text"
                    value={formData.count_in_document}
                    onChange={(e) => handleChange('count_in_document', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                    placeholder='1, "1+", "3..5"'
                />
                <p className="mt-1 text-xs text-gray-500">
                    Число, строка ("1+", "3..5") или JSON объект
                </p>
            </div>

            {/* Content Type (только для cell) */}
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

            {/* Save button */}
            <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
                <Save size={18} />
                <span>Сохранить изменения</span>
            </button>

            {/* Pattern Info */}
            <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Информация</h3>
                <div className="space-y-1 text-xs text-gray-600">
                    <p><strong>Имя:</strong> {patternName}</p>
                    <p><strong>Тип:</strong> {pattern.kind}</p>
                    {pattern.inner && (
                        <p><strong>Inner элементов:</strong> {Object.keys(pattern.inner).length}</p>
                    )}
                    {pattern.outer && (
                        <p><strong>Outer элементов:</strong> {Object.keys(pattern.outer).length}</p>
                    )}
                </div>
            </div>
        </div>
    );
});