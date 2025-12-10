import React, { useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { useGrammarStore } from '../../../hooks/useStores';
import { FileService } from '../../../services/FileService';
import { YamlService } from '../../../services/YamlService';

export const ImportButton: React.FC = () => {
  const grammarStore = useGrammarStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('=== IMPORT STARTED ===');
    console.log('1. File selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    setIsLoading(true);
    setError(null);

    try {
      // Проверка расширения файла (теперь: YAML или JSON)
      const ext = file.name.toLowerCase().split('.').pop();
      if (!ext || !['yml', 'yaml', 'json'].includes(ext)) {
        throw new Error(
          'Пожалуйста, выберите файл YAML (.yml или .yaml) или JSON (.json)'
        );
      }

      console.log('2. File validation passed (YAML/JSON)');

      // Чтение файла (как текст)
      console.log('3. Reading file...');
      const content = await FileService.loadYamlFile(file); // читает просто текст
      console.log('4. File loaded:', {
        contentLength: content.length,
        firstChars: content.substring(0, 100)
      });

      // Парсинг (универсальный: YAML или JSON)
      console.log('5. Parsing content (YAML/JSON)...');
      const grammar = YamlService.parseYaml(content);
      console.log('6. Content parsed successfully:', {
        patterns: Object.keys(grammar.patterns).length,
        cellTypesPath: grammar.cell_types_filepath,
        patternNames: Object.keys(grammar.patterns)
      });

      // Загрузка в store
      console.log('7. Loading into store...');
      grammarStore.loadGrammar(grammar);
      console.log('8. ✅ Grammar loaded into store');

      // Успешное сообщение
      const patternCount = Object.keys(grammar.patterns).length;
      alert(
        `✅ Грамматика успешно загружена!\n\nФормат: ${ext.toUpperCase()}\nПаттернов: ${patternCount}`
      );

      console.log('=== IMPORT COMPLETED ===');
    } catch (error: any) {
      console.error('=== IMPORT FAILED ===');
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        error: error
      });

      const errorMessage = error.message || 'Неизвестная ошибка';
      setError(errorMessage);

      alert(
        `❌ Ошибка импорта:\n\n${errorMessage}\n\nПроверьте консоль браузера (F12) для подробностей.`
      );
    } finally {
      setIsLoading(false);

      // Сброс input для возможности повторного выбора того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload size={18} />
        <span className="text-sm">
          {isLoading ? 'Загрузка...' : 'Импорт YAML/JSON'}
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".yml,.yaml,.json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Сообщение об ошибке */}
      {error && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex items-start gap-2">
            <AlertCircle
              size={18}
              className="text-red-600 flex-shrink-0 mt-0.5"
            />
            <div className="text-sm text-red-800">
              <p className="font-semibold mb-1">Ошибка импорта:</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
};
