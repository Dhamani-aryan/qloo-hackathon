# Testing Common Ground yourself

Read [HOW_IT_WORKS.md](HOW_IT_WORKS.md) first if you haven't. This guide has three levels:

1. **Start the app** (2 minutes)
2. **Click-through test cases**: what to do, and what you should see
3. **Automated and terminal checks** (optional, for the code side)

Tick each case as you go. If anything differs from "Expected", note the case ID and what you saw.

---

## 1. Start the app

Open a terminal in `G:\Quillo app` and run:

```bash
npm run dev -- -p 3005
```

Wait for `Ready`, then open **http://localhost:3005** in Chrome. Keep the terminal open: closing it stops the site.

You need two things, both already set up on this computer:
- the Qloo key in `.env.local`;
- the ChatGPT sign-in in `.secrets/`.

To check them, open a second terminal in the same folder and run each of these. You should see "All checks passed" and then "common ground works".

```bash
npm run spike spike/00-ping.ts
```

```bash
npm run spike spike/00-llm-ping.ts
```

> **Good to know**
> - The first run of a scenario is **live** (about 70 s). Repeating it is **instant** (about 3 s) because it's cached. The cache is wiped whenever you restart the server.
> - You can do 5 **live** runs per 10 minutes. Cached replays don't count.

---

## 2. Click-through test cases

### A. The main example (do this first)

| ID | Do this | Expected |
|---|---|---|
| A1 | Open the site. | **Find common ground**, with two boxes side by side: *Group 1* (blue) and *Group 2* (orange). They're pre-filled with the **Campus ↔ City** example: 8 favourites each, shown as chips with pictures. The City field says *New York City*. |
| A2 | Click **Find common ground →**. | The results page: "Finding common ground…", one progress line with a timer, a **Stop** link and a bar. |
| A3 | Wait about 20–30 s. | The title changes to **"Their common ground"** and the bridges appear while the plan is still being written ("Writing a 4-session plan…"). |
| A4 | Look at the top. | Left: **What everyone likes** (a very famous pick). Right: **What these two groups share** (less mainstream, still strong for both groups). One sentence underneath explains the difference. |
| A5 | Look at the bridge list. | Up to 3 rows, each a **different kind** (e.g. Place, TV show, Book), with a score out of 100. |
| A6 | Click any row. | It expands. **Linked to these favourites** shows Group 1's favourites in blue and Group 2's in orange. **How to use it** has an activity idea, plus a **Watch out** note. Under it, **Qloo evidence** shows the raw records. |
| A7 | Open **More: shared themes, other ideas, what was ruled out**. | Shared themes, "Also in the running", and **Rejected** with counts and reasons. |
| A8 | Scroll down to the plan (about 70 s after the start). | "Your 4-session plan · built on …", a title, and **4 sessions**. Sessions 1–3 are each built on a Qloo item (with its picture); session 4 is "Both groups make something together". It also says **"✓ Every session is built on real Qloo data"**. |
| A9 | Open **Who does what** on a session. | What Group 1 does and what Group 2 does. They should be **different**. |
| A10 | Scroll to **Why Qloo matters**. | Three big numbers. **With Qloo** should win on "backed by both groups' data" and "evidence citations", and have 0 "unverified guesses". **Compare the two plans session by session** shows the AI-alone plan, with its picks greyed (just your favourites reused) or amber (made up). |
| A11 | Click **Download** near the plan. | A `.md` file of the plan downloads. |
| A12 | Below the progress line, open **How it got here**. | The steps, each kind searched (with 4 bars each) and a short activity log. |

### B. Speed and replay

| ID | Do this | Expected |
|---|---|---|
| B1 | Click **← New search** (top right) or the logo. | You're back on the home page with the same groups. The top right now says **Last result →**, which takes you back. |
| B2 | Click **Find common ground →** again without changing anything. | It finishes in about **3 seconds**, with a note: "Shown instantly from a saved run. **Run it live**". |
| B3 | Click **Run it live**. | A real run starts again (about 70 s). The bridges should be **the same**; only the plan wording changes. |
| B4 | Start a run and click **Stop** after about 5 s. | "Stopped. Run again". Nothing else happens. |

### C. Changing the groups

| ID | Do this | Expected |
|---|---|---|
| C1 | Under the boxes, click **Jaipur Craft Futures**. | The boxes fill with Indian artists and films (Prateek Kuhad, Lata Mangeshkar…) and the pictures load. Run it: bridges like local Jaipur places and Indian TV shows. Under **More → Rejected** some items are removed as *sensitive topic* (religion or politics); that's intended. |
| C2 | On Campus ↔ City, click **×** on six of Group 2's chips. | With fewer than 3 left, the line under the button says "Add 1 more favourite for …" and the button is **disabled**. |
| C3 | In Group 1's box, type **Radiohead** and press Enter. | A chip with a spinner, then the real Radiohead with a picture. |
| C4 | Add **Shogun** to a group. | The chip has a small amber **?**: several titles share this name. Click the **?** (or the name) to see the options and pick one. |
| C5 | Add something made up, e.g. **zzqxv flarn**. | The chip turns amber and says "not found" (or shows a clearly wrong match with a **?**). Click **×**. |
| C6 | Click **Clear**. | Both boxes and the city are empty. The line under the button asks for favourites, then a city. |
| C7 | Click a group's name (e.g. "Group 1") and type a new one. | The new name appears on the results page, in the bridge rows, the plan roles and the comparison. |

