import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
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

// та же логика пересечения с прямоугольником, но размеры другие
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

export const PatternGraph: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const editorStore = useEditorStore();

  const { nodes, edges } = useMemo(() => {
    const patterns = grammarStore.allPatterns;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const levels = new Map<string, number>();
    const visited = new Set<string>();

    const rootPatterns = patterns.filter((p) => p.root);

    const assignLevels = (patternName: string, level: number) => {
      if (visited.has(patternName)) return;
      visited.add(patternName);

      const currentLevel = levels.get(patternName) || 0;
      levels.set(patternName, Math.max(currentLevel, level));

      const pattern = patterns.find((p) => p.name === patternName);
      if (!pattern) return;

      if (pattern.inner) {
        Object.values(pattern.inner).forEach((inner: any) => {
          if (inner.pattern) {
            assignLevels(inner.pattern, level + 1);
          } else if (inner.pattern_definition?.item_pattern) {
            assignLevels(inner.pattern_definition.item_pattern, level + 1);
          }
        });
      }

      if (pattern.outer) {
        Object.values(pattern.outer).forEach((outer: any) => {
          if (outer.pattern) {
            assignLevels(outer.pattern, level - 1);
          }
        });
      }

      if (pattern.kind === 'array' && (pattern as any).item_pattern) {
        assignLevels((pattern as any).item_pattern, level + 1);
      }

      if (
        pattern.kind === 'cell' &&
        Array.isArray((pattern as any).extends)
      ) {
        const bases = (pattern as any).extends as string[];
        bases.forEach((base) => assignLevels(base, level - 1));
      }
    };

    if (rootPatterns.length > 0) {
      rootPatterns.forEach((root) => assignLevels(root.name, 0));
    } else if (patterns.length > 0) {
      assignLevels(patterns[0].name, 0);
    }

    patterns.forEach((p) => {
      if (!levels.has(p.name)) {
        levels.set(p.name, 0);
      }
    });

    const levelGroups = new Map<number, string[]>();
    patterns.forEach((pattern) => {
      const level = levels.get(pattern.name) || 0;

      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(pattern.name);
    });

    const nodeSpacingX = 250;
    const nodeSpacingY = 150;
    const startY = 100;

    levelGroups.forEach((patternNames, level) => {
      const startX = 100 + ((patternNames.length - 1) * nodeSpacingX) / 2;

      patternNames.forEach((name, index) => {
        const pattern = patterns.find((p) => p.name === name)!;
        nodes.push({
          id: name,
          name: name,
          kind: pattern.kind as any,
          x: startX - index * nodeSpacingX,
          y: startY + level * nodeSpacingY,
          level,
          root: pattern.root
        });
      });
    });

    // edges
    patterns.forEach((pattern) => {
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

      if (
        pattern.kind === 'cell' &&
        Array.isArray((pattern as any).extends)
      ) {
        const bases = (pattern as any).extends as string[];
        bases.forEach((baseName) => {
          if (patterns.find((p) => p.name === baseName)) {
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
  }, [grammarStore.allPatterns]);

  const handleNodeClick = (nodeId: string) => {
    editorStore.selectElement(nodeId);
  };

  const getNodeColor = (kind: string, isRoot: boolean = false) => {
    if (isRoot) {
      return {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#7f1d1d'
      };
    }
    switch (kind) {
      case 'cell':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
      case 'area':
        return { bg: '#d1fae5', border: '#10b981', text: '#065f46' };
      case 'array':
        return { bg: '#fef9c3', border: '#eab308', text: '#713f12' };
      default:
        return { bg: '#e5e7eb', border: '#6b7280', text: '#374151' };
    }
  };

  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 800 600';

    const minX = Math.min(...nodes.map((n) => n.x)) - 150;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 150;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 100;

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 select-none">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Граф пуст</p>
          <p className="text-sm">Добавьте паттерны через панель инструментов</p>
        </div>
      </div>
    );
  }

  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 60;

  return (
    <div className="w-full h-full bg-gray-50 overflow-auto relative select-none">
      <svg className="w-full h-full" viewBox={viewBox}>
        {/* Рёбра */}
        {edges.map((edge, index) => {
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);

          if (!fromNode || !toNode) return null;

          const parentNode =
            edge.type === 'extends' ? toNode : fromNode;
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
            dashArray = '5,5';
          }

          const markerId = `arrow-mini-${index}`;
          const isExtends = edge.type === 'extends';

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
                strokeWidth={2}
                strokeDasharray={dashArray}
                markerEnd={`url(#${markerId})`}
                opacity={0.7}
              />

              {/* Веса только для area + inner/outer */}
              {parentNode.kind === 'area' &&
                (edge.type === 'inner' || edge.type === 'outer') &&
                edge.label && (
                  <>
                    <rect
                      x={midX - 30}
                      y={midY - 14}
                      width={60}
                      height={20}
                      rx={3}
                      fill="white"
                      stroke={color}
                      strokeWidth={1}
                      opacity={0.95}
                    />
                    <text
                      x={midX}
                      y={midY}
                      fontSize="10"
                      fill={color}
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none' }}
                    >
                      {edge.label}
                    </text>
                  </>
                )}
            </g>
          );
        })}

        {/* Узлы */}
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
                  x={node.x - (NODE_WIDTH / 2 + 5)}
                  y={node.y - (NODE_HEIGHT / 2 + 5)}
                  width={NODE_WIDTH + 10}
                  height={NODE_HEIGHT + 10}
                  rx={8}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  opacity={0.5}
                />
              )}

              <rect
                x={node.x - NODE_WIDTH / 2}
                y={node.y - NODE_HEIGHT / 2}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={isSelected ? 3 : 2}
              />

              <text
                x={node.x}
                y={node.y - 5}
                fontSize="13"
                fontWeight="bold"
                fill={colors.text}
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {node.name}
              </text>

              <text
                x={node.x}
                y={node.y + 12}
                fontSize="10"
                fill={colors.text}
                textAnchor="middle"
                opacity={0.7}
                style={{ pointerEvents: 'none' }}
              >
                {node.kind}
                {node.root ? ' · ROOT' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Легенда */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-md p-3 text-xs">
        <div className="font-semibold mb-2">Легенда:</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#dbeafe', border: '1px solid #3b82f6' }} />
            <span>Cell</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#d1fae5', border: '1px solid #10b981' }} />
            <span>Area</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#fef9c3', border: '1px solid #eab308' }} />
            <span>Array</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ background: '#fee2e2', border: '1px solid #ef4444' }} />
            <span>Root</span>
          </div>

          <div className="mt-2 font-semibold">Связи:</div>
          <div className="flex items-center gap-2">
            <svg width="30" height="6">
              <line x1="0" y1="3" x2="30" y2="3" stroke="#4b5563" strokeWidth={2} />
            </svg>
            <span>Inner / item_pattern / extends</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="30" height="6">
              <line
                x1="0"
                y1="3"
                x2="30"
                y2="3"
                stroke="#4b5563"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
            </svg>
            <span>Outer</span>
          </div>
        </div>
      </div>
    </div>
  );
});
