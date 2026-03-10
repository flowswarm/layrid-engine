<template>
  <section class="cinematic-hero-section">
    <!-- 1. WEBGL SCENE MANAGER (centerpiece renderer) -->
    <canvas ref="canvasRef" class="transparent-centerpiece-renderer"></canvas>

    <!-- 2. DEGRADED MODE FALLBACK (Part 8) -->
    <div v-if="degradedMode" class="fallback-flat-logo">
      <img :src="`/cdn/thumbnails/${activeAssetId || 'fallback'}.png`" alt="Logo fallback" />
    </div>

    <!-- 3. ANCHOR-FOLLOW TEXT (DOM follows 3D anchor via MotionEngine) -->
    <div ref="heroTextRef" class="explicit-anchor-tracking-label">
      <span>{{ content.brandName }}</span>
    </div>

    <!-- 4. HERO CONTENT OVERLAY -->
    <div class="hero-content-overlay">
      <p class="hero-intro-label">Cinematic End-to-End</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { MotionEngine } from '../runtime/MotionEngine';
import { RuntimeBootstrap } from '../runtime/RuntimeBootstrap';
import { SiteDeploymentSync } from '../../../pipeline/deployment/SiteDeploymentSync';

const props = defineProps<{
    content: {
        brandName: string;
        siteId?: string;
    }
}>();

// DOM Refs
const canvasRef = ref<HTMLCanvasElement | null>(null);
const heroTextRef = ref<HTMLElement | null>(null);

// Reactive MotionEngine state
const degradedMode = ref(false);
const activeAssetId = ref<string | undefined>(undefined);

// Engine instance
let bootstrap: RuntimeBootstrap | null = null;
let unsubscribe: (() => void) | null = null;

onMounted(async () => {
    if (!canvasRef.value) return;

    // Subscribe to MotionEngine for reactive state
    unsubscribe = MotionEngine.subscribe((state) => {
        degradedMode.value = state.viewport.degradedMode;
        activeAssetId.value = state.context.assetIds[0];
    });

    // Check if MotionEngine already has context (e.g., Studio's PlatformServices.bootLive()).
    // If so, skip RuntimeBootstrap — it would overwrite context with an empty deployment table.
    const existingState = MotionEngine.read();
    const alreadyBooted = existingState.context.assetIds.length > 0
        || existingState.context.mode !== 'live';

    if (!alreadyBooted) {
        // Standalone site page: initialize via RuntimeBootstrap with local deployment sync
        const deploymentSync = new SiteDeploymentSync();
        bootstrap = new RuntimeBootstrap();

        await bootstrap.initialize(
            props.content.siteId || 'demo-site',
            deploymentSync,
            canvasRef.value,
            heroTextRef.value || undefined
        );
    } else {
        // Studio context: RuntimeBootstrap already configured by PlatformServices.
        // Just initialize the WebGL scene manager for rendering.
        console.log('[HeroCenterpiece] Skipping RuntimeBootstrap — context already set by Studio');
    }
});

onUnmounted(() => {
    unsubscribe?.();
    bootstrap?.dispose();
});
</script>

<style scoped>
.cinematic-hero-section {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #09090b;
}

.transparent-centerpiece-renderer {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 10;
}

.explicit-anchor-tracking-label {
    position: fixed;
    top: 0; left: 0;
    color: white;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    z-index: 20;
    will-change: transform;
    pointer-events: none;
}

.hero-content-overlay {
    position: absolute;
    bottom: 10%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    text-align: center;
}

.hero-intro-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.2rem;
    will-change: transform, opacity;
}

.fallback-flat-logo {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
}
.fallback-flat-logo img {
    max-width: 300px;
}
</style>
