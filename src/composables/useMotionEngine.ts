import { MotionEngine } from '../engine/runtime/MotionEngine';

/**
 * Composable hook providing access to the canonical MotionEngine singleton.
 * Used by Vue components and any module needing to read/write/subscribe 
 * to the shared runtime state.
 */
export function useMotionEngine() {
    return MotionEngine;
}
