/**
 * FLAGSHIP VERTICAL SLICE — End-to-End Integration Test Harness
 * 
 * Exercises the complete Layrid pipeline WITHOUT a browser:
 *   Asset Request → Registry → Preview → Comparison → Approval → Publish → Live Mapping → Runtime Resolution → MotionEngine Context
 * 
 * Run with: npx tsx test/flagship-test-harness.ts
 */

// Node.js polyfills for browser globals used by MotionEngine
if (typeof globalThis.requestAnimationFrame === 'undefined') {
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
    (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

import { AssetRegistry } from '../pipeline/registry/AssetRegistry';
import { SiteDeploymentSync } from '../pipeline/deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../pipeline/workflow/ApprovalWorkflowEngine';
import { PreviewSessionManager } from '../pipeline/preview/PreviewSessionManager';
import { ComparisonSessionManager } from '../pipeline/preview/ComparisonSessionManager';
import { ClientApprovalManager } from '../pipeline/preview/ClientApprovalManager';
import { RuntimeAssetResolver } from '../pipeline/preview/RuntimeAssetResolver';
import { MotionEngine } from '../src/engine/runtime/MotionEngine';
import { LogoGenerationRequest } from '../pipeline/schemas/generation.types';

// ─── Test Utilities ─────────────────────────────────────────
let passCount = 0;
let failCount = 0;

function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passCount++;
    } else {
        console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
        failCount++;
    }
}

