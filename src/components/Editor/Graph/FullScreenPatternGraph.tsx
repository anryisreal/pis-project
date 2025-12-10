import React, { useMemo, useState, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';

interface GraphNode {
  id: string;
  name: string;
  kind: 'cell' | 'area' | 'array';
  x: number;
  y: number;
  level: number;
  root?: boolean;
}

type EdgeType = 'inner' | 'outer' | 'array_item' | 'extends';

interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
}

interface HoveredEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
  x: number;
  y: number;
}

// вспомогательная функция: точка пересечения луча с прямоугольником
function getEdgePoints(
  from: GraphNode,
  to: GraphNode,
  nodeWidth: number,
  nodeHeight: number
) {
  const hw = nodeWidth / 2;
  const hh = nodeHeight / 2;

  const project = (a: GraphNode, b: GraphNode) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (dx === 0 && dy === 0) {
      return { x: a.x, y: a.y };
    }

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let tx = Infinity;
    let ty = Infinity;

    if (absDx > 0) tx = hw / absDx;
    if (absDy > 0) ty = hh / absDy;

    const t = Math.min(tx, ty);

    return {
      x: a.x + dx * t,
      y: a.y + dy * t
    };
  };

  const start = project(from, to);
  const end = project(to, from);

  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y
  };
}

