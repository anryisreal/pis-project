import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';
import { PatternProperties } from './PatternProperties';
import type { PatternUsages } from '../../../stores/GrammarStore';

export const PropertiesPanel: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const editorStore = useEditorStore();

  const selectedId = editorStore.state.selectedElements[0];

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteUsages, setDeleteUsages] = useState<PatternUsages | null>(null);

  const [patternNameValue, setPatternNameValue] = useState(selectedId);
  const [nameError, setNameError] = useState<string | null>(null);

  // при смене выбранного паттерна сбрасываем локальное имя и ошибку
  useEffect(() => {
    setPatternNameValue(selectedId);
    setNameError(null);
  }, [selectedId]);


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

    const validateName = (value: string): string | null => {
    const trimmed = value.trim();

    if (!trimmed) {
      return 'Имя паттерна не может быть пустым';
    }

    const exists = grammarStore.allPatterns.some(
      (p: any) => p.name === trimmed && p.name !== selectedId
    );
    if (exists) {
      return 'Паттерн с таким названием уже существует';
    }

    return null;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPatternNameValue(value);
    setNameError(validateName(value));
  };

  const commitNameChange = () => {
    const error = validateName(patternNameValue);
    setNameError(error);
    if (error) return;

    const trimmed = patternNameValue.trim();
    if (trimmed === selectedId) return;

    const ok = grammarStore.renamePattern(selectedId, trimmed);
    if (!ok) {
      setNameError('Не удалось переименовать паттерн');
      return;
    }

    // синхронизируем выбранный элемент в редакторе
    editorStore.renameElementId(selectedId, trimmed);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitNameChange();
    }
  };


  const handleClose = () => {
    editorStore.deselectAll();
  };

  const handleDelete = () => {
    const usages = grammarStore.getPatternUsages(selectedId);

    const hasUsages =
      usages.inExtends.length > 0 ||
      usages.asArrayItem.length > 0 ||
      usages.asInner.length > 0 ||
      usages.asOuter.length > 0;

    // нет зависимостей — простой confirm
    if (!hasUsages) {
      if (!window.confirm(`Удалить паттерн "${selectedId}"?`)) return;

      grammarStore.deletePattern(selectedId);
      editorStore.deselectAll();
      return;
    }

    // есть зависимости — открываем модалку
    setDeleteUsages(usages);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    grammarStore.deletePattern(selectedId);
    setIsDeleteDialogOpen(false);
    setDeleteUsages(null);
    editorStore.deselectAll();
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteUsages(null);
  };

  return (
    <>
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <input
              className={
                'w-full text-sm font-semibold border-b bg-transparent outline-none ' +
                (nameError
                  ? 'border-red-400 text-red-600'
                  : 'border-transparent text-gray-900 focus:border-blue-500')
              }
              value={patternNameValue}
              onChange={handleNameChange}
              onBlur={commitNameChange}
              onKeyDown={handleNameKeyDown}
              placeholder="Имя паттерна"
            />
            {nameError && (
              <p className="mt-0.5 text-[11px] text-red-500">
                {nameError}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {pattern.kind === 'cell' && 'Ячейка (Cell)'}
              {pattern.kind === 'area' && 'Область (Area)'}
              {pattern.kind === 'array' && 'Массив (Array)'}
            </p>
          </div>

          {/* 🔴 КРАСНАЯ КОРЗИНКА */}
          <button
            onClick={handleDelete}
            className="
              ml-2 p-1 rounded
              text-red-500
              hover:text-red-600
              transition-colors
            "
            title="Удалить паттерн"
          >
            <Trash2 size={18} strokeWidth={2.2} />
          </button>

          {/* Крестик закрытия */}
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
          {/* PatternProperties сейчас сам тянет паттерн по имени */}
          <PatternProperties patternName={selectedId} />
        </div>
      </div>

      {/* Модалка удаления с зависимостями */}
      {isDeleteDialogOpen && deleteUsages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Паттерн «{selectedId}» используется в других местах
                  </h2>
                  <p className="text-xs text-gray-500">
                    При удалении все ссылки на него будут автоматически очищены.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-64 overflow-auto space-y-3 text-xs">
              {deleteUsages.inExtends.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">
                    Как родитель (extends) в:
                  </div>
                  <ul className="list-disc list-inside text-gray-700">
                    {deleteUsages.inExtends.map((name) => (
                      <li key={`ext-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {deleteUsages.asArrayItem.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">
                    Как item_pattern в массивах:
                  </div>
                  <ul className="list-disc list-inside text-gray-700">
                    {deleteUsages.asArrayItem.map((name) => (
                      <li key={`arr-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {deleteUsages.asInner.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">
                    Как inner-элемент в:
                  </div>
                  <ul className="list-disc list-inside text-gray-700">
                    {deleteUsages.asInner.map(({ patternName, key }) => (
                      <li key={`inner-${patternName}-${key}`}>
                        {patternName} (ключ: {key})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {deleteUsages.asOuter.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">
                    Как outer-элемент в:
                  </div>
                  <ul className="list-disc list-inside text-gray-700">
                    {deleteUsages.asOuter.map(({ patternName, key }) => (
                      <li key={`outer-${patternName}-${key}`}>
                        {patternName} (ключ: {key})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 size={14} />
                <span>Удалить и очистить ссылки</span>
              </button>
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
