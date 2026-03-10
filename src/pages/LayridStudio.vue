<template>
  <div class="studio">
    <!-- ─── TOP BAR ─────────────────────────────────────── -->
    <header class="studio-header">
      <div class="header-brand">
        <span class="brand-icon">◆</span>
        <h1 class="brand-title">Layrid Studio</h1>
      </div>
      <nav class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>
      <div class="header-status">
        <span class="status-dot" :class="liveAssetId ? 'dot-live' : 'dot-idle'"></span>
        <span class="status-text">{{ liveAssetId ? 'LIVE' : 'NO ASSET' }}</span>
      </div>
    </header>

    <!-- ─── MAIN LAYOUT ─────────────────────────────────── -->
    <div class="studio-body">
      <!-- LEFT: 3D Viewport (always visible, shared renderer) -->
      <div class="viewport-area">
        <div class="viewport-chrome">
          <div class="viewport-label">
            <span class="vp-mode" :class="'vp-' + runtimeMode">{{ runtimeMode.toUpperCase() }}</span>
            <span class="vp-info">{{ viewportInfo }}</span>
          </div>
          <HeroCenterpiece :content="{ brandName: currentBrandName, siteId: siteId }" />
        </div>
      </div>

      <!-- RIGHT: Control Panel (changes per tab) -->
      <aside class="control-panel">

        <!-- ══════════════════════════════════════════════ -->
        <!-- TAB 1: GENERATE                               -->
        <!-- ══════════════════════════════════════════════ -->
        <div v-if="activeTab === 'generate'" class="panel-content">
          <div class="panel-section">
            <h2 class="section-title">Asset Generation</h2>
            <p class="section-desc">Create a new 3D logo centerpiece from SVG or text.</p>
          </div>

          <div class="panel-section">
            <label class="field-label">Brand Name</label>
            <input v-model="genForm.brandName" type="text" class="field-input" placeholder="e.g. LAYRID" />
          </div>

          <div class="panel-section">
            <label class="field-label">Source Type</label>
            <div class="toggle-group">
              <button
                @click="genForm.sourceType = 'text'"
                :class="['toggle-btn', { active: genForm.sourceType === 'text' }]"
              >Text</button>
              <button
                @click="genForm.sourceType = 'svg'"
                :class="['toggle-btn', { active: genForm.sourceType === 'svg' }]"
              >SVG</button>
            </div>
          </div>

          <div v-if="genForm.sourceType === 'text'" class="panel-section">
            <label class="field-label">Logo Text</label>
            <input v-model="genForm.sourcePayload" type="text" class="field-input" placeholder="e.g. ACME" />
          </div>

          <div v-if="genForm.sourceType === 'svg'" class="panel-section">
            <label class="field-label">SVG File</label>
            <div class="file-drop" @click="triggerFileInput">
              <input ref="fileInputRef" type="file" accept=".svg" class="file-hidden" @change="handleFileSelect" />
              <span class="file-icon">📁</span>
              <span class="file-text">{{ svgFileName || 'Drop SVG or click to browse' }}</span>
            </div>
          </div>

          <div class="panel-section">
            <label class="field-label">Material Preset</label>
            <div class="material-grid">
              <button
                v-for="mat in materials"
                :key="mat.id"
                @click="genForm.materialPreset = mat.id"
                :class="['material-chip', { active: genForm.materialPreset === mat.id }]"
              >
                <span class="mat-swatch" :style="{ background: mat.color }"></span>
                <span class="mat-name">{{ mat.label }}</span>
              </button>
            </div>
          </div>

          <div class="panel-section">
            <label class="field-label">Brand Color</label>
            <div class="color-row">
              <input v-model="genForm.brandColor" type="color" class="color-picker" />
              <input v-model="genForm.brandColor" type="text" class="field-input color-hex" placeholder="#8B5CF6" />
            </div>
          </div>

          <div class="panel-section row-fields">
            <div>
              <label class="field-label">Depth</label>
              <input v-model.number="genForm.depth" type="number" step="0.01" min="0.01" max="2" class="field-input" />
            </div>
            <div>
              <label class="field-label">Bevel</label>
              <input v-model.number="genForm.bevel" type="number" step="0.01" min="0" max="0.5" class="field-input" />
            </div>
          </div>

          <button @click="generateAsset" :disabled="isGenerating" class="action-btn btn-generate">
            {{ isGenerating ? 'Generating…' : '✦ Generate 3D Asset' }}
          </button>
        </div>

        <!-- ══════════════════════════════════════════════ -->
        <!-- TAB 2: PREVIEW                                -->
        <!-- ══════════════════════════════════════════════ -->
        <div v-if="activeTab === 'preview'" class="panel-content">
          <div class="panel-section">
            <h2 class="section-title">Asset Preview</h2>
            <p class="section-desc">Select a generated asset to preview it in the 3D viewport.</p>
          </div>

          <div v-if="assets.length === 0" class="empty-state">
            <span class="empty-icon">📦</span>
            <span class="empty-text">No assets generated yet. Go to Generate tab first.</span>
          </div>

          <div v-for="asset in assets" :key="asset.id" class="asset-card" @click="previewAsset(asset.id)">
            <div class="asset-card-left">
              <span class="asset-status-dot" :class="'dot-' + asset.status"></span>
              <div class="asset-info">
                <div class="asset-name">{{ asset.name }}</div>
                <div class="asset-meta">{{ asset.material }} · {{ asset.status }}</div>
              </div>
            </div>
            <button
              class="preview-btn"
              :class="{ active: previewingId === asset.id }"
              @click.stop="previewAsset(asset.id)"
            >
              {{ previewingId === asset.id ? '● Live' : '👁 Preview' }}
            </button>
          </div>

          <button v-if="previewingId" @click="exitPreview" class="action-btn btn-secondary">
            ← Return to Live
          </button>
        </div>

        <!-- ══════════════════════════════════════════════ -->
        <!-- TAB 3: COMPARE                                -->
        <!-- ══════════════════════════════════════════════ -->
        <div v-if="activeTab === 'compare'" class="panel-content">
          <div class="panel-section">
            <h2 class="section-title">Asset Comparison</h2>
            <p class="section-desc">Select two assets to compare side-by-side in the viewport.</p>
          </div>

          <div v-if="assets.length < 2" class="empty-state">
            <span class="empty-icon">⚖</span>
            <span class="empty-text">Need at least 2 generated assets to compare.</span>
          </div>

          <template v-else>
            <div class="panel-section">
              <label class="field-label">Asset A</label>
              <select v-model="compareA" class="field-select">
                <option value="">Select asset…</option>
                <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.name }} ({{ a.material }})</option>
              </select>
            </div>
            <div class="panel-section">
              <label class="field-label">Asset B</label>
              <select v-model="compareB" class="field-select">
                <option value="">Select asset…</option>
                <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.name }} ({{ a.material }})</option>
              </select>
            </div>

            <button
              @click="startComparison"
              :disabled="!compareA || !compareB || compareA === compareB"
              class="action-btn btn-compare"
            >
              ⚖ Compare Assets
            </button>

            <div v-if="isComparing" class="compare-controls">
              <div class="compare-indicator">
                <span>Viewing: </span>
                <button @click="switchCompare('A')" :class="{ active: activeCompareSlot === 'A' }">A</button>
                <button @click="switchCompare('B')" :class="{ active: activeCompareSlot === 'B' }">B</button>
              </div>
              <button @click="exitComparison" class="action-btn btn-secondary">
                ← Exit Comparison
              </button>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════ -->
        <!-- TAB 4: PUBLISH                                -->
        <!-- ══════════════════════════════════════════════ -->
        <div v-if="activeTab === 'publish'" class="panel-content">
          <div class="panel-section">
            <h2 class="section-title">Publish & Live Mapping</h2>
            <p class="section-desc">Approve and publish assets to the live site.</p>
          </div>

          <div v-if="liveAssetId" class="live-banner">
            <span class="live-indicator"></span>
            <div>
              <div class="live-label">Current Live Asset</div>
              <div class="live-id">{{ shortId(liveAssetId) }}</div>
            </div>
          </div>

          <div v-if="publishableAssets.length === 0" class="empty-state">
            <span class="empty-icon">🚀</span>
            <span class="empty-text">No assets ready to publish. Generate and approve assets first.</span>
          </div>

          <div v-for="asset in publishableAssets" :key="asset.id" class="publish-card">
            <div class="asset-info">
              <div class="asset-name">{{ asset.name }}</div>
              <div class="asset-meta">{{ asset.material }} · {{ asset.status }}</div>
            </div>
            <div class="publish-actions">
              <button
                v-if="asset.status === 'draft'"
                @click="advanceWorkflow(asset.id, 'generate')"
                class="wf-btn"
              >Mark Generated</button>
              <button
                v-if="asset.status === 'generated'"
                @click="advanceWorkflow(asset.id, 'review')"
                class="wf-btn"
              >Submit Review</button>
              <button
                v-if="asset.status === 'review'"
                @click="advanceWorkflow(asset.id, 'approve')"
                class="wf-btn btn-approve"
              >✓ Approve</button>
              <button
                v-if="asset.status === 'approved'"
                @click="publishAsset(asset.id)"
                class="wf-btn btn-publish"
              >🚀 Publish Live</button>
              <span v-if="asset.status === 'published'" class="published-badge">● LIVE</span>
            </div>
          </div>
        </div>

        <!-- ─── Event Log (all tabs) ─────────────────── -->
        <div class="event-log">
          <div class="log-title">Activity</div>
          <div v-for="(ev, i) in events.slice(-6)" :key="i" class="log-entry">{{ ev }}</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import HeroCenterpiece from '../engine/components/HeroCenterpiece.vue';
