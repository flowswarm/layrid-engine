/**
 * 5. ARCHITECTURE & EXTENSION NOTES
 * ------------------------------------------------------------------
 * The ApprovalWorkflowEngine isolates "Physical Storage" (AssetRegistry)
 * from "Business Rules" (Publishing States). This allows immense growth
 * without breaking the runtime rendering code.
 */

// FUTURE SUPPORT:
//
// 1. Multi-step Approvals & Team Review
//    Because `WorkflowStateEnum` explicitly separates `generated` -> `review` -> `approved`:
//    You can simply add states like `internal_review`, `client_review`, `legal_review`.
//    The WebGL Engine completely ignores these states, so you can change the approval
//    process arbitrarily without breaking the frontend.
//
// 2. Scheduled Publishing
//    Right now `publishAsset()` is immediate.
//    To support scheduling, add a `scheduledPublishAt?: Date` field to `PublishingManifestSchema`.
//    A simple chron-job (or AWS EventBridge) can wake up, check `if (now > scheduledPublishAt)`,
//    and execute `workflowEngine.publishAsset(id)`.
//
// 3. Compare Chrome Vs Matte Variant (A/B Testing)
//    Instead of `targetSceneRole: 'hero-centerpiece'`, you could add a concept of an
//    "A/B Slice". The Content Normalizer could ask:
//    `getLivePublishedAsset(clientId, 'hero-centerpiece', userCohort)`
//    Returning Chrome for Cohort A and Matte for Cohort B instantly, using the exact
//    same rendering code under the hood.
//
// 4. Rollback to Previous Live Asset
//    Every publish event archives the previous competitor.
//    To "Rollback", the Admin UI simply looks up the most recently archived asset
//    for that `clientId` and `sceneRole`, and re-calls `publishAsset(oldId)`.
//    The engine handles demoting the current mistake cleanly.
