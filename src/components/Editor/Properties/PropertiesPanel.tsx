import React from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';
import { PatternProperties } from './PatternProperties';

export const PropertiesPanel: React.FC = observer(() => {
    const grammarStore = useGrammarStore();
    const editorStore = useEditorStore();

    const selectedId = editorStore.state.selectedElements[0];

    if (!selectedId) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="text-sm">Выберите элемент</p>
                    <p className="text-xs mt-1">для просмотра свойств</p>
                </div>
            </div>
        );
    }

    const pattern = grammarStore.findPatternByName(selectedId);

    if (!pattern) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="text-sm">Паттерн не найден</p>
                    <p className="text-xs mt-1">{selectedId}</p>
                </div>
            </div>
        );
    }

    const handleClose = () => {
        editorStore.deselectAll();
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 truncate">
                        {selectedId}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {pattern.kind === 'cell' && 'Ячейка (Cell)'}
                        {pattern.kind === 'area' && 'Область (Area)'}
                        {pattern.kind === 'array' && 'Массив (Array)'}
                        {pattern.kind === 'array-in-context' && 'Array in Context'}
                    </p>
                </div>
                <button
                    onClick={handleClose}
                    className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Закрыть"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <PatternProperties
                    patternName={selectedId}
                    pattern={pattern}
                />
            </div>
        </div>
    );
});