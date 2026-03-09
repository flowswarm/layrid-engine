/**
 * 3. RUNTIME RESOLUTION RULES
 * 
 * Shows exactly how the actual Engine components (CMS Normalizer, WebGL Manager)
 * rely on the distinct 'published' state without caring about 'generated' vs 'approved'.
 */

import { ApprovalWorkflowEngine } from './ApprovalWorkflowEngine';
import { AssetRegistry } from '../registry/AssetRegistry';

declare const workflowEngine: ApprovalWorkflowEngine;
declare const assetRegistry: AssetRegistry;

/* =========================================================
   A. CONTENT NORMALIZER RULES
   ========================================================= */
export function contentNormalizerFetchesHero(clientId: string) {

    // RULE 1: The Normalizer ONLY asks the Workflow Engine for the 'published' ID.
    // It completely ignores generated, review, or simply approved assets.
    const publishedAssetId = workflowEngine.getLivePublishedAsset(clientId, 'hero-centerpiece');

    if (!publishedAssetId) {
        // RULE 2: If nothing is published, gracefully degrade the block to 2D
        return { type: 'hero', webgl: null };
    }

    // RULE 3: Resolve physical glb paths only against the known published ID
    const physicalAssetData = assetRegistry.getAssetById(publishedAssetId);

    return {
        type: 'hero',
        webgl: {
            sceneMode: 'logo-centerpiece',
            centerpieceSource: physicalAssetData!.runtimePath,
            materialPreset: physicalAssetData!.materialPreset
        }
    };
}

/* =========================================================
   B. TEMPLATE CONFIG RULES
   ========================================================= */
export function templateConfigResolvesLiveScene(cmsNormalizedData: any) {
    const webgl = cmsNormalizedData.webgl;
    if (!webgl) return null; // Component stays dormant

    // RULE 4: If the normalizer injected the block, the Config Controller trusts it is Published.
    // It safely delegates material presets and scene modes natively to the WebGL classes.
    return {
        mountComponent: webgl.sceneMode === 'logo-centerpiece' ? 'GeneratedLogoCenterpiece' : 'DefaultScene',
        sourceMeshUrl: webgl.centerpieceSource,
        ambientLightIntensity: webgl.materialPreset === 'chrome' ? 0.3 : 1.2
    };
}

/* =========================================================
   C. WEBGL SCENE MANAGER RULES
   ========================================================= */
export function webglSceneManagerLoadsMesh(sceneConfig: any) {

    // RULE 5: WebGL purely executes. 
    // - It does not ask "Is this asset approved?"
    // - It does not check if it's Matte or Chrome.
    // It simply loads the precise, validated URL given to it by the Config chain.
    if (sceneConfig && sceneConfig.sourceMeshUrl) {
        console.log(`Loading highly validated, published Centerpiece from: ${sceneConfig.sourceMeshUrl}`);
        // await loader.loadAsync(sceneConfig.sourceMeshUrl)
    }
}
