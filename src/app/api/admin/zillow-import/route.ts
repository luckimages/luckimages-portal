import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function parseAddressFromSlug(url: string): string {
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
  const address = parseAddressFromSlug(url);

  let agentName = "";
  let agentPhone = "";

  try {
    // Use puppeteer with serverless chromium to render the full JS page
    const chromium = await import("@sparticuz/chromium-min");
    const puppeteer = await import("puppeteer-core");

    const executablePath = await chromium.default.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
    );

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    // Wait for agent info to appear
    await page.waitForSelector('[data-testid="bdp-agent-card"]', { timeout: 8000 }).catch(() => {});

    // Extract agent name and phone from the DOM
    const agentData = await page.evaluate(() => {
      // Try agent card first
      const card = document.querySelector('[data-testid="bdp-agent-card"]');
      if (card) {
        const name = card.querySelector('[data-testid="agent-name"]')?.textContent?.trim()
          || card.querySelector("span.Text-c11n-8-100-2__sc-aiai24-0")?.textContent?.trim()
          || "";
        const phone = card.querySelector('[data-testid="agent-phone"]')?.textContent?.trim()
          || card.querySelector("a[href^='tel:']")?.textContent?.trim()
          || "";
        if (name) return { name, phone };
      }

      // Fallback: look for listing agent section anywhere on page
      const allLinks = Array.from(document.querySelectorAll("a[href^='tel:']"));
      const phone = allLinks[0]?.textContent?.trim() || "";

      // Look for agent name near the phone link
      const agentSection = document.querySelector('[class*="listing-agent"]')
        || document.querySelector('[class*="agentName"]')
        || document.querySelector('[aria-label*="agent"]');
      const name = agentSection?.textContent?.trim() || "";

      return { name, phone };
    });

    agentName = agentData.name || "";
    agentPhone = agentData.phone || "";

    await browser.close();
  } catch (err) {
    // Puppeteer unavailable (local dev) — fall back to static HTML fetch
    console.error("Puppeteer failed, falling back:", err);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      const html = await res.text();

      const laMatch = html.match(/"listingAgent"\s*:\s*\{[^}]{0,400}\}/);
      if (laMatch) {
        const dnMatch = laMatch[0].match(/"displayName"\s*:\s*"([^"]+)"/);
        const pnMatch = laMatch[0].match(/"phoneNumber"\s*:\s*"([^"]+)"/);
        if (dnMatch) agentName = dnMatch[1];
        if (pnMatch) agentPhone = pnMatch[1];
      }

      if (!agentName) {
        const attrMatch = html.match(/"attributionInfo"\s*:\s*\{([^}]{0,800})\}/);
        if (attrMatch) {
          const nameMatch = attrMatch[1].match(/"agentName"\s*:\s*"([^"]+)"/);
          const phoneMatch = attrMatch[1].match(/"agentPhoneNumber"\s*:\s*"([^"]+)"/);
          if (nameMatch) agentName = nameMatch[1];
          if (phoneMatch) agentPhone = phoneMatch[1];
        }
      }
    } catch {}
  }

  return NextResponse.json({ address, agentName, agentPhone });
}
