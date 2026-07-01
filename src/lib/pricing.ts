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
  { id: "twilight_standalone", name: "Twilight (Standalone, 4 photos)", tiers: [{ price: 250 }] },
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

// ── Display-string pricing for the cold-calls tool bubbles + pitch email ──
// These are quick ballpark figures shown during a call/email, not exact quotes.
// Keep in sync with QB_PRIMARY/QB_ADDONS above and the /pricing page when prices change.

export const SERVICE_OPTIONS = [
  { key: "photos_sm",    label: "Photos",         price: "$200–$400" },
  { key: "drone",        label: "Drone Photos",   price: "$200+" },
  { key: "video_bronze", label: "Video Bronze",   price: "$200" },
  { key: "video_silver", label: "Video Silver",   price: "$300" },
  { key: "video_gold",   label: "Video Gold",     price: "Custom" },
  { key: "matterport",   label: "Matterport 3D",  price: "$200–$500" },
  { key: "headshots",    label: "Headshots",      price: "$200+" },
] as const;

export const ADDON_OPTIONS = [
  { key: "addon_drone",           label: "Drone Photos",    price: "+$100–$150" },
  { key: "addon_twilight",        label: "Twilight",        price: "+$150–$200" },
  { key: "addon_matterport",      label: "Matterport 3D",   price: "+$100–$250" },
  { key: "addon_floor_plan",      label: "Floor Plan",      price: "+$50–$75" },
  { key: "addon_virtual_staging", label: "Virtual Staging", price: "+$25–$150" },
] as const;

export const TWILIGHT_STANDALONE_PRICE = "$250";
export const VIRTUAL_STAGING_PER_PHOTO_PRICE = "$25 / photo";

export function serviceLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return SERVICE_OPTIONS.find(s => s.key === key)?.label || key;
}

export function addonLabel(key: string): string {
  return ADDON_OPTIONS.find(a => a.key === key)?.label || key;
}
