import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function parseAddressFromUrl(url: string): string {
  const match = url.match(/homedetails\/([^/]+)\//);
  if (!match) return "";
  const slug = match[1];
  const parts = slug.replace(/-(\d{5})(_zpid)?$/, "").split("-");
  const stateIdx = parts.findIndex((p: string) => /^[A-Z]{2}$/.test(p));
  if (stateIdx > 0) {
    const street = parts.slice(0, stateIdx - 1).join(" ");
    const city = parts[stateIdx - 1];
    const state = parts[stateIdx];
    const zip = slug.match(/(\d{5})(_zpid)?$/)?.[1] || "";
    return `${street}, ${city} ${state}${zip ? " " + zip : ""}`;
  }
  return parts.join(" ");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await req.json();
  const address = parseAddressFromUrl(url);

  // Try to scrape agent info from the listing page
  let agentName = "";
  let agentPhone = "";
  let brokerage = "";

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

      // Zillow embeds listing data in a __NEXT_DATA__ script tag
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          // Navigate the nested structure to find agent info
          const props = nextData?.props?.pageProps?.componentProps?.gdpClientCache;
          if (props) {
            const entries = Object.values(props) as { property?: { listingAgent?: { displayName?: string; phone?: string; businessName?: string } } }[];
            for (const entry of entries) {
              const agent = entry?.property?.listingAgent;
              if (agent?.displayName) {
                agentName = agent.displayName;
                agentPhone = agent.phone || "";
                brokerage = agent.businessName || "";
                break;
              }
            }
          }
        } catch { /* ignore parse errors */ }
      }

      // Fallback: regex search for agent patterns in the HTML
      if (!agentName) {
        const agentMatch = html.match(/"agentName"\s*:\s*"([^"]+)"/);
        if (agentMatch) agentName = agentMatch[1];

        const phoneMatch = html.match(/"agentPhoneNumber"\s*:\s*"([^"]+)"/);
        if (phoneMatch) agentPhone = phoneMatch[1];

        const brokerMatch = html.match(/"brokerageName"\s*:\s*"([^"]+)"/);
        if (brokerMatch) brokerage = brokerMatch[1];
      }
    }
  } catch { /* network error — still return address */ }

  return NextResponse.json({ address, agentName, agentPhone, brokerage });
}
