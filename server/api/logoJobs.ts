import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import type { AssetRegistry } from '../../pipeline/registry/AssetRegistry';
import type { LogoAssetJobRunner } from '../../pipeline/jobs/LogoJobRunner';
import type { ApprovalWorkflowEngine } from '../../pipeline/workflow/ApprovalWorkflowEngine';

// ── Multer config: save SVGs to public/uploads/ ───────────
const upload = multer({ dest: path.resolve(process.cwd(), 'public/uploads/') });

/**
 * Logo Jobs API
 * 
 * POST /api/logo-jobs — Submit a new logo generation job (JSON or multipart)
 * GET  /api/logo-jobs/:jobId — Poll job status
 */
export function createLogoJobsRouter(
    registry: AssetRegistry,
    jobRunner: LogoAssetJobRunner,
    workflowEngine: ApprovalWorkflowEngine,
    workflowMap: Map<string, string>
): Router {
    const router = Router();

    // ── Submit new generation job ────────────────────────────
    // multer parses multipart/form-data; for plain JSON posts req.file is undefined
    router.post('/', upload.single('svgFile'), async (req, res) => {
        try {
            // FormData sends `request` as a JSON string; plain JSON sends it as an object
            const rawRequest = typeof req.body.request === 'string'
                ? JSON.parse(req.body.request)
                : req.body.request;

            const siteId = req.body.siteId;
            const familyId = req.body.familyId;
            const request = rawRequest;
            const sceneRole = req.body.sceneRole || 'hero-centerpiece';

            // If an SVG file was uploaded, use the saved disk path as sourcePayload
            const svgPath = req.file ? path.resolve(req.file.path) : undefined;
            if (svgPath) {
                console.log(`[API] 📁 SVG file saved: ${svgPath}`);
            }

            if (!siteId || !request) {
                return res.status(400).json({ error: 'Missing siteId or request' });
            }

            const resolvedFamilyId = familyId || uuidv4();
            const sourcePayload = svgPath || request.sourcePayload || 'LOGO';

            // Queue the real job (runs Blender or fallback asynchronously)
            const { jobId, draftAssetId } = await jobRunner.queueJob(
                {
                    inputType: request.inputType || 'text',
                    sourcePayload,
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

            // Persist assetId → workflowId so /api/publish can look it up
            workflowMap.set(draftAssetId, workflowId);

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
