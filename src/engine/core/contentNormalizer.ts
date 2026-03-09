/**
 * src/engine/core/contentNormalizer.ts
 * 
 * 3. RUNTIME RESOLUTION RULES FOR COMPARISONS
 * 
 * Upgrades the Normalizer to natively intercept `?comparison_token=`.
 * It forces the 3D Canvas to render ONLY `session.currentViewedAssetId`,
 * while simultaneously injecting ALL candidates into `__comparisonState`
 * allowing Vue to mount a rich "Version A / Version B" Switcher UI.
 */

import { SiteDeploymentSync } from '../../../pipeline/deployment/SiteDeploymentSync';
import { AssetRegistry } from '../../../pipeline/registry/AssetRegistry';
import { PreviewSessionManager } from '../../../pipeline/preview/PreviewSessionManager';
import { ClientApprovalManager } from '../../../pipeline/preview/ClientApprovalManager';
import { ComparisonSessionManager } from '../../../pipeline/preview/ComparisonSessionManager';
import { DeploymentEnvironment } from '../../../pipeline/deployment/deployment.types';

const deploymentSync = new SiteDeploymentSync();
const registry = new AssetRegistry();
const previewSessionManager = new PreviewSessionManager({} as any, deploymentSync);
const approvalManager = new ClientApprovalManager({} as any, deploymentSync);
const comparisonManager = new ComparisonSessionManager({} as any, deploymentSync);

export function normalizeSectionData(
    cmsPageData: any,
    siteClientId: string,
    currentEnvironment: DeploymentEnvironment = 'production',
    previewTokenQueryParam?: string,
    approvalTokenQueryParam?: string,
    comparisonTokenQueryParam?: string,  // NEW: Multi-Candidate routing 
    currentRoutePath?: string
) {
    const sections = [];

    for (const block of cmsPageData.blocks) {
        if (block._type === 'hero_block') {

            let targetAssetId: string | null = null;
            let activeComparisonSession = null;
            let activeApprovalSession = null;
            let activePreviewSession = null;

            // ======================================================================
            // 1. ISOLATED HIJACK LAYERS (Comparisons > Approvals > Internal Preview)
            // ======================================================================

            // Priority 1: Multi-Candidate Client Comparisons
            if (comparisonTokenQueryParam) {
                activeComparisonSession = comparisonManager.validateComparisonToken(
                    comparisonTokenQueryParam,
                    siteClientId,
                    'hero-centerpiece',
                    currentEnvironment,
                    currentRoutePath
                );
                if (activeComparisonSession) {
                    // Explicitly resolves the single active mesh that the user toggled
                    targetAssetId = activeComparisonSession.currentViewedAssetId;
                }
            }

            // Priority 2: Standard Client Approval Links
            else if (approvalTokenQueryParam) {
                activeApprovalSession = approvalManager.validateApprovalToken(
                    approvalTokenQueryParam,
                    siteClientId,
                    'hero-centerpiece',
                    currentEnvironment,
                    currentRoutePath
                );
                if (activeApprovalSession) targetAssetId = activeApprovalSession.candidateAssetId;
            }

            // Priority 3: Internal Dev Previews
            else if (previewTokenQueryParam) {
                activePreviewSession = previewSessionManager.validatePreviewToken(
                    previewTokenQueryParam,
                    siteClientId,
                    'hero-centerpiece',
                    currentEnvironment,
                    currentRoutePath
                );
                if (activePreviewSession) targetAssetId = activePreviewSession.previewAssetId;
            }

            // ======================================================================
            // 2. LIVE NATIVE DEPLOYMENT (THE IRONCLAD FALLBACK)
            // ======================================================================
            // If tokens were missing, forged, expired, revoked, or rejected:
            if (!targetAssetId) {
                targetAssetId = deploymentSync.resolveLiveAssetForSite(siteClientId, currentEnvironment, 'hero-centerpiece');
            }

            // ======================================================================
            // 3. PHYSICAL RESOLUTION
            // ======================================================================
            if (!targetAssetId) {
                sections.push({ type: 'hero', webgl: null });
                continue;
            }

            const physicalAssetData = registry.getAssetById(targetAssetId);
            if (!physicalAssetData) continue;

            sections.push({
                id: block.id,
                type: 'hero',
                content: { title: block.title },
                webgl: {
                    // Native blind loading for WebGL:
                    sceneMode: physicalAssetData.compatibleSceneModes[0] || 'logo-centerpiece',
                    centerpieceSource: physicalAssetData.runtimePath,
                    materialPreset: physicalAssetData.materialPreset,

                    __previewState: activePreviewSession ? { isActive: true } : { isActive: false },
                    __approvalState: activeApprovalSession ? { isActive: true } : { isActive: false },

                    // NEW: Inject rich comparison dictionary down into the DOM tree
                    // Vue uses this to render an overlay "Version A | Version B" switcher
                    __comparisonState: activeComparisonSession ? {
                        isActive: true,
                        status: activeComparisonSession.status,
                        candidates: activeComparisonSession.candidates.map(c => c.assetId),
                        currentViewedAssetId: activeComparisonSession.currentViewedAssetId,
                        primaryCandidateAssetId: activeComparisonSession.primaryCandidateAssetId,
                        baseLiveAssetId: activeComparisonSession.baseLiveAssetId
                    } : { isActive: false }
                }
            });
        }
    }

    return sections;
}
