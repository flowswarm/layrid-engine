import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

/**
 * Simple JSON file persistence.
 * Reads/writes to data/{key}.json for durable storage.
 */
export const JsonStore = {
    ensureDir(): void {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    },

    save(key: string, data: unknown): void {
        this.ensureDir();
        const filePath = path.join(DATA_DIR, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },

    load<T = unknown>(key: string): T | null {
        const filePath = path.join(DATA_DIR, `${key}.json`);
        if (!fs.existsSync(filePath)) return null;
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }
};
