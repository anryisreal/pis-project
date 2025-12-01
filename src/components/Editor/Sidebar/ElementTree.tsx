import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Search, ChevronRight, ChevronDown, FolderOpen, FileCode } from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';
import { TreeNode as TreeNodeComponent } from './TreeNode';
import type { TreeNode as TreeNodeModel } from '../../../models/TreeNode';
import { v4 as uuidv4 } from 'uuid';

export const ElementTree: React.FC = observer(() => {
    const grammarStore = useGrammarStore();
    const editorStore = useEditorStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState({
        patterns: true,
        cellTypes: false
    });

    // Построение дерева из грамматики
    const treeData = useMemo(() => {
        if (!grammarStore.grammar) return { patterns: [], cellTypes: [] };

        const patternNodes: TreeNodeModel[] = Object.entries(
            grammarStore.grammar.patterns || {}
        ).map(([name, pattern]) => buildTreeNode(name, pattern, 'pattern', grammarStore.grammar));

        const cellTypeNodes: TreeNodeModel[] = [];

        return {
            patterns: patternNodes,
            cellTypes: cellTypeNodes
        };
    }, [grammarStore.grammar]);

    function buildTreeNode(
        name: string,
        pattern: any,
        type: 'pattern' | 'cell_type',
        grammar: any
    ): TreeNodeModel {
        const nodeId = `${type}-${name}-${uuidv4()}`;
        const children: TreeNodeModel[] = [];

        // Добавляем inner элементы
        if (pattern.inner) {
            Object.entries(pattern.inner).forEach(([key, innerData]: [string, any], index: number) => {
                const innerNode: TreeNodeModel = {
                    id: `inner-${key}-${nodeId}-${index}`,
                    name: `${key} (inner)`,
                    type: 'inner',
                    icon: 'folder',
                    children: [],
                    parent: null,
                    level: 0,
                    isExpanded: false,
                    isSelected: false,
                    elementId: nodeId,
                    patternKey: key,
                    patternData: innerData
                };

                // Если есть вложенный паттерн, добавляем его как child
                if (innerData.pattern && grammar?.patterns) {
                    const referencedPattern = grammar.patterns[innerData.pattern];
                    if (referencedPattern) {
                        innerNode.children.push(
                            buildTreeNode(innerData.pattern, referencedPattern, 'pattern', grammar)
                        );
                    }
                }

                children.push(innerNode);
            });
        }

        // Добавляем outer элементы
        if (pattern.outer) {
            Object.entries(pattern.outer).forEach(([key, outerData]: [string, any], index: number) => {
                const outerNode: TreeNodeModel = {
                    id: `outer-${key}-${nodeId}-${index}`,
                    name: `${key} (outer)`,
                    type: 'outer',
                    icon: 'link',
                    children: [],
                    parent: null,
                    level: 0,
                    isExpanded: false,
                    isSelected: false,
                    elementId: nodeId,
                    patternKey: key,
                    patternData: outerData
                };
                children.push(outerNode);
            });
        }

        return {
            id: nodeId,
            name,
            type,
            icon: type === 'pattern' ? 'box' : 'file',
            children,
            parent: null,
            level: 0,
            isExpanded: false,
            isSelected: false,
            elementId: nodeId,
            patternKey: name,
            patternData: pattern
        };
    }

    // Фильтрация по поиску
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) return treeData;

        const filterNodes = (nodes: TreeNodeModel[]): TreeNodeModel[] => {
            return nodes
                .filter(node =>
                    node.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map(node => ({
                    ...node,
                    children: filterNodes(node.children)
                }));
        };

        return {
            patterns: filterNodes(treeData.patterns),
            cellTypes: filterNodes(treeData.cellTypes)
        };
    }, [treeData, searchQuery]);

    // ✅ ОБНОВЛЕНО: При выборе узла открываются его свойства
    const handleSelectNode = (node: TreeNodeModel) => {
        // Если это паттерн верхнего уровня, используем patternKey (имя паттерна)
        if (node.type === 'pattern' && node.patternKey) {
            editorStore.selectElement(node.patternKey);
        } else if (node.elementId) {
            // Для других типов используем elementId
            editorStore.selectElement(node.elementId);
        }
    };

    const handleToggleExpand = (node: TreeNodeModel) => {
        node.isExpanded = !node.isExpanded;
    };

    const toggleSection = (section: 'patterns' | 'cellTypes') => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Заголовок */}
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Структура</h2>

                {/* Поиск */}
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Поиск..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                </div>
            </div>

            {/* Дерево */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* Секция: Patterns */}
                <div className="mb-4">
                    <div
                        className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-gray-50 rounded"
                        onClick={() => toggleSection('patterns')}
                    >
                        {expandedSections.patterns ? (
                            <ChevronDown size={18} className="text-gray-600" />
                        ) : (
                            <ChevronRight size={18} className="text-gray-600" />
                        )}
                        <FolderOpen size={18} className="text-blue-500" />
                        <span className="font-medium text-gray-700">
                            Паттерны ({filteredTree.patterns.length})
                        </span>
                    </div>

                    {expandedSections.patterns && (
                        <div className="mt-1">
                            {filteredTree.patterns.length > 0 ? (
                                filteredTree.patterns.map(node => (
                                    <TreeNodeComponent
                                        key={node.id}
                                        node={node}
                                        level={1}
                                        onSelect={handleSelectNode}
                                        onToggleExpand={handleToggleExpand}
                                    />
                                ))
                            ) : (
                                <div className="px-4 py-2 text-sm text-gray-500">
                                    Паттерны не найдены
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Секция: Cell Types */}
                <div>
                    <div
                        className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-gray-50 rounded"
                        onClick={() => toggleSection('cellTypes')}
                    >
                        {expandedSections.cellTypes ? (
                            <ChevronDown size={18} className="text-gray-600" />
                        ) : (
                            <ChevronRight size={18} className="text-gray-600" />
                        )}
                        <FileCode size={18} className="text-green-500" />
                        <span className="font-medium text-gray-700">
                            Типы ячеек ({filteredTree.cellTypes.length})
                        </span>
                    </div>

                    {expandedSections.cellTypes && (
                        <div className="mt-1">
                            {filteredTree.cellTypes.length > 0 ? (
                                filteredTree.cellTypes.map(node => (
                                    <TreeNodeComponent
                                        key={node.id}
                                        node={node}
                                        level={1}
                                        onSelect={handleSelectNode}
                                        onToggleExpand={handleToggleExpand}
                                    />
                                ))
                            ) : (
                                <div className="px-4 py-2 text-sm text-gray-500">
                                    Загрузите cell_types.yml
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Подсказка */}
            <div className="p-3 bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                    💡 Клик - выбрать и открыть свойства
                </p>
            </div>
        </div>
    );
});