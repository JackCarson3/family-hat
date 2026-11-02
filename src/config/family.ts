/**
 * The family, entered by hand for this year (the setup wizard comes later).
 * Each household becomes two-way "can't draw each other" rules.
 * Budgets, gift date and messages are placeholders for Jack to confirm.
 */

export type HatConfig = {
  slug: string;
  name: string;
  households: { name: string; members: { id: string; name: string }[] }[];
  budget: string | null;
  giftDate: string | null; // ISO date
  message: string;
};

export const FAMILY_NAME = "Carson Family";

/** A practice hat for trying the app before the real drawing. */
export const demoHats: HatConfig[] = [
  {
    slug: "practice",
    name: "Practice Hat",
    households: [
      { name: "Elves", members: [{ id: "jingle", name: "Jingle" }, { id: "tinsel", name: "Tinsel" }] },
      { name: "Reindeer", members: [{ id: "dasher", name: "Dasher" }, { id: "comet", name: "Comet" }] },
      { name: "Snowmen", members: [{ id: "frosty", name: "Frosty" }, { id: "flurry", name: "Flurry" }] },
    ],
    budget: "$25",
    giftDate: "2026-12-25",
    message: "This is a practice hat. Try everything; nothing here counts.",
  },
];

export const hats: HatConfig[] = [
  {
    slug: "grown-ups",
    name: "Grown-ups' Hat",
    households: [
      { name: "John & Noelle", members: [{ id: "john", name: "John" }, { id: "noelle", name: "Noelle" }] },
      { name: "Bethany & Kevin", members: [{ id: "bethany", name: "Bethany" }, { id: "kevin", name: "Kevin" }] },
      { name: "Joe & Kayla", members: [{ id: "joe", name: "Joe" }, { id: "kayla", name: "Kayla" }] },
      { name: "Jack & Erin", members: [{ id: "jack", name: "Jack" }, { id: "erin", name: "Erin" }] },
    ],
    budget: null,
    giftDate: "2026-12-25",
    message: "Merry Christmas, family! Draw a name, keep it secret, and have fun.",
  },
  {
    slug: "kids",
    name: "Kids' Hat",
    households: [
      { name: "Sophia & Isabella", members: [{ id: "sophia", name: "Sophia" }, { id: "isabella", name: "Isabella" }] },
      { name: "Manuel & Mateo", members: [{ id: "manuel", name: "Manuel" }, { id: "mateo", name: "Mateo" }] },
      { name: "Bennett & James", members: [{ id: "bennett", name: "Bennett" }, { id: "james", name: "James" }] },
    ],
    budget: null,
    giftDate: "2026-12-25",
    message: "Kids, it's your turn! Grab a grown-up and draw a name.",
  },
];