import { MotionEngine } from '../engine/runtime/MotionEngine';
import { PlatformServices } from '../platform/PlatformServices';
import { v4 as uuidv4 } from 'uuid';

// ─── Constants ──────────────────────────────────────────
const siteId = 'studio-site';
const tabs = [
  { id: 'generate', label: 'Generate', icon: '✦' },
  { id: 'preview', label: 'Preview', icon: '👁' },
  { id: 'compare', label: 'Compare', icon: '⚖' },
  { id: 'publish', label: 'Publish', icon: '🚀' }
] as const;

const materials = [
  { id: 'chrome', label: 'Chrome', color: 'linear-gradient(135deg, #e2e8f0, #94a3b8)' },
  { id: 'brushed-metal', label: 'Brushed', color: 'linear-gradient(135deg, #78716c, #a8a29e)' },
  { id: 'matte-plastic', label: 'Matte', color: 'linear-gradient(135deg, #475569, #64748b)' },
  { id: 'glass', label: 'Glass', color: 'linear-gradient(135deg, #bae6fd, #7dd3fc)' },
  { id: 'emissive-neon', label: 'Neon', color: 'linear-gradient(135deg, #c084fc, #e879f9)' },
  { id: 'flat-monochrome', label: 'Flat', color: 'linear-gradient(135deg, #1e293b, #334155)' },
];

