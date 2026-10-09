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
| A1 | Open the site. | Headline "What would two groups love doing together?", a 3-step strip, and **Campus ↔ City** underlined. Two lists: *University film & music club* (8 items) and *Neighbourhood arts association* (8 items), with pictures. The bottom bar says **"16 favourites added. Ready when you are."** |
| A2 | Click **Find common ground →**. | The **Search** screen: "Finding common ground…", a timer counting up, and steps ticking off. The "What it's searching" table fills in (Artist, Book, Place, Film, TV show), each with 4 bars. |
| A3 | Wait about 30 s. | **"See the bridges →"** appears even before the plan is finished. |
| A4 | Wait until the title says **"Found it."** (about 70 s). | All 6 steps ticked. "Also writing a version without Qloo… Done." |
| A5 | Click **See the bridges →**. | "Here's what they share." Left: **What everyone likes** (a very famous pick; its *Mainstream* bar is nearly full). Right: **What these two groups share** (a less mainstream pick; its *Mainstream* bar is clearly shorter). |
| A6 | Look at **Top 3 bridges**. | Three rows, each from a **different kind** (e.g. Place, TV show, Book), with a score out of 100. The first row is open. |
| A7 | Click any row. | It expands. **Linked to these favourites** shows a blue line (Group 1's favourites) and an orange line (Group 2's). **How to use it** has an activity idea, plus a **Watch out** note. |
| A8 | In an open row, click **Qloo evidence**. | A list of `ev_…` records showing **A+B**, **A** and **B** results with affinity scores and percentiles. This is the raw proof. |
| A9 | Click **More details…** below the list. | Shared themes (e.g. "Personal growth: *Lady Bird* ↔ *Joni Mitchell*"), "Also in the running", and **Rejected** with counts and reasons. |
| A10 | Click **See the plan →**. | "Your plan · built on …", a title, and **4 sessions**. Sessions 1–3 each show a picture of the Qloo item they're built on; session 4 says "Both groups make something together". The small text **"✓ Every session is built on real Qloo data"** is shown. |
| A11 | Click **Who does what** on a session. | The full description, plus two short blocks: what Group 1 does (blue dot) and what Group 2 does (orange dot). They should be **different** from each other. |
| A12 | Open **Practical details** and **How the AI improved its first draft**. | Venue, access and success measures. Then a list of what the review pass fixed (often "Interchangeable roles"). |
| A13 | Scroll to **Why Qloo matters**. | A headline starting "Without Qloo, …" and three big numbers. **With Qloo** should win on "backed by both groups' data" and "evidence citations", and have 0 "unverified guesses". |
| A14 | Open **Compare the two plans session by session**. | Left: sessions built on Qloo finds. Right: the AI-alone plan, its picks greyed (just your favourites reused) or amber (made up without evidence). |
| A15 | Click **Download**. | A `.md` file of the plan downloads. |

### B. Speed and replay

| ID | Do this | Expected |
|---|---|---|
| B1 | Click the **Common Ground** logo (top left). | You're back on the first screen. The top bar still lets you jump to Search, Bridges or Plan. |
| B2 | Click **Find common ground →** again without changing anything. | It finishes in about **3 seconds**, with a note: "Shown instantly from a saved run (…s live). **Run it live**". |
| B3 | Click **Run it live**. | A real run starts again (about 70 s). The bridges are usually the same; the plan wording changes. |
| B4 | Start a run and click **Stop** after about 5 s. | "Stopped. Run again or edit the profiles." Nothing else happens. |

### C. Changing the groups

