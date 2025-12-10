import React, { useState, useEffect, useRef } from 'react';
import { Layers } from 'lucide-react';

interface OverlappingElement {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface OverlapManagerProps {
  elements: OverlappingElement[];
  clickPosition: { x: number; y: number } | null;
  selectedId: string | null;
  onSelectElement: (id: string, enterFocusMode: boolean) => void;
  onClose: () => void;
  visible: boolean;
}

export const OverlapManager: React.FC<OverlapManagerProps> = ({
  elements,
  clickPosition,
  selectedId,
  onSelectElement,
  onClose,
  visible
}) => {
  const [overlappingGroup, setOverlappingGroup] = useState<OverlappingElement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ref на скролл-контейнер списка
  const listRef = useRef<HTMLDivElement | null>(null);
  // ref на текущую кнопку элемента
  const currentItemRef = useRef<HTMLButtonElement | null>(null);

  // Обновляем группу при изменении элементов / видимости
  useEffect(() => {
    if (visible && elements.length >= 2) {
      const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
      setOverlappingGroup(sorted);

      const selectedIndex = sorted.findIndex(el => el.id === selectedId);
      setCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setOverlappingGroup([]);
      setCurrentIndex(0);
    }
  }, [visible, elements, selectedId]);

  const selectCurrentAndClose = () => {
    if (!visible || overlappingGroup.length === 0) return;
    const element = overlappingGroup[currentIndex] ?? overlappingGroup[0];
    if (!element) return;

    onSelectElement(element.id, true);
    onClose();
  };

  // Когда меняется текущий индекс — докручиваем список до текущего элемента
  useEffect(() => {
    if (!visible) return;
    if (!currentItemRef.current) return;

    currentItemRef.current.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }, [currentIndex, visible]);

  // Колесо мыши: циклический выбор элементов (capture, чтобы быть выше зума)
  useEffect(() => {
    if (!visible || overlappingGroup.length === 0) return;

    const handleWheel = (e: WheelEvent) => {
      // Приоритет окна: колесо принадлежит OverlapManager
      e.preventDefault();
      e.stopPropagation();
      (e as any).stopImmediatePropagation?.();

      const delta = e.deltaY > 0 ? 1 : -1;
      const newIndex =
        (currentIndex + delta + overlappingGroup.length) % overlappingGroup.length;

      setCurrentIndex(newIndex);
      onSelectElement(overlappingGroup[newIndex].id, false);
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true } as any);
  }, [visible, overlappingGroup, currentIndex, onSelectElement]);

  // Клавиатура: Esc, стрелки, Enter, Space (capture, чтобы быть выше глобального Esc)
  useEffect(() => {
    if (!visible || overlappingGroup.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Высший приоритет – окно Overlap
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();

        const newIndex =
          (currentIndex + 1 + overlappingGroup.length) % overlappingGroup.length;
        setCurrentIndex(newIndex);
        onSelectElement(overlappingGroup[newIndex].id, false);
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();

        const newIndex =
          (currentIndex - 1 + overlappingGroup.length) % overlappingGroup.length;
        setCurrentIndex(newIndex);
        onSelectElement(overlappingGroup[newIndex].id, false);
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
        selectCurrentAndClose();
      }
    };

    // 👇 capture: true — наш обработчик отрабатывает до остальных на window
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
  }, [visible, overlappingGroup, currentIndex, onSelectElement, onClose]);

  if (!visible || overlappingGroup.length < 2) {
    return null;
  }

  // Компактное окно, чуть увеличил maxHeight, чтобы футер не подрезался
  return (
    <div
      id="overlap-manager-menu"
      className="absolute top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 min-w-[260px]"
      style={{ maxHeight: '380px' }}
    >
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} />
          <span className="font-semibold text-xs">
            Наложение элементов: {overlappingGroup.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded p-1 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      {/* Подсказка */}
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
        <p className="text-xs text-blue-800 font-medium">
          Esc — закрыть
        </p>
        <p className="text-xs text-blue-800 font-medium">
          Колёсико / стрелки — переключение
        </p>
        <p className="text-xs text-blue-800 font-medium">
          Enter / Space — выбрать
        </p>
      </div>

      {/* Список элементов */}
      <div ref={listRef} className="max-h-[220px] overflow-y-auto">
        {overlappingGroup.map((element, index) => {
          const isSelected = element.id === selectedId;
          const isCurrent = index === currentIndex;

          return (
            <button
              key={element.id}
              ref={isCurrent ? currentItemRef : null}
              onClick={() => {
                setCurrentIndex(index);
                selectCurrentAndClose();
              }}
              className={`
                w-full px-3 py-2 flex items-center gap-3 transition-all text-left
                ${
                  isSelected
                    ? 'bg-blue-100 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }
                ${isCurrent && !isSelected ? 'bg-purple-50 ring-1 ring-purple-300' : ''}
              `}
            >
              <div
                className={`
                  w-2.5 h-2.5 rounded-full flex-shrink-0
                  ${isSelected ? 'bg-blue-500 ring-2 ring-blue-200' : 'bg-gray-300'}
                `}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {element.name}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Слой {overlappingGroup.length - index} • {element.width}×{element.height}
                </div>
              </div>
              {isCurrent && !isSelected && (
                <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Текущий
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Футер */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={selectCurrentAndClose}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Выбрать
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium text-sm"
        >
          Отмена
        </button>
      </div>
    </div>
  );
};
