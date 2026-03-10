import { execFile, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LogoGenerationRequest, LogoGenerationRequestSchema } from '../schemas/generation.types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * BlenderOrchestrator
 * 
 * Server-side only. Invokes Blender in headless mode to generate 3D logo GLBs.
 * Falls back to a programmatic Three.js GLB exporter when Blender is not installed.
 */
export class BlenderOrchestrator {
    private blenderPath: string;
    private scriptPath: string;
    private outputDir: string;
    private blenderAvailable: boolean | null = null;

    constructor(options: { blenderPath?: string, outputDir?: string } = {}) {
        this.blenderPath = options.blenderPath || process.env.BLENDER_PATH || 'blender';
        this.scriptPath = path.resolve(__dirname, '../blender/generate_3d_logo.py');
        this.outputDir = options.outputDir || path.resolve(process.cwd(), 'public/models');
    }

    /** Check if Blender is available (system PATH or BLENDER_PATH env). */
    private checkBlenderAvailable(): boolean {
        if (this.blenderAvailable !== null) return this.blenderAvailable;
        try {
            execSync(`"${this.blenderPath}" --version`, { stdio: 'pipe', timeout: 10000 });
            this.blenderAvailable = true;
            console.log(`[MCP] ✅ Blender detected: ${this.blenderPath}`);
        } catch {
            this.blenderAvailable = false;
            console.log(`[MCP] ⚠️ Blender not found at "${this.blenderPath}" — will use fallback GLB generator`);
            console.log(`[MCP]    Set BLENDER_PATH env variable to your blender.exe location`);
        }
        return this.blenderAvailable;
    }

    public async generateLogo(request: LogoGenerationRequest): Promise<string> {
        // 1. Strict Validation
        const validRequest = LogoGenerationRequestSchema.parse(request);

        // 2. Ensure output directory exists
        fs.mkdirSync(this.outputDir, { recursive: true });

        // 3. Prepare Export Path
        const outputPath = path.join(this.outputDir, `${validRequest.targetFilename}.glb`);
        const publicUrl = `/models/${validRequest.targetFilename}.glb`;

        // 4. Route to Blender or fallback
        if (this.checkBlenderAvailable()) {
            return this.generateWithBlender(validRequest, outputPath, publicUrl);
        } else {
            return this.generateFallbackGLB(validRequest, outputPath, publicUrl);
        }
    }

