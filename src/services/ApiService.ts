import axios from 'axios';
import type { Grammar } from '../models/Grammar';
import type { ValidationError } from '../models/ValidationError';

const API_URL = 'http://localhost:8080/api/grammar';

// DTO типы для API
interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

interface ValidationResponseDTO {
    isValid: boolean;
    validationResult: ValidationResult | null;
    message: string;
}

interface SyntaxCheckResponseDTO {
    isValid: boolean;
    message: string;
    errorDetails: string | null;
}

/**
 * Сервис для взаимодействия с Java бэкендом
 */
export class ApiService {
    /**
     * Health check - проверка доступности API
     */
    static async healthCheck(): Promise<string> {
        try {
            const response = await axios.get(`${API_URL}/health`);
            return response.data;
        } catch (error: any) {
            console.error('API health check error:', error);
            throw new Error('Backend недоступен');
        }
    }

    /**
     * Конвертация Grammar в YAML строку
     */
    private static grammarToYaml(grammar: Grammar): string {
        // TODO: Реализовать полноценную конвертацию в YAML
        // Пока используем JSON представление
        return JSON.stringify(grammar, null, 2);
    }

    /**
     * Валидация грамматики на сервере
     */
    static async validateGrammar(grammar: Grammar): Promise<ValidationResponseDTO> {
        try {
            const yamlContent = this.grammarToYaml(grammar);

            const response = await axios.post(`${API_URL}/validate`, {
                yamlContent,
                format: 'yaml'
            });

            return response.data;
        } catch (error: any) {
            console.error('API validation error:', error);
            throw new Error(error.response?.data?.message || 'Ошибка валидации');
        }
    }

    /**
     * Полная валидация с типами ячеек
     */
    static async validateFullGrammar(
        grammar: Grammar,
        cellTypesYaml: string
    ): Promise<ValidationResponseDTO> {
        try {
            const grammarYaml = this.grammarToYaml(grammar);

            const response = await axios.post(`${API_URL}/validate-full`, {
                grammarYaml,
                cellTypesYaml
            });

            return response.data;
        } catch (error: any) {
            console.error('Full validation error:', error);
            throw new Error(error.response?.data?.message || 'Ошибка полной валидации');
        }
    }

    /**
     * Проверка синтаксиса YAML
     */
    static async checkYamlSyntax(yamlContent: string): Promise<SyntaxCheckResponseDTO> {
        try {
            const response = await axios.post(`${API_URL}/check-syntax`, {
                yamlContent
            });
            return response.data;
        } catch (error: any) {
            console.error('API syntax check error:', error);
            throw new Error(error.response?.data?.message || 'Ошибка проверки синтаксиса');
        }
    }
}

export default ApiService;