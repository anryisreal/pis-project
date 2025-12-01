/**
 * Определение типа ячейки
 */
export interface CellTypeDefinition {
  description: string;
  patterns: CellPattern[];
  update_content?: 'replace_with_preprocessed' | 'clear';
}

export interface CellPattern {
  confidence: number;
  pattern: string;
  pattern_syntax: 're' | 're-spaces';
  pattern_flags?: string | number; // 'I' for case-insensitive or 0
  anchors?: 'start' | 'end' | 'both' | 'none';
  preprocess?: PreprocessOption | PreprocessOption[];
  captures?: string[];
}

export type PreprocessOption = 
  | 'fix_sparse_words'
  | 'remove_all_spaces'
  | 'remove_spaces_around_hypen';

/**
 * Набор всех типов ячеек
 */
export interface CellTypes {
  cell_types: Record<string, CellTypeDefinition>;
}