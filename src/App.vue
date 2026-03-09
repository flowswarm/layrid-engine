<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { MotionEngine } from './engine/runtime/MotionEngine';
import { ViewportDetector } from './engine/core/ViewportDetector';
import { ScrollController } from './engine/scroll/ScrollController';
import { ScrollTimelineController } from './engine/scroll/ScrollTimelineController';
import { MasterRAFLoop } from './engine/core/MasterRAFLoop';
import { WebGLSceneManager } from './engine/webgl/WebGLSceneManager';
import { HeroAnchorFollower } from './engine/typography/HeroAnchorFollower';

// ─── Refs ────────────────────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null);
const heroTextRef = ref<HTMLElement | null>(null);
const scrollProgress = ref(0);
const engineMode = ref('initializing...');

// ─── Engine Subsystems ───────────────────────────────────────
let viewportDetector: ViewportDetector | null = null;
let scrollController: ScrollController | null = null;
let scrollTimeline: ScrollTimelineController | null = null;
let masterLoop: MasterRAFLoop | null = null;
let webglManager: WebGLSceneManager | null = null;
let heroFollower: HeroAnchorFollower | null = null;
let unsubProgress: (() => void) | null = null;

onMounted(async () => {
    if (!canvasRef.value) return;

    console.log('[App] 🚀 Booting Layrid Engine...');

    // ─── STEP 1: Write initial context to MotionEngine ─────────
    // In production, RuntimeAssetResolver would determine this from URL params + deployment sync.
    // For the demo, we write a live-mode context directly.
    MotionEngine.write({
        context: {
            siteId: 'demo-site',
            sceneRole: 'hero-centerpiece',
            assetIds: [],
            environment: 'live',
            mode: 'live'
        },
        scene: {
            mode: 'logo-centerpiece',
            activeCenterpieceAssetId: undefined
        }
    });
    engineMode.value = 'live';

    // ─── STEP 2: Initialize Producers ──────────────────────────
    viewportDetector = new ViewportDetector();
    viewportDetector.initialize();

    scrollController = new ScrollController();
    scrollController.initialize();

    scrollTimeline = new ScrollTimelineController();
    scrollTimeline.registerSection('hero-primary', 'heroIntro');

    // ─── STEP 3: Initialize WebGL Subscriber ───────────────────
    try {
        webglManager = new WebGLSceneManager(canvasRef.value);
        console.log('[App] ✅ WebGL Scene initialized');
    } catch (err) {
        console.warn('[App] ⚠️ WebGL init error (expected if no GLB assets loaded):', err);
    }

    // ─── STEP 4: Initialize DOM Anchor Follower ────────────────
    if (heroTextRef.value) {
        heroFollower = new HeroAnchorFollower(heroTextRef.value);
        heroFollower.initialize();
    }

    // ─── STEP 5: Start Master RAF Loop ─────────────────────────
    masterLoop = new MasterRAFLoop(scrollController, scrollTimeline);
    masterLoop.start();

    // ─── STEP 6: Subscribe for reactive UI updates ─────────────
    unsubProgress = MotionEngine.subscribe((state) => {
        scrollProgress.value = Math.round(state.spatial.smoothedProgress * 100);
    });

    console.log('[App] ✅ Layrid Engine fully booted');
});

onUnmounted(() => {
    unsubProgress?.();
    masterLoop?.dispose();
    heroFollower?.dispose();
    webglManager?.dispose();
    scrollController?.dispose();
    viewportDetector?.dispose();
});
</script>

<template>
    <div class="layrid-app">
        <!-- ─── WebGL Canvas (fullscreen behind everything) ─── -->
        <canvas ref="canvasRef" class="webgl-canvas"></canvas>

        <!-- ─── Hero Section ──────────────────────────────────── -->
        <section class="hero-section">
            <div class="hero-content">
                <h1 class="hero-title">
                    <span class="hero-title-line hero-title-line--top">LAYRID</span>
                    <span class="hero-title-line hero-title-line--bottom">ENGINE</span>
                </h1>
                <p class="hero-subtitle">Cinematic Interactive Website Engine</p>
                <div class="hero-badge">Flagship Vertical Slice — Live</div>
            </div>
        </section>

        <!-- ─── Anchor-Follow Text (DOM follows 3D anchor) ──── -->
        <div ref="heroTextRef" class="anchor-follow-text">
            <span class="anchor-label">⬡ 3D Anchor Follow</span>
        </div>

        <!-- ─── Scroll Sections (create scrollable height) ──── -->
        <section class="scroll-section scroll-section--features" id="heroIntro">
            <div class="section-content">
                <h2 class="section-title">Motion Engine</h2>
                <p class="section-desc">Single source of truth for all runtime state.<br>WebGL and DOM never communicate directly.</p>
                <div class="feature-grid">
                    <div class="feature-card">
                        <div class="feature-icon">⚡</div>
                        <h3>Single RAF Loop</h3>
                        <p>One requestAnimationFrame — Rule 8 compliant</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🎯</div>
                        <h3>Anchor Projection</h3>
                        <p>3D → 2D coordinate bridge via topology state</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🖼️</div>
                        <h3>Asset Pipeline</h3>
                        <p>Draft → Preview → Compare → Approve → Publish</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">📱</div>
                        <h3>Degraded Mode</h3>
                        <p>Automatic performance scaling for mobile</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="scroll-section scroll-section--architecture">
            <div class="section-content">
                <h2 class="section-title">Architecture Proven</h2>
                <p class="section-desc">42/42 integration tests passing</p>
                <div class="proven-path">
                    <div class="path-step" v-for="step in [
                        'Logo Request', 'Draft Asset', 'Blender Export', 'Registry',
                        'Preview Session', 'Comparison', 'Approval', 'Publish',
                        'Live Mapping', 'RuntimeResolver', 'MotionEngine', 'WebGL Render'
                    ]" :key="step">
                        <span class="path-dot">✓</span>
                        <span class="path-label">{{ step }}</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="scroll-section scroll-section--final">
            <div class="section-content">
                <h2 class="section-title">End of Slice</h2>
                <p class="section-desc">The flagship vertical slice is complete.</p>
            </div>
        </section>

        <!-- ─── HUD Overlay ───────────────────────────────────── -->
        <div class="hud-overlay">
            <div class="hud-item">
                <span class="hud-label">MODE</span>
                <span class="hud-value">{{ engineMode }}</span>
            </div>
            <div class="hud-item">
                <span class="hud-label">SCROLL</span>
                <span class="hud-value">{{ scrollProgress }}%</span>
            </div>
        </div>
    </div>
