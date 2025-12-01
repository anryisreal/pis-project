import * as yaml from 'js-yaml';
import type { Grammar } from '../models/Grammar';

/**
 * Сервис для работы с YAML форматом
 */
export class YamlService {
    /**
     * Парсинг YAML в Grammar объект
     */
    static parseYaml(yamlContent: string): Grammar {
        try {
            const parsed = yaml.load(yamlContent) as any;

            // Преобразуем в Grammar формат
            const grammar: Grammar = {
                cell_types_filepath: parsed.cell_types_filepath || 'cnf/cell_types.yml',
                patterns: parsed.patterns || {},
                metadata: parsed.metadata || {
                    name: 'Imported Grammar',
                    author: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            // Нормализация patterns
            if (grammar.patterns) {
                Object.keys(grammar.patterns).forEach(key => {
                    const pattern = grammar.patterns[key];

                    // Убираем undefined значения (с явным приведением типов)
                    (Object.keys(pattern) as Array<keyof typeof pattern>).forEach(propKey => {
                        if (pattern[propKey] === undefined) {
                            delete pattern[propKey];
                        }
                    });

                    // Нормализация inner
                    if (pattern.inner) {
                        Object.keys(pattern.inner).forEach(innerKey => {
                            const inner = pattern.inner![innerKey];

                            // Если есть только pattern_definition (inline definition)
                            // оставляем его как есть - это валидный случай
                            if (inner.pattern_definition && !inner.pattern) {
                                // Inline definition - это нормально, оставляем как есть
                                // В будущем можно добавить извлечение в отдельный паттерн
                                console.log(`Pattern ${key}.${innerKey} has inline definition`);
                            }
                        });
                    }
                });
            }

            return grammar;
        } catch (error: any) {
            console.error('YAML parsing error:', error);
            throw new Error(`Ошибка парсинга YAML: ${error.message}`);
        }
    }

    /**
     * Конвертация Grammar в YAML строку
     */
    static toYaml(grammar: Grammar): string {
        try {
            // Создаем чистую копию без undefined значений
            const cleanGrammar = JSON.parse(JSON.stringify(grammar));

            // Убираем metadata при экспорте (опционально)
            if (cleanGrammar.metadata) {
                delete cleanGrammar.metadata;
            }

            return yaml.dump(cleanGrammar, {
                indent: 2,
                lineWidth: -1, // Без переноса строк
                noRefs: true,  // Без якорей
                sortKeys: false // Сохраняем порядок ключей
            });
        } catch (error: any) {
            console.error('YAML serialization error:', error);
            throw new Error(`Ошибка конвертации в YAML: ${error.message}`);
        }
    }
}

export default YamlService;