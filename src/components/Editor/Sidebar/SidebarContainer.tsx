import React, { useState } from 'react';
import { List, Network } from 'lucide-react';
import { PatternList } from './PatternList';
import { PatternGraph } from './PatternGraph';

type ViewMode = 'list' | 'graph';

export const SidebarContainer: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Переключатель режимов */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
                <div className="flex p-2 gap-2">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`
                            flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                            font-medium text-sm transition-all
                            ${viewMode === 'list'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            }
                        `}
                    >
                        <List size={18} />
                        <span>Список</span>
                    </button>
                    
                    <button
                        onClick={() => setViewMode('graph')}
                        className={`
                            flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                            font-medium text-sm transition-all
                            ${viewMode === 'graph'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            }
                        `}
                    >
                        <Network size={18} />
                        <span>Граф</span>
                    </button>
                </div>
            </div>

            {/* Контент */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'list' ? <PatternList /> : <PatternGraph />}
            </div>
        </div>
    );
};
