import { z } from 'zod';

/**
 * 1. WORKFLOW STATE SCHEMA
 * 
 * Separates the actual physical asset generation from its "Publishing" validity.
 * This represents the explicit lifecycle an asset undergoes before it is 
 * permitted to affect the WebGL Engine.
 */

export const WorkflowStateEnum = z.enum([
    'draft',        // Admin has requested creation; pipeline is spooling up.
    'generated',    // Job Runner completed; file physically exists on storage.
    'review',       // Submitted by Admin/Pipeline for creative/client review.
    'approved',     // Art Director approved it. Safe for production, but NOT YET LIVE.
    'published',    // THE LIVE ASSET. Engine is actively resolving this asset.
    'rejected',     // Failed review standards. Placed in quarantine.
    'archived'      // Previously published, but rolled back or replaced by a new live variant.
]);

export type WorkflowState = z.infer<typeof WorkflowStateEnum>;

/**
 * 2. STRUCTURED AUDIT METADATA
 * 
 * Ensures robust tracking of who approved or rejected an asset and why.
 * This satisfies production accountability requirements.
 */
export const ReviewMetadataSchema = z.object({
    // Who performed the action
    reviewerId: z.string().uuid(),
    reviewerRole: z.enum(['admin', 'art-director', 'client', 'system']),

    // Context notes (e.g. "Lighting is too harsh, soften the specular value")
    notes: z.string().max(2000).optional(),

    // Explicit tracking to ensure we know WHY it was rejected
    rejectionReason: z.string().optional(),

    // Progression Timestamps. Critical for tracking SLA on feedback.
    submittedForReviewAt: z.date().optional(),
    reviewedAt: z.date().optional(),
    publishedAt: z.date().optional(),
    archivedAt: z.date().optional()
});

export type ReviewMetadata = z.infer<typeof ReviewMetadataSchema>;

/**
 * 3. THE PUBLISHING MANIFEST
 * 
 * The data wrapper strictly managing the publishing lifecycle.
 * In a real DB, this is joined 1:1 with the `AssetRecord`.
 */
export const PublishingManifestSchema = z.object({
    workflowId: z.string().uuid(),
    assetId: z.string().uuid(),          // Foreign key to AssetRegistry
    familyId: z.string().uuid(),         // Used to track which assets compete for the same role
    clientId: z.string().min(1),         // The target site

    // The exact role this asset should fulfill when LIVE (e.g., "hero-centerpiece")
    targetSceneRole: z.string().min(1).default('hero-centerpiece'),

    state: WorkflowStateEnum.default('draft'),

    auditTrail: ReviewMetadataSchema.optional(),

    // For future extensions (Scheduled publishing)
    scheduledPublishAt: z.date().optional()
});

export type PublishingManifest = z.infer<typeof PublishingManifestSchema>;
