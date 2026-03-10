import { v4 as uuidv4 } from 'uuid';
import { AssetRegistry } from '../registry/AssetRegistry';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { DeploymentEnvironment } from '../deployment/deployment.types';
import {
    WorkflowState,
    ReviewMetadata,
    PublishingManifest,
    WorkflowStateEnum
} from './workflow.types';

/**
 * 1. APPROVAL + PUBLISHING UPDATES SITE-LEVEL LIVE MAPPING
 * 
 * The Workflow Engine manages the complex states, but delegates the 
 * final O(1) routing table to the SiteDeploymentSync.
 */
type PersistFn = (data: unknown) => void;

export class ApprovalWorkflowEngine {
    private registry: AssetRegistry;
    private deploymentSync: SiteDeploymentSync;
    private persistFn: PersistFn | null = null;

    private workflowDB: Map<string, PublishingManifest> = new Map();

    constructor(registry: AssetRegistry, deploymentSync: SiteDeploymentSync) {
        this.registry = registry;
        this.deploymentSync = deploymentSync;
    }

    /** Attach a persistence callback. */
    public setPersist(fn: PersistFn): void { this.persistFn = fn; }

    public toJSON(): object {
        const entries: Record<string, PublishingManifest> = {};
        for (const [k, v] of this.workflowDB) entries[k] = v;
        return entries;
    }

    public static fromJSON(data: any, registry: AssetRegistry, deploymentSync: SiteDeploymentSync): ApprovalWorkflowEngine {
        const engine = new ApprovalWorkflowEngine(registry, deploymentSync);
        if (data && typeof data === 'object') {
            for (const [k, v] of Object.entries(data)) {
                engine.workflowDB.set(k, v as PublishingManifest);
            }
        }
        return engine;
    }

    private persist(): void {
        if (this.persistFn) this.persistFn(this.toJSON());
    }

    /** Get a workflow by ID (for API queries). */
    public getWorkflow(workflowId: string): PublishingManifest | undefined {
        return this.workflowDB.get(workflowId);
    }

    /** Get all workflows (for API queries). */
    public getAllWorkflows(): Map<string, PublishingManifest> {
        return this.workflowDB;
    }

    public initializeWorkflow(assetId: string, familyId: string, clientId: string, targetSceneRole: string = 'hero-centerpiece'): string {
        const workflowId = uuidv4();
        this.workflowDB.set(workflowId, { workflowId, assetId, familyId, clientId, targetSceneRole, state: 'draft' });
        this.persist();
        return workflowId;
    }

    public markGenerated(workflowId: string): void { this.transitionState(workflowId, 'draft', 'generated'); this.persist(); }
    public submitForReview(workflowId: string, reviewerId: string): void { this.transitionState(workflowId, 'generated', 'review'); this.persist(); }
    public rejectAsset(workflowId: string, reviewerId: string, reason: string): void { this.transitionState(workflowId, 'review', 'rejected'); this.persist(); }
    public approveAsset(workflowId: string, reviewerId: string, notes?: string): void { this.transitionState(workflowId, 'review', 'approved'); this.persist(); }

    /** 
     * THE GATE: Promotes Workflow State AND triggers SiteDeploymentSync.
     * SHOWS HOW Approval + Publishing updates the site-level live mapping.
     */
    public publishAsset(
        workflowId: string,
        publisherId: string,
        environment: DeploymentEnvironment = 'production'
    ): void {
        const flow = this.workflowDB.get(workflowId);
        if (!flow) throw new Error(`Workflow not found.`);
        if (flow.state !== 'approved') {
            throw new Error(`Asset must be in 'approved' state to publish. Current: ${flow.state}`);
        }

        this.demoteCompetingLiveAssets(flow.clientId, flow.targetSceneRole, environment);

        flexUpdateState(flow, 'published');

        // REGISTRY SYNC: Mark physical file as published
        this.registry.approveAndMakePrimary(flow.assetId);

        // DEPLOYMENT SYNC: Write O(1) fast-lookup for normalizer
        this.deploymentSync.pushLiveUpdate(
            flow.clientId,
            environment,
            flow.targetSceneRole,
            flow.assetId,
            publisherId
        );
        this.persist();
    }

    /**
     * SHOWS HOW rollback updates runtime resolution safely.
     */
    public unpublishAssetAndRollback(
        workflowId: string,
        operatorId: string,
        environment: DeploymentEnvironment = 'production'
    ): void {
        const flow = this.workflowDB.get(workflowId);
        if (!flow) return;

        if (flow.state === 'published') {
            flexUpdateState(flow, 'archived');
            this.registry.archiveAsset(flow.assetId);

            // Tell deployment sync to instantly swap back to the previous track
            this.deploymentSync.performRollback(flow.clientId, environment, flow.targetSceneRole, operatorId);
        }
    }

    private transitionState(id: string, from: WorkflowState, to: WorkflowState) {
        const flow = this.workflowDB.get(id);
        if (flow && flow.state === from) flow.state = to;
    }

    private demoteCompetingLiveAssets(clientId: string, targetRole: string, currentEnvironment: string): void {
        for (const flow of this.workflowDB.values()) {
            if (flow.clientId === clientId && flow.targetSceneRole === targetRole && flow.state === 'published') {
                flexUpdateState(flow, 'archived');
                this.registry.archiveAsset(flow.assetId);
            }
        }
    }
}

function flexUpdateState(manifest: PublishingManifest, newState: WorkflowState) {
    manifest.state = newState;
}
