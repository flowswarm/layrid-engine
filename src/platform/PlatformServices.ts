import { AssetRegistry } from '../../pipeline/registry/AssetRegistry';
import { SiteDeploymentSync } from '../../pipeline/deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../../pipeline/workflow/ApprovalWorkflowEngine';
import { AssetPipelineService } from '../engine/services/AssetPipelineService';
import { v4 as uuidv4 } from 'uuid';

/**
 * PlatformServices
 * 
 * The singleton service layer that wires all pipeline components into
 * a unified API surface. Every platform operation flows through here.
 * 
 * Owns NO runtime state — delegates to MotionEngine via AssetPipelineService.
 * 
 * NOTE: LogoAssetJobRunner and BlenderOrchestrator are server-side only
 * (they use child_process). This module runs in the browser and simulates
 * the job runner path by writing directly to the AssetRegistry. In production,
 * the job runner runs on the server and the browser polls for status updates.
 * 
 * Service graph:
 *   Browser: PlatformServices → AssetRegistry + SiteDeploymentSync → MotionEngine
 *   Server:  LogoAssetJobRunner → BlenderOrchestrator → AssetRegistry (via API)
 */

// ─── Shared singleton instances ─────────────────────────────────
const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflowEngine = new ApprovalWorkflowEngine(registry, deploymentSync);
const assetPipeline = new AssetPipelineService(registry, deploymentSync);

// ─── Workflow tracking (maps assetId → workflowId for UI convenience) ───
const assetToWorkflow = new Map<string, string>();

/**
 * High-level orchestration methods that connect admin actions
 * to runtime effects through the full pipeline.
 */
export const PlatformServices = {
    // Direct access to individual services when needed
    registry,
    deploymentSync,
    workflowEngine,
    assetPipeline,

    // ──────────────────────────────────────────────
    // END-TO-END PIPELINE OPERATIONS
    // ──────────────────────────────────────────────

    /**
     * Step 1: Request a new logo generation.
     * 
     * In production: POST to /api/admin/jobs/create → server-side LogoJobRunner
     * In browser proof: simulates the draft creation directly in the AssetRegistry.
     */
    async requestLogo(
        siteId: string,
        familyId: string,
        request: { inputType: string; materialPreset: string; targetFilename: string;[key: string]: any },
        sceneRole: string = 'hero-centerpiece'
    ): Promise<{ jobId: string; draftAssetId: string; workflowId: string }> {
        const jobId = uuidv4();

        // Draft the asset in the registry (same as LogoJobRunner.queueJob)
        const draftAssetId = registry.draftAsset(familyId, siteId, {
            sourceType: request.inputType as any,
            materialPreset: request.materialPreset,
            compatibleSceneModes: ['logo-centerpiece'],
            isHeroEligible: true,
            supportsMotionAnchors: true,
            sourceJobId: jobId,
            sceneRole
        });

        // Initialize workflow tracking
        const workflowId = workflowEngine.initializeWorkflow(
            draftAssetId, familyId, siteId, sceneRole
        );
        assetToWorkflow.set(draftAssetId, workflowId);

        console.log(`[PlatformServices] 📋 Logo requested: job=${jobId}, asset=${draftAssetId}, workflow=${workflowId}`);
        return { jobId, draftAssetId, workflowId };
    },

    /**
     * Step 2: Mark generation complete (called after job finishes).
     */
    markGenerated(assetId: string): void {
        const wfId = assetToWorkflow.get(assetId);
        if (wfId) {
            workflowEngine.markGenerated(wfId);
            console.log(`[PlatformServices] ✅ Asset ${assetId} marked as generated`);
        }
    },

    /**
     * Step 3: Submit asset for review.
     */
    submitForReview(assetId: string, reviewerId: string = 'admin'): void {
        const wfId = assetToWorkflow.get(assetId);
        if (wfId) {
            workflowEngine.submitForReview(wfId, reviewerId);
            console.log(`[PlatformServices] 📤 Asset ${assetId} submitted for review`);
        }
    },

    /**
     * Step 4: Approve asset.
     */
    approveAsset(assetId: string, reviewerId: string = 'admin'): void {
        const wfId = assetToWorkflow.get(assetId);
        if (wfId) {
            workflowEngine.approveAsset(wfId, reviewerId);
            console.log(`[PlatformServices] ✅ Asset ${assetId} approved`);
        }
    },

    /**
     * Step 5: Publish asset → updates deployment sync → MotionEngine receives new context.
     */
    publishAsset(assetId: string, siteId: string, publisherId: string = 'admin'): void {
        const wfId = assetToWorkflow.get(assetId);
        if (wfId) {
            workflowEngine.publishAsset(wfId, publisherId, 'production');
            // Notify the runtime bridge — this writes to MotionEngine
            assetPipeline.onAssetPublished(siteId, assetId);
            console.log(`[PlatformServices] 🚀 Asset ${assetId} published to live`);
        }
    },

    /**
     * Step 6: Rollback to previous asset.
     */
    rollback(assetId: string, operatorId: string = 'admin'): void {
        const wfId = assetToWorkflow.get(assetId);
        if (wfId) {
            workflowEngine.unpublishAssetAndRollback(wfId, operatorId, 'production');
            console.log(`[PlatformServices] ⏪ Asset ${assetId} rolled back`);
        }
    },

    // ──────────────────────────────────────────────
    // RUNTIME CONTEXT SWITCHING (delegates to AssetPipelineService)
    // ──────────────────────────────────────────────

    /** Boot live context for a site (called on page load). */
    bootLive(siteId: string, sceneRole: string = 'hero-centerpiece'): void {
        assetPipeline.bootLiveContext(siteId, sceneRole);
    },

    /** Enter preview mode for a candidate asset. */
    enterPreview(assetId: string): void {
        assetPipeline.enterPreview(assetId);
    },

    /** Enter comparison mode with multiple candidates. */
    enterComparison(assetIds: string[]): void {
        assetPipeline.enterComparison(assetIds);
    },

    /** Exit preview/comparison → restore live context. */
    exitToLive(): void {
        assetPipeline.exitToLive();
    },

    // ──────────────────────────────────────────────
    // QUERY HELPERS
    // ──────────────────────────────────────────────

    /** Get the workflow ID for an asset. */
    getWorkflowId(assetId: string): string | undefined {
        return assetToWorkflow.get(assetId);
    },

    /** Get all workflow mappings (for UI display). */
    getAllWorkflows(): Map<string, string> {
        return assetToWorkflow;
    }
};

// Expose on window for DevTools inspection
if (typeof window !== 'undefined') {
    (window as any).PlatformServices = PlatformServices;
}
