import { NextResponse } from "next/server";
import { queryAds } from "@/lib/google-ads";

const CONFIGURED = !!(
  process.env.GOOGLE_ADS_CLIENT_ID &&
  process.env.GOOGLE_ADS_CLIENT_SECRET &&
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
  process.env.GOOGLE_ADS_REFRESH_TOKEN &&
  process.env.GOOGLE_ADS_CUSTOMER_ID
);

export async function GET() {
  if (!CONFIGURED) {
    return NextResponse.json({ configured: false });
  }

  try {
    // Last 30 days campaign performance
    const [campaignsRes, keywordsRes, searchTermsRes] = await Promise.all([
      queryAds(`
        SELECT
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
          AND campaign.status = 'ENABLED'
        ORDER BY metrics.impressions DESC
        LIMIT 20
      `),
      queryAds(`
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM keyword_view
        WHERE segments.date DURING LAST_30_DAYS
          AND ad_group_criterion.status = 'ENABLED'
        ORDER BY metrics.impressions DESC
        LIMIT 20
      `),
      queryAds(`
        SELECT
          search_term_view.search_term,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr
        FROM search_term_view
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.clicks DESC
        LIMIT 20
      `),
    ]);

    // Account-level totals last 30 days
    const totalsRes = await queryAds(`
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM customer
      WHERE segments.date DURING LAST_30_DAYS
    `);

    const totals = totalsRes.results?.[0]?.metrics ?? {};

    return NextResponse.json({
      configured: true,
      totals: {
        impressions: Number(totals.impressions ?? 0),
        clicks: Number(totals.clicks ?? 0),
        spend: Number(totals.costMicros ?? 0) / 1_000_000,
        conversions: Number(totals.conversions ?? 0),
        ctr: Number(totals.ctr ?? 0),
        avgCpc: Number(totals.averageCpc ?? 0) / 1_000_000,
      },
      campaigns: (campaignsRes.results ?? []).map((r: any) => ({
        name: r.campaign.name,
        impressions: Number(r.metrics.impressions ?? 0),
        clicks: Number(r.metrics.clicks ?? 0),
        spend: Number(r.metrics.costMicros ?? 0) / 1_000_000,
        conversions: Number(r.metrics.conversions ?? 0),
        ctr: Number(r.metrics.ctr ?? 0),
        avgCpc: Number(r.metrics.averageCpc ?? 0) / 1_000_000,
      })),
      keywords: (keywordsRes.results ?? []).map((r: any) => ({
        text: r.adGroupCriterion.keyword.text,
        matchType: r.adGroupCriterion.keyword.matchType,
        impressions: Number(r.metrics.impressions ?? 0),
        clicks: Number(r.metrics.clicks ?? 0),
        spend: Number(r.metrics.costMicros ?? 0) / 1_000_000,
        conversions: Number(r.metrics.conversions ?? 0),
        ctr: Number(r.metrics.ctr ?? 0),
        avgCpc: Number(r.metrics.averageCpc ?? 0) / 1_000_000,
      })),
      searchTerms: (searchTermsRes.results ?? []).map((r: any) => ({
        term: r.searchTermView.searchTerm,
        impressions: Number(r.metrics.impressions ?? 0),
        clicks: Number(r.metrics.clicks ?? 0),
        spend: Number(r.metrics.costMicros ?? 0) / 1_000_000,
        conversions: Number(r.metrics.conversions ?? 0),
        ctr: Number(r.metrics.ctr ?? 0),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ configured: true, error: e.message }, { status: 500 });
  }
}
