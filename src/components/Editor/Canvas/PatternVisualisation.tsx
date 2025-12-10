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
  onUpdateLocation: (
    type: 'inner' | 'outer',
    key: string,
    location: LocationObject
  ) => void;
  allElements?: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  fixedBoundingBox?: { x: number; y: number; width: number; height: number };
  onUpdateBoundingBox?: (bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;

  arrayItemPattern?: Pattern | null;
}





const CELL_SIZE = 20;

// 🔹 Статический размер визуального item_pattern внутри массива
const ARRAY_ITEM_WIDTH = 300;
const ARRAY_ITEM_HEIGHT = 200;

// 🔹 Фиксированный визуальный gap под стрелку (когда logical gap > 0)
const ARRAY_VISUAL_GAP_PX = 100;

const getColorByKind = (kind?: string) => {
  const colors: Record<string, string> = {
    cell: '#3b82f6',
    area: '#10b981',
    array: '#f59e0b'
  };
  return (kind && colors[kind]) || '#6b7280';
};

type ArrayItemRect = { x: number; y: number; width: number; height: number };


/**
 * Раскладка элементов массива относительно (baseX, baseY)
 * Здесь НЕТ центрирования по bbox – просто считаем минимальный прямоугольник,
 * в который всё поместится. Для row/column элементы плотно от края, для fill
 * считаем геометрию как по макетам.
 */
function layoutArrayItemsRaw(
  baseX: number,
  baseY: number,
  itemW: number,
  itemH: number,
  direction: 'row' | 'column' | 'fill',
  count: number,
  visualGap: number
): ArrayItemRect[] {
  const rects: ArrayItemRect[] = [];

  if (count <= 0) return rects;

  if (direction === 'row') {
    for (let i = 0; i < count; i++) {
      rects.push({
        x: baseX + i * (itemW + visualGap),
        y: baseY,
        width: itemW,
        height: itemH
      });
    }
    return rects;
  }

  if (direction === 'column') {
    for (let i = 0; i < count; i++) {
      rects.push({
        x: baseX,
        y: baseY + i * (itemH + visualGap),
        width: itemW,
        height: itemH
      });
    }
    return rects;
  }

  // direction === 'fill'
  if (count === 1) {
    rects.push({
      x: baseX,
      y: baseY,
      width: itemW,
      height: itemH
    });
    return rects;
  }

  if (count === 2) {
    // ориентируемся по форме элемента: шире → row, выше → column
    if (itemW >= itemH) {
      // row
      rects.push({
        x: baseX,
        y: baseY,
        width: itemW,
        height: itemH
      });
      rects.push({
        x: baseX + itemW + visualGap,
        y: baseY,
        width: itemW,
        height: itemH
      });
    } else {
      // column
      rects.push({
        x: baseX,
        y: baseY,
        width: itemW,
        height: itemH
      });
      rects.push({
        x: baseX,
        y: baseY + itemH + visualGap,
        width: itemW,
        height: itemH
      });
    }
    return rects;
  }

  // count >= 3 → «пирамидка»: один сверху по центру, два снизу
  const totalWidth = itemW * 2 + visualGap;
  // верхний по центру
  rects.push({
    x: baseX + (totalWidth - itemW) / 2,
    y: baseY,
    width: itemW,
    height: itemH
  });

  const bottomY = baseY + itemH + visualGap;

  rects.push({
    x: baseX,
    y: bottomY,
    width: itemW,
    height: itemH
  });

  rects.push({
    x: baseX + itemW + visualGap,
    y: bottomY,
    width: itemW,
    height: itemH
  });

  return rects;
}


