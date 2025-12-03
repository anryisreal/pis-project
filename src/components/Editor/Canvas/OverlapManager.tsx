import React, { useState, useEffect } from 'react';
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

  // Обновляем группу при изменении элементов
  useEffect(() => {
    console.log('=== OverlapManager useEffect ===');
    console.log('visible:', visible);
    console.log('elements.length:', elements.length);

    if (visible && elements.length >= 2) {
      console.log('✅ Setting overlappingGroup from filtered elements');
      // Сортируем по z-index (сверху вниз)
      const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
      setOverlappingGroup(sorted);

      const selectedIndex = sorted.findIndex(el => el.id === selectedId);
      setCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      console.log('⚠️ Less than 2 elements or not visible');
      setOverlappingGroup([]);
    }
  }, [visible, elements, selectedId]);

  // ✅ Обработка ПРОСТОГО Scroll (без Ctrl) для переключения между элементами
  useEffect(() => {
    if (!visible || overlappingGroup.length === 0) return;

    const handleWheel = (e: WheelEvent) => {
      // Проверяем, что курсор над меню
      const target = e.target as HTMLElement;
      const menu = document.getElementById('overlap-manager-menu');
      if (menu && menu.contains(target)) {
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? 1 : -1;
        const newIndex = (currentIndex + delta + overlappingGroup.length) % overlappingGroup.length;

        setCurrentIndex(newIndex);
        onSelectElement(overlappingGroup[newIndex].id, false); // ✅ Не входим в режим фокуса при прокрутке
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [overlappingGroup, currentIndex, onSelectElement, visible]);

  console.log('=== OverlapManager render check ===');
  console.log('visible:', visible);
  console.log('overlappingGroup.length:', overlappingGroup.length);

  if (!visible || overlappingGroup.length < 2) {
    console.log('❌ NOT rendering menu');
    return null;
  }

  console.log('✅ RENDERING menu with', overlappingGroup.length, 'elements');

  return (
    <div
      id="overlap-manager-menu"
      className="absolute top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 min-w-[280px]"
      style={{ maxHeight: '400px' }}
    >
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={18} />
          <span className="font-semibold text-sm">
            Выберите элемент: {overlappingGroup.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded p-1 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Подсказка */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
        <p className="text-xs text-blue-800 font-medium">
          💡 Прокрутите колёсико мыши для переключения
        </p>
      </div>

      {/* Список элементов */}
      <div className="max-h-[280px] overflow-y-auto">
        {overlappingGroup.map((element, index) => {
          const isSelected = element.id === selectedId;
          const isCurrent = index === currentIndex;

          return (
            <button
              key={element.id}
              onClick={() => {
                setCurrentIndex(index);
                onSelectElement(element.id, false); // ✅ Не входим в режим фокуса при клике
              }}
              className={`
                w-full px-4 py-3 flex items-center gap-3 transition-all text-left
                ${isSelected
                ? 'bg-blue-100 border-l-4 border-blue-500'
                : 'hover:bg-gray-50 border-l-4 border-transparent'
              }
                ${isCurrent && !isSelected ? 'bg-purple-50 ring-2 ring-purple-300' : ''}
              `}
            >
              {/* Индикатор */}
              <div className={`
                w-3 h-3 rounded-full flex-shrink-0
                ${isSelected
                ? 'bg-blue-500 ring-2 ring-blue-200'
                : 'bg-gray-300'
              }
              `} />

              {/* Информация об элементе */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {element.name}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Слой {overlappingGroup.length - index} • {element.width}×{element.height}
                </div>
              </div>

              {/* Бадж "выбран" */}
              {isSelected && (
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  Выбран
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Футер с кнопкой подтверждения */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={() => {
            onSelectElement(overlappingGroup[currentIndex].id, true); // ✅ Входим в режим фокуса при подтверждении
            onClose();
          }}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Выбрать {overlappingGroup[currentIndex]?.name}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium text-sm"
        >
          Отмена
        </button>
      </div>
    </div>
  );
};