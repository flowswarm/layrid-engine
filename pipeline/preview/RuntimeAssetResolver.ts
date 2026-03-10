import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import type { DeploymentEnvironment } from '../deployment/deployment.types';

/**
 * RuntimeAssetResolver
 * 
 * Deterministically resolves which assets the renderer must load.
 * Separates preview/comparison tickets from live edge cache.
 * 
 * Enhanced to integrate with AssetRegistry and SiteDeploymentSync
 * for full runtimePath resolution (GLB URLs, not just asset IDs).
 */
export class RuntimeAssetResolver {

    /**
     * Original query-param based resolution (backward compatible).
     */
    static async resolve(queryParam: Record<string, string>, currentLiveSlotHash: string): Promise<{ mode: string, assetIds: string[], environment: string }> {

        // 1. Comparison Mode (Array spanning)
        if (queryParam.compare) {
            const hashes = queryParam.compare.split(',');
            return {
                mode: 'comparison',
                assetIds: hashes,
                environment: 'preview'
            };
        }

        // 2. Single Ticket Preview (Staging Override)
        if (queryParam.preview_ticket) {
            const ticketHash = await AssetRegistry.getHashFromTicket(queryParam.preview_ticket);
            return {
                mode: 'preview',
                assetIds: [ticketHash],
                environment: 'preview'
            };
        }

        // 3. Native Live Production
        return {
            mode: 'live',
            assetIds: [currentLiveSlotHash],
            environment: 'live'
        };
    }

    /**
     * Full runtime resolution — returns asset IDs AND their runtime paths (GLB URLs).
     * This is the canonical method used by AssetPipelineService.bootLiveContext().
     * 
     * Returns a payload ready to be written directly into MotionEngine.context.
     */
    static resolveForRuntime(
        registry: AssetRegistry,
        deploymentSync: SiteDeploymentSync,
        siteId: string,
        sceneRole: string = 'hero-centerpiece',
        queryParams: Record<string, string> = {}
    ): {
        mode: string;
        environment: string;
        assetIds: string[];
        assetPaths: Record<string, string>;
    } {
        // 1. Comparison mode override
        if (queryParams.compare) {
            const ids = queryParams.compare.split(',');
            const paths: Record<string, string> = {};
            for (const id of ids) {
                const record = registry.getAssetById(id);
                paths[id] = record?.runtimePath || `/models/${id}.glb`;
            }
            return { mode: 'comparison', environment: 'comparison', assetIds: ids, assetPaths: paths };
        }

        // 2. Preview ticket override
        if (queryParams.preview_ticket) {
            const id = queryParams.preview_ticket;
            const record = registry.getAssetById(id);
            const path = record?.runtimePath || `/models/${id}.glb`;
            return { mode: 'preview', environment: 'preview', assetIds: [id], assetPaths: { [id]: path } };
        }

        // 3. Live production — resolve from deployment sync
        const liveAssetId = deploymentSync.resolveLiveAssetForSite(siteId, 'production', sceneRole);
        if (liveAssetId) {
            const record = registry.getAssetById(liveAssetId);
            const path = record?.runtimePath || `/models/${liveAssetId}.glb`;
            return { mode: 'live', environment: 'live', assetIds: [liveAssetId], assetPaths: { [liveAssetId]: path } };
        }

        // 4. No live asset — empty context (procedural fallback in WebGLSceneManager)
        return { mode: 'live', environment: 'live', assetIds: [], assetPaths: {} };
    }
}

