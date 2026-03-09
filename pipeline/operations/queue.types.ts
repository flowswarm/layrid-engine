import { z } from 'zod';

/**
 * 1. REFINED REVISION QUEUE SCHEMA
 * 
 * Production-ready tracking layer structurally linking client feedback,
 * background render jobs, and generated asset hashes into a single operational ledger.
 */

// A rigid operational state machine for the dashboard
export const RevisionQueueItemStatusEnum = z.enum([
    'new',                    // Ticket created from feedback
    'needs-review',           // Assigned to an artist, awaiting decision
    'ready-for-conversion',   // Artist approved the math, ready to fire Job
    'converted-to-job',       // Background Python rendering in progress
    'generation-failed',      // Blender crashed or job timed out
    'generated',              // New `.glb` mesh exists in the Registry
    'in-review',              // Sent to the client (Comparison or Preview link)
    'approved',               // Client formally signed off on the revision
    'published',              // Promoted globally to the Live site
    'rejected',               // Client hated it, back to the drawing board
    'archived'                // Stale or duplicate ticket
]);

export type RevisionQueueItemStatus = z.infer<typeof RevisionQueueItemStatusEnum>;

export const RevisionPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);


export const RevisionQueueItemSchema = z.object({
    revisionQueueItemId: z.string().uuid(),

    // High-Level Routing Context
    siteId: z.string().uuid(),
    sceneRole: z.string().default('hero-centerpiece'),
    priority: RevisionPriorityEnum.default('medium'),

    // The Complete Audit Chain (Pointers to the physical systems)
    sourceAssetId: z.string().uuid().describe('The mesh the client was looking at when they complained'),
    assetFamilyId: z.string().uuid().describe('The group this revision belongs to'),

    sourceFeedbackId: z.string().uuid().nullable().describe('The feedback entity driving this revision'),

    revisionRequestId: z.string().uuid().nullable().describe('The background Queue Job UUID (LogoJobRunner)'),
    generatedAssetId: z.string().uuid().nullable().describe('The NEW mesh UUID that Blender actually produced'),

    // Operational State
    status: RevisionQueueItemStatusEnum.default('new'),
    assignedTo: z.string().uuid().nullable().default(null).describe('Internal Admin/Artist ID responsible for this ticket'),

    // Ledger
    createdAt: z.date(),
    updatedAt: z.date(),
    dueAt: z.date().nullable().default(null),
    completedAt: z.date().nullable().default(null),
    notes: z.string().nullable().default(null).describe('Internal admin notes')
});

export type RevisionQueueItem = z.infer<typeof RevisionQueueItemSchema>;


// -------------------------------------------------------------
// DASHBOARD VIEW MODELS
// -------------------------------------------------------------
export const DashboardQueryRulesSchema = z.object({
    aggregateBySite: z.boolean().default(false),
    filterByStatus: z.array(RevisionQueueItemStatusEnum).optional(),
    filterByAssignee: z.string().uuid().optional(),
    filterByPriority: z.array(RevisionPriorityEnum).optional(),
    sortBy: z.enum(['createdAt', 'priority', 'dueAt', 'updatedAt']).default('updatedAt')
});

export type DashboardQueryRules = z.infer<typeof DashboardQueryRulesSchema>;
