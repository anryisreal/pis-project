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
  isFocusMode: boolean;
  hoveredInnerOuterElement: string | null;
  onUpdateLocation: (type: 'inner' | 'outer', key: string, location: LocationObject) => void;
  allElements?: Array<{ id: string; name: string; x: number; y: number; width: number; height: number }>;
  fixedBoundingBox?: { x: number; y: number; width: number; height: number };
  onUpdateBoundingBox?: (bbox: { x: number; y: number; width: number; height: number }) => void; // ✅ NEW
}

const CELL_SIZE = 20;

export const PatternVisualization: React.FC<PatternVisualizationProps> = ({
                                                                            pattern,
                                                                            x,
                                                                            y,
                                                                            width,
                                                                            height,
                                                                            isSelected,
                                                                            isFocusMode,
                                                                            hoveredInnerOuterElement,
                                                                            onUpdateLocation,
                                                                            allElements = [],
                                                                            fixedBoundingBox,
                                                                            onUpdateBoundingBox
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

  const calculateBoundingBox = () => {
    // Если есть фиксированная граница - используем её
    if (fixedBoundingBox) {
      return fixedBoundingBox;
    }

    // Иначе вычисляем динамически
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
    // В режиме фокуса граница зафиксирована
    if (isFocusMode) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    setDraggingHandle({ type, key, side, startValue: currentValue });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGGElement>) => {
    // Обработка изменения padding/margin стрелок
    if (!draggingHandle || isFocusMode) return;

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

  // ✅ NEW: Обработчики для изменения границы
  const handleBoundaryMouseDown = (
    side: 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    e: React.MouseEvent
  ) => {
    if (!isFocusMode || !onUpdateBoundingBox || !fixedBoundingBox) return;

    e.stopPropagation();
    e.preventDefault();

    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    // ✅ Вычисляем минимальный bbox, охватывающий все inner элементы
    let minBbox = { x: Infinity, y: Infinity, maxX: -Infinity, maxY: -Infinity };

    if (pattern.inner) {
      Object.values(pattern.inner).forEach(innerPattern => {
        if (!innerPattern.pattern) return;
        const innerElement = findElement(innerPattern.pattern);
        if (!innerElement) return;

        minBbox.x = Math.min(minBbox.x, innerElement.x);
        minBbox.y = Math.min(minBbox.y, innerElement.y);
        minBbox.maxX = Math.max(minBbox.maxX, innerElement.x + innerElement.width);
        minBbox.maxY = Math.max(minBbox.maxY, innerElement.y + innerElement.height);
      });
    }

    // Если нет inner элементов, используем минимальный размер
    const hasInnerElements = minBbox.x !== Infinity;

    const startBbox = { ...fixedBoundingBox };
    const startMouse = { x: svgP.x, y: svgP.y };

    // ✅ ИСПРАВЛЕНИЕ: Используем глобальные слушатели для надёжности
    const handleGlobalMouseMove = (globalE: MouseEvent) => {
      globalE.preventDefault();

      const svg = (e.target as SVGElement).ownerSVGElement;
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = globalE.clientX;
      pt.y = globalE.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      const deltaX = svgP.x - startMouse.x;
      const deltaY = svgP.y - startMouse.y;

      let newBbox = { ...startBbox };

      // Изменяем bbox в зависимости от стороны
      if (side === 'top' || side === 'top-left' || side === 'top-right') {
        newBbox.y = startBbox.y + deltaY;
        newBbox.height = startBbox.height - deltaY;
      }
      if (side === 'bottom' || side === 'bottom-left' || side === 'bottom-right') {
        newBbox.height = startBbox.height + deltaY;
      }
      if (side === 'left' || side === 'top-left' || side === 'bottom-left') {
        newBbox.x = startBbox.x + deltaX;
        newBbox.width = startBbox.width - deltaX;
      }
      if (side === 'right' || side === 'top-right' || side === 'bottom-right') {
        newBbox.width = startBbox.width + deltaX;
      }

      // ✅ ИСПРАВЛЕНИЕ: Ограничиваем минимальным размером, охватывающим inner элементы
      if (hasInnerElements) {
        // Проверяем, что новый bbox охватывает все inner элементы
        if (side.includes('left')) {
          // При изменении слева - не можем уйти правее левого края inner элементов
          newBbox.x = Math.min(newBbox.x, minBbox.x);
          newBbox.width = startBbox.x + startBbox.width - newBbox.x;
        }
        if (side.includes('right')) {
          // При изменении справа - не можем уйти левее правого края inner элементов
          const rightEdge = newBbox.x + newBbox.width;
          if (rightEdge < minBbox.maxX) {
            newBbox.width = minBbox.maxX - newBbox.x;
          }
        }
        if (side.includes('top')) {
          // При изменении сверху - не можем уйти ниже верхнего края inner элементов
          newBbox.y = Math.min(newBbox.y, minBbox.y);
          newBbox.height = startBbox.y + startBbox.height - newBbox.y;
        }
        if (side.includes('bottom')) {
          // При изменении снизу - не можем уйти выше нижнего края inner элементов
          const bottomEdge = newBbox.y + newBbox.height;
          if (bottomEdge < minBbox.maxY) {
            newBbox.height = minBbox.maxY - newBbox.y;
          }
        }
      } else {
        // Если нет inner элементов, просто минимальный размер 100x100
        if (newBbox.width < 100) {
          newBbox.width = 100;
          if (side.includes('left')) {
            newBbox.x = startBbox.x + startBbox.width - 100;
          }
        }
        if (newBbox.height < 100) {
          newBbox.height = 100;
          if (side.includes('top')) {
            newBbox.y = startBbox.y + startBbox.height - 100;
          }
        }
      }

      onUpdateBoundingBox(newBbox);
    };

    const handleGlobalMouseUp = () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const bbox = calculateBoundingBox();

  if (!isSelected) return null;

  const innerVisualizations: JSX.Element[] = [];
  const outerVisualizations: JSX.Element[] = [];

  // INNER элементы (padding)
  if (pattern.inner) {
    Object.entries(pattern.inner).forEach(([key, innerPattern]) => {
      if (!innerPattern.pattern) return;

      const innerElement = findElement(innerPattern.pattern);
      if (!innerElement) return;

      // Показываем стрелки ТОЛЬКО если этот элемент наведён
      const isHovered = hoveredInnerOuterElement === innerPattern.pattern;
      if (!isHovered) return;

      const location = (typeof innerPattern.location === 'object' && !Array.isArray(innerPattern.location))
        ? innerPattern.location as LocationObject
        : {} as LocationObject;

      const paddingTop = parseLocationValue(location['padding-top']);
      const paddingRight = parseLocationValue(location['padding-right']);
      const paddingBottom = parseLocationValue(location['padding-bottom']);
      const paddingLeft = parseLocationValue(location['padding-left']);

      if (paddingTop > 0) {
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
            isFocusMode={isFocusMode}
          />
        );
      }

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
            isFocusMode={isFocusMode}
          />
        );
      }

      if (paddingLeft > 0) {
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
            isFocusMode={isFocusMode}
          />
        );
      }

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
            isFocusMode={isFocusMode}
          />
        );
      }
    });
  }

  // OUTER элементы (margin)
  if (pattern.outer) {
    Object.entries(pattern.outer).forEach(([key, outerPattern]) => {
      if (!outerPattern.pattern) return;

      const outerElement = findElement(outerPattern.pattern);
      if (!outerElement) return;

      // Показываем стрелки ТОЛЬКО если этот элемент наведён
      const isHovered = hoveredInnerOuterElement === outerPattern.pattern;
      if (!isHovered) return;

      const location = (typeof outerPattern.location === 'object' && !Array.isArray(outerPattern.location))
        ? outerPattern.location as LocationObject
        : {} as LocationObject;

      const marginTop = parseLocationValue(location['margin-top']);
      const marginRight = parseLocationValue(location['margin-right']);
      const marginBottom = parseLocationValue(location['margin-bottom']);
      const marginLeft = parseLocationValue(location['margin-left']);

      if (marginTop > 0) {
        const outerCenterX = outerElement.x + outerElement.width / 2;
        let lineX = outerCenterX;
        if (outerCenterX < bbox.x) {
          lineX = bbox.x;
        } else if (outerCenterX > bbox.x + bbox.width) {
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
            isFocusMode={isFocusMode}
          />
        );
      }

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
            isFocusMode={isFocusMode}
          />
        );
      }

      if (marginLeft > 0) {
        const outerCenterY = outerElement.y + outerElement.height / 2;
        let lineY = outerCenterY;
        if (outerCenterY < bbox.y) {
          lineY = bbox.y;
        } else if (outerCenterY > bbox.y + bbox.height) {
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
            isFocusMode={isFocusMode}
          />
        );
      }

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
            isFocusMode={isFocusMode}
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
      {outerVisualizations}

      {/* Чёрная граница - ЗАФИКСИРОВАНА в режиме фокуса */}
      <rect
        x={bbox.x}
        y={bbox.y}
        width={bbox.width}
        height={bbox.height}
        fill="transparent"
        stroke="black"
        strokeWidth={isFocusMode ? 4 : 3}
        strokeDasharray={isFocusMode ? "none" : "5,5"}
        style={{ pointerEvents: 'none' }}
      />

      {/* Подсказка о зафиксированной границе */}
      {isFocusMode && (
        <text
          x={bbox.x + bbox.width / 2}
          y={bbox.y - 10}
          fontSize="11"
          fill="black"
          fontWeight="bold"
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          Граница зафиксирована (ESC для выхода)
        </text>
      )}

      {innerVisualizations}

      {/* ✅ Ручки для изменения границы в режиме фокуса */}
      {isFocusMode && onUpdateBoundingBox && (
        <g>
          {/* Угловые ручки */}
          <BoundaryHandle
            x={bbox.x}
            y={bbox.y}
            cursor="nwse-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('top-left', e)}
          />
          <BoundaryHandle
            x={bbox.x + bbox.width}
            y={bbox.y}
            cursor="nesw-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('top-right', e)}
          />
          <BoundaryHandle
            x={bbox.x}
            y={bbox.y + bbox.height}
            cursor="nesw-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('bottom-left', e)}
          />
          <BoundaryHandle
            x={bbox.x + bbox.width}
            y={bbox.y + bbox.height}
            cursor="nwse-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('bottom-right', e)}
          />

          {/* Боковые ручки */}
          <BoundaryHandle
            x={bbox.x + bbox.width / 2}
            y={bbox.y}
            cursor="ns-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('top', e)}
          />
          <BoundaryHandle
            x={bbox.x + bbox.width / 2}
            y={bbox.y + bbox.height}
            cursor="ns-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('bottom', e)}
          />
          <BoundaryHandle
            x={bbox.x}
            y={bbox.y + bbox.height / 2}
            cursor="ew-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('left', e)}
          />
          <BoundaryHandle
            x={bbox.x + bbox.width}
            y={bbox.y + bbox.height / 2}
            cursor="ew-resize"
            onMouseDown={(e) => handleBoundaryMouseDown('right', e)}
          />
        </g>
      )}
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
  isFocusMode: boolean;
}

