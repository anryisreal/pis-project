import { useEffect, useRef } from 'react';
import type { Grammar } from '../models/Grammar';

const AUTOSAVE_KEY = 'grammar_autosave';
const AUTOSAVE_DELAY = 1000; // 1 секунда после последнего изменения

/**
 * Хук для автоматического сохранения грамматики в localStorage
 */
export const useAutoSave = (grammar: Grammar | null, isModified: boolean) => {
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        // Сохраняем с задержкой для debounce
        if (grammar && isModified) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                try {
                    const serialized = JSON.stringify(grammar);
                    localStorage.setItem(AUTOSAVE_KEY, serialized);
                    localStorage.setItem(`${AUTOSAVE_KEY}_timestamp`, new Date().toISOString());
                    console.log('✅ Grammar autosaved to localStorage');
                } catch (error) {
                    console.error('❌ Failed to autosave grammar:', error);
                }
            }, AUTOSAVE_DELAY);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [grammar, isModified]);
};

/**
 * Загрузка грамматики из localStorage
 */
export const loadFromAutoSave = (): Grammar | null => {
    try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (!saved) return null;

        const grammar = JSON.parse(saved) as Grammar;
        const timestamp = localStorage.getItem(`${AUTOSAVE_KEY}_timestamp`);

        console.log('📂 Loaded grammar from localStorage', {
            timestamp,
            patternsCount: Object.keys(grammar.patterns || {}).length
        });

        return grammar;
    } catch (error) {
        console.error('❌ Failed to load autosaved grammar:', error);
        return null;
    }
};

/**
 * Очистка автосохранения
 */
export const clearAutoSave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(`${AUTOSAVE_KEY}_timestamp`);
    console.log('🗑️ Autosave cleared');
};