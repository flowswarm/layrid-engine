import { v4 as uuidv4 } from 'uuid';
import { AssetJob, JobStatus } from '../schemas/job.types';
import { LogoGenerationRequest } from '../schemas/generation.types';
import { AssetRegistry } from '../registry/AssetRegistry';
import { BlenderOrchestrator } from '../scripts/mcp_orchestrator';

export class LogoAssetJobRunner {
    private jobDb: Map<string, AssetJob> = new Map();
    private blenderExecutor: BlenderOrchestrator;

    // The JobRunner now holds a reference to the Global Registry 
    // replacing the old isolated 'AssetRegistrationRecord' loose objects.
    private registry: AssetRegistry;

    constructor(registry: AssetRegistry) {
        this.blenderExecutor = new BlenderOrchestrator();
        this.registry = registry;
    }

    /**
     * 1. INTAKE
     */
    public async queueJob(
        pipelinePayload: LogoGenerationRequest,
        integrationPreferences: AssetJob['integrationMetadata'],
        clientId: string,
        familyId: string, // The admin explicitly tells us which Family this job belongs to
        siteId: string,
        sceneRole: string = 'hero-centerpiece'
    ): Promise<{ jobId: string, draftAssetId: string }> {

        const jobId = uuidv4();

        // The JobRunner instantly reserves a Draft spot in the official Registry
        // before touching Blender.
        const draftAssetId = this.registry.draftAsset(familyId, clientId, {
            sourceType: pipelinePayload.inputType as any,
            materialPreset: pipelinePayload.materialPreset,
            compatibleSceneModes: [integrationPreferences?.heroSceneModePreference || 'logo-centerpiece'],
            isHeroEligible: true,
            supportsMotionAnchors: integrationPreferences?.enableMotionAnchors ?? true,
            // Provenance: bind to source job, site, and scene role
            sourceJobId: jobId,
            sceneRole
        });

        const newJob: AssetJob = {
            jobId, clientId, status: 'queued', timestamps: { queuedAt: new Date() },
            pipelinePayload, integrationMetadata: integrationPreferences
        };

        this.jobDb.set(jobId, newJob);

        // Pass both IDs so the Async worker knows exactly which Registry slot to update
        this.processJob(jobId, draftAssetId);

        return { jobId, draftAssetId };
    }

    /**
     * 2. EXECUTION
     */
    private async processJob(jobId: string, draftAssetId: string) {
        const job = this.jobDb.get(jobId);
        if (!job) return;

        try {
            this.updateStatus(job, 'validating');
            job.timestamps.startedAt = new Date();

            this.updateStatus(job, 'processing');
            // Execute Blender payload
            const exportedUrl = await this.blenderExecutor.generateLogo(job.pipelinePayload);

            this.updateStatus(job, 'exporting');

            // 3. REGISTRY HANDOFF
            // The JobRunner does not manage the "Active" logic. It simply hands the physical
            // file path to the Registry and moves the state to 'pending_approval'.
            this.registry.registerExportedFile(
                draftAssetId,
                exportedUrl,
                job.pipelinePayload.targetFilename + '.glb' // example
            );

            this.updateStatus(job, 'completed');
            job.timestamps.completedAt = new Date();

        } catch (err: any) {
            console.error(`[JobRunner] Job ${jobId} failed:`, err);
            job.errorDetails = { code: err.code || 'ERROR', message: err.message, failedAtStep: job.status };
            this.updateStatus(job, 'failed');

            // Tell the Registry the draft failed.
            this.registry.updateAssetStatus(draftAssetId, 'failed');
        }
    }

    private updateStatus(job: AssetJob, status: JobStatus) {
        job.status = status;
        this.jobDb.set(job.jobId, job);
    }

    /** Query a job's current status (for API polling). */
    public getJob(jobId: string): AssetJob | undefined {
        return this.jobDb.get(jobId);
    }
}
