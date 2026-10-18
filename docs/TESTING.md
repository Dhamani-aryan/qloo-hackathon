# Testing Common Ground

## Local checks

From the repository directory:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Tests use synthetic data. Real Qloo output, credentials and evaluation packets must stay out of Git.

For browser checks, configure `.env.local` and the existing ChatGPT sign-in as explained in [README](../README.md) and [deployment](DEPLOY.md). Start a local server:

```bash
node node_modules/next/dist/bin/next dev -p 3005
```

If a server is already running, reuse it. Do not interrupt another session's server or start another development process against the same Next.js output directory.

## Browser checklist

| Check | Action | Expected |
| --- | --- | --- |
| Custom start | Open the app | Empty groups, explicit example buttons, practical preferences; no automatic seed queries |
| Game resolution | Add Hollow Knight without specifying a type | Video game is available; competing exact-name types require a choice |
| Type selection | Select Games before adding a favorite | Search is restricted to games |
| Ambiguity | Add a title shared by several types or editions | Inspect descriptions and choose; analysis remains blocked while a resolved match is unconfirmed |
| Invalid input | Add a made-up title | A not-found or unsure result; remove or correct it |
| Minimum seeds | Supply fewer than three confirmed favorites on one side | Analysis remains disabled with a useful message |
| Example | Load Campus ↔ City | Seeds resolve with visible entity types and New York City |
| Constraints | Choose making, free, mixed ages, 20 people, existing library room, captions | The plan receives all settings; no need to repeat them in notes |
| Live analysis | Run a new case | Real progress, expandable decisions, bridges followed by a draft; no negative timer |
| Bridge evidence | Inspect the first option | Qloo description, per-group relative ranks, input contributors, separate activity-fit judgment and unverified details |
| Alternate bridge | After completion, choose Build around this bridge on another option | Server-held evidence is used, new program opens, outdated invitations are hidden |
| Program specificity | Read all sessions | Activities depend on described properties of their anchors; venue names do not imply facilities or architecture |
| Delivery | Open Prepare to run it | Cultural reference checks are separate from unresolved access, cost, permissions and suitability |
| Confirmations | Check a delivery item, switch views and return | The check stays for this program; replacement/refresh resets it |
| Export | Download the program | Markdown includes anchors, roles, delivery details, unresolved checks and limitations |
| Invitations | Inspect both messages | Drafts with dates/details to confirm; no visible internal entity refs or redaction placeholders |
| Model comparison | Expand the comparison | Same organizer constraints, unique-entity counts, complete titles; provenance is not presented as measured quality |
| Replay | Repeat an eligible clean run unchanged | Saved-run label and a Run it live option |
| Stop/restart | Stop a run, then start another | Old events do not overwrite the new run |
| Insufficient evidence | Use sparse, dissimilar profiles | No weak candidate is promoted merely to fill the result list |
| Participant intake | Create links, contribute synthetic favorites, import | Aggregate picks populate the profiles; configured Redis persists them |
| Mobile/accessibility | Use a narrow window and keyboard navigation | Readable labels, no sideways page scrolling, visible focus and operable native controls |

## API regression checks

- `/api/program` rejects browser-supplied evidence and requires `briefId` from a completed analysis.
- Expired handles return HTTP 410 without calling the model.
- Existing invalid-input, rate-limit, busy-Qloo and cancellation tests remain green.
- MCP `tools/list` exposes `find_common_ground`; a real client call is a separate integration check.

## Live evaluation

```bash
npm run spike eval/run.ts
npm run spike eval/report.ts
```

These commands use real service quota. The historical October 17 evaluation predates the organizer revision and is marked accordingly. New scores, prompts, anchor eligibility and comparison counts need a new evaluation. Treat previously inspected cases as development cases and add new unseen profiles before claiming generalization. Collect blind organizer ratings separately.

After deployment, warm eligible examples:

```bash
npm run warm -- https://qloo-hackathon-inky.vercel.app
```

A live run finishing does not by itself prove it was cached; guard-altered or incomplete outputs are deliberately excluded.
