export type PriceTier = { max?: number; price: number };

export const QB_PRIMARY: { id: string; name: string; tiers: PriceTier[] }[] = [
  {
    id: "listing_photos",
    name: "Listing Photos",
    tiers: [
      { max: 1500, price: 200 },
      { max: 2000, price: 250 },
      { max: 2500, price: 300 },
      { max: 3000, price: 350 },
      { price: 400 },
    ],
  },
  { id: "drone_photos",    name: "Drone Photos (Standalone)",  tiers: [{ price: 200 }] },
  { id: "video_bronze",    name: "Video — Bronze",             tiers: [{ price: 200 }] },
  { id: "video_silver",    name: "Video — Silver (w/ Drone)",  tiers: [{ price: 300 }] },
  {
    id: "matterport",
    name: "Matterport 3D Tour",
    tiers: [
      { max: 2000, price: 200 },
      { max: 3000, price: 300 },
      { max: 4000, price: 400 },
      { price: 500 },
    ],
  },
  { id: "twilight_standalone", name: "Twilight (Standalone)", tiers: [{ price: 400 }] },
  { id: "virtual_staging",     name: "Virtual Staging",       tiers: [{ price: 25 }] },
  {
    id: "floor_plan",
    name: "Floor Plan",
    tiers: [{ max: 2499, price: 50 }, { price: 75 }],
  },
  { id: "headshots_solo", name: "Headshots — Solo", tiers: [{ price: 200 }] },
];

export const QB_ADDONS: { id: string; name: string; tiers: PriceTier[]; note?: string }[] = [
  { id: "drone_5",         name: "Drone Photos (5)",          tiers: [{ price: 100 }] },
  { id: "drone_10",        name: "Drone Photos (10)",         tiers: [{ price: 150 }] },
  { id: "twilight_addon",  name: "Twilight Add-On (2 photos)", tiers: [{ price: 150 }] },
  { id: "twilight_2nd",    name: "Twilight — 2nd Trip",       tiers: [{ price: 200 }] },
  {
    id: "matterport_addon",
    name: "Matterport (Add-On)",
    tiers: [
      { max: 2000, price: 100 },
      { max: 3000, price: 150 },
      { max: 4000, price: 200 },
      { price: 250 },
    ],
  },
  {
    id: "floor_plan_addon",
    name: "Floor Plan",
    tiers: [{ max: 2499, price: 50 }, { price: 75 }],
  },
];

export function getPrice(tiers: PriceTier[], sqft: number): number {
  for (const t of tiers) {
    if (!t.max || sqft <= t.max) return t.price;
  }
  return tiers[tiers.length - 1].price;
}
