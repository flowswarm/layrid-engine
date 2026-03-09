/**
 * pipeline/operations/operationsEventWiring.ts
 * 
 * Demonstrates the precise operational hooks connecting the Event Bus to the
 * physical structural components: Routing Events, Dispatching Alerts, and firing Automations.
 */

import { OperationsEventBus } from './OperationsEventBus';
import { RevisionQueueManager } from './RevisionQueueManager';
import { FeedbackManager } from '../feedback/FeedbackManager';
import { LogoJobRunner } from '../jobs/LogoJobRunner';
import { AssetRegistry } from '../registry/AssetRegistry';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { ClientApprovalManager } from '../preview/ClientApprovalManager';
import { ComparisonSessionManager } from '../preview/ComparisonSessionManager';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { AutomationRule } from './events.types';

// ============================================================================
// SYSTEM BOOTSTRAP: Registering Engines & The Event Bus
// ============================================================================
const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);
const runner = new LogoJobRunner(registry);
const feedbackManager = new FeedbackManager(runner, registry);
const queueManager = new RevisionQueueManager(feedbackManager, runner, registry, workflow);
const approvalManager = new ClientApprovalManager(workflow, deploymentSync);

// The Global Engine Bus
const eventBus = new OperationsEventBus();


// ============================================================================
// A. HEADLESS AUTOMATION RULES CONFIGURATION
// ============================================================================

// 1. Physically register the Native System Callbacks into the Bus Sandbox
eventBus.registerAutomationAction('markQueueGenerated', async (payload) => {
    // Hooks the Python Docker exit code explicitly into the Database Ticket
    queueManager.attachGeneratedVariantToQueueItem(payload.payload.queueItemId, payload.entityId);
});

eventBus.registerAutomationAction('notifyReviewerVariantReady', async (payload) => {
    eventBus.createNotification(
        'user',
        payload.payload.assignedAdminId,
        'queue.item.ready_for_preview',
        'queue_item',
        payload.payload.queueItemId,
        'Render Complete: Ready for Review',
        `The Blender run for your ticket succeeded. Hash: ${payload.entityId}`
    );
});

// 2. Define the exact JSON listening rules
const ruleCompleteJob: AutomationRule = {
    automationRuleId: 'rule-1',
    name: 'Auto-Attach Variant & Notify Admin',
    description: 'When Blender finishes, map the Hash to the Ticket and ping the owner.',
    triggerEventType: 'job.completed',
    actionName: 'markQueueGenerated',
    isActive: true
};
eventBus.registerAutomationRule(ruleCompleteJob);


// ============================================================================
// INTEGRATION FLOW 1: Feedback -> Queue Alert
// ============================================================================
export async function exampleFeedbackAlertToQueue() {
    const siteId = 'site-a';

    // 1. Client creates Feedback
    const feedback = feedbackManager.submitFeedback(siteId, 'asset-old', 'fam-base', 'client@corp.root', 'Thicker please', 'revision-request');

    // 2. ENGINE EMITS EVENT: The rest of the system is agnostic.
    await eventBus.emitWorkflowEvent('feedback.submitted', 'feedback', feedback.feedbackId, { siteId });

    // 3. Queue Manager intercepts / is requested explicitly resulting in a mapped Ticket
    const queueItem = queueManager.createRevisionQueueItem(siteId, 'hero', 'asset-old', 'fam-base', feedback.feedbackId);

    // 4. Send an Alert explicitly targeting the "Artists" User Role Group
    eventBus.createNotification(
        'team_role', 'artist_role', 'queue.item.created', 'queue_item', queueItem.revisionQueueItemId,
        'New Revision Requested', 'A client pushed "Make Thicker" on Site-A.'
    );
}

// ============================================================================
// INTEGRATION FLOW 2: Blender Finished -> Automations Execute -> Preview Alert
// ============================================================================
export async function exampleBlenderFinishAutomationHook() {
    const queueItemId = 'ticket-123';
    const newMeshId = 'glb-hash-456';

    // 1. The Container Python Exit Script Webhooks the engine indicating survival.
    // ENGINE EMITS EVENT:
    await eventBus.emitWorkflowEvent('job.completed', 'job', 'jobRunner-uuid-X', {
        queueItemId,
        assignedAdminId: 'admin-xyz',
        generatedAssetId: newMeshId
    });

    // Under the hood, The EventBus saw `job.completed` and triggered `ruleCompleteJob`.
    // It dynamically instantiated `actionName: 'markQueueGenerated'`, directly executing:
    // => queueManager.attachGeneratedVariantToQueueItem(queueItemId, newMeshId);
}

// ============================================================================
// INTEGRATION FLOW 3: Client Approves Link -> Publish Alert
// ============================================================================
export async function exampleClientSignoffPublishAlert() {
    const previewToken = 'tok-123';

    // 1. Client Hits Approves
    approvalManager.recordApproval(previewToken, 'client@corp.root', 'Approved!');

    // 2. ENGINE EMITS EVENT
    await eventBus.emitWorkflowEvent('preview.client.approved', 'preview_session', previewToken, {
        siteId: 'site-a', assetId: 'glb-hash-456'
    });

    // 3. Admin receives the physical "Go for Launch" Ping.
    eventBus.createNotification(
        'user', 'admin-xyz', 'preview.client.approved', 'preview_session', previewToken,
        'Ready to Publish', 'The client formally approved the thick matte variant!'
    );
}

// ============================================================================
// INTEGRATION FLOW 4: Rollback & Recovery Alerting
// ============================================================================
export async function exampleRollbackRecoveryAlert() {
    // 1. Admin rolls back the site.
    deploymentSync.rollbackAssetPublish('site-a', 'hero-centerpiece', 'old-uuid', 'admin-xyz');

    // 2. ENGINE EMITS EVENT
    await eventBus.emitWorkflowEvent('site.rollback.executed', 'site', 'site-a', { targetAsset: 'old-uuid' });

    // 3. Broad slack hook out to the team notifying of the Production regression
    eventBus.createNotification(
        'team_role', 'engineering_channel', 'site.rollback.executed', 'site', 'site-a',
        'Production Rollback', 'Site-A reverted to previous hash.', undefined, undefined, 'slack'
    );
}

// ============================================================================
// EXTENSION NOTES
// ============================================================================
/**
 * 1. Webhook Adapters:
 * Future Slack/Discord connections can be natively wired inside `dispatchToExternalChannels()`.
 * Handing the PipelineNotification JSON object perfectly to the Slack payload POST wrapper.
 * 
 * 2. Scheduled Reminders:
 * Cron jobs can scan the Queue looking for `status: 'needs-review'` and `dueAt < new Date()`.
 * Executing `eventBus.createNotification()` specifying `'email'` or `'slack'` for Escalations.
 * 
 * 3. Daily Digests / AI Summaries:
 * Because `PipelineNotification` tracks `readAt`, a Cron Job can query all `unread` hooks
 * globally for a user, passing the `JSON` array to Gemini 2.5 Pro to synthesize:
 * "You have 4 Blender jobs finished, 1 Client Approval, and 1 Rollback yesterday."
 */
