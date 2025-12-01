import React from 'react';
import { Download } from 'lucide-react';
import { FileService } from '../../../services/FileService';
import { YamlService } from '../../../services/YamlService';
import {useGrammarStore} from "../../../hooks/useStores.ts";

export const ExportButton: React.FC = () => {
  const grammarStore = useGrammarStore();

  const handleExport = () => {
    if (!grammarStore.grammar) {
      alert('Нет грамматики для экспорта');
      return;
    }

    try {
      const yamlContent = YamlService.toYaml(grammarStore.grammar);
      const filename = `${grammarStore.grammar.metadata?.name || 'grammar'}.yml`;
      
      FileService.downloadYaml(yamlContent, filename);
    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Ошибка экспорта: ${error.message}`);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={!grammarStore.grammar}
      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download size={18} />
      <span className="text-sm">Экспорт YAML</span>
    </button>
  );
};