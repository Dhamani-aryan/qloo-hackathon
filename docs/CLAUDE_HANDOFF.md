# COMMON GROUND: Claude handoff and implementation plan

Prepared October 18, 2026. The user has asked Codex to stop implementation and let Claude finish.

## Start here

There is already a substantial **uncommitted local implementation**. Review `git diff` and untracked files before writing code. Do not discard or recreate this work blindly. Nothing from this revision has been committed, pushed or deployed by Codex. The public Vercel app can therefore still show the earlier experience.

Keep the existing ChatGPT subscription provider, credential storage, authentication and refresh implementation. The user explicitly wants that retained. Do not replace it with API-key billing or another provider.

Read `AGENTS.md`, relevant bundled Next.js documentation, `IMPLEMENTATION.md`, and the October 17 entry in `docs/DECISIONS.md`. The revised product plan is `common_ground_research_and_plan.md` revision 4.0. This handoff distinguishes tested implementation from remaining work; older inventory and evaluation results are historical.

## Product direction

Make this an organizer's decision tool, not just a polished recommendation report. The organizer should be able to supply two taste profiles and practical constraints, understand why a cultural bridge is credible, choose it, shape a specific recurring program, and identify what needs checking before inviting anyone.

Qloo must change the actual decision and activities. It should not merely provide a list of names that a model pastes into a generic workshop template. Equally, Qloo affinity is not evidence of venue availability, price, accessibility, age suitability or likely attendance.

## Already implemented locally: review and preserve

### Intake and UI

- Empty custom start; examples are an explicit choice rather than an automatic demo run.
- Entity-type selection including video games, visible type labels and match descriptions, explicit confirmation of ambiguous matches, duplicate protection, and Unicode-safe matching.
- Structured activity, discovery, cost, audience, group-size, venue and access preferences (`src/lib/planning.ts`, `planning-settings.tsx`).
- Three result views: Choose a bridge, Shape the program, Prepare to run it. Detailed agent traces and technical evidence are progressively disclosed.
- Retrieved descriptions, separate relative cultural ranks and heuristic activity fit, and a direct Build around this bridge action.
- Delivery checklist for venue, costs, access/audience and media rights. Confirmations persist across result tabs for the same program, but reset for a different program or refresh.
- Invitations visibly remain drafts. Invitations for the original program are hidden after changing its bridge, rather than being shown as if they matched the replacement.
- More honest model-only comparison: same constraints, unique anchors, preserved titles containing commas/ampersands, and provenance counts rather than claims of proven superiority.
- Stream cancellation/stale-event handling, clamped elapsed time and clearer completion states.

### Backend and recommendation quality

- A strict bilateral evidence gate; no weak fallback just to fill three cards. Singleton percentile normalization no longer makes one result look perfect.
- Familiar/balanced/exploratory discovery changes scoring. Removed the arbitrary local-place score bonus. Activity-fit ordering is explicit and separate from Qloo affinity.
- Descriptions and useful category tags enter the evidence brief. Only strong alternatives may anchor generated sessions.
- Explicit settings become rules, including all-ages restrictions, even if the model misses them while interpreting organizer notes.
- One logical Qloo call budget across investigation rounds, with in-run memoization. Existing bounded transport retries remain separate.
- Generation prompts require anchor-specific properties, honor an existing venue, and flag unverified costs, permissions and access. Stronger exact-title guards and internal-reference cleanup.
- Regeneration accepts a server-held evidence handle (`briefId`, 24-hour lifetime), not arbitrary client-authored evidence.
- Replay cache release is `run:v4-grounded-planning`; settings affect the key. Failed, warning-bearing or guard-altered results are not promoted into demo replays.
- Cache-warming output no longer claims a live run was cached without knowing that.

## Verification completed by Codex

- 176 tests passed across 29 test files after the main implementation.
- Production build passed with Next.js 16.3.8.
- Typecheck and lint passed before the final small browser timeout/copy edits. Formatting subsequently passed; rerun all final checks because not every tiny follow-up was included in the same check batch.
- Browser-tested a custom empty start and Hollow Knight resolving as a video game.
- Browser-tested a full live scenario: make something together, free to participants, all ages, 20 people, existing library room, step-free access/captions/no personal devices. It completed in roughly 90 seconds and produced specific story, music/rhythm and puzzle activities with in-room alternatives and confirmations.
- Browser-tested changing from Somebody Somewhere to High Fidelity: a rebuilt four-session plan appeared with the new anchor.
- Browser-tested checklist persistence across tabs and the model-only comparison view. Original invitations were not incorrectly reused for the replacement plan.

These are functional observations, not evidence that real participants prefer the output or that events will succeed. The historical evaluation does not validate the revised ranking.

## Remaining work, in priority order

### 1. Stabilize the existing diff before adding features

