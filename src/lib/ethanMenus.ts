// The four menu styles Ethan offers. Shared by the /ethan landing page and the
// booking form so the two can never drift apart — if a style is added or
// renamed here, both the marketing copy and the form options follow.
export type EthanMenu = {
  id: "classic" | "italian" | "french" | "custom";
  name: string;
  tagline: string;
  description: string;
  courses: string[];
  image: string;
  imageAlt: string;
};

export const ETHAN_MENUS: EthanMenu[] = [
  {
    id: "classic",
    name: "Classic",
    tagline: "Steak & Potatoes",
    description:
      "The one everybody actually wants. A properly rested cut of beef, potatoes cooked until the edges shatter, and a vegetable treated like it matters.",
    courses: [
      "Wedge of little gem, buttermilk, cracked pepper",
      "Dry-aged ribeye, red wine pan sauce",
      "Duck fat potatoes, rosemary & sea salt",
      "Blistered green beans, garlic, lemon",
      "Dark chocolate pot de crème",
    ],
    image: "/portfolio/listing-photos/6701BackBayLn-10.jpg",
    imageAlt: "Dining room set for a private dinner",
  },
  {
    id: "italian",
    name: "Italian",
    tagline: "Pasta, Fire & Family Style",
    description:
      "Hand-rolled pasta made the afternoon of, bread that doesn't make it to the table intact, and everything passed around rather than plated.",
    courses: [
      "Marinated olives, focaccia, cultured butter",
      "Burrata, late-summer tomato, basil oil",
      "Hand-cut tagliatelle, short rib ragù",
      "Chicken al mattone, salsa verde",
      "Tiramisù, espresso",
    ],
    image: "/portfolio/listing-photos/315RingtailStreamDr-17.jpg",
    imageAlt: "Long dining table under exposed beams",
  },
  {
    id: "french",
    name: "French",
    tagline: "Technique & Patience",
    description:
      "The menu Ethan trained on. Stocks reduced for hours, sauces mounted with cold butter, and a cheese course before dessert because that's the right order.",
    courses: [
      "Gougères, chilled Champagne",
      "Soupe à l'oignon gratinée",
      "Seared scallops, beurre blanc, chive",
      "Coq au vin, buttered egg noodles",
      "Cheese course, then crème brûlée",
    ],
    image: "/portfolio/listing-photos/315RingtailStreamDr-13.jpg",
    imageAlt: "Sitting room with wine storage and fireplace",
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Built Around You",
    description:
      "An anniversary dish you've been chasing for years, a family recipe done properly, a menu built around what's good at the market that week. Tell Ethan the idea and he'll write the menu.",
    courses: [
      "A conversation about what you love to eat",
      "A written menu sent back for your notes",
      "Sourcing around allergies, diets, and the season",
      "Wine and non-alcoholic pairings on request",
      "As many or as few courses as you'd like",
    ],
    image: "/portfolio/listing-photos/2506CarlowDr-11.jpg",
    imageAlt: "Open kitchen with island seating",
  },
];
