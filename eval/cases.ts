import type { DomainKey } from "../src/lib/engine";
import type { QlooTypeKey } from "../src/lib/qloo";
import type { PlanningSettings } from "../src/lib/planning";

/**
 * Fixed evaluation cases (plan §14): six pairs of communities across different cities and
 * contexts, described ONLY by favourites they might name (names + types; resolved through
 * Qloo at run time, so no Qloo data is stored here). Seeds are hypothetical test inputs.
 *
 * `heldOut` cases must not be used when tuning thresholds or prompts.
 */

export interface EvalCase {
  id: string;
  context: string;
  location: string;
  objective: string;
  heldOut?: boolean;
  /** Organizer notes for the agent, and what following them must look like. */
  notes?: string;
  /** Organizer settings from the home page (activity, discovery, cost, audience, venue). */
  settings?: Partial<PlanningSettings>;
  expect?: {
    skips?: DomainKey[];
    familyFriendly?: boolean;
    placeTheme?: RegExp;
    /** Groups with almost nothing in common: weak overlap or insufficient evidence, no filler. */
    littleOverlap?: boolean;
    /** An existing venue was chosen: no session may send people to a recommended place. */
    stayInVenue?: boolean;
    /** Every favourite must resolve (non-Latin titles). */
    allResolved?: boolean;
  };
  a: { label: string; seeds: [string, QlooTypeKey][] };
  b: { label: string; seeds: [string, QlooTypeKey][] };
}

const OBJECTIVE =
  "Design a four-session recurring program both groups would choose to join and keep coming back to.";

export const CASES: EvalCase[] = [
  {
    id: "nyc-campus-city",
    context: "University ↔ neighbourhood",
    location: "New York City",
    objective: OBJECTIVE,
    a: {
      label: "University film & music club",
      seeds: [
        ["Phoebe Bridgers", "artist"],
        ["Frank Ocean", "artist"],
        ["Tame Impala", "artist"],
        ["Everything Everywhere All at Once", "movie"],
        ["Lady Bird", "movie"],
        ["Atlanta", "tvShow"],
      ],
    },
    b: {
      label: "Neighbourhood arts association",
      seeds: [
        ["Nina Simone", "artist"],
        ["Joni Mitchell", "artist"],
        ["Miles Davis", "artist"],
        ["Cinema Paradiso", "movie"],
        ["Casablanca", "movie"],
        ["Columbo", "tvShow"],
      ],
    },
  },
  {
    id: "london-skate-jazz",
    context: "Youth culture ↔ older enthusiasts",
    location: "London",
    objective: OBJECTIVE,
    a: {
      label: "Skate & streetwear collective",
      seeds: [
        ["Tyler, the Creator", "artist"],
        ["Frank Ocean", "artist"],
        ["Mid90s", "movie"],
        ["Skins", "tvShow"],
        ["Kendrick Lamar", "artist"],
      ],
    },
    b: {
      label: "Jazz appreciation society",
      seeds: [
        ["Ella Fitzgerald", "artist"],
        ["Miles Davis", "artist"],
        ["Casablanca", "movie"],
        ["Jeeves and Wooster", "tvShow"],
        ["John Coltrane", "artist"],
      ],
    },
  },
  {
    id: "chicago-games-books",
    context: "Hobby groups",
    location: "Chicago",
    objective: OBJECTIVE,
    a: {
      label: "Indie game club",
      seeds: [
        ["Hollow Knight", "videoGame"],
        ["Celeste", "videoGame"],
        ["Stardew Valley", "videoGame"],
        ["Spirited Away", "movie"],
        ["Arcane", "tvShow"],
      ],
    },
    b: {
      label: "Library book club",
      seeds: [
        ["Pride and Prejudice", "book"],
        ["The Hobbit", "book"],
        ["Little Women", "movie"],
        ["Downton Abbey", "tvShow"],
        ["Anne of Green Gables", "book"],
      ],
    },
  },
  {
    id: "mumbai-film-classical",
    context: "Contemporary ↔ classical",
    location: "Mumbai",
    objective: OBJECTIVE,
    a: {
      label: "College film society",
      seeds: [
        ["Gully Boy", "movie"],
        ["Sacred Games", "tvShow"],
        ["Prateek Kuhad", "artist"],
        ["Arijit Singh", "artist"],
        ["Zindagi Na Milegi Dobara", "movie"],
      ],
    },
    b: {
      label: "Classical music circle",
      seeds: [
        ["Ravi Shankar", "artist"],
        ["Zakir Hussain", "artist"],
        ["Pather Panchali", "movie"],
        ["Malgudi Days", "tvShow"],
        ["Lata Mangeshkar", "artist"],
      ],
    },
  },
  {
    id: "berlin-electronic-theatre",
    context: "Nightlife ↔ performing arts",
    location: "Berlin",
    objective: OBJECTIVE,
    a: {
      label: "Electronic music collective",
      seeds: [
        ["Aphex Twin", "artist"],
        ["Kraftwerk", "artist"],
        ["Boiler Room", "tvShow"],
        ["Run Lola Run", "movie"],
        ["Daft Punk", "artist"],
      ],
    },
    b: {
      label: "Amateur theatre company",
      seeds: [
        ["Hamilton", "artist"],
        ["Cabaret", "movie"],
        ["Fleabag", "tvShow"],
        ["The Seagull", "book"],
        ["Kate Bush", "artist"],
      ],
    },
  },
  {
    id: "toronto-kpop-choir",
    context: "Dance crew ↔ community choir",
    location: "Toronto",
    objective: OBJECTIVE,
    heldOut: true,
    a: {
      label: "K-pop dance crew",
      seeds: [
        ["BTS", "artist"],
        ["BLACKPINK", "artist"],
        ["NewJeans", "artist"],
        ["Squid Game", "tvShow"],
        ["Parasite", "movie"],
      ],
    },
    b: {
      label: "Community choir",
      seeds: [
        ["Pentatonix", "artist"],
        ["The Sound of Music", "movie"],
        ["Glee", "tvShow"],
        ["Leonard Cohen", "artist"],
        ["ABBA", "artist"],
      ],
    },
  },
];

