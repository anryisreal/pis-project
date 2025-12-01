import React, { useState } from 'react';

interface ElementShapeProps {
  element: {
    id: string;
    name: string;
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
  isInFocusMode?: boolean;
  isMainSelected?: boolean;
}

export const ElementShape: React.FC<ElementShapeProps> = ({
                                                            element,
                                                            isSelected,
                                                            isHovered,
                                                            onSelect,
                                                            onHover,
                                                            onHoverEnd,
                                                            onPositionChange,
                                                            isInFocusMode = false,
                                                            isMainSelected = false
                                                          }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const getColorByKind = (kind: string) => {
    const colors: Record<string, string> = {
      'cell': '#3b82f6',
      'area': '#10b981',
      'array': '#f59e0b'
    };
    return colors[kind] || '#6b7280';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // В режиме фокуса разрешаем перетаскивание только для главного выбранного элемента
    if (isInFocusMode && !isMainSelected) {
      return;
    }

    if (!isSelected) {
      onSelect();
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    setDragOffset({
      x: svgP.x - element.x,
      y: svgP.y - element.y
    });

    const handleGlobalMouseMove = (globalE: MouseEvent) => {
      globalE.preventDefault();

      const svg = (e.target as SVGElement).ownerSVGElement;
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = globalE.clientX;
      pt.y = globalE.clientY;

      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      const newX = svgP.x - dragOffset.x;
      const newY = svgP.y - dragOffset.y;

      if (onPositionChange) {
        onPositionChange(element.id, newX, newY);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleMouseMove = () => {};
  const handleMouseUp = () => {};

  const color = getColorByKind(element.kind);
  const fillColor = isSelected ? color : color + '66';
  const strokeColor = isSelected ? '#1e40af' : color;
  const strokeWidth = isSelected ? 3 : 2;

  // В режиме фокуса inner/outer элементы не перетаскиваются
  const canDrag = !isInFocusMode || isMainSelected;
  const cursor = isDragging ? 'grabbing' : (canDrag && isSelected ? 'grab' : 'pointer');

  return (
    <g
      className="element-shape"
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor }}
    >
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rx="6"
        filter={isHovered ? 'url(#shadow)' : undefined}
      />

      <text
        x={element.x + 10}
        y={element.y + 24}
        fontSize="14"
        fontWeight="bold"
        fill="#1f2937"
        pointerEvents="none"
      >
        {element.name}
      </text>

      <rect
        x={element.x + element.width - 50}
        y={element.y + 5}
        width="45"
        height="20"
        fill="white"
        rx="4"
        opacity="0.9"
        pointerEvents="none"
      />
      <text
        x={element.x + element.width - 48}
        y={element.y + 18}
        fontSize="10"
        fill="#6b7280"
        pointerEvents="none"
      >
        {element.kind}
      </text>

      {isSelected && !isDragging && canDrag && (
        <g pointerEvents="none">
          <circle cx={element.x + element.width / 2} cy={element.y + 10} r="3" fill="#1e40af" opacity="0.6" />
          <circle cx={element.x + element.width / 2 - 8} cy={element.y + 10} r="2" fill="#1e40af" opacity="0.4" />
          <circle cx={element.x + element.width / 2 + 8} cy={element.y + 10} r="2" fill="#1e40af" opacity="0.4" />
        </g>
      )}

      {/* Индикатор что элемент заблокирован в режиме фокуса */}
      {isInFocusMode && !isMainSelected && (
        <g pointerEvents="none">
          <rect
            x={element.x + 5}
            y={element.y + element.height - 25}
            width="20"
            height="20"
            fill="rgba(0,0,0,0.7)"
            rx="3"
          />
          <text
            x={element.x + 15}
            y={element.y + element.height - 11}
            fontSize="12"
            fill="white"
            textAnchor="middle"
          >
            🔒
          </text>
        </g>
      )}
    </g>
  );
};