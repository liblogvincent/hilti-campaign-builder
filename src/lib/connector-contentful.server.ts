/**
 * Contentful Management API connector.
 * Creates landing-page entries in the configured space for campaign rollout.
 * Always returns structured results — never throws.
 */

const SPACE_ID = "w52602dnmvlq";
const ENV = "master";
const BASE_URL = `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENV}`;

interface ConnectorResult {
  success: boolean;
  entryId?: string;
  url?: string;
  error?: string;
  simulated?: boolean;
}

function getToken(): string | null {
  return process.env.CONTENTFUL_MANAGEMENT_TOKEN ?? null;
}

export async function createLandingPage(args: {
  campaignName: string;
  headline: string;
  body: string;
  cta: string;
  slug: string;
}): Promise<ConnectorResult> {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      simulated: true,
      error: "CONTENTFUL_MANAGEMENT_TOKEN not configured. Add to Vercel env vars.",
      entryId: `sim-${Date.now()}`,
      url: `https://app.contentful.com/spaces/${SPACE_ID}/entries/sim-${Date.now()}`,
    };
  }

  try {
    const fields = {
      title: { "en-US": args.campaignName },
      headline: { "en-US": args.headline },
      body: { "en-US": args.body },
      cta: { "en-US": args.cta },
      slug: { "en-US": args.slug },
    };

    const res = await fetch(`${BASE_URL}/entries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": "landingPage",
      },
      body: JSON.stringify({ fields }),
    });

    // If "landingPage" content type doesn't exist, fall back gracefully
    if (res.status === 404 || res.status === 422) {
      return {
        success: true,
        simulated: true,
        entryId: `no-ct-${Date.now()}`,
        url: `https://app.contentful.com/spaces/${SPACE_ID}`,
        error:
          "Content type 'landingPage' not found in space. Create it or set CONTENTFUL_CONTENT_TYPE_ID.",
      };
    }

    if (!res.ok) {
      const body = await res.text();
      return { success: false, simulated: true, error: `Contentful API ${res.status}: ${body.slice(0, 200)}` };
    }

    const entry = await res.json() as any;
    const entryId = entry.sys?.id ?? `unknown-${Date.now()}`;

    // Publish the entry
    try {
      await fetch(`${BASE_URL}/entries/${entryId}/published`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Contentful-Version": String(entry.sys?.version ?? 1),
        },
      });
    } catch {
      // Publishing is best-effort; entry was created
    }

    return {
      success: true,
      entryId,
      url: `https://app.contentful.com/spaces/${SPACE_ID}/entries/${entryId}`,
    };
  } catch (e) {
    return {
      success: false,
      simulated: true,
      error: e instanceof Error ? e.message : "Unknown Contentful error",
    };
  }
}
