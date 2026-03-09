<template>
  <section class="cinematic-hero-section">
    <!-- 1. LAYERED MEDIA SCENE (Part 6 Integration) -->
    <!-- HW Accelerated Depth Stacking Parallax Environment -->
    <div class="parallax-environment" ref="ambientBackplateRef">
      <img src="/cdn/backplates/studio-dark.jpg" alt="Ambient Backplate" />
    </div>

    <!-- 2. WEBGL SCENE MANAGER (Part 3 & 4 Integration) -->
    <!-- Implicitly manages the loaded GLB mesh and publishes spatial bounds back to the bus -->
    <canvas ref="canvasRef" class="transparent-centerpiece-renderer"></canvas>

    <!-- 3. VIEWPORT DEGRADATION (Part 8 Integration) -->
    <!-- Instantly falls back to flattened static structures if WebGL processing halts natively -->
    <div v-if="motionState.viewport.degradedMode" class="fallback-flat-logo">
      <img :src="`/cdn/thumbnails/${motionState.context.assetIds[0] || 'fallback'}.png`" />
    </div>

    <!-- 4. TYPOGRAPHY MOTION LIBRARY (Part 5 Integration) -->
    <!-- Native DOM nodes explicitly tracking 3D bounding sockets produced by the GPU loop -->
    <h1 class="explicit-anchor-tracking-label" :style="anchorFollowTransform">
      {{ content.brandName }}
    </h1>

    <p class="hero-intro-preset-label" ref="subtitleRef">
      Cinematic End-to-End
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { MotionEngine } from '../runtime/MotionEngine';
import { WebGLSceneManager } from '../webgl/WebGLSceneManager';
import { LayeredMediaScene } from '../media/LayeredMediaScene';
import { TypographyMotion } from '../typography/TypographyMotion';

// Standard Vue setup
const props = defineProps<{
    content: {
        brandName: string;
    }
}>();

// Structural Element DOM Refs
const canvasRef = ref<HTMLCanvasElement | null>(null);
const ambientBackplateRef = ref<HTMLElement | null>(null);
const subtitleRef = ref<HTMLElement | null>(null);

// Engine State Subscriptions
const motionState = ref(MotionEngine.read());
let unsubscribe: (() => void) | null = null;

// Producer / Subscriber Integration Instances
let webglLayer: WebGLSceneManager | null = null;
let mediaLayer: LayeredMediaScene | null = null;
let typographyLayer: TypographyMotion | null = null;

// Reactively executes 2D topological bounding coordinates into localized CSS 
const anchorFollowTransform = computed(() => {
    // Handle fallback coordinates elegantly before WebGL finishes initial memory load
    const anchor = motionState.value.topology.anchors.headerFollow || { 
        x: window.innerWidth / 2, 
        y: window.innerHeight / 2 
    };
    return {
        transform: `translate3d(${anchor.x}px, ${anchor.y}px, 0)`
    };
});

onMounted(() => {
    // 1. Hook directly into the Primary Single Source of Truth
    unsubscribe = MotionEngine.subscribe((stateUpdate) => {
        motionState.value = stateUpdate;
    });

    // 2. Initialize Hardware Rendering Layer (Automatically probes Hash URLs based on Routing)
    if (canvasRef.value) {
        webglLayer = new WebGLSceneManager(canvasRef.value);
    }

    // 3. Register Explicit DOM Layered Media depth offsets
    if (ambientBackplateRef.value) {
        mediaLayer = new LayeredMediaScene();
        mediaLayer.initialize();
        mediaLayer.registerPlane(ambientBackplateRef.value, 0.5); // Fast parallax interaction
    }

    // 4. Bind Typography Motion Algorithms to structural elements
    if (subtitleRef.value) {
        typographyLayer = new TypographyMotion();
        typographyLayer.initialize();
        // Applies a shrinking, fading execution loop tied exclusively to Scroll Scalars
        typographyLayer.register(subtitleRef.value, 'heroIntro'); 
    }

    // 5. Force Specific Scene Mode enabling downstream dependencies correctly 
    MotionEngine.write({
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: motionState.value.context.assetIds[0] ?? null
        }
    });
});

onUnmounted(() => {
    // Explicit Garbage Collection protecting memory spikes across rapid Route overlay swaps
    if (unsubscribe) unsubscribe();
    if (webglLayer) webglLayer.dispose();
    if (mediaLayer) mediaLayer.dispose();
    if (typographyLayer) typographyLayer.dispose();
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
    pointer-events: none; /* Mouse operations ignore 3D context resolving DOM clicks */
    z-index: 10;
}

.parallax-environment {
    position: absolute;
    /* Negative oversizing enables structural bounds for severe parallax math shifting */
    top: -15%; left: -15%;
    width: 130%; height: 130%;
    z-index: 1;
}

.parallax-environment img {
    width: 100%; height: 100%;
    object-fit: cover;
}

.explicit-anchor-tracking-label {
    position: absolute;
    top: 0; left: 0;
    /* Natively maps the top-left translation coordinates back onto exact string centers */
    margin-left: -50%; 
    margin-top: -50%;
    color: white;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    z-index: 20;
    will-change: transform;
}

.hero-intro-preset-label {
    position: absolute;
    bottom: 10%;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.2rem;
    z-index: 30;
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
