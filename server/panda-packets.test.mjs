import { describe, expect, it } from "vitest";
import { buildFallback, buildIntegrationPackage, buildOrchestratorAnswer } from "./panda-packets.mjs";

describe("panda server packets", () => {
  it("builds an H3 rollout package with RMB tool lanes and artifact metadata", () => {
    const packet = buildFallback({ phase: "rollout", campaign_id: "camp_04" });
    const types = packet.artifacts.map((artifact) => artifact.type);

    expect(packet.gate.id).toBe("H3");
    expect(packet.summary).toContain("Rollout");
    expect(types).toContain("figma-localization-manifest");
    expect(types).toContain("sprinklr-draft-manifest");
    expect(types).toContain("contentful-lp-manifest");
    expect(types).toContain("sfmc-email-manifest");
    expect(
      packet.artifacts.every(
        (artifact) =>
          artifact.tool &&
          artifact.owner &&
          artifact.integrationMode &&
          artifact.authority &&
          artifact.gate &&
          artifact.evidence,
      ),
    ).toBe(true);
  });

  it("builds deterministic integration artifacts beyond R10/R11 without auto-publish", () => {
    const result = buildIntegrationPackage({ campaign_id: "camp_04" });
    const types = result.artifacts.map((artifact) => artifact.type);

    expect(types).toContain("r10-utm-create-qa");
    expect(types).toContain("r11-paid-media-qa");
    expect(types).toContain("paid-media-build-manifest");
    expect(types).toContain("publish-manifest");
    expect(result.artifacts.find((artifact) => artifact.type === "publish-manifest").data.no_auto_publish).toBe(true);
  });

  it("builds H4 as performance optimization before knowledge promotion", () => {
    const packet = buildFallback({ phase: "optimize", campaign_id: "camp_04" });
    const types = packet.artifacts.map((artifact) => artifact.type);

    expect(packet.gate.id).toBe("H4");
    expect(packet.summary).toContain("Performance Insights");
    expect(packet.summary).toContain("knowledge promotion");
    expect(types).toContain("paid-media-optimization");
    expect(types).toContain("hol-lp-optimization");
    expect(types).toContain("hol-banner-optimization");
    expect(types).toContain("knowledge-promotion-candidates");
  });

  it("builds H2 content planning as a plain-language bridge package", () => {
    const packet = buildFallback({ phase: "content", campaign_id: "camp_04" });
    const types = packet.artifacts.map((artifact) => artifact.type);

    expect(packet.gate.id).toBe("H2");
    expect(packet.summary).toContain("creative concept");
    expect(packet.summary).toContain("Figma mapping");
    expect(types).toContain("cp1-creative-concept");
    expect(types).toContain("cp2-cross-channel-requirements");
    expect(types).toContain("cp3-storyboard-package");
    expect(types).toContain("cp4-figma-mapping");
    expect(
      packet.artifacts
        .filter((artifact) => artifact.type.startsWith("cp"))
        .every((artifact) => artifact.gate === "H2" && artifact.evidence),
    ).toBe(true);
  });

  it("builds the H1 campaign-plan artifact from the submitted brief", () => {
    const packet = buildFallback({
      phase: "planning",
      campaign_id: "camp_custom",
      brief: "Launch a Benelux firestop campaign for facility managers. Budget EUR 80k. Markets NL, BE. Locales nl-NL, fr-BE. Channels LinkedIn, Email, HOL. No auto-publish."
    });
    const plan = packet.artifacts.find((artifact) => artifact.type === "campaign-plan.v3");

    expect(plan.data.heroProduct).toBe("firestop");
    expect(plan.data.markets).toEqual(["NL", "BE"]);
    expect(plan.data.locales).toEqual(["nl-NL", "fr-BE"]);
    expect(plan.data.audience).toContain("Facility managers");
    expect(plan.data.budget).toBe("EUR 80k");
    expect(plan.data.channels.map((channel) => channel.name)).toEqual(["Paid Media", "Email", "HOL Landing Page"]);
  });

  it("answers global campaign questions from the current run context", () => {
    const answer = buildOrchestratorAnswer({
      question: "What is missing before H2 approval?",
      phase: "content",
      campaign_id: "camp_04",
      current_gate: "H2",
      content_objects: [
        { id: "email-hero", title: "Email hero", status: "approved", channel: "Email", owner: "Email TA" },
        { id: "claim-01", title: "Torque proof point", status: "blocked", channel: "Claims", owner: "Legal / Compliance" },
        { id: "lp-section", title: "Landing page opening", status: "revision-requested", channel: "HOL Landing Page", owner: "HOL" }
      ],
      rollout_objects: []
    });

    expect(answer.answer).toContain("H2");
    expect(answer.answer).toContain("blocked");
    expect(answer.highlights).toContain("1 blocked content object");
    expect(answer.suggested_actions).toContain("Resolve blocked content objects");
    expect(answer.route).toBe("Content");
  });

  it("keeps campaign planning specialist answers scoped to H1 plan editing", () => {
    const answer = buildOrchestratorAnswer({
      question: "there should be no approval here, I just need to update the campaign planning",
      phase: "planning",
      campaign_id: "camp_te60",
      current_gate: "H1",
      agent_scope: { role: "campaign-planning-specialist", surface: "campaign-planning" },
      planning_objects: [
        { id: "campaign-objective", title: "Campaign Objective", status: "in-review", gate: "H1" },
        { id: "target-audience", title: "Target Audience", status: "revision-requested", gate: "H1" }
      ],
      content_objects: [
        { id: "claim-01", title: "Power Tools proof point", status: "blocked", channel: "Claims", owner: "Legal / Compliance" }
      ],
      rollout_objects: [
        { id: "sprinklr", title: "Sprinklr organic and HN draft posts", status: "blocked", lane: "Sprinklr", owner: "Social" }
      ]
    });

    expect(answer.route).toBe("Campaign Planning");
    expect(answer.answer).toContain("H1 plan");
    expect(answer.answer).not.toContain("rollout readiness");
    expect(answer.answer).not.toContain("H3");
  });
});
