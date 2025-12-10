import { useEffect, useState } from 'react';
import { StoreProvider } from './hooks/useStores';
import { RootStore } from './stores/RootStore';
import { Editor } from './components/Editor/EditorWithTabs';
import { ErrorBoundary } from 'react-error-boundary';
import { StorageService } from './services/StorageService';

const rootStore = new RootStore();

function ErrorFallback({error, resetErrorBoundary}: {error: Error, resetErrorBoundary: () => void}) {
    return (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">Что-то сломалось: {error.message}</p>
            <button onClick={resetErrorBoundary} className="mt-2 px-4 py-2 bg-red-500 text-white rounded">
                Попробовать снова
            </button>
        </div>
    );
}

function AutoSaveRestore() {
    const [showRestore, setShowRestore] = useState(false);
    const [autoSaveTime, setAutoSaveTime] = useState<Date | null>(null);

    useEffect(() => {
        // Проверяем наличие автосохранения при загрузке
        const autoSave = StorageService.loadAutoSave();
        if (autoSave) {
            setAutoSaveTime(new Date(autoSave.timestamp));
            setShowRestore(true);
        }
    }, []);

    const handleRestore = () => {
        const restored = rootStore.grammarStore.restoreFromAutoSave();
        if (restored) {
            setShowRestore(false);
        }
    };

    const handleDismiss = () => {
        setShowRestore(false);
    };

    if (!showRestore) return null;

    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-4 max-w-md">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">
                        Найдено автосохранение
                    </h3>
                    <p className="text-sm text-blue-800 mb-3">
                        Обнаружена несохраненная работа от {autoSaveTime?.toLocaleString('ru-RU')}. Восстановить?
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRestore}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                            Восстановить
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 text-sm bg-white text-blue-700 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                        >
                            Начать заново
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function App() {
    return (
        <StoreProvider value={rootStore}>
            <ErrorBoundary
                FallbackComponent={ErrorFallback}
                onReset={() => { /* Reset logic if needed */ }}
            >
                <div className="w-screen h-screen overflow-hidden">
                    <AutoSaveRestore />
                    <Editor />
                </div>
            </ErrorBoundary>
        </StoreProvider>
    );
}

export default App;