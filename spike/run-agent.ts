/**
 * Full live agent run (plan → Qloo engine → notes + program → critic, baseline in parallel).
 *
 *   npm run spike spike/run-agent.ts [scenarioId]
 *
 * Writes spike/out/agent-<id>.json (git-ignored: it contains Qloo data).
 */
import { runAgentToCompletion } from "../src/lib/agent/orchestrator";
import { getLlm } from "../src/lib/llm";
import { qloo, writeOut } from "./lib";
import { loadScenario } from "./scenario";

async function main() {
  const id = process.argv[2] ?? "campus-city-nyc";
  const scenario = loadScenario(id);
  const started = Date.now();
  const sec = () => `${((Date.now() - started) / 1000).toFixed(1)}s`.padStart(6);

  const r = await runAgentToCompletion({ qloo: qloo(), llm: getLlm() }, scenario, {}, (e) => {
    if (e.type === "state") console.log(`${sec()}  ▶ ${e.state}`);
    if (e.type === "plan")
      console.log(
        `${sec()}    domains (${e.plan.source}): ${e.plan.domains.map((d) => `${d.domain}: ${d.reason}`).join(" | ")}`,
      );
    if (e.type === "engine_result")
      console.log(
        `${sec()}    engine: ${e.result.status}, ${e.result.stats.qlooCalls} calls, bridges: ${e.result.bridges.map((b) => b.entity.name).join(", ")}`,
      );
    if (e.type === "notes") console.log(`${sec()}    notes for ${e.notes.length} bridges`);
    if (e.type === "program_draft") console.log(`${sec()}    draft: ${e.program.title}`);
    if (e.type === "critique")
      console.log(`${sec()}    critic: ${e.issues.map((i) => i.check).join(", ") || "no issues"}`);
    if (e.type === "baseline")
      console.log(`${sec()}    baseline ready: ${e.baseline?.title ?? "failed"}`);
    if (e.type === "warning") console.log(`${sec()}    WARNING ${e.message}`);
  });

  console.log(`\nSTATUS ${r.status}  timings ${JSON.stringify(r.timings)}`);
  if (r.program) {
    console.log(`\nCOMMON GROUND: ${r.program.title}`);
    for (const s of r.program.sessions) {
      console.log(`  ${s.number}. ${s.title} [${s.entity?.name ?? "no Qloo anchor"}]`);
      console.log(`     A: ${s.roles.A}\n     B: ${s.roles.B}`);
    }
    console.log(
      `  critic issues: ${r.critique.map((i) => `${i.check}: ${i.problem}`).join(" | ")}`,
    );
    console.log(`  guard: ${JSON.stringify(r.program.guard)}`);
  }
  if (r.baseline) {
    console.log(`\nLLM ONLY: ${r.baseline.title} (bridge: ${r.baseline.bridge})`);
    for (const s of r.baseline.sessions)
      console.log(`  ${s.number}. ${s.title} [${s.anchor ?? "-"}]`);
  }
  writeOut(`agent-${id}.json`, r);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
