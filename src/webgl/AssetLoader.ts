import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

/**
 * Singleton class to fetch, decode, and cache Blender MCP Exported Assets.
 */
export class AssetLoader {
    private static gltfLoader = new GLTFLoader();
    private static cache: Map<string, any> = new Map();

    // Draco loader helps decompress files if Blender MCP exported a compressed .glb
    static {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
    }

    /**
     * WIRING POINT 3: Fetches the centerpiece GLB efficiently
     */
    public static loadGLTF(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            // 1. Check local cache (Memory saving across Nuxt route changes)
            if (this.cache.has(url)) {
                console.log(`[AssetLoader] Returning cached GLB: ${url}`);
                resolve(this.cache.get(url));
                return;
            }

            // 2. Fetch from the /public/models/ folder
            this.gltfLoader.load(
                url,
                (gltf) => {
                    console.log(`[AssetLoader] Successfully parsed GLB: ${url}`);
                    this.cache.set(url, gltf);
                    resolve(gltf);
                },
                (xhr) => {
                    // Progress logging
                    // console.log(`[AssetLoader] ${(xhr.loaded / xhr.total) * 100}% loaded`);
                },
                (error) => {
                    console.error(`[AssetLoader] Failed to load MCP output at ${url}`, error);
                    reject(error);
                }
            );
        });
    }
}
