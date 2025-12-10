import React, { useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { ZoomIn, ZoomOut, Maximize2, Focus, X } from 'lucide-react';

import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';

import { OverlapManager } from './OverlapManager';
import { ElementShape } from './ElementShape';
import { PatternVisualization } from './PatternVisualisation';

import {
  AbstractPattern,
  AreaPattern,
  ArrayPattern,
  ComponentPattern,
  isAreaPattern
} from '../../../models/PatternClasses';
import type { Pattern, LocationObject } from '../../../models/Pattern';

const CELL_SIZE = 20;
const BASE_CELL_WIDTH = 200;
const BASE_CELL_HEIGHT = 120;

const clampZoom = (z: number) => Math.max(0.01, Math.min(3, z));


type ElementRole = 'parent' | 'inner' | 'outer' | 'inherit';

export type VisualElement = {
  id: string;
  name: string; // техническое имя (имя паттерна)
  pattern: AbstractPattern;
  kind: 'cell' | 'area' | 'array';
  role: ElementRole;
  parentName: string;
  componentKey?: string; // ключ компонента (inner/outer)
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EditorBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function makeComponentId(
  parentName: string,
  type: 'inner' | 'outer',
  key: string
) {
  return `${parentName}::${type}::${key}`;
}

function parseSize(sizeStr?: string): { width: number; height: number } | null {
  if (!sizeStr) return null;
  const parts = sizeStr.toLowerCase().split('x').map((s) => s.trim());
  if (parts.length !== 2) return null;

  const parseVal = (val: string) =>
    Math.max(1, parseInt(val.replace(/\D/g, ''), 10) || 1);

  return {
    width: parseVal(parts[0]) * CELL_SIZE,
    height: parseVal(parts[1]) * CELL_SIZE
  };
}

function parseLocationNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

const INHERIT_ARROW_SIZE = 12;

function getInheritanceArrowPoints(link: { x1: number; y1: number; x2: number; y2: number }): string {
  const dx = link.x2 - link.x1;
  const dy = link.y2 - link.y1;
  const angle = Math.atan2(dy, dx);
  const size = INHERIT_ARROW_SIZE;

  // вершина треугольника – ровно в точке родителя
  const tipX = link.x2;
  const tipY = link.y2;

  // центр основания – немного "назад" по линии (к ребёнку)
  const baseX = tipX - Math.cos(angle) * size;
  const baseY = tipY - Math.sin(angle) * size;

  // вектор, перпендикулярный линии, чтобы развести уголки основания
  const perpX = -Math.sin(angle) * (size * 0.6);
  const perpY =  Math.cos(angle) * (size * 0.6);

  const p1x = baseX + perpX;
  const p1y = baseY + perpY;
  const p2x = baseX - perpX;
  const p2y = baseY - perpY;

  // формат points для <polygon>
  return `${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`;
}



const parseNumber = (value: any): number | undefined => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    if (!isNaN(n)) return n;
  }
  return undefined;
};

