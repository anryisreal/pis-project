import { makeAutoObservable, reaction } from 'mobx';
import type { Grammar } from '../models/Grammar';
import type { Pattern, PatternDefinition } from '../models/Pattern';
import { StorageService } from '../services/StorageService';

export class GrammarStore {
    grammar: Grammar | null = null;
    isModified: boolean = false;
    lastSaved: Date | null = null;
    private patternCounter: number = 1;

    constructor() {
        makeAutoObservable(this);

        // ✅ Автосохранение при изменении грамматики
        reaction(
            () => this.grammar,
            (grammar) => {
                if (grammar && this.isModified) {
                    StorageService.autoSave(grammar);
                }
            },
            { delay: 1000 } // Debounce 1 секунда
        );
    }

    // Создание новой грамматики
    createNew() {
        this.grammar = {
            cell_types_filepath: 'cnf/cell_types.yml',
            patterns: {},
            metadata: {
                name: 'Новая грамматика',
                author: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
        this.patternCounter = 1;
        this.isModified = false;
        this.lastSaved = new Date();
    }

    // ✅ Загрузка грамматики с поддержкой автосохранения
    loadGrammar(grammar: Grammar) {
        this.grammar = grammar;
        this.isModified = false;
        this.lastSaved = new Date();

        const patternNumbers = Object.keys(grammar.patterns || {})
            .filter(name => name.startsWith('pattern_'))
            .map(name => parseInt(name.replace('pattern_', '')))
            .filter(num => !isNaN(num));

        this.patternCounter = patternNumbers.length > 0
            ? Math.max(...patternNumbers) + 1
            : 1;
    }

    // ✅ Восстановление из автосохранения
    restoreFromAutoSave(): boolean {
        const autoSave = StorageService.loadAutoSave();
        if (autoSave) {
            this.loadGrammar(autoSave.grammar);
            console.log('✅ Restored from autosave:', new Date(autoSave.timestamp));
            return true;
        }
        return false;
    }

    // Добавление нового паттерна
    addPattern(kind: 'cell' | 'area' | 'array') {
        if (!this.grammar) return;

        const name = `pattern_${this.patternCounter}`;
        this.patternCounter++;

        const newPattern: Pattern = {
            description: `Паттерн ${name}`,
            kind: kind,
            inner: kind !== 'cell' ? {} : undefined,
            outer: {}
        };

        this.grammar.patterns[name] = newPattern;
        this.markAsModified();

        return name;
    }

    // Обновление паттерна с очисткой при смене типа
    updatePattern(name: string, updates: Partial<Pattern>) {
        if (!this.grammar || !this.grammar.patterns || !this.grammar.patterns[name]) {
            return;
        }

        const currentPattern = this.grammar.patterns[name];
        const newPattern = { ...currentPattern, ...updates };

        // Если изменился kind - очищаем несовместимые поля
        if (updates.kind && updates.kind !== currentPattern.kind) {
            delete newPattern.content_type;
            delete newPattern.inner;
            delete newPattern.direction;
            delete newPattern.item_pattern;
            delete newPattern.item_count;
            delete newPattern.gap;

            if (updates.kind === 'cell') {
                newPattern.content_type = '';
            } else if (updates.kind === 'area') {
                newPattern.inner = {};
                newPattern.outer = {};
            } else if (updates.kind === 'array') {
                newPattern.inner = {};
                newPattern.outer = {};
                newPattern.direction = 'row';
                newPattern.item_pattern = '';
            }
        }

        this.grammar.patterns[name] = newPattern;
        this.markAsModified();
    }

    deletePattern(name: string) {
        if (!this.grammar || !this.grammar.patterns) return;

        delete this.grammar.patterns[name];
        this.markAsModified();
    }

    findPatternByName(name: string): Pattern | null {
        if (!this.grammar || !this.grammar.patterns) return null;
        return this.grammar.patterns[name] || null;
    }

    // Добавление inner элемента (ссылка на паттерн)
    addInnerElement(patternName: string, innerKey: string, innerPatternRef: string) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern || !pattern.inner) return;

        pattern.inner[innerKey] = {
            pattern: innerPatternRef,
            location: ['top', 'left', 'right', 'bottom']
        };

        this.markAsModified();
    }

    // ✅ НОВОЕ: Добавление inline definition
    addInnerInlineDefinition(
        patternName: string,
        innerKey: string,
        definition: PatternDefinition
    ) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern || !pattern.inner) return;

        pattern.inner[innerKey] = {
            pattern_definition: definition,
            location: ['top', 'left', 'right', 'bottom']
        };

        this.markAsModified();
    }

    removeInnerElement(patternName: string, innerKey: string) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern || !pattern.inner) return;

        delete pattern.inner[innerKey];
        this.markAsModified();
    }

    addOuterElement(patternName: string, outerKey: string, outerPatternRef: string) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern) return;

        if (!pattern.outer) {
            pattern.outer = {};
        }

        pattern.outer[outerKey] = {
            pattern: outerPatternRef,
            location: {
                'margin-top': '0',
                'margin-left': '0',
                'margin-right': '0',
                'margin-bottom': '0'
            }
        };

        this.markAsModified();
    }

    removeOuterElement(patternName: string, outerKey: string) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern || !pattern.outer) return;

        delete pattern.outer[outerKey];
        this.markAsModified();
    }

    updateInnerLocation(patternName: string, innerKey: string, location: any) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern || !pattern.inner || !pattern.inner[innerKey]) return;

        // Сохраняем текущую location и обновляем только переданные поля
        const currentLocation = pattern.inner[innerKey].location;

        if (typeof currentLocation === 'object' && !Array.isArray(currentLocation)) {
            pattern.inner[innerKey].location = {
                ...currentLocation,
                ...location
            };
        } else {
            pattern.inner[innerKey].location = location;
        }

        this.markAsModified();
    }

    updateOuterLocation(patternName: string, outerKey: string, location: any) {
        const pattern = this.findPatternByName(patternName);
        if (!pattern || !pattern.outer || !pattern.outer[outerKey]) return;

        // Сохраняем текущую location и обновляем только переданные поля
        const currentLocation = pattern.outer[outerKey].location;

        if (typeof currentLocation === 'object' && !Array.isArray(currentLocation)) {
            pattern.outer[outerKey].location = {
                ...currentLocation,
                ...location
            };
        } else {
            pattern.outer[outerKey].location = location;
        }

        this.markAsModified();
    }

    private markAsModified() {
        this.isModified = true;
        if (this.grammar?.metadata) {
            this.grammar.metadata.updatedAt = new Date().toISOString();
        }
    }

    get allPatterns() {
        if (!this.grammar || !this.grammar.patterns) return [];

        return Object.entries(this.grammar.patterns).map(([name, pattern]) => ({
            name,
            ...pattern
        }));
    }

    getPatternsByKind(kind: 'cell' | 'area' | 'array') {
        return this.allPatterns.filter(p => p.kind === kind);
    }

    // ✅ Дополнительный метод для обратной совместимости
    updateCellType(patternName: string, updates: Partial<Pattern>) {
        // Просто алиас для updatePattern
        this.updatePattern(patternName, updates);
    }
}