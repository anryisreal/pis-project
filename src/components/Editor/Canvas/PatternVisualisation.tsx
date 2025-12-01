import React, { useState } from 'react';
import type { Pattern, LocationObject } from '../../../models/Pattern';

interface PatternVisualizationProps {
    pattern: Pattern;
    patternName: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isSelected: boolean;
    onUpdateLocation: (type: 'inner' | 'outer', key: string, location: LocationObject) => void;
    allElements?: Array<{ id: string; name: string; x: number; y: number; width: number; height: number }>;
    showBorderOnly?: boolean;
}

const CELL_SIZE = 20;

export const PatternVisualization: React.FC<PatternVisualizationProps> = ({
                                                                              pattern,
                                                                              x,
                                                                              y,
                                                                              width,
                                                                              height,
                                                                              isSelected,
                                                                              onUpdateLocation,
                                                                              allElements = [],
                                                                              showBorderOnly = false
                                                                          }) => {
    const [draggingHandle, setDraggingHandle] = useState<{
        type: 'inner' | 'outer';
        key: string;
        side: 'top' | 'right' | 'bottom' | 'left';
        startValue: number;
    } | null>(null);

    const findElement = (name: string) => {
        return allElements.find(el => el.name === name);
    };

    // Вычисляем bounding box - включая все inner элементы
    const calculateBoundingBox = () => {
        let minX = x;
        let minY = y;
        let maxX = x + width;
        let maxY = y + height;

        if (pattern.inner) {
            Object.values(pattern.inner).forEach(innerPattern => {
                if (!innerPattern.pattern) return;
                const innerElement = findElement(innerPattern.pattern);
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

    const handleMouseDown = (
        type: 'inner' | 'outer',
        key: string,
        side: 'top' | 'right' | 'bottom' | 'left',
        currentValue: number
    ) => (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setDraggingHandle({ type, key, side, startValue: currentValue });
    };

    const handleMouseMove = (e: React.MouseEvent<SVGGElement>) => {
        if (!draggingHandle) return;

        const svg = (e.target as SVGElement).ownerSVGElement;
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const bbox = calculateBoundingBox();
        const { type, key, side } = draggingHandle;
        let newValue = 0;

        if (side === 'top') {
            const delta = Math.round((svgP.y - bbox.y) / CELL_SIZE);
            newValue = Math.max(0, delta);
        } else if (side === 'bottom') {
            const delta = Math.round((bbox.y + bbox.height - svgP.y) / CELL_SIZE);
            newValue = Math.max(0, delta);
        } else if (side === 'left') {
            const delta = Math.round((svgP.x - bbox.x) / CELL_SIZE);
            newValue = Math.max(0, delta);
        } else if (side === 'right') {
            const delta = Math.round((bbox.x + bbox.width - svgP.x) / CELL_SIZE);
            newValue = Math.max(0, delta);
        }

        const locationKey = type === 'inner' ? `padding-${side}` : `margin-${side}`;

        const currentPattern = type === 'inner'
            ? pattern.inner?.[key]
            : pattern.outer?.[key];

        const currentLocation = (typeof currentPattern?.location === 'object' && !Array.isArray(currentPattern.location))
            ? currentPattern.location as LocationObject
            : {} as LocationObject;

        const newLocation: LocationObject = {
            ...currentLocation,
            [locationKey]: newValue.toString()
        };

        onUpdateLocation(type, key, newLocation);
    };

    const handleMouseUp = () => {
        setDraggingHandle(null);
    };

    const bbox = calculateBoundingBox();

    // Только черная граница
    if (showBorderOnly) {
        return (
            <g style={{ pointerEvents: 'none' }}>
                <rect
                    x={bbox.x}
                    y={bbox.y}
                    width={bbox.width}
                    height={bbox.height}
                    fill="transparent"
                    stroke="black"
                    strokeWidth={3}
                />
            </g>
        );
    }

    if (!isSelected) return null;

    const innerVisualizations: JSX.Element[] = [];
    const outerVisualizations: JSX.Element[] = [];

// INNER элементы (padding) - перпендикулярные стрелки
    if (pattern.inner) {
        Object.entries(pattern.inner).forEach(([key, innerPattern]) => {
            if (!innerPattern.pattern) return;

            const innerElement = findElement(innerPattern.pattern);
            if (!innerElement) return;

            const location = (typeof innerPattern.location === 'object' && !Array.isArray(innerPattern.location))
                ? innerPattern.location as LocationObject
                : {} as LocationObject;

            const paddingTop = parseLocationValue(location['padding-top']);
            const paddingRight = parseLocationValue(location['padding-right']);
            const paddingBottom = parseLocationValue(location['padding-bottom']);
            const paddingLeft = parseLocationValue(location['padding-left']);

            // padding-top - вертикальная линия от верха bbox к верху inner элемента
            if (paddingTop > 0) {
                // X координата - по центру inner элемента
                const lineX = innerElement.x + innerElement.width / 2;

                innerVisualizations.push(
                    <PaddingArrow
                        key={`inner-top-${key}`}
                        x1={lineX}
                        y1={bbox.y}
                        x2={lineX}
                        y2={innerElement.y}
                        value={paddingTop}
                        label="padding-top"
                        color="rgb(138, 43, 226)"
                        onMouseDown={handleMouseDown('inner', key, 'top', paddingTop)}
                    />
                );
            }

            // padding-bottom - вертикальная линия от низа inner элемента к низу bbox
            if (paddingBottom > 0) {
                const lineX = innerElement.x + innerElement.width / 2;

                innerVisualizations.push(
                    <PaddingArrow
                        key={`inner-bottom-${key}`}
                        x1={lineX}
                        y1={innerElement.y + innerElement.height}
                        x2={lineX}
                        y2={bbox.y + bbox.height}
                        value={paddingBottom}
                        label="padding-bottom"
                        color="rgb(138, 43, 226)"
                        onMouseDown={handleMouseDown('inner', key, 'bottom', paddingBottom)}
                    />
                );
            }

            // padding-left - горизонтальная линия от левого края bbox к левому краю inner элемента
            if (paddingLeft > 0) {
                // Y координата - по центру inner элемента
                const lineY = innerElement.y + innerElement.height / 2;

                innerVisualizations.push(
                    <PaddingArrow
                        key={`inner-left-${key}`}
                        x1={bbox.x}
                        y1={lineY}
                        x2={innerElement.x}
                        y2={lineY}
                        value={paddingLeft}
                        label="padding-left"
                        color="rgb(138, 43, 226)"
                        onMouseDown={handleMouseDown('inner', key, 'left', paddingLeft)}
                    />
                );
            }

            // padding-right - горизонтальная линия от правого края inner элемента к правому краю bbox
            if (paddingRight > 0) {
                const lineY = innerElement.y + innerElement.height / 2;

                innerVisualizations.push(
                    <PaddingArrow
                        key={`inner-right-${key}`}
                        x1={innerElement.x + innerElement.width}
                        y1={lineY}
                        x2={bbox.x + bbox.width}
                        y2={lineY}
                        value={paddingRight}
                        label="padding-right"
                        color="rgb(138, 43, 226)"
                        onMouseDown={handleMouseDown('inner', key, 'right', paddingRight)}
                    />
                );
            }
        });
    }

// OUTER элементы (margin) - с привязкой к углам если выходит за границы
    if (pattern.outer) {
        Object.entries(pattern.outer).forEach(([key, outerPattern]) => {
            if (!outerPattern.pattern) return;

            const outerElement = findElement(outerPattern.pattern);
            if (!outerElement) return;

            const location = (typeof outerPattern.location === 'object' && !Array.isArray(outerPattern.location))
                ? outerPattern.location as LocationObject
                : {} as LocationObject;

            const marginTop = parseLocationValue(location['margin-top']);
            const marginRight = parseLocationValue(location['margin-right']);
            const marginBottom = parseLocationValue(location['margin-bottom']);
            const marginLeft = parseLocationValue(location['margin-left']);

            // margin-top - вертикальная линия
            if (marginTop > 0) {
                const outerCenterX = outerElement.x + outerElement.width / 2;

                // Проверяем, находится ли центр outer элемента в пределах bbox по X
                let lineX = outerCenterX;
                if (outerCenterX < bbox.x) {
                    // Outer элемент левее bbox - привязываем к левому верхнему углу
                    lineX = bbox.x;
                } else if (outerCenterX > bbox.x + bbox.width) {
                    // Outer элемент правее bbox - привязываем к правому верхнему углу
                    lineX = bbox.x + bbox.width;
                }

                outerVisualizations.push(
                    <PaddingArrow
                        key={`outer-top-${key}`}
                        x1={outerCenterX}
                        y1={outerElement.y + outerElement.height}
                        x2={lineX}
                        y2={bbox.y}
                        value={marginTop}
                        label="margin-top"
                        color="rgb(255, 105, 180)"
                        onMouseDown={handleMouseDown('outer', key, 'top', marginTop)}
                    />
                );
            }

            // margin-bottom - вертикальная линия
            if (marginBottom > 0) {
                const outerCenterX = outerElement.x + outerElement.width / 2;

                let lineX = outerCenterX;
                if (outerCenterX < bbox.x) {
                    lineX = bbox.x;
                } else if (outerCenterX > bbox.x + bbox.width) {
                    lineX = bbox.x + bbox.width;
                }

                outerVisualizations.push(
                    <PaddingArrow
                        key={`outer-bottom-${key}`}
                        x1={lineX}
                        y1={bbox.y + bbox.height}
                        x2={outerCenterX}
                        y2={outerElement.y}
                        value={marginBottom}
                        label="margin-bottom"
                        color="rgb(255, 105, 180)"
                        onMouseDown={handleMouseDown('outer', key, 'bottom', marginBottom)}
                    />
                );
            }

            // margin-left - горизонтальная линия
            if (marginLeft > 0) {
                const outerCenterY = outerElement.y + outerElement.height / 2;

                let lineY = outerCenterY;
                if (outerCenterY < bbox.y) {
                    // Outer элемент выше bbox - привязываем к левому верхнему углу
                    lineY = bbox.y;
                } else if (outerCenterY > bbox.y + bbox.height) {
                    // Outer элемент ниже bbox - привязываем к левому нижнему углу
                    lineY = bbox.y + bbox.height;
                }

                outerVisualizations.push(
                    <PaddingArrow
                        key={`outer-left-${key}`}
                        x1={outerElement.x + outerElement.width}
                        y1={outerCenterY}
                        x2={bbox.x}
                        y2={lineY}
                        value={marginLeft}
                        label="margin-left"
                        color="rgb(255, 105, 180)"
                        onMouseDown={handleMouseDown('outer', key, 'left', marginLeft)}
                    />
                );
            }

            // margin-right - горизонтальная линия
            if (marginRight > 0) {
                const outerCenterY = outerElement.y + outerElement.height / 2;

                let lineY = outerCenterY;
                if (outerCenterY < bbox.y) {
                    lineY = bbox.y;
                } else if (outerCenterY > bbox.y + bbox.height) {
                    lineY = bbox.y + bbox.height;
                }

                outerVisualizations.push(
                    <PaddingArrow
                        key={`outer-right-${key}`}
                        x1={bbox.x + bbox.width}
                        y1={lineY}
                        x2={outerElement.x}
                        y2={outerCenterY}
                        value={marginRight}
                        label="margin-right"
                        color="rgb(255, 105, 180)"
                        onMouseDown={handleMouseDown('outer', key, 'right', marginRight)}
                    />
                );
            }
        });
    }

    return (
        <g
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ pointerEvents: draggingHandle ? 'all' : 'none' }}
        >
            {/* Outer margins (розовые стрелки) */}
            {outerVisualizations}

            {/* Черная граница - вокруг ВСЕГО (паттерн + inner элементы) */}
            <rect
                x={bbox.x}
                y={bbox.y}
                width={bbox.width}
                height={bbox.height}
                fill="transparent"
                stroke="black"
                strokeWidth={3}
                style={{ pointerEvents: 'none' }}
            />

            {/* Inner paddings (фиолетовые стрелки) */}
            {innerVisualizations}
        </g>
    );
};

interface PaddingArrowProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    value: number;
    label: string;
    color: string;
    onMouseDown: (e: React.MouseEvent) => void;
}

const PaddingArrow: React.FC<PaddingArrowProps> = ({
                                                       x1, y1, x2, y2, value, label, color, onMouseDown
                                                   }) => {
    const [isHovered, setIsHovered] = useState(false);

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const arrowSize = 8;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    return (
        <g
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={onMouseDown}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
        >
            {/* Невидимая широкая линия для захвата */}
            <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth={20}
            />

            {/* Основная линия */}
            <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={2}
            />

            {/* Стрелка в начале */}
            <polygon
                points={`${x1},${y1} ${x1 + arrowSize * Math.cos(angle + Math.PI / 6)},${y1 + arrowSize * Math.sin(angle + Math.PI / 6)} ${x1 + arrowSize * Math.cos(angle - Math.PI / 6)},${y1 + arrowSize * Math.sin(angle - Math.PI / 6)}`}
                fill={color}
            />

            {/* Стрелка в конце */}
            <polygon
                points={`${x2},${y2} ${x2 - arrowSize * Math.cos(angle + Math.PI / 6)},${y2 - arrowSize * Math.sin(angle + Math.PI / 6)} ${x2 - arrowSize * Math.cos(angle - Math.PI / 6)},${y2 - arrowSize * Math.sin(angle - Math.PI / 6)}`}
                fill={color}
            />

            {/* Текст */}
            <text
                x={midX + 15}
                y={midY - 5}
                fill={color}
                fontSize={12}
                fontWeight="bold"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
                {label}: {value}
            </text>

            {/* Хендл при наведении */}
            {isHovered && (
                <circle
                    cx={midX}
                    cy={midY}
                    r={6}
                    fill={color}
                    opacity={0.7}
                    stroke="white"
                    strokeWidth={2}
                />
            )}
        </g>
    );
};

function parseLocationValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const num = parseInt(value);
        if (!isNaN(num)) return num;
    }
    return 0;
}
