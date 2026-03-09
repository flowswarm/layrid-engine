/**
 * src/engine/scroll/presets/index.ts
 * 
 * Aggregates the Preset Library, automatically injecting the core 
 * mathematical presets into the Dictionary mapping immediately upon engine boot.
 */

import { AnimationPresetRegistry } from './registry';
import { fadeRise, heroIntro, floatingText, layeredParallax, orbitReveal } from './implementations';

export * from './types';
export { AnimationPresetRegistry };
export { fadeRise, heroIntro, floatingText, layeredParallax, orbitReveal };

// Auto-register core presets into the execution memory state
AnimationPresetRegistry.register('fadeRise', fadeRise);
AnimationPresetRegistry.register('heroIntro', heroIntro);
AnimationPresetRegistry.register('floatingText', floatingText);
AnimationPresetRegistry.register('layeredParallax', layeredParallax);
AnimationPresetRegistry.register('orbitReveal', orbitReveal);
