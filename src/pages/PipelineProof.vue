<template>
  <div class="pipeline-page">
    <!-- Fixed pipeline control panel -->
    <aside class="pipeline-panel">
      <div class="panel-header">
        <h1 class="panel-title">Pipeline Proof</h1>
        <span class="mode-badge" :class="'badge-' + runtimeMode">{{ runtimeMode.toUpperCase() }}</span>
      </div>

      <!-- Pipeline Steps -->
      <div class="pipeline-steps">
        <div class="step-section">
          <div class="step-label">1. ASSET GENERATION</div>
          <button @click="requestLogo" :disabled="!!currentAssetId" class="action-btn btn-primary">
            {{ currentAssetId ? '✅ Logo Requested' : '🎨 Request Logo' }}
          </button>
          <div v-if="currentAssetId" class="status-line">
            <span class="label">draftAssetId:</span> {{ shortId(currentAssetId) }}
          </div>
          <div v-if="currentJobId" class="status-line">
            <span class="label">jobId:</span> {{ shortId(currentJobId) }}
          </div>
        </div>

        <div class="step-section">
          <div class="step-label">2. REVIEW WORKFLOW</div>
          <button @click="markGenerated" :disabled="workflowStep !== 'draft'" class="action-btn btn-secondary">
            Mark Generated
          </button>
          <button @click="submitForReview" :disabled="workflowStep !== 'generated'" class="action-btn btn-secondary">
            Submit for Review
          </button>
          <button @click="approve" :disabled="workflowStep !== 'review'" class="action-btn btn-success">
            ✅ Approve
          </button>
          <div class="status-line">
            <span class="label">workflow state:</span>
            <span :class="'wf-' + workflowStep">{{ workflowStep }}</span>
          </div>
        </div>

        <div class="step-section">
          <div class="step-label">3. PUBLISH & DEPLOY</div>
          <button @click="publish" :disabled="workflowStep !== 'approved'" class="action-btn btn-publish">
            🚀 Publish to Live
          </button>
          <div v-if="isPublished" class="status-line published-status">
            <span class="label">live asset:</span> {{ shortId(currentAssetId!) }}
          </div>
        </div>

        <div class="step-section">
          <div class="step-label">4. RUNTIME MODES</div>
          <div class="mode-buttons">
            <button @click="goLive" :class="{ active: runtimeMode === 'live' }">LIVE</button>
            <button @click="goPreview" :class="{ active: runtimeMode === 'preview' }" :disabled="!currentAssetId">PREVIEW</button>
            <button @click="goCompare" :class="{ active: runtimeMode === 'comparison' }" :disabled="!currentAssetId">COMPARE</button>
          </div>
        </div>
      </div>

      <!-- Live state readout -->
      <div class="state-readout">
        <div class="divider"></div>
        <div><span class="label">mode:</span> <span :class="'val-' + runtimeMode">{{ runtimeMode }}</span></div>
        <div><span class="label">environment:</span> {{ environment }}</div>
        <div><span class="label">assetIds:</span> {{ assetIdsLabel }}</div>
        <div><span class="label">progress:</span> {{ smoothedProgress.toFixed(3) }}</div>
        <div><span class="label">anchor.x:</span> <span :class="anchorX > 0 ? 'val-ok' : 'val-warn'">{{ anchorX }}</span></div>
        <div><span class="label">anchor.y:</span> <span :class="anchorY > 0 ? 'val-ok' : 'val-warn'">{{ anchorY }}</span></div>
        <div class="divider"></div>

        <div class="criteria-title">PIPELINE PASS CRITERIA</div>
        <div class="check" :class="{ pass: !!currentAssetId }">G. Job queued → draft created</div>
        <div class="check" :class="{ pass: workflowStep !== 'draft' && workflowStep !== '' }">H. Workflow advances</div>
        <div class="check" :class="{ pass: isPublished }">I. Asset published to live</div>
        <div class="check" :class="{ pass: previewTested }">J. Preview loads candidate</div>
        <div class="check" :class="{ pass: comparisonTested }">K. Comparison loads two assets</div>
        <div class="check" :class="{ pass: liveRestoredAfterPreview }">L. Live restored after preview</div>
      </div>

      <!-- Event log -->
      <div class="event-log">
        <div class="step-label">EVENT LOG</div>
        <div v-for="(event, i) in events.slice(-8)" :key="i" class="log-line">{{ event }}</div>
      </div>
    </aside>

    <!-- Hero proof area — SAME COMPONENT as engine-proof -->
    <section ref="heroRef" class="hero-section">
      <div class="hero-sticky">
        <HeroCenterpiece :content="{ brandName: 'LAYRID', siteId: siteId }" />
      </div>
    </section>

    <!-- Scroll spacer -->
    <section class="scroll-spacer">
      <div class="spacer-text">
        Pipeline → Registry → Workflow → Deployment → MotionEngine → WebGL
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import HeroCenterpiece from '../engine/components/HeroCenterpiece.vue';
import { MotionEngine } from '../engine/runtime/MotionEngine';
import { PlatformServices } from '../platform/PlatformServices';
import { v4 as uuidv4 } from 'uuid';

