# Deploying Common Ground

The live site runs on **Vercel**. **Upstash Redis** (free tier) holds everything that must survive between requests:
- the run cache, so demo scenarios replay instantly;
- participant links;
- rate limits;
- the ChatGPT-subscription credential.

Steps 1, 2 and 5 need you, because they involve your accounts. Steps 3, 4 and 6 are commands.

---

## 1. Create the Upstash database (you, about 3 minutes)

1. Sign up at **https://upstash.com** (free, no card) and click **Create Database**.
2. Name it `common-ground`, pick the region closest to Vercel's default (`us-east-1`), and keep the free plan.
3. On the database page, open the **REST API** section and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Paste both into `.env.local` in `G:\Quillo app` (the lines already exist, empty).

## 2. Sign in to ChatGPT locally, if needed (you)

If `npm run spike spike/00-llm-ping.ts` replies "common ground works", you're already signed in. Otherwise run `npm run llm:login` and enter the code it shows.

## 3. Move the ChatGPT credential into Upstash (command)

```bash
npm run llm:push-credential
```

Then change `CHATGPT_AUTH_STORE=file` to **`CHATGPT_AUTH_STORE=redis`** in `.env.local`.

> **Why both places must switch:** refresh tokens are single-use. Once the deployed server refreshes the token in Upstash, the copy in the local file stops working. From now on, local development and the live site share the Upstash copy.

Check it still works:

```bash
npm run spike spike/00-llm-ping.ts
```

## 4. Warm the cache with the demo scenarios (command)

With the dev server running locally (`npm run dev -- -p 3005`), which now uses Upstash:

```bash
npm run warm
```

Each prebuilt scenario runs live once (about 70 s each) and is cached in Upstash for 7 days. Every visitor, including the live site, then gets it in about 3 s. Run it again any time; already-cached scenarios are skipped.

## 5. Create the Vercel project (you, about 5 minutes)

1. Sign in at **https://vercel.com** with GitHub.
2. **Add New → Project**, import **`Dhamani-aryan/qloo-hackathon`**, framework preset **Next.js** (detected automatically). Leave the build settings at their defaults.
3. Before clicking Deploy, open **Environment Variables** and add these (values from your `.env.local`):

| Name | Value |
|---|---|
| `QLOO_API_KEY` | your hackathon key |
| `QLOO_BASE_URL` | `https://hackathon.api.qloo.com` |
| `LLM_PROVIDER` | `chatgpt` |
| `LLM_MODEL` | `gpt-5.6-sol` |
| `LLM_REASONING_EFFORT` | `low` |
| `CHATGPT_AUTH_STORE` | `redis` |
| `UPSTASH_REDIS_REST_URL` | from Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash |

4. Click **Deploy**. Every push to `main` now redeploys automatically.
5. In **Settings → Functions**, make sure **Fluid compute** is on (it's the default). A live run streams for about 70–90 s, and the analysis route allows up to 300 s.

## 6. Check the live site (command + browser)

Open the Vercel URL and run Campus ↔ City. Because of step 4, it should finish in about 3 s with the "Shown instantly from a saved run" note. Then click **Run it live** once to confirm live runs work on the server.

To warm the cache through the live site instead:

```bash
npm run warm -- https://YOUR-PROJECT.vercel.app
```

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Not signed in to ChatGPT" or "No ChatGPT credential in the store" | `CHATGPT_AUTH_STORE=redis` but step 3 wasn't run, or the Upstash vars are wrong. Re-run step 3. |
| "Qloo is unavailable: … unauthorized" | Wrong `QLOO_API_KEY` or `QLOO_BASE_URL` in Vercel. |
| Participant links say "Development storage" | Upstash vars missing on that deployment. |
| A live run stops after about 60 s | Fluid compute is off, or the plan limits function duration. Turn it on (step 5.5). |
| "Too many requests" | Rate limit: 5 live runs per 10 minutes per visitor. Replays are unlimited. |
