import { z } from 'zod';
import { LogoGenerationRequest, LogoGenerationRequestSchema } from './generation.types';

// ==========================================
// 1. JOB STATUS LIFECYCLE
// ==========================================
// A robust, linear state machine for tracking the asset generation pipeline.
export const JobStatusEnum = z.enum([
    'queued',     // Waiting for worker availability
    'validating', // Checking source file integrity (e.g., SVG paths)
    'processing', // Blender MCP Python script is actively running
    'exporting',  // Blender is writing the GLTF/GLB to disk
    'completed',  // Success, Asset is registered in the DB
    'failed'      // Halts with errorMessage. Can be transitioned back to 'queued' for re-runs.
]);

export type JobStatus = z.infer<typeof JobStatusEnum>;

// ==========================================
// 2. ORCHESTRATION JOB SCHEMA
// ==========================================
// Represents the actual execution task managed by the backend worker.
export const AssetJobSchema = z.object({
    jobId: z.string().uuid(),

    // Organization / Multitenancy
    clientId: z.string().optional(),

    // E.g., a batch ID to group hundreds of generated logos together
    batchId: z.string().optional(),

    status: JobStatusEnum.default('queued'),

    // Structured error tracking
    errorDetails: z.object({
        code: z.string(),
        message: z.string(),
        failedAtStep: JobStatusEnum
    }).optional(),

    // Track execution duration for bottleneck monitoring
    timestamps: z.object({
        queuedAt: z.date(),
        startedAt: z.date().optional(),
        completedAt: z.date().optional(),
    }),

    // The strict Payload handed to the Blender Python script
    pipelinePayload: LogoGenerationRequestSchema,

    // ==========================================
    // 3. ENGINE REGISTRATION PREFERENCES
    // ==========================================
    // Instructions on how to configure the asset for the Cinematic Engine once exported
    integrationMetadata: z.object({
        heroSceneModePreference: z.string().default('logo-centerpiece'),

        // Crucial for the Motion Engine to know if this mesh broadcasts its XY coords
        enableMotionAnchors: z.boolean().default(true),

        // Filled in upon 'exporting' status
        exportFileUrl: z.string().optional(),
        exportFileSizeKb: z.number().optional(),

        // Feature Extension: E.g., 'wireframe', 'ambient-occlusion-bake'
        generatedVariants: z.array(z.string()).optional()
    }).optional()
});

export type AssetJob = z.infer<typeof AssetJobSchema>;

// ==========================================
// 4. EXPORT REGISTRATION SCHEMA
// ==========================================
// This is the clean, stable record saved to the Database that the Frontend Engine reads.
// It is completely decoupled from the Job that generated it.
export const AssetRegistrationRecordSchema = z.object({
    assetId: z.string().uuid(),
    sourceJobId: z.string().uuid(), // Traceability back to execution logs
    createdAt: z.date(),

    // The crucial bridge to WebGL Manager (e.g., '/models/acme-hero.glb')
    publicUrl: z.string().min(1),

    // Used by Template Config to alter lighting strategies based on source origins
    sourceOriginType: z.enum(['svg', 'text', 'png']),

    // The core PBR instruction (e.g., 'chrome', 'glass', 'matte-plastic')
    materialPreset: z.string(),

    // Binds directly to the WebGL Scene Mode architecture
    recommendedSceneMode: z.string(),

    // Binds directly to the Motion Engine Anchor system
    supportsMotionAnchors: z.boolean()
});

export type AssetRegistrationRecord = z.infer<typeof AssetRegistrationRecordSchema>;
