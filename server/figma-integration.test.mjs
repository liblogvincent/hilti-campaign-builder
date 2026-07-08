import { describe, expect, it, vi } from "vitest";
import {
  buildFigmaMappingManifest,
  parseFigmaFileKey,
  syncFigmaBoard,
} from "./figma-integration.mjs";

const plan = {
  campaignId: "camp_test",
  name: "Cold Cut Global Campaign",
};

const requirements = [
  {
    id: "paid-headline",
    title: "Cold cut paid search headline",
    channel: "Paid Media",
    assetType: "Search headline",
    locale: "master",
    owner: "Paid Media",
    rolloutTarget: "Google Ads",
  },
  {
    id: "paid-social",
    title: "Cold cut paid social primary text",
    channel: "Paid Media",
    assetType: "Social primary text",
    locale: "master",
    owner: "Paid Media",
    rolloutTarget: "Meta Ads",
  },
  {
    id: "email-hero",
    title: "Cold cut email hero",
    channel: "Email",
    assetType: "Hero module",
    locale: "master",
    owner: "Content / Creative",
    rolloutTarget: "SFMC",
  },
];

describe("Figma integration", () => {
  it("parses file keys from common Figma URLs and raw keys", () => {
    expect(parseFigmaFileKey("https://www.figma.com/design/AbCd1234EFgh/Cold-Cut?node-id=1-2")).toBe("AbCd1234EFgh");
    expect(parseFigmaFileKey("https://www.figma.com/file/XyZ987654321/My-File")).toBe("XyZ987654321");
    expect(parseFigmaFileKey("RawFileKey_123")).toBe("RawFileKey_123");
    expect(parseFigmaFileKey("https://example.com/not-figma")).toBe("");
  });

  it("builds a channel-grouped board manifest from content requirements", () => {
    const manifest = buildFigmaMappingManifest({
      campaign_plan: plan,
      content_requirements: requirements,
    });

    expect(manifest).toMatchObject({
      schema: "panda.figma.mapping.v1",
      campaignId: "camp_test",
      campaignName: "Cold Cut Global Campaign",
      frameCount: 2,
      placeholderCount: 3,
    });
    expect(manifest.frames.map((frame) => frame.channel)).toEqual(["Paid Media", "Email"]);
    expect(manifest.frames[0].placeholderCount).toBe(2);
  });

  it("returns an actionable setup result when the Figma token is missing", async () => {
    const result = await syncFigmaBoard({
      figma_url: "https://www.figma.com/design/AbCd1234EFgh/Cold-Cut",
      campaign_plan: plan,
      content_requirements: requirements,
    }, {
      env: {},
      fetchImpl: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.capability).toBe("needs-figma-token");
    expect(result.warning).toContain("FIGMA_TOKEN");
    expect(result.manifest.placeholderCount).toBe(3);
  });

  it("verifies an existing Figma file and posts the Panda mapping summary as a real comment", async () => {
    const fetchImpl = vi.fn(async (url, init = {}) => {
      if (String(url).endsWith("/files/AbCd1234EFgh")) {
        return {
          ok: true,
          json: async () => ({ name: "RMB Cold Cut Board" }),
        };
      }
      if (String(url).endsWith("/files/AbCd1234EFgh/comments")) {
        return {
          ok: true,
          json: async () => ({ id: "comment_123" }),
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await syncFigmaBoard({
      mode: "update",
      figma_url: "https://www.figma.com/design/AbCd1234EFgh/Cold-Cut",
      campaign_plan: plan,
      content_requirements: requirements,
    }, {
      env: { FIGMA_TOKEN: "figd_test" },
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      mode: "update",
      capability: "rest-comment-sync",
      fileKey: "AbCd1234EFgh",
      fileName: "RMB Cold Cut Board",
      commentId: "comment_123",
      manifest: {
        frameCount: 2,
        placeholderCount: 3,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.figma.com/v1/files/AbCd1234EFgh",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Figma-Token": "figd_test" }),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.figma.com/v1/files/AbCd1234EFgh/comments",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Cold Cut Global Campaign"),
      }),
    );
  });
});
