<template>
  <div class="proof-page">
    <!-- Fixed debug overlay -->
    <aside class="debug-overlay">
      <div class="debug-header">
        <h1 class="debug-title">Layrid Engine Proof</h1>
        <span class="mode-badge" :class="degradedMode ? 'badge-degraded' : 'badge-full'">
          {{ degradedMode ? 'DEGRADED' : 'FULL' }}
        </span>
      </div>

      <div class="mode-buttons">
        <button @click="setLive" :class="{ active: runtimeMode === 'live' }">LIVE</button>
        <button @click="setPreview" :class="{ active: runtimeMode === 'preview' }">PREVIEW</button>
        <button @click="setComparison" :class="{ active: runtimeMode === 'comparison' && activeCompare === 'A' }">COMPARE A</button>
        <button @click="setComparisonB" :class="{ active: runtimeMode === 'comparison' && activeCompare === 'B' }">COMPARE B</button>
      </div>

      <div class="debug-values">
        <div><span class="label">mode:</span> <span :class="'val-' + runtimeMode">{{ runtimeMode }}</span></div>
        <div><span class="label">environment:</span> {{ environment }}</div>
        <div><span class="label">scene mode:</span> {{ sceneMode }}</div>
        <div><span class="label">assetIds:</span> {{ assetIdsLabel }}</div>
        <div><span class="label">active asset:</span> {{ activeCenterpieceAssetId || '—' }}</div>
        <div class="divider"></div>
        <div><span class="label">progress.raw:</span> {{ rawProgress.toFixed(3) }}</div>
        <div><span class="label">progress.smooth:</span> {{ smoothedProgress.toFixed(3) }}</div>
        <div><span class="label">velocity:</span> {{ velocity.toFixed(4) }}</div>
        <div><span class="label">direction:</span> {{ direction }}</div>
        <div><span class="label">scrollY:</span> {{ Math.round(scrollY) }}</div>
        <div class="divider"></div>
        <div><span class="label">breakpoint:</span> {{ breakpoint }}</div>
        <div><span class="label">degradedMode:</span> <span :class="degradedMode ? 'val-warn' : 'val-ok'">{{ degradedMode }}</span></div>
        <div class="divider"></div>
        <div><span class="label">anchor.headerFollow.x:</span> <span :class="anchorX > 0 ? 'val-ok' : 'val-warn'">{{ anchorX }}</span></div>
        <div><span class="label">anchor.headerFollow.y:</span> <span :class="anchorY > 0 ? 'val-ok' : 'val-warn'">{{ anchorY }}</span></div>
      </div>

      <!-- Pass criteria -->
      <div class="pass-criteria">
        <div class="criteria-title">Pass Criteria</div>
        <div class="check" :class="{ pass: runtimeMode !== 'initializing' }">A. Context resolves</div>
        <div class="check" :class="{ pass: anchorX > 0 || anchorY > 0 }">B. Asset loaded</div>
        <div class="check" :class="{ pass: hasScrolled }">C. Scroll updates engine</div>
        <div class="check" :class="{ pass: anchorMoved }">D. Anchor projection works</div>
        <div class="check" :class="{ pass: anchorX > 0 }">E. DOM follower tracking</div>
        <div class="check" :class="{ pass: modesSwitched >= 2 }">F. Multiple modes tested</div>
      </div>

      <div class="pass-note">
        Pass if centerpiece moves on scroll, anchor values change, and label
        follows the object in all 3 modes.
      </div>
    </aside>

    <!-- DOM follower (reads only from MotionEngine topology, never queries Three.js) -->
    <div class="dom-follower" :style="followerStyle">
      <div class="follower-pill">LAYRID</div>
    </div>

    <!-- Crosshair at anchor position -->
    <div class="crosshair" :style="crosshairStyle">
      <div class="ch-h"></div>
      <div class="ch-v"></div>
      <span class="ch-coord">{{ anchorX }}, {{ anchorY }}</span>
    </div>

    <!-- Hero proof area -->
    <section ref="heroRef" id="hero-primary" class="hero-section">
      <div class="hero-sticky">
        <HeroCenterpiece :content="{ brandName: 'LAYRID', siteId: 'proof-site' }" />
      </div>
    </section>

    <!-- Spacer section to enable scroll range -->
    <section class="scroll-spacer">
      <div class="spacer-text">
        Scroll back and forth and watch the object + anchor + label.
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import HeroCenterpiece from '../engine/components/HeroCenterpiece.vue';
import { MotionEngine } from '../engine/runtime/MotionEngine';

