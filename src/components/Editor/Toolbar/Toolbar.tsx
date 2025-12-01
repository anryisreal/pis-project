import React from 'react';
import { observer } from 'mobx-react-lite';
import { Plus, Save, RefreshCw } from 'lucide-react';
import { useGrammarStore } from '../../../hooks/useStores';
import { StorageService } from '../../../services/StorageService';
import { ImportButton } from './ImportButton';
import { ExportButton } from './ExportButton';

export const Toolbar: React.FC = observer(() => {
    const grammarStore = useGrammarStore();

    const handleAddPattern = (kind: 'cell' | 'area' | 'array') => {
        const name = grammarStore.addPattern(kind);
        if (name) {
            console.log('Created pattern:', name);
        }
    };

    const handleClearAll = () => {
        const confirmed = window.confirm(
            '⚠️ Вы уверены, что хотите начать с чистого листа?\n\nВсе несохраненные изменения будут потеряны!'
        );

        if (confirmed) {
            grammarStore.createNew();
            StorageService.clear();
            console.log('Grammar cleared and started fresh');
        }
    };

    const handleSave = () => {
        if (grammarStore.grammar) {
            StorageService.saveGrammar(grammarStore.grammar);
            grammarStore.isModified = false;
            alert('✅ Грамматика сохранена!');
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
                {/* Left side - Add buttons */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 mr-2">Добавить:</span>

                    <button
                        onClick={() => handleAddPattern('cell')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        title="Добавить Cell паттерн"
                    >
                        <Plus size={16} />
                        <span>Cell</span>
                    </button>

                    <button
                        onClick={() => handleAddPattern('area')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        title="Добавить Area паттерн"
                    >
                        <Plus size={16} />
                        <span>Area</span>
                    </button>

                    <button
                        onClick={() => handleAddPattern('array')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                        title="Добавить Array паттерн"
                    >
                        <Plus size={16} />
                        <span>Array</span>
                    </button>

                    <div className="w-px h-6 bg-gray-300 mx-2" />

                    {/* Clear button */}
                    <button
                        onClick={handleClearAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        title="Начать с чистого листа"
                    >
                        <RefreshCw size={16} />
                        <span>Очистить все</span>
                    </button>
                </div>

                {/* Right side - File operations */}
                <div className="flex items-center gap-2">
                    {/* Status indicator */}
                    {grammarStore.isModified && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            Несохраненные изменения
                        </span>
                    )}

                    <ImportButton />
                    <ExportButton />

                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        title="Сохранить"
                    >
                        <Save size={16} />
                        <span>Сохранить</span>
                    </button>
                </div>
            </div>
        </div>
    );
});