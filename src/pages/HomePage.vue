<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { MotionEngine } from '../engine/runtime/MotionEngine';
import HeroCenterpiece from '../engine/components/HeroCenterpiece.vue';

const scrollProgress = ref(0);
const engineMode = ref('initializing...');
let unsub: (() => void) | null = null;

onMounted(() => {
    unsub = MotionEngine.subscribe((state) => {
        scrollProgress.value = Math.round(state.spatial.smoothedProgress * 100);
        engineMode.value = state.context.mode;
    });
});

onUnmounted(() => unsub?.());
</script>

<template>
    <div class="layrid-app">
        <HeroCenterpiece :content="{ brandName: 'LAYRID', siteId: 'demo-site' }" />

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
            </div>
        </section>

        <section class="scroll-section scroll-section--final">
            <div class="section-content">
                <h2 class="section-title">End of Slice</h2>
                <p class="section-desc">The flagship vertical slice is complete.</p>
            </div>
        </section>

        <div class="hud-overlay">
            <div class="hud-item">
                <span class="hud-label">MODE</span>
                <span class="hud-value">{{ engineMode }}</span>
            </div>
            <div class="hud-item">
                <span class="hud-label">SCROLL</span>
                <span class="hud-value">{{ scrollProgress }}%</span>
            </div>
            <router-link to="/engine-proof" class="hud-item hud-link">
                <span class="hud-label">PROOF</span>
                <span class="hud-value">→</span>
            </router-link>
        </div>
    </div>
</template>

<style scoped>
.layrid-app { position: relative; min-height: 400vh; }

.scroll-section {
    position: relative; z-index: 2; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 4rem 2rem;
}

.section-content { max-width: 900px; text-align: center; }

.section-title {
    font-family: 'Outfit', sans-serif; font-weight: 700;
    font-size: clamp(2rem, 5vw, 3.5rem); color: #fff; margin-bottom: 1rem;
}

.section-desc {
    font-size: 1.1rem; color: rgba(255,255,255,0.5); line-height: 1.7; margin-bottom: 3rem;
}

.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; }

.feature-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px; padding: 2rem 1.5rem; text-align: center;
    transition: all 0.3s ease; backdrop-filter: blur(10px);
}

.feature-card:hover { background: rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.25); transform: translateY(-4px); }
.feature-icon { font-size: 2rem; margin-bottom: 1rem; }
.feature-card h3 { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1rem; color: #e0e0e8; margin-bottom: 0.5rem; }
.feature-card p { font-size: 0.85rem; color: rgba(255,255,255,0.4); line-height: 1.5; }

.scroll-section--final { background: radial-gradient(ellipse at center bottom, rgba(139,92,246,0.1), transparent 70%); }

.hud-overlay { position: fixed; top: 1.5rem; right: 1.5rem; z-index: 100; display: flex; gap: 1rem; }

.hud-item {
    display: flex; flex-direction: column; align-items: center;
    padding: 0.6rem 1rem; border-radius: 10px;
    background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(12px); min-width: 70px;
}

.hud-link { text-decoration: none; cursor: pointer; transition: border-color 0.2s; }
.hud-link:hover { border-color: #8b5cf6; }

.hud-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); text-transform: uppercase; }
.hud-value { font-family: 'Outfit', monospace; font-size: 0.9rem; font-weight: 700; color: #8b5cf6; margin-top: 0.15rem; }
</style>