const siteId = 'pipeline-proof-site';
const heroRef = ref<HTMLElement | null>(null);

// Pipeline state
const currentAssetId = ref<string | null>(null);
const currentJobId = ref<string | null>(null);
const currentWorkflowId = ref<string | null>(null);
const workflowStep = ref('');
const isPublished = ref(false);
const events = ref<string[]>([]);

// Runtime state from MotionEngine
const runtimeMode = ref('live');
const environment = ref('live');
const assetIds = ref<string[]>([]);
const smoothedProgress = ref(0);
const anchorX = ref(0);
const anchorY = ref(0);

// Proof tracking
const previewTested = ref(false);
const comparisonTested = ref(false);
const liveRestoredAfterPreview = ref(false);
let wasInPreview = false;

let unsub: (() => void) | null = null;

function log(msg: string) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    events.value.push(`[${ts}] ${msg}`);
}

function shortId(id: string): string {
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
}

// ─── Pipeline Actions ────────────────────────────────────

async function requestLogo() {
    log('Requesting logo generation…');
    const familyId = uuidv4();

    try {
        const result = await PlatformServices.requestLogo(siteId, familyId, {
            inputType: 'text',
            sourcePayload: 'LAYRID',
            extrusionDepth: 0.15,
            bevelDepth: 0.03,
            bevelResolution: 4,
            materialPreset: 'chrome',
            brandColorHex: '#8B5CF6',
            targetFilename: `hero-${Date.now()}`
        });

        currentAssetId.value = result.draftAssetId;
        currentJobId.value = result.jobId;
        currentWorkflowId.value = result.workflowId;
        workflowStep.value = 'draft';
        log(`✅ Draft created: ${shortId(result.draftAssetId)}`);
    } catch (err: any) {
        log(`❌ Request failed: ${err.message}`);
    }
}

function markGenerated() {
    if (!currentAssetId.value) return;

    // Simulate: register an exported file so the registry has a runtimePath
    PlatformServices.registry.registerExportedFile(
        currentAssetId.value,
        `/models/hero-${Date.now()}.glb`,
        `hero-centerpiece.glb`
    );

    PlatformServices.markGenerated(currentAssetId.value);
    workflowStep.value = 'generated';
    log('✅ Marked generated (GLB registered)');
}

function submitForReview() {
    if (!currentAssetId.value) return;
    PlatformServices.submitForReview(currentAssetId.value);
    workflowStep.value = 'review';
    log('📤 Submitted for review');
}

function approve() {
    if (!currentAssetId.value) return;
    PlatformServices.approveAsset(currentAssetId.value);
    workflowStep.value = 'approved';
    log('✅ Asset approved');
}

function publish() {
    if (!currentAssetId.value) return;
    PlatformServices.publishAsset(currentAssetId.value, siteId);
    workflowStep.value = 'published';
    isPublished.value = true;
    log(`🚀 Published! Live asset: ${shortId(currentAssetId.value)}`);
}

function goLive() {
    PlatformServices.exitToLive();
    if (wasInPreview) {
        liveRestoredAfterPreview.value = true;
    }
    log('🔴 Switched to LIVE mode');
}

function goPreview() {
    if (!currentAssetId.value) return;
    PlatformServices.enterPreview(currentAssetId.value);
    previewTested.value = true;
    wasInPreview = true;
    log(`👁 Preview: ${shortId(currentAssetId.value)}`);
}

function goCompare() {
    if (!currentAssetId.value) return;
    // Compare current asset against a demo reference
    PlatformServices.enterComparison([currentAssetId.value, 'demo-compare-ref']);
    comparisonTested.value = true;
    wasInPreview = true;
    log('⚖ Comparison mode: 2 assets loaded');
}

