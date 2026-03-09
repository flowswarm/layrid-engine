import { z } from 'zod';
import { WorkflowStateEnum } from '../workflow/workflow.types';
import { DeploymentEnvironmentEnum } from '../deployment/deployment.types';
import { ApprovalLinkStatusEnum } from './approval.types';

/**
 * 1. REFINED MULTI-CANDIDATE COMPARISON SESSION SCHEMA
 * 
 * Strict typing ensuring a Comparison Session can robustly track multiple variants,
 * user preferences, and explicit approvals, scaling natively to future split-screen UIs.
 */

export const ComparisonCandidateSchema = z.object({
    assetId: z.string().uuid(),
    addedBy: z.string().uuid(),
    workflowStateAtCreation: WorkflowStateEnum.describe('The internal state of this specific candidate when added'),
});
export type ComparisonCandidate = z.infer<typeof ComparisonCandidateSchema>;

export const ComparisonSessionSchema = z.object({
    // Secure token embedded in the client's URL `?comparison_token=xyz-789`
    comparisonSessionId: z.string().uuid(),

    // ==========================================
    // RESOLUTION BOUNDARIES
    // ==========================================
    siteId: z.string().uuid(),
    targetEnvironment: DeploymentEnvironmentEnum.default('production'),
    sceneRole: z.string().default('hero-centerpiece'),
    optionalRouteTarget: z.string().optional().describe('Locks the preview to a specific page path'),

    // ==========================================
    // MULTI-ASSET STATE & A/B POLLING
    // ==========================================
    candidates: z.array(ComparisonCandidateSchema).min(2, "Comparisons require at least 2 variants"),
    currentViewedAssetId: z.string().uuid().describe('The active variant currently filling the WebGL Canvas'),
    primaryCandidateAssetId: z.string().uuid().nullable().describe('The user clicked "Favorited", but has not executed formal Approval'),
    baseLiveAssetId: z.string().uuid().nullable().describe('The actual live asset for baseline reference'),

    // ==========================================
    // APPROVAL AUDIT & LIFECYCLE
    // ==========================================
    status: ApprovalLinkStatusEnum.default('pending-review'),
    approvalDecision: z.enum(['pending', 'approved_candidate', 'rejected_all']).default('pending'),
    approvedAssetId: z.string().uuid().nullable().default(null).describe('The indisputable winner that was formally signed off'),

    // Audit Ledger
    viewedAt: z.date().nullable().default(null).describe('Records the exact moment the client opens the link'),
    decisionAt: z.date().nullable().default(null).describe('When the client clicked Approve or Reject'),
    notes: z.string().nullable().default(null).describe('Client text feedback'),
    clientIdentifier: z.string().optional().describe('Optional email or IP tracking the reviewer'),

    // Security bounds
    createdBy: z.string().uuid(),
    createdAt: z.date(),
    expiresAt: z.date(),
    revokedAt: z.date().nullable().default(null)
});

export type ComparisonSession = z.infer<typeof ComparisonSessionSchema>;
