/**
 * src/engine/scroll/presets/implementations.ts
 * 
 * Essential layout transforms resolving 0.0 - 1.0 temporal variables
 * into spatial UI matrices.
 */

import { PresetFunction, TransformState, PresetConfig } from './types';

/**
 * 1. fadeRise
 * Drops opacity to 0 and pulls Y down during intro, smoothly locking to 0 offset at Progress 1.
 */
export const fadeRise: PresetFunction = (p: number, cfg?: PresetConfig): Partial<TransformState> => {
    const yOffset = cfg?.yOffset ?? 50;
    return {
        y: yOffset * (1 - p), // Progress 0 = 50px displacement. Progress 1 = 0px
        opacity: p            // Fades in linearly
    };
};

/**
 * 2. heroIntro
 * Massive cinematic scale transition. Anchors a giant text lock into a tight bounding box locking onto Z buffer.
 */
export const heroIntro: PresetFunction = (p: number, cfg?: PresetConfig): Partial<TransformState> => {
    const initScale = cfg?.initialScale ?? 2.5;
    // Map progress to scale bridging 2.5 -> 1.0 cleanly.
    return {
        scale: initScale - ((initScale - 1) * p),
        opacity: Math.min(p * 2, 1), // Ramps opacity 2x as fast to avoid ghosting
        z: -100 * (1 - p)            // Slides forward from negative depth space
    };
};

/**
 * 3. floatingText
 * Organic continuous fluid sinusoidal motion applied while element crosses viewport limits.
 */
export const floatingText: PresetFunction = (p: number, cfg?: PresetConfig): Partial<TransformState> => {
    const amp = cfg?.amplitude ?? 15;
    // Math.sin creates the buoyancy looping. Since `p` naturally progresses, 
    // it functions seamlessly as our scalar period.
    return {
        y: Math.sin(p * Math.PI) * amp,
        rotateZ: Math.cos(p * Math.PI) * (amp / 8) // introduces a micro-rotation wobble
    };
};

/**
 * 4. layeredParallax
 * Fundamental speed differential multiplier. 
 * Allows distinct layers to translate across Y space based purely on configured multiplicative delays.
 */
export const layeredParallax: PresetFunction = (p: number, cfg?: PresetConfig): Partial<TransformState> => {
    const speed = cfg?.parallaxMultiplier ?? 0.5;
    // 0 = center screen. Modulates offset proportionally.
    const centerOffset = p - 0.5;
    return {
        y: centerOffset * (100 * speed)
    };
};

/**
 * 5. orbitReveal
 * Translates an incoming element in a circular trajectory revealing behind another anchor object.
 */
export const orbitReveal: PresetFunction = (p: number, cfg?: PresetConfig): Partial<TransformState> => {
    const radius = cfg?.xOffset ?? 100;
    // Maps progress (0 to 1) to a 180 degree half-circle arc ending at 0 degrees.
    const angle = Math.PI * (1 - p);

    return {
        x: Math.cos(angle) * radius - radius, // Ensure X locks completely at 0 ultimately
        y: Math.sin(angle) * radius,
        rotateZ: (1 - p) * -45,               // Twist counter-clockwise while dropping in
        opacity: p
    };
};
