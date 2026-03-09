import { v4 as uuidv4 } from 'uuid';
import { ComparisonSession, ComparisonSessionSchema } from './comparison.types';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { DeploymentEnvironment } from '../deployment/deployment.types';

/**
 * 2. REFINED COMPARISON SESSION MANAGER API
 * 
 * Safely evaluates incoming complex multi-asset web tokens, exposing explicit 
 * UI mutators for toggling meshes, favoriting, and promoting formal winners.
 */
export class ComparisonSessionManager {
    private workflowEngine: ApprovalWorkflowEngine;
    private deploymentSync: SiteDeploymentSync;

    private activeSessions: Map<string, ComparisonSession> = new Map();

    constructor(workflowEngine: ApprovalWorkflowEngine, deploymentSync: SiteDeploymentSync) {
        this.workflowEngine = workflowEngine;
        this.deploymentSync = deploymentSync;
    }

    /**
     * Generates a secure external URL for evaluating variants.
     */
    public createComparisonSession(
        siteId: string,
        sceneRole: string,
        candidateAssetIds: string[],
        creatorId: string,
        targetEnvironment: DeploymentEnvironment = 'production',
        durationDays: number = 7,
        optionalRouteTarget?: string
    ): ComparisonSession {
        if (candidateAssetIds.length < 2) throw new Error("Comparisons require at least 2 assets.");

        const comparisonSessionId = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        const baseLiveAssetId = this.deploymentSync.resolveLiveAssetForSite(siteId, targetEnvironment, sceneRole);

        const candidates = candidateAssetIds.map(id => ({
            assetId: id,
            addedBy: creatorId,
            workflowStateAtCreation: 'generated' as const
        }));

        const session: ComparisonSession = {
            comparisonSessionId,
            siteId,
            targetEnvironment,
            sceneRole,
            optionalRouteTarget,
            candidates,
            currentViewedAssetId: candidates[0].assetId, // Defaults purely visual state to first item
            primaryCandidateAssetId: null,
            baseLiveAssetId,
            status: 'pending-review',
            approvalDecision: 'pending',
            approvedAssetId: null,
            viewedAt: null,
            decisionAt: null,
            notes: null,
            revokedAt: null,
            createdAt: new Date(),
            expiresAt,
            createdBy: creatorId
        };

        ComparisonSessionSchema.parse(session);
        this.activeSessions.set(comparisonSessionId, session);

        return session;
    }

    /**
     * SAFE RUNTIME INTERCEPTOR: Evaluated natively via Content Normalizer overrides
     */
    public validateComparisonToken(
        token: string,
        siteId: string,
        sceneRole: string,
        environment: DeploymentEnvironment,
        currentRoute?: string
    ): ComparisonSession | null {
        const session = this.activeSessions.get(token);
        if (!session) return null;

        // Strict boundary checks
        if (session.status === 'revoked' || session.status === 'promoted-to-publish') return null;
        if (!['pending-review', 'changes-requested', 'approved'].includes(session.status)) return null;

        if (session.siteId !== siteId) return null;
        if (session.sceneRole !== sceneRole) return null;
        if (session.targetEnvironment !== environment) return null;
        if (session.optionalRouteTarget && currentRoute && session.optionalRouteTarget !== currentRoute) return null;

        // Auto-Expire
        if (new Date() > session.expiresAt) {
            session.status = 'expired';
            return null;
        }

        if (!session.viewedAt) session.viewedAt = new Date();

        return session;
    }

    /**
     * CLIENT ACTION: Toggle the physically viewed asset instantly in the session bounds
     */
    public switchComparisonCandidate(token: string, selectedAssetId: string): void {
        const session = this.activeSessions.get(token);
        if (session && session.status !== 'expired' && session.status !== 'revoked') {
            if (session.candidates.find(c => c.assetId === selectedAssetId)) {
                session.currentViewedAssetId = selectedAssetId;
            }
        }
    }

    /**
     * CLIENT ACTION: Non-binding preference mark (User clicks a heart icon over Version B)
     */
    public setPreferredCandidate(token: string, preferredAssetId: string): void {
        const session = this.activeSessions.get(token);
        if (session && session.status !== 'expired' && session.status !== 'revoked') {
            if (session.candidates.find(c => c.assetId === preferredAssetId)) {
                session.primaryCandidateAssetId = preferredAssetId;
            }
        }
    }

    /**
     * CLIENT FORMAL ACTION: Reject all variants. Terminates the staging evaluation.
     */
    public rejectComparison(token: string, notes?: string, clientEmail?: string): void {
        const session = this.activeSessions.get(token);
        if (!session || new Date() > session.expiresAt || session.status === 'revoked') throw new Error("Invalid Token.");

        session.approvalDecision = 'rejected_all';
        session.status = 'rejected';
        session.decisionAt = new Date();
        session.notes = notes || null;
        if (clientEmail) session.clientIdentifier = clientEmail;
    }

    /**
     * CLIENT FORMAL ACTION: Select the undisputed winner and lock the session for Launch.
     */
    public approveSelectedCandidate(
        token: string,
        winningAssetId: string,
        notes?: string,
        clientEmail?: string
    ): void {
        const session = this.activeSessions.get(token);
        if (!session || new Date() > session.expiresAt || session.status === 'revoked') throw new Error("Invalid Token.");

        if (!session.candidates.find(c => c.assetId === winningAssetId)) {
            throw new Error("Winning asset must be part of the original comparison pool.");
        }

        session.approvalDecision = 'approved_candidate';
        session.approvedAssetId = winningAssetId;
        session.status = 'approved';
        session.decisionAt = new Date();
        session.notes = notes || null;
        if (clientEmail) session.clientIdentifier = clientEmail;
    }

    public revokeComparisonSession(token: string, adminId: string): void {
        const session = this.activeSessions.get(token);
        if (session && !['promoted-to-publish', 'expired'].includes(session.status)) {
            session.status = 'revoked';
            session.revokedAt = new Date();
        }
    }

    /**
     * INTERNAL PIPELINE HANDOFF:
     * Maps the formally `approvedAssetId` perfectly downward into the global Deployment Sync arrays.
     */
    public promoteComparisonToLive(
        token: string,
        workflowIdOfWinner: string,
        adminId: string
    ): void {
        const session = this.activeSessions.get(token);
        if (!session || session.approvalDecision !== 'approved_candidate' || !session.approvedAssetId) {
            throw new Error(`Comparison must have an explicit winning candidate approved before global promotion.`);
        }

        // Deploy natively using the trusted Approval engine
        this.workflowEngine.publishAsset(workflowIdOfWinner, adminId, session.targetEnvironment);
        session.status = 'promoted-to-publish';
    }
}