const assetIdsLabel = computed(() => assetIds.value.length ? assetIds.value.join(', ') : '—');

onMounted(() => {
    // Boot live context through the real pipeline
    PlatformServices.bootLive(siteId);
    log('🚀 Platform booted');

    unsub = MotionEngine.subscribe((state) => {
        runtimeMode.value = state.context.mode;
        environment.value = state.context.environment;
        assetIds.value = [...state.context.assetIds];
        smoothedProgress.value = state.spatial.smoothedProgress;
        const anchor = state.topology?.anchors?.headerFollow;
        anchorX.value = anchor ? Math.round(anchor.x) : 0;
        anchorY.value = anchor ? Math.round(anchor.y) : 0;
    });
});

onUnmounted(() => {
    unsub?.();
});
</script>

<style scoped>
.pipeline-page {
    min-height: 300vh;
    background: #0a0a0f;
    color: #fff;
}

/* ─── Pipeline Panel ─────────────────────────────── */
.pipeline-panel {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 9999;
    width: 380px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(10, 10, 20, 0.92);
    padding: 16px;
    font-size: 11px;
    backdrop-filter: blur(16px);
    font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}

.panel-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0;
}

.mode-badge {
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
}

.badge-live { background: rgba(34, 197, 94, 0.2); color: #86efac; }
.badge-preview { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
.badge-comparison { background: rgba(234, 179, 8, 0.2); color: #fde047; }

/* ─── Steps ──────────────────────────────────────── */
.step-section {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.step-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 8px;
}

.action-btn {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    background: transparent;
    color: #d4d4d8;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 6px;
}

.action-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.action-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.btn-primary { border-color: rgba(139, 92, 246, 0.4); color: #c4b5fd; }
.btn-primary:hover:not(:disabled) { background: rgba(139, 92, 246, 0.15); }

.btn-secondary { border-color: rgba(255, 255, 255, 0.1); color: #a1a1aa; }

.btn-success { border-color: rgba(34, 197, 94, 0.4); color: #86efac; }
.btn-success:hover:not(:disabled) { background: rgba(34, 197, 94, 0.15); }

.btn-publish { border-color: rgba(59, 130, 246, 0.4); color: #93c5fd; }
.btn-publish:hover:not(:disabled) { background: rgba(59, 130, 246, 0.15); }

.status-line {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    padding: 2px 0;
}

.published-status { color: #86efac; }

.mode-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}

.mode-buttons button {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 8px 4px;
    background: transparent;
    color: #a1a1aa;
    font-family: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.15s;
}

.mode-buttons button:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.mode-buttons button:disabled { opacity: 0.3; cursor: not-allowed; }
.mode-buttons button.active { background: rgba(139, 92, 246, 0.2); border-color: #8b5cf6; color: #c4b5fd; }

/* ─── State Readout ──────────────────────────────── */
.state-readout {
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 8px;
}

.label { color: rgba(255, 255, 255, 0.4); }
.divider { height: 1px; background: rgba(255, 255, 255, 0.06); margin: 6px 0; }

.val-live { color: #86efac; }
.val-preview { color: #93c5fd; }
.val-comparison { color: #fde047; }
.val-ok { color: #86efac; }
.val-warn { color: #fca5a5; }

.wf-draft { color: #a1a1aa; }
.wf-generated { color: #93c5fd; }
.wf-review { color: #fde047; }
.wf-approved { color: #86efac; }
.wf-published { color: #c4b5fd; }

/* ─── Pass Criteria ──────────────────────────────── */
.criteria-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 6px;
}

.check { padding: 2px 0; color: rgba(255, 255, 255, 0.3); font-size: 10px; }
.check::before { content: '○ '; }
.check.pass { color: #86efac; }
.check.pass::before { content: '● '; }

/* ─── Event Log ──────────────────────────────────── */
.event-log {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.log-line {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.6;
    font-family: monospace;
}

/* ─── Hero Section ───────────────────────────────── */
.hero-section {
    position: relative;
    height: 200vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
}

.hero-sticky {
    position: sticky;
    top: 0;
    width: 100%;
    height: 100vh;
}

.scroll-spacer {
    height: 100vh;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
}

.spacer-text {
    max-width: 600px;
    padding: 0 32px;
    text-align: center;
    color: rgba(255, 255, 255, 0.25);
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.02em;
}
</style>
