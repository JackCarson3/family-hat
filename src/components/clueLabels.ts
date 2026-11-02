// Mirrors CLUE_PROMPTS in lib/hat.ts (kept separate so client code doesn't import server modules).
export const CLUE_LABELS = [
  { key: "smile", label: "Something that always makes me smile", hint: "Sunrise coffee, old movies, the beach…" },
  { key: "into", label: "What I've been into lately", hint: "Hobbies, books, shows, projects" },
  { key: "replace", label: "Something I keep meaning to replace", hint: "Worn-out slippers? A cracked mug?" },
  { key: "treat", label: "A treat I'd never buy myself", hint: "" },
  { key: "favorites", label: "Favorite stores, restaurants or snacks", hint: "" },
  { key: "sizes", label: "My sizes (shirt, shoes, gloves…)", hint: "" },
  { key: "nope", label: "Please, no more…", hint: "Candles? Mugs? It's okay to say!" },
  { key: "notes", label: "Anything else my Santa should know", hint: "" },
] as const;
