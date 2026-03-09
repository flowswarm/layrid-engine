import { z } from 'zod';
import { WorkflowStateEnum } from '../workflow/workflow.types';
import { DeploymentEnvironmentEnum } from '../deployment/deployment.types';

/**
 * 1. REFINED SHAREABLE PREVIEW/APPROVAL LINK SCHEMA
 * 
 * Strict typing ensuring an Approval Link perfectly isolates the candidate
 * asset from global traffic, while guaranteeing a heavily audited feedback loop.
 */

export const ApprovalLinkStatusEnum = z.enum([
    'pending-review',
    'approved',
    'changes-requested',
    'rejected',
    'expired',
    'revoked',
    'promoted-to-publish' // Terminal state: Merged back into global live traffic
]);
export type ApprovalLinkStatus = z.infer<typeof ApprovalLinkStatusEnum>;

export const ApprovalLinkSchema = z.object({
    // Secure token embedded in the client's email link `?approval_token=abc-123`
    approvalToken: z.string().uuid(),

    // ==========================================
    // RESOLUTION BOUNDARIES
    // ==========================================
    clientId: z.string().uuid(),
    targetEnvironment: DeploymentEnvironmentEnum.default('production'),
    targetSceneRole: z.string().default('hero-centerpiece'),
    optionalRouteTarget: z.string().optional().describe('Locks the preview to a specific page path'),

    // ==========================================
    // ASSET POINTERS  (Readiness for Side-by-Side)
    // ==========================================
    candidateAssetId: z.string().uuid().describe('The unapproved asset being evaluated'),
    baseLiveAssetId: z.string().uuid().nullable().describe('The asset currently live (used natively by Vue for 3D A/B splitting)'),

    // ==========================================
    // APPROVAL AUDIT & LIFECYCLE
    // ==========================================
    status: ApprovalLinkStatusEnum.default('pending-review'),
    originWorkflowState: WorkflowStateEnum.describe('The internal workflow state of the candidate asset when the link was generated'),

    // Client feedback ledger
    viewedAt: z.date().nullable().default(null).describe('Records the exact moment the client opens the link'),
    decisionAt: z.date().nullable().default(null).describe('When the client clicked Approve or Reject'),
    approvalNotes: z.string().nullable().default(null).describe('Client text feedback'),
    clientIdentifier: z.string().optional().describe('Optional email or IP tracking the reviewer'),

    // Security bounds
    createdAt: z.date(),
    expiresAt: z.date().describe('Hard timestamp when the validation strictly returns null'),
    revokedAt: z.date().nullable().default(null).describe('Timestamp if an internal admin manually killed the link'),
    createdBy: z.string().uuid().describe('Internal Admin who generated the link')
});

export type ApprovalLinkSession = z.infer<typeof ApprovalLinkSchema>;
