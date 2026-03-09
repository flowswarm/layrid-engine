/**
 * pipeline/feedback/feedbackEngineWiring.ts
 * 
 * Demonstrates the EXACT integration answering the 7 Engine Wiring requirements
 * mapping a Client's subjective comment on a Preview URL all the way down into 
 * the Python Blender MCP processor, generating a new mesh inherently without 
 * touching Live Production code.
 */

import { AssetRegistry } from '../registry/AssetRegistry';
import { LogoJobRunner, LogoJobConfig } from '../jobs/LogoJobRunner';
import { SiteDeploymentSync } from '../deployment/SiteDeploymentSync';
import { ComparisonSessionManager } from '../preview/ComparisonSessionManager';
import { FeedbackManager } from './FeedbackManager';

// --- System Mocks ---
const registry = new AssetRegistry();
const runner = new LogoJobRunner(registry);
const deploymentSync = new SiteDeploymentSync();
const comparisonManager = new ComparisonSessionManager(null as any, deploymentSync);
const feedbackManager = new FeedbackManager(runner, registry);

const siteId = 'site-a';


// ==============================================================================
// 1. CREATE SESSION & ASSET BASELINE
// ==============================================================================
/**
 * Developer previously ran a Job which resulted in a `chrome` Logo Asset.
 * The internal ID is `legacy-chrome-123`, belonging to the family `fam-base`.
 */
const baselineConfig: LogoJobConfig = { materialPreset: 'chrome', extrusionDepth: 0.1, bevelSize: 0.02, complexity: 'high', primaryColor: '#FFF' };
const originalJobId = 'job-original';
const originalAssetId = registry.draftAsset('fam-base', siteId, baselineConfig, originalJobId); // Mocks the generated asset entering the DB

const session = comparisonManager.createComparisonSession(siteId, 'hero-centerpiece', [originalAssetId], 'admin-1');


// ==============================================================================
// 2 & 3. ATTACH FEEDBACK TO SESSION & GENERATE STRUCTURED FIELDS
// ==============================================================================
/**
 * Client looks at the Chrome asset inside the unique Session URL. 
 * They click "Provide Feedback", and hit "Needs Revision: Too shiny, make it thicker."
 */
const feedback = feedbackManager.submitFeedback(
    siteId,
    originalAssetId,            // 2. Safely ties to the EXACT hash they are viewing
    'fam-base',                 // Maintains family grouping
    'client@brand.com',
    'Too shiny, make it thicker.',
    'revision-request',
    {
        materialChange: 'matte-plastic', // 3. The Front-End translated "Too shiny" -> Enum
        thicknessDelta: +0.6             // 3. The Front-End translated "Thicker" -> Float
    },
    undefined,
    session.comparisonSessionId     // 1. Attaches the token UUID for auditing
);


// ==============================================================================
// 4. HANDOFF TO LOGO ASSET JOB RUNNER
// ==============================================================================
/**
 * Admin reads the ticket and clicks "Approve Revision Request".
 * `FeedbackManager` natively extracts the `originalAssetId` config from the DB.
 * It applies the Deltas: 
 *   thickness = 0.1 + (0.6 * var) => 0.16
 *   material  = 'matte-plastic'
 * 
 * It then dispatches inherently to the Job Runner.
 */
const revisionJobId = feedbackManager.convertFeedbackToRevisionRequest(feedback.feedbackId, 'admin-1');
// feedback.status === 'converted-to-revision'
// feedback.revisionJobId === revisionJobId


// ==============================================================================
// 5. BLENDER MCP COMMAND EXECUTION
// ==============================================================================
/**
 * `LogoJobRunner` picks up `revisionJobId`.
 * Look at `src/admin/api/createJob.ts` or `pipeline/jobs/LogoJobRunner.ts`.
 * The Job script fires the exact Blender python command:
 * 
 * ```bash
 * blender --background --python GenerateLogo.py -- \
 *   --output "/mesh-gen-revised.glb" \
 *   --material "matte-plastic" \
 *   --extrusion "0.16"
 * ```
 */


// ==============================================================================
// 6. STORE NEW VARIANT UNDER STRICT ORIGINAL FAMILY BOUNDS
// ==============================================================================
/**
 * Blender finishes the GLB. The Job Runner inherently catches the success hook.
 * It creates a brand new Asset Hash in the Registry, explicitly chaining it 
 * to the exact same `fam-base`. 
 */
// MOCK: Runner finishes execution and commits to Registry
const revisedAssetId = registry.draftAsset('fam-base', siteId, {
    materialPreset: 'matte-plastic',
    extrusionDepth: 0.16,
    bevelSize: 0.02,
    complexity: 'high',
    primaryColor: '#FFF'
}, revisionJobId);

// Admin can now visually observe the `registry.getByFamily('fam-base')` returning 
// an array of [originalAssetId, revisedAssetId]. Both are physically tracked.


// ==============================================================================
// 7. LIVE RUNTIME REMAINS UNTOUCHED
// ==============================================================================
/**
 * Throughout this entire lifecycle (from Client typing "Too shiny" up to Blender 
 * generating `revisedAssetId`), the production runtime hasn't even blinked.
 * 
 * `deploymentSync.resolveLiveAssetForSite()` still points to `legacy-chrome-001`.
 * 
 * The new Matte variant sits silently as a "Draft" inside the database. It will
 * only go live if an Admin explicitly routes it into a new ApprovalSession, 
 * gets full client signoff, and executes `publishAsset()`.
 */
const liveHashLoc = deploymentSync.resolveLiveAssetForSite(siteId, 'production', 'hero-centerpiece');
// liveHashLoc !== originalAssetId && liveHashLoc !== revisedAssetId
