import { v4 as uuidv4 } from 'uuid';
import { ClientFeedback, ClientFeedbackSchema, StructuredAdjustments } from './feedback.types';
import { LogoAssetJobRunner } from '../jobs/LogoJobRunner';
import { LogoGenerationRequest } from '../schemas/generation.types';
import { AssetRegistry } from '../registry/AssetRegistry';

/**
 * 2. REFINED CLIENT FEEDBACK MANAGER API
 * 
 * Safely digests raw notes, processes structural deltas, and precisely math-clamps 
 * the results into literal Blender MCP target configs. 
 */
export class FeedbackManager {
    private jobRunner: LogoAssetJobRunner;
    private registry: AssetRegistry;
    private activeFeedback: Map<string, ClientFeedback> = new Map();

    constructor(jobRunner: LogoAssetJobRunner, registry: AssetRegistry) {
        this.jobRunner = jobRunner;
        this.registry = registry;
    }

    /**
     * INGESTION: Link a raw client note to an Asset context organically.
     */
    public submitFeedback(
        siteId: string,
        assetId: string,
        variantFamilyId: string,
        author: string,
        rawNotes: string,
        feedbackType: ClientFeedback['feedbackType'] = 'revision-request',
        structuredPayload?: StructuredAdjustments,
        previewSessionId?: string,
        comparisonSessionId?: string
    ): ClientFeedback {
        const feedbackId = uuidv4();

        const feedback: ClientFeedback = {
            feedbackId,
            context: { siteId, assetId, variantFamilyId, previewSessionId, comparisonSessionId, sceneRole: 'hero-centerpiece' },
            feedbackType,
            status: 'submitted',
            structuredAdjustments: structuredPayload || null,
            rawNotes,
            submittedBy: author,
            submittedAt: new Date(),
            reviewedAt: null,
            resolvedAt: null,
            revisionJobId: null
        };

        ClientFeedbackSchema.parse(feedback);
        this.activeFeedback.set(feedbackId, feedback);

        return feedback;
    }

    public updateFeedbackStatus(feedbackId: string, status: ClientFeedback['status'], adminId?: string): void {
        const feedback = this.activeFeedback.get(feedbackId);
        if (!feedback) throw new Error("Feedback not found.");

        feedback.status = status;

        if (status === 'reviewed') feedback.reviewedAt = new Date();
        if (status === 'resolved' || status === 'archived') feedback.resolvedAt = new Date();
    }

    /**
     * TRANSLATION LOGIC: Converts feedback into an explicit Job Config.
     * Pulls the exact properties from the currently viewed Asset, applies the 
     * semantic deltas (-1.0 to 1.0), and clamps the physical output perfectly.
     */
    private generateRevisionPayload(feedback: ClientFeedback): any {
        const baselineAsset = this.registry.getAssetById(feedback.context.assetId);
        if (!baselineAsset) throw new Error("Base asset no longer exists in Registry.");

        // Use defaults — AssetRecord doesn't store geometry params directly
        let baseConfig: any = {
            materialPreset: baselineAsset.materialPreset as any || 'chrome',
            primaryColor: '#FFFFFF',
            extrusionDepth: 0.15,
            bevelSize: 0.03,
            complexity: 'high'
        };

        // Safely execute math on the exact overrides requested
        if (feedback.structuredAdjustments) {
            const adj = feedback.structuredAdjustments;

            if (adj.materialChange) {
                baseConfig.materialPreset = adj.materialChange;
            }

            // Absolute Mathematical Bounds processing.
            // Thickness: 0.1 delta = 10% modification step relative to MAX bounds (let's say 0.5 is max physically allowed)
            if (adj.thicknessDelta !== undefined) {
                const variance = adj.thicknessDelta * 0.1;
                baseConfig.extrusionDepth = Math.max(0.01, Math.min(0.5, baseConfig.extrusionDepth + variance));
            }

            // Bevel: 0.1 delta = tiny smoothing fraction
            if (adj.bevelDelta !== undefined) {
                const variance = adj.bevelDelta * 0.05;
                baseConfig.bevelSize = Math.max(0, Math.min(0.2, (baseConfig.bevelSize || 0.03) + variance));
            }
        }

        return baseConfig;
    }

    /**
     * HANDOFF: Physically dispatch the revised Blender command
     */
    public async convertFeedbackToRevisionRequest(feedbackId: string, adminId: string): Promise<string> {
        const feedback = this.activeFeedback.get(feedbackId);
        if (!feedback) throw new Error("Feedback not found.");
        if (['converted-to-revision', 'resolved', 'archived'].includes(feedback.status)) {
            throw new Error("Feedback is immovable globally.");
        }

        // Mathematical Parsing Phase
        const jobConfig = this.generateRevisionPayload(feedback);

        // Engine Pipeline Integration
        const { jobId } = await this.jobRunner.queueJob(
            {
                inputType: 'text',
                sourcePayload: 'REVISION',
                extrusionDepth: jobConfig.extrusionDepth ?? 0.15,
                bevelDepth: jobConfig.bevelSize ?? 0.03,
                bevelResolution: 4,
                materialPreset: jobConfig.materialPreset || 'chrome',
                brandColorHex: jobConfig.primaryColor,
                targetFilename: `revision-${Date.now()}`
            },
            { heroSceneModePreference: 'logo-centerpiece', enableMotionAnchors: true },
            feedback.context.siteId,
            feedback.context.variantFamilyId,
            feedback.context.siteId,
            feedback.context.sceneRole || 'hero-centerpiece'
        );

        // Secure Ledger Updates
        feedback.revisionJobId = jobId;
        this.updateFeedbackStatus(feedbackId, 'converted-to-revision', adminId);

        return jobId;
    }
}
