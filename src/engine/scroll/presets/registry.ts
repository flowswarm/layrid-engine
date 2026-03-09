/**
 * src/engine/scroll/presets/registry.ts
 * 
 * Formalized memory directory where animation presets reside.
 * Decoupling animations into a runtime Map allows templates or 
 * dynamic user plugins to inject customized Scroll behaviors.
 */

import { PresetFunction } from './types';

export class AnimationPresetRegistry {
    private static presets: Map<string, PresetFunction> = new Map();

    /**
     * Bind a new mathematical transform resolver to a string key.
     * @param name - E.g. "heroIntro" or "fadeRise"
     * @param preset - Pure transform function tracking scroll progress
     */
    static register(name: string, preset: PresetFunction): void {
        if (this.presets.has(name)) {
            console.warn(`[PresetRegistry] Overriding existing preset: ${name}`);
        }
        this.presets.set(name, preset);
    }

    /**
     * Resolves an animation preset by standard key.
     * @param name - The identifier attached to the DOM data-attr or WebGL uniform.
     * @returns The exact function, or undefined if no preset maps structurally.
     */
    static get(name: string): PresetFunction | undefined {
        return this.presets.get(name);
    }

    /**
     * Validate physical capability.
     */
    static has(name: string): boolean {
        return this.presets.has(name);
    }

    /**
     * Utility to see all bound behaviors in memory.
     */
    static listAll(): string[] {
        return Array.from(this.presets.keys());
    }
}