Read the changed code and tests end-to-end. Check schema compatibility, absent/default settings, stored replay behavior and the server-held brief flow. Ensure no real Qloo response or credential enters Git. Preserve the provider/auth files.

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Check final formatting on changed source and tests. Avoid running a production build into the same `.next` directory while an important dev-server request is in flight; earlier local regeneration overlapped a build and made timing hard to interpret. Reuse user-owned servers; do not kill an unknown process on port 3005.

Acceptance: clean checks, no unexpected provider/auth changes, no secrets or real Qloo fixtures in the staged diff, and a clearly understood set of changes.

### 2. Finish production-mode end-to-end testing

Use a stable production server on a free port after building, or the eventual deployment. Codex attempted warming both examples against port 3010, but did not verify final completion or cache persistence before handoff. Do not report them as warmed.

Test these paths:

1. Custom input with ambiguous title, explicit type selection, failed resolution/retry and keyboard-only submission.
2. Both built-in examples: complete a fresh run and then verify an actual replay, not merely an HTTP 200.
3. Same favorites with different activity, novelty and existing-venue settings: verify meaningful differences and separate cache keys.
4. Very little common ground: return fewer bridges or an honest insufficient-evidence state, not filler.
5. Alternate bridge: correct primary anchor, pending/loading state, retry after error, no stale invitations or checklist confirmations.
6. Downloaded plan includes practical caveats and pending delivery checks. Printing should remain usable.
7. Stop a run, edit inputs and start another: old events must not corrupt the new result.
8. Expired or forged evidence handle: reject before model generation, with a useful message.
9. Participant join links and organizer import: these existing features need regression testing; they were not retested in the revised UI pass.
10. Narrow mobile and wide desktop layouts, long group/entity names, focus visibility, disabled controls and native select accessibility.

Acceptance: record actual observed outcomes, errors and timings. Fix failures; do not mistake a generated draft for a validated booking.

### 3. Address the remaining UX weaknesses

- Alternate-bridge generation can take a noticeable time. The current UI shows Building this program and has a browser request timeout. Measure production behavior against the route's 120-second limit. Improve progress/error recovery at the application layer without rewriting subscription authentication. Consider returning the guarded first draft if optional critique cannot finish within a bounded deadline.
- The non-selected bridge's disabled helper currently says it is available when analysis finishes even while another bridge is rebuilding. Use the actual busy state for accurate helper text.
- After rebuilding a program, invitations are hidden for correctness but not regenerated. Add an explicit Generate invitations for this version action only if time permits; tie its result to the exact program version and server-held evidence. Otherwise explain why earlier invitations are unavailable.
- The expanded bridge evidence can still be long on a phone. Keep the decision summary and primary action easy to find; collapse deeper evidence without hiding limitations.
- Audit all copy: relative ranks are not probabilities, activity fit is a heuristic, free participation is a requirement rather than a verified price, and checked references do not verify all prose.

Do not turn this into another wholesale visual redesign. The current restrained visual language is usable; improve hierarchy, clarity and task completion first.

### 4. Validate whether Qloo materially improves the product

Rerun the existing evaluation under revised scoring. Preserve older results as historical and distinguish deterministic integrity checks from human judgments. Do not tune exclusively to the demo seeds.

Add cases for: mismatched groups, sparse profiles, familiar versus exploratory preference, all-ages media, an existing venue/no outings, free-to-participants constraints, obscure/non-Latin titles and an unfamiliar city. Verify no weak anchor enters a plan and no venue facilities are inferred from its name.

Compare with the same model given exactly the same favorites, notes and settings but no Qloo. Score actual activity specificity, relevance to both profiles, constraint compliance, surprising-but-defensible discovery and feasibility—not just citation counts. Ask a few real organizers to choose between blinded proposals and explain why. Mark human evaluation pending until it actually happens.

Acceptance: publish measured results with failure cases and limitations; no invented preference or cohesion claims.

### 5. Publish and verify the hackathon submission

Once checks and live paths pass, make meaningful Conventional Commits, push through the existing repository/Vercel pipeline, and verify the deployed URL directly. Warm the new cache release only with clean results and verify replay. Do not deploy credentials or raw Qloo data.

Submission checklist:

- Public working end-to-end demo: https://qloo-hackathon-inky.vercel.app
- Public source repository: https://github.com/Dhamani-aryan/qloo-hackathon
- Open-source license file recognized by the repository About section.
- Accurate setup instructions, including the unchanged subscription-based model integration.
- Clear description: who the organizer is, what decision the agent makes, which parts depend on Qloo, and what still requires human confirmation.
- Current screenshots and honest evaluation evidence. A demo video is not required by the supplied challenge statement.

## Suggested message to Claude

> Read docs/CLAUDE_HANDOFF.md and review the existing uncommitted diff before changing anything. Finish the remaining work in priority order, starting with stabilization and production-mode browser tests. Keep the current ChatGPT subscription/auth implementation unchanged. Improve the organizer workflow and backend reliability without adding speculative features. Preserve existing work, report concrete failures, run the checks, then commit and publish through the existing Vercel setup after verification. Do not claim human preference validation unless real people have evaluated it.
