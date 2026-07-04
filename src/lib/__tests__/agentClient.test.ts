import { describe, it, expect, vi, beforeEach } from "vitest";
import { adaptPlanWithRepair } from "../agentClient";

describe("adaptPlanWithRepair", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns the plan on first success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ plan: { archetype_id: "paid-media-launch" }, cost_usd: 0.01 }),
    }) as any);
    const r = await adaptPlanWithRepair("b", { id: "paid-media-launch", version: "1.5.0" }, { id: "paid-media-launch", version: "1.5.0" } as any);
    expect(r.repairAttempts).toBe(0);
    expect((r.plan as any).archetype_id).toBe("paid-media-launch");
  });

  it("retries on 422 then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ errors: ["bad slot"] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ plan: { archetype_id: "paid-media-launch" }, cost_usd: 0.02 }) });
    vi.stubGlobal("fetch", fetchMock as any);
    const r = await adaptPlanWithRepair("b", { id: "paid-media-launch", version: "1.5.0" }, { id: "paid-media-launch", version: "1.5.0" } as any);
    expect(r.repairAttempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after maxRetries exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ errors: ["nope"] }) }) as any);
    await expect(
      adaptPlanWithRepair("b", { id: "paid-media-launch", version: "1.5.0" }, { id: "paid-media-launch", version: "1.5.0" } as any, 1),
    ).rejects.toThrow(/failed validation/);
  });
});
