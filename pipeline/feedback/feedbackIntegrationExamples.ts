/**
 * pipeline/feedback/feedbackIntegrationExamples.ts
 * 
 * 3. EXPLICIT INTEGRATIONS
 * 
 * Demonstrates how unstructured qualitative client feedback collected during a Preview OR
 * Comparison physically resolves into quantitative Blender Job configs gracefully.
 */

import { AssetRegistry } from '../registry/AssetRegistry';
import { LogoJobRunner } from '../jobs/LogoJobRunner';
import { FeedbackManager } from './FeedbackManager';
import { ComparisonSessionManager } from '../preview/ComparisonSessionManager';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../workflow/ApprovalWorkflowEngine';


const registry = new AssetRegistry();
const runner = new LogoJobRunner(registry);
const deploymentSync = new SiteDeploymentSync();
const workflow = new ApprovalWorkflowEngine(registry, deploymentSync);

const comparisonManager = new ComparisonSessionManager(workflow, deploymentSync);
const feedbackManager = new FeedbackManager(runner, registry);

const siteId = 'site-a';


// ==============================================================================
// 1. "Prefer matte but make it thicker." (Single Preview context)
// ==============================================================================
export function examplePreferMatteMakeThicker() {

    // 1. Client views a Preview Session with a standard Chrome variant.
    // Extrusion defaults to 0.1 natively.
    const chromeAssetId = registry.draftAsset('fam-123', siteId, { materialPreset: 'chrome', extrusionDepth: 0.1 });

    // 2. Client submits raw string + Front-End maps simple intents
    const feedback = feedbackManager.submitFeedback(
        siteId,
        chromeAssetId,
        'fam-123',
        'client@brand.com',
        'Prefer matte but make it thicker.',   // The Raw Human string
        'revision-request',
        {
            materialChange: 'matte-plastic',
            thicknessDelta: +0.5                 // We want +50% thicker relative to limits
        }
    );

    // Math translation verifies status bounds
    // feedback.status === 'submitted'; feedback.structuredAdjustments.thicknessDelta === 0.5 

    // 3. Internal Admin reviews the ticket, hits 'Send to Blender MCP'
    const newJobId = feedbackManager.convertFeedbackToRevisionRequest(feedback.feedbackId, 'admin-1');

    // => The Orchestrator just natively received a new `LogoJobConfig` where:
    // config.materialPreset === 'matte-plastic'
    // config.extrusionDepth === 0.15   (0.1 base + [0.5 * 0.1 variance bound])
}


// ==============================================================================
// 2. Compare Chrome vs Matte -> Submit Preference Note
// ==============================================================================
export function exampleComparisonSelectionAndRevision() {

    // 1. Session Setup
    const chromeId = registry.draftAsset('fam-1', siteId, { materialPreset: 'chrome' });
    const matteId = registry.draftAsset('fam-1', siteId, { materialPreset: 'matte-plastic' });

    const session = comparisonManager.createComparisonSession(
        siteId, 'hero-centerpiece', [chromeId, matteId], 'admin-1'
    );

    // 2. Client uses the Comparison Canvas
    comparisonManager.switchComparisonCandidate(session.comparisonSessionId, matteId);
    comparisonManager.setPreferredCandidate(session.comparisonSessionId, matteId);

    // 3. Client executes formal feedback AT THE SESSION LEVEL 
    // "I select Matte as my favorite, but I need a revision."

    const feedback = feedbackManager.submitFeedback(
        siteId,
        matteId, // EXPLICITLY passing Matte as the baseline target
        'fam-1',
        'client@brand.com',
        'I select Matte as my favorite, but I need a revision. It is slightly too shiny.',
        'revision-request',
        {
            preferredCandidateAssetId: matteId, // Log the split-test winner forever
            shininessDelta: -0.2 // Quantifiable 
        },
        undefined,
        session.comparisonSessionId
    );

    // 4. Job Runner Handoff 
    // It natively loads the Exact Matte `LogoJobConfig` from the DB as the starting point.
    // It mechanically dulls the roughness parameters, and sends the revised job to Blender MCP.
    const jobId = feedbackManager.convertFeedbackToRevisionRequest(feedback.feedbackId, 'admin-1');
}

// ==============================================================================
// EXTENSION NOTES FOR FUTURE DEVS
// ==============================================================================
/**
 * REVISION PIPELINE EXTENSIONS
 * 
 * - **AI Parsing Interceptors:**
 *   The separation of `rawNotes` vs `structuredAdjustments` means you can easily
 *   intercept requests. E.g.: 
 *   `LLM Parse("too chunky") -> { thicknessDelta: -0.4, label: "Thinner" }`.
 *   The UI prompts the user to confirm before hitting `submitFeedback`.
 *   
 * - **Threaded Multi-Reviewer Workflows:**
 *   Feedback tickets point to `variantFamilyId`. A Dashboard can list 
 *   Asset A -> Feedback 001 -> Asset B -> Feedback 002.
 *   `status: 'resolved'` closes the chain when eventually `pipeline.publish()` is executed.
 */