type TabId = 'generate' | 'preview' | 'compare' | 'publish';

// ─── Reactive State ─────────────────────────────────────
const activeTab = ref<TabId>('generate');
const events = ref<string[]>([]);

// Generation form
const genForm = reactive({
  brandName: 'LAYRID',
  sourceType: 'text' as 'text' | 'svg',
  sourcePayload: 'LAYRID',
  materialPreset: 'chrome',
  brandColor: '#8B5CF6',
  depth: 0.15,
  bevel: 0.03,
});
const svgFileName = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const isGenerating = ref(false);

// Asset tracking
interface StudioAsset {
  id: string;
  name: string;
  material: string;
  status: string;
  familyId: string;
}
const assets = ref<StudioAsset[]>([]);

// Preview
const previewingId = ref<string | null>(null);

// Compare
const compareA = ref('');
const compareB = ref('');
const isComparing = ref(false);
const activeCompareSlot = ref<'A' | 'B'>('A');

// Publish
const liveAssetId = ref<string | null>(null);

// Runtime state
const runtimeMode = ref('live');
const currentAssetIds = ref<string[]>([]);

let unsub: (() => void) | null = null;

// ─── Computed ───────────────────────────────────────────
const currentBrandName = computed(() => genForm.brandName || 'LAYRID');
const viewportInfo = computed(() => {
  if (currentAssetIds.value.length > 0) return currentAssetIds.value.map(shortId).join(' vs ');
  return 'Procedural fallback';
});

