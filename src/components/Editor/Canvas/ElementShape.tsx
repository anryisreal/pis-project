import React, { useState } from 'react';
import { useEditorStore } from '../../../hooks/useStores';

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
  onMakeActive?: () => void; // ✅ Прямая активация без меню (для mousedown)
  onHover: () => void;
  onHoverEnd: () => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
  isInFocusMode?: boolean;
  displayName?: string;
  hasActiveElement?: boolean;
}

export const ElementShape: React.FC<ElementShapeProps> = ({
                                                            element,
                                                            isSelected,
                                                            isHovered,
                                                            onSelect,
                                                            onMakeActive,
                                                            onHover,
                                                            onHoverEnd,
                                                            onPositionChange,
                                                            isInFocusMode = false,
                                                            displayName,
                                                            hasActiveElement = false
                                                          }) => {
  const editorStore = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [justMadeActive, setJustMadeActive] = useState(false); // ✅ Флаг активации

  const getColorByKind = (kind: string) => {
    const colors: Record<string, string> = {
      'cell': '#3b82f6',
      'area': '#10b981',
      'array': '#f59e0b'
    };
    return colors[kind] || '#6b7280';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('=== ElementShape handleMouseDown ===');
    console.log('element.id:', element.id);
    console.log('isSelected:', isSelected);
    console.log('isInFocusMode:', isInFocusMode);
    console.log('hasActiveElement:', hasActiveElement);

    e.stopPropagation();
    // ✅ НЕ вызываем preventDefault - это блокирует onClick

    // ✅ В режиме фокуса: если элемент неактивный, делаем его активным БЕЗ меню
    if (isInFocusMode && !isSelected && onMakeActive) {
      console.log('✅ Making element active (not selected in focus mode)');
      // Вызываем onMakeActive для прямой активации без проверки перекрытий
      onMakeActive();
      setJustMadeActive(true); // ✅ Блокируем следующий onClick
      return; // Не начинаем перетаскивание, ждём следующего клика
    }

    // Если элемент уже выбран, начинаем перетаскивание
    if (isSelected) {
      console.log('✅ Starting drag');
      const svg = (e.target as SVGElement).ownerSVGElement;
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;

      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      // Вычисляем offset относительно ТЕКУЩЕЙ позиции элемента
      const initialOffset = {
        x: svgP.x - element.x,
        y: svgP.y - element.y
      };

      setIsDragging(true);
      // ✅ ИСПРАВЛЕНИЕ: dragStarted ставим в false сначала
      setDragStarted(false);

      let hasMoved = false; // Флаг реального перемещения

      const handleGlobalMouseMove = (globalE: MouseEvent) => {
        globalE.preventDefault();

        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = globalE.clientX;
        pt.y = globalE.clientY;

        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const newX = svgP.x - initialOffset.x;
        const newY = svgP.y - initialOffset.y;

        // ✅ Если была хоть какая-то дельта - это реальное перетаскивание
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

        // ✅ Если не было движения - НЕ считаем это перетаскиванием
        if (!hasMoved) {
          setDragStarted(false);
        }
        // Иначе dragStarted останется true и onClick его сбросит

        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      console.log('❌ NOT starting drag - isSelected is false');
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    console.log('=== ElementShape handleClick ===');
    console.log('element.id:', element.id);
    console.log('element.kind:', element.kind);
    console.log('dragStarted:', dragStarted);
    console.log('justMadeActive:', justMadeActive);
    console.log('isInFocusMode:', isInFocusMode);
    console.log('isSelected:', isSelected);

    e.stopPropagation();

    // Если было перетаскивание - игнорируем клик
    if (dragStarted) {
      console.log('❌ Ignoring click - was dragging');
      setDragStarted(false);
      return;
    }

    // ✅ Если только что сделали активным - игнорируем клик
    if (justMadeActive) {
      console.log('❌ Ignoring click - just made active');
      setJustMadeActive(false);
      return;
    }

    // ✅ ИСПРАВЛЕНИЕ: Вызываем onSelect всегда (убрали проверку isInFocusMode)
    // Это нужно для показа меню перекрытий в режиме фокуса
    console.log('✅ About to call onSelect()');
    onSelect();
    console.log('✅ onSelect() called');
  };

  const color = getColorByKind(element.kind);
  // ✅ Непрозрачные: выбранные ИЛИ inner элементы в режиме фокуса
  const fillColor = isSelected ? color : color + '66';
  const strokeColor = isSelected ? '#1e40af' : color;
  const strokeWidth = isSelected ? 3 : 2;

  const cursor = isDragging ? 'grabbing' : (isSelected ? 'grab' : 'pointer');

  // ✅ В режиме фокуса: если есть активный элемент (не я) - пропускаю события вниз
  // Это позволяет кликать на нижний активный элемент через верхний неактивный
  const pointerEvents = (isInFocusMode && hasActiveElement && !isSelected) ? 'none' : 'auto';

  const elementDisplayName = displayName || element.name;

  return (
    <g
      className="element-shape"
      style={{
        cursor,
        pointerEvents // ✅ Пропускаем события через неактивные элементы к активному
      }}
      onMouseEnter={() => {
        onHover();
        if (isInFocusMode) {
          editorStore.setHoveredInnerOuterElement(element.name);
        }
      }}
      onMouseLeave={() => {
        onHoverEnd();
        if (isInFocusMode) {
          editorStore.setHoveredInnerOuterElement(null);
        }
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
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
        {elementDisplayName}
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

      {isSelected && !isDragging && (
        <g pointerEvents="none">
          <circle cx={element.x + element.width / 2} cy={element.y + 10} r="3" fill="#1e40af" opacity="0.6" />
          <circle cx={element.x + element.width / 2 - 8} cy={element.y + 10} r="2" fill="#1e40af" opacity="0.4" />
          <circle cx={element.x + element.width / 2 + 8} cy={element.y + 10} r="2" fill="#1e40af" opacity="0.4" />
        </g>
      )}
    </g>
  );
};