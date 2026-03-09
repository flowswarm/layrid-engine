<template>
  <div class="engine-proof">
    <!-- ─── LEFT: Diagnostic Panel ─────────────────────────────── -->
    <aside class="diag-panel">
      <h1 class="diag-title">ENGINE PROOF</h1>
      <p class="diag-subtitle">Layrid Flagship Runtime Harness</p>

      <!-- Runtime Context -->
      <section class="diag-section">
        <h2 class="section-head">Runtime Context</h2>
        <div class="row"><span class="key">mode</span><span class="val" :class="'m-' + mode">{{ mode }}</span></div>
        <div class="row"><span class="key">environment</span><span class="val">{{ env }}</span></div>
        <div class="row"><span class="key">assetIds</span><span class="val mono">{{ assetIds.join(', ') || '(demo)' }}</span></div>
        <div class="row"><span class="key">sceneRole</span><span class="val mono">hero-centerpiece</span></div>
      </section>

      <!-- Spatial -->
      <section class="diag-section">
        <h2 class="section-head">Scroll / Spatial</h2>
        <div class="row"><span class="key">smoothedProgress</span><span class="val mono">{{ progress.toFixed(4) }}</span></div>
        <div class="row"><span class="key">velocity</span><span class="val mono">{{ velocity.toFixed(4) }}</span></div>
        <div class="row"><span class="key">direction</span><span class="val">{{ direction }}</span></div>
        <div class="bar"><div class="bar-fill" :style="{ width: progress * 100 + '%' }"></div></div>
      </section>

      <!-- Anchor Projection -->
      <section class="diag-section">
        <h2 class="section-head">Anchor Projection</h2>
        <div class="row"><span class="key">headerFollow.x</span><span class="val mono" :class="{ active: ax > 0 }">{{ ax.toFixed(1) }}px</span></div>
        <div class="row"><span class="key">headerFollow.y</span><span class="val mono" :class="{ active: ay > 0 }">{{ ay.toFixed(1) }}px</span></div>
        <div class="row"><span class="key">anchors total</span><span class="val mono">{{ anchorCount }}</span></div>
      </section>

      <!-- Viewport -->
      <section class="diag-section">
        <h2 class="section-head">Viewport</h2>
        <div class="row"><span class="key">size</span><span class="val mono">{{ vpW }}×{{ vpH }}</span></div>
        <div class="row"><span class="key">breakpoint</span><span class="val">{{ breakpoint }}</span></div>
        <div class="row">
          <span class="key">degradedMode</span>
          <span class="val" :class="degraded ? 'warn' : 'ok'">{{ degraded }}</span>
        </div>
      </section>

      <!-- Asset Switching -->
      <section class="diag-section">
        <h2 class="section-head">Asset Switching</h2>
        <p class="hint">Same WebGLSceneManager — only context.assetIds changes</p>
        <div class="btn-stack">
          <button :class="{ on: mode === 'live' }" @click="setMode('live', ['live-asset-001'])">Live Asset</button>
          <button :class="{ on: mode === 'preview' }" @click="setMode('preview', ['preview-draft-abc'])">Preview Asset</button>
          <button :class="{ on: mode === 'comparison' }" @click="setMode('comparison', ['comp-a-001', 'comp-b-002'])">Comparison A + B</button>
        </div>
      </section>

      <!-- Degraded Mode Simulation -->
      <section class="diag-section">
        <h2 class="section-head">Degraded Mode</h2>
        <div class="btn-stack">
          <button :class="{ on: degraded }" @click="toggleDegraded">
            {{ degraded ? '✅ Degraded ON — WebGL halted' : '☐ Simulate Mobile / Low-Power' }}
          </button>
        </div>
      </section>

      <!-- Proof Chain -->
      <section class="diag-section">
        <h2 class="section-head">Proof Chain</h2>
        <div class="chain">
          <span class="chip" :class="{ lit: assetIds.length > 0 || mode }">RuntimeAssetResolver</span>
          <span class="arrow">→</span>
          <span class="chip" :class="{ lit: mode }">MotionEngine.context</span>
          <span class="arrow">→</span>
          <span class="chip" :class="{ lit: !degraded }">WebGLSceneManager</span>
          <span class="arrow">→</span>
          <span class="chip" :class="{ lit: ax > 0 }">Anchor Projection</span>
          <span class="arrow">→</span>
          <span class="chip" :class="{ lit: ax > 0 }">MotionEngine.topology</span>
          <span class="arrow">→</span>
          <span class="chip" :class="{ lit: ax > 0 }">DOM Follower</span>
        </div>
      </section>

      <a href="/" class="back-link">← Back to Hero</a>
    </aside>

    <!-- ─── RIGHT: Live Runtime Viewport ──────────────────────── -->
    <main class="runtime-viewport" ref="scrollContainer">
      <canvas ref="canvasRef" class="webgl-canvas"></canvas>

      <!-- DOM anchor follower text label -->
      <div ref="heroTextRef" class="follower-label">
        <span>LAYRID</span>
      </div>

      <!-- Crosshair at projected anchor position -->
      <div class="crosshair" :style="{ left: ax + 'px', top: ay + 'px', opacity: ax > 0 ? 1 : 0 }">
        <div class="ch-h"></div>
        <div class="ch-v"></div>
        <span class="ch-label">{{ ax.toFixed(0) }}, {{ ay.toFixed(0) }}</span>
      </div>

      <!-- Degraded mode overlay -->
      <div v-if="degraded" class="degraded-overlay">
        <div class="degraded-icon">📱</div>
        <p>DEGRADED MODE ACTIVE</p>
        <p class="degraded-sub">WebGL rendering halted — mobile fallback</p>
      </div>

      <!-- Scroll spacer for scroll progress -->
      <div class="scroll-spacer"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { MotionEngine } from '../runtime/MotionEngine';