const publishableAssets = computed(() => {
  return assets.value.filter(a => a.status !== 'published' || a.id === liveAssetId.value);
});

// ─── Helpers ────────────────────────────────────────────
function shortId(id: string) { return id.length > 12 ? id.slice(0, 8) + '…' : id; }
function log(msg: string) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  events.value.push(`${ts} ${msg}`);
}
function triggerFileInput() { fileInputRef.value?.click(); }
function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    svgFileName.value = file.name;
    genForm.sourcePayload = file.name;
  }
}

// ─── Actions ────────────────────────────────────────────
async function generateAsset() {
  if (!genForm.brandName || !genForm.sourcePayload) return;
  isGenerating.value = true;
  const familyId = uuidv4();

  try {
    const result = await PlatformServices.requestLogo(siteId, familyId, {
      inputType: genForm.sourceType,
      materialPreset: genForm.materialPreset,
      sourcePayload: genForm.sourcePayload,
      extrusionDepth: genForm.depth,
      bevelDepth: genForm.bevel,
      brandColorHex: genForm.brandColor,
      targetFilename: `${genForm.brandName.toLowerCase()}-${Date.now()}`
    });

    // Register the GLB path (simulating Blender export)
    PlatformServices.registry.registerExportedFile(
      result.draftAssetId,
      `/models/${genForm.brandName.toLowerCase()}-${Date.now()}.glb`,
      `${genForm.brandName.toLowerCase()}.glb`
    );

    assets.value.push({
      id: result.draftAssetId,
      name: genForm.brandName,
      material: genForm.materialPreset,
      status: 'draft',
      familyId,
    });

    log(`✦ Generated: ${genForm.brandName} (${genForm.materialPreset})`);
  } catch (err: any) {
    log(`✗ Error: ${err.message}`);
  } finally {
    isGenerating.value = false;
  }
}

function previewAsset(assetId: string) {
  PlatformServices.enterPreview(assetId);
  previewingId.value = assetId;
  log(`👁 Preview: ${shortId(assetId)}`);
}

function exitPreview() {
  PlatformServices.exitToLive();
  previewingId.value = null;
  log('← Returned to live');
}

function startComparison() {
  if (!compareA.value || !compareB.value) return;
  PlatformServices.enterComparison([compareA.value, compareB.value]);
  isComparing.value = true;
  activeCompareSlot.value = 'A';
  log(`⚖ Comparing: ${shortId(compareA.value)} vs ${shortId(compareB.value)}`);
}

function switchCompare(slot: 'A' | 'B') {
  activeCompareSlot.value = slot;
  const targetId = slot === 'A' ? compareA.value : compareB.value;
  MotionEngine.write({
    scene: { mode: 'logo-centerpiece', activeCenterpieceAssetId: targetId }
  });
}

function exitComparison() {
  PlatformServices.exitToLive();
  isComparing.value = false;
  log('← Exited comparison');
}

