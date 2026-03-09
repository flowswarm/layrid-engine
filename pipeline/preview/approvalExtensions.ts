/**
 * 5. ARCHITECTURE EXTENSION NOTES (APPROVAL LINKS)
 * ------------------------------------------------------------------
 * The `ClientApprovalManager` securely delegates the workflow layer to the frontend.
 * Because the token transmits structured state alongside the Mesh Data, it empowers
 * advanced comparison frameworks natively inside the web client.
 */

// EXTENSION 1: MULTI-ASSET COMPARISON LINKS (A/B POLLING)
//
// When an agency generates 3 logo variants, they shouldn't send 3 emails.
// We expand the schema to accept: `candidateAssetIds: z.array(z.string().uuid())`.
// The Normalizer sees the array, and injects all 3 URLs into `webglCtx`.
// The Vue Frontend boots a Carousel or a Split-Screen 3D Viewer.
// The Client clicks [Approve Version B].
// `submitClientDecision(token, 'approve', { selectedAssetId: 'var-b' })`

// EXTENSION 2: SIDE-BY-SIDE REVIEW (LIVE vs CANDIDATE)
//
// Currently, `ApprovalLinkSchema` stores `baseLiveAssetId`.
// Nuxt can detect if `__approvalState.baseLiveAssetId` exists.
// If true, the Vue App splits the screen 50/50:
// [Left Viewport]: webglCtx.centerpieceSource (The New Matte Asset)
// [Right Viewport]: webglCtx.__approvalState.baseLiveAssetId (The Old Chrome Asset)
// The Canvas controls sync together (rotating left model rotates right model).
// The client has total confidence in exactly what changed physically before hitting Approve.

// EXTENSION 3: STAGED CLIENT SIGNOFF (MULTI-TIER APPROVAL)
//
// To support an enterprise hierarchy (e.g. Agency Lead -> Brand Manager -> CEO):
// Expand `ApprovalLinkSchema.status` to include: `awaiting-creative-director`, `awaiting-client`.
// The link routing logic remains identical, simply updating the state machine.
// No WebGL or CMS rewrite is ever needed. The web renderer remains completely agnostic.
