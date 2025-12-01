import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelProps {
    children: React.ReactNode;
    side: 'left' | 'right';
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
                                                                  children,
                                                                  side,
                                                                  defaultWidth,
                                                                  minWidth,
                                                                  maxWidth,
                                                              }) => {
    const [width, setWidth] = useState(defaultWidth);
    const [isDragging, setIsDragging] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const newWidth =
                side === 'left' ? e.clientX : window.innerWidth - e.clientX;

            setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, side, minWidth, maxWidth]);

    return (
        <div
            ref={panelRef}
            style={{ width: `${width}px` }}
            className="relative flex-shrink-0 bg-white"
        >
            {children}
            <div
                onMouseDown={handleMouseDown}
                className={`absolute top-0 ${
                    side === 'left' ? 'right-0' : 'left-0'
                } w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-10 ${
                    isDragging ? 'bg-blue-500' : 'bg-transparent'
                }`}
            />
        </div>
    );
};