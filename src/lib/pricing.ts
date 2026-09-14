// ── Canonical pricing + service-compatibility source of truth ──────────────
// Every pricing surface (the /pricing page's reference table + quote
// generator, the client "Book a Shoot" form, and the admin quote builder)
// reads from this file. Change a price or a compatibility rule here once —
// it propagates everywhere. Do not hardcode a service name or dollar amount
// in any of those UIs; import from here instead.

export type SqftTier = { maxSqft?: number; price: number; label: string };
export type Option = { key: string; label: string; price: number | "custom" };
// A base tier plus an open-ended "+$X per N more" increment (Aerial Photos primary).
export type BaseIncrement = {
  baseLabel: string;
  basePrice: number;
  baseCount: number;
  incrementCount: number;
  incrementPrice: number;
  incrementLabel: string; // e.g. "Each additional 5 photos"
};

export type PricingShape =
  | { kind: "sqft"; tiers: SqftTier[] }
  | { kind: "options"; options: Option[] }
  | { kind: "base_increment"; increment: BaseIncrement };

export type PrimaryService = {
  id: string;
  name: string;
  description: string;
  qboProduct: string; // key into QB_PRODUCT_MAP
  pricing: PricingShape;
  addonIds: string[]; // add-ons compatible with this primary
};

export type Addon = {
  id: string;
  name: string;
  description: string;
  qboProduct: string; // key into QB_PRODUCT_MAP
  pricing: PricingShape;
};

export function getSqftPrice(tiers: SqftTier[], sqft: number): number {
  for (const t of tiers) {
    if (!t.maxSqft || sqft <= t.maxSqft) return t.price;
  }
  return tiers[tiers.length - 1].price;
}

export function getBaseIncrementPrice(inc: BaseIncrement, count: number): number {
  if (count <= inc.baseCount) return inc.basePrice;
  const extra = count - inc.baseCount;
  const steps = Math.ceil(extra / inc.incrementCount);
  return inc.basePrice + steps * inc.incrementPrice;
}

// Selection state needed to resolve a price out of a PricingShape:
// - "sqft" needs `sqft` (square footage entered so far)
// - "options" needs `optionKey` (which radio/tier the user picked)
// - "base_increment" needs `count` (quantity selected; defaults to the base tier)
export type PriceSelection = { sqft?: number; optionKey?: string; count?: number };

// Returns undefined when required input hasn't been provided yet (e.g. no sqft
// entered for a sqft-tiered service) so callers can show "enter sq ft" states.
export function resolvePrice(pricing: PricingShape, sel: PriceSelection): number | "custom" | undefined {
  if (pricing.kind === "sqft") {
    if (!sel.sqft) return undefined;
    return getSqftPrice(pricing.tiers, sel.sqft);
  }
  if (pricing.kind === "options") {
    const opt = sel.optionKey
      ? pricing.options.find((o) => o.key === sel.optionKey)
      : pricing.options[0];
    return opt?.price;
  }
  return getBaseIncrementPrice(pricing.increment, sel.count ?? pricing.increment.baseCount);
}

export const PRIMARY_SERVICES: PrimaryService[] = [
  {
    id: "listing_photos",
    name: "Listing Photos",
    description: "Sharp, well-lit photography that moves properties faster.",
    qboProduct: "Listing Photos",
    pricing: {
      kind: "sqft",
      tiers: [
        { maxSqft: 1500, price: 200, label: "Up to 1,500 sq ft" },
        { maxSqft: 2000, price: 250, label: "Up to 2,000 sq ft" },
        { maxSqft: 2500, price: 300, label: "Up to 2,500 sq ft" },
        { maxSqft: 3000, price: 350, label: "Up to 3,000 sq ft" },
        { price: 400, label: "3,500+ sq ft" },
      ],
    },
    addonIds: ["aerial_addon", "twilight_addon", "matterport_addon", "floor_plan_addon", "virtual_staging_addon"],
  },
  {
    id: "aerial_photos",
    name: "Aerial Photos",
    description: "FAA-certified aerial photography — standalone shoot.",
    qboProduct: "Aerial Photos",
    pricing: {
      kind: "base_increment",
      increment: {
        baseLabel: "10 photos",
        basePrice: 200,
        baseCount: 10,
        incrementCount: 5,
        incrementPrice: 75,
        incrementLabel: "Each additional 5 photos",
      },
    },
    addonIds: ["ground_photos_addon"],
  },
  {
    id: "video_walkthrough",
    name: "Video Walkthrough",
    description: "Cinematic interior walkthroughs that bring listings to life.",
    qboProduct: "Video Walkthrough",
    pricing: {
      kind: "options",
      options: [
        { key: "bronze", label: "Bronze", price: 200 },
        { key: "silver", label: "Silver (includes aerial)", price: 300 },
        { key: "gold", label: "Gold", price: "custom" },
      ],
    },
    addonIds: ["floor_plan_addon"],
  },
  {
    id: "matterport",
    name: "Matterport 3D Tour",
    description: "Immersive virtual tours for any device.",
    qboProduct: "Matterport 3D Tour",
    pricing: {
      kind: "sqft",
      tiers: [
        { maxSqft: 2000, price: 200, label: "Up to 2,000 sq ft" },
        { maxSqft: 3000, price: 300, label: "Up to 3,000 sq ft" },
        { maxSqft: 4000, price: 400, label: "Up to 4,000 sq ft" },
        { price: 500, label: "5,000+ sq ft" },
      ],
    },
    addonIds: ["floor_plan_addon"],
  },
  {
    id: "headshots",
    name: "Headshots",
    description: "Professional agent headshots on-location.",
    qboProduct: "Headshots",
    pricing: {
      kind: "options",
      options: [
        { key: "solo", label: "Solo", price: 200 },
        { key: "team5", label: "Team of 5", price: 500 },
      ],
    },
    addonIds: [],
  },
];

