import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Search,
  Square,
  Box,
  Grid,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { useGrammarStore, useEditorStore } from '../../../hooks/useStores';

export const PatternList: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const editorStore = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState<'all' | 'cell' | 'area' | 'array'>('all');

  // какие секции раскрыты: ключ вида "patternName:section"
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set()
  );

  const toggleSection = (patternName: string, section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      const key = `${patternName}:${section}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isSectionExpanded = (patternName: string, section: string) =>
    expandedSections.has(`${patternName}:${section}`);

  // Получаем все паттерны как плоский список
  const allPatterns = useMemo(() => {
    return grammarStore.allPatterns;
  }, [grammarStore.allPatterns]);

  // Быстрый доступ по имени
  const patternByName = useMemo(() => {
    const map = new Map<string, (typeof allPatterns)[number]>();
    allPatterns.forEach((p) => map.set(p.name, p));
    return map;
  }, [allPatterns]);

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case 'cell':
        return 'Cell';
      case 'area':
        return 'Area';
      case 'array':
        return 'Array';
      default:
        return kind;
    }
  };

  // Фильтрация по поиску и типу
  const filteredPatterns = useMemo(() => {
    return allPatterns.filter((pattern) => {
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        pattern.name.toLowerCase().includes(query) ||
        pattern.description?.toLowerCase().includes(query);

      const matchesKind = filterKind === 'all' || pattern.kind === filterKind;

      return matchesSearch && matchesKind;
    });
  }, [allPatterns, searchQuery, filterKind]);

  // Группировка по типу для статистики
  const stats = useMemo(() => {
    return {
      total: allPatterns.length,
      cell: allPatterns.filter((p) => p.kind === 'cell').length,
      area: allPatterns.filter((p) => p.kind === 'area').length,
      array: allPatterns.filter((p) => p.kind === 'array').length
    };
  }, [allPatterns]);

  const handleSelectPattern = (name: string) => {
    editorStore.selectElement(name);
  };

  const getIconForKind = (kind: string) => {
    switch (kind) {
      case 'cell':
        return <Square size={16} className="text-blue-500" />;
      case 'area':
        return <Box size={16} className="text-green-500" />;
      case 'array':
        return <Grid size={16} className="text-amber-500" />;
      default:
        return <Square size={16} className="text-gray-400" />;
    }
  };

  const getColorForKind = (kind: string) => {
    switch (kind) {
      case 'cell':
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
      case 'area':
        return 'bg-green-50 border-green-200 hover:bg-green-100';
      case 'array':
        return 'bg-amber-50 border-amber-200 hover:bg-amber-100';
      default:
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Заголовок */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Паттерны</h2>

        {/* Поиск */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Фильтры */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterKind('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterKind === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все ({stats.total})
          </button>
          <button
            onClick={() => setFilterKind('cell')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterKind === 'cell'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Cell ({stats.cell})
          </button>
          <button
            onClick={() => setFilterKind('area')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterKind === 'area'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            Area ({stats.area})
          </button>
          <button
            onClick={() => setFilterKind('array')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterKind === 'array'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Array ({stats.array})
          </button>
        </div>
      </div>

      {/* Список паттернов */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredPatterns.length > 0 ? (
          <div className="space-y-2">
            {filteredPatterns.map((pattern) => {
              const isSelected = editorStore.state.selectedElements.includes(
                pattern.name
              );

              const innerCount = pattern.inner
                ? Object.keys(pattern.inner).length
                : 0;
              const outerCount = pattern.outer
                ? Object.keys(pattern.outer).length
                : 0;

              const extendsList: string[] =
                pattern.kind === 'cell' && Array.isArray((pattern as any).extends)
                  ? ((pattern as any).extends as string[])
                  : [];

              const itemPatternName: string | null =
                pattern.kind === 'array' && (pattern as any).item_pattern
                  ? ((pattern as any).item_pattern as string)
                  : null;

              const hasExtends = extendsList.length > 0;
              const hasItemPattern = !!itemPatternName;
              const hasInner = pattern.kind === 'area' && innerCount > 0;
              const hasOuter = pattern.kind === 'area' && outerCount > 0;

              return (
                <div
                  key={pattern.name}
                  onClick={() => handleSelectPattern(pattern.name)}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${getColorForKind(pattern.kind)}
                    ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  `}
                >
                  <div className="flex items-start gap-2">
                    {/* Иконка типа */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getIconForKind(pattern.kind)}
                    </div>

                    {/* Информация о паттерне */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-900 truncate">
                          {pattern.name}
                        </h3>
                        {pattern.root && (
                          <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded font-medium">
                            ROOT
                          </span>
                        )}
                      </div>

                      {pattern.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {pattern.description}
                        </p>
                      )}

                      {/* Метаданные */}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {pattern.size && (
                          <span className="flex items-center gap-1">
                            📏 {pattern.size}
                          </span>
                        )}

                        {pattern.kind !== 'cell' &&
                          (innerCount > 0 || outerCount > 0) && (
                            <span className="flex items-center gap-1">
                              🔗 {innerCount + outerCount} связей
                            </span>
                          )}

                        {pattern.kind === 'cell' && pattern.content_type && (
                          <span className="flex items-center gap-1">
                            📝 {pattern.content_type}
                          </span>
                        )}
                      </div>

                      {/* Вложенности */}
                      <div className="mt-2 space-y-1 text-xs text-gray-700">
                        {/* Cell: Extends */}
                        {pattern.kind === 'cell' && hasExtends && (
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSection(pattern.name, 'extends');
                              }}
                              className="flex items-center gap-1 font-medium hover:text-blue-700"
                            >
                              {isSectionExpanded(pattern.name, 'extends') ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>Extends</span>
                            </button>

                            {isSectionExpanded(pattern.name, 'extends') && (
                              <ul className="mt-1 ml-4 space-y-0.5">
                                {extendsList.map((name) => {
                                  const p = patternByName.get(name);
                                  const kindLabel = p
                                    ? getKindLabel(p.kind)
                                    : 'Unknown';

                                  return (
                                    <li key={name}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectPattern(name);
                                        }}
                                        className="hover:text-blue-700"
                                      >
                                        {name} : {kindLabel}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Array: Item_pattern */}
                        {pattern.kind === 'array' && hasItemPattern && (
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSection(pattern.name, 'item_pattern');
                              }}
                              className="flex items-center gap-1 font-medium hover:text-blue-700"
                            >
                              {isSectionExpanded(
                                pattern.name,
                                'item_pattern'
                              ) ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>Item_pattern</span>
                            </button>

                            {isSectionExpanded(
                              pattern.name,
                              'item_pattern'
                            ) && (
                              <ul className="mt-1 ml-4 space-y-0.5">
                                {itemPatternName && (
                                  <li>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectPattern(itemPatternName);
                                      }}
                                      className="hover:text-blue-700"
                                    >
                                      {itemPatternName} :{' '}
                                      {getKindLabel(
                                        patternByName.get(itemPatternName)
                                          ?.kind || 'Unknown'
                                      )}
                                    </button>
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Area: Inner */}
                        {pattern.kind === 'area' && hasInner && (
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSection(pattern.name, 'inner');
                              }}
                              className="flex items-center gap-1 font-medium hover:text-green-700"
                            >
                              {isSectionExpanded(pattern.name, 'inner') ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>Inner</span>
                            </button>

                            {isSectionExpanded(pattern.name, 'inner') &&
                              pattern.inner && (
                                <ul className="mt-1 ml-4 space-y-0.5">
                                  {Object.entries(pattern.inner).map(
                                    ([key, inner]: [string, any]) => {
                                      const refName: string | undefined =
                                        inner?.pattern ||
                                        inner?.pattern_definition?.item_pattern;

                                      const refPattern = refName
                                        ? patternByName.get(refName)
                                        : undefined;

                                      const kindLabel = refPattern
                                        ? getKindLabel(refPattern.kind)
                                        : 'Unknown';

                                      return (
                                        <li key={key}>
                                          {refName ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectPattern(refName);
                                              }}
                                              className="hover:text-green-700"
                                            >
                                              {key} ({refName} : {kindLabel})
                                            </button>
                                          ) : (
                                            <span className="text-gray-500">
                                              {key} (неизвестный паттерн)
                                            </span>
                                          )}
                                        </li>
                                      );
                                    }
                                  )}
                                </ul>
                              )}
                          </div>
                        )}

                        {/* Area: Outer */}
                        {pattern.kind === 'area' && hasOuter && (
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSection(pattern.name, 'outer');
                              }}
                              className="flex items-center gap-1 font-medium hover:text-amber-700"
                            >
                              {isSectionExpanded(pattern.name, 'outer') ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>Outer</span>
                            </button>

                            {isSectionExpanded(pattern.name, 'outer') &&
                              pattern.outer && (
                                <ul className="mt-1 ml-4 space-y-0.5">
                                  {Object.entries(pattern.outer).map(
                                    ([key, outer]: [string, any]) => {
                                      const refName: string | undefined =
                                        outer?.pattern;

                                      const refPattern = refName
                                        ? patternByName.get(refName)
                                        : undefined;

                                      const kindLabel = refPattern
                                        ? getKindLabel(refPattern.kind)
                                        : 'Unknown';

                                      return (
                                        <li key={key}>
                                          {refName ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectPattern(refName);
                                              }}
                                              className="hover:text-amber-700"
                                            >
                                              {key} ({refName} : {kindLabel})
                                            </button>
                                          ) : (
                                            <span className="text-gray-500">
                                              {key} (неизвестный паттерн)
                                            </span>
                                          )}
                                        </li>
                                      );
                                    }
                                  )}
                                </ul>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Бейдж типа */}
                    <div className="flex-shrink-0">
                      <span
                        className={`
                          px-2 py-1 text-xs font-medium rounded
                          ${
                            pattern.kind === 'cell'
                              ? 'bg-blue-200 text-blue-800'
                              : ''
                          }
                          ${
                            pattern.kind === 'area'
                              ? 'bg-green-200 text-green-800'
                              : ''
                          }
                          ${
                            pattern.kind === 'array'
                              ? 'bg-amber-200 text-amber-800'
                              : ''
                          }
                        `}
                      >
                        {pattern.kind}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Search size={48} className="mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery || filterKind !== 'all'
                ? 'Паттерны не найдены'
                : 'Паттернов пока нет'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Очистить поиск
              </button>
            )}
          </div>
        )}
      </div>

      {/* Подсказка */}
      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          💡 Клик по карточке — открыть свойства. Клик по вложенному имени — перейти к этому паттерну.
        </p>
      </div>
    </div>
  );
});
