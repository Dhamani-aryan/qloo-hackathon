import type { QlooTypeKey } from "../src/lib/qloo";

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
