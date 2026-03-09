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
export class ApprovalWorkflowEngine {
    private registry: AssetRegistry;
    private deploymentSync: SiteDeploymentSync;

    private workflowDB: Map<string, PublishingManifest> = new Map();

    constructor(registry: AssetRegistry, deploymentSync: SiteDeploymentSync) {
        this.registry = registry;
        this.deploymentSync = deploymentSync;
    }

    public initializeWorkflow(assetId: string, familyId: string, clientId: string, targetSceneRole: string = 'hero-centerpiece'): string {
        const workflowId = uuidv4();
        this.workflowDB.set(workflowId, { workflowId, assetId, familyId, clientId, targetSceneRole, state: 'draft' });
        return workflowId;
    }

    public markGenerated(workflowId: string): void { this.transitionState(workflowId, 'draft', 'generated'); }
    public submitForReview(workflowId: string, reviewerId: string): void { this.transitionState(workflowId, 'generated', 'review'); }
    public rejectAsset(workflowId: string, reviewerId: string, reason: string): void { this.transitionState(workflowId, 'review', 'rejected'); }
    public approveAsset(workflowId: string, reviewerId: string, notes?: string): void { this.transitionState(workflowId, 'review', 'approved'); }

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
        if (flow.state !== 'approved' && flow.state !== 'archived') {
            throw new Error(`Asset must be 'approved' to publish.`);
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