/**
 * The same groups with organizer notes: does the agent follow them? Scored on what can be
 * checked in code: skipped kinds never appear, under-18 groups get the mature filter, and a
 * requested kind of place is actually searched.
 */
const base = (id: string) => CASES.find((c) => c.id === id)!;
CASES.push(
  {
    ...base("chicago-games-books"),
    id: "chicago-notes-teens-no-podcasts",
    context: "Hobby groups, with notes",
    notes: "Some members are 14 to 17. No podcasts please, and every session must be free.",
    expect: { skips: ["podcast"], familyFriendly: true },
  },
  {
    ...base("london-skate-jazz"),
    id: "london-notes-live-jazz",
    context: "Youth culture ↔ older enthusiasts, with notes",
    notes: "Adults only. We'd love it to centre on a live jazz venue in the city.",
    expect: { placeTheme: /jazz/i },
  },
);

/**
 * Stress cases (handoff §4): mismatched and sparse profiles, discovery preference, all-ages
 * media, an existing free venue, non-Latin titles and a smaller, less-covered city. Checks are
 * deterministic; quality judgments are left to human review.
 */
CASES.push(
  {
    id: "oslo-mismatch",
    context: "Mismatched groups",
    location: "Oslo",
    objective: OBJECTIVE,
    a: {
      label: "Preschool parents' circle",
      seeds: [
        ["Bluey", "tvShow"],
        ["PAW Patrol", "tvShow"],
        ["Peppa Pig", "tvShow"],
      ],
    },
    b: {
      label: "Extreme metal society",
      seeds: [
        ["Cannibal Corpse", "artist"],
        ["Mayhem", "artist"],
        ["Slayer", "artist"],
      ],
    },
    expect: { littleOverlap: true },
  },
  {
    id: "lisbon-sparse",
    context: "Sparse profiles",
    location: "Lisbon",
    objective: OBJECTIVE,
    a: {
      label: "Fado listening group",
      seeds: [
        ["Amália Rodrigues", "artist"],
        ["Mariza", "artist"],
        ["Ana Moura", "artist"],
      ],
    },
    b: {
      label: "Surf club",
      seeds: [
        ["Point Break", "movie"],
        ["Jack Johnson", "artist"],
        ["Endless Summer", "movie"],
      ],
    },
  },
  {
    ...base("nyc-campus-city"),
    id: "nyc-familiar",
    context: "University ↔ neighbourhood, familiar picks",
    settings: { novelty: "familiar" },
  },
  {
    ...base("nyc-campus-city"),
    id: "nyc-exploratory",
    context: "University ↔ neighbourhood, exploratory picks",
    settings: { novelty: "exploratory" },
  },
  {
    ...base("chicago-games-books"),
    id: "chicago-all-ages",
    context: "Hobby groups, all ages",
    settings: { audience: "all_ages", activity: "play" },
    expect: { familyFriendly: true },
  },
  {
    ...base("berlin-electronic-theatre"),
    id: "berlin-existing-free-venue",
    context: "Nightlife ↔ performing arts, free at an existing venue",
    settings: {
      venue: "existing",
      venueName: "Community library hall",
      budget: "free",
      groupSize: 24,
      access: "step-free access, captions",
    },
    expect: { stayInVenue: true },
  },
  {
    id: "seoul-non-latin",
    context: "Non-Latin titles",
    location: "Seoul",
    objective: OBJECTIVE,
    a: {
      label: "Korean film society",
      seeds: [
        ["기생충", "movie"],
        ["올드보이", "movie"],
        ["아이유", "artist"],
      ],
    },
    b: {
      label: "Anime club",
      seeds: [
        ["千と千尋の神隠し", "movie"],
        ["君の名は。", "movie"],
        ["米津玄師", "artist"],
      ],
    },
    expect: { allResolved: true },
  },
  {
    id: "tartu-small-city",
    context: "Smaller, less-covered city",
    location: "Tartu",
    objective: OBJECTIVE,
    a: {
      label: "Student choir",
      seeds: [
        ["Arvo Pärt", "artist"],
        ["Ennio Morricone", "artist"],
        ["La La Land", "movie"],
      ],
    },
    b: {
      label: "Board-game café regulars",
      seeds: [
        ["Catan", "videoGame"],
        ["Stardew Valley", "videoGame"],
        ["The Hobbit", "book"],
      ],
    },
  },
);
