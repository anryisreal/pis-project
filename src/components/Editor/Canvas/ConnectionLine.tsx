import React from 'react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';

interface ConnectionLineProps {
    elements: Array<{
        id: string;
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({ elements }) => {
    const grammarStore = useGrammarStore();
    const editorStore = useEditorStore();

    if (!grammarStore.grammar || !grammarStore.grammar.patterns) {
        return null;
    }

    const selectedId = editorStore.state.selectedElements[0];
    if (!selectedId) {
        return null;
    }

    const selectedPattern = grammarStore.findPatternByName(selectedId);
    if (!selectedPattern) {
        return null;
    }

    const selectedElement = elements.find(e => e.name === selectedId);
    if (!selectedElement) {
        return null;
    }

    const connections: JSX.Element[] = [];

    // 1. INNER connections (padding - фиолетовые)
    if (selectedPattern.inner) {
        Object.entries(selectedPattern.inner).forEach(([key, innerPattern]) => {
            if (innerPattern.pattern) {
                const toElement = elements.find(e => e.name === innerPattern.pattern);
                if (!toElement) return;

                drawInnerConnection(
                    selectedElement,
                    toElement,
                    key,
                    innerPattern.location,
                    connections,
                    selectedId
                );
            } else if (innerPattern.pattern_definition) {
                // Inline definition - рисуем индикатор внутри
                const centerX = selectedElement.x + selectedElement.width / 2;
                const centerY = selectedElement.y + selectedElement.height / 2;

                connections.push(
                    <g key={`inline-${selectedId}-${key}`}>
                        <circle
                            cx={centerX}
                            cy={centerY}
                            r="30"
                            fill="rgba(139, 92, 246, 0.1)"
                            stroke="#8b5cf6"
                            strokeWidth="2"
                            strokeDasharray="3,3"
                        />
                        <text
                            x={centerX}
                            y={centerY - 5}
                            fontSize="10"
                            fill="#8b5cf6"
                            fontWeight="bold"
                            textAnchor="middle"
                            className="pointer-events-none"
                        >
                            {key}
                        </text>
                        <text
                            x={centerX}
                            y={centerY + 8}
                            fontSize="9"
                            fill="#8b5cf6"
                            textAnchor="middle"
                            className="pointer-events-none"
                        >
                            (inline)
                        </text>
                    </g>
                );
            }
        });
    }

    // 2. OUTER connections (margin - розовые)
    if (selectedPattern.outer) {
        Object.entries(selectedPattern.outer).forEach(([key, outerPattern]) => {
            if (!outerPattern.pattern) return;

            const toElement = elements.find(e => e.name === outerPattern.pattern);
            if (!toElement) return;

            drawOuterConnection(
                selectedElement,
                toElement,
                key,
                outerPattern.location,
                connections,
                selectedId,
                outerPattern.pattern
            );
        });
    }

    return <>{connections}</>;
};

// INNER: от центра ВЫБРАННОГО к центру ЦЕЛЕВОГО
function drawInnerConnection(
    fromElement: any,
    toElement: any,
    key: string,
    location: any,
    connections: JSX.Element[],
    selectedId: string
) {
    // Начало - центр выбранного элемента
    const startX = fromElement.x + fromElement.width / 2;
    const startY = fromElement.y + fromElement.height / 2;

    // Конец - центр целевого элемента
    const endX = toElement.x + toElement.width / 2;
    const endY = toElement.y + toElement.height / 2;

    const connectionId = `inner-${selectedId}-${toElement.name}`;

    connections.push(
        <g key={connectionId}>
            <defs>
                <marker
                    id={`arrow-${connectionId}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" />
                </marker>
            </defs>

            {/* Фиолетовая пунктирная линия для inner */}
            <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#8b5cf6"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd={`url(#arrow-${connectionId})`}
            />

            {/* Label: название */}
            <text
                x={(startX + endX) / 2}
                y={(startY + endY) / 2 - 10}
                fontSize="11"
                fill="#8b5cf6"
                fontWeight="bold"
                textAnchor="middle"
                className="pointer-events-none"
            >
                {key} (inner)
            </text>

            {/* Показываем location если есть */}
            {location && (
                <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 + 5}
                    fontSize="9"
                    fill="#8b5cf6"
                    textAnchor="middle"
                    className="pointer-events-none"
                >
                    {formatLocation(location)}
                </text>
            )}
        </g>
    );
}

// OUTER: от центра ЦЕЛЕВОГО к центру ВЫБРАННОГО
function drawOuterConnection(
    fromElement: any,
    toElement: any,
    key: string,
    location: any,
    connections: JSX.Element[],
    selectedId: string,
    targetPattern: string
) {
    // Начало - центр целевого элемента (откуда идет margin)
    const startX = toElement.x + toElement.width / 2;
    const startY = toElement.y + toElement.height / 2;

    // Конец - центр выбранного элемента (куда направлен margin)
    const endX = fromElement.x + fromElement.width / 2;
    const endY = fromElement.y + fromElement.height / 2;

    const connectionId = `outer-${selectedId}-${targetPattern}`;

    connections.push(
        <g key={connectionId}>
            <defs>
                <marker
                    id={`arrow-${connectionId}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path d="M0,0 L0,6 L9,3 z" fill="#ec4899" />
                </marker>
            </defs>

            {/* Розовая сплошная линия для outer */}
            <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#ec4899"
                strokeWidth="2"
                markerEnd={`url(#arrow-${connectionId})`}
                opacity="0.8"
            />

            {/* Label: название */}
            <text
                x={(startX + endX) / 2}
                y={(startY + endY) / 2 - 10}
                fontSize="11"
                fill="#ec4899"
                fontWeight="bold"
                textAnchor="middle"
                className="pointer-events-none"
            >
                {key} (outer)
            </text>

            {/* Показываем margins */}
            {location && (
                <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 + 5}
                    fontSize="9"
                    fill="#ec4899"
                    textAnchor="middle"
                    className="pointer-events-none"
                >
                    {formatLocation(location)}
                </text>
            )}
        </g>
    );
}

// Форматирование location для отображения
function formatLocation(location: any): string {
    if (Array.isArray(location)) {
        return location.join(', ');
    }
    if (typeof location === 'object') {
        const entries = Object.entries(location)
            .filter(([_, value]) => value !== undefined && value !== '0' && value !== 0)
            .map(([key, value]) => `${key}: ${value}`);
        return entries.length > 0 ? entries.join(', ') : '';
    }
    return String(location);
}