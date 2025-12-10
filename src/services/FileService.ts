/**
 * Сервис для работы с файлами
 */
export class FileService {
    /**
     * Загрузка YAML файла
     */
    static async loadYamlFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target?.result as string;
                resolve(content);
            };

            reader.onerror = () => {
                reject(new Error('Ошибка чтения файла'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Скачивание YAML файла
     */
    static downloadYaml(content: string, filename: string = 'grammar.yml') {
        const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    /**
     * Валидация расширения файла
     */
    static isValidYamlFile(file: File): boolean {
        const validExtensions = ['.yml', '.yaml'];
        return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    // новый метод для JSON
    static downloadJson(content: string, filename: string) {
        const blob = new Blob([content], {
        type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }
}