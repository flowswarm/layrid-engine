import { AssetRegistry } from '../registry/AssetRegistry';

export class RuntimeAssetResolver {
    /**
     * Deterministically resolves which Asset Hashes the renderer must load, 
     * natively isolating Preview and Comparison tickets away from Live Edge cache.
     */
    static async resolve(queryParam: Record<string, string>, currentLiveSlotHash: string): Promise<{ mode: string, assetIds: string[], environment: string }> {

        // 1. Comparison Mode (Array spanning)
        if (queryParam.compare) {
            const hashes = queryParam.compare.split(',');
            return {
                mode: 'comparison',
                assetIds: hashes,
                environment: 'preview'
            };
        }

        // 2. Single Ticket Preview (Staging Override)
        if (queryParam.preview_ticket) {
            // Pseudo-DB resolution mapping ticket UUID -> internal Hash array
            const ticketHash = await AssetRegistry.getHashFromTicket(queryParam.preview_ticket);
            return {
                mode: 'preview',
                assetIds: [ticketHash],
                environment: 'preview'
            };
        }

        // 3. Native Live Production
        return {
            mode: 'live',
            assetIds: [currentLiveSlotHash],
            environment: 'live'
        };
    }
}
