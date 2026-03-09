<template>
  <div class="proof-harness">
    <!-- ─── LEFT: Telemetry Panel ──────────────────────────────── -->
    <aside class="telemetry-panel">
      <h2 class="panel-title">LAYRID PROOF HARNESS</h2>

      <!-- Runtime Mode -->
      <section class="telemetry-group">
        <h3 class="group-label">Runtime Context</h3>
        <div class="telemetry-row">
          <span class="t-key">mode</span>
          <span class="t-val" :class="'mode-' + ctxMode">{{ ctxMode }}</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">environment</span>
          <span class="t-val">{{ ctxEnv }}</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">assetIds</span>
          <span class="t-val t-mono">{{ ctxAssetIds.join(', ') || '(empty)' }}</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">sceneRole</span>
          <span class="t-val t-mono">{{ ctxSceneRole }}</span>
        </div>
      </section>

      <!-- Spatial State -->
      <section class="telemetry-group">
        <h3 class="group-label">Spatial (ScrollController)</h3>
        <div class="telemetry-row">
          <span class="t-key">smoothedProgress</span>
          <span class="t-val t-mono">{{ scrollProgress.toFixed(4) }}</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">velocity</span>
          <span class="t-val t-mono">{{ velocity.toFixed(4) }}</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">direction</span>
          <span class="t-val">{{ direction }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (scrollProgress * 100) + '%' }"></div>
        </div>
      </section>

      <!-- Anchor Projection -->
      <section class="telemetry-group">
        <h3 class="group-label">Topology (Anchor Projection)</h3>
        <div class="telemetry-row">
          <span class="t-key">headerFollow.x</span>
          <span class="t-val t-mono" :class="{ 't-active': anchorX > 0 }">{{ anchorX.toFixed(1) }}px</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">headerFollow.y</span>
          <span class="t-val t-mono" :class="{ 't-active': anchorY > 0 }">{{ anchorY.toFixed(1) }}px</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">anchors count</span>
          <span class="t-val t-mono">{{ anchorCount }}</span>
        </div>
      </section>

      <!-- Viewport -->
      <section class="telemetry-group">
        <h3 class="group-label">Viewport</h3>
        <div class="telemetry-row">
          <span class="t-key">size</span>
          <span class="t-val t-mono">{{ vpWidth }}×{{ vpHeight }}</span>
        </div>
        <div class="telemetry-row">
          <span class="t-key">degradedMode</span>
          <span class="t-val" :class="degraded ? 't-warn' : 't-ok'">{{ degraded }}</span>
        </div>
      </section>

      <!-- Mode Switch Controls -->
      <section class="telemetry-group">
        <h3 class="group-label">Mode Switch (same renderer path)</h3>
        <div class="control-grid">
          <button
            class="mode-btn"
            :class="{ active: ctxMode === 'live' }"
            @click="switchMode('live', ['demo-live-001'])"
          >Live Asset</button>
          <button
            class="mode-btn"
            :class="{ active: ctxMode === 'preview' }"
            @click="switchMode('preview', ['preview-ticket-abc'])"
          >Preview Asset</button>
          <button
            class="mode-btn"
            :class="{ active: ctxMode === 'comparison' }"
            @click="switchMode('comparison', ['compare-a-001', 'compare-b-002'])"
          >Comparison (A+B)</button>
        </div>
        <p class="control-hint">All buttons use the same WebGLSceneManager.<br>Only context.assetIds changes.</p>
      </section>

      <!-- Proof chain -->
      <section class="telemetry-group">
        <h3 class="group-label">Proof Chain</h3>
        <div class="chain">
          <span class="chain-step" :class="{ proven: ctxAssetIds.length > 0 }">AssetResolve</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step" :class="{ proven: ctxAssetIds.length > 0 }">MotionEngine</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step" :class="{ proven: anchorX > 0 }">WebGL+Anchor</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step" :class="{ proven: anchorX > 0 }">DOM Follow</span>
        </div>
      </section>
    </aside>

    <!-- ─── RIGHT: Live Canvas + Anchor Follower ──────────────── -->
    <main class="proof-viewport">
      <!-- WebGL canvas managed by HeroCenterpiece/WebGLSceneManager -->
      <canvas ref="canvasRef" class="proof-canvas"></canvas>

      <!-- DOM anchor follower — this text MUST move with the 3D anchor -->
      <div ref="heroTextRef" class="anchor-follower-label">
        <span>LAYRID</span>
      </div>

      <!-- Crosshair at anchor position for visual proof -->
      <div
        class="anchor-crosshair"
        :style="{
          left: anchorX + 'px',
          top: anchorY + 'px',
          opacity: anchorX > 0 ? 1 : 0
        }"
      >
        <div class="crosshair-h"></div>
        <div class="crosshair-v"></div>
        <span class="crosshair-coord">{{ anchorX.toFixed(0) }}, {{ anchorY.toFixed(0) }}</span>
      </div>

      <!-- Scroll spacer — creates scrollable area -->
      <div class="scroll-spacer"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { MotionEngine } from '../runtime/MotionEngine';
import { RuntimeBootstrap } from '../runtime/RuntimeBootstrap';
import { SiteDeploymentSync } from '../../../pipeline/deployment/SiteDeploymentSync';

// ─── DOM Refs ────────────────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null);
const heroTextRef = ref<HTMLElement | null>(null);

// ─── Reactive telemetry state ────────────────────────────────
const ctxMode = ref('initializing');
const ctxEnv = ref('—');
const ctxAssetIds = ref<string[]>([]);
const ctxSceneRole = ref('—');

const scrollProgress = ref(0);
const velocity = ref(0);
const direction = ref('idle');

const anchorX = ref(0);
const anchorY = ref(0);
const anchorCount = ref(0);

