const STREET_SUFFIXES = new Set([
  "st", "street", "ave", "avenue", "blvd", "boulevard", "dr", "drive", "ln", "lane",
  "rd", "road", "way", "ct", "court", "pl", "place", "cir", "circle", "ter", "terrace",
  "pkwy", "parkway", "trl", "trail", "bend", "loop", "cv", "cove", "xing", "crossing",
  "pt", "point", "ridge", "holw", "hollow", "grv", "grove", "walk", "row", "sq", "square",
  "hwy", "highway", "path", "pass", "run", "cres", "crescent", "aly", "alley", "byp",
  "bypass", "ext", "extension", "frwy", "freeway", "grn", "green", "hbr", "harbor",
  "is", "island", "jct", "junction", "knl", "knoll", "mnr", "manor", "mdw", "meadow",
  "mt", "mount", "mtn", "mountain", "pike", "plz", "plaza", "rdg", "rte", "route",
  "shr", "shore", "spg", "spring", "sta", "station", "vly", "valley", "vw", "view",
  "vlg", "village", "wynd",
]);

// Nominatim addresses trail off into neighborhood/city/county/state/zip/country
// — for a compact display we only want up through the street itself, e.g.
// "5801, Magee Bend, Village at Western Oaks, Austin, TX..." → "5801 Magee Bend".
export function truncateAddressToStreet(address: string): string {
  const segments = address.split(",").map(s => s.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const seg of segments) {
    kept.push(seg);
    const words = seg.split(/\s+/);
    const lastWord = (words[words.length - 1] || "").toLowerCase().replace(/[^a-z]/g, "");
    if (STREET_SUFFIXES.has(lastWord)) return kept.join(" ");
  }
  return address; // no recognized street suffix — leave it as-is
}
