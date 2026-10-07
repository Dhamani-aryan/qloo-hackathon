/**
 * Live check that the ChatGPT-subscription LLM works.
 *
 *   npm run spike spike/00-llm-ping.ts
 */
import { getLlm } from "../src/lib/llm";

async function main() {
  const llm = getLlm();
  console.log(`Provider: ${llm.provider} · model: ${llm.model}\n`);
  const r = await llm.generateText({
    system: "You are a terse assistant.",
    prompt: "Reply with exactly the words: common ground works",
  });
  console.log(`Reply: ${r.text.trim()}`);
  console.log(
    `Took ${r.ms}ms · tokens in/out: ${r.usage?.inputTokens ?? "?"}/${r.usage?.outputTokens ?? "?"}`,
  );
}

main().catch((err) => {
  console.error(`✘ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
