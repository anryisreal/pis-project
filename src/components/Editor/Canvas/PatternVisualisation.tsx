import React, { useState } from 'react';
import type { Pattern, LocationObject } from '../../../models/Pattern';
import { useEditorStore } from '../../../hooks/useStores';

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
                                                                            isFocusMode,
                                                                            hoveredInnerOuterElement,
                                                                            onUpdateLocation,
                                                                            allElements = [],
                                                                            showBorderOnly = false
                                                                          }) => {
  const editorStore = useEditorStore();
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

  const bbox = calculateBoundingBox();

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

  // INNER элементы (padding)
  if (pattern.inner) {
    Object.entries(pattern.inner).forEach(([key, innerPattern]) => {
      if (!innerPattern.pattern) return;

      const innerElement = findElement(innerPattern.pattern);
      if (!innerElement) return;

      // Показываем стрелки только если этот элемент наведен
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

      // Показываем стрелки только если этот элемент наведен
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

      {/* Черная граница - ЗАФИКСИРОВАНА в режиме фокуса */}
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

      {/* Обработчики наведения для inner/outer элементов */}
      {pattern.inner && Object.values(pattern.inner).map((innerPattern) => {
        if (!innerPattern.pattern) return null;
        const innerElement = findElement(innerPattern.pattern);
        if (!innerElement) return null;

        return (
          <rect
            key={`hover-inner-${innerPattern.pattern}`}
            x={innerElement.x}
            y={innerElement.y}
            width={innerElement.width}
            height={innerElement.height}
            fill="transparent"
            style={{ pointerEvents: 'all' }}
            onMouseEnter={() => editorStore.setHoveredInnerOuterElement(innerPattern.pattern!)}
            onMouseLeave={() => editorStore.setHoveredInnerOuterElement(null)}
          />
        );
      })}

      {pattern.outer && Object.values(pattern.outer).map((outerPattern) => {
        if (!outerPattern.pattern) return null;
        const outerElement = findElement(outerPattern.pattern);
        if (!outerElement) return null;

        return (
          <rect
            key={`hover-outer-${outerPattern.pattern}`}
            x={outerElement.x}
            y={outerElement.y}
            width={outerElement.width}
            height={outerElement.height}
            fill="transparent"
            style={{ pointerEvents: 'all' }}
            onMouseEnter={() => editorStore.setHoveredInnerOuterElement(outerPattern.pattern)}
            onMouseLeave={() => editorStore.setHoveredInnerOuterElement(null)}
          />
        );
      })}
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

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={onMouseDown}
      style={{ cursor: isFocusMode ? 'not-allowed' : 'pointer', pointerEvents: 'all' }}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={20}
      />

      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isHovered ? 3 : 2}
      />

      <polygon
        points={`${x1},${y1} ${x1 + arrowSize * Math.cos(angle + Math.PI / 6)},${y1 + arrowSize * Math.sin(angle + Math.PI / 6)} ${x1 + arrowSize * Math.cos(angle - Math.PI / 6)},${y1 + arrowSize * Math.sin(angle - Math.PI / 6)}`}
        fill={color}
      />

      <polygon
        points={`${x2},${y2} ${x2 - arrowSize * Math.cos(angle + Math.PI / 6)},${y2 - arrowSize * Math.sin(angle + Math.PI / 6)} ${x2 - arrowSize * Math.cos(angle - Math.PI / 6)},${y2 - arrowSize * Math.sin(angle - Math.PI / 6)}`}
        fill={color}
      />

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