// Headshots' "+$50 each additional person" applies past the Team of 5 tier.
// Not modeled as a generic BaseIncrement since the Solo tier isn't on the
// same linear scale (Solo $200 for 1 person, Team of 5 $500 for 5) — kept
// as a note here rather than in the options list above.
export const HEADSHOTS_EXTRA_PERSON_PRICE = 50;

export const ADDONS: Addon[] = [
  {
    id: "aerial_addon",
    name: "Aerial Photos",
    description: "Aerial stills added to any listing shoot.",
    qboProduct: "Aerial Add-on",
    pricing: {
      kind: "options",
      options: [
        { key: "5", label: "5 photos", price: 100 },
        { key: "10", label: "10 photos", price: 150 },
      ],
    },
  },
  {
    id: "ground_photos_addon",
    name: "Ground Photos",
    description: "Ground-level shots of the property to accompany an aerial shoot.",
    qboProduct: "Ground Photos",
    pricing: {
      kind: "options",
      options: [
        { key: "5", label: "5 photos", price: 50 },
        { key: "10", label: "10 photos", price: 100 },
      ],
    },
  },
  {
    id: "twilight_addon",
    name: "Twilight",
    description: "Golden hour exterior shots added to any listing session.",
    qboProduct: "Twilight Add-on",
    pricing: {
      kind: "options",
      options: [
        { key: "addon", label: "2 photos add-on", price: 150 },
        { key: "2nd_trip", label: "2nd trip", price: 200 },
      ],
    },
  },
  {
    id: "matterport_addon",
    name: "Matterport 3D Tour",
    description: "Virtual tour added to any shoot.",
    // Same QBO item as the standalone Matterport primary — there is no
    // separate "Matterport Add-on" product in QuickBooks.
    qboProduct: "Matterport 3D Tour",
    pricing: {
      kind: "sqft",
      tiers: [
        { maxSqft: 2000, price: 100, label: "Up to 2,000 sq ft" },
        { maxSqft: 3000, price: 150, label: "Up to 3,000 sq ft" },
        { maxSqft: 4000, price: 200, label: "Up to 4,000 sq ft" },
        { price: 250, label: "5,000+ sq ft" },
      ],
    },
  },
  {
    id: "floor_plan_addon",
    name: "Floor Plan",
    description: "Floor plan diagram added to any shoot.",
    qboProduct: "Floor Plan",
    pricing: {
      kind: "sqft",
      tiers: [
        { maxSqft: 2499, price: 50, label: "Under 2,500 sq ft" },
        { price: 75, label: "2,500+ sq ft" },
      ],
    },
  },
  {
    id: "virtual_staging_addon",
    name: "Virtual Staging",
    description: "Digitally furnished rooms — fast and affordable.",
    qboProduct: "Virtual Staging",
    pricing: {
      kind: "options",
      options: [
        { key: "per_photo", label: "Per photo", price: 25 },
        { key: "5", label: "5 photos", price: 100 },
        { key: "10", label: "10 photos", price: 150 },
      ],
    },
  },
];

// Flattens any PricingShape into the {label, price} rows the static
// reference table (and anywhere else that just needs a menu listing) renders.
export function displayTiers(pricing: PricingShape): { label: string; price: string }[] {
  if (pricing.kind === "sqft") {
    return pricing.tiers.map((t) => ({ label: t.label, price: `$${t.price}` }));
  }
  if (pricing.kind === "options") {
    return pricing.options.map((o) => ({ label: o.label, price: o.price === "custom" ? "Custom" : `$${o.price}` }));
  }
  const inc = pricing.increment;
  return [
    { label: inc.baseLabel, price: `$${inc.basePrice}` },
    { label: inc.incrementLabel, price: `+$${inc.incrementPrice}` },
  ];
}

export function addonsFor(primaryId: string): Addon[] {
  const primary = PRIMARY_SERVICES.find((p) => p.id === primaryId);
  if (!primary) return [];
  return ADDONS.filter((a) => primary.addonIds.includes(a.id));
}

// ── Display-string pricing for the cold-calls tool bubbles + pitch email ──
// These are quick ballpark figures shown during a call/email, not exact
// quotes — kept as ranges. Keep the low/high ends in sync with the tables
// above when prices change.

export const SERVICE_OPTIONS = [
  { key: "photos_sm", label: "Photos", price: "$200–$400" },
  { key: "drone", label: "Aerial Photos", price: "$200+" },
  { key: "video_bronze", label: "Video Bronze", price: "$200" },
  { key: "video_silver", label: "Video Silver", price: "$300" },
  { key: "video_gold", label: "Video Gold", price: "Custom" },
  { key: "matterport", label: "Matterport 3D", price: "$200–$500" },
  { key: "headshots", label: "Headshots", price: "$200+" },
] as const;

export const ADDON_OPTIONS = [
  { key: "addon_drone", label: "Aerial Photos", price: "+$100–$150" },
  { key: "addon_ground", label: "Ground Photos", price: "+$50–$100" },
  { key: "addon_twilight", label: "Twilight", price: "+$150–$200" },
  { key: "addon_matterport", label: "Matterport 3D", price: "+$100–$250" },
  { key: "addon_floor_plan", label: "Floor Plan", price: "+$50–$75" },
  { key: "addon_virtual_staging", label: "Virtual Staging", price: "+$25–$150" },
] as const;

export function serviceLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return SERVICE_OPTIONS.find((s) => s.key === key)?.label || key;
}

export function addonLabel(key: string): string {
  return ADDON_OPTIONS.find((a) => a.key === key)?.label || key;
}
