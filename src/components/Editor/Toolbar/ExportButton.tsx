import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Download } from 'lucide-react';
import { FileService } from '../../../services/FileService';
import { YamlService } from '../../../services/YamlService';
import { useGrammarStore } from '../../../hooks/useStores';

export const ExportButton: React.FC = observer(() => {
  const grammarStore = useGrammarStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Закрытие меню по клику вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasGrammar = !!grammarStore.grammar;
  const disabled = !grammarStore.hasPatterns || !hasGrammar;

  const getBaseFilename = () =>
    (grammarStore.grammar?.metadata?.name || 'grammar').trim() || 'grammar';

  const handleExportYaml = () => {
    if (disabled || !grammarStore.grammar) return;

    try {
      const yamlContent = YamlService.toYaml(grammarStore.grammar);
      const filename = `${getBaseFilename()}.yml`;

      FileService.downloadYaml(yamlContent, filename); // как и раньше
      setMenuOpen(false);
    } catch (error: any) {
      console.error('Export YAML error:', error);
      alert(`Ошибка экспорта YAML: ${error.message}`);
    }
  };

  const handleExportJson = () => {
    if (disabled || !grammarStore.grammar) return;

    try {
      // Экспорт всей grammar как есть, с metadata
      const jsonContent = JSON.stringify(grammarStore.grammar, null, 2);
      const filename = `${getBaseFilename()}.json`;

      // нужен новый метод в FileService (см. ниже)
      FileService.downloadJson(jsonContent, filename);
      setMenuOpen(false);
    } catch (error: any) {
      console.error('Export JSON error:', error);
      alert(`Ошибка экспорта JSON: ${error.message}`);
    }
  };

  const toggleMenu = () => {
    if (disabled) return;
    setMenuOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleMenu}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={18} />
        <span className="text-sm">Экспорт</span>
        <span className="text-xs opacity-80">▼</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-20">
          <button
            onClick={handleExportYaml}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex flex-col"
          >
            <span>YAML (.yml)</span>
            <span className="text-xs text-gray-500">
              Для обмена с текущим YAML-форматом
            </span>
          </button>
          <button
            onClick={handleExportJson}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex flex-col border-t border-gray-100"
          >
            <span>JSON (.json)</span>
            <span className="text-xs text-gray-500">
              Для использования в скриптах / API
            </span>
          </button>
        </div>
      )}
    </div>
  );
});
