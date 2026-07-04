import { NextResponse } from "next/server";
import { querySC } from "@/lib/google-search-console";

const SITE_URL = process.env.GOOGLE_SC_SITE_URL || "https://www.luckimages.com/";

const CONFIGURED = !!(
  process.env.GOOGLE_ADS_CLIENT_ID &&
  process.env.GOOGLE_ADS_CLIENT_SECRET &&
  process.env.GOOGLE_SC_REFRESH_TOKEN &&
  process.env.GOOGLE_SC_SITE_URL
);

export async function GET() {
  if (!CONFIGURED) return NextResponse.json({ configured: false });

  try {
    const dateRange = {
      startDate: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
      endDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), // SC has ~3 day lag
    };

    const [topQueries, topPages, totals] = await Promise.all([
      querySC(SITE_URL, {
        ...dateRange,
        dimensions: ["query"],
        rowLimit: 10,
        orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
      }),
      querySC(SITE_URL, {
        ...dateRange,
        dimensions: ["page"],
        rowLimit: 10,
        orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
      }),
      querySC(SITE_URL, { ...dateRange, dimensions: [] }),
    ]);

    const t = totals.rows?.[0] ?? {};

    return NextResponse.json({
      configured: true,
      totals: {
        clicks: Math.round(t.clicks ?? 0),
        impressions: Math.round(t.impressions ?? 0),
        ctr: Number((t.ctr ?? 0) * 100).toFixed(1),
        position: Number(t.position ?? 0).toFixed(1),
      },
      queries: (topQueries.rows ?? []).map((r: any) => ({
        query: r.keys[0],
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        ctr: Number(r.ctr * 100).toFixed(1),
        position: Number(r.position).toFixed(1),
      })),
      pages: (topPages.rows ?? []).map((r: any) => ({
        page: r.keys[0].replace("https://www.luckimages.com", ""),
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        ctr: Number(r.ctr * 100).toFixed(1),
        position: Number(r.position).toFixed(1),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ configured: true, error: e.message }, { status: 500 });
  }
}
