import { NormalizedSection } from '../types/content.types';

export function useContentNormalizer() {
    /**
     * 1. The Normalizer receives dirty, unpredictable JSON from the CMS
     * 2. It sanitizes it into strict NormalizedSections
     * 3. Critically, it maps 'brandSlug' to the anticipated Blender MCP Output
     */
    const normalizePayload = (rawCmsData: any): NormalizedSection[] => {
        const sections: NormalizedSection[] = [];

        // Let's assume the CMS sends a "Hero" block
        if (rawCmsData.hero) {
            sections.push({
                id: 'hero',
                type: 'hero',
                media: {
                    images: rawCmsData.hero.backgroundImages || [],
                    videos: [],
                },
                // WIRING POINT 1: Set the centerpieceSource based on CMS data!
                // We know the Blender MCP pipeline always exports to /models/{slug}-centerpiece.glb
                webgl: {
                    sceneMode: rawCmsData.hero.use3DLogo ? 'logo-centerpiece' : 'ambient-particles',
                    centerpieceSource: rawCmsData.hero.use3DLogo
                        ? `/models/${rawCmsData.brandSlug}-centerpiece.glb`
                        : undefined,
                    ambientIntensity: 1.5
                }
            });
        }

        return sections;
    };

    return { normalizePayload };
}