function advanceWorkflow(assetId: string, step: string) {
  const asset = assets.value.find(a => a.id === assetId);
  if (!asset) return;

  switch (step) {
    case 'generate':
      PlatformServices.markGenerated(assetId);
      asset.status = 'generated';
      log(`✓ ${shortId(assetId)} marked generated`);
      break;
    case 'review':
      PlatformServices.submitForReview(assetId);
      asset.status = 'review';
      log(`📤 ${shortId(assetId)} submitted for review`);
      break;
    case 'approve':
      PlatformServices.approveAsset(assetId);
      asset.status = 'approved';
      log(`✓ ${shortId(assetId)} approved`);
      break;
  }
}

function publishAsset(assetId: string) {
  PlatformServices.publishAsset(assetId, siteId);
  const asset = assets.value.find(a => a.id === assetId);
  if (asset) asset.status = 'published';
  // Demote previous live
  assets.value.forEach(a => { if (a.id !== assetId && a.status === 'published') a.status = 'approved'; });
  liveAssetId.value = assetId;
  log(`🚀 Published: ${shortId(assetId)} is now LIVE`);
}

// ─── Lifecycle ──────────────────────────────────────────
onMounted(() => {
  PlatformServices.bootLive(siteId);
  log('Studio initialized');

  unsub = MotionEngine.subscribe((state) => {
    runtimeMode.value = state.context.mode;
    currentAssetIds.value = [...state.context.assetIds];
  });
});

onUnmounted(() => { unsub?.(); });
</script>

<style scoped>
/* ─── STUDIO LAYOUT ───────────────────────────────────── */
.studio {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #08080c;
  color: #e4e4e7;
  font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
  overflow: hidden;
}

