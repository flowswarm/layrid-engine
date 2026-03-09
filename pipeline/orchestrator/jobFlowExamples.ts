/**
 * Admin Asset Job Runner & Engine Handoff Examples
 * ------------------------------------------------------------------
 * This demonstrates the exact lifecycle of the Orchestrator, showing
 * exactly how the final `AssetRegistrationRecord` powers the Live Frontend.
 */

import { LogoAssetJobRunner } from '../jobs/LogoJobRunner';
import { LogoGenerationRequest } from '../schemas/generation.types';

const runner = new LogoAssetJobRunner();

/* =========================================================
   Example 1: The SVG Upload Job (End to End)
   ========================================================= */
async function runSVGJobExample() {

    // 1. The AdminForm submits this validated, normalized payload
    const pipelinePayload: LogoGenerationRequest = {
        inputType: 'svg',
        sourcePayload: '/uploads/clients/studio-logo.svg',
        extrusionDepth: 0.12,
        bevelDepth: 0.02,
        bevelResolution: 8,
        materialPreset: 'chrome',
        targetFilename: 'studio-centerpiece'
    };

    // 2. QUEUE THE JOB (Async handoff)
    // The Admin UI immediately receives 'job-uuid-1234'
    const jobId = await runner.queueJob(
        pipelinePayload,
        { heroSceneModePreference: 'logo-centerpiece', enableMotionAnchors: true }
    );

    /**
     * INTERNALLY:
     * 1. Status: `validating` -> Checks if '/uploads/clients/studio-logo.svg' exists
     * 2. Status: `processing` -> Executes Blender Python headless script
     * 3. Status: `exporting` -> Blender writes `/public/models/studio-centerpiece.glb`
     */

    // 3. REGISTRATION HANDOFF
    // The JobRunner creates this exact `AssetRegistrationRecord` upon success:
    /*
      {
        assetId: "ast-999",
        sourceJobId: "job-uuid-1234",
        publicUrl: "/models/studio-centerpiece.glb",
        sourceOriginType: "svg",
        materialPreset: "chrome",
        recommendedSceneMode: "logo-centerpiece",
        supportsMotionAnchors: true
      }
    */

    // =========================================================
    // FRONTEND ENGINE CONSUMPTION (Content Normalizer & WebGL)
    // =========================================================

    // A. CONTENT NORMALIZER 
    // Reads the `AssetRegistrationRecord` from the CMS and builds the visual Layout:
    /*
      {
        id: 'hero',
        type: 'hero',
        webgl: {
          sceneMode: "logo-centerpiece",       // Passed directly from Registration
          centerpieceSource: "/models/studio-centerpiece.glb", // Passed directly from Registration
          enableAnchors: true                  // Passed directly from Registration
        }
      }
    */

    // B. TEMPLATE CONFIG CONTROLLER
    // Sees `sceneMode: 'logo-centerpiece'` and instructs the WebGL Scene Manager 
    // to initialize the `GeneratedLogoCenterpiece` module.

    // C. WEBGL SCENE MANAGER
    // - AssetLoader fetches `/models/studio-centerpiece.glb`.
    // - Extracts the physical mesh and applies environment maps tailored for 'chrome'.

    // D. MOTION ENGINE (The physical link)
    // Because `supportsMotionAnchors: true` was saved in the Registration Record:
    // - The WebGL Module tracks the 3D bounds of the logo as the user scrolls.
    // - It continually runs: `motionEngine.publishAnchor('logo-anchor', screenX, screenY)`
    // - Downstream typography floating in HTML stays glued to the 3D logo seamlessly.
}

/* =========================================================
   Example 2: Handling Failures Gracefully
   ========================================================= */
async function handleFailureExample() {
    const payload: LogoGenerationRequest = {
        inputType: 'svg',
        sourcePayload: 'missing-file.png', // Will trigger a validation error manually
        extrusionDepth: 0.1, bevelDepth: 0, bevelResolution: 4, materialPreset: 'glass', targetFilename: 'fail'
    };

    const jobId = await runner.queueJob(payload, {});

    // If we poll the job state later:
    /*
      {
        jobId: "...",
        status: "failed",
        errorDetails: {
          code: "INVALID_SVG",
          message: "Source payload missing .svg extension",
          failedAtStep: "validating"
        }
      }
    */
    // The Admin UI can read this exact state and provide a localized error, or a "Retry" button
    // that queues the job again.
}
