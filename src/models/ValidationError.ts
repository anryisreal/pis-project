/**
 * Ошибки валидации
 */
export interface ValidationError {
    id: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    elementId?: string; // ID проблемного элемента
    location?: ErrorLocation;
}

export interface ErrorLocation {
    line?: number;
    column?: number;
    path?: string; // JSON path к элементу
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}