/* ─── HEADER ──────────────────────────────────────────── */
.studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: rgba(12, 12, 18, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  font-size: 18px;
  color: #8b5cf6;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0;
  background: linear-gradient(135deg, #c4b5fd, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tab-nav {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 3px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #71717a;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover { color: #a1a1aa; background: rgba(255, 255, 255, 0.04); }
.tab-btn.active {
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3);
}

.tab-icon { font-size: 13px; }

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #71717a;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.dot-live { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
.dot-idle { background: #52525b; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ─── BODY LAYOUT ─────────────────────────────────────── */
.studio-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ─── VIEWPORT ────────────────────────────────────────── */
.viewport-area {
  flex: 1;
  position: relative;
  background: #09090b;
  min-width: 0;
}

.viewport-chrome {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewport-label {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

.vp-mode {
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.vp-live { background: rgba(34, 197, 94, 0.15); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.3); }
.vp-preview { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }
.vp-comparison { background: rgba(234, 179, 8, 0.15); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.3); }

.vp-info { color: #52525b; }

/* ─── CONTROL PANEL ───────────────────────────────────── */
.control-panel {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(12, 12, 18, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #27272a transparent;
}

.panel-content {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-section { margin-bottom: 16px; }

.section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px 0;
  background: linear-gradient(135deg, #e4e4e7, #a1a1aa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-desc {
  font-size: 12px;
  color: #52525b;
  margin: 0;
  line-height: 1.4;
}

/* ─── FORM FIELDS ─────────────────────────────────────── */
.field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #71717a;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.field-input, .field-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: #e4e4e7;
  font-family: inherit;
  font-size: 13px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus, .field-select:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.field-select option { background: #18181b; }

.toggle-group {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 3px;
}

.toggle-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #71717a;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn.active {
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
}

.file-drop {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.file-drop:hover { border-color: rgba(139, 92, 246, 0.4); }
.file-hidden { display: none; }
.file-icon { font-size: 20px; }
.file-text { font-size: 12px; color: #71717a; }

/* ─── MATERIAL GRID ───────────────────────────────────── */
.material-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.material-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: transparent;
  color: #a1a1aa;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.material-chip:hover { border-color: rgba(255, 255, 255, 0.15); }
.material-chip.active {
  border-color: rgba(139, 92, 246, 0.5);
  background: rgba(139, 92, 246, 0.08);
  color: #c4b5fd;
}

.mat-swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.color-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: none;
  padding: 0;
}

.color-hex { flex: 1; }

.row-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* ─── ACTION BUTTONS ──────────────────────────────────── */
.action-btn {
  display: block;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-generate {
  background: linear-gradient(135deg, #7c3aed, #8b5cf6);
  color: #fff;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
}

.btn-generate:hover:not(:disabled) {
  box-shadow: 0 6px 24px rgba(139, 92, 246, 0.5);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #a1a1aa;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

.btn-compare {
  background: linear-gradient(135deg, #ca8a04, #eab308);
  color: #18181b;
}

.btn-compare:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(234, 179, 8, 0.3); }

/* ─── ASSET CARDS ─────────────────────────────────────── */
.asset-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.asset-card:hover { border-color: rgba(139, 92, 246, 0.3); background: rgba(139, 92, 246, 0.04); }

.asset-card-left { display: flex; align-items: center; gap: 10px; }

.asset-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-draft { background: #52525b; }
.dot-generated { background: #3b82f6; }
.dot-review { background: #f59e0b; }
.dot-approved { background: #22c55e; }
.dot-published { background: #8b5cf6; box-shadow: 0 0 8px rgba(139, 92, 246, 0.5); }
.dot-pending_approval { background: #f59e0b; }

.asset-name { font-size: 13px; font-weight: 600; }
.asset-meta { font-size: 10px; color: #52525b; margin-top: 2px; }

.preview-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  color: #71717a;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-btn:hover { border-color: rgba(59, 130, 246, 0.4); color: #93c5fd; }
.preview-btn.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

/* ─── PUBLISH PANEL ───────────────────────────────────── */
.live-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 10px;
  margin-bottom: 16px;
}

.live-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
  animation: pulse 2s infinite;
  flex-shrink: 0;
}

.live-label { font-size: 10px; color: #86efac; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.live-id { font-size: 12px; color: #a7f3d0; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

.publish-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  margin-bottom: 8px;
}

.publish-actions { display: flex; gap: 6px; align-items: center; }

.wf-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  color: #a1a1aa;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.wf-btn:hover { background: rgba(255, 255, 255, 0.06); }
.btn-approve { border-color: rgba(34, 197, 94, 0.4); color: #86efac; }
.btn-approve:hover { background: rgba(34, 197, 94, 0.1); }
.btn-publish { border-color: rgba(139, 92, 246, 0.4); color: #c4b5fd; }
.btn-publish:hover { background: rgba(139, 92, 246, 0.1); }

.published-badge {
  font-size: 10px;
  font-weight: 700;
  color: #86efac;
  letter-spacing: 0.08em;
}

/* ─── COMPARE CONTROLS ────────────────────────────────── */
.compare-controls {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #71717a;
}

.compare-indicator button {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  color: #71717a;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.compare-indicator button.active {
  background: rgba(234, 179, 8, 0.15);
  border-color: rgba(234, 179, 8, 0.4);
  color: #fde047;
}

/* ─── EMPTY STATE ─────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
  gap: 12px;
}

.empty-icon { font-size: 32px; opacity: 0.5; }
.empty-text { font-size: 12px; color: #52525b; line-height: 1.5; }

/* ─── EVENT LOG ───────────────────────────────────────── */
.event-log {
  margin-top: auto;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.log-title {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
  margin-bottom: 8px;
}

.log-entry {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  line-height: 1.7;
  font-family: 'JetBrains Mono', monospace;
}
</style>

<!-- Deep overrides to constrain HeroCenterpiece within Studio layout -->
<style>
.studio .cinematic-hero-section {
  width: 100% !important;
  height: 100% !important;
}

.studio .transparent-centerpiece-renderer {
  width: 100% !important;
  height: 100% !important;
}

.studio .explicit-anchor-tracking-label {
  position: absolute !important;
}

.studio .hero-content-overlay {
  display: none;
}
</style>
