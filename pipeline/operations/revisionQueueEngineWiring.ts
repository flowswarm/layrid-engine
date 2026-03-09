/**
 * pipeline/operations/revisionQueueEngineWiring.ts
 * 
 * Demonstrates how the Revision Queue Dashboard physically integrates into the 
 * existing engine: Feedback -> Queue -> Job -> Generated Asset -> Preview -> Publish.
 * 
 * This shows the complete end-to-end lifecycle tracked within a single Queue Item.
 */

import { RevisionQueueManager } from './RevisionQueueManager';
import { FeedbackManager } from '../feedback/FeedbackManager';
import { LogoJobRunner } from '../jobs/LogoJobRunner';
import { AssetRegistry } from '../registry/AssetRegistry';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ComparisonSessionManager } from '../preview/ComparisonSessionManager';
import { ClientApprovalManager } from '../preview/ClientApprovalManager';

// --- System Initialization ---
const registry = new AssetRegistry();
const runner = new LogoJobRunner(registry);
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const comparisonManager = new ComparisonSessionManager(workflow, deploymentSync);
const approvalManager = new ClientApprovalManager(workflow, deploymentSync);

const feedbackManager = new FeedbackManager(runner, registry);
const queueManager = new RevisionQueueManager(feedbackManager, runner, registry, workflow);


// --- 1. Feedback creates or updates a revision queue item ---
// --- 2. Queue Item links to Source Asset & Asset Family ---
export function demonstrateFeedbackToQueueLinkage() {
    const siteId = 'demo-site';
    const familyId = 'fam-base';
    const sourceAssetId = registry.draftAsset(familyId, siteId, { materialPreset: 'chrome' });

    // Client Submits "Make it thicker" against `sourceAssetId`
    const feedback = feedbackManager.submitFeedback(
        siteId, sourceAssetId, familyId, 'client@corp.root',
        'Make this thicker', 'revision-request',
        { thicknessDelta: +0.5 }
    );

    // The Dashboard Hook automatically captures the Feedback ID and Links the Asset ID
    const queueItem = queueManager.createRevisionQueueItem(
        siteId, 'hero-centerpiece', sourceAssetId, familyId, feedback.feedbackId, 'high'
    );

    console.log("Queue Ticket Created:", queueItem.revisionQueueItemId);
    console.log("-> Linked Feedback:", queueItem.sourceFeedbackId);
    console.log("-> Linked Source Asset:", queueItem.sourceAssetId); // The exact visual hash they looked at
    console.log("-> Linked Family:", queueItem.assetFamilyId);       // The group to append revisions to

    return queueItem;
}


// --- 3. Converting Queue Item triggers Logo Asset Job Runner ---
export function demonstrateQueueToJobExecution(queueItemId: string, adminId: string) {
    // Admin clicks "Run Revision" in the Dashboard.
    // This looks at `item.sourceFeedbackId`, builds the structural delta, and hands off to Python natively.
    const jobId = queueManager.convertQueueItemToJob(queueItemId, adminId);

    // Status instantly becomes 'converted-to-job' 
    // And `revisionRequestId` physically holds the UUID that `LogoJobRunner` is tracking.

    console.log("Background Render Started. Tracking Job ID:", jobId);
    return jobId;
}


// --- 4. Generated Asset strictly links back into Queue Item ---
export function demonstrateBlenderOutputAttachment(queueItemId: string, siteId: string, familyId: string) {
    // Blender MCP finishes running. It produces a new 3D mesh.
    // The Webhook fires into the Engine, drafting the new File into the Registry.
    const newRenderedAssetId = registry.draftAsset(familyId, siteId, {
        materialPreset: 'chrome',
        thickness: 0.5 // Structural delta applied!
    });

    // We explicitly pair that new Registry Hash natively straight back into the waiting Queue Item!
    queueManager.attachGeneratedVariantToQueueItem(queueItemId, newRenderedAssetId);

    // The Dashboard now sees 100% completion for the background task.
    // `item.status` === 'generated'
    // `item.generatedAssetId` === newRenderedAssetId

    console.log("Render Attached! New Asset Hash:", newRenderedAssetId);
    return newRenderedAssetId;
}


// --- 5. Revised Asset goes to Preview/Comparison ---
export function demonstrateRoutingToPreview(queueItemId: string, siteId: string, newAssetId: string) {
    // Admin checks `generatedAssetId` locally. Looks phenomenal.
    // They want Client Signoff.

    // Generate an isolated Shareable Preview Link specifically targeting the `generatedAssetId`.
    const previewSession = approvalManager.createApprovalSession(siteId, 'hero-centerpiece', newAssetId, 'admin-1');

    // Inform the Queue Dashboard that the asset has entered Client Court.
    queueManager.markQueueItemReadyForPreview(queueItemId);

    console.log("Client Preview Link Generated:", `https://engine.dev/preview/${previewSession.previewToken}`);
    return previewSession;
}


// --- 6. Approval/Publishing updates Queue Item Status ---
// --- 7. Preservation of End-To-End History ---
export function demonstratePipelineHandoffAndHistory(queueItemId: string, previewToken: string, adminId: string) {

    // Client physically clicks "Approve" inside `/preview/xyz123`
    // Webhook hits the API:
    approvalManager.recordApproval(previewToken, 'client@corp.root', 'Looks great.');

    // Inform the Queue Dashboard that the targeted mesh survived Client Scrutiny.
    queueManager.markQueueItemApproved(queueItemId);
    // => 'approved'

    // The Admin Logs into the Dashboard and sees `APPROVED`.
    // Admin clicks "Deploy to Production".
    queueManager.markQueueItemPublished(queueItemId, adminId);
    // => 'published'
    // => natively runs `ApprovalWorkflowEngine.publishAsset()` which rewrites `SiteDeploymentSync`.

    console.log("Deployment Complete. Live Site instantly updated globally.");

    /**
     * END-TO-END HISTORY CAPTURE:
     * 
     * Even after publication, `queueManager.queryDashboard()` preserves the entire structural chain:
     * {
     *    revisionQueueItemId: "uuid-ticket-1",
     *    sourceFeedbackId: "uuid-feedback-1", ("Make it thicker")
     *    sourceAssetId: "asset-v1",           (The original requested asset)
     *    revisionRequestId: "job-1",          (The 3-minute Blender Job)
     *    generatedAssetId: "asset-v2",        (The thick output hash)
     *    status: "published",                 (Global final condition)
     *    completedAt: 2026-03-07T20:33:00.000 (The ultimate cutoff stamp)
     * }
     */
}
