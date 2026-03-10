import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AssetRegistry } from '../../pipeline/registry/AssetRegistry';
import type { LogoAssetJobRunner } from '../../pipeline/jobs/LogoJobRunner';
import type { ApprovalWorkflowEngine } from '../../pipeline/workflow/ApprovalWorkflowEngine';

/**
 * Logo Jobs API
 * 
 * POST /api/logo-jobs — Submit a new logo generation job
 * GET  /api/logo-jobs/:jobId — Poll job status
 */
export function createLogoJobsRouter(
    registry: AssetRegistry,
    jobRunner: LogoAssetJobRunner,
    workflowEngine: ApprovalWorkflowEngine
): Router {
    const router = Router();

    // ── Submit new generation job ────────────────────────────
    router.post('/', async (req, res) => {
        try {
            const { siteId, familyId, request, sceneRole = 'hero-centerpiece' } = req.body;

            if (!siteId || !request) {
                return res.status(400).json({ error: 'Missing siteId or request' });
            }

            const resolvedFamilyId = familyId || uuidv4();

            // Queue the real job (runs Blender or fallback asynchronously)
            const { jobId, draftAssetId } = await jobRunner.queueJob(
                {
                    inputType: request.inputType || 'text',
                    sourcePayload: request.sourcePayload || request.inputType === 'text' ? (request.sourcePayload || 'LOGO') : '',
                    extrusionDepth: request.extrusionDepth ?? request.depth ?? 0.15,
                    bevelDepth: request.bevelDepth ?? request.bevel ?? 0.03,
                    bevelResolution: request.bevelResolution ?? 4,
                    materialPreset: request.materialPreset || 'chrome',
                    brandColorHex: request.brandColorHex || request.brandColor,
                    targetFilename: request.targetFilename || `logo-${Date.now()}`
                },
                {
                    heroSceneModePreference: 'logo-centerpiece',
                    enableMotionAnchors: true
                },
                siteId,
                resolvedFamilyId,
                siteId,
                sceneRole
            );

            // Initialize workflow tracking
            const workflowId = workflowEngine.initializeWorkflow(
                draftAssetId, resolvedFamilyId, siteId, sceneRole
            );

            console.log(`[API] 📋 Job created: job=${jobId}, asset=${draftAssetId}, workflow=${workflowId}`);

            res.json({
                success: true,
                jobId,
                draftAssetId,
                workflowId,
                familyId: resolvedFamilyId,
                status: 'queued'
            });
        } catch (err: any) {
            console.error('[API] Job creation error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Poll job status ─────────────────────────────────
    router.get('/:jobId', (req, res) => {
        const job = jobRunner.getJob(req.params.jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If completed, also return the asset's runtimePath
        let runtimePath: string | undefined;
        if (job.status === 'completed') {
            // Find the associated draft asset by looking up the registry
            const allAssets = registry.getAllAssets();
            for (const asset of Object.values(allAssets)) {
                if (asset.sourceJobId === job.jobId) {
                    runtimePath = asset.runtimePath;
                    break;
                }
            }
        }

        res.json({
            jobId: job.jobId,
            status: job.status,
            runtimePath,
            error: job.errorDetails
        });
    });

    return router;
}
