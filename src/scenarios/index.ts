import type { QlooTypeKey } from "@/lib/qloo";

/**
 * Prebuilt demo scenarios. Only names and types are stored here; seeds are resolved through
 * Qloo when a scenario is loaded, so no Qloo data is committed (Qloo's hackathon terms).
 * The seeds are hypothetical examples of what each group might supply.
 */

export interface PrebuiltSeed {
  name: string;
  type: QlooTypeKey;
}

export interface PrebuiltScenario {
  id: string;
  title: string;
  summary: string;
  objective: string;
  location: string;
  a: { label: string; seeds: PrebuiltSeed[] };
  b: { label: string; seeds: PrebuiltSeed[] };
}

export const PREBUILT: PrebuiltScenario[] = [
  {
    id: "campus-city-nyc",
    title: "Campus ↔ City",
    summary: "A university film & music club and a neighbourhood arts association in New York.",
    objective:
      "Design a four-session recurring program that connects a university film & music club with a neighbourhood arts association, so both groups keep coming back and make something together.",
    location: "New York City",
    a: {
      label: "University film & music club",
      seeds: [
        { name: "Phoebe Bridgers", type: "artist" },
        { name: "Frank Ocean", type: "artist" },
        { name: "Tame Impala", type: "artist" },
        { name: "Everything Everywhere All at Once", type: "movie" },
        { name: "Lady Bird", type: "movie" },
        { name: "Atlanta", type: "tvShow" },
        { name: "Normal People", type: "book" },
        { name: "Hades", type: "videoGame" },
      ],
    },
    b: {
      label: "Neighbourhood arts association",
      seeds: [
        { name: "Nina Simone", type: "artist" },
        { name: "Joni Mitchell", type: "artist" },
        { name: "Miles Davis", type: "artist" },
        { name: "Cinema Paradiso", type: "movie" },
        { name: "Casablanca", type: "movie" },
        { name: "Columbo", type: "tvShow" },
        { name: "The Great Gatsby", type: "book" },
        { name: "Just Kids", type: "book" },
      ],
    },
  },
  {
    id: "jaipur-craft-futures",
    title: "Jaipur Craft Futures",
    summary: "Young digital creators and heritage craft practitioners in Jaipur.",
    objective:
      "Design a four-session program where young digital creators and heritage craft practitioners collaborate as equals on contemporary work rooted in tradition.",
    location: "Jaipur",
    a: {
      label: "Young digital creators",
      seeds: [
        { name: "Prateek Kuhad", type: "artist" },
        { name: "Ritviz", type: "artist" },
        { name: "AP Dhillon", type: "artist" },
        { name: "Gully Boy", type: "movie" },
        { name: "Rang De Basanti", type: "movie" },
        { name: "Panchayat", type: "tvShow" },
      ],
    },
    b: {
      label: "Heritage & craft practitioners",
      seeds: [
        { name: "Lata Mangeshkar", type: "artist" },
        { name: "Jagjit Singh", type: "artist" },
        { name: "Bismillah Khan", type: "artist" },
        { name: "Mughal-e-Azam", type: "movie" },
        { name: "Pakeezah", type: "movie" },
        { name: "Malgudi Days", type: "tvShow" },
      ],
    },
  },
];
