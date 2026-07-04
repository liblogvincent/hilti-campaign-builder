import { createFileRoute } from "@tanstack/react-router";
import { createLandingPage } from "@/lib/connector-contentful.server";
import { createCampaignBoard } from "@/lib/connector-figma.server";

interface ConnectorCallResult {
  system: string;
  status: "ok" | "simulated" | "error";
  detail: string;
  url?: string;
}

export const Route = createFileRoute("/api/connector-rollout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          campaignName: string;
          headline?: string;
          body?: string;
          cta?: string;
          slug?: string;
          channels?: string[];
          locales?: string[];
        };

        const results: ConnectorCallResult[] = [];

        // 1. Contentful — real
        const cf = await createLandingPage({
          campaignName: body.campaignName,
          headline: body.headline || "Campaign Landing Page",
          body: body.body || "Learn more about our professional construction tools.",
          cta: body.cta || "Learn More",
          slug: body.slug || body.campaignName.toLowerCase().replace(/\s+/g, "-"),
        });
        results.push({
          system: "Contentful (CMS)",
          status: cf.success && !cf.simulated ? "ok" : "simulated",
          detail: cf.success
            ? `Landing page created · Entry: ${cf.entryId}`
            : cf.error ?? "Contentful entry creation simulated",
          url: cf.url,
        });

        // 2. Figma — real
        const fig = await createCampaignBoard({
          campaignName: body.campaignName,
          channels: body.channels ?? ["linkedin", "meta"],
          locales: body.locales ?? ["en-US"],
        });
        results.push({
          system: "Figma (Design)",
          status: fig.success && !fig.simulated ? "ok" : "simulated",
          detail: fig.success
            ? `Design board created`
            : fig.error ?? "Figma board creation simulated",
          url: fig.url,
        });

        // 3–6. Ad platforms — simulated
        const slug = body.campaignName.toUpperCase().replace(/\s+/g, "-").slice(0, 30);
        results.push({
          system: "LinkedIn Ads",
          status: "simulated",
          detail: `Campaign "${slug}" · 3 ad sets · Sponsored Content + InMail · Would target: professional audience`,
        });
        results.push({
          system: "Meta Ads",
          status: "simulated",
          detail: `Campaign "${slug}" · 2 ad sets · Feed + Reels placement · Would target: custom audience`,
        });
        results.push({
          system: "Google Ads",
          status: "simulated",
          detail: `Search campaign "${slug}" · 5 ad groups · Would target: keyword-based search intent`,
        });
        results.push({
          system: "DAM Frontify",
          status: "simulated",
          detail: `4 creative assets staged for upload · Product shots + logo + brand kit`,
        });

        return Response.json({ results });
      },
    },
  },
});
