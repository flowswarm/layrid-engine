import { MotionEngine } from '../engine/runtime/MotionEngine';

/**
 * PlatformServices
 * 
 * The singleton service layer connecting Studio UI to the real backend.
 * All pipeline operations flow through HTTP API calls to the Express server.
 * 
 * Owns NO runtime state — delegates to MotionEngine for context writing.
 * No longer instantiates AssetRegistry, SiteDeploymentSync, or ApprovalWorkflowEngine
 * in the browser. These are server-only. The browser communicates exclusively through HTTP.
 */
export const PlatformServices = {

    // ──────────────────────────────────────────────
    // END-TO-END PIPELINE OPERATIONS (HTTP)
    // ──────────────────────────────────────────────

    /**
 * Step 1: Request a new logo generation via the backend.
 * POST /api/logo-jobs → server-side LogoJobRunner
 *
 * When an SVG File is provided, the request is sent as multipart/form-data
 * so the actual file bytes reach the server. For text-only jobs the
 * existing JSON path is preserved.
 */
    async requestLogo(
        siteId: string,
        familyId: string,
        request: { inputType: string; materialPreset: string; targetFilename: string;[key: string]: any },
        sceneRole: string = 'hero-centerpiece',
        svgFile?: File
    ): Promise<{ jobId: string; draftAssetId: string; workflowId: string; familyId: string }> {
        let response: Response;

        if (svgFile) {
            // Multipart upload — server parses `request` from the JSON string field
            const form = new FormData();
            form.append('siteId', siteId);
            form.append('familyId', familyId);
            form.append('sceneRole', sceneRole);
            form.append('request', JSON.stringify(request));
            form.append('svgFile', svgFile);
            response = await fetch('/api/logo-jobs', { method: 'POST', body: form });
        } else {
            // Standard JSON body (text-mode jobs)
            response = await fetch('/api/logo-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, familyId, request, sceneRole })
            });
        }

        if (!response.ok) throw new Error(`Job creation failed: ${response.statusText}`);
        return response.json();
    },

    /**
     * Step 2: Poll job status until completed or failed.
     * GET /api/logo-jobs/:jobId
     */
    async pollJobStatus(jobId: string): Promise<{
        jobId: string;
        status: string;
        runtimePath?: string;
        error?: any;
    }> {
        const response = await fetch(`/api/logo-jobs/${jobId}`);
        if (!response.ok) throw new Error(`Job status poll failed: ${response.statusText}`);
        return response.json();
    },

    /**
     * Poll until job is done (completed or failed). Returns final status.
     */
    async waitForJob(jobId: string, onPoll?: (status: string) => void): Promise<{
        status: string;
        runtimePath?: string;
        error?: any;
    }> {
        const MAX_POLLS = 60;
        const INTERVAL_MS = 1000;

        for (let i = 0; i < MAX_POLLS; i++) {
            const result = await this.pollJobStatus(jobId);
            if (onPoll) onPoll(result.status);

            if (result.status === 'completed' || result.status === 'failed') {
                return result;
            }

            await new Promise(r => setTimeout(r, INTERVAL_MS));
        }

        throw new Error('Job polling timed out');
    },

    /**
     * Step 3: Advance workflow (generate → review → approve).
     * POST /api/workflow/advance
     */
    async advanceWorkflow(assetId: string, step: string, reviewerId: string = 'admin'): Promise<{
        success: boolean;
        workflowId: string;
        state: string;
    }> {
        const response = await fetch('/api/workflow/advance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetId, step, reviewerId })
        });
        if (!response.ok) throw new Error(`Workflow advance failed: ${response.statusText}`);
        return response.json();
    },

    /**
     * Step 4: Publish asset → updates deployment sync on server.
     * POST /api/publish
     */
    async publishAsset(assetId: string, siteId: string, publisherId: string = 'admin'): Promise<{
        success: boolean;
        liveAssetId: string;
        runtimePath: string;
    }> {
        const response = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetId, siteId, publisherId })
        });
        if (!response.ok) throw new Error(`Publish failed: ${response.statusText}`);
        return response.json();
    },

    /**
     * Fetch all assets for a site.
     * GET /api/assets/:siteId
     */
    async fetchAssets(siteId: string): Promise<any[]> {
        const response = await fetch(`/api/assets/${siteId}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.assets || [];
    },

    /**
     * Get live asset info for boot context.
     * GET /api/live-asset/:siteId
     */
    async getLiveAsset(siteId: string): Promise<{ liveAssetId: string | null; runtimePath: string | null }> {
        const response = await fetch(`/api/live-asset/${siteId}`);
        if (!response.ok) return { liveAssetId: null, runtimePath: null };
        return response.json();
    },

    // ──────────────────────────────────────────────
    // RUNTIME CONTEXT SWITCHING (writes to MotionEngine)
    // ──────────────────────────────────────────────

    /** Boot live context for a site (called on page load). */
    async bootLive(siteId: string, sceneRole: string = 'hero-centerpiece'): Promise<void> {
        const { liveAssetId, runtimePath } = await this.getLiveAsset(siteId);

        if (liveAssetId && runtimePath) {
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
            console.log(`[PlatformServices] ⚡ Live context booted: ${liveAssetId} → ${runtimePath}`);
        } else {
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
            console.log(`[PlatformServices] ⚠️ No live asset — procedural fallback`);
        }
    },

    /** Enter preview mode for a candidate asset. */
    enterPreview(assetId: string, runtimePath: string, siteId: string, sceneRole: string = 'hero-centerpiece'): void {
        MotionEngine.write({
            context: {
                mode: 'preview',
                environment: 'preview',
                siteId,
                sceneRole,
                assetIds: [assetId],
                assetPaths: { [assetId]: runtimePath }
            },
            scene: {
                mode: 'logo-centerpiece',
                activeCenterpieceAssetId: assetId
            }
        });
        console.log(`[PlatformServices] 👁 Preview: ${assetId} → ${runtimePath}`);
    },

    /** Enter comparison mode with multiple candidates. */
    enterComparison(candidates: Array<{ id: string; runtimePath: string }>, siteId: string, sceneRole: string = 'hero-centerpiece'): void {
        const assetIds = candidates.map(c => c.id);
        const assetPaths: Record<string, string> = {};
        for (const c of candidates) assetPaths[c.id] = c.runtimePath;

        MotionEngine.write({
            context: {
                mode: 'comparison',
                environment: 'comparison',
                siteId,
                sceneRole,
                assetIds,
                assetPaths
            },
            scene: {
                mode: 'logo-centerpiece',
                activeCenterpieceAssetId: assetIds[0]
            }
        });
        console.log(`[PlatformServices] ⚖ Comparison: ${assetIds.join(' vs ')}`);
    },

    /** Exit preview/comparison → restore live context. */
    async exitToLive(siteId: string, sceneRole: string = 'hero-centerpiece'): Promise<void> {
        await this.bootLive(siteId, sceneRole);
    }
};

// Expose on window for DevTools inspection
if (typeof window !== 'undefined') {
    (window as any).PlatformServices = PlatformServices;
}