import { RuntimeBootstrap } from '../runtime/RuntimeBootstrap';
import { SiteDeploymentSync } from '../../../pipeline/deployment/SiteDeploymentSync';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const heroTextRef = ref<HTMLElement | null>(null);

// Telemetry
const mode = ref('initializing');
const env = ref('—');
const assetIds = ref<string[]>([]);
const progress = ref(0);
const velocity = ref(0);
const direction = ref('idle');
const ax = ref(0);
const ay = ref(0);
const anchorCount = ref(0);
const vpW = ref(0);
const vpH = ref(0);
const breakpoint = ref('desktop');
const degraded = ref(false);

let bootstrap: RuntimeBootstrap | null = null;
let unsub: (() => void) | null = null;

function setMode(m: 'live' | 'preview' | 'comparison', ids: string[]) {
    MotionEngine.write({
        context: {
            mode: m,
            environment: m === 'live' ? 'live' : m === 'preview' ? 'preview' : 'comparison',
            assetIds: ids,
            siteId: 'engine-proof',
            sceneRole: 'hero-centerpiece'
        }
    });
}

function toggleDegraded() {
    const next = !degraded.value;
    MotionEngine.write({
        viewport: { degradedMode: next }
    });
}

onMounted(async () => {
    if (!canvasRef.value) return;

    unsub = MotionEngine.subscribe((state) => {
        mode.value = state.context.mode;
        env.value = state.context.environment;
        assetIds.value = [...state.context.assetIds];
        progress.value = state.spatial.smoothedProgress;
        velocity.value = state.spatial.velocity;
        direction.value = state.spatial.direction;
        const anchors = state.topology?.anchors || {};
        const hf = anchors['headerFollow'];
        ax.value = hf ? hf.x : 0;
        ay.value = hf ? hf.y : 0;
        anchorCount.value = Object.keys(anchors).length;
        vpW.value = state.viewport.width;
        vpH.value = state.viewport.height;
        breakpoint.value = state.viewport.breakpoint;
        degraded.value = state.viewport.degradedMode;
    });

    const deploymentSync = new SiteDeploymentSync();
    bootstrap = new RuntimeBootstrap();
    await bootstrap.initialize(
        'engine-proof',
        deploymentSync,
        canvasRef.value,
        heroTextRef.value || undefined
    );
});

onUnmounted(() => {
    unsub?.();
    bootstrap?.dispose();
});
</script>

<style scoped>
.engine-proof {
    display: flex;
    height: 100vh;
    width: 100vw;
    background: #08080c;
    color: #d4d4d8;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 12px;
    overflow: hidden;
}

/* ─── Diagnostic Panel ─────────────────────────── */
.diag-panel {
    width: 360px;
    min-width: 360px;
    background: #0c0c14;
    border-right: 1px solid #1a1a28;
    overflow-y: auto;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 50;
    scrollbar-width: thin;
    scrollbar-color: #27272a transparent;
}

