# COMMON GROUND (Qloo Agentic Hackathon 2026)

**Start here in every new session:** read the **"Current status"** section at the top of `IMPLEMENTATION.md`. It says what's done, what works, known issues, how to set up keys, and the next step.

- Product plan: `common_ground_research_and_plan.md` (Revision 3.0)
- Build manual: `IMPLEMENTATION.md`. When asked to "implement step X.Y", "implement track N" or "continue", follow the session procedure at the top of that file (the next step is named in "Current status").
- Commit in small, meaningful Conventional Commits while working (rules in `IMPLEMENTATION.md`). After each step: tick the progress tracker, update "Current status", commit, and push.
- Record any deviation from the plan or spec in `docs/DECISIONS.md`.
- Never commit secrets: the Qloo key lives in `.env.local`, the ChatGPT sign-in in `.secrets/`. Never expose the Qloo key client-side.
- Never commit real Qloo responses (Qloo's terms). Use git-ignored `spike/out/`; committed fixtures are synthetic.
- The LLM must never invent cultural entities. Every entity shown to users must come from Qloo via the evidence ledger.

@AGENTS.md