export const FullScreenPatternGraph: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const editorStore = useEditorStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdge | null>(null);

  // Строим граф
  const { nodes, edges } = useMemo(() => {
    const patterns = grammarStore.allPatterns;
    const rawPatterns =
      grammarStore.originalGrammar?.patterns ||
      grammarStore.grammar?.patterns ||
      {}; // Оригинальный YAML!

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    if (patterns.length === 0) {
      return { nodes, edges };
    }

    // Определяем уровни паттернов (для вертикального размещения)
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    // Находим корневые паттерны
    const rootPatterns = patterns.filter((p) => p.root);

    // BFS от корня вниз - правильное определение уровней
    const queue: Array<{ name: string; level: number }> = [];

    // Начинаем с корневых паттернов на уровне 0
    if (rootPatterns.length > 0) {
      rootPatterns.forEach((root) => {
        queue.push({ name: root.name, level: 0 });
        levels.set(root.name, 0);
        visited.add(root.name);
      });
    } else if (patterns.length > 0) {
      // Если нет root, начинаем с первого паттерна
      queue.push({ name: patterns[0].name, level: 0 });
      levels.set(patterns[0].name, 0);
      visited.add(patterns[0].name);
    }

    while (queue.length > 0) {
      const { name, level } = queue.shift()!;
      const pattern = patterns.find((p) => p.name === name);
      if (!pattern) continue;

      // Inner связи
      if (pattern.inner) {
        const rawPattern = rawPatterns[name];

        Object.entries(pattern.inner).forEach(([key, inner]: [string, any]) => {
          const targetPatterns: string[] = [];

          if (inner.pattern) {
            targetPatterns.push(inner.pattern);
          }

          if (rawPattern?.inner?.[key]?.pattern_definition?.item_pattern) {
            const itemPattern =
              rawPattern.inner[key].pattern_definition.item_pattern;
            targetPatterns.push(itemPattern);
          }

          targetPatterns.forEach((targetPattern) => {
            if (targetPattern && !visited.has(targetPattern)) {
              visited.add(targetPattern);
              levels.set(targetPattern, level + 1);
              queue.push({ name: targetPattern, level: level + 1 });
            }
          });
        });
      }

      // Можем дополнительно учитывать item_pattern массивов как "детей"
      if (pattern.kind === 'array' && (pattern as any).item_pattern) {
        const item = (pattern as any).item_pattern as string;
        if (item && !visited.has(item)) {
          visited.add(item);
          levels.set(item, (levels.get(name) || level) + 1);
          queue.push({ name: item, level: (levels.get(name) || level) + 1 });
        }
      }
    }

    // Паттерны без связей - на нулевой уровень
    patterns.forEach((p) => {
      if (!levels.has(p.name)) {
        levels.set(p.name, 0);
      }
    });

    // Группируем по уровням
    const levelGroups = new Map<number, string[]>();
    patterns.forEach((pattern) => {
      const level = levels.get(pattern.name) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(pattern.name);
    });

    // Размещаем узлы
    const nodeSpacingX = 300;
    const nodeSpacingY = 200;

    levelGroups.forEach((patternNames, level) => {
      const totalWidth = (patternNames.length - 1) * nodeSpacingX;
      const startX = -totalWidth / 2;

      patternNames.forEach((name, index) => {
        const pattern = patterns.find((p) => p.name === name)!;
        const x = startX + index * nodeSpacingX;
        const y = level * nodeSpacingY;

        nodes.push({
          id: name,
          name: name,
          kind: pattern.kind as any,
          x,
          y,
          level,
          root: pattern.root
        });
      });
    });

    // Создаём рёбра
    patterns.forEach((pattern) => {
      // Inner связи: от текущего паттерна к его inner элементу
      if (pattern.inner) {
        Object.entries(pattern.inner).forEach(([key, inner]: [string, any]) => {
          let targetPattern: string | null = null;

          if (inner.pattern) {
            targetPattern = inner.pattern;
          } else if (inner.pattern_definition?.item_pattern) {
            targetPattern = inner.pattern_definition.item_pattern;
          }

          if (targetPattern && patterns.find((p) => p.name === targetPattern)) {
            edges.push({
              from: pattern.name,
              to: targetPattern,
              type: 'inner',
              label: key
            });
          }
        });
      }

      // Outer связи: от outer паттерна к текущему паттерну
      if (pattern.outer) {
        Object.entries(pattern.outer).forEach(([key, outer]: [string, any]) => {
          const outerPattern = outer.pattern;

          if (outerPattern && patterns.find((p) => p.name === outerPattern)) {
            edges.push({
              from: pattern.name,
              to: outerPattern,
              type: 'outer',
              label: key
            });
          }
        });
      }

      // Array → item_pattern
      if (pattern.kind === 'array' && (pattern as any).item_pattern) {
        const itemPattern = (pattern as any).item_pattern as string;
        if (itemPattern && patterns.find((p) => p.name === itemPattern)) {
          edges.push({
            from: pattern.name,
            to: itemPattern,
            type: 'array_item'
          });
        }
      }

      // Cell extends (UML)
      if (pattern.kind === 'cell' && Array.isArray((pattern as any).extends)) {
        const bases = (pattern as any).extends as string[];
        bases.forEach((baseName) => {
          if (patterns.find((p) => p.name === baseName)) {
            // стрелка от дочернего к родителю
            edges.push({
              from: pattern.name,
              to: baseName,
              type: 'extends'
            });
          }
        });
      }
    });

    return { nodes, edges };
  }, [grammarStore.allPatterns, grammarStore.originalGrammar, grammarStore.grammar]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
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

  const handleNodeClick = (nodeId: string) => {
    editorStore.selectElement(nodeId);
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'pattern-graph.svg';
    link.click();

    URL.revokeObjectURL(url);
  };

  const getNodeColor = (kind: string, isRoot: boolean = false) => {
    if (isRoot) {
      // ROOT - красный
      return {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#7f1d1d',
        shadow: '#fca5a5'
      };
    }
    switch (kind) {
      case 'cell':
        return {
          bg: '#dbeafe',
          border: '#3b82f6',
          text: '#1e40af',
          shadow: '#60a5fa'
        };
      case 'area':
        return {
          bg: '#d1fae5',
          border: '#10b981',
          text: '#065f46',
          shadow: '#34d399'
        };
      case 'array':
        // array - жёлтый
        return {
          bg: '#fef9c3',
          border: '#eab308',
          text: '#713f12',
          shadow: '#facc15'
        };
      default:
        return {
          bg: '#e5e7eb',
          border: '#6b7280',
          text: '#374151',
          shadow: '#9ca3af'
        };
    }
  };

  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 80;

  // Зум по колёсику с привязкой к курсору (как в Фигме)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 1 / 1.1;

    const newZoomRaw = zoom * zoomFactor;
    const newZoom = Math.min(3, Math.max(0.1, newZoomRaw));
    if (newZoom === zoom) return;

    // текущий translate, который мы задаём в <g>
    const currentTx = pan.x + window.innerWidth / 2;
    const currentTy = pan.y + 100;

    // точка в мировых координатах под курсором
    const worldX = (mouseX - currentTx) / zoom;
    const worldY = (mouseY - currentTy) / zoom;

    // хотим, чтобы после зума эта точка осталась под курсором
    const newTx = mouseX - worldX * newZoom;
    const newTy = mouseY - worldY * newZoom;

    setZoom(newZoom);
    setPan({
      x: newTx - window.innerWidth / 2,
      y: newTy - 100
    });
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 select-none">
        <div className="text-center">
          <div className="text-6xl mb-4">🌐</div>
          <p className="text-xl font-semibold text-gray-700 mb-2">Граф пуст</p>
          <p className="text-sm text-gray-500">
            Добавьте паттерны через панель инструментов
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-50 select-none">
      {/* Панель управления */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Уменьшить"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium min-w-[60px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Увеличить"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Сбросить вид"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          onClick={handleExportSVG}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Экспорт SVG"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Статистика */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Статистика графа
        </h3>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between gap-4">
            <span>Узлов:</span>
            <span className="font-semibold">{nodes.length}</span>
          </div>
          <div className="flex justify между gap-4">
            <span>Связей:</span>
            <span className="font-semibold">{edges.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Уровней:</span>
            <span className="font-semibold">
              {new Set(nodes.map((n) => n.level)).size}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400">
            v3.6.0-GRAPH
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Легенда</h3>
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-gray-600 mb-2">
            Типы паттернов:
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded"
              style={{
                backgroundColor: '#dbeafe',
                border: '2px solid #3b82f6'
              }}
            ></div>
            <span>Cell</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded"
              style={{
                backgroundColor: '#d1fae5',
                border: '2px solid #10b981'
              }}
            ></div>
            <span>Area</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded"
              style={{
                backgroundColor: '#fef9c3',
                border: '2px solid #eab308'
              }}
            ></div>
            <span>Array</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded"
              style={{
                backgroundColor: '#fee2e2',
                border: '2px solid #ef4444'
              }}
            ></div>
            <span>Root паттерн</span>
          </div>

          <div className="font-semibold text-gray-600 mt-3 mb-2">Связи:</div>
          <div className="flex items-center gap-2">
            <svg width="40" height="6">
              <line
                x1="0"
                y1="3"
                x2="40"
                y2="3"
                stroke="#4b5563"
                strokeWidth="2"
              />
            </svg>
            <span>Inner / item_pattern / extends</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="40" height="6">
              <line
                x1="0"
                y1="3"
                x2="40"
                y2="3"
                stroke="#4b5563"
                strokeWidth="2"
                strokeDasharray="6,4"
              />
            </svg>
            <span>Outer (контекст)</span>
          </div>
        </div>
      </div>

      {/* SVG граф */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <filter id="shadow-node" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          transform={`translate(${
            pan.x + window.innerWidth / 2
          }, ${pan.y + 100}) scale(${zoom})`}
        >
          {/* Рисуем рёбра */}
          {edges.map((edge, index) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);

            if (!fromNode || !toNode) return null;

            // для extends родитель — toNode, для остальных — fromNode
            const parentNode = edge.type === 'extends' ? toNode : fromNode;
            const parentColors = getNodeColor(
              parentNode.kind,
              !!parentNode.root
            );
            const color = parentColors.border;

            const { startX, startY, endX, endY } = getEdgePoints(
              fromNode,
              toNode,
              NODE_WIDTH,
              NODE_HEIGHT
            );

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            let dashArray = 'none';
            if (edge.type === 'outer') {
              dashArray = '8,4'; // outer - пунктир
            }

            const markerId = `arrow-full-${index}`;
            const isExtends = edge.type === 'extends';

            const edgeId = `${edge.type}-${edge.from}-${edge.to}-${index}`;
            const isHovered = hoveredEdge?.id === edgeId;

            return (
              <g key={`edge-${index}`}>
                <defs>
                  <marker
                    id={markerId}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    {isExtends ? (
                      // UML: пустой треугольник
                      <path
                        d="M0,0 L0,6 L9,3 z"
                        fill="#ffffff"
                        stroke={color}
                        strokeWidth="1.5"
                      />
                    ) : (
                      <path d="M0,0 L0,6 L9,3 z" fill={color} />
                    )}
                  </marker>
                </defs>

                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={color}
                  strokeWidth={3}
                  strokeDasharray={dashArray}
                  markerEnd={`url(#${markerId})`}
                  opacity={0.8}
                />

                {/* Веса/подписи ТОЛЬКО для area + inner/outer */}
                {parentNode.kind === 'area' &&
                  (edge.type === 'inner' || edge.type === 'outer') &&
                  edge.label && (
                    <>
                      <rect
                        x={midX - 40}
                        y={midY - 18}
                        width="80"
                        height="24"
                        rx="4"
                        fill="white"
                        stroke={color}
                        strokeWidth="1.5"
                        opacity="0.95"
                      />
                      <text
                        x={midX}
                        y={midY - 2}
                        fontSize="11"
                        fill={color}
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {edge.label}
                      </text>
                    </>
                  )}

                {/* хитбокс на кончике стрелки для тултипа */}
                <circle
                  cx={endX}
                  cy={endY}
                  r={isHovered ? 28 : 20}
                  fill="transparent"
                  onMouseEnter={() =>
                    setHoveredEdge({
                      id: edgeId,
                      from: fromNode.name,
                      to: toNode.name,
                      type: edge.type,
                      label: edge.label,
                      x: endX,
                      y: endY
                    })
                  }
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              </g>
            );
          })}

          {/* Рисуем узлы */}
          {nodes.map((node) => {
            const colors = getNodeColor(node.kind, !!node.root);
            const isSelected = editorStore.state.selectedElements.includes(
              node.id
            );

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <rect
                    x={node.x - 105}
                    y={node.y - 45}
                    width={NODE_WIDTH + 10}
                    height={NODE_HEIGHT + 10}
                    rx={12}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={4}
                    opacity={0.6}
                  />
                )}

                <rect
                  x={node.x - NODE_WIDTH / 2}
                  y={node.y - NODE_HEIGHT / 2}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={10}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={isSelected ? 4 : 3}
                  filter="url(#shadow-node)"
                />

                {node.root && (
                  <rect
                    x={node.x - NODE_WIDTH / 2}
                    y={node.y - NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={20}
                    rx={10}
                    fill={colors.shadow}
                    opacity={0.3}
                  />
                )}

                <text
                  x={node.x}
                  y={node.y - 5}
                  fontSize="16"
                  fontWeight="bold"
                  fill={colors.text}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.name}
                </text>

                <text
                  x={node.x}
                  y={node.y + 15}
                  fontSize="12"
                  fill={colors.text}
                  textAnchor="middle"
                  opacity={0.7}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.kind}
                </text>

                {node.root && (
                  <text
                    x={node.x}
                    y={node.y + 30}
                    fontSize="10"
                    fill={colors.text}
                    textAnchor="middle"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    ⭐ ROOT
                  </text>
                )}
              </g>
            );
          })}

          {/* Тултип поверх всех узлов и рёбер */}
          {hoveredEdge && (
            <g
              transform={`translate(${hoveredEdge.x + 12}, ${
                hoveredEdge.y - 12
              })`}
              pointerEvents="none"
            >
              <rect
                x={0}
                y={-32}
                width={220}
                height={32}
                rx={4}
                fill="white"
                stroke="#4b5563"
                strokeWidth={1}
                opacity={0.95}
              />
              {/* основная строка: откуда → куда */}
              <text x={8} y={-20} fontSize={11} fill="#111827">
                {hoveredEdge.from} → {hoveredEdge.to}
              </text>
              {/* дополнительная строка по типу и имени компонента */}
              <text x={8} y={-8} fontSize={10} fill="#4b5563">
                {hoveredEdge.type}
                {hoveredEdge.label ? ` · ${hoveredEdge.label}` : ''}
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Подсказка */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-md px-4 py-2 text-xs text-gray-600">
        💡 Используйте мышь для перемещения • Колесо для масштабирования • Наведите на кончик стрелки
      </div>
    </div>
  );
});