const vpWidth = ref(0);
const vpHeight = ref(0);
const degraded = ref(false);

// ─── Engine refs ─────────────────────────────────────────────
let bootstrap: RuntimeBootstrap | null = null;
let unsubscribe: (() => void) | null = null;

// ─── Mode switching (same renderer path, different assetIds) ─
function switchMode(mode: 'live' | 'preview' | 'comparison', assetIds: string[]) {
  MotionEngine.write({
    context: {
      mode,
      environment: mode === 'live' ? 'live' : mode === 'preview' ? 'preview' : 'comparison',
      assetIds,
      siteId: 'proof-harness',
      sceneRole: 'hero-centerpiece'
    }
  });
}

onMounted(async () => {
  if (!canvasRef.value) return;

  // Subscribe to MotionEngine for live telemetry
  unsubscribe = MotionEngine.subscribe((state) => {
    // Context
    ctxMode.value = state.context.mode;
    ctxEnv.value = state.context.environment;
    ctxAssetIds.value = [...state.context.assetIds];
    ctxSceneRole.value = state.context.sceneRole;

    // Spatial
    scrollProgress.value = state.spatial.smoothedProgress;
    velocity.value = state.spatial.velocity;
    direction.value = state.spatial.direction;

    // Topology
    const anchors = state.topology?.anchors || {};
    const hf = anchors['headerFollow'];
    anchorX.value = hf ? hf.x : 0;
    anchorY.value = hf ? hf.y : 0;
    anchorCount.value = Object.keys(anchors).length;

    // Viewport
    vpWidth.value = state.viewport.width;
    vpHeight.value = state.viewport.height;
    degraded.value = state.viewport.degradedMode;
  });

  // Initialize the canonical runtime (same path as the real page)
  const deploymentSync = new SiteDeploymentSync();
  bootstrap = new RuntimeBootstrap();
  await bootstrap.initialize(
    'proof-harness',
    deploymentSync,
    canvasRef.value,
    heroTextRef.value || undefined
  );
});

onUnmounted(() => {
  unsubscribe?.();
  bootstrap?.dispose();
});
</script>

<style scoped>
.proof-harness {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #0a0a0f;
  color: #d4d4d8;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 12px;
  overflow: hidden;
}

/* ─── Telemetry Panel ──────────────────────────── */
.telemetry-panel {
  width: 340px;
  min-width: 340px;
  background: #111118;
  border-right: 1px solid #27272a;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 50;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #8b5cf6;
  border-bottom: 1px solid #27272a;
  padding-bottom: 8px;
  margin: 0;
}

.telemetry-group {
  border: 1px solid #1e1e2a;
  border-radius: 6px;
  padding: 10px;
  background: #0d0d14;
}

.group-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #52525b;
  margin: 0 0 8px 0;
}

.telemetry-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}

.t-key {
  color: #71717a;
  font-size: 11px;
}

.t-val {
  color: #e4e4e7;
  font-weight: 600;
}

.t-mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.t-active {
  color: #22c55e;
}

.t-ok {
  color: #22c55e;
}

.t-warn {
  color: #f59e0b;
}

.mode-live { color: #22c55e; }
.mode-preview { color: #3b82f6; }
.mode-comparison { color: #f59e0b; }

/* Progress bar */
.progress-bar {
  height: 4px;
  background: #1e1e2a;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #06b6d4);
  border-radius: 2px;
  transition: width 0.1s ease;
}

/* Mode switch controls */
.control-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-btn {
  padding: 8px 12px;
  border: 1px solid #27272a;
  border-radius: 6px;
  background: #18181b;
  color: #a1a1aa;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.mode-btn:hover {
  background: #1e1e2a;
  border-color: #8b5cf6;
  color: #e4e4e7;
}

.mode-btn.active {
  background: rgba(139, 92, 246, 0.15);
  border-color: #8b5cf6;
  color: #c4b5fd;
}

.control-hint {
  color: #3f3f46;
  font-size: 10px;
  margin-top: 6px;
  line-height: 1.4;
}

/* Proof chain */
.chain {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.chain-step {
  padding: 3px 8px;
  border-radius: 4px;
  background: #18181b;
  border: 1px solid #27272a;
  font-size: 10px;
  font-weight: 600;
  color: #52525b;
  transition: all 0.3s ease;
}

.chain-step.proven {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.chain-arrow {
  color: #3f3f46;
  font-size: 11px;
}

/* ─── Proof Viewport ──────────────────────────── */
.proof-viewport {
  flex: 1;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
}

.proof-canvas {
  position: fixed;
  top: 0;
  left: 340px;
  width: calc(100vw - 340px);
  height: 100vh;
  pointer-events: none;
  z-index: 10;
}

.scroll-spacer {
  height: 400vh;
}

/* DOM anchor follower label */
.anchor-follower-label {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 30;
  pointer-events: none;
  will-change: transform;
  font-family: 'Outfit', 'Inter', sans-serif;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: white;
  text-shadow: 0 0 20px rgba(139, 92, 246, 0.5), 0 2px 4px rgba(0,0,0,0.5);
}

/* Crosshair at projected anchor position */
.anchor-crosshair {
  position: fixed;
  z-index: 25;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.crosshair-h, .crosshair-v {
  position: absolute;
  background: rgba(239, 68, 68, 0.6);
}

.crosshair-h {
  width: 24px;
  height: 1px;
  top: 0;
  left: -12px;
}

.crosshair-v {
  width: 1px;
  height: 24px;
  top: -12px;
  left: 0;
}

.crosshair-coord {
  position: absolute;
  top: 14px;
  left: 6px;
  font-size: 9px;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(239, 68, 68, 0.8);
  white-space: nowrap;
}
</style>
