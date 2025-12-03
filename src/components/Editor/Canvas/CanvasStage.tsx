import React, { useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ZoomIn, ZoomOut, Maximize2, Focus, X } from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';
import { ElementShape } from './ElementShape';
import { PatternVisualization } from './PatternVisualisation';
import { OverlapManager } from './OverlapManager';
import type { Pattern } from '../../../models/Pattern';

const CELL_SIZE = 20;
const BASE_CELL_WIDTH = 150;
const BASE_CELL_HEIGHT = 80;

// Функция для парсинга size (например: "8+ x 1", "5+ x 59+")
const parseSize = (sizeStr: string | undefined): { width: number; height: number } | null => {
  if (!sizeStr) return null;

  const parts = sizeStr.toLowerCase().split('x').map(s => s.trim());
  if (parts.length !== 2) return null;

  const parseValue = (val: string): number => {
    const num = parseInt(val.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const width = parseValue(parts[0]);
  const height = parseValue(parts[1]);

  if (width === 0 || height === 0) return null;

  return {
    width: width * CELL_SIZE,
    height: height * CELL_SIZE
  };
};

export const CanvasStage: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const editorStore = useEditorStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [elementPositions, setElementPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  // ✅ Фиксированная граница при входе в режим фокуса
  const [fixedBoundingBox, setFixedBoundingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // ✅ NEW: Позиция клика для детектирования перекрытий
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [showOverlapMenu, setShowOverlapMenu] = useState(false);
  const [overlappingElements, setOverlappingElements] = useState<string[]>([]);

  // ✅ Используем activeInnerElement из EditorStore вместо локального state
  const activeInnerElement = editorStore.state.activeInnerElement;



  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | SVGElement;
    const isElementShape = target.closest('.element-shape');

    // ✅ В режиме фокуса НЕ выходим при клике на canvas
    if (e.button === 0 && !isElementShape && !editorStore.state.isFocusMode) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      editorStore.deselectAll();
    } else if (e.button === 0 && !isElementShape && editorStore.state.isFocusMode) {
      // В режиме фокуса позволяем панорамирование
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.1));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleUpdateLocation = (
    patternName: string,
    type: 'inner' | 'outer',
    key: string,
    location: any
  ) => {
    if (type === 'inner') {
      grammarStore.updateInnerLocation(patternName, key, location);
    } else {
      grammarStore.updateOuterLocation(patternName, key, location);
    }
  };

  // ✅ Обработчик изменения границы
  const handleUpdateBoundingBox = (newBbox: { x: number; y: number; width: number; height: number }) => {
    setFixedBoundingBox(newBbox);
  };
  const handleElementPositionChange = (id: string, x: number, y: number) => {
    if (!selectedElement || !isFocusMode || !fixedBoundingBox) {
      // Вне режима фокуса - свободное перемещение
      setElementPositions(prev => {
        const newMap = new Map(prev);
        newMap.set(id, { x, y });
        return newMap;
      });
      return;
    }

    // В режиме фокуса - проверяем границы для inner элементов
    const element = visualElements.find(el => el.id === id);
    if (!element) return;

    // ✅ Проверяем, является ли элемент inner (учитываем pattern и pattern_definition)
    const isInnerElement = relatedElementIds.has(id);

    if (isInnerElement) {
      // ✅ Используем fixedBoundingBox (черная граница) для ограничения
      const bbox = fixedBoundingBox;

      // Ограничиваем координаты границами bbox
      const constrainedX = Math.max(bbox.x, Math.min(x, bbox.x + bbox.width - element.width));
      const constrainedY = Math.max(bbox.y, Math.min(y, bbox.y + bbox.height - element.height));

      setElementPositions(prev => {
        const newMap = new Map(prev);
        newMap.set(id, { x: constrainedX, y: constrainedY });
        return newMap;
      });
    } else {
      // Outer элементы - свободное перемещение
      setElementPositions(prev => {
        const newMap = new Map(prev);
        newMap.set(id, { x, y });
        return newMap;
      });
    }
  };

  // ✅ NEW: Обработка клика на элемент с проверкой перекрытий
  const handleElementClick = (clickedId: string) => {
    console.log('=== handleElementClick CALLED ===');
    console.log('clickedId:', clickedId);
    console.log('isFocusMode:', isFocusMode);

    // Находим кликнутый элемент
    const clickedElement = visualElements.find(el => el.id === clickedId);
    console.log('clickedElement:', clickedElement);

    if (!clickedElement) {
      console.log('❌ clickedElement not found');
      return;
    }

    // ✅ ИСПРАВЛЕНИЕ: В режиме фокуса вычисляем relatedElementIds
    let elementsToCheck = visualElements;

    if (isFocusMode) {
      const currentSelectedId = editorStore.state.selectedElements[0];
      const currentSelectedElement = visualElements.find(el => el.id === currentSelectedId);

      if (currentSelectedElement && currentSelectedElement.pattern.kind !== 'cell') {
        const relatedIds = new Set<string>();

        // Собираем inner элементы
        if (currentSelectedElement.pattern.inner) {
          Object.values(currentSelectedElement.pattern.inner).forEach((inner: any) => {
            if (inner.pattern) {
              relatedIds.add(inner.pattern);
            }
          });
        }

        // Собираем outer элементы
        if (currentSelectedElement.pattern.outer) {
          Object.values(currentSelectedElement.pattern.outer).forEach((outer: any) => {
            if (outer.pattern) {
              relatedIds.add(outer.pattern);
            }
          });
        }

        console.log('relatedIds in focus mode:', Array.from(relatedIds));
        elementsToCheck = visualElements.filter(el => relatedIds.has(el.id));
      }
    }

    console.log('elementsToCheck.length:', elementsToCheck.length);

    // ✅ Находим ВСЕ элементы, которые перекрываются с кликнутым
    const overlapping = elementsToCheck.filter(el => {
      // Проверяем, перекрывается ли элемент с кликнутым
      const isOverlapping = !(
        el.x + el.width < clickedElement.x ||  // el полностью слева
        el.x > clickedElement.x + clickedElement.width ||  // el полностью справа
        el.y + el.height < clickedElement.y ||  // el полностью сверху
        el.y > clickedElement.y + clickedElement.height  // el полностью снизу
      );

      return isOverlapping;
    });

    console.log('overlapping.length:', overlapping.length);
    console.log('overlapping:', overlapping.map(el => el.id));

    if (overlapping.length > 1) {
      console.log('✅ Multiple overlaps - showing menu');

      const centerX = clickedElement.x + clickedElement.width / 2;
      const centerY = clickedElement.y + clickedElement.height / 2;

      console.log('Setting clickPosition:', { x: centerX, y: centerY });

      // ✅ Передаём список перекрывающихся элементов
      setClickPosition({ x: centerX, y: centerY });
      setOverlappingElements(overlapping.map(el => el.id));
      setShowOverlapMenu(true);
    } else {
      console.log('⚠️ No overlaps');

      // ✅ ИСПРАВЛЕНИЕ: В режиме фокуса делаем элемент активным для перетаскивания
      if (isFocusMode) {
        console.log('✅ Setting active inner element:', clickedId);
        editorStore.setActiveInnerElement(clickedId);
      } else {
        console.log('✅ Selecting element (not in focus mode)');
        editorStore.selectElement(clickedId);
      }

      setShowOverlapMenu(false);
      setOverlappingElements([]);
    }

    console.log('=== handleElementClick END ===');
  };


  const calculateBoundingBox = (pattern: Pattern, mainElement: any) => {
    if (!mainElement) return { x: 0, y: 0, width: 0, height: 0 };

    let minX = mainElement.x;
    let minY = mainElement.y;
    let maxX = mainElement.x + mainElement.width;
    let maxY = mainElement.y + mainElement.height;

    // ✅ Расширяем bbox чтобы включить все inner элементы (для отображения границы)
    if (pattern.inner) {
      Object.values(pattern.inner).forEach((innerDef: any) => {
        const innerPatternName = innerDef.pattern || innerDef.pattern_definition?.item_pattern;
        if (!innerPatternName) return;

        const innerElement = visualElements.find(el => el.name === innerPatternName);
        if (!innerElement) return;

        minX = Math.min(minX, innerElement.x);
        minY = Math.min(minY, innerElement.y);
        maxX = Math.max(maxX, innerElement.x + innerElement.width);
        maxY = Math.max(maxY, innerElement.y + innerElement.height);
      });
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  const handleCenterSelected = () => {
    if (!selectedElement) return;

    const bbox = calculateBoundingBox(selectedElement.pattern, selectedElement);

    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();

    const bboxCenterX = bbox.x + bbox.width / 2;
    const bboxCenterY = bbox.y + bbox.height / 2;

    const viewCenterX = svgRect.width / 2 / zoom;
    const viewCenterY = svgRect.height / 2 / zoom;

    setPan({
      x: (viewCenterX - bboxCenterX) * zoom,
      y: (viewCenterY - bboxCenterY) * zoom
    });
  };

  // Вычисляем размеры и позиции всех элементов
  const visualElements = grammarStore.allPatterns.map((element, index) => {
    const savedPosition = elementPositions.get(element.name);
    const defaultX = 100 + (index % 3) * 400;
    const defaultY = 100 + Math.floor(index / 3) * 300;

    // ✅ Применяем size из паттерна
    const parsedSize = parseSize(element.size);
    let width = parsedSize?.width || BASE_CELL_WIDTH;
    let height = parsedSize?.height || BASE_CELL_HEIGHT;

    // Дополнительная логика для разных типов
    if (!parsedSize) {
      if (element.kind === 'array') {
        width = 250;
        height = 140;
      } else if (element.kind === 'area') {
        width = 200;
        height = 120;
      }
    }

    return {
      id: element.name,
      name: element.name,
      kind: element.kind || 'area',
      pattern: element,
      x: savedPosition?.x ?? defaultX,
      y: savedPosition?.y ?? defaultY,
      width,
      height
    };
  });

  const selectedId = editorStore.state.selectedElements[0];
  const selectedElement = visualElements.find(el => el.id === selectedId);
  const isFocusMode = editorStore.state.isFocusMode;

  console.log('=== CanvasStage state ===');
  console.log('selectedId:', selectedId);
  console.log('isFocusMode:', isFocusMode);
  console.log('selectedElements:', editorStore.state.selectedElements);

  // ✅ Собираем ID всех inner/outer элементов выбранного паттерна
  const relatedElementIds = new Set<string>();
  const innerOuterKeyMap = new Map<string, string>(); // patternName -> key name

  if (selectedElement) {
    console.log('selectedElement.pattern:', selectedElement.pattern);
    console.log('selectedElement.pattern.kind:', selectedElement.pattern.kind);
    console.log('selectedElement.pattern.inner:', selectedElement.pattern.inner);

    // ✅ Проверяем, может ли паттерн иметь inner/outer (не cell)
    const canHaveInnerOuter = selectedElement.pattern.kind !== 'cell';
    console.log('canHaveInnerOuter:', canHaveInnerOuter);

    if (canHaveInnerOuter) {
      if (selectedElement.pattern.inner) {
        Object.entries(selectedElement.pattern.inner).forEach(([key, inner]) => {
          console.log('  inner key:', key, 'inner:', inner);
          if (inner.pattern) {
            relatedElementIds.add(inner.pattern);
            innerOuterKeyMap.set(inner.pattern, key);
          } else if (inner.pattern_definition) {
            console.log('  ⚠️ inner has pattern_definition');
            // ✅ Обрабатываем pattern_definition (для array)
            if (inner.pattern_definition.item_pattern) {
              console.log('  ✅ Adding item_pattern:', inner.pattern_definition.item_pattern);
              relatedElementIds.add(inner.pattern_definition.item_pattern);
              innerOuterKeyMap.set(inner.pattern_definition.item_pattern, key);
            }
            // Также можем добавить сам pattern_definition если у него есть kind: 'cell'
            if (inner.pattern_definition.kind === 'cell') {
              // Это inline определение, не добавляем
            }
          }
        });
      }

      if (selectedElement.pattern.outer) {
        Object.entries(selectedElement.pattern.outer).forEach(([key, outer]) => {
          console.log('  outer key:', key, 'outer:', outer);
          if (outer.pattern) {
            relatedElementIds.add(outer.pattern);
            innerOuterKeyMap.set(outer.pattern, key);
          }
        });
      }
    }
  }

  console.log('relatedElementIds:', Array.from(relatedElementIds));
  console.log('relatedElementIds.size:', relatedElementIds.size);

  // ✅ При входе/выходе из режима фокуса фиксируем/сбрасываем границу
  useEffect(() => {
    if (isFocusMode && selectedElement && relatedElementIds.size > 0) {
      // Фиксируем bbox при входе
      const bbox = calculateBoundingBox(selectedElement.pattern, selectedElement);
      setFixedBoundingBox(bbox);
      // ✅ Сбрасываем активный inner элемент при входе
      editorStore.setActiveInnerElement(null);
    } else {
      // Сбрасываем при выходе
      setFixedBoundingBox(null);
      // ✅ Сбрасываем активный inner элемент при выходе
      editorStore.setActiveInnerElement(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocusMode, selectedId]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      {/* ✅ OverlapManager для выбора перекрывающихся элементов */}
      <OverlapManager
        elements={visualElements
          .filter(el => overlappingElements.includes(el.id))
          .map((el, index) => ({
            id: el.id,
            name: innerOuterKeyMap.get(el.id) || el.name,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            zIndex: index
          }))}
        clickPosition={clickPosition}
        selectedId={isFocusMode ? activeInnerElement : (selectedId || null)}
        onSelectElement={(id, enterFocusMode) => {
          console.log('=== onSelectElement CALLED ===');
          console.log('id:', id);
          console.log('enterFocusMode:', enterFocusMode);
          console.log('isFocusMode:', isFocusMode);

          if (isFocusMode) {
            // ✅ В режиме фокуса: просто делаем элемент активным для перетаскивания
            console.log('✅ Setting activeInnerElement:', id);
            editorStore.setActiveInnerElement(id);
            setShowOverlapMenu(false);
            setClickPosition(null);
          } else if (enterFocusMode) {
            // Обычный выбор с входом в режим фокуса
            console.log('✅ Selecting element with focus mode');
            editorStore.selectElement(id);
          } else {
            // Выбор без входа в режим фокуса (при прокрутке в меню)
            console.log('✅ Selecting element without focus mode');
            editorStore.selectElement(id, false, true);
          }
        }}
        onClose={() => {
          setShowOverlapMenu(false);
          setClickPosition(null);
        }}
        visible={showOverlapMenu}
      />

      {/* ✅ Синий баннер в режиме фокуса */}
      {isFocusMode && selectedElement && relatedElementIds.size > 0 && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-blue-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="font-semibold">Режим редактирования:</span>
              <span className="font-mono bg-blue-700 px-3 py-1 rounded">
                {selectedElement.name}
              </span>
            </div>
            <button
              onClick={() => editorStore.exitFocusMode()}
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-blue-600 rounded hover:bg-blue-50 transition-colors font-medium"
            >
              <X size={18} />
              <span>Выйти (ESC)</span>
            </button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className={`absolute ${isFocusMode ? 'top-20' : 'top-4'} right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2 transition-all`}>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded"
          title="Уменьшить"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded"
          title="Увеличить"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 rounded"
          title="Сбросить вид"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        {selectedElement && (
          <button
            onClick={handleCenterSelected}
            className="p-2 hover:bg-gray-100 rounded border-l ml-2 pl-2"
            title="Центрировать выбранный элемент"
          >
            <Focus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Legend */}
      {selectedElement && !isFocusMode && (
        <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-md p-4 max-w-xs">
          <div className="text-sm font-semibold mb-2">Визуализация:</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black"></div>
              <span>Граница паттерна</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-pink-500 bg-pink-100"></div>
              <span>Margin (outer)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-purple-600 bg-purple-100"></div>
              <span>Padding (inner)</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Кликните для входа в режим редактирования
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Сетка */}
          <defs>
            <pattern
              id="grid"
              width={CELL_SIZE}
              height={CELL_SIZE}
              patternUnits="userSpaceOnUse"
            >
              <rect width={CELL_SIZE} height={CELL_SIZE} fill="none" />
              <path
                d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)" />

          {/* ✅ Рендерим элементы */}
          {visualElements
            // ✅ Выбранный/активный элемент рисуем последним (сверху)
            .sort((a, b) => {
              // В режиме фокуса: активный inner элемент сверху
              if (isFocusMode && activeInnerElement) {
                if (a.id === activeInnerElement) return 1;
                if (b.id === activeInnerElement) return -1;
              }
              // Вне режима фокуса: выбранный элемент сверху
              if (!isFocusMode && selectedId) {
                if (a.id === selectedId) return 1;
                if (b.id === selectedId) return -1;
              }
              return 0;
            })
            .map(element => {
              // В режиме фокуса:
              // - Главный выбранный паттерн СКРЫТ (только если есть inner элементы для показа)
              // - Показываем только inner/outer элементы
              // - Все остальные элементы СКРЫТЫ
              const isMainElement = isFocusMode && element.id === selectedId;

              if (isFocusMode) {
                // ✅ ИСПРАВЛЕНИЕ: Если нет inner элементов для показа - показываем главный
                if (relatedElementIds.size === 0) {
                  // Нет inner элементов - показываем главный как обычный элемент
                  // НЕ скрываем другие элементы
                } else {
                  // Есть inner элементы
                  // ✅ Скрываем главный элемент
                  if (isMainElement) {
                    return null;
                  }
                  // Скрываем не связанные элементы (не inner/outer)
                  if (!relatedElementIds.has(element.id)) {
                    return null;
                  }
                }
              }

              // Определяем isSelected:
              // - В режиме фокуса: только активный inner элемент выбран (или главный если нет inner)
              // - Вне режима фокуса: элемент в selectedElements
              const isElementSelected = isFocusMode
                ? (relatedElementIds.size === 0 ? isMainElement : element.id === activeInnerElement)
                : editorStore.state.selectedElements.includes(element.id);

              return (
                <g key={element.id}>
                  <ElementShape
                    element={element}
                    isSelected={isElementSelected}
                    isHovered={editorStore.state.hoveredElement === element.id}
                    onSelect={() => handleElementClick(element.id)}
                    onMakeActive={() => {
                      // Прямая активация БЕЗ проверки перекрытий
                      if (isFocusMode) {
                        editorStore.setActiveInnerElement(element.id);
                      }
                    }}
                    onHover={() => editorStore.setHoveredElement(element.id)}
                    onHoverEnd={() => editorStore.setHoveredElement(null)}
                    onPositionChange={handleElementPositionChange}
                    isInFocusMode={isFocusMode}
                    displayName={innerOuterKeyMap.get(element.id) || element.name}
                    hasActiveElement={activeInnerElement !== null}
                  />
                </g>
              );
            })}

          {/* ✅ Визуализация padding/margin для выбранного элемента */}
          {selectedElement && isFocusMode && relatedElementIds.size > 0 && fixedBoundingBox && (
            <PatternVisualization
              pattern={selectedElement.pattern}
              patternName={selectedElement.name}
              x={selectedElement.x}
              y={selectedElement.y}
              width={selectedElement.width}
              height={selectedElement.height}
              isSelected={true}
              isFocusMode={isFocusMode}
              hoveredInnerOuterElement={editorStore.state.hoveredInnerOuterElement}
              onUpdateLocation={(type, key, location) =>
                handleUpdateLocation(selectedElement.name, type, key, location)
              }
              allElements={visualElements}
              fixedBoundingBox={fixedBoundingBox}
              onUpdateBoundingBox={handleUpdateBoundingBox}
            />
          )}
        </g>

        {visualElements.length === 0 && (
          <text x="50%" y="50%" textAnchor="middle" className="text-gray-400">
            <tspan x="50%" dy="0" className="text-xl font-semibold">
              Грамматика пуста
            </tspan>
            <tspan x="50%" dy="30">
              Добавьте элементы через панель инструментов
            </tspan>
          </text>
        )}
      </svg>
    </div>
  );
});