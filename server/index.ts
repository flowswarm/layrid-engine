import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { JsonStore } from './persistence/JsonStore';
import { AssetRegistry } from '../pipeline/registry/AssetRegistry';
import { SiteDeploymentSync } from '../pipeline/deployment/SiteDeploymentSync';
import { ApprovalWorkflowEngine } from '../pipeline/workflow/ApprovalWorkflowEngine';
import { LogoAssetJobRunner } from '../pipeline/jobs/LogoJobRunner';
import { createLogoJobsRouter } from './api/logoJobs';
import { createPublishRouter } from './api/publish';

const PORT = 3000;

async function startServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // ── 1. Restore persisted state (or create fresh) ──────────
    const registryData = JsonStore.load('registry');
    const registry = registryData ? AssetRegistry.fromJSON(registryData) : new AssetRegistry();
    registry.setPersist((data) => JsonStore.save('registry', data));

    const deploymentData = JsonStore.load('deployment');
    const deploymentSync = deploymentData ? SiteDeploymentSync.fromJSON(deploymentData) : new SiteDeploymentSync();
    deploymentSync.setPersist((data) => JsonStore.save('deployment', data));

    const workflowData = JsonStore.load('workflows');
    const workflowEngine = workflowData
        ? ApprovalWorkflowEngine.fromJSON(workflowData, registry, deploymentSync)
        : new ApprovalWorkflowEngine(registry, deploymentSync);
    workflowEngine.setPersist((data) => JsonStore.save('workflows', data));

    // Restore assetId → workflowId mapping
    const workflowMap = new Map<string, string>();
    const savedMap = JsonStore.load<Record<string, string>>('workflow-map');
    if (savedMap) {
        for (const [k, v] of Object.entries(savedMap)) workflowMap.set(k, v);
    }

    // Persist workflow map whenever it changes (we'll wrap the set)
    const origSet = workflowMap.set.bind(workflowMap);
    workflowMap.set = function (k: string, v: string) {
        const result = origSet(k, v);
        const obj: Record<string, string> = {};
        for (const [key, val] of workflowMap) obj[key] = val;
        JsonStore.save('workflow-map', obj);
        return result;
    };

    // ── 2. Create job runner (server-side only) ───────────────
    const jobRunner = new LogoAssetJobRunner(registry);

    console.log('[Server] ✅ Pipeline services restored from disk');

    // ── 3. Mount API routes ──────────────────────────────────
    app.use('/api/logo-jobs', createLogoJobsRouter(registry, jobRunner, workflowEngine));
    app.use('/api', createPublishRouter(registry, deploymentSync, workflowEngine, workflowMap));

    // ── 4. Serve static files from public/ (where GLBs live) ─
    const publicDir = path.resolve(process.cwd(), 'public');
    app.use(express.static(publicDir));

    // ── 5. Vite dev middleware (SPA + HMR) ────────────────────
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });
    app.use(vite.middlewares);

    // ── 6. Start listening ───────────────────────────────────
    app.listen(PORT, () => {
        console.log(`[Server] 🚀 Layrid backend running at http://localhost:${PORT}`);
        console.log(`[Server]    Studio: http://localhost:${PORT}/studio`);
        console.log(`[Server]    API:    http://localhost:${PORT}/api/`);
    });
}

startServer().catch(err => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
});