function section(title: string) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'═'.repeat(60)}`);
}

// ─── Configuration (UUIDs required by Zod schemas) ─────────
const SITE_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4';
const FAMILY_ID = 'f1f1f1f1-a2a2-4b3b-9c4c-d5d5d5d5d5d5';
const ADMIN_ID = '10000001-0001-4001-a001-000000000001';
const CLIENT_EMAIL = 'client@acme.com';

// ─── Initialize Core Systems ────────────────────────────────
const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();
const workflowEngine = new ApprovalWorkflowEngine(registry, deploymentSync);
const previewManager = new PreviewSessionManager(workflowEngine, deploymentSync);
const comparisonManager = new ComparisonSessionManager(workflowEngine, deploymentSync);
const approvalManager = new ClientApprovalManager(workflowEngine, deploymentSync);

async function runFlagshipTest() {
    console.log('\n🚀 LAYRID FLAGSHIP VERTICAL SLICE — Integration Test');
    console.log('━'.repeat(60));

    // ═══════════════════════════════════════════════════════
    section('PART 1: Asset Request → Registry');
    // ═══════════════════════════════════════════════════════

    // --- Test 1A: SVG Logo Request ---
    const svgPayload: Partial<LogoGenerationRequest> = {
        inputType: 'svg',
        sourcePayload: '/assets/acme-logo.svg',
        materialPreset: 'chrome',
        extrusionDepth: 0.15,
        bevelDepth: 0.03,
        bevelResolution: 4,
        targetFilename: 'acme-hero-svg'
    };

    const svgAssetId = registry.draftAsset(FAMILY_ID, SITE_ID, {
        sourceType: 'svg',
        materialPreset: 'chrome',
        compatibleSceneModes: ['logo-centerpiece'],
        isHeroEligible: true,
        supportsMotionAnchors: true
    } as any);

    assert('SVG draft asset created', !!svgAssetId);
    assert('SVG asset has draft status', registry.getAssetById(svgAssetId)?.status === 'draft');

    // Simulate Blender export completing
    registry.registerExportedFile(svgAssetId, '/cdn/assets/acme-hero-svg.glb', 'acme-hero-svg.glb');
    assert('SVG asset registered with GLB path', registry.getAssetById(svgAssetId)?.runtimePath === '/cdn/assets/acme-hero-svg.glb');
    assert('SVG asset status is pending_approval', registry.getAssetById(svgAssetId)?.status === 'pending_approval');

    // --- Test 1B: Text Logo Request ---
    const textAssetId = registry.draftAsset(FAMILY_ID, SITE_ID, {
        sourceType: 'text',
        materialPreset: 'matte-plastic',
        compatibleSceneModes: ['logo-centerpiece'],
        isHeroEligible: true,
        supportsMotionAnchors: true
    } as any);

    registry.registerExportedFile(textAssetId, '/cdn/assets/acme-hero-text.glb', 'acme-hero-text.glb');
    assert('Text draft asset created', !!textAssetId);
    assert('Text asset status is pending_approval', registry.getAssetById(textAssetId)?.status === 'pending_approval');

    // ═══════════════════════════════════════════════════════
    section('PART 2: Preview / Comparison / Approval / Publish');
    // ═══════════════════════════════════════════════════════

    // --- Test 2A: Preview one candidate ---
    const svgWorkflowId = workflowEngine.initializeWorkflow(svgAssetId, FAMILY_ID, SITE_ID);
    workflowEngine.markGenerated(svgWorkflowId);
    workflowEngine.submitForReview(svgWorkflowId, ADMIN_ID);

    const previewSession = previewManager.createPreviewSession(
        SITE_ID, 'hero-centerpiece', svgAssetId, 'review', ADMIN_ID
    );
    assert('Preview session created', !!previewSession.previewToken);
    assert('Preview session is active', previewSession.status === 'active-preview');
    assert('Preview asset ID matches SVG', previewSession.previewAssetId === svgAssetId);

    // --- Test 2B: Comparison of two candidates ---
    const textWorkflowId = workflowEngine.initializeWorkflow(textAssetId, FAMILY_ID, SITE_ID);
    workflowEngine.markGenerated(textWorkflowId);
    workflowEngine.submitForReview(textWorkflowId, ADMIN_ID);

    const comparisonSession = comparisonManager.createComparisonSession(
        SITE_ID, 'hero-centerpiece', [svgAssetId, textAssetId], ADMIN_ID
    );
    assert('Comparison session created', !!comparisonSession.comparisonSessionId);
    assert('Comparison has 2 candidates', comparisonSession.candidates.length === 2);
    assert('Comparison status is pending-review', comparisonSession.status === 'pending-review');

    // Client toggles between candidates
    comparisonManager.switchComparisonCandidate(comparisonSession.comparisonSessionId, textAssetId);
    assert('Switched to text candidate', true); // No error thrown = success

    // Client selects their preference
    comparisonManager.setPreferredCandidate(comparisonSession.comparisonSessionId, svgAssetId);
    assert('Set SVG as preferred candidate', true);

    // --- Test 2C: Approval ---
    comparisonManager.approveSelectedCandidate(
        comparisonSession.comparisonSessionId,
        svgAssetId,
        'Love the chrome SVG version!',
        CLIENT_EMAIL
    );
    assert('SVG candidate approved', comparisonSession.approvalDecision === 'approved_candidate');
    assert('Approved asset ID is SVG', comparisonSession.approvedAssetId === svgAssetId);

    // --- Test 2D: Approve workflow and publish ---
    workflowEngine.approveAsset(svgWorkflowId, ADMIN_ID, 'Client approved');
    workflowEngine.publishAsset(svgWorkflowId, ADMIN_ID, 'production');

    const liveAsset = deploymentSync.resolveLiveAssetForSite(SITE_ID, 'production', 'hero-centerpiece');
    assert('Published SVG asset to live', liveAsset === svgAssetId);
    assert('Registry marks SVG as active', registry.getAssetById(svgAssetId)?.status === 'active');

    // ═══════════════════════════════════════════════════════
    section('PART 3: Runtime Asset Resolution → MotionEngine');
    // ═══════════════════════════════════════════════════════

    // --- Test 3A: Live mode resolution ---
    const liveContext = await RuntimeAssetResolver.resolve({}, svgAssetId);
    assert('Live mode resolves correctly', liveContext.mode === 'live');
    assert('Live asset ID matches', liveContext.assetIds[0] === svgAssetId);
    assert('Live environment is live', liveContext.environment === 'live');

    // --- Test 3B: Preview mode resolution ---
    const previewContext = await RuntimeAssetResolver.resolve(
        { preview_ticket: textAssetId }, svgAssetId
    );
    assert('Preview mode resolves correctly', previewContext.mode === 'preview');
    assert('Preview asset ID matches text', previewContext.assetIds[0] === textAssetId);

    // --- Test 3C: Comparison mode resolution ---
    const compareContext = await RuntimeAssetResolver.resolve(
        { compare: `${svgAssetId},${textAssetId}` }, svgAssetId
    );
    assert('Comparison mode resolves correctly', compareContext.mode === 'comparison');
    assert('Comparison has 2 asset IDs', compareContext.assetIds.length === 2);

    // --- Test 3D: Write context into MotionEngine ---
    MotionEngine.write({
        context: {
            siteId: SITE_ID,
            sceneRole: 'hero-centerpiece',
            assetIds: liveContext.assetIds,
            environment: liveContext.environment as 'live' | 'preview' | 'comparison',
            mode: liveContext.mode as 'live' | 'preview' | 'comparison'
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: liveContext.assetIds[0]
        }
    });

    const engineState = MotionEngine.read();
    assert('MotionEngine context.siteId correct', engineState.context.siteId === SITE_ID);
    assert('MotionEngine context.mode is live', engineState.context.mode === 'live');
    assert('MotionEngine context.sceneRole is hero-centerpiece', engineState.context.sceneRole === 'hero-centerpiece');
    assert('MotionEngine context.assetIds has SVG', engineState.context.assetIds.includes(svgAssetId));
    assert('MotionEngine scene.mode is logo-centerpiece', engineState.scene.mode === 'logo-centerpiece');
    assert('MotionEngine scene.activeCenterpieceAssetId matches', engineState.scene.activeCenterpieceAssetId === svgAssetId);

    // ═══════════════════════════════════════════════════════
    section('PART 7: Scroll Spatial State Verification');
    // ═══════════════════════════════════════════════════════

    // Simulate scroll spatial writes
    MotionEngine.write({
        spatial: {
            rawProgress: 0.5,
            smoothedProgress: 0.48,
            velocity: 0.02,
            direction: 'down',
            scrollY: 500
        }
    });

    const spatialState = MotionEngine.read();
    assert('Spatial rawProgress written', spatialState.spatial.rawProgress === 0.5);
    assert('Spatial smoothedProgress written', spatialState.spatial.smoothedProgress === 0.48);
    assert('Spatial velocity written', spatialState.spatial.velocity === 0.02);
    assert('Spatial direction is down', spatialState.spatial.direction === 'down');

    // ═══════════════════════════════════════════════════════
    section('PART 5: Anchor Topology Verification');
    // ═══════════════════════════════════════════════════════

    // Simulate anchor projection (normally done by WebGLSceneManager)
    MotionEngine.write({
        topology: {
            anchors: {
                headerFollow: { x: 640, y: 200 }
            }
        }
    });

    const topoState = MotionEngine.read();
    assert('Topology anchor headerFollow exists', !!topoState.topology.anchors.headerFollow);
    assert('Anchor X coordinate correct', topoState.topology.anchors.headerFollow.x === 640);
    assert('Anchor Y coordinate correct', topoState.topology.anchors.headerFollow.y === 200);

    // ═══════════════════════════════════════════════════════
    section('PART 8: Viewport + Degraded Mode Verification');
    // ═══════════════════════════════════════════════════════

    // Simulate desktop viewport
    MotionEngine.write({
        viewport: { width: 1920, height: 1080, breakpoint: 'desktop', degradedMode: false }
    });
    assert('Desktop viewport set', MotionEngine.read().viewport.breakpoint === 'desktop');
    assert('Desktop not degraded', MotionEngine.read().viewport.degradedMode === false);

    // Simulate mobile viewport with degraded mode
    MotionEngine.write({
        viewport: { width: 375, height: 812, breakpoint: 'mobile', degradedMode: true }
    });
    assert('Mobile viewport set', MotionEngine.read().viewport.breakpoint === 'mobile');
    assert('Mobile is degraded', MotionEngine.read().viewport.degradedMode === true);

    // ═══════════════════════════════════════════════════════
    section('RESULTS');
    // ═══════════════════════════════════════════════════════

    console.log(`\n  Total: ${passCount + failCount} tests`);
    console.log(`  ✅ Passed: ${passCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log('');

    if (failCount === 0) {
        console.log('  🎉 ALL TESTS PASSED — Flagship vertical slice pipeline verified!');
        console.log('');
        console.log('  Proven path:');
        console.log('    Logo Request → Draft → Blender Export → Registry → Pending Approval');
        console.log('    → Preview Session → Comparison Session → Approval → Publish');
        console.log('    → Live Mapping → RuntimeAssetResolver → MotionEngine Context');
        console.log('    → Spatial State → Anchor Topology → Viewport/Degradation');
        console.log('');
        console.log('  Remaining for browser testing:');
        console.log('    → WebGL centerpiece GLB load + scroll animation');
        console.log('    → DOM HeroAnchorFollower translate3d tracking');
        console.log('    → End-to-end visual verification');
    } else {
        console.log('  ⚠️ SOME TESTS FAILED — Review the failures above.');
        process.exit(1);
    }
}

// Execute
runFlagshipTest().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
