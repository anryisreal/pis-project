import type { Pattern } from './Pattern';

/**
 * Метаданные грамматики
 */
export interface GrammarMetadata {
    name?: string;
    description?: string;
    author?: string;
    version?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Основная структура грамматики
 */
export interface Grammar {
    // Путь к файлу с типами ячеек
    cell_types_filepath?: string;

    // Все паттерны грамматики
    patterns: Record<string, Pattern>;

    // Метаданные (опционально)
    metadata?: GrammarMetadata;
}

/**
 * Результат валидации грамматики
 */
export interface GrammarValidationResult {
    isValid: boolean;
    errors: Array<{
        severity: 'error' | 'warning';
        message: string;
        patternName?: string;
        path?: string;
    }>;
}

/**
 * Конфигурация экспорта
 */
export interface ExportConfig {
    includeMetadata: boolean;
    includeComments: boolean;
    format: 'yaml' | 'json';
}