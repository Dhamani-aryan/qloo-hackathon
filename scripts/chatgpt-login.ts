/**
 * One-time sign-in so COMMON GROUND can use your ChatGPT subscription as its LLM.
 *
 *   npm run llm:login
 *
 * Prints a code and a URL. Open the URL, sign in to ChatGPT, enter the code.
 * The credential is saved to CHATGPT_AUTH_FILE (default .secrets/chatgpt-auth.json, git-ignored)
 * and refreshed automatically afterwards.
 */
import { getLlmEnv } from "../src/lib/env";
import { loginWithDeviceCode, saveCredential } from "../src/lib/llm/chatgpt-auth";

async function main() {
  const { chatgptAuthFile } = getLlmEnv();
  console.log("Starting ChatGPT sign-in...\n");
  const credential = await loginWithDeviceCode(({ userCode, verificationUrl }) => {
    console.log(`1. Open:  ${verificationUrl}`);
    console.log(`2. Enter this code:  ${userCode}\n`);
    console.log("Waiting for you to finish in the browser (up to 15 minutes)...");
  });
  saveCredential(chatgptAuthFile, credential);
  console.log(`\nSigned in. Credential saved to ${chatgptAuthFile} (git-ignored).`);
  console.log("Test it with: npm run spike spike/00-llm-ping.ts");
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
