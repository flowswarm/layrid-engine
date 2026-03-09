import { z } from 'zod';

/**
 * 1. REFINED CLIENT FEEDBACK & REVISION SCHEMA
 * 
 * Production-ready schema explicitly separating unstructured human thoughts 
 * from the parsed structural adjustments, and finally the definitive 
 * Blender MCP target configuration. Supported by strict lifecycle tracks.
 */

// Context tying the feedback to physical architecture
export const FeedbackContextSchema = z.object({
    previewSessionId: z.string().uuid().optional(),
    comparisonSessionId: z.string().uuid().optional(),
    siteId: z.string().uuid(),
    sceneRole: z.string().default('hero-centerpiece'),
    assetId: z.string().uuid().describe('The Exact Hash being visually scrutinized'),
    variantFamilyId: z.string().describe('The grouped family for variant chaining')
});

// A rigid, chronological state machine
export const FeedbackLifecycleStatusEnum = z.enum([
    'draft',               // Client typing, has not sent
    'submitted',           // Client hit Send
    'reviewed',            // Internal Art Director read it
    'mapping-failed',      // AI parsing or auto-target generation failed
    'converted-to-revision', // Sent to the MCP Python queue
    'revision-started',    // Blender is currently rendering the new file
    'resolved',            // New asset is approved, feedback closed
    'archived'             // Client changed their mind or stale
]);

export const FeedbackTypeEnum = z.enum([
    'approve',
    'reject',
    'revision-request',
    'visual-adjustment',
    'preference-note'
]);

/**
 * STRUCTURED ADJUSTMENTS (The Delta Layer)
 * Represents the relative "Make it more X" adjustments.
 */
export const StructuredAdjustmentsSchema = z.object({
    materialChange: z.enum(['chrome', 'matte-plastic', 'glass', 'brushed-metal', 'default']).optional(),

    // Normalized physical deltas (-1.0 to 1.0)
    shininessDelta: z.number().min(-1).max(1).optional(),
    thicknessDelta: z.number().min(-1).max(1).optional(),
    bevelDelta: z.number().min(-1).max(1).optional(),
    scaleDelta: z.number().min(-1).max(1).optional(),

    // A/B Explicit Choice
    preferredCandidateAssetId: z.string().uuid().optional(),

    // Aesthetic Overrides
    colorAccentHex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional()
});

export type StructuredAdjustments = z.infer<typeof StructuredAdjustmentsSchema>;


/**
 * THE MAIN FEEDBACK ENTITY
 */
export const ClientFeedbackSchema = z.object({
    feedbackId: z.string().uuid(),
    context: FeedbackContextSchema,

    feedbackType: FeedbackTypeEnum,
    status: FeedbackLifecycleStatusEnum.default('submitted'),

    // Input Data Layers
    rawNotes: z.string().nullable().default(null).describe('Unstructured human text'),

    // Parsed Output Layer
    structuredAdjustments: StructuredAdjustmentsSchema.nullable().default(null).describe('The mapped technical intent'),

    // Audit Ledger
    submittedBy: z.string().describe('Email or Client ID'),
    submittedAt: z.date(),
    reviewedAt: z.date().nullable().default(null),
    resolvedAt: z.date().nullable().default(null),

    // Internal Handoff tracking
    revisionJobId: z.string().uuid().nullable().default(null).describe('The resulting background orchestrator job UUID'),
});

export type ClientFeedback = z.infer<typeof ClientFeedbackSchema>;
