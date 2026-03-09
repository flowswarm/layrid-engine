import { v4 as uuidv4 } from 'uuid';
import { ApprovalLinkSession, ApprovalLinkStatusEnum, ApprovalLinkSchema } from './approval.types';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { DeploymentEnvironment } from '../deployment/deployment.types';

/**
 * 2. REFINED SHAREABLE LINK MANAGER API
 * 
 * Safely evaluates incoming web tokens, guaranteeing rigorous separation
 * between the Live Site Deployment sync and the Staging/Review context.
 */
export class ClientApprovalManager {
    private workflowEngine: ApprovalWorkflowEngine;
    private deploymentSync: SiteDeploymentSync;

    private activeLinks: Map<string, ApprovalLinkSession> = new Map();

    constructor(workflowEngine: ApprovalWorkflowEngine, deploymentSync: SiteDeploymentSync) {
        this.workflowEngine = workflowEngine;
        this.deploymentSync = deploymentSync;
    }

    /**
     * Generates a secure external URL for a client to review a pending asset.
     */
    public generateApprovalLink(
        clientId: string,
        targetSceneRole: string,
        candidateAssetId: string,
        workflowState: string,
        creatorId: string,
        targetEnvironment: DeploymentEnvironment = 'production',
        durationDays: number = 7,
        optionalRouteTarget?: string
    ): ApprovalLinkSession {
        const approvalToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        // Snapshot the current live asset so the client can do side-by-side comparisons
        const baseLiveAssetId = this.deploymentSync.resolveLiveAssetForSite(clientId, targetEnvironment, targetSceneRole);

        const session: ApprovalLinkSession = {
            approvalToken,
            clientId,
            targetEnvironment,
            targetSceneRole,
            optionalRouteTarget,
            candidateAssetId,
            baseLiveAssetId,
            status: 'pending-review',
            originWorkflowState: workflowState as any,
            viewedAt: null,
            decisionAt: null,
            approvalNotes: null,
            revokedAt: null,
            createdAt: new Date(),
            expiresAt,
            createdBy: creatorId
        };

        ApprovalLinkSchema.parse(session);
        this.activeLinks.set(approvalToken, session);

        return session;
    }

    /**
     * SAFE RUNTIME INTERCEPTOR: Evaluated on every page load containing `?approval_token=`
     * If this fails or returns null, the engine natively falls back to the Live Hash.
     */
    public validateApprovalToken(
        token: string,
        clientId: string,
        sceneRole: string,
        environment: DeploymentEnvironment,
        currentRoute?: string
    ): ApprovalLinkSession | null {
        const session = this.activeLinks.get(token);
        if (!session) return null;

        // Boundary checks & Manual Revocation
        if (session.status === 'revoked') return null;
        if (!['pending-review', 'changes-requested', 'approved'].includes(session.status)) return null;

        if (session.clientId !== clientId) return null;
        if (session.targetSceneRole !== sceneRole) return null;
        if (session.targetEnvironment !== environment) return null;
        if (session.optionalRouteTarget && currentRoute && session.optionalRouteTarget !== currentRoute) return null;

        // Auto-Expire
        if (new Date() > session.expiresAt) {
            session.status = 'expired';
            return null;
        }

        // Mark as Read instantly upon valid resolution
        if (!session.viewedAt) session.viewedAt = new Date();

        return session;
    }

    /**
     * CLIENT ACTION: Submit feedback from the UI Staging Panel
     */
    public submitClientDecision(
        token: string,
        decision: 'approve' | 'request_changes' | 'reject',
        notes?: string,
        clientEmail?: string
    ): void {
        const session = this.activeLinks.get(token);
        if (!session || new Date() > session.expiresAt || session.status === 'revoked') {
            throw new Error(`Invalid or expired link.`);
        }

        session.decisionAt = new Date();
        session.approvalNotes = notes || null;
        if (clientEmail) session.clientIdentifier = clientEmail;

        switch (decision) {
            case 'approve': session.status = 'approved'; break;
            case 'request_changes': session.status = 'changes-requested'; break;
            case 'reject': session.status = 'rejected'; break;
        }
    }

    /**
     * ADMIN ACTION: Terminate a link instantly
     */
    public revokeLink(token: string, adminId: string): void {
        const session = this.activeLinks.get(token);
        if (session && !['promoted-to-publish', 'expired'].includes(session.status)) {
            session.status = 'revoked';
            session.revokedAt = new Date();
            // Emits audit log via adminId in full production
        }
    }

    /**
     * INTERNAL PIPELINE HANDOFF:
     * Safely demotes the Approval Link back into global production channels.
     */
    public promoteApprovedLinkToLive(
        token: string,
        workflowId: string,
        promoterId: string
    ): void {
        const session = this.activeLinks.get(token);
        if (!session || session.status !== 'approved') {
            throw new Error(`Link must be explicitly 'approved' before global promotion.`);
        }

        // HANDOFF: Execute Global Publish Logic
        // This archives the old LIVE baseline and writes the candidate directly to the Site Sync
        this.workflowEngine.publishAsset(workflowId, promoterId, session.targetEnvironment);

        session.status = 'promoted-to-publish';
    }
}
