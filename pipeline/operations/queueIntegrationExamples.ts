/**
 * pipeline/operations/queueIntegrationExamples.ts
 * 
 * 4. REFINED INTEGRATION EXAMPLES
 * 
 * Proves the strict mathematical lifecycle boundaries translating abstract feedback
 * perfectly into the Operational Control Layer and deploying it to Live Sites safely.
 */

import { RevisionQueueManager } from './RevisionQueueManager';
import { FeedbackManager } from '../feedback/FeedbackManager';
import { LogoJobRunner } from '../jobs/LogoJobRunner';
import { AssetRegistry } from '../registry/AssetRegistry';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ComparisonSessionManager } from '../preview/ComparisonSessionManager';

const registry = new AssetRegistry();
const runner = new LogoJobRunner(registry);
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const comparisonManager = new ComparisonSessionManager(workflow, deploymentSync);

const feedbackManager = new FeedbackManager(runner, registry);
const queueManager = new RevisionQueueManager(feedbackManager, runner, registry, workflow);

const siteId = 'site-a';

// ==============================================================================
// 1. RAW FEEDBACK -> QUEUE TICKET -> RERUN JOB
// ==============================================================================
export function exampleFeedbackToJobConversion() {

    // A. Baseline Hash Creation
    const chromeAssetId = registry.draftAsset('fam-123', siteId, { materialPreset: 'chrome' });

    // B. Feedback Logs (User creates ticket via Front-End Review Overlay)
    const feedback = feedbackManager.submitFeedback(
        siteId, chromeAssetId, 'fam-123', 'client@brand.com',
        'Prefer matte but make it thicker.', 'revision-request',
        { materialChange: 'matte-plastic', thicknessDelta: +0.6 }
    );

    // C. Controller hooks create an Empty Ticket pointing natively to the Feedback
    const queueItem = queueManager.createRevisionQueueItem(
        siteId, 'hero-centerpiece', chromeAssetId, 'fam-123', feedback.feedbackId, 'high'
    );
    // queueItem.status === 'new'

    // D. Admin claims the ticket
    queueManager.assignRevisionQueueItem(queueItem.revisionQueueItemId, 'admin-1');

    // E. Admin fires the job to Blender MCP. Queue Manager structurally executes the Math bounds
    const jobId = queueManager.convertQueueItemToJob(queueItem.revisionQueueItemId, 'admin-1');

    // => `jobId` is physically registered in Python. 
    // => `queueItem.status` === 'converted-to-job' 
    // => `queueItem.revisionRequestId` === jobId
}


// ==============================================================================
// 2. GENERATED VARIANT ATTACHMENT
// ==============================================================================
export function exampleMeshAttachmentToQueue() {

    // MOCK: Pre-existin ticket in the `converted-to-job` phase
    const queueItem = queueManager.createRevisionQueueItem(siteId, 'hero-centerpiece', 'old-uuid', 'fam-uuid', 'feedback-uuid', 'high');
    queueItem.status = 'converted-to-job';

    // A. Webhook: Python Docker finishes the `.glb` mesh output
    // Core Engine writes the `.glb` pointer into the Node registry.
    const newlyRenderedGuid = registry.draftAsset('fam-uuid', siteId, { materialPreset: 'matte-plastic' });

    // B. Link the Output Hash perfectly to the Operational Ticket!
    queueManager.attachGeneratedVariantToQueueItem(queueItem.revisionQueueItemId, newlyRenderedGuid);

    // => queueItem.status === 'generated'
    // => queueItem.generatedAssetId === newlyRenderedGuid
}


// ==============================================================================
// 3. QUEUE PROGRESSION TO GLOBAL DEPLOYMENT
// ==============================================================================
export function exampleDeploymentFromQueue() {
    // MOCK: We enter at the `generated` phase
    const queueItem = queueManager.createRevisionQueueItem(siteId, 'hero-centerpiece', 'old-uuid', 'fam-uuid', 'feedback-uuid', 'high');
    queueItem.status = 'generated';
    queueItem.generatedAssetId = registry.draftAsset('fam-uuid', siteId, { materialPreset: 'matte-plastic' });

    // A. Send to Client
    queueManager.markQueueItemReadyForPreview(queueItem.revisionQueueItemId);
    // => 'in-review'

    // B. Client likes it (e.g. clicks "Approve" on the new Preview Link)
    queueManager.markQueueItemApproved(queueItem.revisionQueueItemId);
    // => 'approved'

    // C. Internal Orchestrator hits Global Publish!
    // This hook specifically blocks UNLESS the status is `approved`. Very safe.
    queueManager.markQueueItemPublished(queueItem.revisionQueueItemId, 'admin-user');

    // => queueItem.status === 'published'
    // => `SiteDeploymentSync` instantly executes logic updating the CMS arrays.
}

// ==============================================================================
// EXTENSION NOTES FOR FUTURE DEVS
// ==============================================================================
/**
 * REVISION DASHBOARD EXTENSIONS
 * 
 * - **SLA Tracking:**
 *   Currently the `DashboardQueryRules` sort natively by `dueAt`. 
 *   You can write a Cron Job querying `status: 'needs-review'` where `new Date() > dueAt`.
 *   Escalates priority mechanically to `'urgent'` and emails `assignedTo`.
 *   
 * - **Batch Reruns:**
 *   If the underlying `LogoJobRunner` supports Batch execution, a Dashboard Admin
 *   could select 5 `needs-review` tickets and call `convertQueueItemToJob` concurrently,
 *   spinning up 5 Blender Docker containers dynamically.
 */
