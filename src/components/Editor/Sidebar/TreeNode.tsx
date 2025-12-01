import React from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronRight, ChevronDown, Square, Box, Grid } from 'lucide-react';
import type { TreeNode as TreeNodeModel } from '../../../models/TreeNode';

interface TreeNodeProps {
    node: TreeNodeModel;
    level: number;
    onSelect: (node: TreeNodeModel) => void;
    onToggleExpand: (node: TreeNodeModel) => void;
}

export const TreeNode: React.FC<TreeNodeProps> = observer(({
                                                               node,
                                                               level,
                                                               onSelect,
                                                               onToggleExpand,
                                                           }) => {
    const hasChildren = node.children.length > 0;

    const getIcon = () => {
        // ✅ Иконка квадрата (Square) для cell
        if (node.patternData?.kind === 'cell') {
            return <Square size={16} className="text-blue-500" />;
        }
        // Box для area
        if (node.patternData?.kind === 'area') {
            return <Box size={16} className="text-green-500" />;
        }
        // Grid для array
        if (node.patternData?.kind === 'array') {
            return <Grid size={16} className="text-amber-500" />;
        }

        // Для inner/outer элементов
        if (node.type === 'inner') {
            return <div className="w-2 h-2 rounded-full bg-purple-400" />;
        }
        if (node.type === 'outer') {
            return <div className="w-2 h-2 rounded-full bg-pink-400" />;
        }

        return <Square size={16} className="text-gray-400" />;
    };

    return (
        <div>
            <div
                className={`
                    flex items-center gap-2 px-2 py-1.5 cursor-pointer
                    hover:bg-gray-100 rounded transition-colors
                    ${node.isSelected ? 'bg-blue-100 border-l-2 border-blue-500' : ''}
                `}
                style={{ paddingLeft: `${level * 20 + 8}px` }}
                onClick={() => onSelect(node)}
            >
                {/* ✅ Expand/Collapse кнопка только если есть children */}
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                    >
                        {node.isExpanded ? (
                            <ChevronDown size={16} className="text-gray-600" />
                        ) : (
                            <ChevronRight size={16} className="text-gray-600" />
                        )}
                    </button>
                ) : (
                    <div className="w-5" />
                )}

                {/* Иконка типа */}
                <div className="flex-shrink-0">{getIcon()}</div>

                {/* Название */}
                <span
                    className={`
                        text-sm truncate flex-1
                        ${node.isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}
                    `}
                >
                    {node.name}
                </span>

                {/* Бэдж с типом паттерна */}
                {node.patternData?.kind && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 flex-shrink-0">
                        {node.patternData.kind}
                    </span>
                )}
            </div>

            {/* Дочерние элементы */}
            {node.isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onSelect={onSelect}
                            onToggleExpand={onToggleExpand}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});