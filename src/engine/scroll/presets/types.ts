/**
 * src/engine/scroll/presets/types.ts
 * 
 * Formalized interfaces for mapping raw scroll logic (0 to 1) 
 * into complex visual output states (DOM / WebGL).
 */

/**
 * The unified output boundary for any Animation Preset.
 * Contains absolute coordinate space descriptors which the caller
 * uses to map physically to CSS or WebGL uniform matrices.
 */
export interface TransformState {
    x: number;
    y: number;
    z: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    scale: number;
    opacity: number;
}

/**
 * Baseline parameters capable of being overridden globally or locally
 * via HTML data-attributes or WebGL config nodes.
 */
export interface PresetConfig {
    // Spatial multipliers
    amplitude?: number;
    parallaxMultiplier?: number;

    // Core transforms overrides
    initialScale?: number;
    finalScale?: number;
    initialOpacity?: number;
    finalOpacity?: number;

    // Offset overrides
    xOffset?: number;
    yOffset?: number;
    zOffset?: number;

    // Custom configurations dynamically typed via indexing
    [key: string]: any;
}

/**
 * The signature of a pure mathematical function that converts a linear 
 * progress integer into compound geometrical states.
 */
export type PresetFunction = (
    progress: number, // 0.0 to 1.0 representing element visibility in viewport
    config?: PresetConfig
) => Partial<TransformState>;
