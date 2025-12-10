import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Toolbar } from './Toolbar/Toolbar';
import { SidebarContainer } from './Sidebar/SidebarContainer';
import { CanvasStage } from './Canvas/CanvasStage';
import { PropertiesPanel } from './Properties/PropertiesPanel';
import { ResizablePanel } from '../Common/ResizablePanel';
import { useGrammarStore } from '../../hooks/useStores';

export const Editor: React.FC = observer(() => {
    const grammarStore = useGrammarStore();

    useEffect(() => {
        // Создаём пустую грамматику при старте
        if (!grammarStore.grammar) {
            grammarStore.createNew();
        }
    }, [grammarStore]);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Toolbar */}
            <Toolbar />

            {/* Main content */}
            <div className="flex flex-1 overflow-hidden">
                {/* ✅ Left Sidebar - Tree with Resize */}
                <ResizablePanel
                    side="left"
                    defaultWidth={300}
                    minWidth={200}
                    maxWidth={600}
                >
                    <div className="h-full border-r border-gray-200 bg-white overflow-hidden">
                        <SidebarContainer />
                    </div>
                </ResizablePanel>

                {/* Center - Canvas */}
                <div className="flex-1 overflow-hidden">
                    <CanvasStage />
                </div>

                {/* ✅ Right Sidebar - Properties with Resize */}
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
            </div>
        </div>
    );
});