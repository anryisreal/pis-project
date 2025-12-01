import React, { useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ZoomIn, ZoomOut, Maximize2, Focus } from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';
import { ElementShape } from './ElementShape';
import { PatternVisualization } from './PatternVisualisation';
import type { Pattern } from '../../../models/Pattern';

const CELL_SIZE = 20;
const BASE_CELL_WIDTH = 150;
const BASE_CELL_HEIGHT = 80;

export const CanvasStage: React.FC = observer(() => {
    const grammarStore = useGrammarStore();
    const editorStore = useEditorStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Храним позиции элементов
    const [elementPositions, setElementPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

    // Фикс для preventDefault warning
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

        if (e.button === 0 && !isElementShape) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            editorStore.deselectAll();
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

    const handleElementPositionChange = (id: string, x: number, y: number) => {
        setElementPositions(prev => {
            const newMap = new Map(prev);
            newMap.set(id, { x, y });
            return newMap;
        });
    };

    // Функция для вычисления bbox паттерна
    const calculateBoundingBox = (pattern: Pattern) => {
        const mainElement = visualElements.find(el => el.pattern === pattern);
        if (!mainElement) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = mainElement.x;
        let minY = mainElement.y;
        let maxX = mainElement.x + mainElement.width;
        let maxY = mainElement.y + mainElement.height;

        if (pattern.inner) {
            Object.values(pattern.inner).forEach(innerPattern => {
                if (!innerPattern.pattern) return;
                const innerElement = visualElements.find(el => el.name === innerPattern.pattern);
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

    // Функция для центрирования выбранного элемента
    const handleCenterSelected = () => {
        if (!selectedElement) return;

        const bbox = calculateBoundingBox(selectedElement.pattern);

        // Получаем размеры SVG контейнера
        if (!svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();

        // Вычисляем центр bbox
        const bboxCenterX = bbox.x + bbox.width / 2;
        const bboxCenterY = bbox.y + bbox.height / 2;

        // Вычисляем центр видимой области (с учетом масштаба)
        const viewCenterX = svgRect.width / 2 / zoom;
        const viewCenterY = svgRect.height / 2 / zoom;

        // Вычисляем смещение для центрирования
        setPan({
            x: (viewCenterX - bboxCenterX) * zoom,
            y: (viewCenterY - bboxCenterY) * zoom
        });
    };

    // Создаем Map для быстрого поиска паттернов
    const patternsMap = new Map<string, Pattern>();
    grammarStore.allPatterns.forEach(p => {
        patternsMap.set(p.name, p);
    });

    // Вычисляем размеры и позиции всех элементов
    const visualElements = grammarStore.allPatterns.map((element, index) => {
        const savedPosition = elementPositions.get(element.name);
        const defaultX = 100 + (index % 3) * 400;
        const defaultY = 100 + Math.floor(index / 3) * 300;

        let width = BASE_CELL_WIDTH;
        let height = BASE_CELL_HEIGHT;

        if (element.kind === 'array') {
            width = 250;
            height = 140;
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

    // Собираем ID всех inner/outer элементов выбранного паттерна
    const relatedElementIds = new Set<string>();
    if (selectedElement) {
        relatedElementIds.add(selectedElement.id);

        if (selectedElement.pattern.inner) {
            Object.values(selectedElement.pattern.inner).forEach(inner => {
                if (inner.pattern) relatedElementIds.add(inner.pattern);
            });
        }

        if (selectedElement.pattern.outer) {
            Object.values(selectedElement.pattern.outer).forEach(outer => {
                if (outer.pattern) relatedElementIds.add(outer.pattern);
            });
        }
    }

    return (
        <div className="relative w-full h-full bg-gray-50">
            {/* Zoom controls */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
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
                {/* Кнопка для центрирования выбранного элемента */}
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
            {selectedElement && (
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
                        Перетягивайте элементы и стрелки
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

                    {/* Рендерим элементы */}
                    {visualElements.map(element => {
                        // Определяем, нужно ли затемнять элемент
                        const shouldDim = selectedElement && !relatedElementIds.has(element.id);

                        return (
                            <g key={element.id} opacity={shouldDim ? 0.3 : 1}>
                                <ElementShape
                                    element={element}
                                    isSelected={editorStore.state.selectedElements.includes(element.id)}
                                    isHovered={editorStore.state.hoveredElement === element.id}
                                    onSelect={() => editorStore.selectElement(element.id)}
                                    onHover={() => editorStore.setHoveredElement(element.id)}
                                    onHoverEnd={() => editorStore.setHoveredElement(null)}
                                    onPositionChange={handleElementPositionChange}
                                />
                            </g>
                        );
                    })}

                    {/* Визуализация padding/margin для выбранного элемента */}
                    {selectedElement && (
                        <PatternVisualization
                            pattern={selectedElement.pattern}
                            patternName={selectedElement.name}
                            x={selectedElement.x}
                            y={selectedElement.y}
                            width={selectedElement.width}
                            height={selectedElement.height}
                            isSelected={true}
                            onUpdateLocation={(type, key, location) =>
                                handleUpdateLocation(selectedElement.name, type, key, location)
                            }
                            allElements={visualElements}
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