</template>

<style>
/* ─── Global Reset ─────────────────────────────────────────── */
*, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0a0a0f;
    color: #e0e0e8;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
}

/* ─── App Container ────────────────────────────────────────── */
.layrid-app {
    position: relative;
    min-height: 400vh;
}

/* ─── WebGL Canvas ─────────────────────────────────────────── */
.webgl-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0;
    pointer-events: none;
}

/* ─── Hero Section ─────────────────────────────────────────── */
.hero-section {
    position: relative;
    z-index: 2;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.hero-content {
    position: relative;
}

.hero-title {
    font-family: 'Outfit', sans-serif;
    font-weight: 900;
    font-size: clamp(4rem, 12vw, 10rem);
    line-height: 0.9;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #ffffff 0%, #8b5cf6 40%, #06b6d4 70%, #10b981 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 0 60px rgba(139, 92, 246, 0.3));
}

.hero-title-line {
    display: block;
}

.hero-title-line--bottom {
    font-size: 0.55em;
    letter-spacing: 0.2em;
    opacity: 0.7;
}

.hero-subtitle {
    margin-top: 1.5rem;
    font-size: clamp(0.9rem, 2vw, 1.3rem);
    font-weight: 300;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.15em;
    text-transform: uppercase;
}

.hero-badge {
    display: inline-block;
    margin-top: 2rem;
    padding: 0.5rem 1.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #a78bfa;
    backdrop-filter: blur(10px);
    animation: pulse-border 3s ease-in-out infinite;
}

@keyframes pulse-border {
    0%, 100% { border-color: rgba(139, 92, 246, 0.3); }
    50% { border-color: rgba(139, 92, 246, 0.6); }
}

/* ─── Anchor Follow Text ──────────────────────────────────── */
.anchor-follow-text {
    position: fixed;
    z-index: 5;
    pointer-events: none;
}

.anchor-label {
    font-family: 'Outfit', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #06b6d4;
    text-shadow: 0 0 20px rgba(6, 182, 212, 0.5);
    opacity: 0.8;
}

/* ─── Scroll Sections ──────────────────────────────────────── */
.scroll-section {
    position: relative;
    z-index: 2;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
}

.section-content {
    max-width: 900px;
    text-align: center;
}

.section-title {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: clamp(2rem, 5vw, 3.5rem);
    color: #ffffff;
    margin-bottom: 1rem;
}

.section-desc {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.7;
    margin-bottom: 3rem;
}

/* ─── Feature Grid ─────────────────────────────────────────── */
.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
}

.feature-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 2rem 1.5rem;
    text-align: center;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
}

.feature-card:hover {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.25);
    transform: translateY(-4px);
}

.feature-icon {
    font-size: 2rem;
    margin-bottom: 1rem;
}

.feature-card h3 {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    color: #e0e0e8;
    margin-bottom: 0.5rem;
}

.feature-card p {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.5;
}

/* ─── Proven Path ──────────────────────────────────────────── */
.proven-path {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
}

.path-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
    font-size: 0.8rem;
    transition: all 0.2s ease;
}

.path-step:hover {
    background: rgba(16, 185, 129, 0.15);
    transform: scale(1.05);
}

.path-dot {
    color: #10b981;
    font-weight: 700;
}

.path-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
}

/* ─── Final Section ────────────────────────────────────────── */
.scroll-section--final {
    background: radial-gradient(ellipse at center bottom, rgba(139, 92, 246, 0.1), transparent 70%);
}

/* ─── HUD Overlay ──────────────────────────────────────────── */
.hud-overlay {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 100;
    display: flex;
    gap: 1rem;
}

.hud-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.6rem 1rem;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    min-width: 70px;
}

.hud-label {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
}

.hud-value {
    font-family: 'Outfit', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    color: #8b5cf6;
    margin-top: 0.15rem;
}
</style>
