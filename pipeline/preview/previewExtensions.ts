/**
 * 5. ARCHITECTURE EXTENSION NOTES (PREVIEWS)
 * ------------------------------------------------------------------
 * Because `PreviewSessionManager` acts as an ephemeral override layer,
 * it perfectly positions the engine for advanced deployment hooks.
 */


// EXTENSION 1: CLIENT APPROVAL LINKS
//
// Currently, `promoteToLive` requires an Admin ID. To support direct client sign-off:
// 1. Send the `?preview_token=uuid` link to the client.
// 2. Nuxt renders the `__isPreviewSession: true` flag.
// 3. A Vue component `ClientApprovalBanner.vue` detects this flag and renders
//    [Approve & Go Live] | [Request Changes].
// 4. Clicking Approve fires an API hitting `previewManager.promoteToLive()`.
// Result: 100% automated self-serve asset updates for enterprise clients.

// EXTENSION 2: SPLIT A/B TESTING (COMPARISON MODE)
//
// Instead of a single token, generate a `SplitTestSession`.
// 1. Admin generates `SplitTestSession(chromeAssetId, glassAssetId)`.
// 2. Modifies `normalizeSectionData`:
//    `if (Math.random() > 0.5) targetAssetId = glassAssetId else targetAssetId = chromeAssetId;`
// 3. Embed metrics hooks directly inside the Vue components tracking Time-To-Click.
// Result: Completely headless 3D asset optimization without needing an external service.

// EXTENSION 3: SIDE-BY-SIDE METADATA COMPARISON UI
//
// When an Admin previews an asset, they often need to know exactly how it
// differs from Production.
// Add a function `previewManager.getComparisonData(token)`.
// Returns:
// {
//   live: { preset: 'chrome', size: '2mb', generatedAt: '...' },
//   preview: { preset: 'matte', size: '1.2mb', generatedAt: '...' }
// }
// The Nuxt admin layer can render a split-screen 3D view natively loading both.