export const CanvasStage: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const editorStore = useEditorStore();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingBackground, setIsDraggingBackground] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // позиции ВСЕХ визуальных id (родитель + компоненты)
  const [elementPositions, setElementPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  // Overlap-меню
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [showOverlapMenu, setShowOverlapMenu] = useState(false);
  const [overlappingElements, setOverlappingElements] = useState<string[]>([]);

  const overlapActiveRef = useRef(false);
  useEffect(() => {
    overlapActiveRef.current = showOverlapMenu;
  }, [showOverlapMenu]);

  const isFocusMode = editorStore.state.isFocusMode;
  const selectedId = editorStore.state.selectedElements[0] || null;

  // ТЕКУЩИЙ родительский паттерн (класс)
  const parentPattern: AbstractPattern | null = selectedId
    ? grammarStore.getPatternClass(selectedId)
    : null;

  const activeComponentId = editorStore.state.activeInnerElement;
  const hoveredInnerOuterElement = editorStore.state.hoveredInnerOuterElement;

  /* ===== ЗУМ колесиком (не работаем, если активно overlap-меню) ===== */
    /* ===== ЗУМ колесиком (zoom к курсору, не работаем, если активно overlap-меню) ===== */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      if (overlapActiveRef.current) return;

      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.95 : 1.05;

      // Делаем функциональный апдейт, чтобы иметь "старый" zoom,
      // и одновременно корректно обновить pan так, чтобы точка под курсором
      // осталась на месте в экранных координатах.
      setZoom((prevZoom) => {
        const newZoom = clampZoom(prevZoom * delta);

        // Если зум не изменился (упёрлись в лимит) — pan не пересчитываем
        if (newZoom === prevZoom) return prevZoom;

        setPan((prevPan) => {
          // При transform="translate(pan) scale(zoom)" имеем:
          // screen = (world + pan) * zoom
          //
          // Отсюда world = screen / zoom - pan
          // Хотим оставить screen неизменным:
          // screen = (world + pan') * newZoom
          //
          // => pan' = screen/newZoom - world
          //         = screen/newZoom - (screen/prevZoom - prevPan)
          //         = screen/newZoom - screen/prevZoom + prevPan
          const newPanX = mouseX / newZoom - mouseX / prevZoom + prevPan.x;
          const newPanY = mouseY / newZoom - mouseY / prevZoom + prevPan.y;

          return { x: newPanX, y: newPanY };
        });

        return newZoom;
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);


  /* ===== Панорамирование по пустому месту ===== */
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | SVGElement;
    const isElementShape = !!target.closest('.element-shape');

    if (!isElementShape) {
      editorStore.setActiveInnerElement(null);
      editorStore.setHoveredInnerOuterElement(null);

      setIsDraggingBackground(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDraggingBackground) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDraggingBackground(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.1));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCenterSelected = () => {
    if (!parentPattern || !svgRef.current) return;

    const parsedSize = parseSize(parentPattern.size || undefined);
    const parentWidth =
      parentPattern.editorBounds?.width || parsedSize?.width || BASE_CELL_WIDTH;
    const parentHeight =
      parentPattern.editorBounds?.height || parsedSize?.height || BASE_CELL_HEIGHT;

    const parentPos = elementPositions.get(parentPattern.name) || { x: 0, y: 0 };

    const bboxCenterX = parentPos.x + parentWidth / 2;
    const bboxCenterY = parentPos.y + parentHeight / 2;

    const svgRect = svgRef.current.getBoundingClientRect();
    const viewCenterX = svgRect.width / 2 / zoom;
    const viewCenterY = svgRect.height / 2 / zoom;

    setPan({
      x: (viewCenterX - bboxCenterX) * zoom,
      y: (viewCenterY - bboxCenterY) * zoom
    });
  };

  /* ===== ПОСТРОЕНИЕ visualElements (без useMemo — чтобы новые компоненты появлялись сразу) ===== */

  const innerIdsRef = useRef<Set<string>>(new Set());
  const outerIdsRef = useRef<Set<string>>(new Set());
  const idToMetaRef = useRef<Map<string, { type: 'inner' | 'outer'; key: string }>>(
    new Map()
  );

  innerIdsRef.current.clear();
  outerIdsRef.current.clear();
  idToMetaRef.current.clear();

  const visualElements: VisualElement[] = [];

  if (isFocusMode && parentPattern) {
    const parsedSize = parseSize(parentPattern.size || undefined);
    const parentWidth =
      parentPattern.editorBounds?.width || parsedSize?.width || BASE_CELL_WIDTH;
    const parentHeight =
      parentPattern.editorBounds?.height || parsedSize?.height || BASE_CELL_HEIGHT;

    const savedParentPos = elementPositions.get(parentPattern.name);
    const parentX = savedParentPos?.x ?? 100;
    const parentY = savedParentPos?.y ?? 100;

    // Родитель (рамка)
    visualElements.push({
      id: parentPattern.name,
      name: parentPattern.name,
      pattern: parentPattern,
      kind: parentPattern.kind,
      role: 'parent',
      parentName: parentPattern.name,
      x: parentX,
      y: parentY,
      width: parentWidth,
      height: parentHeight
    });

    if (isAreaPattern(parentPattern)) {
      const area = parentPattern as AreaPattern;

      // INNER
      let innerIndex = 0;
      area.inner.forEach((component, key) => {
        const compPattern = component.pattern;
        if (!compPattern) return;

        const id = makeComponentId(area.name, 'inner', key);
        innerIdsRef.current.add(id);
        idToMetaRef.current.set(id, { type: 'inner', key });

        const savedPos = elementPositions.get(id);

        const defaultX = parentX + 40 + (innerIndex % 2) * (parentWidth / 2);
        const defaultY =
          parentY + 40 + Math.floor(innerIndex / 2) * (BASE_CELL_HEIGHT + 20);

        const locationObj: LocationObject =
          component &&
          typeof component.location === 'object' &&
          !Array.isArray(component.location)
            ? (component.location as LocationObject)
            : {};

        // размеры компонента из location

        // позиция относительно родителя из location.top/left
        let initialX = defaultX;
        let initialY = defaultY;

        const locLeft = parseNumber(locationObj.left);
        const locTop = parseNumber(locationObj.top);

        if (locLeft !== undefined) {
          initialX = parentX + locLeft;
        }
        if (locTop !== undefined) {
          initialY = parentY + locTop;
        }

        // читаем width/height из location компонента
        let compWidth = BASE_CELL_WIDTH;
        let compHeight = BASE_CELL_HEIGHT;

        const locObj: LocationObject | null =
          component.location &&
          typeof component.location === 'object' &&
          !Array.isArray(component.location)
            ? (component.location as LocationObject)
            : null;

        const locW = parseLocationNumber(locObj?.width);
        const locH = parseLocationNumber(locObj?.height);

        if (locW && locW > 0) compWidth = locW;
        if (locH && locH > 0) compHeight = locH;

        visualElements.push({
          id,
          name: compPattern.name,
          pattern: compPattern,
          kind: compPattern.kind,
          role: 'inner',
          parentName: area.name,
          componentKey: key,
          x: savedPos?.x ?? initialX,
          y: savedPos?.y ?? initialY,
          width: compWidth,
          height: compHeight
        });


        innerIndex += 1;
      });

      // OUTER
      let outerIndex = 0;
      area.outer.forEach((component, key) => {
        const compPattern = component.pattern;
        if (!compPattern) return;

        const id = makeComponentId(area.name, 'outer', key);
        outerIdsRef.current.add(id);
        idToMetaRef.current.set(id, { type: 'outer', key });

        const savedPos = elementPositions.get(id);

        const ringOffset = 60 + outerIndex * 30;
        const defaultX = parentX - ringOffset;
        const defaultY = parentY - ringOffset;

        const locationObj: LocationObject =
          component &&
          typeof component.location === 'object' &&
          !Array.isArray(component.location)
            ? (component.location as LocationObject)
            : {};

        let initialX = defaultX;
        let initialY = defaultY;

        const locLeft = parseNumber(locationObj.left);
        const locTop = parseNumber(locationObj.top);

        if (locLeft !== undefined) {
          initialX = parentX + locLeft;
        }
        if (locTop !== undefined) {
          initialY = parentY + locTop;
        }

        let compWidth = BASE_CELL_WIDTH;
        let compHeight = BASE_CELL_HEIGHT;

        const locObj: LocationObject | null =
          component.location &&
          typeof component.location === 'object' &&
          !Array.isArray(component.location)
            ? (component.location as LocationObject)
            : null;

        const locW = parseLocationNumber(locObj?.width);
        const locH = parseLocationNumber(locObj?.height);

        if (locW && locW > 0) compWidth = locW;
        if (locH && locH > 0) compHeight = locH;

        visualElements.push({
          id,
          name: compPattern.name,
          pattern: compPattern,
          kind: compPattern.kind,
          role: 'outer',
          parentName: area.name,
          componentKey: key,
          x: savedPos?.x ?? initialX,
          y: savedPos?.y ?? initialY,
          width: compWidth,
          height: compHeight
        });


        outerIndex += 1;
      });
    }

        // ===== Наследование (extends) для cell-паттернов =====
    if (parentPattern.kind === 'cell') {
      // Берём сырые данные паттерна (с полем extends)
      const parentData = grammarStore.findPatternByName(parentPattern.name);
      const extendsList: string[] = Array.isArray((parentData as any)?.extends)
        ? ((parentData as any).extends as string[])
        : [];

      if (extendsList.length > 0) {
        type InheritBox = {
          name: string;
          pattern: AbstractPattern;
          width: number;
          height: number;
        };

        const inheritBoxes: InheritBox[] = [];

        extendsList.forEach((baseName) => {
          const basePatternData = grammarStore.findPatternByName(baseName);
          if (!basePatternData || basePatternData.kind !== 'cell') return;

          const basePatternClass = grammarStore.getPatternClass(baseName);
          if (!basePatternClass) return;

          const parsedBaseSize = parseSize(basePatternData.size || undefined);
          const baseWidth =
            basePatternData.editor_bounds?.width ||
            parsedBaseSize?.width ||
            BASE_CELL_WIDTH;
          const baseHeight =
            basePatternData.editor_bounds?.height ||
            parsedBaseSize?.height ||
            BASE_CELL_HEIGHT;

          inheritBoxes.push({
            name: baseName,
            pattern: basePatternClass,
            width: baseWidth,
            height: baseHeight
          });
        });

        if (inheritBoxes.length > 0) {
          const GAP_X = 40;
          const GAP_Y = 80;

          const maxHeight = inheritBoxes.reduce(
            (m, b) => Math.max(m, b.height),
            0
          );

          const totalWidth =
            inheritBoxes.reduce((sum, b) => sum + b.width, 0) +
            GAP_X * (inheritBoxes.length - 1);

          // Центруем ряд родителей над дочкой
          const startX = parentX + parentWidth / 2 - totalWidth / 2;
          const baseY = parentY - GAP_Y - maxHeight;

          let currentX = startX;

          inheritBoxes.forEach((box) => {
            const x = currentX;
            // Выравниваем все по одной "нижней линии"
            const y = baseY + (maxHeight - box.height);

            visualElements.push({
              id: `inherit::${parentPattern.name}::${box.name}`,
              name: box.name,
              pattern: box.pattern,
              kind: box.pattern.kind,
              role: 'inherit',
              parentName: parentPattern.name,
              x,
              y,
              width: box.width,
              height: box.height
            });

            currentX += box.width + GAP_X;
          });
        }
      }
    }

  }

  const parentElement = visualElements.find((el) => el.role === 'parent') || null;

  // Линии наследования: от текущей ячейки к её родителям (extends)
  const inheritanceLinks: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  if (parentElement && parentPattern?.kind === 'cell') {
    const childX = parentElement.x + parentElement.width / 2;
    const childY = parentElement.y;

    visualElements
      .filter((el) => el.role === 'inherit')
      .forEach((baseEl) => {
        inheritanceLinks.push({
          x1: childX,
          y1: childY,
          x2: baseEl.x + baseEl.width / 2,
          y2: baseEl.y + baseEl.height
        });
      });
  }


  const handleUpdateLocation = (
    patternName: string,
    type: 'inner' | 'outer',
    key: string,
    location: LocationObject
  ) => {
    if (type === 'inner') {
      grammarStore.updateInnerLocation(patternName, key, location);
    } else {
      grammarStore.updateOuterLocation(patternName, key, location);
    }
  };

  /* ===== Ресайз рамки родителя с учётом inner ===== */

  const prevParentBoxRef = useRef<EditorBounds | null>(null);

  const handleUpdateBoundingBox = (proposedBox: EditorBounds) => {
    if (!parentPattern) return;

    // 0️⃣ СНАПШОТИМ фактические позиции всех inner-компонентов (по visualElements)
    const innerSnapshot = new Map<string, { x: number; y: number }>();
    innerIdsRef.current.forEach((id) => {
      const el = visualElements.find((v) => v.id === id);
      if (!el) return;
      innerSnapshot.set(id, { x: el.x, y: el.y });
    });

    // 1️⃣ НОРМАЛИЗУЕМ входящий бокс
    let newBox: EditorBounds = {
      x: Math.round(proposedBox.x),
      y: Math.round(proposedBox.y),
      width: Math.max(50, Math.round(proposedBox.width)),
      height: Math.max(50, Math.round(proposedBox.height))
    };

    const prevBox = prevParentBoxRef.current;

    // 2️⃣ Ограничение: рамка не может "перерезать" inner-компоненты
    if (innerIdsRef.current.size > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      innerIdsRef.current.forEach((id) => {
        const el = visualElements.find((v) => v.id === id);
        if (!el) return;
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      });

      if (minX !== Infinity) {
        let right = newBox.x + newBox.width;
        let bottom = newBox.y + newBox.height;

        if (newBox.x > minX) {
          newBox.x = minX;
          right = Math.max(right, maxX);
          newBox.width = right - newBox.x;
        }

        if (right < maxX) {
          right = maxX;
          newBox.width = right - newBox.x;
        }

        if (newBox.y > minY) {
          newBox.y = minY;
          bottom = Math.max(bottom, maxY);
          newBox.height = bottom - newBox.y;
        }

        if (bottom < maxY) {
          bottom = maxY;
          newBox.height = bottom - newBox.y;
        }

        newBox = {
          x: Math.round(newBox.x),
          y: Math.round(newBox.y),
          width: Math.max(50, Math.round(newBox.width)),
          height: Math.max(50, Math.round(newBox.height))
        };
      }
    }

    prevParentBoxRef.current = newBox;

    // 4️⃣ Обновляем позицию родителя + возвращаем inner на место
    setElementPositions((prevMap) => {
      const next = new Map(prevMap);
      next.set(parentPattern.name, { x: newBox.x, y: newBox.y });

      innerSnapshot.forEach((pos, id) => {
        next.set(id, { x: pos.x, y: pos.y });
      });

      return next;
    });

    // 5️⃣ Сдвиг outer-компонентов (если есть предыдущее состояние бокса)
    if (prevBox) {
      const deltaLeft = newBox.x - prevBox.x;
      const deltaTop = newBox.y - prevBox.y;
      const deltaRight =
        newBox.x + newBox.width - (prevBox.x + prevBox.width);
      const deltaBottom =
        newBox.y + newBox.height - (prevBox.y + prevBox.height);

      const hasDelta =
        deltaLeft !== 0 || deltaRight !== 0 || deltaTop !== 0 || deltaBottom !== 0;

      if (hasDelta) {
        setElementPositions((prevMap) => {
          const next = new Map(prevMap);

          outerIdsRef.current.forEach((id) => {
            const outerElement = visualElements.find((el) => el.id === id);
            if (!outerElement) return;

            const currentPos =
              next.get(id) ?? { x: outerElement.x, y: outerElement.y };

            const centerX = currentPos.x + outerElement.width / 2;
            const centerY = currentPos.y + outerElement.height / 2;

            const prevLeft = prevBox.x;
            const prevRight = prevBox.x + prevBox.width;
            const prevTop = prevBox.y;
            const prevBottom = prevBox.y + prevBox.height;

            let shiftX = 0;
            let shiftY = 0;

            if (deltaLeft !== 0 && centerX <= prevLeft) shiftX += deltaLeft;
            if (deltaRight !== 0 && centerX >= prevRight) shiftX += deltaRight;
            if (deltaTop !== 0 && centerY <= prevTop) shiftY += deltaTop;
            if (deltaBottom !== 0 && centerY >= prevBottom) shiftY += deltaBottom;

            if (shiftX !== 0 || shiftY !== 0) {
              next.set(id, {
                x: currentPos.x + shiftX,
                y: currentPos.y + shiftY
              });
            }
          });

          innerSnapshot.forEach((pos, id) => {
            next.set(id, { x: pos.x, y: pos.y });
          });

          return next;
        });
      }
    }

    // 6️⃣ editor_bounds → GrammarStore (храним только ЦЕЛЫЕ width/height)
    grammarStore.updatePattern(parentPattern.name, {
      editor_bounds: {
        width: Math.round(newBox.width),
        height: Math.round(newBox.height)
      }
    });
  };

  /* ===== Перетаскивание компонентов (inner/outer) ===== */

  const handleElementPositionChange = (id: string, x: number, y: number) => {
    if (!parentPattern) return;

    const parentPos =
      elementPositions.get(parentPattern.name) || { x: 100, y: 100 };

    const parsedSize = parseSize(parentPattern.size || undefined);
    const parentWidth =
      parentPattern.editorBounds?.width || parsedSize?.width || BASE_CELL_WIDTH;
    const parentHeight =
      parentPattern.editorBounds?.height || parsedSize?.height || BASE_CELL_HEIGHT;

    const parentBox: EditorBounds = {
      x: parentPos.x,
      y: parentPos.y,
      width: parentWidth,
      height: parentHeight
    };

    const meta = idToMetaRef.current.get(id);
    const isInner = meta?.type === 'inner';
    const isOuter = meta?.type === 'outer';

    let newX = x;
    let newY = y;

    // INNER: зажимаем внутри рамки
    if (isInner) {
      const element = visualElements.find((el) => el.id === id);
      if (!element) return;

      const minX = parentBox.x;
      const maxX = parentBox.x + parentBox.width - element.width;
      const minY = parentBox.y;
      const maxY = parentBox.y + parentBox.height - element.height;

      newX = Math.max(minX, Math.min(maxX, x));
      newY = Math.max(minY, Math.min(maxY, y));
    }

    // OUTER: отталкиваем от пересечения с рамкой
    if (isOuter) {
      const element = visualElements.find((el) => el.id === id);
      if (!element) return;

      const margin = 10;
      const rectLeft = newX;
      const rectRight = newX + element.width;
      const rectTop = newY;
      const rectBottom = newY + element.height;

      const boxLeft = parentBox.x;
      const boxRight = parentBox.x + parentBox.width;
      const boxTop = parentBox.y;
      const boxBottom = parentBox.y + parentBox.height;

      const intersects = !(
        rectRight <= boxLeft ||
        rectLeft >= boxRight ||
        rectBottom <= boxTop ||
        rectTop >= boxBottom
      );

      if (intersects) {
        const cx = newX + element.width / 2;
        const cy = newY + element.height / 2;
        const boxCx = (boxLeft + boxRight) / 2;
        const boxCy = (boxTop + boxBottom) / 2;

        const dx = cx - boxCx;
        const dy = cy - boxCy;

        if (Math.abs(dx) > Math.abs(dy)) {
          newX = dx < 0 ? boxLeft - element.width - margin : boxRight + margin;
        } else {
          newY = dy < 0 ? boxTop - element.height - margin : boxBottom + margin;
        }
      }
    }

    // сохраняем позицию
    setElementPositions((prev) => {
      const next = new Map(prev);
      next.set(id, { x: newX, y: newY });
      return next;
    });

    // Не затираем location целиком, а ДОБАВЛЯЕМ top/left
    if (meta && isAreaPattern(parentPattern)) {
      const area = parentPattern as AreaPattern;

      let comp: ComponentPattern | undefined;
      if (meta.type === 'inner') {
        comp = area.getInner(meta.key);
      } else {
        comp = area.getOuter(meta.key);
      }

      const prevLocationObj: LocationObject =
        comp &&
        typeof comp.location === 'object' &&
        !Array.isArray(comp.location)
          ? (comp.location as LocationObject)
          : {};

      const dx = newX - parentBox.x;
      const dy = newY - parentBox.y;

      const newLocation: LocationObject = {
        ...prevLocationObj,
        top: `${Math.round(dy)}`,
        left: `${Math.round(dx)}`
      };

      handleUpdateLocation(parentPattern.name, meta.type, meta.key, newLocation);
    }
  };
  
  const handleElementResize = (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => {
    if (!parentPattern) return;

    const parentPos =
      elementPositions.get(parentPattern.name) || { x: 100, y: 100 };

    const parsedSize = parseSize(parentPattern.size || undefined);
    const parentWidth =
      parentPattern.editorBounds?.width || parsedSize?.width || BASE_CELL_WIDTH;
    const parentHeight =
      parentPattern.editorBounds?.height || parsedSize?.height || BASE_CELL_HEIGHT;

    const parentBox: EditorBounds = {
      x: parentPos.x,
      y: parentPos.y,
      width: parentWidth,
      height: parentHeight
    };

    const meta = idToMetaRef.current.get(id);
    if (!meta) return;

    const element = visualElements.find((el) => el.id === id);
    if (!element) return;

    const prevRect = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height
    };


    const isInner = meta.type === 'inner';
    const isOuter = meta.type === 'outer';

    const MIN_W = 40;
    const MIN_H = 30;

    let newRect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };

    // INNER: жёстко внутри родителя, но с якорем на противоположной стороне
    if (isInner) {
      const parentLeft = parentBox.x;
      const parentRight = parentBox.x + parentBox.width;
      const parentTop = parentBox.y;
      const parentBottom = parentBox.y + parentBox.height;

      const prevLeft = prevRect.x;
      const prevRight = prevRect.x + prevRect.width;
      const prevTop = prevRect.y;
      const prevBottom = prevRect.y + prevRect.height;

      const newLeftRaw = rect.x;
      const newRightRaw = rect.x + rect.width;
      const newTopRaw = rect.y;
      const newBottomRaw = rect.y + rect.height;

      // --- Горизонталь: решаем, какую сторону тянули (левую или правую) ---
      const deltaLeft = Math.abs(newLeftRaw - prevLeft);
      const deltaRight = Math.abs(newRightRaw - prevRight);

      let finalLeft = prevLeft;
      let finalRight = prevRight;

      if (deltaLeft > deltaRight) {
        // Тянем ЛЕВУЮ сторону, правая заякорена
        const minLeft = parentLeft;
        const maxLeft = prevRight - MIN_W;
        const clampedLeft = Math.max(minLeft, Math.min(newLeftRaw, maxLeft));

        finalLeft = clampedLeft;
        finalRight = prevRight; // правая сторона не двигается
      } else if (deltaRight > 0) {
        // Тянем ПРАВУЮ сторону, левая заякорена
        const minRight = prevLeft + MIN_W;
        const maxRight = parentRight;
        const clampedRight = Math.max(minRight, Math.min(newRightRaw, maxRight));

        finalLeft = prevLeft;
        finalRight = clampedRight;
      }

      // --- Вертикаль: аналогично (верхняя или нижняя сторона) ---
      const deltaTop = Math.abs(newTopRaw - prevTop);
      const deltaBottom = Math.abs(newBottomRaw - prevBottom);

      let finalTop = prevTop;
      let finalBottom = prevBottom;

      if (deltaTop > deltaBottom) {
        // Тянем ВЕРХНЮЮ сторону, низ заякорен
        const minTop = parentTop;
        const maxTop = prevBottom - MIN_H;
        const clampedTop = Math.max(minTop, Math.min(newTopRaw, maxTop));

        finalTop = clampedTop;
        finalBottom = prevBottom;
      } else if (deltaBottom > 0) {
        // Тянем НИЖНЮЮ сторону, верх заякорен
        const minBottom = prevTop + MIN_H;
        const maxBottom = parentBottom;
        const clampedBottom = Math.max(minBottom, Math.min(newBottomRaw, maxBottom));

        finalTop = prevTop;
        finalBottom = clampedBottom;
      }

      newRect = {
        x: finalLeft,
        y: finalTop,
        width: Math.max(MIN_W, finalRight - finalLeft),
        height: Math.max(MIN_H, finalBottom - finalTop)
      };
    }


   // OUTER: остаётся снаружи рамки
    if (isOuter) {
      const boxLeft = parentBox.x;
      const boxRight = parentBox.x + parentBox.width;
      const boxTop = parentBox.y;
      const boxBottom = parentBox.y + parentBox.height;

      const rectLeft = newRect.x;
      const rectRight = newRect.x + newRect.width;
      const rectTop = newRect.y;
      const rectBottom = newRect.y + newRect.height;

      // Реальное пересечение с рамкой родителя
      const intersects =
        rectRight > boxLeft &&
        rectLeft < boxRight &&
        rectBottom > boxTop &&
        rectTop < boxBottom;

      // Пока НЕ пересекается — даём тянуть как угодно (кроме MIN_W/ MIN_H)
      if (intersects) {
        // Смотрим, где элемент был ДО ресайза относительно родителя
        const prevCx = prevRect.x + prevRect.width / 2;
        const prevCy = prevRect.y + prevRect.height / 2;
        const boxCx = (boxLeft + boxRight) / 2;
        const boxCy = (boxTop + boxBottom) / 2;

        const dx = prevCx - boxCx;
        const dy = prevCy - boxCy;

        // Больше смещение по горизонтали — считаем, что элемент "левый/правый"
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx < 0) {
            // элемент слева — ставим его вплотную к левой грани
            newRect.x = boxLeft - newRect.width;
          } else {
            // справа
            newRect.x = boxRight;
          }
        } else {
          // Больше по вертикали — "верхний/нижний"
          if (dy < 0) {
            // сверху
            newRect.y = boxTop - newRect.height;
          } else {
            // снизу
            newRect.y = boxBottom;
          }
        }
      }
    }
    // 1) сохраняем новую позицию в elementPositions
    setElementPositions((prev) => {
      const next = new Map(prev);
      next.set(id, { x: newRect.x, y: newRect.y });
      return next;
    });

    // 2) сохраняем относительное положение + размер в location компонента
    if (isAreaPattern(parentPattern)) {
      const area = parentPattern as AreaPattern;

      let comp: ComponentPattern | undefined;
      if (meta.type === 'inner') {
        comp = area.getInner(meta.key);
      } else {
        comp = area.getOuter(meta.key);
      }

      const prevLocationObj: LocationObject =
        comp &&
        typeof comp.location === 'object' &&
        !Array.isArray(comp.location)
          ? (comp.location as LocationObject)
          : {};

      const dx = newRect.x - parentBox.x;
      const dy = newRect.y - parentBox.y;

      const newLocation: LocationObject = {
        ...prevLocationObj,
        top: `${Math.round(dy)}`,
        left: `${Math.round(dx)}`,
        width: `${Math.round(newRect.width)}`,
        height: `${Math.round(newRect.height)}`
      };

      handleUpdateLocation(parentPattern.name, meta.type, meta.key, newLocation);
    }
  };


  /* ===== Клик по элементу (выбор / overlap) ===== */

  const handleElementClick = (clickedId: string, forceOverlap: boolean) => {
    const clickedElement = visualElements.find((el) => el.id === clickedId);
    if (!clickedElement) return;

    if (clickedElement.role === 'parent') {
      editorStore.setActiveInnerElement(null);
      setShowOverlapMenu(false);
      setOverlappingElements([]);
      return;
    }

    const componentElements = visualElements.filter((el) => el.role !== 'parent');

    const overlapping = componentElements.filter((el) => {
      const isOverlapping = !(
        el.x + el.width < clickedElement.x ||
        el.x > clickedElement.x + clickedElement.width ||
        el.y + el.height < clickedElement.y ||
        el.y > clickedElement.y + clickedElement.height
      );
      return isOverlapping;
    });

    if (overlapping.length > 1 && forceOverlap) {
      const centerX = clickedElement.x + clickedElement.width / 2;
      const centerY = clickedElement.y + clickedElement.height / 2;
      setClickPosition({ x: centerX, y: centerY });
      setOverlappingElements(overlapping.map((el) => el.id));
      setShowOverlapMenu(true);
    } else {
      editorStore.setActiveInnerElement(clickedId);
      setShowOverlapMenu(false);
      setOverlappingElements([]);
    }
  };

  /* ===== Инициализация bbox при входе/выходе из фокуса ===== */

    useEffect(() => {
    // 🛑 Блокируем выделение текста ТОЛЬКО внутри svg-канваса
    const preventSelection = (e: Event) => {
      if (!svgRef.current) return;

      const target = e.target as Node | null;
      // Если событие пришло изнутри svg — гасим выделение
      if (target && svgRef.current.contains(target)) {
        e.preventDefault();
      }
    };

    if (isFocusMode) {
      document.addEventListener('selectstart', preventSelection);
    }

    if (isFocusMode && parentPattern) {
      const parsedSize = parseSize(parentPattern.size || undefined);
      const parentWidth =
        parentPattern.editorBounds?.width || parsedSize?.width || BASE_CELL_WIDTH;
      const parentHeight =
        parentPattern.editorBounds?.height || parsedSize?.height || BASE_CELL_HEIGHT;

      setElementPositions((prev) => {
        const next = new Map(prev);
        if (!next.has(parentPattern.name)) {
          next.set(parentPattern.name, { x: 100, y: 100 });
        }
        return next;
      });

      const pos = elementPositions.get(parentPattern.name) || { x: 100, y: 100 };

      prevParentBoxRef.current = {
        x: pos.x,
        y: pos.y,
        width: parentWidth,
        height: parentHeight
      };

      editorStore.setActiveInnerElement(null);
    } else {
      prevParentBoxRef.current = null;
      editorStore.setActiveInnerElement(null);
    }

    return () => {
      document.removeEventListener('selectstart', preventSelection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocusMode, selectedId]);


  /* ===== ВНЕ ФОКУС-РЕЖИМА — белый экран с подсказкой ===== */

  if (!isFocusMode || !parentPattern) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center">
        <div className="text-gray-400 text-lg select-none">
          Выберите элемент для редактирования
        </div>
      </div>
    );
  }

  // allElements для PatternVisualization (для стрелок)
  const allElementsForVisualization = visualElements.map((el) => ({
    id: el.id,
    // parent остаётся по имени паттерна, inner/outer — по ключу компонента
    name:
      el.role === 'parent'
        ? el.pattern.name
        : el.componentKey || el.pattern.name,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height
  }));



  // фиксированный bbox для рамки (равен положению родителя на Canvas)
  const fixedBoundingBox:
    | { x: number; y: number; width: number; height: number }
    | undefined = parentElement
    ? {
        x: parentElement.x,
        y: parentElement.y,
        width: parentElement.width,
        height: parentElement.height
      }
    : undefined;

  return (
    <div className="relative w-full h-full bg-gray-50">
      {/* Overlap-меню: только компоненты, без родителя */}
      <OverlapManager
        elements={visualElements
          .filter((el) => overlappingElements.includes(el.id))
          .map((el, index) => {
            const isComponent = el.role !== 'parent';
            const label =
              isComponent && el.componentKey
                ? `${el.componentKey} (${el.pattern.name})`
                : el.pattern.name;

            return {
              id: el.id,
              name: label,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              zIndex: index
            };
          })}
        clickPosition={clickPosition}
        selectedId={activeComponentId}
        onSelectElement={(id, enterFocusMode) => {
          editorStore.setActiveInnerElement(id);
          if (enterFocusMode) {
            setShowOverlapMenu(false);
            setClickPosition(null);
          }
        }}
        onClose={() => {
          setShowOverlapMenu(false);
          setClickPosition(null);
        }}
        visible={showOverlapMenu && isFocusMode}
      />

      {/* Панель зума + Esc */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3 bg-white rounded-lg shadow-md px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-medium">Масштаб</span>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="Уменьшить"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="Увеличить"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="Сбросить вид"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {parentElement && (
            <button
              onClick={handleCenterSelected}
              className="p-1.5 hover:bg-gray-100 rounded border-l ml-2 pl-2"
              title="Центрировать выбранный элемент"
            >
              <Focus className="w-4 h-4" />
            </button>
          )}
        </div>

        {isFocusMode && parentElement && (
          <button
            onClick={() => editorStore.exitFocusMode()}
            className="ml-3 flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-50 text-red-600"
            title="Выйти из режима редактирования (Esc)"
          >
            <X className="w-3 h-3" />
            <span>Esc</span>
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
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

          <rect
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill="url(#grid)"
          />

          {/* Родительский паттерн – рамка + стрелки + ресайз */}
          {parentElement && fixedBoundingBox && parentPattern && (
            <PatternVisualization
              pattern={parentPattern.toJSON() as Pattern}
              patternName={parentPattern.name}
              x={fixedBoundingBox.x}
              y={fixedBoundingBox.y}
              width={fixedBoundingBox.width}
              height={fixedBoundingBox.height}
              isSelected={true}
              isFocusMode={isFocusMode}
              hoveredInnerOuterElement={hoveredInnerOuterElement}
              onUpdateLocation={(
                type: 'inner' | 'outer',
                key: string,
                location: LocationObject
              ) =>
                handleUpdateLocation(
                  parentPattern.name,
                  type,
                  key,
                  location
                )
              }
              allElements={allElementsForVisualization}
              fixedBoundingBox={fixedBoundingBox}
              onUpdateBoundingBox={handleUpdateBoundingBox}
              arrayItemPattern={
                parentPattern instanceof ArrayPattern  && parentPattern.item_pattern
                  ? ((parentPattern as any).item_pattern.toJSON() as Pattern)
                  : null
              }
            />
          )}

          {/* Линии наследования для cell: текущая ячейка -> родительские cell */}
          {inheritanceLinks.map((link, idx) => (
            <g key={`inherit-link-${idx}`} style={{ pointerEvents: 'none' }}>
              {/* сплошная линия */}
              <line
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke="#4b5563"
                strokeWidth={1.5}
              />
              {/* UML-треугольник без заливки у родителя */}
              <polygon
                points={getInheritanceArrowPoints(link)}
                fill="white"           // пустой внутри
                stroke="#4b5563"       // контур как у линии
                strokeWidth={1.5}
              />
            </g>
          ))}



          {/* Компоненты (inner/outer) */}
          {visualElements
            .filter((el) => el.role !== 'parent')
            .sort((a, b) => {
              if (a.id === activeComponentId) return 1;
              if (b.id === activeComponentId) return -1;
              return 0;
            })
            .map((el) => {
              const isSelected = el.id === activeComponentId;
              const isComponent = el.role !== 'parent';

              const displayName =
                isComponent && el.componentKey
                  ? `${el.componentKey} (${el.pattern.name})`
                  : el.pattern.name;

              return (
                <g key={el.id}>
                  <ElementShape
                    element={{
                      id: el.id,
                      name: el.pattern.name,
                      kind: el.kind,
                      x: el.x,
                      y: el.y,
                      width: el.width,
                      height: el.height
                    }}
                    isSelected={isSelected}
                    isHovered={editorStore.state.hoveredElement === el.id}
                    onSelect={(altKey) => handleElementClick(el.id, altKey)}
                    onMakeActive={() => editorStore.setActiveInnerElement(el.id)}
                    onHover={() => {
                      editorStore.setHoveredElement(el.id);

                      if (el.role !== 'parent') {
                        // было: pattern.name → кладём key
                        editorStore.setHoveredInnerOuterElement(
                          el.componentKey || el.pattern.name
                        );
                      }
                    }}
                    onHoverEnd={() => {
                      editorStore.setHoveredElement(null);
                      editorStore.setHoveredInnerOuterElement(null);
                    }}
                    onPositionChange={handleElementPositionChange}
                    onResize={handleElementResize}
                    isInFocusMode={isFocusMode}
                    displayName={displayName}
                    hasActiveElement={activeComponentId !== null}
                  />
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
});