.diag-title {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.15em;
    color: #8b5cf6;
    margin: 0;
}

.diag-subtitle {
    font-size: 10px;
    color: #3f3f46;
    margin: -4px 0 4px 0;
    letter-spacing: 0.05em;
}

.diag-section {
    border: 1px solid #18182a;
    border-radius: 8px;
    padding: 10px 12px;
    background: #0a0a12;
}

.section-head {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #52525b;
    margin: 0 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #18182a;
}

.row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 0;
    line-height: 1.6;
}

.key { color: #71717a; font-size: 11px; }
.val { color: #e4e4e7; font-weight: 600; font-size: 11px; }
.mono { font-family: inherit; }
.active { color: #22c55e; }
.ok { color: #22c55e; }
.warn { color: #ef4444; }
.m-live { color: #22c55e; }
.m-preview { color: #3b82f6; }
.m-comparison { color: #f59e0b; }

.bar { height: 3px; background: #1a1a28; border-radius: 2px; margin-top: 6px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6, #06b6d4); border-radius: 2px; transition: width 0.08s linear; }

.hint {
    font-size: 10px;
    color: #3f3f46;
    margin: 0 0 8px 0;
    line-height: 1.4;
}

.btn-stack { display: flex; flex-direction: column; gap: 5px; }

.btn-stack button {
    padding: 8px 12px;
    border: 1px solid #27272a;
    border-radius: 6px;
    background: #14141e;
    color: #a1a1aa;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
}

.btn-stack button:hover {
    background: #1e1e2e;
    border-color: #8b5cf6;
    color: #e4e4e7;
}

.btn-stack button.on {
    background: rgba(139, 92, 246, 0.12);
    border-color: #8b5cf6;
    color: #c4b5fd;
}

/* Proof chain */
.chain { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }

.chip {
    padding: 3px 6px;
    border-radius: 4px;
    background: #14141e;
    border: 1px solid #1a1a28;
    font-size: 9px;
    font-weight: 600;
    color: #3f3f46;
    transition: all 0.3s ease;
}

.chip.lit {
    background: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
}

.arrow { color: #27272a; font-size: 10px; }

.back-link {
    display: block;
    margin-top: 8px;
    color: #52525b;
    font-size: 11px;
    text-decoration: none;
    transition: color 0.15s;
}
.back-link:hover { color: #8b5cf6; }

/* ─── Runtime Viewport ─────────────────────────── */
.runtime-viewport {
    flex: 1;
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
}

.webgl-canvas {
    position: fixed;
    top: 0;
    left: 360px;
    width: calc(100vw - 360px);
    height: 100vh;
    pointer-events: none;
    z-index: 10;
}

.scroll-spacer { height: 400vh; }

.follower-label {
    position: fixed;
    top: 0; left: 0;
    z-index: 30;
    pointer-events: none;
    will-change: transform;
    font-family: 'Outfit', 'Inter', sans-serif;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: 0.15em;
    color: white;
    text-shadow: 0 0 24px rgba(139, 92, 246, 0.6), 0 2px 4px rgba(0, 0, 0, 0.5);
}

/* Crosshair */
.crosshair {
    position: fixed;
    z-index: 25;
    pointer-events: none;
    transition: opacity 0.2s;
}

.ch-h, .ch-v { position: absolute; background: rgba(239, 68, 68, 0.6); }
.ch-h { width: 28px; height: 1px; top: 0; left: -14px; }
.ch-v { width: 1px; height: 28px; top: -14px; left: 0; }

.ch-label {
    position: absolute;
    top: 16px; left: 6px;
    font-size: 9px;
    color: rgba(239, 68, 68, 0.7);
    white-space: nowrap;
}

/* Degraded overlay */
.degraded-overlay {
    position: fixed;
    top: 0; left: 360px;
    width: calc(100vw - 360px);
    height: 100vh;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(8, 8, 12, 0.92);
    text-align: center;
}

.degraded-icon { font-size: 4rem; margin-bottom: 1rem; }

.degraded-overlay p {
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #ef4444;
}

.degraded-sub {
    font-size: 0.85rem !important;
    font-weight: 400 !important;
    color: #71717a !important;
    margin-top: 0.5rem;
}
</style>
