import { MotionEngine } from '../runtime/MotionEngine';
import type { AssetRecord } from '../../../pipeline/registry/registry.types';
import type { AssetRegistry } from '../../../pipeline/registry/AssetRegistry';
import type { SiteDeploymentSync } from '../../../pipeline/deployment/SiteDeploymentSync';

/**
 * AssetPipelineService
 * 
 * The orchestration bridge connecting pipeline outputs to the proven runtime.
 * Writes exclusively through MotionEngine.write() — does NOT own state,
 * does NOT maintain a competing store, does NOT touch the renderer.
 * 
 * Responsibilities:
 *   ✅ Resolve live/preview/comparison assets from registry + deployment
 *   ✅ Write resolved context into MotionEngine (assetIds, assetPaths, mode)
 *   ✅ Handle mode transitions (live → preview → comparison → live)
 *   ✅ React to publish events (update live context immediately)
 * 
 * Must NOT:
 *   ❌ Own a competing runtime store
 *   ❌ Touch WebGLSceneManager or Three.js directly
 *   ❌ Make workflow/approval decisions
 */
export class AssetPipelineService {
    private registry: AssetRegistry;
    private deploymentSync: SiteDeploymentSync;
    private currentSiteId: string | null = null;
    private currentSceneRole: string = 'hero-centerpiece';

    constructor(registry: AssetRegistry, deploymentSync: SiteDeploymentSync) {
        this.registry = registry;
        this.deploymentSync = deploymentSync;
    }

    // ──────────────────────────────────────────────
    // CONTEXT BOOT — called on page load
    // ──────────────────────────────────────────────

    /**
     * Resolves the live asset for a site and writes it into MotionEngine.context.
     * This is the primary boot path — called once on page load.
     */
    public bootLiveContext(siteId: string, sceneRole: string = 'hero-centerpiece'): void {
        this.currentSiteId = siteId;
        this.currentSceneRole = sceneRole;

        // 1. Resolve from deployment sync (O(1) lookup)
        const liveAssetId = this.deploymentSync.resolveLiveAssetForSite(
            siteId, 'production', sceneRole
        );

        if (liveAssetId) {
            // 2. Look up the full record from registry to get runtimePath
            const record = this.registry.getAssetById(liveAssetId);
            const runtimePath = record?.runtimePath || `/models/${liveAssetId}.glb`;

            MotionEngine.write({
                context: {
                    mode: 'live',
                    environment: 'live',
                    siteId,
                    sceneRole,
                    assetIds: [liveAssetId],
                    assetPaths: { [liveAssetId]: runtimePath }
                },
                scene: {
                    mode: 'logo-centerpiece',
                    activeCenterpieceAssetId: liveAssetId
                }
            });

            console.log(`[AssetPipelineService] ⚡ Live context booted: ${liveAssetId} → ${runtimePath}`);
        } else {
            // No live asset deployed yet — boot with empty context (procedural fallback)
            MotionEngine.write({
                context: {
                    mode: 'live',
                    environment: 'live',
                    siteId,
                    sceneRole,
                    assetIds: [],
                    assetPaths: {}
                },
                scene: {
                    mode: 'logo-centerpiece',
                    activeCenterpieceAssetId: ''
                }
            });

            console.log(`[AssetPipelineService] ⚠️ No live asset for ${siteId}:${sceneRole} — procedural fallback`);
        }
    }

    // ──────────────────────────────────────────────
    // PREVIEW MODE
    // ──────────────────────────────────────────────

    /**
     * Enters preview mode for a single candidate asset.
     * Resolves the asset's runtimePath from registry and writes to MotionEngine.
     */
    public enterPreview(candidateAssetId: string): void {
        const record = this.registry.getAssetById(candidateAssetId);
        if (!record || !record.runtimePath) {
            console.error(`[AssetPipelineService] Cannot preview: asset ${candidateAssetId} not found or missing runtimePath`);
            return;
        }

        MotionEngine.write({
            context: {
                mode: 'preview',
                environment: 'preview',
                siteId: this.currentSiteId || '',
                sceneRole: this.currentSceneRole,
                assetIds: [candidateAssetId],
                assetPaths: { [candidateAssetId]: record.runtimePath }
            },
            scene: {
                mode: 'logo-centerpiece',
                activeCenterpieceAssetId: candidateAssetId
            }
        });

        console.log(`[AssetPipelineService] 👁 Preview: ${candidateAssetId} → ${record.runtimePath}`);
    }

    // ──────────────────────────────────────────────
    // COMPARISON MODE
    // ──────────────────────────────────────────────

    /**
     * Enters comparison mode for multiple candidate assets.
     * Same renderer path — only assetIds array differs.
     */
    public enterComparison(candidateAssetIds: string[]): void {
        if (candidateAssetIds.length < 2) {
            console.error('[AssetPipelineService] Comparison requires at least 2 assets');
            return;
        }

        const assetPaths: Record<string, string> = {};
        for (const id of candidateAssetIds) {
            const record = this.registry.getAssetById(id);
            assetPaths[id] = record?.runtimePath || `/models/${id}.glb`;
        }

        MotionEngine.write({
            context: {
                mode: 'comparison',
                environment: 'comparison',
                siteId: this.currentSiteId || '',
                sceneRole: this.currentSceneRole,
                assetIds: candidateAssetIds,
                assetPaths
            },
            scene: {
                mode: 'logo-centerpiece',
                activeCenterpieceAssetId: candidateAssetIds[0]
            }
        });

        console.log(`[AssetPipelineService] ⚖ Comparison: ${candidateAssetIds.join(' vs ')}`);
    }

    // ──────────────────────────────────────────────
    // EXIT TO LIVE
    // ──────────────────────────────────────────────

    /**
     * Restores live context after preview/comparison.
     */
    public exitToLive(): void {
        if (this.currentSiteId) {
            this.bootLiveContext(this.currentSiteId, this.currentSceneRole);
        }
    }

    // ──────────────────────────────────────────────
    // PUBLISH EVENT HANDLER
    // ──────────────────────────────────────────────

    /**
     * Called after ApprovalWorkflowEngine.publishAsset() completes.
     * Updates the live context to reflect the newly published asset.
     */
    public onAssetPublished(siteId: string, publishedAssetId: string): void {
        const record = this.registry.getAssetById(publishedAssetId);
        const runtimePath = record?.runtimePath || `/models/${publishedAssetId}.glb`;

        MotionEngine.write({
            context: {
                mode: 'live',
                environment: 'live',
                siteId,
                sceneRole: this.currentSceneRole,
                assetIds: [publishedAssetId],
                assetPaths: { [publishedAssetId]: runtimePath }
            },
            scene: {
                mode: 'logo-centerpiece',
                activeCenterpieceAssetId: publishedAssetId
            }
        });

        console.log(`[AssetPipelineService] 🚀 Published: ${publishedAssetId} is now live`);
    }

    // ──────────────────────────────────────────────
    // QUERY HELPERS (read-only, no state mutation)
    // ──────────────────────────────────────────────

    /**
     * Returns all preview candidates for the current site.
     */
    public getPreviewCandidates(): AssetRecord[] {
        if (!this.currentSiteId) return [];
        return this.registry.getPreviewCandidates(this.currentSiteId, this.currentSceneRole);
    }

    /**
     * Returns all approved candidates for the current site.
     */
    public getApprovedCandidates(): AssetRecord[] {
        if (!this.currentSiteId) return [];
        return this.registry.getApprovedCandidates(this.currentSiteId, this.currentSceneRole);
    }
}