const PaddingArrow: React.FC<PaddingArrowProps> = ({
                                                     x1, y1, x2, y2, value, label, color, onMouseDown, isFocusMode
                                                   }) => {
  const [isHovered, setIsHovered] = useState(false);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const arrowSize = 8;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // ✅ Вычисляем длину стрелки
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const isShort = length < 60;

  // ✅ Умное позиционирование текста
  let textX = midX;
  let textY = midY - 5;
  let textRotation = 0;
  let showLeaderLine = false;

  if (isShort) {
    // Короткая стрелка - выносим текст перпендикулярно
    showLeaderLine = true;

    // Вычисляем перпендикулярное направление
    const perpAngle = angle + Math.PI / 2;
    const leaderLength = 30;

    textX = midX + Math.cos(perpAngle) * leaderLength;
    textY = midY + Math.sin(perpAngle) * leaderLength;

    // Поворачиваем текст для читаемости
    textRotation = (angle * 180 / Math.PI);
    if (textRotation > 90) textRotation -= 180;
    if (textRotation < -90) textRotation += 180;
  } else {
    // Длинная стрелка - текст вдоль стрелки
    textX = midX + 15;
    textY = midY - 5;
  }

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={onMouseDown}
      style={{ cursor: isFocusMode ? 'not-allowed' : 'pointer', pointerEvents: 'all' }}
    >
      {/* Прозрачная область для клика */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={20}
      />

      {/* Видимая линия */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isHovered ? 3 : 2}
      />

      {/* Стрелки на концах */}
      <polygon
        points={`${x1},${y1} ${x1 + arrowSize * Math.cos(angle + Math.PI / 6)},${y1 + arrowSize * Math.sin(angle + Math.PI / 6)} ${x1 + arrowSize * Math.cos(angle - Math.PI / 6)},${y1 + arrowSize * Math.sin(angle - Math.PI / 6)}`}
        fill={color}
      />

      <polygon
        points={`${x2},${y2} ${x2 - arrowSize * Math.cos(angle + Math.PI / 6)},${y2 - arrowSize * Math.sin(angle + Math.PI / 6)} ${x2 - arrowSize * Math.cos(angle - Math.PI / 6)},${y2 - arrowSize * Math.sin(angle - Math.PI / 6)}`}
        fill={color}
      />

      {/* ✅ Выносная линия для коротких стрелок */}
      {showLeaderLine && (
        <line
          x1={midX}
          y1={midY}
          x2={textX}
          y2={textY}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="2,2"
          opacity={0.6}
        />
      )}

      {/* Подпись с умным позиционированием */}
      <text
        x={textX}
        y={textY}
        fill={color}
        fontSize={12}
        fontWeight="bold"
        textAnchor="middle"
        transform={isShort ? `rotate(${textRotation} ${textX} ${textY})` : undefined}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}: {value}
      </text>

      {/* Фон для текста (улучшает читаемость) */}
      {isShort && (
        <rect
          x={textX - 40}
          y={textY - 12}
          width={80}
          height={18}
          fill="white"
          opacity={0.8}
          rx={3}
          style={{ pointerEvents: 'none' }}
          transform={`rotate(${textRotation} ${textX} ${textY})`}
        />
      )}

      {/* Индикатор hover */}
      {isHovered && !isFocusMode && (
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

// ✅ NEW: Компонент ручки для изменения границы
interface BoundaryHandleProps {
  x: number;
  y: number;
  cursor: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

const BoundaryHandle: React.FC<BoundaryHandleProps> = ({ x, y, cursor, onMouseDown }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={onMouseDown}
      style={{ cursor, pointerEvents: 'all' }}
    >
      {/* Прозрачная область для клика */}
      <circle
        cx={x}
        cy={y}
        r={12}
        fill="transparent"
      />
      {/* Видимая ручка */}
      <circle
        cx={x}
        cy={y}
        r={isHovered ? 6 : 5}
        fill="white"
        stroke="black"
        strokeWidth={2}
      />
      {/* Внутренняя точка */}
      <circle
        cx={x}
        cy={y}
        r={2}
        fill="black"
      />
    </g>
  );
};