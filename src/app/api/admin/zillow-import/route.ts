import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();

  // Extract address from Zillow URL
  // Format: https://www.zillow.com/homedetails/123-Main-St-Austin-TX-78701/12345678_zpid/
  try {
    const match = url.match(/homedetails\/([^/]+)\//);
    if (match) {
      const slug = match[1];
      // Convert slug to readable address: "123-Main-St-Austin-TX-78701" -> "123 Main St, Austin TX 78701"
      const parts = slug.replace(/-(\d{5})_zpid$/, "").split("-");
      // Find state abbreviation (2 caps) to insert comma before city
      const stateIdx = parts.findIndex((p: string) => /^[A-Z]{2}$/.test(p));
      let address = "";
      if (stateIdx > 0) {
        const street = parts.slice(0, stateIdx - 1).join(" ");
        const city = parts[stateIdx - 1];
        const state = parts[stateIdx];
        const zip = slug.match(/(\d{5})_zpid/)?.[1] || "";
        address = `${street}, ${city} ${state}${zip ? " " + zip : ""}`;
      } else {
        address = parts.join(" ");
      }
      return NextResponse.json({ address });
    }
  } catch {}

  return NextResponse.json({ address: null });
}
