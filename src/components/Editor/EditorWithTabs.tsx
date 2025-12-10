import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Layout, Network } from 'lucide-react';
import { Toolbar } from './Toolbar/Toolbar';
import { PatternList } from './Sidebar/PatternList';
import { CanvasStage } from './Canvas/CanvasStage';
import { FullScreenPatternGraph } from './Graph/FullScreenPatternGraph';
import { PropertiesPanel } from './Properties/PropertiesPanel';
import { ResizablePanel } from '../Common/ResizablePanel';
import { useGrammarStore } from '../../hooks/useStores';

type EditorView = 'canvas' | 'graph';

export const Editor: React.FC = observer(() => {
    const grammarStore = useGrammarStore();
    const [activeView, setActiveView] = useState<EditorView>('canvas');

    useEffect(() => {
        if (!grammarStore.grammar) {
            grammarStore.createNew();
        }
    }, [grammarStore]);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Toolbar */}
            <Toolbar />

            {/* Tabs */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200">
                <div className="flex gap-1 px-2 pt-2">
                    <button
                        onClick={() => setActiveView('canvas')}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all
                            ${activeView === 'canvas'
                                ? 'bg-gray-50 text-blue-600 border-t-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }
                        `}
                    >
                        <Layout size={18} />
                        <span>Редактор (Canvas)</span>
                    </button>
                    
                    <button
                        onClick={() => setActiveView('graph')}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all
                            ${activeView === 'graph'
                                ? 'bg-gray-50 text-blue-600 border-t-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }
                        `}
                    >
                        <Network size={18} />
                        <span>Граф связей</span>
                        {grammarStore.allPatterns.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                {grammarStore.allPatterns.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Показываем сайдбар только для Canvas view */}
                {activeView === 'canvas' && (
                    <ResizablePanel
                        side="left"
                        defaultWidth={300}
                        minWidth={200}
                        maxWidth={600}
                    >
                        <div className="h-full border-r border-gray-200 bg-white overflow-hidden">
                            <PatternList />
                        </div>
                    </ResizablePanel>
                )}

                {/* Center - Canvas или Graph */}
                <div className="flex-1 overflow-hidden">
                    {activeView === 'canvas' ? (
                        <CanvasStage />
                    ) : (
                        <FullScreenPatternGraph />
                    )}
                </div>

                {/* Показываем панель свойств только для Canvas view */}
                {activeView === 'canvas' && (
                    <ResizablePanel
                        side="right"
                        defaultWidth={350}
                        minWidth={250}
                        maxWidth={700}
                    >
                        <div className="h-full border-l border-gray-200 bg-white overflow-hidden">
                            <PropertiesPanel />
                        </div>
                    </ResizablePanel>
                )}
            </div>
        </div>
    );
});
