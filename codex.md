# Layrid Engine Codex

This document serves as the master architectural reference and codebase summary for the **Layrid Cinematic Interactive Website Engine**. It catalogs all major systems, their exact responsibilities, and the core implementation snippets that bind the platform together from Admin Input down to WebGL Anchor Rendering.

---

## Table of Contents
1. [Core Pipeline & Generation](#1-core-pipeline--generation)
2. [Asset Registry](#2-asset-registry)
3. [Workflow, Revisions & Previews](#3-workflow-revisions--previews)
4. [Deployment & Operations](#4-deployment--operations)
5. [Unified Motion Engine](#5-unified-motion-engine)
6. [Animation Preset Library](#6-animation-preset-library)
7. [WebGL Flagship Integration](#7-webgl-flagship-integration)

---

## 1. Core Pipeline & Generation
The ingest layer responsible for taking Admin requests and delegating them to the physical Blender MCP for mesh generation.

### Job Runner Orchestration
```typescript
// pipeline/operations/LogoJobRunner.ts
export class LogoJobRunner {
    async dispatchLogoTask(request: AdminLogoRequest) {
        const jobId = generateId();
        await Database.jobs.insert({ id: jobId, status: 'processing', request });

        try {
            // MCP Subprocess execution
            const mcpResult = await executeBlenderMCP({
                script: 'extrude_and_bevel',
                inputUrl: request.svgUrl,
                material: request.materialPreset,
                anchorTarget: 'top-right' // Essential for Typography Tracking
            });

            await AssetRegistry.registerExport(jobId, mcpResult.glbS3Url);
            await Database.jobs.update(jobId, { status: 'completed' });
        } catch (error) {
            await Database.jobs.update(jobId, { status: 'failed', error });
        }
    }
}
```

---

## 2. Asset Registry
The central nervous system for mapping physical binary hashes (the .GLB files) to logical domains.

### Registry Schema Definition
```typescript
// pipeline/registry/registry.types.ts
export interface AssetRecord {
    hashId: string;           // E.g., 'hash-chrome-layrid-v2'
    storagePath: string;      // S3 path
    jobSourceId: string;      // Link to Job Runner
    metadata: {
        type: '3d-mesh' | 'video' | 'texture';
        polyCount?: number;
        hasAnchorBones?: boolean;
    };
    createdAt: number;
}
```

---

## 3. Workflow, Revisions & Previews
The human-in-the-loop lifecycle ensuring assets can be staged, compared, and approved before ever touching a live CDN.

### Comparison Engine Resolution
```typescript
// pipeline/preview/RuntimeAssetResolver.ts
export class RuntimeAssetResolver {
    static async resolve(queryParam: any, currentLiveSlotHash: string) {
        // 1. Comparison Mode (Side-by-side array)
        if (queryParam.compare) {
            const hashes = queryParam.compare.split(',');
            return {
                mode: 'comparison',
                assetIds: hashes, // Yields ['hash-matte', 'hash-chrome']
                environment: 'preview'
            };
        }
        
        // 2. Single Ticket Preview
        if (queryParam.preview_ticket) {
            const ticketHash = await Database.getHashFromTicket(queryParam.preview_ticket);
            return {
                mode: 'preview',
                assetIds: [ticketHash],
                environment: 'preview'
            };
        }
        
        // 3. Native Live Production (Fallthrough)
        return {
            mode: 'live',
            assetIds: [currentLiveSlotHash],
            environment: 'live'
        };
    }
}
```

---

## 4. Deployment & Operations
The infrastructure governing Live Site mapping and Admin analytics.

### Live Mapping & Rollback Schema
```typescript
// pipeline/deployment/deployment.types.ts
export interface SiteLiveMapping {
    siteId: string;
    sceneRole: 'hero-centerpiece'; // Target template slot
    
    // The Active Production Binding
    currentLiveAssetId: string;   
    
    // Safety Fallback Snapshot
    previousLiveAssetId?: string; 
    
    syncStatus: 'synced' | 'syncing' | 'failed';
}
```

### Analytics Drill-Down Pattern
```typescript
// src/admin/architecture/AnalyticsOperationsRoutes.ts
export interface MetricDefinition {
    id: string;
    label: string;
    value: number;
    // Embeds the vue-router payload to directly investigate the metric context
    drillDownRoute?: {
        name: 'DeploymentLog',          
        query: { filterStatus: 'failed' }; 
    };
    requiredCapabilities: string[]; // Strict RBAC filtering
}
```

---

## 5. Unified Motion Engine
The single source of truth for runtime animation state, strictly demarcating Producers (Scroll, Transitions) from Subscribers (WebGL, DOM).

### Shared Runtime Schema
```typescript
// src/engine/runtime/runtime.types.ts
export interface SharedRuntimeState {
    context: {
        assetIds: string[]; // Arrays support comparison side-by-side
        environment: 'live' | 'preview' | 'comparison';
    };
    spatial: {
        rawProgress: number;              // 0.0 - 1.0 explicit bound limit
        smoothedProgress: number;         // Lerped
        direction: 'up' | 'down';
    };
    topology: {
        anchors: Record<string, { x: number, y: number }>; // 2D Projected Mesh Sockets
    };
}
```

---

## 6. Animation Preset Library
The pure mathematical suite responsible for translating linear scroll scalars into robust CSS matrices without tight coupling.

### Preset Functions & Registry
```typescript
// src/engine/scroll/presets/implementations.ts
export interface TransformState {
    scale: number; opacity: number;
    x: number; y: number; z: number;
    rotateX: number; rotateY: number; rotateZ: number;
}

export const heroIntro = (progress: number): Partial<TransformState> => {
    return {
        scale: 2.5 - (1.5 * progress), // Starts at 2.5, shrinks to 1.0
        opacity: Math.min(progress * 2, 1),
        z: -100 * (1 - progress) 
    };
};
```

---

## 7. WebGL Flagship Integration
The zenith of the architectural spine. The system that mounts the generated `.glb` array, listens to the spatial scroll progress, and physically calculates the topological screen-mapping so standard HTML text can glue itself to the 3D rotating object.

### The Rendering Subscriber
```typescript
// src/engine/webgl/WebGLSceneSubscriber.ts
class WebGLSubscriber {
    private activeMesh: THREE.Object3D | null = null;
    
    public onTick() {
        if (!this.activeMesh) return;
        
        // 1. Mathematical Binding (Listen)
        const progress = MotionEngine.state.spatial.smoothedProgress;
        this.activeMesh.rotation.y = Math.PI * progress; // 0 to 180 degrees
        
        // 2. Find Explicit MCP Generation Socket
        const socket = this.activeMesh.getObjectByName('TextAnchorSocket');
        if (socket) {
            // 3. Project 3D vector -> 2D Screen Space
            const vector = new THREE.Vector3();
            socket.getWorldPosition(vector);
            vector.project(this.camera);
            
            const px = (vector.x * .5 + .5) * window.innerWidth;
            const py = (vector.y * -.5 + .5) * window.innerHeight;
            
            // 4. Update Bus (Produce)
            MotionEngine.writeTopology({ 
                anchors: { headerFollow: { x: px, y: py } }
            });
        }
    }
}
```

### The HTML Follower Consumer
```vue
<!-- src/engine/components/HeroSection.vue -->
<template>
  <div class="hero">
     <!-- Native CSS Transform mapped directly to the GPU's published coordinates -->
     <h1 class="logo-sticky-label" :style="{
         transform: `translate3d(${anchorX}px, ${anchorY}px, 0)`
     }">
        Interactive Showcase
     </h1>
  </div>
</template>

<script setup>
const MotionEngine = useRuntimeState();
// Evaluates at 60fps tracking the rotation of the 3D model
const anchorX = computed(() => MotionEngine.state.topology.anchors.headerFollow?.x || 0);
const anchorY = computed(() => MotionEngine.state.topology.anchors.headerFollow?.y || 0);
</script>
```

---

### Final Platform Assessment
As demonstrated above, the engine is fully compartmentalized. The Admin writes to `AssetRegistry`. The Router flags `RuntimeAssetResolver`. The `WebGLSubscriber` acts exclusively on mathematical `spatial` arrays, while implicitly mapping `topology` matrices back. The `DOM` only reads what it is given.

This architecture is physically robust, immune to routing duplications, and handles fallback, comparisons, and staging universally with the identical code paths used for production deployment.