const heroRef = ref<HTMLElement | null>(null);

// Raw state from subscriber
const runtimeMode = ref('initializing');
const environment = ref('—');
const sceneMode = ref('—');
const activeCenterpieceAssetId = ref('');
const rawProgress = ref(0);
const smoothedProgress = ref(0);
const velocity = ref(0);
const direction = ref<string>('down');
const scrollY = ref(0);
const breakpoint = ref('desktop');
const degradedMode = ref(false);
const assetIds = ref<string[]>([]);
const anchorX = ref(0);
const anchorY = ref(0);

// Proof tracking
const hasScrolled = ref(false);
const anchorMoved = ref(false);
const modesSwitched = ref(0);
const activeCompare = ref('A');
const previousAnchorX = ref(0);
const testedModes = new Set<string>();

let unsub: (() => void) | null = null;

onMounted(() => {
    unsub = MotionEngine.subscribe((state) => {
        runtimeMode.value = state.context.mode;
        environment.value = state.context.environment;
        sceneMode.value = state.scene.mode;
        activeCenterpieceAssetId.value = state.scene.activeCenterpieceAssetId || '';
        rawProgress.value = state.spatial.rawProgress;
        smoothedProgress.value = state.spatial.smoothedProgress;
        velocity.value = state.spatial.velocity;
        direction.value = state.spatial.direction;
        scrollY.value = state.spatial.scrollY;
        breakpoint.value = state.viewport.breakpoint;
        degradedMode.value = state.viewport.degradedMode;
        assetIds.value = [...state.context.assetIds];

        const anchor = state.topology?.anchors?.headerFollow;
        anchorX.value = anchor ? Math.round(anchor.x) : 0;
        anchorY.value = anchor ? Math.round(anchor.y) : 0;

        // Track proof state
        if (state.spatial.smoothedProgress > 0.01) hasScrolled.value = true;
        if (anchorX.value !== previousAnchorX.value && anchorX.value > 0) {
            anchorMoved.value = true;
        }
        previousAnchorX.value = anchorX.value;

        // Track modes tested
        testedModes.add(state.context.mode);
        modesSwitched.value = testedModes.size;
    });
});

onUnmounted(() => {
    unsub?.();
});

const assetIdsLabel = computed(() => assetIds.value.length ? assetIds.value.join(', ') : '—');

const followerStyle = computed(() => {
    if (degradedMode.value) {
        return { transform: 'translate3d(24px, 24px, 0)', opacity: '0.8' };
    }
    return {
        transform: `translate3d(${anchorX.value}px, ${anchorY.value}px, 0)`,
        opacity: anchorX.value > 0 ? '1' : '0'
    };
});

const crosshairStyle = computed(() => ({
    left: anchorX.value + 'px',
    top: anchorY.value + 'px',
    opacity: anchorX.value > 0 ? '1' : '0'
}));

// ─── Mode switching (uses only MotionEngine.write — no separate renderers) ───
function setLive() {
    MotionEngine.write({
        context: {
            mode: 'live',
            environment: 'live',
            assetIds: ['asset-live-hero-001'],
            siteId: 'proof-site',
            sceneRole: 'hero-centerpiece'
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: 'asset-live-hero-001'
        }
    });
    activeCompare.value = 'A';
}

