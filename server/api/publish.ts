import { Router } from 'express';
import type { AssetRegistry } from '../../pipeline/registry/AssetRegistry';
import type { SiteDeploymentSync } from '../../pipeline/deployment/SiteDeploymentSync';
import type { ApprovalWorkflowEngine } from '../../pipeline/workflow/ApprovalWorkflowEngine';

/**
 * Publish + Workflow + Asset Query API
 * 
 * POST /api/publish        — Publish an approved asset to live
 * POST /api/workflow/advance — Advance workflow state (generate → review → approve)
 * GET  /api/live-asset/:siteId — Get live asset for site boot context
 * GET  /api/assets/:siteId — Get all assets for a site
 */
export function createPublishRouter(
    registry: AssetRegistry,
    deploymentSync: SiteDeploymentSync,
    workflowEngine: ApprovalWorkflowEngine,
    workflowMap: Map<string, string> // assetId → workflowId
): Router {
    const router = Router();

    // ── Publish asset to live ─────────────────────────────
    router.post('/publish', (req, res) => {
        try {
            const { assetId, siteId, publisherId = 'admin' } = req.body;
            if (!assetId || !siteId) return res.status(400).json({ error: 'Missing assetId or siteId' });

            const workflowId = workflowMap.get(assetId);
            if (!workflowId) return res.status(404).json({ error: 'No workflow found for asset' });

            workflowEngine.publishAsset(workflowId, publisherId, 'production');

            // Return the confirmed live mapping
            const liveAssetId = deploymentSync.resolveLiveAssetForSite(siteId, 'production', 'hero-centerpiece');
            const liveRecord = liveAssetId ? registry.getAssetById(liveAssetId) : undefined;

            console.log(`[API] 🚀 Published asset ${assetId} for site ${siteId}`);

            res.json({
                success: true,
                liveAssetId,
                runtimePath: liveRecord?.runtimePath
            });
        } catch (err: any) {
            console.error('[API] Publish error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Advance workflow ──────────────────────────────────
    router.post('/workflow/advance', (req, res) => {
        try {
            const { assetId, step, reviewerId = 'admin' } = req.body;
            if (!assetId || !step) return res.status(400).json({ error: 'Missing assetId or step' });

            const workflowId = workflowMap.get(assetId);
            if (!workflowId) return res.status(404).json({ error: 'No workflow found for asset' });

            switch (step) {
                case 'generate':
                    workflowEngine.markGenerated(workflowId);
                    break;
                case 'review':
                    workflowEngine.submitForReview(workflowId, reviewerId);
                    break;
                case 'approve':
                    workflowEngine.approveAsset(workflowId, reviewerId);
                    break;
                default:
                    return res.status(400).json({ error: `Unknown step: ${step}` });
            }

            const workflow = workflowEngine.getWorkflow(workflowId);

            console.log(`[API] ✅ Workflow advanced: asset=${assetId}, step=${step}, state=${workflow?.state}`);
            res.json({ success: true, workflowId, state: workflow?.state });
        } catch (err: any) {
            console.error('[API] Workflow advance error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Get live asset for boot context ───────────────────
    router.get('/live-asset/:siteId', (req, res) => {
        const { siteId } = req.params;
        const liveAssetId = deploymentSync.resolveLiveAssetForSite(siteId, 'production', 'hero-centerpiece');

        if (!liveAssetId) {
            return res.json({ liveAssetId: null, runtimePath: null });
        }

        const record = registry.getAssetById(liveAssetId);
        res.json({
            liveAssetId,
            runtimePath: record?.runtimePath || null
        });
    });

    // ── Get all assets for a site ─────────────────────────
    router.get('/assets/:siteId', (req, res) => {
        const { siteId } = req.params;
        const allAssets = registry.getAllAssets();

        const siteAssets = Object.values(allAssets)
            .filter(a => a.clientId === siteId)
            .map(a => ({
                id: a.assetId,
                familyId: a.assetFamilyId,
                name: a.exportFilename || a.assetId,
                material: a.materialPreset,
                status: a.status,
                runtimePath: a.runtimePath,
                createdAt: a.createdAt,
                workflowId: workflowMap.get(a.assetId),
                workflowState: workflowMap.has(a.assetId)
                    ? workflowEngine.getWorkflow(workflowMap.get(a.assetId)!)?.state
                    : undefined
            }));

        res.json({ assets: siteAssets });
    });

    return router;
}
