// server/api/admin/jobs/create.ts
// (Nuxt 3 API Endpoint Example)

import { defineEventHandler, readValidatedBody } from 'h3';
import { AdminAssetRequestSchema } from '@/src/admin/schemas/adminRequest.schema';
import { normalizeAdminRequest } from '@/src/admin/normalizer';
import { LogoAssetJobRunner } from '@/pipeline/jobs/LogoJobRunner';

const jobRunner = new LogoAssetJobRunner(); // Typically a Singleton in a production backend

export default defineEventHandler(async (event) => {
    // 1. The Vue Admin Form POSTs here.
    // We use Zod to strictly validate the incoming JSON body.
    const adminRequest = await readValidatedBody(event, body => AdminAssetRequestSchema.parse(body));

    // 2. Normalization: Translate Admin intent -> Headless Blender Python payload
    // This extracts extrusion, material preset mappings, bevel math, etc.
    const pipelinePayload = normalizeAdminRequest(adminRequest);

    // 3. Extract purely runtime integration configuration
    // The Admin checked "Use as Hero" and "Publish Motion Anchors" in the Vue UI.
    const integrationPreferences = {
        heroSceneModePreference: adminRequest.runtimeSceneMode,
        enableMotionAnchors: adminRequest.runtimeEnableAnchors,
        generatedVariants: adminRequest.pipelineGenerateVariants ? ['wireframe'] : []
    };

    // 4. Fire the Job into the Queue (Asynchronous)
    // We pass a mock clientId or retrieve it from the active session.
    const jobId = await jobRunner.queueJob(
        pipelinePayload,
        integrationPreferences,
        'client-current-session'
    );

    // 5. Return immediately so the Vue Admin UI can show a loading spinner
    return {
        success: true,
        jobId,
        status: 'queued'
    };
});