function setPreview() {
    MotionEngine.write({
        context: {
            mode: 'preview',
            environment: 'preview',
            assetIds: ['asset-preview-hero-001'],
            siteId: 'proof-site',
            sceneRole: 'hero-centerpiece'
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: 'asset-preview-hero-001'
        }
    });
    activeCompare.value = 'A';
}

function setComparison() {
    MotionEngine.write({
        context: {
            mode: 'comparison',
            environment: 'comparison',
            assetIds: ['asset-compare-a-001', 'asset-compare-b-001'],
            siteId: 'proof-site',
            sceneRole: 'hero-centerpiece'
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: 'asset-compare-a-001'
        }
    });
    activeCompare.value = 'A';
}

function setComparisonB() {
    MotionEngine.write({
        context: {
            mode: 'comparison',
            environment: 'comparison',
            assetIds: ['asset-compare-a-001', 'asset-compare-b-001'],
            siteId: 'proof-site',
            sceneRole: 'hero-centerpiece'
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: 'asset-compare-b-001'
        }
    });
    activeCompare.value = 'B';
}
</script>

<style scoped>
.proof-page {
    min-height: 300vh;
    background: #000;
    color: #fff;
}

/* ─── Debug Overlay ─────────────────────────────── */
.debug-overlay {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 9999;
    width: 360px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.8);
    padding: 16px;
    font-size: 12px;
    backdrop-filter: blur(12px);
    font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
}

.debug-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.debug-title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.05em;
    margin: 0;
}

.mode-badge {
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
}

.badge-full { background: rgba(34, 197, 94, 0.2); color: #86efac; }
.badge-degraded { background: rgba(234, 179, 8, 0.2); color: #fde047; }

.mode-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 14px;
}

.mode-buttons button {
    border: 1px solid rgba(255, 255, 255, 0.15);
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

.mode-buttons button:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.mode-buttons button.active { background: rgba(139, 92, 246, 0.2); border-color: #8b5cf6; color: #c4b5fd; }

.debug-values {
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.85);
}

.label { color: rgba(255, 255, 255, 0.5); }
.divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 4px 0; }

.val-live { color: #86efac; }
.val-preview { color: #93c5fd; }
.val-comparison { color: #fde047; }
.val-ok { color: #86efac; }
.val-warn { color: #fca5a5; }

/* ─── Pass Criteria ─────────────────────────────── */
.pass-criteria {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.criteria-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 6px;
}

.check {
    padding: 2px 0;
    color: rgba(255, 255, 255, 0.35);
    font-size: 11px;
}

.check::before { content: '○ '; }
.check.pass { color: #86efac; }
.check.pass::before { content: '● '; }

.pass-note {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    line-height: 1.5;
}

/* ─── DOM Follower ──────────────────────────────── */
.dom-follower {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 9998;
    pointer-events: none;
    will-change: transform;
    transition: opacity 0.3s;
}

.follower-pill {
    border-radius: 20px;
    border: 1px solid rgba(34, 211, 238, 0.3);
    background: rgba(34, 211, 238, 0.1);
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: #a5f3fc;
    white-space: nowrap;
}

/* ─── Crosshair ─────────────────────────────────── */
.crosshair {
    position: fixed;
    z-index: 9997;
    pointer-events: none;
    transition: opacity 0.2s;
}

.ch-h, .ch-v { position: absolute; background: rgba(239, 68, 68, 0.5); }
.ch-h { width: 24px; height: 1px; top: 0; left: -12px; }
.ch-v { width: 1px; height: 24px; top: -12px; left: 0; }

.ch-coord {
    position: absolute;
    top: 14px; left: 6px;
    font-size: 9px;
    font-family: monospace;
    color: rgba(239, 68, 68, 0.6);
    white-space: nowrap;
}

/* ─── Hero Section ──────────────────────────────── */
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
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ─── Scroll Spacer ─────────────────────────────── */
.scroll-spacer {
    position: relative;
    height: 100vh;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.spacer-text {
    max-width: 600px;
    padding: 0 32px;
    text-align: center;
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
}
</style>
