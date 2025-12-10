import React, { useState } from 'react';

type ResizeSide =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

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
  onSelect: (altKey: boolean) => void;
  onMakeActive?: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onResize?: (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  isInFocusMode?: boolean;
  displayName?: string;
  hasActiveElement?: boolean;
}

export const ElementShape: React.FC<ElementShapeProps> = ({
  element,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onHoverEnd,
  onPositionChange,
  onResize,
  isInFocusMode = false,
  displayName
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);

  const getColorByKind = (kind: string) => {
    const colors: Record<string, string> = {
      cell: '#3b82f6',
      area: '#10b981',
      array: '#f59e0b'
    };
    return colors[kind] || '#6b7280';
  };

  /* ====== DRAG (перетаскивание) только по прямоугольнику ====== */
  const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();

    if (!isSelected) return;

    const target = e.currentTarget as SVGGraphicsElement;
    const svg = target.ownerSVGElement;
    const ctm = target.getScreenCTM();
    if (!svg || !ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const localP = pt.matrixTransform(ctm.inverse());

    const initialOffset = {
      x: localP.x - element.x,
      y: localP.y - element.y
    };

    setIsDragging(true);
    setDragStarted(false);

    let hasMoved = false;

    const handleGlobalMouseMove = (globalE: MouseEvent) => {
      globalE.preventDefault();
      if (!svg || !ctm) return;

      const ptMove = svg.createSVGPoint();
      ptMove.x = globalE.clientX;
      ptMove.y = globalE.clientY;

      const localMoveP = ptMove.matrixTransform(ctm.inverse());

      const newX = localMoveP.x - initialOffset.x;
      const newY = localMoveP.y - initialOffset.y;

      if (Math.abs(newX - element.x) > 1 || Math.abs(newY - element.y) > 1) {
        hasMoved = true;
        setDragStarted(true);
      }

      if (onPositionChange) {
        onPositionChange(element.id, newX, newY);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);

      if (!hasMoved) {
        setDragStarted(false);
      }

      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (dragStarted) {
      setDragStarted(false);
      return;
    }

    onSelect(e.altKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isInFocusMode && element.kind !== 'cell') {
      onSelect(false);
    }
  };

  /* ====== RESIZE (8 ручек) ====== */
  const handleResizeMouseDown = (
    e: React.MouseEvent<SVGCircleElement>,
    side: ResizeSide
  ) => {
    if (!onResize) return;

    e.stopPropagation();
    e.preventDefault();

    const target = e.currentTarget as SVGGraphicsElement;
    const svg = target.ownerSVGElement;
    const ctm = target.getScreenCTM();
    if (!svg || !ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const startLocal = pt.matrixTransform(ctm.inverse());

    const startRect = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height
    };

    const MIN_W = 40;
    const MIN_H = 30;

    const handleGlobalMouseMove = (globalE: MouseEvent) => {
      globalE.preventDefault();
      if (!svg || !ctm) return;

      const ptMove = svg.createSVGPoint();
      ptMove.x = globalE.clientX;
      ptMove.y = globalE.clientY;
      const localMove = ptMove.matrixTransform(ctm.inverse());

      const deltaX = localMove.x - startLocal.x;
      const deltaY = localMove.y - startLocal.y;

      let { x, y, width, height } = startRect;

      switch (side) {
        case 'bottom-right':
          width = startRect.width + deltaX;
          height = startRect.height + deltaY;
          break;
        case 'bottom-left':
          x = startRect.x + deltaX;
          width = startRect.width - deltaX;
          height = startRect.height + deltaY;
          break;
        case 'top-right':
          y = startRect.y + deltaY;
          height = startRect.height - deltaY;
          width = startRect.width + deltaX;
          break;
        case 'top-left':
          x = startRect.x + deltaX;
          width = startRect.width - deltaX;
          y = startRect.y + deltaY;
          height = startRect.height - deltaY;
          break;
        case 'right':
          width = startRect.width + deltaX;
          break;
        case 'left':
          x = startRect.x + deltaX;
          width = startRect.width - deltaX;
          break;
        case 'bottom':
          height = startRect.height + deltaY;
          break;
        case 'top':
          y = startRect.y + deltaY;
          height = startRect.height - deltaY;
          break;
      }

      if (width < MIN_W) {
        const diff = MIN_W - width;
        width = MIN_W;
        if (side === 'left' || side === 'top-left' || side === 'bottom-left') {
          x -= diff;
        }
      }

      if (height < MIN_H) {
        const diff = MIN_H - height;
        height = MIN_H;
        if (side === 'top' || side === 'top-left' || side === 'top-right') {
          y -= diff;
        }
      }

      onResize(element.id, {
        x,
        y,
        width,
        height
      });
    };

    const handleGlobalMouseUp = () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const color = getColorByKind(element.kind);
  const fillColor = isSelected ? color : color + '66';
  const strokeColor = isSelected ? '#1e40af' : color;
  const strokeWidth = isSelected ? 3 : 2;

  const cursor = isDragging ? 'grabbing' : isSelected ? 'grab' : 'pointer';
  const pointerEvents = 'auto';
  const elementDisplayName = displayName || element.name;

  const cxLeft = element.x;
  const cxRight = element.x + element.width;
  const cyTop = element.y;
  const cyBottom = element.y + element.height;
  const cxMid = element.x + element.width / 2;
  const cyMid = element.y + element.height / 2;

  const handleRadiusOuter = 16;
  const handleRadius = 3;

  return (
    <g
      className="element-shape"
      style={{ cursor, pointerEvents }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >

      {/* Drag только за прямоугольник */}
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rx={6}
        filter={isHovered ? 'url(#shadow)' : undefined}
        onMouseDown={handleMouseDown}
      />

      <text
        x={element.x + 10}
        y={element.y + 24}
        fontSize={14}
        fontWeight="bold"
        fill="#1f2937"
        pointerEvents="none"
      >
        {elementDisplayName}
      </text>

      <rect
        x={element.x + element.width - 50}
        y={element.y + 5}
        width={45}
        height={20}
        fill="white"
        rx={4}
        opacity={0.9}
        pointerEvents="none"
      />
      <text
        x={element.x + element.width - 48}
        y={element.y + 18}
        fontSize={10}
        fill="#6b7280"
        pointerEvents="none"
      >
        {element.kind}
      </text>

      {isSelected && !isDragging && (
        <g pointerEvents="none">
          <circle
            cx={element.x + element.width / 2}
            cy={element.y + 10}
            r={3}
            fill="#1e40af"
            opacity={0.6}
          />
          <circle
            cx={element.x + element.width / 2 - 8}
            cy={element.y + 10}
            r={2}
            fill="#1e40af"
            opacity={0.4}
          />
          <circle
            cx={element.x + element.width / 2 + 8}
            cy={element.y + 10}
            r={2}
            fill="#1e40af"
            opacity={0.4}
          />
        </g>
      )}

      {/* 8 ручек ресайза только для выбранного элемента */}
      {isSelected && onResize && (
        <g>
          {/* Угловые */}
          <g style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxLeft}
              cy={cyTop}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
            />
            <circle
              cx={cxLeft}
              cy={cyTop}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          <g style={{ cursor: 'nesw-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxRight}
              cy={cyTop}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
            />
            <circle
              cx={cxRight}
              cy={cyTop}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          <g style={{ cursor: 'nesw-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxLeft}
              cy={cyBottom}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
            />
            <circle
              cx={cxLeft}
              cy={cyBottom}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          <g style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxRight}
              cy={cyBottom}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
            />
            <circle
              cx={cxRight}
              cy={cyBottom}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          {/* Боковые */}
          <g style={{ cursor: 'ns-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxMid}
              cy={cyTop}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'top')}
            />
            <circle
              cx={cxMid}
              cy={cyTop}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          <g style={{ cursor: 'ns-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxMid}
              cy={cyBottom}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
            />
            <circle
              cx={cxMid}
              cy={cyBottom}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          <g style={{ cursor: 'ew-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxLeft}
              cy={cyMid}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
            />
            <circle
              cx={cxLeft}
              cy={cyMid}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>

          <g style={{ cursor: 'ew-resize', pointerEvents: 'all' }}>
            <circle
              cx={cxRight}
              cy={cyMid}
              r={handleRadiusOuter}
              fill="transparent"
              onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
            />
            <circle
              cx={cxRight}
              cy={cyMid}
              r={handleRadius}
              fill="white"
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>
        </g>
      )}
    </g>
  );
};