// Сколько элементов массива рисуем (1..3)
function getArrayItemsToDraw(raw: any): number {
  if (raw == null) return 3;

  if (typeof raw === 'number') {
    if (raw <= 1) return 1;
    if (raw === 2) return 2;
    return 3;
  }

  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return 3;

    if (/^\d+$/.test(value)) {
      const n = parseInt(value, 10);
      if (n <= 1) return 1;
      if (n === 2) return 2;
      return 3;
    }

    const rangeMatch = value.match(/^(\d+)\.\.(\d+|\*)$/);
    if (rangeMatch) {
      const upperStr = rangeMatch[2];
      if (upperStr === '*' || upperStr === '') return 3;
      const upper = parseInt(upperStr, 10);
      if (upper <= 1) return 1;
      if (upper === 2) return 2;
      return 3;
    }

    const plusMatch = value.match(/^(\d+)\+$/);
    if (plusMatch) return 3;
  }

  return 3;
}



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
  onUpdateBoundingBox,
  arrayItemPattern,
}) => {
  const [draggingHandle, setDraggingHandle] = useState<{
    type: 'inner' | 'outer';
    key: string;
    side: 'top' | 'right' | 'bottom' | 'left';
    startValue: string;
  } | null>(null);

  const [hoveredArrayItem, setHoveredArrayItem] = useState<number | null>(null);


  const handleArrayItemMouseEnter =
  (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setHoveredArrayItem(index);
  };

  const handleArrayItemMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHoveredArrayItem(null);
  };



  const findElementByComponentKey = (key: string) => {
    return allElements.find((el) => el.name === key);
  };



    const calculateBoundingBox = () => {
    // 🔹 Спец-случай: Array — размер зависит только от статических размеров item + count + gap
    if (pattern.kind === 'array' && pattern.item_pattern) {
      const direction = (pattern as any).direction || 'row';
      const count = getArrayItemsToDraw((pattern as any).item_count);
      const logicalGap = pattern.gap
      const visualGap = logicalGap != "0" ? ARRAY_VISUAL_GAP_PX : 0;

      // Раскладываем элементы от (x, y) с фиксированным размером item'а
      const rects = layoutArrayItemsRaw(
        x,
        y,
        ARRAY_ITEM_WIDTH,
        ARRAY_ITEM_HEIGHT,
        direction as 'row' | 'column' | 'fill',
        count,
        visualGap
      );

      if (rects.length > 0) {
        let minX = rects[0].x;
        let minY = rects[0].y;
        let maxX = rects[0].x + rects[0].width;
        let maxY = rects[0].y + rects[0].height;

        for (const r of rects) {
          minX = Math.min(minX, r.x);
          minY = Math.min(minY, r.y);
          maxX = Math.max(maxX, r.x + r.width);
          maxY = Math.max(maxY, r.y + r.height);
        }

        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };
      }
    }

    // 🔹 Остальные паттерны — как раньше
    if (fixedBoundingBox) {
      return fixedBoundingBox;
    }

    let minX = x;
    let minY = y;
    let maxX = x + width;
    let maxY = y + height;

    if (pattern.inner) {
      Object.values(pattern.inner).forEach((innerPattern) => {
        if (!innerPattern.pattern) return;
        const innerElement = findElementByComponentKey(innerPattern.pattern);
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





  const handleMouseDown =
    (
      type: 'inner' | 'outer',
      key: string,
      side: 'top' | 'right' | 'bottom' | 'left',
      currentValue: string
    ) =>
    (e: React.MouseEvent) => {
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

    const locationKey =
      type === 'inner' ? `padding-${side}` : `margin-${side}`;

    const currentPattern =
      type === 'inner' ? pattern.inner?.[key] : pattern.outer?.[key];

    const currentLocation =
      typeof currentPattern?.location === 'object' &&
      !Array.isArray(currentPattern.location)
        ? (currentPattern.location as LocationObject)
        : ({} as LocationObject);

    const newLocation: LocationObject = {
      ...currentLocation,
      [locationKey]: newValue.toString()
    };

    onUpdateLocation(type, key, newLocation);
  };

  const handleMouseUp = () => {
    setDraggingHandle(null);
  };

  // Обработчики для изменения границы
  const handleBoundaryMouseDown = (
    side:
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right',
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

    // Вычисляем минимальный bbox, охватывающий все inner элементы
    let minBbox = {
      x: Infinity,
      y: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    };

    if (pattern.inner) {
      Object.values(pattern.inner).forEach((innerPattern) => {
        if (!innerPattern.pattern) return;
        const innerElement = findElementByComponentKey(innerPattern.pattern);
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

      // Ограничиваем минимальным размером, охватывающим inner элементы
      if (hasInnerElements) {
        if (side.includes('left')) {
          newBbox.x = Math.min(newBbox.x, minBbox.x);
          newBbox.width = startBbox.x + startBbox.width - newBbox.x;
        }
        if (side.includes('right')) {
          const rightEdge = newBbox.x + newBbox.width;
          if (rightEdge < minBbox.maxX) {
            newBbox.width = minBbox.maxX - newBbox.x;
          }
        }
        if (side.includes('top')) {
          newBbox.y = Math.min(newBbox.y, minBbox.y);
          newBbox.height = startBbox.y + startBbox.height - newBbox.y;
        }
        if (side.includes('bottom')) {
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

    const innerElement = findElementByComponentKey(key);
    if (!innerElement) return;

    // показываем стрелки только если навели именно на ЭТОТ компонент
    const isHovered = hoveredInnerOuterElement === key;
    if (!isHovered) return;

    const location =
      typeof innerPattern.location === 'object' &&
      !Array.isArray(innerPattern.location)
        ? (innerPattern.location as LocationObject)
        : ({} as LocationObject);

      const paddingTop = location['padding-top'] ?? "0";
      const paddingRight = location['padding-right'] ?? "0";
      const paddingBottom = location['padding-bottom'] ?? "0";
      const paddingLeft = location['padding-left'] ?? "0";

      if (paddingTop != "0") {
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

      if (paddingBottom != "0") {
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

      if (paddingLeft != "0") {
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

      if (paddingRight != "0") {
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

      const outerElement = findElementByComponentKey(key);
      if (!outerElement) return;

      const isHovered = hoveredInnerOuterElement === key;
      if (!isHovered) return;

      const location =
        typeof outerPattern.location === 'object' &&
        !Array.isArray(outerPattern.location)
          ? (outerPattern.location as LocationObject)
          : ({} as LocationObject);

      const marginTop = location['margin-top'] ?? '0';
      const marginRight = location['margin-right'] ?? '0';
      const marginBottom = location['margin-bottom'] ?? '0';
      const marginLeft = location['margin-left'] ?? '0';

      // --- margin-top ---
      if (marginTop !== '0') {
        const outerBottomY = outerElement.y + outerElement.height;
        const outerCenterX = outerElement.x + outerElement.width / 2;

        let lineX = outerCenterX;
        if (outerCenterX < bbox.x) {
          lineX = bbox.x;
        } else if (outerCenterX > bbox.x + bbox.width) {
          lineX = bbox.x + bbox.width;
        }

        const isDiagonal = lineX !== outerCenterX;

        // Пунктир от компонента до проекции по X
        if (isDiagonal) {
          outerVisualizations.push(
            <line
              key={`outer-top-guide-${key}`}
              x1={outerCenterX}
              y1={outerBottomY}
              x2={lineX}
              y2={outerBottomY}
              stroke="rgb(255, 105, 180)"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.7}
              style={{ pointerEvents: 'none' }}
            />
          );
        }

        // Стрелка строго вертикально
        outerVisualizations.push(
          <PaddingArrow
            key={`outer-top-${key}`}
            x1={lineX}
            y1={outerBottomY}
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

      // --- margin-bottom ---
      if (marginBottom !== '0') {
        const outerTopY = outerElement.y;
        const outerCenterX = outerElement.x + outerElement.width / 2;

        let lineX = outerCenterX;
        if (outerCenterX < bbox.x) {
          lineX = bbox.x;
        } else if (outerCenterX > bbox.x + bbox.width) {
          lineX = bbox.x + bbox.width;
        }

        const isDiagonal = lineX !== outerCenterX;

        if (isDiagonal) {
          outerVisualizations.push(
            <line
              key={`outer-bottom-guide-${key}`}
              x1={outerCenterX}
              y1={outerTopY}
              x2={lineX}
              y2={outerTopY}
              stroke="rgb(255, 105, 180)"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.7}
              style={{ pointerEvents: 'none' }}
            />
          );
        }

        outerVisualizations.push(
          <PaddingArrow
            key={`outer-bottom-${key}`}
            x1={lineX}
            y1={bbox.y + bbox.height}
            x2={lineX}
            y2={outerTopY}
            value={marginBottom}
            label="margin-bottom"
            color="rgb(255, 105, 180)"
            onMouseDown={handleMouseDown('outer', key, 'bottom', marginBottom)}
            isFocusMode={isFocusMode}
          />
        );
      }

      // --- margin-left ---
      if (marginLeft !== '0') {
        const outerRightX = outerElement.x + outerElement.width;
        const outerCenterY = outerElement.y + outerElement.height / 2;

        let lineY = outerCenterY;
        if (outerCenterY < bbox.y) {
          lineY = bbox.y;
        } else if (outerCenterY > bbox.y + bbox.height) {
          lineY = bbox.y + bbox.height;
        }

        const isDiagonal = lineY !== outerCenterY;

        if (isDiagonal) {
          outerVisualizations.push(
            <line
              key={`outer-left-guide-${key}`}
              x1={outerRightX}
              y1={outerCenterY}
              x2={outerRightX}
              y2={lineY}
              stroke="rgb(255, 105, 180)"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.7}
              style={{ pointerEvents: 'none' }}
            />
          );
        }

        outerVisualizations.push(
          <PaddingArrow
            key={`outer-left-${key}`}
            x1={outerRightX}
            y1={lineY}
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

      // --- margin-right ---
      if (marginRight !== '0') {
        const outerLeftX = outerElement.x;
        const outerCenterY = outerElement.y + outerElement.height / 2;

        let lineY = outerCenterY;
        if (outerCenterY < bbox.y) {
          lineY = bbox.y;
        } else if (outerCenterY > bbox.y + bbox.height) {
          lineY = bbox.y + bbox.height;
        }

        const isDiagonal = lineY !== outerCenterY;

        if (isDiagonal) {
          outerVisualizations.push(
            <line
              key={`outer-right-guide-${key}`}
              x1={outerLeftX}
              y1={outerCenterY}
              x2={outerLeftX}
              y2={lineY}
              stroke="rgb(255, 105, 180)"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.7}
              style={{ pointerEvents: 'none' }}
            />
          );
        }

        outerVisualizations.push(
          <PaddingArrow
            key={`outer-right-${key}`}
            x1={bbox.x + bbox.width}
            y1={lineY}
            x2={outerLeftX}
            y2={lineY}
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


    // Визуализация Array паттерна (item_pattern + item_count + gap)
  const arrayVisualizations: JSX.Element[] = [];

  if (pattern.kind === 'array' && pattern.item_pattern && isFocusMode) {
    const direction = (pattern as any).direction || 'row';
    const logicalGap = pattern.gap;
    const visualGap = logicalGap != '0' ? ARRAY_VISUAL_GAP_PX : 0;
    const count = getArrayItemsToDraw((pattern as any).item_count);

    // 🔹 Статический размер item'а
    const itemW = ARRAY_ITEM_WIDTH;
    const itemH = ARRAY_ITEM_HEIGHT;

    const itemRects: ArrayItemRect[] = layoutArrayItemsRaw(
      bbox.x,
      bbox.y,
      itemW,
      itemH,
      direction as 'row' | 'column' | 'fill',
      count,
      visualGap
    );

    if (itemRects.length > 0) {
      // 🔹 Реальный паттерн элемента массива
      const itemKind = arrayItemPattern?.kind;
      const itemName = pattern.item_pattern || 'item-pattern';

      const baseColor = getColorByKind(itemKind);
      const fillColor = baseColor + '66'; // как у невыбранного элемента
      const strokeColor = baseColor;
      const kindLabel = itemKind || 'item';

      itemRects.forEach((rect, index) => {
        arrayVisualizations.push(
          <g
            key={`array-item-${index}`}
            onMouseEnter={handleArrayItemMouseEnter(index)}
            onMouseLeave={handleArrayItemMouseLeave}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Основной прямоугольник, как в ElementShape */}
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={6}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />

            {/* Название элемента слева */}
            <text
              x={rect.x + 10}
              y={rect.y + 24}
              fontSize={14}
              fontWeight="bold"
              fill="#1f2937"
              pointerEvents="none"
            >
              {itemName}
            </text>

            {/* Бейдж типа справа сверху */}
            <rect
              x={rect.x + rect.width - 50}
              y={rect.y + 5}
              width={45}
              height={20}
              fill="white"
              rx={4}
              opacity={0.9}
              pointerEvents="none"
            />
            <text
              x={rect.x + rect.width - 48}
              y={rect.y + 18}
              fontSize={10}
              fill="#6b7280"
              pointerEvents="none"
            >
              {kindLabel}
            </text>
          </g>
        );
      });

      // ───────────── стрелки gap по hover ─────────────
      if (
        hoveredArrayItem !== null &&
        logicalGap != "0" &&
        itemRects.length > 1 &&
        hoveredArrayItem >= 0 &&
        hoveredArrayItem < itemRects.length
      ) {
        const from = itemRects[hoveredArrayItem];

        const isFillPyramid =
          direction === 'fill' && itemRects.length === 3;

        let neighbors: number[] = [];

        if (isFillPyramid && logicalGap != "0" && itemRects.length === 3) {
          // Спец-кейс: fill + 3 + gap -> соединяем "все со всеми, кроме себя"
          neighbors = [0, 1, 2].filter((i) => i !== hoveredArrayItem);
        } else {
          // Общий случай как раньше — только соседние по индексу
          if (hoveredArrayItem - 1 >= 0) neighbors.push(hoveredArrayItem - 1);
          if (hoveredArrayItem + 1 < itemRects.length)
            neighbors.push(hoveredArrayItem + 1);
        }

        neighbors.forEach((idx) => {
        const to = itemRects[idx];

        const arrowSize = 6;

        const makeArrowHead = (
          tipX: number,
          tipY: number,
          dx: number,
          dy: number
        ) => {
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;

          const perpX = -uy;
          const perpY = ux;

          const baseX = tipX - ux * arrowSize;
          const baseY = tipY - uy * arrowSize;

          const leftX = baseX + perpX * (arrowSize / 2);
          const leftY = baseY + perpY * (arrowSize / 2);
          const rightX = baseX - perpX * (arrowSize / 2);
          const rightY = baseY - perpY * (arrowSize / 2);

          return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
        };

        // ─────────────────────
        // Спец-кейс: fill + 3 (пирамидка)
        // ─────────────────────
        if (isFillPyramid) {
          // Определяем, в одном ли ряду прямоугольники
          const sameRow = Math.abs(from.y - to.y) < 1;

          if (sameRow) {
            // Нижний ряд: чисто горизонтальная стрелка между левым и правым
            const left = from.x <= to.x ? from : to;
            const right = from.x <= to.x ? to : from;

            const startX = left.x + left.width;
            const startY = left.y + left.height / 2;
            const endX = right.x;
            const endY = right.y + right.height / 2;

            const dx = endX - startX;
            const dy = endY - startY;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            arrayVisualizations.push(
              <g
                key={`array-gap-arrow-${hoveredArrayItem}-${idx}`}
                style={{ pointerEvents: 'none' }}
              >
                {/* основная горизонтальная линия */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#4b5563"
                  strokeWidth={1.5}
                />
                {/* стрелка к соседу */}
                <polygon
                  points={makeArrowHead(endX, endY, dx, dy)}
                  fill="#4b5563"
                />
                {/* стрелка обратно к текущему */}
                <polygon
                  points={makeArrowHead(startX, startY, -dx, -dy)}
                  fill="#4b5563"
                />
                <text
                  x={midX}
                  y={midY - 6}
                  fontSize={11}
                  fill="#4b5563"
                  textAnchor="middle"
                >
                  gap: {logicalGap}
                </text>
              </g>
            );

            return;
          }

          // Разные ряды: верхний и нижний элемент.
          const upper = from.y < to.y ? from : to;
          const lower = from.y < to.y ? to : from;

          // Берём точки на нижней границе верхнего и верхней границе нижнего (по центру)
          const upperEdgeX = upper.x + upper.width / 2;
          const upperEdgeY = upper.y + upper.height;
          const lowerEdgeX = lower.x + lower.width / 2;
          const lowerEdgeY = lower.y;

          // Общая вертикаль, к которой выходим — середина между проекциями
          const midX = (upperEdgeX + lowerEdgeX) / 2;

          const upperProjX = midX;
          const upperProjY = upperEdgeY;
          const lowerProjX = midX;
          const lowerProjY = lowerEdgeY;

          // Пунктир только до перпендикуляра (горизонтальное выравнивание)
          arrayVisualizations.push(
            <g
              key={`array-gap-arrow-guide-${hoveredArrayItem}-${idx}`}
              style={{ pointerEvents: 'none' }}
            >
              {/* от верхнего элемента до вертикали */}
              <line
                x1={upperEdgeX}
                y1={upperEdgeY}
                x2={upperProjX}
                y2={upperProjY}
                stroke="#4b5563"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
              {/* от нижнего элемента до вертикали */}
              <line
                x1={lowerEdgeX}
                y1={lowerEdgeY}
                x2={lowerProjX}
                y2={lowerProjY}
                stroke="#4b5563"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            </g>
          );

          // Основная вертикальная линия со стрелками на концах
          const startX = upperProjX;
          const startY = upperProjY;
          const endX = lowerProjX;
          const endY = lowerProjY;

          const dx = endX - startX;
          const dy = endY - startY;

          const midLabelX = (startX + endX) / 2;
          const midLabelY = (startY + endY) / 2;

          arrayVisualizations.push(
            <g
              key={`array-gap-arrow-${hoveredArrayItem}-${idx}`}
              style={{ pointerEvents: 'none' }}
            >
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#4b5563"
                strokeWidth={1.5}
              />
              {/* стрелка к нижнему */}
              <polygon
                points={makeArrowHead(endX, endY, dx, dy)}
                fill="#4b5563"
              />
              {/* стрелка обратно к верхнему */}
              <polygon
                points={makeArrowHead(startX, startY, -dx, -dy)}
                fill="#4b5563"
              />
              <text
                x={midLabelX}
                y={midLabelY - 6}
                fontSize={11}
                fill="#4b5563"
                textAnchor="middle"
              >
                gap: {logicalGap}
              </text>
            </g>
          );

          return;
        }

        // ─────────────────────
        // Общий кейс (row / column / fill != 3) — как раньше
        // ─────────────────────
        const fromCx = from.x + from.width / 2;
        const fromCy = from.y + from.height / 2;
        const toCx = to.x + to.width / 2;
        const toCy = to.y + to.height / 2;

        const vertical =
          Math.abs(toCy - fromCy) > Math.abs(toCx - fromCx);

        let startX: number;
        let startY: number;
        let endX: number;
        let endY: number;

        if (vertical) {
          if (fromCy <= toCy) {
            startX = fromCx;
            startY = from.y + from.height;
            endX = toCx;
            endY = to.y;
          } else {
            startX = fromCx;
            startY = from.y;
            endX = toCx;
            endY = to.y + to.height;
          }
        } else {
          if (fromCx <= toCx) {
            startX = from.x + from.width;
            startY = fromCy;
            endX = to.x;
            endY = toCy;
          } else {
            startX = from.x;
            startY = fromCy;
            endX = to.x + to.width;
            endY = toCy;
          }
        }

        const dx = endX - startX;
        const dy = endY - startY;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        arrayVisualizations.push(
          <g
            key={`array-gap-arrow-${hoveredArrayItem}-${idx}`}
            style={{ pointerEvents: 'none' }}
          >
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#4b5563"
              strokeWidth={1.5}
            />
            {/* стрелка к соседу */}
            <polygon
              points={makeArrowHead(endX, endY, dx, dy)}
              fill="#4b5563"
            />
            {/* стрелка обратно к текущему */}
            <polygon
              points={makeArrowHead(startX, startY, -dx, -dy)}
              fill="#4b5563"
            />
            <text
              x={midX}
              y={midY - 6}
              fontSize={11}
              fill="#4b5563"
              textAnchor="middle"
            >
              gap: {logicalGap}
            </text>
          </g>
        );
      });

      }
    }
  }








  return (
    <g
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ pointerEvents: draggingHandle ? 'all' : 'none' }}
    >
      {outerVisualizations}

      {/* Чёрная граница */}
      <rect
        x={bbox.x}
        y={bbox.y}
        width={bbox.width}
        height={bbox.height}
        fill="transparent"
        stroke="black"
        strokeWidth={isFocusMode ? 4 : 3}
        strokeDasharray={isFocusMode ? 'none' : '5,5'}
        style={{ pointerEvents: 'none' }}
      />

      {innerVisualizations}

      {arrayVisualizations}

      {/* Ручки для изменения границы в режиме фокуса */}
      {isFocusMode && onUpdateBoundingBox && pattern.kind !== 'array' && (
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
  value: string;
  label: string;
  color: string;
  onMouseDown: (e: React.MouseEvent) => void;
  isFocusMode: boolean;
}

const PaddingArrow: React.FC<PaddingArrowProps> = ({
  x1,
  y1,
  x2,
  y2,
  value,
  label,
  color,
  onMouseDown,
  isFocusMode
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const arrowSize = 8;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const isShort = length < 60;

  let textX = midX;
  let textY = midY - 5;
  let textRotation = 0;
  let showLeaderLine = false;

  if (isShort) {
    showLeaderLine = true;

    const perpAngle = angle + Math.PI / 2;
    const leaderLength = 30;

    textX = midX + Math.cos(perpAngle) * leaderLength;
    textY = midY + Math.sin(perpAngle) * leaderLength;

    textRotation = (angle * 180) / Math.PI;
    if (textRotation > 90) textRotation -= 180;
    if (textRotation < -90) textRotation += 180;
  } else {
    textX = midX + 15;
    textY = midY - 5;
  }

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={onMouseDown}
      style={{
        cursor: isFocusMode ? 'not-allowed' : 'pointer',
        pointerEvents: 'all'
      }}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={20} />

      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isHovered ? 3 : 2}
      />

      <polygon
        points={`${x1},${y1} ${
          x1 + arrowSize * Math.cos(angle + Math.PI / 6)
        },${y1 + arrowSize * Math.sin(angle + Math.PI / 6)} ${
          x1 + arrowSize * Math.cos(angle - Math.PI / 6)
        },${y1 + arrowSize * Math.sin(angle - Math.PI / 6)}`}
        fill={color}
      />

      <polygon
        points={`${x2},${y2} ${
          x2 - arrowSize * Math.cos(angle + Math.PI / 6)
        },${y2 - arrowSize * Math.sin(angle + Math.PI / 6)} ${
          x2 - arrowSize * Math.cos(angle - Math.PI / 6)
        },${y2 - arrowSize * Math.sin(angle - Math.PI / 6)}`}
        fill={color}
      />

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

interface BoundaryHandleProps {
  x: number;
  y: number;
  cursor: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

const BoundaryHandle: React.FC<BoundaryHandleProps> = ({
  x,
  y,
  cursor,
  onMouseDown
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={onMouseDown}
      style={{ cursor, pointerEvents: 'all' }}
    >
      <circle cx={x} cy={y} r={12} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={isHovered ? 6 : 5}
        fill="white"
        stroke="black"
        strokeWidth={2}
      />
      <circle cx={x} cy={y} r={2} fill="black" />
    </g>
  );
};
