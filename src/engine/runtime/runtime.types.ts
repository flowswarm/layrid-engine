/**
 * Layer D - Unified Runtime State.
 * The ONLY legal state contract permitted for the Motion Engine to synchronize 
 * transitions, scrolling, and WebGL Bounding topologies.
 * 
 * This is the Canonical Runtime State (codex §5).
 * No competing runtime shape should be introduced.
 * 
 * @frozen — This interface is locked. Do not add, remove, or rename fields
 * without a full convergence review across all producers and subscribers.
 * 
 * Canonical scene mode names:
 *   'logo-centerpiece' | 'layered-planes' | 'ambient' | 'none'
 * 
 * Canonical anchor naming convention:
 *   - Single centerpiece:  'headerFollow'
 *   - Comparison mode:     'headerFollow_{assetId}'
 */
export interface SharedRuntimeState {
    context: {
        siteId: string
        sceneRole: string
        assetIds: string[]
        /** Maps assetId → runtimePath (GLB URL) for WebGLSceneManager */
        assetPaths: Record<string, string>
        environment: 'live' | 'preview' | 'comparison'
        mode: 'live' | 'preview' | 'comparison'
    }

    spatial: {
        rawProgress: number
        smoothedProgress: number
        velocity: number
        direction: 'up' | 'down'
        scrollY: number
    }

    sections: Record<string, {
        progress: number
        state: 'before-enter' | 'entering' | 'active' | 'exiting' | 'passed'
    }>

    transitions: {
        phase: 'idle' | 'leaving' | 'overlap' | 'entering'
        progress: number
        fromRoute?: string
        toRoute?: string
    }

    viewport: {
        width: number
        height: number
        breakpoint: 'desktop' | 'tablet' | 'mobile'
        degradedMode: boolean
    }

    scene: {
        /** @frozen scene mode names */
        mode: 'logo-centerpiece' | 'layered-planes' | 'ambient' | 'none'
        activeCenterpieceAssetId?: string
        emphasisTarget?: string
    }

    /** 
     * Topology Anchors - Created purely by WebGL Math, Consumed purely by DOM CSS nodes.
     * 
     * @frozen anchor keys: 'headerFollow' (single), 'headerFollow_{assetId}' (comparison)
     */
    topology: {
        anchors: Record<string, { x: number, y: number }>
    }
}
