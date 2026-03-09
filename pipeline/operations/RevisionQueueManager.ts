import { v4 as uuidv4 } from 'uuid';
import {
    RevisionQueueItem,
    RevisionQueueItemSchema,
    RevisionPriorityEnum,
    DashboardQueryRules
} from './queue.types';
import { FeedbackManager } from '../feedback/FeedbackManager';
import { LogoJobRunner } from '../jobs/LogoJobRunner';
import { AssetRegistry } from '../registry/AssetRegistry';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';

/**
 * 2. REFINED REVISION DASHBOARD API
 * 
 * Safely digests queue operations, processes structural transitions, and directly
 * acts as the centralized operational controller for the asset lifecycle.
 */
export class RevisionQueueManager {
    private feedbackManager: FeedbackManager;
    private jobRunner: LogoJobRunner;
    private registry: AssetRegistry;
    private workflowEngine: ApprovalWorkflowEngine;

    private queue: Map<string, RevisionQueueItem> = new Map();

    constructor(
        feedback: FeedbackManager,
        jobs: LogoJobRunner,
        registry: AssetRegistry,
        workflow: ApprovalWorkflowEngine
    ) {
        this.feedbackManager = feedback;
        this.jobRunner = jobs;
        this.registry = registry;
        this.workflowEngine = workflow;
    }

    /**
     * SYSTEM HOOK: When a Client submits Feedback, the FeedbackManager calls this natively.
     */
    public createRevisionQueueItem(
        siteId: string,
        sceneRole: string,
        sourceAssetId: string,
        assetFamilyId: string,
        sourceFeedbackId?: string,
        priority: z.infer<typeof RevisionPriorityEnum> = 'medium',
        dueDays: number = 2
    ): RevisionQueueItem {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + dueDays);

        const item: RevisionQueueItem = {
            revisionQueueItemId: uuidv4(),
            siteId,
            sceneRole,
            priority,
            sourceAssetId,
            assetFamilyId,
            sourceFeedbackId: sourceFeedbackId || null,
            revisionRequestId: null,
            generatedAssetId: null,
            status: 'new',
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            dueAt,
            completedAt: null,
            notes: null
        };

        RevisionQueueItemSchema.parse(item);
        this.queue.set(item.revisionQueueItemId, item);
        return item;
    }

    public assignRevisionQueueItem(itemId: string, adminId: string): void {
        const item = this.queue.get(itemId);
        if (item && ['new', 'needs-review'].includes(item.status)) {
            item.assignedTo = adminId;
            item.status = 'needs-review';
            item.updatedAt = new Date();
        }
    }

    /**
     * ADMIN ACTION: Triggers the physical Blender Render.
     */
    public convertQueueItemToJob(itemId: string, adminId: string): string {
        const item = this.queue.get(itemId);
        if (!item || !['new', 'needs-review', 'ready-for-conversion'].includes(item.status)) {
            throw new Error("Invalid ticket state for generating a Job.");
        }
        if (!item.sourceFeedbackId) {
            throw new Error("Cannot run Job: Ticket lacks structural feedback target bounds.");
        }

        // Fire the external physics via FeedbackManager
        const jobId = this.feedbackManager.convertFeedbackToRevisionRequest(item.sourceFeedbackId, adminId);

        item.revisionRequestId = jobId;
        item.status = 'converted-to-job';
        item.updatedAt = new Date();

        return jobId;
    }

    /**
     * SYSTEM HOOK: JobRunner completes, attaches the generated hash back to the tracking ticket.
     */
    public attachGeneratedVariantToQueueItem(itemId: string, newAssetId: string): void {
        const item = this.queue.get(itemId);
        if (item && item.status === 'converted-to-job') {
            item.generatedAssetId = newAssetId;
            item.status = 'generated';
            item.updatedAt = new Date();
        }
    }

    public markQueueItemFailed(itemId: string, errorNotes: string): void {
        const item = this.queue.get(itemId);
        if (item && item.status === 'converted-to-job') {
            item.status = 'generation-failed';
            item.notes = errorNotes;
            item.updatedAt = new Date();
        }
    }

    public markQueueItemReadyForPreview(itemId: string): void {
        const item = this.queue.get(itemId);
        if (item && item.status === 'generated') {
            item.status = 'in-review';
            item.updatedAt = new Date();
        }
    }

    /**
     * CLIENT ACTION INTERCEPTOR: The client clicked "Approve" on the new Preview.
     */
    public markQueueItemApproved(itemId: string): void {
        const item = this.queue.get(itemId);
        if (item && item.generatedAssetId && item.status === 'in-review') {
            item.status = 'approved';
            item.updatedAt = new Date();
        }
    }

    /**
     * ADMIN ACTION: Deploy the accepted asset globally.
     */
    public markQueueItemPublished(itemId: string, adminId: string): void {
        const item = this.queue.get(itemId);
        if (!item || item.status !== 'approved' || !item.generatedAssetId) {
            throw new Error("Invalid publish state: Ticket must be formally 'approved' by client.");
        }

        // Connect to Workflow Core
        const mockWorkflowId = 'flow-' + item.generatedAssetId;
        this.workflowEngine.publishAsset(mockWorkflowId, adminId, 'production');

        item.status = 'published';
        item.completedAt = new Date();
        item.updatedAt = new Date();
    }

    public archiveQueueItem(itemId: string): void {
        const item = this.queue.get(itemId);
        if (item) {
            item.status = 'archived';
            item.updatedAt = new Date();
        }
    }

    /**
     * FRONT-END DATA LOADER
     */
    public queryDashboard(rules: DashboardQueryRules): RevisionQueueItem[] {
        let items = Array.from(this.queue.values());

        if (rules.filterByStatus && rules.filterByStatus.length > 0) {
            items = items.filter(i => rules.filterByStatus!.includes(i.status));
        }
        if (rules.filterByAssignee) {
            items = items.filter(i => i.assignedTo === rules.filterByAssignee);
        }
        if (rules.filterByPriority && rules.filterByPriority.length > 0) {
            items = items.filter(i => rules.filterByPriority!.includes(i.priority));
        }

        items.sort((a, b) => b[rules.sortBy]!.getTime() - a[rules.sortBy]!.getTime());

        return items;
    }
}
