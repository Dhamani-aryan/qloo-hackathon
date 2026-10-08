/**
 * Live check of the LLM steps on a saved engine result.
 *
 *   npm run spike spike/run-engine.ts campus-city-nyc     (once, to save the engine result)
 *   npm run spike spike/run-program.ts [scenarioId] [bridgeRef]
 */
import { buildBrief } from "../src/lib/agent/brief";
import { writeBridgeNotes } from "../src/lib/agent/notes";
import { generateProgram } from "../src/lib/agent/program";
import type { EngineResult } from "../src/lib/engine";
import { getLlm } from "../src/lib/llm";
import { readJson, writeOut } from "./lib";
import { loadScenario } from "./scenario";

async function main() {
  const id = process.argv[2] ?? "campus-city-nyc";
  const bridgeRef = process.argv[3] ?? "B1";
  const scenario = loadScenario(id);
  const result = readJson<EngineResult>(`spike/out/engine-${id}.json`);
  const brief = buildBrief(scenario, result);
  const llm = getLlm();

  let t = Date.now();
  const notes = await writeBridgeNotes(llm, brief);
  console.log(`\nNOTES (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  for (const n of notes) {
    console.log(
      `  ${n.ref}: fit: ${n.activityFit}\n      friction: ${n.mainFriction}\n      vs obvious: ${n.whyBeatsObvious}`,
    );
  }

  t = Date.now();
  const program = await generateProgram(llm, brief, bridgeRef);
  console.log(`\nPROGRAM (${((Date.now() - t) / 1000).toFixed(1)}s): ${program.title}`);
  console.log(`  ${program.format}`);
  for (const s of program.sessions) {
    console.log(
      `  ${s.number}. ${s.title}  [${s.entity ? `${s.entity.name} · ${s.entity.domain}` : "no Qloo anchor"}]${s.theme ? ` theme: ${s.theme.name}` : ""}`,
    );
    console.log(`     ${s.activity}`);
    console.log(`     A: ${s.roles.A}\n     B: ${s.roles.B}`);
  }
  console.log(`  venue: ${program.venueType}`);
  console.log(`  success: ${program.successMeasures.join("; ")}`);
  console.log(`  guard: ${JSON.stringify(program.guard)}`);
  writeOut(`program-${id}.json`, { notes, program });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
