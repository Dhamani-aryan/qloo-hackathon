/**
 * Copy the local ChatGPT-subscription credential into Upstash so a deployed server can use it.
 *
 *   npm run llm:push-credential
 *
 * Needs UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in .env.local. Afterwards set
 * CHATGPT_AUTH_STORE=redis locally AND on the deployment: refresh tokens are single-use, so
 * once the server refreshes, the old local file stops working.
 */
import { getIntakeEnv, getLlmEnv } from "../src/lib/env";
import { loadCredential } from "../src/lib/llm/chatgpt-auth";
import { createRedisCredentialStore } from "../src/lib/llm/credential-store";

async function main() {
  const { chatgptAuthFile } = getLlmEnv();
  const credential = loadCredential(chatgptAuthFile);
  if (!credential) {
    console.error(`No credential at ${chatgptAuthFile}. Run npm run llm:login first.`);
    process.exit(1);
  }
  const store = createRedisCredentialStore(getIntakeEnv());
  await store.save(credential);
  const back = await store.load();
  if (back?.accountId !== credential.accountId) {
    console.error("Saved, but reading it back failed. Check the Upstash URL and token.");
    process.exit(1);
  }
  console.log("ChatGPT credential stored in Upstash.");
  console.log(
    "Next: set CHATGPT_AUTH_STORE=redis in .env.local and in the Vercel project settings.",
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
