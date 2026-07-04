/**
 * Figma REST API connector.
 * Creates a campaign design board for rollout.
 * Always returns structured results — never throws.
 */

interface FigmaResult {
  success: boolean;
  fileKey?: string;
  url?: string;
  error?: string;
  simulated?: boolean;
}

function getToken(): string | null {
  return process.env.FIGMA_API_TOKEN ?? null;
}

export async function createCampaignBoard(args: {
  campaignName: string;
  channels: string[];
  locales: string[];
}): Promise<FigmaResult> {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      simulated: true,
      error: "FIGMA_API_TOKEN not configured. Add to Vercel env vars.",
      fileKey: `sim-${Date.now()}`,
      url: "https://www.figma.com/",
    };
  }

  try {
    // Create a new Figma design file
    const res = await fetch("https://api.figma.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${args.campaignName} — Campaign Board`,
        editorType: "design",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      // Token may not have file:create scope — fall back gracefully
      return {
        success: false,
        simulated: true,
        error: `Figma API ${res.status}: ${body.slice(0, 200)}`,
        url: "https://www.figma.com/",
      };
    }

    const data = await res.json() as any;
    const fileKey = data.key ?? `unknown-${Date.now()}`;

    return {
      success: true,
      fileKey,
      url: `https://www.figma.com/design/${fileKey}`,
    };
  } catch (e) {
    return {
      success: false,
      simulated: true,
      error: e instanceof Error ? e.message : "Unknown Figma error",
    };
  }
}
