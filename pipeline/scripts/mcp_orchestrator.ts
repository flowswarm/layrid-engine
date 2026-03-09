import { exec } from 'child_process';
import path from 'path';
import { LogoGenerationRequest, LogoGenerationRequestSchema } from '../schemas/generation.types';

export class BlenderOrchestrator {
    private blenderPath: string;
    private scriptPath: string;
    private outputDir: string;

    constructor(options: { blenderPath?: string, outputDir?: string } = {}) {
        // Rely on system PATH by default, or specific executable path
        this.blenderPath = options.blenderPath || 'blender';
        this.scriptPath = path.resolve(__dirname, '../blender/generate_3d_logo.py');
        // Default to the Nuxt public folder for immediate WebGL availability
        this.outputDir = options.outputDir || path.resolve(process.cwd(), 'public/models');
    }

    public async generateLogo(request: LogoGenerationRequest): Promise<string> {
        // 1. Strict Validation
        const validRequest = LogoGenerationRequestSchema.parse(request);

        // 2. Prepare Export Path
        const outputPath = path.join(this.outputDir, `${validRequest.targetFilename}.glb`);

        // 3. Assemble Blender CLI Arguments
        // Format: blender -b -P script.py -- [args passed to sys.argv in python]
        const args = [
            '-b', // Background/Headless mode
            '-P', this.scriptPath,
            '--', // Separator for script arguments
            '--type', validRequest.inputType,
            '--source', validRequest.sourcePayload,
            '--extrude', validRequest.extrusionDepth.toString(),
            '--bevel', validRequest.bevelDepth.toString(),
            '--material', validRequest.materialPreset,
            '--color', validRequest.brandColorHex || '',
            '--output', outputPath
        ];

        // 4. Execution
        return new Promise((resolve, reject) => {
            console.log(`[MCP] Orchestrating Blender for: ${validRequest.targetFilename}`);

            const process = exec(`${this.blenderPath} ${args.join(' ')}`);

            process.stdout?.on('data', (data) => console.log(`[Blender]: ${data}`));
            process.stderr?.on('data', (data) => console.error(`[Blender Error]: ${data}`));

            process.on('close', (code) => {
                if (code === 0) {
                    // 5. Return Frontend-Ready Path (e.g., '/models/hero-centerpiece.glb')
                    const publicUrl = `/models/${validRequest.targetFilename}.glb`;
                    resolve(publicUrl);
                } else {
                    reject(new Error(`Blender process exited with code ${code}`));
                }
            });
        });
    }
}
