import { z } from 'zod';
import { WorkflowStateEnum } from '../workflow/workflow.types';
import { DeploymentEnvironmentEnum } from '../deployment/deployment.types';

/**
 * 1. FINAL PREVIEW SESSION SCHEMA
 * 
 * A strict schema governing exactly how and when a temporary
 * asset overrides the physical live deployment for a single user tracking session.
 */

export const PreviewSessionStatusEnum = z.enum([
    'draft-preview',
    'active-preview',
    'expired-preview',
    'promoted-to-publish',
    'discarded'
]);
export type PreviewSessionStatus = z.infer<typeof PreviewSessionStatusEnum>;

export const PreviewSessionSchema = z.object({
    // Cryptographically safe or UUID token sent to the user (`?preview_token=...`)
    previewToken: z.string().uuid(),

    // ==========================================
    // RESOLUTION BOUNDARIES
    // ==========================================
    // The exact site and role this preview attempts to hijack
    clientId: z.string().uuid().describe('Target Site ID'),
    targetEnvironment: DeploymentEnvironmentEnum.default('production').describe('The environment the preview overrides'),
    targetSceneRole: z.string().default('hero-centerpiece'),
    optionalRouteTarget: z.string().optional().describe('If specified, preview only applies to this exact URL path'),

    // ==========================================
    // ASSET POINTERS
    // ==========================================
    previewAssetId: z.string().uuid().describe('The temporary unapproved asset physical ID'),
    baseLiveAssetId: z.string().uuid().nullable().describe('The asset currently live natively, used later for A/B UI comparisons'),

    // ==========================================
    // AUDIT & LIFECYCLE
    // ==========================================
    originWorkflowState: WorkflowStateEnum.describe('State of the asset at the time the preview was generated'),
    status: PreviewSessionStatusEnum.default('active-preview'),

    createdAt: z.date(),
    expiresAt: z.date().describe('Hard timestamp when the token ceases to operate'),
    createdBy: z.string().uuid().describe('Admin/System that generated the link')
});

export type PreviewSession = z.infer<typeof PreviewSessionSchema>;
