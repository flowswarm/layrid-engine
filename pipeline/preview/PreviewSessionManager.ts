import { v4 as uuidv4 } from 'uuid';
import { PreviewSession, PreviewSessionStatusEnum, PreviewSessionSchema } from './preview.types';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { DeploymentEnvironment } from '../deployment/deployment.types';

/**
 * 2. EXACT PREVIEW / DISCARD / PROMOTE API
 * 
 * Manages the lifecycle of Preview Tokens, ensuring they are validated
 * safely before runtime intercepts, and handles promotion securely.
 */
export class PreviewSessionManager {
    private workflowEngine: ApprovalWorkflowEngine;
    private deploymentSync: SiteDeploymentSync;

    // In production, this would be Redis with a TTL index matching expiresAt
    private activeSessions: Map<string, PreviewSession> = new Map();

    constructor(workflowEngine: ApprovalWorkflowEngine, deploymentSync: SiteDeploymentSync) {
        this.workflowEngine = workflowEngine;
        this.deploymentSync = deploymentSync;
    }

    /**
     * Generates a secure staging session link.
     */
    public createPreviewSession(
        clientId: string,
        targetSceneRole: string,
        previewAssetId: string,
        workflowState: string,
        creatorId: string,
        targetEnvironment: DeploymentEnvironment = 'production',
        durationHours: number = 24,
        optionalRouteTarget?: string
    ): PreviewSession {
        const previewToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + durationHours);

        // Capture what is CURRENTLY live so the UI can do side-by-side rendering
        const baseLiveAssetId = this.deploymentSync.resolveLiveAssetForSite(clientId, targetEnvironment, targetSceneRole);

        const session: PreviewSession = {
            previewToken,
            clientId,
            targetEnvironment,
            targetSceneRole,
            optionalRouteTarget,
            previewAssetId,
            baseLiveAssetId,
            originWorkflowState: workflowState as any,
            status: 'active-preview',
            createdAt: new Date(),
            expiresAt,
            createdBy: creatorId
        };

        PreviewSessionSchema.parse(session);
        this.activeSessions.set(previewToken, session);

        return session;
    }

    /**
     * Evaluates if a token is legally allowed to hijack the WebGL context at this exact millisecond.
     */
    public validatePreviewToken(
        token: string,
        clientId: string,
        sceneRole: string,
        environment: DeploymentEnvironment,
        currentRoute?: string
    ): PreviewSession | null {
        const session = this.activeSessions.get(token);
        if (!session) return null;

        // 1. Strict Context Boundaries
        if (session.status !== 'active-preview') return null;
        if (session.clientId !== clientId) return null;
        if (session.targetSceneRole !== sceneRole) return null;
        if (session.targetEnvironment !== environment) return null;

        // 2. Strict Route Boundary
        if (session.optionalRouteTarget && currentRoute && session.optionalRouteTarget !== currentRoute) {
            return null;
        }

        // 3. Precision Expiration
        if (new Date() > session.expiresAt) {
            session.status = 'expired-preview';
            return null;
        }

        // Return the full session so the frontend can enable A/B comparisons
        return session;
    }

    /**
     * Manual admin invalidation
     */
    public discardSession(token: string, operatorId: string): void {
        const session = this.activeSessions.get(token);
        if (session && session.status === 'active-preview') {
            session.status = 'discarded';
            // In production, emit audit log: `Preview Token ${token} discarded by ${operatorId}`
        }
    }

    /**
     * Directly advances the Workflow AND Deployment Table using the vetted Staging context.
     */
    public promoteToLive(
        token: string,
        workflowId: string,
        promoterId: string
    ): void {
        const session = this.activeSessions.get(token);
        if (!session || session.status !== 'active-preview') {
            throw new Error(`Invalid or expired preview token. Cannot promote.`);
        }

        // 1. Core Workflow Engine does the heavy lifting:
        // It asserts approval bounds, auto-archives the old asset, and natively triggers
        // `deploymentSync.pushLiveUpdate()`.
        this.workflowEngine.publishAsset(workflowId, promoterId, session.targetEnvironment);

        // 2. Safely retire this specific staging token
        session.status = 'promoted-to-publish';
    }
}
