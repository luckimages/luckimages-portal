import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await req.json();

  const match = url.match(/homedetails\/([^/]+)\//);
  let address = "";
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

  return NextResponse.json({ address, agentName: "", agentPhone: "" });
}
