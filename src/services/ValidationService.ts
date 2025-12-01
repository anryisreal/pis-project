import type {Grammar} from '../models/Grammar';
import type {ValidationError, ValidationResult} from '../models/ValidationError';

/**
 * Клиентская валидация грамматики
 */
export class ValidationService {
    /**
     * Базовая валидация грамматики
     */
    static validate(grammar: Grammar): ValidationResult {
        const errors: ValidationError[] = [];

        // Проверка наличия паттернов
        if (!grammar.patterns || Object.keys(grammar.patterns).length === 0) {
            errors.push({
                id: this.generateErrorId(),
                severity: 'warning',
                message: 'Грамматика не содержит паттернов'
            });
        }

        // Валидация каждого паттерна
        if (grammar.patterns) {
            Object.entries(grammar.patterns).forEach(([name, pattern]) => {
                errors.push(...this.validatePattern(name, pattern, grammar));
            });
        }

        return {
            isValid: !errors.some(e => e.severity === 'error'),
            errors
        };
    }

    /**
     * Валидация паттерна
     */
    private static validatePattern(
        name: string,
        pattern: any,
        grammar: Grammar
    ): ValidationError[] {
        const errors: ValidationError[] = [];

        // Проверка обязательных полей
        if (!pattern.kind) {
            errors.push({
                id: this.generateErrorId(),
                severity: 'error',
                message: `Паттерн "${name}" не имеет поля kind`,
                elementId: name
            });
        }

        if (!pattern.description) {
            errors.push({
                id: this.generateErrorId(),
                severity: 'warning',
                message: `Паттерн "${name}" не имеет описания`,
                elementId: name
            });
        }

        // Проверка ссылок в inner
        if (pattern.inner) {
            Object.entries(pattern.inner).forEach(([, innerPattern]: [string, any]) => {
                if (innerPattern.pattern && !grammar.patterns[innerPattern.pattern]) {
                    errors.push({
                        id: this.generateErrorId(),
                        severity: 'error',
                        message: `Паттерн "${name}" ссылается на несуществующий inner элемент "${innerPattern.pattern}"`,
                        elementId: name
                    });
                }
            });
        }

        // Проверка ссылок в outer
        if (pattern.outer) {
            Object.entries(pattern.outer).forEach(([, outerPattern]: [string, any]) => {
                if (outerPattern.pattern && !grammar.patterns[outerPattern.pattern]) {
                    errors.push({
                        id: this.generateErrorId(),
                        severity: 'error',
                        message: `Паттерн "${name}" ссылается на несуществующий outer элемент "${outerPattern.pattern}"`,
                        elementId: name
                    });
                }
            });
        }

        return errors;
    }

    private static generateErrorId(): string {
        return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}