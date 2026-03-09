/**
 * Layer D - Unified Runtime State.
 * The ONLY legal state contract permitted for the Motion Engine to synchronize 
 * transitions, scrolling, and WebGL Bounding topologies.
 * 
 * This is the Canonical Runtime State (codex §5).
 * No competing runtime shape should be introduced.
 */
export interface SharedRuntimeState {
    context: {
        siteId: string
        sceneRole: 'hero-centerpiece' | 'ambient'
        assetIds: string[]
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
        mode: 'logo-centerpiece' | 'layered-planes' | 'ambient' | 'none'
        activeCenterpieceAssetId?: string
        emphasisTarget?: string
    }

    /** 
     * Topology Anchors - Created purely by WebGL Math, Consumed purely by DOM CSS nodes 
     */
    topology: {
        anchors: Record<string, { x: number, y: number }>
    }
}
