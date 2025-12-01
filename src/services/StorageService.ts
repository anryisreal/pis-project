import type { Grammar } from '../models/Grammar';

/**
 * Сервис для работы с localStorage
 */
export class StorageService {
    private static readonly GRAMMAR_KEY = 'grammar_editor_grammar';
    private static readonly AUTOSAVE_KEY = 'grammar_editor_autosave';

    /**
     * Сохранить грамматику
     */
    static saveGrammar(grammar: Grammar): void {
        try {
            localStorage.setItem(this.GRAMMAR_KEY, JSON.stringify(grammar));
        } catch (error) {
            console.error('Failed to save grammar:', error);
        }
    }

    /**
     * Загрузить грамматику
     */
    static loadGrammar(): Grammar | null {
        try {
            const data = localStorage.getItem(this.GRAMMAR_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load grammar:', error);
            return null;
        }
    }

    /**
     * Автосохранение
     */
    static autoSave(grammar: Grammar): void {
        try {
            localStorage.setItem(this.AUTOSAVE_KEY, JSON.stringify({
                grammar,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Failed to autosave:', error);
        }
    }

    /**
     * Загрузить автосохранение
     */
    static loadAutoSave(): { grammar: Grammar; timestamp: number } | null {
        try {
            const data = localStorage.getItem(this.AUTOSAVE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load autosave:', error);
            return null;
        }
    }

    /**
     * Очистить хранилище
     */
    static clear(): void {
        localStorage.removeItem(this.GRAMMAR_KEY);
        localStorage.removeItem(this.AUTOSAVE_KEY);
    }
}