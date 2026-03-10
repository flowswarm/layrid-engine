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

/**
 * A Map that auto-persists to disk via JsonStore on every mutation.
 * Replaces the fragile monkey-patching of Map.prototype.set.
 */
export class PersistentMap<K extends string, V> extends Map<K, V> {
    constructor(private persistKey: string, init?: Record<string, V>) {
        super(init ? Object.entries(init) as [K, V][] : []);
    }

    set(k: K, v: V): this {
        super.set(k, v);
        JsonStore.save(this.persistKey, Object.fromEntries(this));
        return this;
    }

    delete(k: K): boolean {
        const result = super.delete(k);
        if (result) JsonStore.save(this.persistKey, Object.fromEntries(this));
        return result;
    }
}
