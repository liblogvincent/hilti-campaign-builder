import { describe, expect, it, vi } from "vitest";
import { loadIntegrationConnection, summarizeIntegrationConnection } from "./integration-connections.mjs";

describe("integration connections", () => {
  it("uses an env access token as a prototype Figma MCP connection", async () => {
    const connection = await loadIntegrationConnection({
      provider: "figma",
      env: { FIGMA_MCP_ACCESS_TOKEN: "env-token" },
    });

    expect(connection).toMatchObject({
      provider: "figma",
      source: "env",
      accessToken: "env-token",
      authenticated: true,
    });
  });

  it("loads the latest active provider connection from Supabase", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        provider: "figma",
        access_token: "db-token",
        status: "connected",
        metadata: { team: "RMB" },
        updated_at: "2026-07-08T00:00:00Z",
      },
      error: null,
    }));
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          })),
        })),
      })),
    };

    const connection = await loadIntegrationConnection({ provider: "figma", supabase, env: {} });

    expect(connection).toMatchObject({
      provider: "figma",
      source: "supabase",
      accessToken: "db-token",
      authenticated: true,
    });
  });

  it("returns a safe unauthenticated summary without leaking tokens", () => {
    expect(summarizeIntegrationConnection({
      provider: "figma",
      source: "supabase",
      accessToken: "secret",
      authenticated: true,
      updatedAt: "2026-07-08T00:00:00Z",
    })).toEqual({
      provider: "figma",
      source: "supabase",
      authenticated: true,
      updatedAt: "2026-07-08T00:00:00Z",
    });
  });
});
