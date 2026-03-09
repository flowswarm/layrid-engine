/**
 * src/engine/core/contentNormalizer.ts
 * 
 * 3. RUNTIME RESOLUTION RULES 
 * ------------------------------------------------------------------
 * The Content Normalizer queries the Deployment map dynamically based on 
 * the URL parameters or environment variables (Production vs Preview).
 */

import { SiteDeploymentSync } from './SiteDeploymentSync';
import { AssetRegistry } from '../registry/AssetRegistry';
import { DeploymentEnvironment } from './deployment.types';

const registry = new AssetRegistry();
const deploymentSync = new SiteDeploymentSync();

/* =========================================================
   A. CONTENT NORMALIZER RESOLUTION
   ========================================================= */
export function contentNormalizerResolvesDeployment(
    cmsPageData: any,
    siteClientId: string,
    currentEnvironment: DeploymentEnvironment = 'production'
) {
    const sections = [];

    for (const block of cmsPageData.blocks) {
        if (block._type === 'hero_block') {

            // RULE 1: Explicitly request the asset mapped to the executing environment.
            // e.g. If URL is `preview.mysite.com`, it resolves the 'preview' slot
            const liveAssetId = deploymentSync.resolveLiveAssetForSite(siteClientId, currentEnvironment, 'hero-centerpiece');

            // RULE 2: Gracefully degrade if there is no asset deployed to this specific environment.
            if (!liveAssetId) {
                sections.push({ type: 'hero', webgl: null });
                continue;
            }

            // RULE 3: Resolve physical glb paths against the locked deployment ID natively
            const physicalAssetData = registry.getAssetById(liveAssetId);
            if (!physicalAssetData) continue; // Defense in depth

            sections.push({
                id: block.id,
                type: 'hero',
                content: { title: block.title },
                // Safely injected purely from the explicit Deployment target
                webgl: {
                    sceneMode: physicalAssetData.compatibleSceneModes[0] || 'logo-centerpiece',
                    centerpieceSource: physicalAssetData.runtimePath,
                    materialPreset: physicalAssetData.materialPreset
                }
            });
        }
    }

    return sections;
}
