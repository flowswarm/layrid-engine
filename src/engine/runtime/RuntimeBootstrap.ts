import { MotionEngine } from './MotionEngine';
import { RuntimeAssetResolver } from '../../../pipeline/preview/RuntimeAssetResolver';
import { SiteDeploymentSync } from '../../../pipeline/deployment/SiteDeploymentSync';
import { ScrollController } from '../scroll/ScrollController';
import { ScrollTimelineController } from '../scroll/ScrollTimelineController';
import { MasterRAFLoop } from './MasterRAFLoop';
import { ViewportController } from './ViewportController';
import { WebGLSceneManager } from '../webgl/WebGLSceneManager';
import { HeroAnchorFollower } from '../typography/HeroAnchorFollower';

/**
 * RuntimeBootstrap
 * 
 * The single orchestrator that wires the entire Layrid runtime.
 * Called once on page load. Connects:
 *   RuntimeAssetResolver → MotionEngine.context
 *   ViewportController → MotionEngine.viewport
 *   ScrollController → MotionEngine.spatial
 *   WebGLSceneManager → MotionEngine.topology (anchor publisher)
 *   HeroAnchorFollower → MotionEngine subscriber (DOM anchor follow)
 * 
 * Preview/comparison/live all use the same initialization path — 
 * only the resolved context values differ.
 */
export class RuntimeBootstrap {
    private masterLoop: MasterRAFLoop | null = null;
    private viewportController: ViewportController | null = null;
    private scrollController: ScrollController | null = null;
    private scrollTimeline: ScrollTimelineController | null = null;
    private webglManager: WebGLSceneManager | null = null;
    private heroFollower: HeroAnchorFollower | null = null;

    /**
     * Initialize the full runtime.
     * 
     * @param siteId - The current site/client identifier
     * @param deploymentSync - The deployment sync instance for live asset resolution
     * @param canvas - The WebGL canvas element
     * @param heroTextElement - The DOM element that follows the 3D anchor
     */
    public async initialize(
        siteId: string,
        deploymentSync: SiteDeploymentSync,
        canvas: HTMLCanvasElement,
        heroTextElement?: HTMLElement
    ): Promise<void> {
        console.log('[RuntimeBootstrap] 🚀 Initializing Layrid runtime...');

        // ─── STEP 1: Resolve asset context ───────────────────────────
        const queryParams = Object.fromEntries(new URLSearchParams(window.location.search));

        // Get the current live asset from the deployment table
        const currentLiveHash = deploymentSync.resolveLiveAssetForSite(
            siteId, 'production', 'hero-centerpiece'
        ) || '';

        // RuntimeAssetResolver determines mode based on URL params
        const resolved = await RuntimeAssetResolver.resolve(queryParams, currentLiveHash);

        console.log(`[RuntimeBootstrap] Resolved context: mode=${resolved.mode}, assets=[${resolved.assetIds.join(', ')}], env=${resolved.environment}`);

        // ─── STEP 2: Write context into MotionEngine ─────────────────
        MotionEngine.write({
            context: {
                siteId,
                sceneRole: 'hero-centerpiece',
                assetIds: resolved.assetIds,
                assetPaths: {},
                environment: resolved.environment as 'live' | 'preview' | 'comparison',
                mode: resolved.mode as 'live' | 'preview' | 'comparison'
            },
            scene: {
                mode: 'logo-centerpiece',
                activeCenterpieceAssetId: resolved.assetIds[0] || undefined
            }
        });

        // ─── STEP 3: Initialize producers ────────────────────────────
        // Viewport controller — publishes viewport dimensions + degradedMode
        this.viewportController = new ViewportController();
        this.viewportController.initialize();

        // Scroll controller — publishes spatial progress/velocity/direction
        this.scrollController = new ScrollController();
        this.scrollController.initialize();

        // Scroll timeline — publishes per-section lifecycle states
        this.scrollTimeline = new ScrollTimelineController();
        this.scrollTimeline.registerSection('hero-primary', 'heroIntro');

        // ─── STEP 4: Initialize WebGL subscriber ─────────────────────
        // WebGLSceneManager auto-subscribes to MotionEngine in its constructor.
        // It reads context.assetIds and loads centerpiece(s) via GeneratedLogoCenterpiece.
        // If no GLB exists, a procedural demo mesh is created automatically.
        this.webglManager = new WebGLSceneManager(canvas);

        // ─── STEP 5: Initialize DOM anchor follower ──────────────────
        // HeroAnchorFollower reads MotionEngine.topology.anchors.headerFollow
        // and applies lerp-smoothed CSS translate3d to the hero text element.
        if (heroTextElement) {
            this.heroFollower = new HeroAnchorFollower(heroTextElement);
            this.heroFollower.initialize();
        }

        // ─── STEP 6: Start master RAF loop ───────────────────────────
        this.masterLoop = new MasterRAFLoop(this.scrollController, this.scrollTimeline);
        this.masterLoop.start();

        console.log('[RuntimeBootstrap] ✅ Runtime fully initialized');
    }

    /**
     * Clean shutdown — disposes all subsystems in reverse order.
     */
    public dispose(): void {
        this.masterLoop?.dispose();
        this.heroFollower?.dispose();
        this.webglManager?.dispose();
        this.scrollTimeline?.dispose();
        this.scrollController?.dispose();
        this.viewportController?.dispose();

        console.log('[RuntimeBootstrap] 🛑 Runtime disposed');
    }
}
