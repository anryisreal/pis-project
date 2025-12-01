/**
 * Цвета элементов по типу
 */
export const ELEMENT_COLORS = {
    cell: '#3b82f6',
    area: '#10b981',
    array: '#f59e0b',
    'array-in-context': '#8b5cf6'
} as const;

/**
 * Размеры элементов на Canvas
 */
export const ELEMENT_SIZES = {
    CELL_WIDTH: 150,
    CELL_HEIGHT: 80,
    PATTERN_WIDTH: 200,
    PATTERN_HEIGHT: 120,
    SPACING: 50
} as const;

/**
 * Настройки редактора
 */
export const EDITOR_CONFIG = {
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 3,
    ZOOM_STEP: 1.2,
    AUTOSAVE_INTERVAL: 30000, // 30 секунд
    MAX_HISTORY_SIZE: 50
} as const;

/**
 * API настройки
 */
export const API_CONFIG = {
    BASE_URL: 'http://localhost:8080',
    ENDPOINTS: {
        VALIDATE: '/api/grammar/validate',
        CHECK_SYNTAX: '/api/grammar/check-syntax',
        HEALTH: '/api/grammar/health'
    }
} as const;