    /** Real Blender CLI execution */
    private generateWithBlender(request: LogoGenerationRequest, outputPath: string, publicUrl: string): Promise<string> {
        const args = [
            '-b',
            '-P', this.scriptPath,
            '--',
            '--type', request.inputType,
            '--source', request.sourcePayload,
            '--extrude', request.extrusionDepth.toString(),
            '--bevel', request.bevelDepth.toString(),
            '--bevel-res', String(request.bevelResolution ?? 4),
            '--material', request.materialPreset,
            '--color', request.brandColorHex || '',
            '--output', outputPath
        ];

        return new Promise((resolve, reject) => {
            console.log(`[MCP] Orchestrating Blender for: ${request.targetFilename}`);

            const proc = execFile(this.blenderPath, args);

            proc.stdout?.on('data', (data) => console.log(`[Blender]: ${data}`));
            proc.stderr?.on('data', (data) => console.error(`[Blender Error]: ${data}`));

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(publicUrl);
                } else {
                    reject(new Error(`Blender process exited with code ${code}`));
                }
            });
        });
    }

    /**
     * Fallback GLB generator — produces a valid GLB binary without Blender.
     * Creates a minimal but valid glTF 2.0 binary (GLB) with a colored box mesh.
     * The WebGL loader will successfully parse this as a real 3D asset.
     */
    private async generateFallbackGLB(request: LogoGenerationRequest, outputPath: string, publicUrl: string): Promise<string> {
        console.log(`[MCP] 🔧 Generating fallback GLB for: ${request.targetFilename}`);

        if (request.inputType === 'svg') {
            console.warn(`[MCP] ⚠️ SVG input ignored — Blender is unavailable. The fallback generator cannot parse SVG curves; producing a generic colored box instead. Install Blender for real SVG→3D conversion.`);
        }

        // Parse brand color or use default
        const hex = request.brandColorHex || '#8B5CF6';
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        // Build a minimal valid glTF 2.0 JSON 
        const gltfJson = {
            asset: { version: '2.0', generator: 'layrid-fallback' },
            scene: 0,
            scenes: [{ name: 'Scene', nodes: [0, 1] }],
            nodes: [
                { name: 'HeroMesh', mesh: 0 },
                { name: 'TextAnchorSocket', translation: [0, 0.8, 0.3] }
            ],
            meshes: [{
                name: 'HeroMesh',
                primitives: [{
                    attributes: { POSITION: 0, NORMAL: 1 },
                    indices: 2,
                    material: 0
                }]
            }],
            materials: [{
                name: 'CenterpieceMat',
                pbrMetallicRoughness: {
                    baseColorFactor: [r, g, b, 1.0],
                    metallicFactor: request.materialPreset === 'chrome' ? 1.0 : 0.0,
                    roughnessFactor: request.materialPreset === 'chrome' ? 0.05 : 0.8
                },
                emissiveFactor: [r * 0.3, g * 0.3, b * 0.3]
            }],
            accessors: [
                { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', max: [1, 1, 1], min: [-1, -1, -1] },
                { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
                { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' }
            ],
            bufferViews: [
                { buffer: 0, byteOffset: 0, byteLength: 288, target: 34962 },
                { buffer: 0, byteOffset: 288, byteLength: 288, target: 34962 },
                { buffer: 0, byteOffset: 576, byteLength: 72, target: 34963 }
            ],
            buffers: [{ byteLength: 648 }]
        };

        // Build binary buffer: 24 vertices (box), 24 normals, 36 indices
        const buf = Buffer.alloc(648);
        let offset = 0;

        // Box vertices (8 unique corners × 3 faces each = 24 vertices for proper normals)
        const depth = Math.min(request.extrusionDepth, 1.0);
        const positions = [
            // Front face (Z+)
            -1, -1, depth, 1, -1, depth, 1, 1, depth, -1, 1, depth,
            // Back face (Z-)
            -1, -1, -depth, -1, 1, -depth, 1, 1, -depth, 1, -1, -depth,
            // Top face (Y+)
            -1, 1, -depth, -1, 1, depth, 1, 1, depth, 1, 1, -depth,
            // Bottom face (Y-)
            -1, -1, -depth, 1, -1, -depth, 1, -1, depth, -1, -1, depth,
            // Right face (X+)
            1, -1, -depth, 1, 1, -depth, 1, 1, depth, 1, -1, depth,
            // Left face (X-)
            -1, -1, -depth, -1, -1, depth, -1, 1, depth, -1, 1, -depth,
        ];
        for (const v of positions) { buf.writeFloatLE(v, offset); offset += 4; }

        // Normals
        const normals = [
            0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,   // Front
            0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,   // Back
            0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,    // Top
            0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,   // Bottom
            1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,    // Right
            -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,   // Left
        ];
        for (const n of normals) { buf.writeFloatLE(n, offset); offset += 4; }

        // Indices (6 faces × 2 triangles × 3 indices)
        const indices = [
            0, 1, 2, 0, 2, 3,     // Front
            4, 5, 6, 4, 6, 7,     // Back
            8, 9, 10, 8, 10, 11,   // Top
            12, 13, 14, 12, 14, 15, // Bottom
            16, 17, 18, 16, 18, 19, // Right
            20, 21, 22, 20, 22, 23, // Left
        ];
        for (const i of indices) { buf.writeUInt16LE(i, offset); offset += 2; }

        // Encode glTF JSON to buffer
        let jsonStr = JSON.stringify(gltfJson);
        // Pad JSON to 4-byte alignment
        while (jsonStr.length % 4 !== 0) jsonStr += ' ';
        const jsonBuf = Buffer.from(jsonStr, 'utf-8');

        // Assemble GLB (header + JSON chunk + BIN chunk)
        const headerSize = 12;
        const jsonChunkHeaderSize = 8;
        const binChunkHeaderSize = 8;
        // Pad bin buffer to 4-byte alignment
        const binPadding = (4 - (buf.length % 4)) % 4;
        const paddedBinLength = buf.length + binPadding;

        const totalSize = headerSize + jsonChunkHeaderSize + jsonBuf.length + binChunkHeaderSize + paddedBinLength;

        const glb = Buffer.alloc(totalSize);
        let pos = 0;

        // GLB Header
        glb.writeUInt32LE(0x46546C67, pos); pos += 4; // magic "glTF"
        glb.writeUInt32LE(2, pos); pos += 4;          // version
        glb.writeUInt32LE(totalSize, pos); pos += 4;   // total length

        // JSON Chunk
        glb.writeUInt32LE(jsonBuf.length, pos); pos += 4;   // chunk length
        glb.writeUInt32LE(0x4E4F534A, pos); pos += 4;      // chunk type "JSON"
        jsonBuf.copy(glb, pos); pos += jsonBuf.length;

        // BIN Chunk
        glb.writeUInt32LE(paddedBinLength, pos); pos += 4;   // chunk length
        glb.writeUInt32LE(0x004E4942, pos); pos += 4;       // chunk type "BIN\0"
        buf.copy(glb, pos); pos += buf.length;
        // Zero-fill padding
        for (let i = 0; i < binPadding; i++) { glb.writeUInt8(0, pos); pos += 1; }

        // Write to disk
        fs.writeFileSync(outputPath, glb);

        console.log(`[MCP] ✅ Fallback GLB written: ${outputPath} (${glb.length} bytes)`);
        return publicUrl;
    }
}