| ID | Do this | Expected |
|---|---|---|
| C1 | Click **Jaipur Craft Futures**. | The lists change to Indian artists and films (Prateek Kuhad, Lata Mangeshkar…) and the pictures load. Run it: bridges like local Jaipur places and Indian TV shows. In **More details → Rejected** you'll see items removed as *sensitive topic* (religion or politics), which is intended. |
| C2 | On Campus ↔ City, hover a favourite and click **Remove** on three of Group 2's items. | The count drops. With fewer than 3 left, the bottom bar says "Add 1 more favourite for …" and the button is **disabled**. |
| C3 | In Group 1, type **Radiohead** in "+ Add a favourite" and press Enter. | It briefly shows the name with a dot ("looking up"), then the real Radiohead with a picture. |
| C4 | Add **Shogun** to a group. | It appears highlighted with **"Several titles share this name. Check it's the right one."** and a **Confirm** link. **Change** lists the options (the old series and the remake). |
| C5 | Add something made up, e.g. **zzqxv flarn**. | It shows "no Qloo match" or a clearly wrong match flagged "No exact match". Remove it. |
| C6 | Click **Start blank**. | Both lists are empty with "What does this group love? Add 3 to 8 favourites." The bottom bar asks for favourites and a city. |
| C7 | Still on blank, open **Where and why** and clear the city. | The bottom bar says **"Add a city under 'Where and why'."** and the button stays disabled. |
| C8 | Rename a group (click its big name and type). | The new name appears everywhere: bars, plan roles, comparison. |

### D. Your own scenarios (the fun part)

Use **Start blank**, name the groups, add the favourites (3–8 each), set the city, and run. Results vary because they come from live data. Instead of exact answers, check the **"What to check"** column.

| ID | Group 1 | Group 2 | City | What to check |
|---|---|---|---|---|
| D1 | *Skaters & streetwear*: Tyler, the Creator · Frank Ocean · Mid90s (film) · Skins (TV) | *Jazz society*: Ella Fitzgerald · Miles Davis · Casablanca (film) · Jeeves and Wooster (TV) | London | Bridges aren't just "the most famous film ever". Places are in London. Each bridge's "Linked to" shows favourites from **both** groups. |
| D2 | *Teen gamers*: Hollow Knight · Celeste · Stardew Valley · Studio Ghibli fans: Spirited Away (film) | *Book club*: Pride and Prejudice · The Hobbit · Little Women (film) · Downton Abbey (TV) | Chicago | Fantasy / cosy themes show up in **Shared themes**. The plan gives the two groups different roles. |
| D3 | *Mumbai college film club*: Gully Boy · Sacred Games (TV) · Prateek Kuhad · Arijit Singh | *Classical music circle*: Ravi Shankar · Zakir Hussain · Pather Panchali (film) · Malgudi Days (TV) | Mumbai | Local Mumbai places appear. Religious or political titles appear in **Rejected** rather than as bridges. |
| D4 | Give **both groups the same 4 favourites**. | (same) | New York City | Bridges are things both rank highly. "What everyone likes" is still very mainstream. Good for checking the logic isn't broken. |
| D5 | Two very different groups with only 3 niche favourites each. | | any | You may get **"No bridge this time."** That's correct behaviour: the app refuses to invent a bridge rather than faking one. |

### E. Participant links

| ID | Do this | Expected |
|---|---|---|
| E1 | On the first screen, click **Let each group fill in their own favourites**, then **Create the two links**. | Two links, one per group (blue and orange dots), each with **Copy**. A note says responses reset when the server restarts. |
| E2 | Open Group 1's link in a new browser tab on this computer (phones can't reach it until the app is deployed). | "What do you love?" with 3 numbered slots. |
| E3 | Type **Mitski** → **Find** → pick the artist → repeat for 1–2 more → **Share**. | "Thank you." with a note that only titles are counted. |
| E4 | Repeat E2–E3 on Group 2's link with different favourites. | Same thank-you. |
| E5 | Back on the first tab, click **Import responses**. | Each group's list is replaced by the submitted picks, and "from 1 participant" appears next to the group label. |

### F. Look and feel

| ID | Do this | Expected |
|---|---|---|
| F1 | Shrink the browser to phone width, or use Chrome DevTools → device toolbar. | Everything stacks into one column, with no sideways scrolling. The bottom button stays visible on screen 1. |
| F2 | Switch your computer to **dark mode**. | Dark background, light text, and the blue/orange/purple colours still readable. |
| F3 | Use **Tab** on the keyboard to move through screen 1. | A visible purple outline shows where you are. |

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
