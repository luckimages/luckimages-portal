import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();

  // Parse address from slug first (fast, no fetch)
  let address = "";
  const match = url.match(/homedetails\/([^/]+)\//);
  if (match) {
    const slug = match[1];
    const parts = slug.replace(/-(\d{5})(_zpid)?$/, "").split("-");
    const stateIdx = parts.findIndex((p: string) => /^[A-Z]{2}$/.test(p));
    if (stateIdx > 0) {
      const street = parts.slice(0, stateIdx - 1).join(" ");
      const city = parts[stateIdx - 1];
      const state = parts[stateIdx];
      const zip = slug.match(/(\d{5})(_zpid)?$/)?.[1] || "";
      address = `${street}, ${city} ${state}${zip ? " " + zip : ""}`;
    } else {
      address = parts.join(" ");
    }
  }

  // Fetch the page to scrape agent info
  let agentName = "";
  let agentPhone = "";
  let agentEmail = "";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.ok) {
      const html = await res.text();

      // Zillow embeds listing data in __NEXT_DATA__ JSON
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          // Navigate to listing agent data
          const gdpClientCache = nextData?.props?.pageProps?.componentProps?.gdpClientCache;
          if (gdpClientCache) {
            const cacheStr = typeof gdpClientCache === "string" ? gdpClientCache : JSON.stringify(gdpClientCache);
            // Look for attributionInfo which has the listing agent
            const attrMatch = cacheStr.match(/"attributionInfo"\s*:\s*\{([^}]{0,800})\}/);
            if (attrMatch) {
              const attrStr = attrMatch[1];
              const nameMatch = attrStr.match(/"agentName"\s*:\s*"([^"]+)"/);
              const phoneMatch = attrStr.match(/"agentPhoneNumber"\s*:\s*"([^"]+)"/);
              if (nameMatch) agentName = nameMatch[1];
              if (phoneMatch) agentPhone = phoneMatch[1].replace(/[^\d+]/g, "").replace(/^(\d{10})$/, "($1)").replace(/^\((\d{3})(\d{3})(\d{4})\)$/, "($1) $2-$3");
            }
          }
        } catch {}
      }

      // Fallback: look for agent info in og:description or structured data
      if (!agentName) {
        const ldMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
        if (ldMatch) {
          try {
            const ld = JSON.parse(ldMatch[1]);
            const items = Array.isArray(ld) ? ld : [ld];
            for (const item of items) {
              if (item?.agent?.name) { agentName = item.agent.name; break; }
              if (item?.author?.name) { agentName = item.author.name; break; }
            }
          } catch {}
        }
      }

      // Another common pattern: "listingAgent":{"displayName":"...","phoneNumber":"..."}
      if (!agentName) {
        const laMatch = html.match(/"listingAgent"\s*:\s*\{[^}]{0,400}\}/);
        if (laMatch) {
          const dnMatch = laMatch[0].match(/"displayName"\s*:\s*"([^"]+)"/);
          const pnMatch = laMatch[0].match(/"phoneNumber"\s*:\s*"([^"]+)"/);
          if (dnMatch) agentName = dnMatch[1];
          if (pnMatch) agentPhone = pnMatch[1];
        }
      }

      // Pattern: "brokerName":"...", "brokerPhoneNumber":"..."
      if (!agentPhone) {
        const bpMatch = html.match(/"brokerPhoneNumber"\s*:\s*"([^"]+)"/);
        if (bpMatch) agentPhone = bpMatch[1];
      }
    }
  } catch {}

  return NextResponse.json({ address, agentName, agentPhone, agentEmail });
}