### D. Your own scenarios (the fun part)

Click **Clear**, name the groups, add the favourites (3–8 each), set the city, and run. Results vary because they come from live data. Instead of exact answers, check the **"What to check"** column.

| ID | Group 1 | Group 2 | City | What to check |
|---|---|---|---|---|
| D1 | *Skaters & streetwear*: Tyler, the Creator · Frank Ocean · Mid90s (film) · Skins (TV) | *Jazz society*: Ella Fitzgerald · Miles Davis · Casablanca (film) · Jeeves and Wooster (TV) | London | Bridges aren't just "the most famous film ever". Places are in London. Each bridge's "Linked to" shows favourites from **both** groups. |
| D2 | *Teen gamers*: Hollow Knight · Celeste · Stardew Valley · Studio Ghibli fans: Spirited Away (film) | *Book club*: Pride and Prejudice · The Hobbit · Little Women (film) · Downton Abbey (TV) | Chicago | Fantasy / cosy themes show up in **Shared themes**. The plan gives the two groups different roles. |
| D3 | *Mumbai college film club*: Gully Boy · Sacred Games (TV) · Prateek Kuhad · Arijit Singh | *Classical music circle*: Ravi Shankar · Zakir Hussain · Pather Panchali (film) · Malgudi Days (TV) | Mumbai | Local Mumbai places appear. Religious or political titles appear in **Rejected** rather than as bridges. |
| D4 | Give **both groups the same 4 favourites**. | (same) | New York City | Bridges are things both rank highly. "What everyone likes" is still very mainstream. Good for checking the logic isn't broken. |
| D5 | Two very different groups with only 3 niche favourites each. | | any | You may get **"No strong common ground this time."** That's correct behaviour: the app refuses to invent a bridge rather than faking one. |

### E. Participant links

| ID | Do this | Expected |
|---|---|---|
| E1 | On the home page, click **Let each group add their own** (under the boxes), then **Create the two links**. | Two links, one per group (blue and orange dots), each with **Copy**. A note says responses reset when the server restarts. |
| E2 | Open Group 1's link in a new browser tab on this computer (phones can't reach it until the app is deployed). | "What do you love?" with 3 numbered slots. |
| E3 | Type **Mitski** → **Find** → pick the artist → repeat for 1–2 more → **Share**. | "Thank you." with a note that only titles are counted. |
| E4 | Repeat E2–E3 on Group 2's link with different favourites. | Same thank-you. |
| E5 | Back on the first tab, click **Import responses**. | Each group's box is replaced by the submitted picks. |

### F. Look and feel

| ID | Do this | Expected |
|---|---|---|
| F1 | Shrink the browser to phone width, or use Chrome DevTools → device toolbar. | The two boxes stack into one column, with no sideways scrolling. |
| F2 | Switch your computer to **dark mode**. | Dark background, light text, and the blue/orange/purple colours still readable. |
| F3 | Use **Tab** on the keyboard to move through the home page. | A visible purple outline shows where you are. |

### G. Error handling (optional, slightly technical)

| ID | Do this | Expected |
|---|---|---|
| G1 | Stop the server (Ctrl+C), change one letter of `QLOO_API_KEY` in `.env.local`, start it again, and load the page. | Favourites show "couldn't reach Qloo", with a **Retry** link. **Change the key back afterwards and restart.** |
| G2 | Do 6 **live** runs within 10 minutes (use **Run it live**). | The 6th says "Too many requests. Please try again in about … minute(s)." |

---

## 3. Automated and terminal checks (optional)

All of these run from `G:\Quillo app`.

| Command | What it does | Expected |
|---|---|---|
| `npm test` | 125 automated tests using fake data (no real API calls). | `Tests 125 passed` |
| `npm run typecheck` | Checks the code for type errors. | No errors |
| `npm run lint` | Checks code style and common mistakes. | No errors or warnings listed |
| `npm run build` | Builds the production version. | `Compiled successfully` |
| `npm run spike spike/run-engine.ts` | Runs **only the Qloo bridge engine** for the NYC example in the terminal (no AI). | 3 discovered bridges, the obvious bridge, shared themes, rejection counts, "every bridge traced to ledger: true". |
| `npm run spike spike/run-agent.ts` | Runs the **whole agent** in the terminal with a timeline. | Each step with timings, then the plan and the AI-alone version. |

Run each command on its own, for example:

```bash
npm test
```

---

## What to report back

For anything that looks wrong or confusing, note:
1. the **case ID** (e.g. A7);
2. what you **expected**;
3. what you **saw** (a screenshot helps);
4. whether it happens again if you repeat it.
