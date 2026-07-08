import { describe, expect, it } from "vitest";
import {
  artifactMetadataComplete,
  agentModeForPhase,
  agentStackItems,
  buildAgentScope,
  campaignPlanningDeliverables,
  campaignPlanningDeliverablePatchFromInstruction,
  buildPandaContextPacket,
  campaignPlanningObjectsFromPlan,
  campaignPlanningReadiness,
  campaignPlanForRun,
  contentWorkObjects,
  contentRequirementsFromPlan,
  contentWorkspaceReadiness,
  coverageItems,
  coverageStats,
  createContentWorkObjectsFromRequirements,
  createCampaignFromBrief,
  createCampaignFromHomeDraft,
  createHomeDraftFallback,
  createDefaultRun,
  createRolloutWorkObjectsFromContent,
  displayCampaignSummary,
  draftWorkspaceAgentAnswer,
  applyContentPlanningInstruction,
  artifactRevisionPrompt,
  contentPlanningDeliverablePatchFromInstruction,
  buildLeadershipFeedbackProposal,
  buildPlanPreviewSlides,
  campaignThemeForPlan,
  campaignThemeHeadline,
  contentCreationDeliverables,
  buildContentPlanningBridge,
  contentPlanningDeliverables,
  buildHomeCampaignDiscoveryReply,
  buildHomeRoleGuidanceReply,
  campaignConversationKey,
  classifyHomeIntent,
  contentPlanningBridgeReadiness,
  compactAgentMessages,
  simulatedPlanDeckFilename,
  currentPhaseMeta,
  defaultUserRole,
  draftSpecialistAgentResponse,
  gateApprovalReadiness,
  homeRouteAfterCampaignLaunch,
  homeContinuationInstruction,
  homeDraftQuestionAnswer,
  isHomeCampaignCreationIntent,
  isHomeDraftConfirmation,
  mergeHomeDraft,
  navigationItems,
  nextPhase,
  normalizeServerUpdates,
  restoreAppView,
  phaseIndex,
  progressForCampaign,
  progressTaskDetailRoute,
  rolloutWorkspaceReadiness,
  phases,
  skillHubSummary,
  skillCapabilityItems,
  applyPlanningInstruction,
  toolchainItems,
  visibleWorkspaceMessages,
  normalizeCampaignSnapshot,
  runtimeSnapshotCampaignId,
  runtimeSnapshotHasEvidence,
  runtimeSnapshotEvidenceFromWorkspace,
  runtimeSnapshotsFromWorkspace,
  shouldSuppressLocalReplay,
  shouldCreateHomeWorkspace,
  workspaceAgentMessageKey
} from "./panda";

describe("panda run model", () => {
  it("creates a default campaign run at the planning phase", () => {
    const run = createDefaultRun();

    expect(run.campaignId).toBe("camp_04");
    expect(run.phase).toBe("planning");
    expect(run.gateDecisions).toEqual([]);
    expect(run.worklog[0].agent).toBe("orchestrator");
  });

  it("advances through the RMB gate phases in order", () => {
    expect(nextPhase("planning")).toBe("content");
    expect(nextPhase("content")).toBe("rollout");
    expect(nextPhase("rollout")).toBe("optimize");
    expect(nextPhase("optimize")).toBe("optimize");
  });

  it("keeps H1-H4 attached to the executable phase spine", () => {
    expect(phases.map((phase) => phase.gate)).toEqual(["H1", "H2", "H3", "H4"]);
    expect(currentPhaseMeta("rollout").label).toBe("Rollout");
    expect(currentPhaseMeta("rollout").description).toContain("Publish Readiness");
    expect(currentPhaseMeta("optimize").label).toBe("Optimize");
    expect(currentPhaseMeta("optimize").description).toContain("Performance Insights");
    expect(currentPhaseMeta("optimize").description).toContain("knowledge promotion");
    expect(phaseIndex("planning")).toBeLessThan(phaseIndex("optimize"));
  });

  it("tracks RMB coverage across H1-H4 with explicit missing rollout outputs", () => {
    const rolloutItems = coverageItems.filter((item) => item.gate === "H3");
    expect(rolloutItems.length).toBeGreaterThan(10);
    expect(rolloutItems.some((item) => item.name === "Sprinklr Bulk Upload")).toBe(true);
    expect(
      rolloutItems.some(
        (item) => item.name === "SFMC Automation and Journey Build" && item.backlogCoverage.includes("[VERIFY]")
      )
    ).toBe(true);
    expect(coverageStats(coverageItems).missing).toBeGreaterThan(0);
  });

  it("tracks RMB tools, owners, integration posture, and gate impact", () => {
    const figma = toolchainItems.find((item) => item.tool === "Figma");
    const contentful = toolchainItems.find((item) => item.tool === "Contentful");
    const powerBi = toolchainItems.find((item) => item.tool === "Power BI");

    expect(figma?.integrationMode).toBe("MCP");
    expect(figma?.authority).toBe("source-of-truth");
    expect(contentful?.gateImpact).toContain("H3");
    expect(powerBi?.authority).toBe("read-only-evidence");
  });

  it("requires tool metadata on rollout and optimization artifacts", () => {
    expect(
      artifactMetadataComplete({
        id: "artifact_1",
        name: "Contentful LP Manifest",
        type: "contentful-lp-manifest",
        content: "English landing page draft is held for H3.",
        phase: "rollout",
        createdAt: "2026-07-05T00:00:00.000Z",
        data: {},
        tool: "Contentful",
        owner: "HOL team member",
        integrationMode: "mock",
        authority: "publish-held",
        gate: "H3",
        evidence: "LP draft manifest"
      })
    ).toBe(true);
  });

  it("supports Control Tower coverage and toolchain summaries", () => {
    const stats = coverageStats(coverageItems);

    expect(stats.partial + stats.missing + stats.covered + stats["out-of-current-evidence"]).toBe(coverageItems.length);
    expect(coverageItems.every((item) => item.id && item.gate && item.workstream && item.owner && item.tool)).toBe(true);
    expect(toolchainItems.every((item) => item.tool && item.role && item.owner && item.gateImpact)).toBe(true);
  });

  it("normalizes agent JSON summaries into readable home copy", () => {
    const summary = displayCampaignSummary(
      JSON.stringify({
        summary: "Planning phase completed for DACH SIW 6AT-A22 campaign.",
        worklog: [{ agent: "a0", status: "done" }]
      })
    );

    expect(summary).toBe("Planning phase completed for DACH SIW 6AT-A22 campaign.");
    expect(summary).not.toContain("{");
    expect(summary).not.toContain("worklog");
  });

  it("extracts summary copy from relaxed persisted agent packets", () => {
    const summary = displayCampaignSummary(
      `{ \\"summary\\": \\"H1 packet is ready for review.\\", \\"worklog\\": [ { \\"agent\\": \\"a0\\" } ] }`
    );

    expect(summary).toBe("H1 packet is ready for review.");
  });

  it("exposes Plan and Build agent modes without changing phase execution", () => {
    expect(agentModeForPhase("planning")).toBe("Plan");
    expect(agentModeForPhase("content")).toBe("Build");
    expect(agentModeForPhase("rollout")).toBe("Build");
    expect(agentModeForPhase("optimize")).toBe("Build");
  });

  it("keeps the home orchestrator on Home after campaign creation intent", () => {
    expect(isHomeCampaignCreationIntent("launch a campaign of TE70")).toBe(false);
    expect(classifyHomeIntent("launch a campaign of TE70").type).toBe("plan-campaign");
    expect(isHomeCampaignCreationIntent("what is blocked before H2?")).toBe(false);
    expect(homeRouteAfterCampaignLaunch("launch a campaign of TE70")).toBe("home");
    expect(homeRouteAfterCampaignLaunch("   ")).toBe("home");
  });

  it("classifies home orchestration intent without treating simple chat as campaign creation", () => {
    expect(classifyHomeIntent("hello").type).toBe("chat");
    expect(classifyHomeIntent("what is the campaign status?").type).toBe("status");
    expect(classifyHomeIntent("open content planning").type).toBe("route");
    expect(classifyHomeIntent("launch a campaign for TE60-22").type).toBe("plan-campaign");
    expect(classifyHomeIntent("create campaign now for TE60-22 for MOCN audience in DACH").type).toBe("create-campaign");
    expect(classifyHomeIntent("update the current campaign to focus on TE60-22").type).toBe("update-campaign");
    expect(isHomeCampaignCreationIntent("hello campaign")).toBe(false);
  });

  it("does not create a campaign from a shallow product mention", () => {
    expect(classifyHomeIntent("TE70")).toEqual({ type: "plan-campaign" });
    expect(classifyHomeIntent("launch a campaign of TE70").type).toBe("plan-campaign");
  });

  it("does not route to Content just because a campaign source URL contains a content path", () => {
    const intent = classifyHomeIntent(
      "I want to shape a campaign for Hilti SPEC2SITE software promotion. Please research https://www.hilti.com/content/hilti/W1/US/en/business/business/productivity/spec2site.html and show the assumptions before creating a workspace."
    );

    expect(intent.type).toBe("plan-campaign");
  });

  it("creates a campaign only when the user gives a launch action and enough brief detail", () => {
    expect(classifyHomeIntent("create campaign for TE70 in DACH for installers with paid media and email").type).toBe("create-campaign");
  });

  it("asks campaign brief questions before creating a shallow campaign", () => {
    const reply = buildHomeCampaignDiscoveryReply("launch a campaign for TE60-22");

    expect(reply).toContain("TE60-22");
    expect(reply).toContain("audience");
    expect(reply).toContain("markets");
    expect(reply).toContain("channels");
    expect(reply).toContain("proceed");
    expect(reply).toContain("brief");
  });

  it("drafts a useful Home brief from a broad cold-cut campaign prompt without creating it immediately", () => {
    const prompt = "I want a campaign for cold cut, the products you can check here https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo, it should be launched in global markets all the markets and we may need change the markets based on the future decision with the market leaders once the campaign plan and content plan shared with them. budget should also be defined after we have the campaign and content planning.";
    const reply = buildHomeCampaignDiscoveryReply(prompt);

    expect(classifyHomeIntent(prompt).type).toBe("plan-campaign");
    expect(reply).toContain("Initial brief for review");
    expect(reply).toContain("Initial plan to review");
    expect(reply).toContain("cold cut");
    expect(reply).toContain("https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo");
    expect(reply).toContain("Global markets");
    expect(reply).toContain("Budget");
    expect(reply).toContain("Campaign Planning");
    expect(reply).toContain("success-measure");
    expect(reply).toContain("proceed");
    expect(reply).not.toContain("target markets assumption");
    expect(reply).not.toMatch(/\bH[1-4]\b/);
    expect(reply).not.toMatch(/\bblocked\b/i);
    expect(reply).not.toMatch(/\bapproval\b/i);
  });

  it("names non-SKU campaign briefs from the campaign subject before broad market words", () => {
    const campaign = createCampaignFromBrief(
      "I want a campaign for cold cut, the products you can check here https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo, it should be launched in global markets."
    );

    expect(campaign.name).toContain("Cold Cut");
    expect(campaign.name).not.toBe("GLOBAL");
    expect(campaign.nextActions[0]).toBe("Review campaign planning draft");
  });

  it("parses the cold-cut prompt into a clean campaign plan without URL leakage", () => {
    const prompt = "I want a campaign for cold cut, the products you can check here https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo, it should be launched in global markets all the markets and we may need change the markets based on the future decision with the market leaders once the campaign plan and content plan shared with them. budget should also be defined after we have the campaign and content planning.";
    const plan = campaignPlanForRun(createCampaignFromBrief(prompt));

    expect(plan.heroProduct).toBe("cold cut");
    expect(plan.markets).toEqual(["Global markets"]);
    expect(plan.audience).toEqual(["Contractors", "Installers", "Trade buyers"]);
    expect(plan.budget).toBe("To be defined after Campaign Planning and Content Planning review");
    expect(plan.heroProduct).not.toContain("https://");
    expect(plan.audience.join(" ")).not.toContain("https://");
    expect(plan.markets.join(" ")).not.toBe("al");
  });

  it("creates a campaign from a structured Home draft without reparsing the transcript", () => {
    const campaign = createCampaignFromHomeDraft(
      {
        campaignName: "Cold Cut Global Campaign",
        heroProduct: "cold cut",
        objective: "Create qualified demand for safer, cleaner metal cutting.",
        audience: ["Contractors", "Installers", "Trade buyers"],
        markets: ["Global markets"],
        locales: ["Market-localized variants TBD"],
        channels: ["Paid Media", "Email", "HOL Landing Page", "Organic/HN"],
        kpiCandidates: ["Qualified HOL visits", "Promotion-code engagement"],
        budgetAssumptions: "To be defined after Campaign Planning and Content Planning review",
        timingAssumptions: "Launch waves to be agreed with market leaders after plan review.",
        missingInputs: ["Market priority", "Budget owner"],
        sourceEvidence: ["CUT20 and safer cleaner cutting proof points from the researched product page."]
      },
      "I want a campaign for cold cut, see https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo"
    );
    const plan = campaignPlanForRun(campaign);

    expect(campaign.name).toBe("Cold Cut Global Campaign");
    expect(campaign.brief).toContain("Create qualified demand");
    expect(plan.heroProduct).toBe("cold cut");
    expect(plan.markets).toEqual(["Global markets"]);
    expect(plan.locales).toEqual(["Market-localized variants TBD"]);
    expect(plan.audience).toEqual(["Contractors", "Installers", "Trade buyers"]);
    expect(plan.budget).toBe("To be defined after Campaign Planning and Content Planning review");
    expect(plan.channels.map((channel) => channel.name)).toEqual(["Paid Media", "Email", "HOL Landing Page", "Organic / HN"]);
    expect(plan.kpis).toEqual(["Qualified HOL visits", "Promotion-code engagement"]);
    expect(plan.assumptions).toContain("Missing input: Market priority");
    expect(plan.heroProduct).not.toContain("https://");
  });

  it("merges Home draft patches without dropping existing campaign-building fields", () => {
    const draft = {
      campaignName: "Diamond Coring Demand Campaign",
      heroProduct: "Hilti diamond coring products",
      objective: "Create qualified demand for precise coring solutions.",
      audience: ["Contractors", "Installers"],
      markets: ["Global markets"],
      locales: ["Market-localized variants TBD"],
      channels: ["Paid Media", "Email"],
      kpiCandidates: ["Qualified HOL visits"],
      budgetAssumptions: "Budget follows plan review.",
      timingAssumptions: "Market leaders confirm timing.",
      missingInputs: ["Priority markets"],
      sourceEvidence: ["User supplied product family."],
    };

    const merged = mergeHomeDraft(draft, {
      channels: ["Paid Media", "Email", "HOL Landing Page"],
      missingInputs: ["Priority markets", "Hero offer"],
    });

    expect(merged.campaignName).toBe("Diamond Coring Demand Campaign");
    expect(merged.objective).toBe("Create qualified demand for precise coring solutions.");
    expect(merged.channels).toEqual(["Paid Media", "Email", "HOL Landing Page"]);
    expect(merged.missingInputs).toEqual(["Priority markets", "Hero offer"]);
    expect(merged.sourceEvidence).toEqual(["User supplied product family."]);
  });

  it("answers Home draft assumption questions naturally without workflow jargon", () => {
    const answer = homeDraftQuestionAnswer("where is the assumption?", {
      campaignName: "Diamond Coring Demand Campaign",
      heroProduct: "Hilti diamond coring products",
      objective: "Create qualified demand for precise coring solutions.",
      audience: ["Contractors", "Installers"],
      markets: ["Global markets"],
      locales: ["Market-localized variants TBD"],
      channels: ["Paid Media", "Email", "HOL Landing Page"],
      kpiCandidates: ["Qualified HOL visits"],
      budgetAssumptions: "Budget follows plan review.",
      timingAssumptions: "Market leaders confirm timing.",
      missingInputs: ["Priority markets", "Hero offer"],
      sourceEvidence: ["User supplied product family."],
    });

    expect(answer).toContain("working assumptions");
    expect(answer).toContain("Budget follows plan review");
    expect(answer).toContain("Priority markets");
    expect(answer).not.toMatch(/\bblocked\b/i);
    expect(answer).not.toContain("Risk lane");
    expect(answer).not.toMatch(/\bapproval\b/i);
    expect(answer).not.toMatch(/\bH[1-4]\b/);
  });

  it("creates a visible fallback Home draft when the live Home agent is unavailable", () => {
    const draft = createHomeDraftFallback(
      "i want to build a campaign about diamond coring products of Hilti.",
      []
    );

    expect(draft.campaignName.toLowerCase()).toContain("diamond coring");
    expect(draft.heroProduct).toContain("diamond coring products of Hilti");
    expect(draft.objective).toContain("diamond coring products");
    expect(draft.audience).toContain("Contractors");
    expect(draft.channels).toContain("Paid Media");
    expect(draft.missingInputs).toContain("Market priority");
  });

  it("uses researched URL evidence in the Home brief before asking the user to create", () => {
    const prompt = "I want a campaign for cold cut, the products you can check here https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo";
    const reply = buildHomeCampaignDiscoveryReply(prompt, [
      {
        ok: true,
        url: "https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo",
        title: "Cold Cut Promo | Hilti Hong Kong",
        summary: "Metal Cutting Made Safer, Faster and Cleaner. Save 20% with promo code CUT20.",
        facts: ["Save 20% on cordless cold-cutting solutions with promo code CUT20."]
      }
    ]);

    expect(reply).toContain("Panda researched the linked page before drafting");
    expect(reply).toContain("Cold Cut Promo | Hilti Hong Kong");
    expect(reply).toContain("CUT20");
    expect(reply).toContain("Initial plan to review");
  });

  it("resolves a Home proceed confirmation into an H1 planning draft action", () => {
    const instruction = homeContinuationInstruction(
      "proceed please",
      "I can help start the Missing Inputs and Channel Strategy. For Missing Inputs, do you want me to identify what's missing and assign owners? For Channel Strategy, should I draft the strategy based on the current plan?"
    );

    expect(instruction).toContain("draft remaining H1 planning objects");
    expect(instruction).toContain("Missing Inputs");
    expect(instruction).toContain("Channel Strategy");
  });

  it("treats proceed as confirmation to create a reviewed Home draft", () => {
    expect(isHomeDraftConfirmation("proceed please")).toBe(true);
    expect(isHomeDraftConfirmation("go ahead")).toBe(true);
    expect(isHomeDraftConfirmation("hello panda")).toBe(false);
  });

  it("only creates a Home campaign workspace on explicit create intent", () => {
    expect(shouldCreateHomeWorkspace("create campaign workspace", "plan")).toBe(true);
    expect(shouldCreateHomeWorkspace("please create the campaign planning draft", "plan")).toBe(true);
    expect(shouldCreateHomeWorkspace("This is good enough for a first campaign draft. Create the campaign workspace from this SPEC2SITE draft.", "plan")).toBe(true);
    expect(shouldCreateHomeWorkspace("proceed please", "create")).toBe(true);
    expect(shouldCreateHomeWorkspace("Please show me the assumptions and missing decisions before we create the campaign workspace.", "plan")).toBe(false);
    expect(shouldCreateHomeWorkspace("not yet, show me the assumptions before creating", "create")).toBe(false);
  });

  it("gives role-aware guidance for content creators without making planning review a hard block", () => {
    const reply = buildHomeRoleGuidanceReply("I am a content creator, what should I do for this campaign?");

    expect(reply).toContain("Content");
    expect(reply).toContain("current draft assumptions");
    expect(reply).toContain("copy");
    expect(reply).not.toMatch(/\bH[1-4]\b/);
    expect(reply).not.toMatch(/\bblocked\b/i);
  });

  it("drafts the remaining H1 planning objects when Panda is asked to proceed", () => {
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(createDefaultRun()));
    const updated = applyPlanningInstruction(
      objects,
      "draft remaining H1 planning objects: Missing Inputs, Channel Strategy, Budget Allocation, Campaign Timeline, Assumptions & Risks"
    );

    expect(updated.find((item) => item.id === "channel-strategy")?.status).toBe("in-review");
    expect(updated.find((item) => item.id === "budget-allocation")?.status).toBe("in-review");
    expect(updated.find((item) => item.id === "campaign-timeline")?.status).toBe("in-review");
    expect(updated.find((item) => item.id === "assumptions-risks")?.status).toBe("in-review");
    expect(updated.find((item) => item.id === "missing-inputs")?.status).toBe("in-review");
    expect(updated.find((item) => item.id === "missing-inputs")?.copy).toContain("owners");
  });

  it("restores a persisted app view only when it is valid", () => {
    expect(restoreAppView("content-planning")).toBe("content-planning");
    expect(restoreAppView("rollout")).toBe("rollout");
    expect(restoreAppView("unknown")).toBe("home");
    expect(restoreAppView(null)).toBe("home");
  });

  it("keys workspace Panda messages by campaign and workspace", () => {
    expect(workspaceAgentMessageKey("camp_04", "content-planning")).toBe("camp_04:content-planning");
    expect(workspaceAgentMessageKey("camp_te70", "campaign-planning")).toBe("camp_te70:campaign-planning");
    expect(campaignConversationKey("camp_te70")).toBe("camp_te70:shared");
  });

  it("keeps specialist workspace messages isolated from shared Home chat", () => {
    const shared = [
      { id: "brief", role: "user" as const, text: "Launch a campaign for TE60-22", timestamp: "2026-07-06T01:00:00.000Z" },
      { id: "home", role: "agent" as const, text: "Home Panda created the campaign brief.", timestamp: "2026-07-06T01:00:01.000Z" }
    ];
    const local = [
      { id: "local", role: "agent" as const, text: "Campaign Planning Panda is ready.", timestamp: "2026-07-06T01:00:02.000Z" }
    ];

    expect(visibleWorkspaceMessages(shared, local).map((message) => message.id)).toEqual(["local"]);
  });

  it("compacts agent messages by normalized role and text", () => {
    const messages = [
      { id: "a", role: "agent" as const, text: "I created New campaign · TE30 AVR.", timestamp: "2026-07-06T01:00:00.000Z" },
      { id: "b", role: "agent" as const, text: "I created   New campaign · TE30 AVR.", timestamp: "2026-07-06T01:00:01.000Z" },
      { id: "c", role: "user" as const, text: "launch campaign", timestamp: "2026-07-06T01:00:02.000Z" }
    ];

    expect(compactAgentMessages(messages).map((message) => message.id)).toEqual(["b", "c"]);
  });

  it("uses distinct message keys per campaign and workspace", () => {
    expect(workspaceAgentMessageKey("camp-1", "content-planning")).not.toBe(workspaceAgentMessageKey("camp-1", "content"));
    expect(workspaceAgentMessageKey("camp-1", "content")).not.toBe(workspaceAgentMessageKey("camp-2", "content"));
  });

  it("keeps visible specialist messages local to the specialist", () => {
    const shared = [{ id: "s", role: "user" as const, text: "global", timestamp: "now" }];
    const local = [{ id: "l", role: "agent" as const, text: "local", timestamp: "now" }];
    expect(visibleWorkspaceMessages(shared, local).map((m) => m.text)).toEqual(["local"]);
  });

  it("shares campaign context without leaking another workspace's rendered messages", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const planningObjects = campaignPlanningObjectsFromPlan(plan);
    const contentRequirements = contentRequirementsFromPlan(plan);
    const contentObjects = createContentWorkObjectsFromRequirements(contentRequirements);
    const rolloutObjects = createRolloutWorkObjectsFromContent(contentObjects);
    const packet = buildPandaContextPacket({
      run,
      currentView: "content-planning",
      currentPhase: "content",
      userRole: defaultUserRole,
      campaignPlan: plan,
      planningObjects,
      contentRequirements,
      contentObjects,
      rolloutObjects
    });

    expect(packet.campaign_id).toBe("camp_04");
    expect(packet.campaign_name).toBeTruthy();
    expect(packet.brief).toBeTruthy();
    expect(packet.summary).toBeTruthy();
    expect(packet.phase).toBe("content");
    expect(packet.current_gate).toBe("H2");
    expect(packet.planning_objects.length).toBeGreaterThan(0);
    expect(packet.content_requirements.length).toBeGreaterThan(0);
    expect(packet.content_objects.length).toBeGreaterThan(0);
    expect(packet.rollout_objects.length).toBeGreaterThan(0);
    expect(packet.artifacts).toBeDefined();
    expect(packet.gate_decisions).toBeDefined();
    expect(packet.worklog).toBeDefined();
    expect((packet as Record<string, unknown>).messages).toBeUndefined();
    expect((packet as Record<string, unknown>).conversation_history).toBeUndefined();
  });

  it("builds a shared Panda campaign context packet for all agent surfaces", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const planningObjects = campaignPlanningObjectsFromPlan(plan);
    const contentRequirements = contentRequirementsFromPlan(plan);
    const contentObjects = createContentWorkObjectsFromRequirements(contentRequirements);
    const rolloutObjects = createRolloutWorkObjectsFromContent(contentObjects);
    const packet = buildPandaContextPacket({
      run,
      currentView: "content-planning",
      currentPhase: "content",
      userRole: defaultUserRole,
      campaignPlan: plan,
      planningObjects,
      contentRequirements,
      contentObjects,
      rolloutObjects
    });

    expect(packet.campaign_id).toBe("camp_04");
    expect(packet.current_view).toBe("content-planning");
    expect(packet.current_gate).toBe("H2");
    expect(packet.campaign_plan.name).toBe(plan.name);
    expect(packet.planning_objects).toHaveLength(planningObjects.length);
    expect(packet.content_requirements).toHaveLength(contentRequirements.length);
    expect(packet.content_objects).toHaveLength(contentObjects.length);
    expect(packet.rollout_objects).toHaveLength(rolloutObjects.length);
    expect(packet.user_role).toBe("Campaign Owner");
  });

  it("scopes specialist Panda agents without hiding shared context", () => {
    expect(buildAgentScope("home")).toMatchObject({
      id: "home-orchestrator",
      role: "orchestrator",
      surface: "home",
      allowed_actions: ["ask_brief_question", "create_campaign_when_ready", "route_to_workspace", "explain_status"]
    });
    expect(buildAgentScope("content")).toMatchObject({
      role: "content-specialist",
      surface: "content",
      allowed_actions: expect.arrayContaining(["revise_copy", "check_compliance", "prepare_h2"])
    });
    expect(buildAgentScope("rollout")).toMatchObject({
      role: "rollout-specialist",
      surface: "rollout",
      allowed_actions: expect.arrayContaining(["check_connectors", "prepare_h3"])
    });
  });

  it("drafts an immediate scoped workspace answer while the real agent runs", () => {
    const run = createDefaultRun();
    const packet = buildPandaContextPacket({
      run,
      currentView: "content-planning",
      currentPhase: "content",
      userRole: defaultUserRole,
      campaignPlan: campaignPlanForRun(run),
      planningObjects: campaignPlanningObjectsFromPlan(campaignPlanForRun(run)),
      contentRequirements: contentRequirementsFromPlan(campaignPlanForRun(run)),
      contentObjects: createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(campaignPlanForRun(run))),
      rolloutObjects: []
    });

    const answer = draftWorkspaceAgentAnswer("content-planning", "Which requirements need Figma?", packet);

    expect(answer).toContain("Content Planning Panda");
    expect(answer).toContain("H2");
    expect(answer).toContain("requirements");
    expect(answer).toContain("DeepSeek");
  });

  it("drafts specialist updates for campaign planning without treating edit requests as approval", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const planningObjects = campaignPlanningObjectsFromPlan(plan);
    const packet = buildPandaContextPacket({
      run,
      currentView: "campaign-planning",
      currentPhase: "planning",
      userRole: defaultUserRole,
      campaignPlan: plan,
      planningObjects,
      contentRequirements: contentRequirementsFromPlan(plan),
      contentObjects: [],
      rolloutObjects: []
    });

    const response = draftSpecialistAgentResponse("campaign-planning", "there should be no approval here, update the campaign planning for TE60-22", packet);

    expect(response.answer).toContain("Campaign Planning Panda");
    expect(response.answer).toContain("updated");
    expect(response.answer).not.toContain("H3");
    expect(response.updates.some((update) => update.target === "planning_object")).toBe(true);
  });

  it("applies campaign planning instructions to H1 objects only", () => {
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(createDefaultRun()));
    const updated = applyPlanningInstruction(objects, "update the current campaign to focus on TE60-22 and MOCN audience");
    const objective = updated.find((item) => item.id === "campaign-objective");
    const audience = updated.find((item) => item.id === "target-audience");

    expect(objective?.status).toBe("revision-requested");
    expect(objective?.copy).toContain("TE60-22");
    expect(audience?.copy).toContain("MOCN");
    expect(updated.every((item) => item.gate === "H1")).toBe(true);
  });

  it("updates campaign objective and KPI from brief-like planning input", () => {
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(createDefaultRun()));
    const updated = applyPlanningInstruction(objects, "campaign objective: generate leads kpi: Net sales");
    const objective = updated.find((item) => item.id === "campaign-objective");
    const kpi = updated.find((item) => item.id === "kpi-definition");

    expect(objective?.status).toBe("in-review");
    expect(objective?.copy).toContain("generate leads");
    expect(kpi?.status).toBe("in-review");
    expect(kpi?.copy).toContain("Net sales");
  });

  it("marks channel strategy as an H1 planning deliverable when the owner says it should be completed there", () => {
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(createDefaultRun()));
    const updated = applyPlanningInstruction(objects, "channel stategy should be completed in campaign planning phase. here is I just give you a brief");
    const channelStrategy = updated.find((item) => item.id === "channel-strategy");

    expect(channelStrategy?.status).toBe("in-review");
    expect(channelStrategy?.copy).toContain("H1 campaign-planning deliverable");
    expect(channelStrategy?.evidence).toContain("H1 channel strategy completion");
  });

  it("adds a MOCN audience content requirement from a content planning instruction", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const base = contentRequirementsFromPlan(plan);
    const updated = applyContentPlanningInstruction(base, plan, "please add the content for MOCN audience only");

    expect(updated).toHaveLength(base.length + 1);
    expect(updated.at(-1)).toMatchObject({
      id: "mocn-audience-content",
      channel: "Paid Media",
      assetType: "MOCN audience content",
      locale: "master",
      owner: "Paid Media",
      rolloutTarget: "Paid Media",
      source: "Content Planning matrix"
    });
    expect(updated.at(-1)?.title).toContain("MOCN audience");
    expect(updated.at(-1)?.evidence).toContain("Panda instruction: MOCN audience only");
  });

  it("creates a CP1 creative concept deliverable patch from a content planning instruction", () => {
    const plan = campaignPlanForRun(createDefaultRun({ name: "TE2-22 Launch" }));
    const patch = contentPlanningDeliverablePatchFromInstruction(plan, "please create the cp1 creatieve concept");

    expect(patch?.id).toBe("cp1-creative-concept");
    expect(patch?.patch.status).toBe("in-review");
    expect(patch?.patch.previewItems?.[0]).toContain("Built for the Job");
    expect(patch?.patch.artifactDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Big idea", value: expect.stringContaining("Built for the Job") }),
        expect.objectContaining({ label: "Key message" }),
        expect.objectContaining({ label: "Visual direction" })
      ])
    );
    expect(patch?.patch.discussionNotes?.join(" ")).toContain("Panda created the creative concept");
  });

  it("drafts a specialist update when Content Planning Panda creates the creative concept", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const packet = buildPandaContextPacket({
      run,
      currentView: "content-planning",
      currentPhase: "content",
      userRole: defaultUserRole,
      campaignPlan: plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
      contentObjects: createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(plan)),
      rolloutObjects: []
    });

    const response = draftSpecialistAgentResponse("content-planning", "please create the cp1 creative concept", packet);

    expect(response.answer).toContain("created the creative concept");
    expect(response.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "rmb_deliverable", id: "cp1-creative-concept" })
      ])
    );
  });

  it("creates a real H1 MarCom deliverable patch from a campaign planning instruction", () => {
    const plan = campaignPlanForRun(createDefaultRun({ name: "TE2-22 Launch" }));
    const objects = campaignPlanningObjectsFromPlan(plan);
    const patch = campaignPlanningDeliverablePatchFromInstruction(plan, objects, "please create the H1 MarCom planning packet");

    expect(patch?.id).toBe("marcom-plan");
    expect(patch?.patch.status).toBe("in-review");
    expect(patch?.patch.previewItems?.[0]).toContain(campaignThemeHeadline(plan.heroProduct));
    expect(patch?.patch.artifactDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Campaign theme", value: expect.stringContaining(plan.heroProduct) }),
        expect.objectContaining({ label: "Objective and KPIs" }),
        expect.objectContaining({ label: "Audience" }),
        expect.objectContaining({ label: "Channel overview" })
      ])
    );
    expect(patch?.patch.artifactDetails?.find((item) => item.label === "Campaign theme")?.value).toContain(campaignThemeHeadline(plan.heroProduct));
    expect(patch?.patch.discussionNotes?.join(" ")).toContain("Panda created MarCom Planning Packet");
  });

  it("builds a scoped revision prompt for a specific artifact", () => {
    const deliverable = campaignPlanningDeliverables(campaignPlanForRun(createDefaultRun())).find((item) => item.id === "marcom-plan");

    expect(deliverable).toBeDefined();
    const prompt = artifactRevisionPrompt(deliverable!);

    expect(prompt).toContain(deliverable!.title);
    expect(prompt).toContain("Campaign theme");
    expect(prompt).toContain(deliverable!.handoffTarget);
    expect(prompt).toContain("Revise");
  });

  it("revises CP1 creative concept when asked to revise the object", () => {
    const plan = campaignPlanForRun(createDefaultRun({ name: "TE 70 Heavy-Duty Launch" }));
    const patch = contentPlanningDeliverablePatchFromInstruction(plan, "revise the CP1 creative concept with a stronger campaign theme");

    expect(patch?.id).toBe("cp1-creative-concept");
    expect(patch?.patch.artifactDetails?.find((item) => item.label === "Big idea")?.value).toContain(campaignThemeHeadline(plan.heroProduct));
    expect(patch?.patch.previewItems?.[0]).toContain(campaignThemeHeadline(plan.heroProduct));
  });

  it("drafts a specialist update when Campaign Planning Panda creates an H1 artifact", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const packet = buildPandaContextPacket({
      run,
      currentView: "campaign-planning",
      currentPhase: "planning",
      userRole: defaultUserRole,
      campaignPlan: plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
      contentObjects: [],
      rolloutObjects: []
    });

    const response = draftSpecialistAgentResponse("campaign-planning", "please create the H1 MarCom planning packet", packet);

    expect(response.answer).toContain("created Campaign plan");
    expect(response.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "rmb_deliverable", id: "marcom-plan" })
      ])
    );
  });

  it("does not duplicate the MOCN audience requirement", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const once = applyContentPlanningInstruction(contentRequirementsFromPlan(plan), plan, "add MOCN audience content");
    const twice = applyContentPlanningInstruction(once, plan, "please add the content for MOCN audience only");

    expect(twice.filter((item) => item.id === "mocn-audience-content")).toHaveLength(1);
  });

  it("builds leadership preview slides for campaign and content planning", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const campaignSlides = buildPlanPreviewSlides("campaign-planning", plan, contentRequirementsFromPlan(plan));
    const contentSlides = buildPlanPreviewSlides("content-planning", plan, contentRequirementsFromPlan(plan));

    expect(campaignSlides[0].title).toContain(plan.name);
    expect(campaignSlides.some((slide) => slide.title === "Decision Ask")).toBe(true);
    expect(contentSlides.some((slide) => slide.title === "Content Requirement Matrix")).toBe(true);
    expect(contentSlides.some((slide) => slide.bullets.some((bullet) => bullet.includes("requirements")))).toBe(true);
  });

  it("creates a simulated leadership deck filename", () => {
    expect(simulatedPlanDeckFilename("campaign-planning", "camp_04", 2)).toBe("camp_04-H1-leadership-plan-v2.pptx");
    expect(simulatedPlanDeckFilename("content-planning", "camp_04", 1)).toBe("camp_04-H2-content-plan-v1.pptx");
  });

  it("turns leadership feedback into proposed changes", () => {
    const proposal = buildLeadershipFeedbackProposal("content-planning", "Leadership wants MOCN audience only and clearer KPI.");

    expect(proposal.summary).toContain("2 proposed");
    expect(proposal.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "add-mocn-content", action: "add-content-requirement" }),
        expect.objectContaining({ id: "clarify-kpi", action: "revise-plan-note" })
      ])
    );
  });

  it("declares the current and future model stack for the agent cockpit", () => {
    const stack = agentStackItems();

    expect(stack).toContainEqual({
      lane: "Reasoning",
      model: "DeepSeek",
      status: "active",
      note: "Live campaign operator"
    });
    expect(stack.some((item) => item.model.includes("Gemini") && item.status === "placeholder")).toBe(true);
    expect(stack.some((item) => item.lane === "Creative" && item.status === "placeholder")).toBe(true);
  });

  it("exposes the approved Panda product navigation without Coverage or Tools", () => {
    const labels = navigationItems.map((item) => item.label);

    expect(labels).toEqual([
      "Home",
      "Progress",
      "Campaign Planning",
      "Content Planning",
      "Content",
      "Rollout",
      "Optimize",
      "Skills"
    ]);
    expect(labels).not.toContain("Coverage");
    expect(labels).not.toContain("Tools");
  });

  it("defaults Progress ownership to Campaign Owner for the active campaign", () => {
    const progress = progressForCampaign(createDefaultRun(), defaultUserRole);

    expect(defaultUserRole).toBe("Campaign Owner");
    expect(progress.campaignId).toBe("camp_04");
    expect(progress.role).toBe("Campaign Owner");
    expect(progress.workflowStatus.map((item) => item.label)).toEqual([
      "Campaign Planning",
      "Content Planning",
      "Content",
      "Rollout",
      "Optimize"
    ]);
    expect(progress.myTasks.length).toBeGreaterThan(0);
  });

  it("routes progress detail actions to the relevant workflow workspace", () => {
    expect(progressTaskDetailRoute("Review H1 readiness")).toBe("campaign-planning");
    expect(progressTaskDetailRoute("Review channel copy, Figma mapping, and claims")).toBe("content-planning");
    expect(progressTaskDetailRoute("Approve content pieces by channel")).toBe("content");
    expect(progressTaskDetailRoute("Prepare SFMC email and journey evidence")).toBe("rollout");
    expect(progressTaskDetailRoute("Review H4 performance recommendations")).toBe("optimize");
  });

  it("defines Skills as mock knowledge and tool integration capabilities", () => {
    const skills = skillCapabilityItems();

    expect(skills.some((item) => item.name === "Brand Playbook" && item.category === "knowledge")).toBe(true);
    expect(skills.some((item) => item.name === "Figma" && item.category === "integration")).toBe(true);
    expect(skills.every((item) => ["active", "mock", "needs setup"].includes(item.status))).toBe(true);
  });

  it("defines Content as the canonical granular approval workspace", () => {
    expect(contentWorkObjects.length).toBeGreaterThan(6);
    expect(contentWorkObjects.some((item) => item.channel === "Paid Media" && item.actions.includes("Ask AI to revise"))).toBe(true);
    expect(contentWorkObjects.some((item) => item.channel === "Email" && item.actions.includes("Approve"))).toBe(true);
    expect(contentWorkObjects.every((item) => item.comments.length >= 1 && item.gate === "H2")).toBe(true);
  });

  it("turns campaign planning into a reusable cross-workstream campaign plan", () => {
    const plan = campaignPlanForRun(createDefaultRun());

    expect(plan.campaignId).toBe("camp_04");
    expect(plan.locales).toEqual(["de-DE", "de-AT", "de-CH", "fr-CH"]);
    expect(plan.channels.map((channel) => channel.name)).toEqual([
      "Paid Media",
      "Email",
      "HOL Landing Page",
      "Organic / HN",
      "Banner"
    ]);
    expect(plan.channels.find((channel) => channel.name === "Paid Media")?.requiredAssets).toContain("Search ad headline");
    expect(plan.kpis).toContain("H3 publish readiness without auto-publish");
  });

  it("defines RMB campaign planning deliverables with requested output formats", () => {
    const plan = campaignPlanForRun(createDefaultRun());
    const deliverables = campaignPlanningDeliverables(plan);

    expect(deliverables.map((item) => item.id)).toEqual([
      "marcom-plan",
      "paid-media-plan",
      "hol-journey-map",
      "email-ta-brief",
      "organic-hn-strategy"
    ]);
    expect(deliverables.find((item) => item.id === "paid-media-plan")?.outputFormats).toEqual(["Excel", "PPTX"]);
    expect(deliverables.find((item) => item.id === "paid-media-plan")?.sections).toEqual(
      expect.arrayContaining(["Platform mix", "Budget split", "Projected KPIs", "Testing roadmap"])
    );
    expect(deliverables.every((item) => item.gate === "H1" && item.previewItems.length > 0)).toBe(true);
    const visibleCopy = deliverables
      .flatMap((item) => [
        item.title,
        item.summary,
        item.workspaceAction,
        ...item.previewItems,
        ...item.sourceInputs,
        ...item.discussionNotes,
        ...item.artifactDetails.map((detail) => `${detail.label}: ${detail.value}`),
      ])
      .join(" ");
    expect(visibleCopy).not.toMatch(/\bH1\b/);
    expect(visibleCopy).not.toMatch(/\bgate\b/i);
  });

  it("renders a campaign theme that sounds like a real theme line", () => {
    const plan = campaignPlanForRun(createDefaultRun({ name: "TE 70 Heavy-Duty Launch" }));
    const theme = campaignThemeForPlan(plan);

    expect(theme).toContain(campaignThemeHeadline(plan.heroProduct));
    expect(theme).toContain(plan.heroProduct);
    expect(theme).not.toContain("proof-led Hilti value story");
  });

  it("hands campaign planning into content planning requirements", () => {
    const requirements = contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun()));

    expect(requirements.length).toBeGreaterThan(7);
    expect(requirements.some((item) => item.channel === "Paid Media" && item.assetType === "Search ad headline")).toBe(true);
    expect(requirements.some((item) => item.channel === "Email" && item.assetType === "Hero section")).toBe(true);
    expect(requirements.some((item) => item.channel === "HOL Landing Page" && item.rolloutTarget === "Contentful")).toBe(true);
    expect(requirements.some((item) => item.locale === "fr-CH" && item.source === "Content Planning matrix")).toBe(true);
    expect(requirements[0].title).toContain("SIW 6AT-A22");
    expect(requirements.every((item) => item.evidence.includes("Campaign plan"))).toBe(true);
  });

  it("defines RMB content planning deliverables for CP1 through CP4 outputs", () => {
    const plan = campaignPlanForRun(createDefaultRun());
    const requirements = contentRequirementsFromPlan(plan);
    const deliverables = contentPlanningDeliverables(plan, requirements);
    const creativeConcept = deliverables.find((item) => item.id === "cp1-creative-concept");

    expect(deliverables.map((item) => item.id)).toEqual([
      "cp1-creative-concept",
      "cp2-requirements-matrix",
      "cp3-storyboard",
      "cp4-figma-mapping"
    ]);
    expect(deliverables.find((item) => item.id === "cp2-requirements-matrix")?.outputFormats).toEqual(["Excel"]);
    expect(deliverables.find((item) => item.id === "cp4-figma-mapping")?.outputFormats).toEqual(["Figma mock", "Mapping table"]);
    expect(deliverables.every((item) => item.gate === "H2" && item.approvalLevel === "object-and-final")).toBe(true);
    expect(creativeConcept?.artifactDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Head" }),
        expect.objectContaining({ label: "Heart" }),
        expect.objectContaining({ label: "Hands" })
      ])
    );
    expect(creativeConcept?.discussionNotes.join(" ")).toContain("Panda");
  });

  it("generates content work objects from the content planning matrix", () => {
    const requirements = contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun()));
    const objects = createContentWorkObjectsFromRequirements(requirements);

    expect(objects).toHaveLength(requirements.length);
    expect(objects.every((item) => item.gate === "H2")).toBe(true);
    expect(objects.some((item) => item.title.includes("fr-CH") && item.channel === "Email")).toBe(true);
    expect(objects.every((item) => item.evidence.includes("Content Planning matrix"))).toBe(true);
    expect(objects.every((item) => item.actions.includes("Approve") || item.actions.includes("Flag compliance"))).toBe(true);
  });

  it("defines RMB content creation deliverables with production and export outputs", () => {
    const plan = campaignPlanForRun(createDefaultRun());
    const objects = createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(plan));
    const deliverables = contentCreationDeliverables(objects);
    const paidMediaCopy = deliverables.find((item) => item.id === "paid-media-copy");

    expect(deliverables.map((item) => item.id)).toEqual([
      "paid-media-copy",
      "organic-hn-content",
      "landing-page-mockup",
      "email-copy",
      "email-basefile",
      "image-assets",
      "video-assets",
      "asset-formatting",
      "compliance-report"
    ]);
    expect(deliverables.find((item) => item.id === "email-basefile")?.outputFormats).toEqual(["XLS"]);
    expect(deliverables.find((item) => item.id === "compliance-report")?.sections).toEqual(
      expect.arrayContaining(["Brand rules", "Legal claims", "AI guidelines", "Ready for upload"])
    );
    expect(deliverables.every((item) => item.gate === "H2" && item.workspace === "Content")).toBe(true);
    expect(paidMediaCopy?.artifactDetails.some((detail) => detail.value.includes("Search ad headline"))).toBe(true);
    expect(paidMediaCopy?.discussionNotes.some((note) => note.includes("Content Planning matrix"))).toBe(true);
  });

  it("hands approved content work into rollout build objects", () => {
    const content = createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun())))
      .map((item) => ({ ...item, status: "approved" as const }));
    const rollout = createRolloutWorkObjectsFromContent(content);

    expect(rollout.map((item) => item.lane)).toEqual([
      "Paid Media",
      "Contentful",
      "Sprinklr",
      "SFMC",
      "UTM / QA",
      "Publish Readiness"
    ]);
    expect(rollout.every((item) => item.gate === "H3")).toBe(true);
    expect(rollout.find((item) => item.lane === "Contentful")?.sourceContentIds.length).toBeGreaterThan(0);
    expect(rollout.find((item) => item.lane === "UTM / QA")?.evidence).toContain("Approved H2 content objects");
    expect(rollout.find((item) => item.lane === "Publish Readiness")?.status).toBe("in-review");
  });

  it("only creates source-specific rollout lanes for channels in the campaign plan", () => {
    const run = createDefaultRun({
      brief:
        "Launch a Benelux firestop campaign for facility managers. Budget EUR 80k. Markets NL, BE. Locales nl-NL, fr-BE. Channels LinkedIn, Email, HOL. No auto-publish."
    });
    const content = createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(campaignPlanForRun(run)));
    const rollout = createRolloutWorkObjectsFromContent(content);

    expect(rollout.map((item) => item.lane)).toEqual(["Paid Media", "Contentful", "SFMC", "UTM / QA", "Publish Readiness"]);
    expect(rollout.some((item) => item.lane === "Sprinklr")).toBe(false);
  });

  it("derives the handoff plan from a new campaign brief instead of the seed campaign", () => {
    const run = createDefaultRun({
      campaignId: "camp_custom",
      name: "Benelux Firestop Launch",
      brief:
        "Launch a Benelux firestop campaign for facility managers. Budget EUR 80k. Markets NL, BE. Locales nl-NL, fr-BE. Channels LinkedIn, Email, HOL. No auto-publish."
    });
    const plan = campaignPlanForRun(run);
    const requirements = contentRequirementsFromPlan(plan);

    expect(plan.heroProduct).toBe("firestop");
    expect(plan.markets).toEqual(["NL", "BE"]);
    expect(plan.locales).toEqual(["nl-NL", "fr-BE"]);
    expect(plan.audience).toContain("Facility managers");
    expect(plan.budget).toBe("EUR 80k");
    expect(plan.channels.map((channel) => channel.name)).toEqual(["Paid Media", "Email", "HOL Landing Page"]);
    expect(requirements.some((item) => item.title.toLowerCase().includes("firestop"))).toBe(true);
    expect(requirements.some((item) => item.locale === "fr-BE")).toBe(true);
  });

  it("prefers the agent generated campaign-plan artifact when present", () => {
    const run = createDefaultRun({
      artifacts: [
        {
          id: "agent-plan",
          name: "Campaign Plan",
          type: "campaign-plan.v3",
          content: "Agent-generated plan",
          phase: "planning",
          createdAt: "2026-07-05T00:00:00.000Z",
          data: {
            heroProduct: "measuring tools",
            markets: ["US"],
            locales: ["en-US", "es-US"],
            audience: ["General contractors"],
            budget: "USD 120k",
            channels: [
              {
                id: "paid-media",
                name: "Paid Media",
                owner: "Paid Media",
                objective: "Launch demand generation",
                requiredAssets: ["Search ad headline", "CTA"],
                rolloutTarget: "Paid Media"
              },
              {
                id: "email",
                name: "Email",
                owner: "Email TA",
                objective: "Nurture known buyers",
                requiredAssets: ["Hero section"],
                rolloutTarget: "SFMC"
              }
            ],
            kpis: ["Qualified visits"],
            assumptions: ["Agent supplied plan"]
          }
        }
      ]
    });

    const plan = campaignPlanForRun(run);

    expect(plan.heroProduct).toBe("measuring tools");
    expect(plan.locales).toEqual(["en-US", "es-US"]);
    expect(plan.channels).toHaveLength(2);
    expect(plan.assumptions).toContain("Agent supplied plan");
  });

  it("prefers a runtime snapshot plan over the artifact plan when present", () => {
    const run = createDefaultRun({
      artifacts: [
        {
          id: "agent-plan",
          name: "Campaign Plan",
          type: "campaign-plan.v3",
          content: "Agent-generated plan",
          phase: "planning",
          createdAt: "2026-07-05T00:00:00.000Z",
          data: {
            heroProduct: "artifact product",
            markets: ["US"],
            locales: ["en-US"],
            audience: ["Artifact audience"],
            budget: "USD 120k",
            channels: [],
            kpis: ["Artifact KPI"],
            assumptions: ["Artifact supplied plan"]
          }
        }
      ],
      snapshot: {
        plan: {
          campaignId: "camp_04",
          name: "Snapshot Plan",
          heroProduct: "snapshot product",
          markets: ["JP"],
          locales: ["ja-JP"],
          audience: ["Snapshot audience"],
          budget: "JPY 200k",
          timeline: "Snapshot timeline",
          channels: [
            {
              id: "paid-media",
              name: "Paid Media",
              owner: "Paid Media",
              objective: "Snapshot objective",
              requiredAssets: ["Search ad headline"],
              rolloutTarget: "Paid Media"
            }
          ],
          kpis: ["Snapshot KPI"],
          assumptions: ["Snapshot supplied plan"]
        }
      },
    });

    const plan = campaignPlanForRun(run);

    expect(plan.heroProduct).toBe("snapshot product");
    expect(plan.markets).toEqual(["JP"]);
    expect(plan.channels).toHaveLength(1);
    expect(plan.assumptions).toContain("Snapshot supplied plan");
  });

  it("normalizes durable campaign snapshots with visible plan markets", () => {
    const snapshot = normalizeCampaignSnapshot({
      campaign: { id: "camp_04", name: "Campaign", brief: "", phase: "planning", activeGate: "H1", ownerRole: "Campaign Owner" },
      plan: {
        campaignId: "camp_04",
        name: "Campaign",
        heroProduct: "TE2-22",
        markets: ["China", "Japan", "Australia"],
        locales: ["zh-CN", "ja-JP", "en-AU"],
        audience: ["Contractors"],
        budget: "EUR 50k",
        timeline: "Q4",
        channels: [],
        kpis: ["Net sales"],
        assumptions: [],
      },
      workObjects: [],
      contentRequirements: [],
      gateDecisions: [],
      events: [],
      agentThreads: [],
    });

    expect(snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);
  });

  it("falls back from malformed snapshot arrays without erasing visible plan data", () => {
    const snapshot = normalizeCampaignSnapshot({
      campaign: { id: "camp_04", name: "Campaign", brief: "", phase: "planning", activeGate: "H1", ownerRole: "Campaign Owner" },
      plan: {
        campaignId: "camp_04",
        name: "Campaign",
        heroProduct: "TE2-22",
        markets: ["China", "Japan", "Australia"],
        locales: [],
        audience: [],
        budget: "EUR 50k",
        timeline: "Q4",
        channels: [],
        kpis: [],
        assumptions: [],
      },
      workObjects: [],
      contentRequirements: [],
      gateDecisions: [],
      events: [],
      agentThreads: [],
    });

    expect(snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);
    expect(snapshot.plan.locales).toEqual(["de-DE", "de-AT", "de-CH", "fr-CH"]);
    expect(snapshot.plan.audience).toEqual(["Contractors", "Specifiers"]);
    expect(snapshot.plan.kpis).toEqual(["Qualified HOL visits", "H3 publish readiness without auto-publish"]);
    expect(snapshot.plan.assumptions).toEqual(["Agent-generated plan normalized by Panda."]);
  });

  it("derives work and content requirements when snapshot arrays are empty", () => {
    const snapshot = normalizeCampaignSnapshot({
      campaign: { id: "camp_04", name: "Campaign", brief: "", phase: "planning", activeGate: "H1", ownerRole: "Campaign Owner" },
      plan: {
        campaignId: "camp_04",
        name: "Campaign",
        heroProduct: "TE2-22",
        markets: ["China", "Japan", "Australia"],
        locales: ["zh-CN", "ja-JP", "en-AU"],
        audience: ["Contractors"],
        budget: "EUR 50k",
        timeline: "Q4",
        channels: [],
        kpis: ["Net sales"],
        assumptions: [],
      },
      workObjects: [],
      contentRequirements: [],
      gateDecisions: [],
      events: [],
      agentThreads: [],
    });

    expect(snapshot.workObjects).toHaveLength(8);
    expect(snapshot.workObjects[0].title).toBe("Campaign Objective");
    expect(snapshot.contentRequirements.length).toBeGreaterThan(7);
    expect(snapshot.contentRequirements.some((item) => item.channel === "Paid Media" && item.assetType === "Search ad headline")).toBe(true);
  });

  it("detects explicit runtime evidence instead of a bare snapshot object", () => {
    expect(runtimeSnapshotHasEvidence(undefined)).toBe(false);
    expect(runtimeSnapshotHasEvidence({})).toBe(false);
    expect(runtimeSnapshotHasEvidence({ events: [] })).toBe(false);
    expect(runtimeSnapshotHasEvidence({ workObjects: [] })).toBe(false);
    expect(runtimeSnapshotHasEvidence({ workObjects: [{}] })).toBe(false);
    expect(runtimeSnapshotHasEvidence({ gateDecisions: [{}] })).toBe(false);
    expect(runtimeSnapshotHasEvidence({ events: [{ id: "evt_1" }] })).toBe(true);
    expect(runtimeSnapshotHasEvidence({ workObjects: [{ id: "objective" }] })).toBe(true);
  });

  it("loads workspace runtime snapshots only when they have evidence", () => {
    const workspace = {
      activeCampaignId: "camp_04",
      campaigns: [
        {
          ...createDefaultRun(),
          campaignId: "camp_04",
          snapshot: { events: [{ id: "evt_1" }] }
        },
        {
          ...createDefaultRun(),
          campaignId: "camp_05",
          snapshot: {}
        }
      ],
      messages: { camp_04: [], camp_05: [] }
    };

    expect(runtimeSnapshotsFromWorkspace(workspace)).toHaveProperty("camp_04");
    expect(runtimeSnapshotsFromWorkspace(workspace)).not.toHaveProperty("camp_05");
    expect(runtimeSnapshotEvidenceFromWorkspace(workspace)).toEqual({ camp_04: true });
  });

  it("suppresses local replay only for evidence, explicit no-replay, or commit-unavailable snapshots", () => {
    expect(shouldSuppressLocalReplay({ snapshot: {}, no_replay: false })).toBe(false);
    expect(shouldSuppressLocalReplay({ snapshot: { workObjects: [{}] }, no_replay: false })).toBe(false);
    expect(shouldSuppressLocalReplay({ snapshot: { events: [{ id: "evt_1" }] }, no_replay: false })).toBe(true);
    expect(shouldSuppressLocalReplay({ snapshot: {}, no_replay: true })).toBe(true);
    expect(shouldSuppressLocalReplay({ snapshot: {}, snapshot_status: "unavailable_after_commit" })).toBe(true);
  });

  it("keeps the active campaign id when a runtime snapshot id is malformed", () => {
    expect(runtimeSnapshotCampaignId({ campaign: { id: "" } }, "camp_04")).toBe("camp_04");
    expect(runtimeSnapshotCampaignId({ campaign: { id: "campaign-unknown" } }, "camp_04")).toBe("camp_04");
    expect(runtimeSnapshotCampaignId({ campaign: { id: "oops-123" } }, "camp_04")).toBe("camp_04");
    expect(runtimeSnapshotCampaignId({ campaign: { id: "camp_05" } }, "camp_04")).toBe("camp_05");
  });

  it("turns the campaign plan into H1 planning work objects", () => {
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(createDefaultRun()));

    expect(objects.map((item) => item.title)).toEqual([
      "Campaign Objective",
      "Target Audience",
      "KPI Definition",
      "Channel Strategy",
      "Budget Allocation",
      "Campaign Timeline",
      "Assumptions & Risks",
      "Missing Inputs"
    ]);
    expect(objects.every((item) => item.gate === "H1" && item.source === "CampaignPlan")).toBe(true);
    expect(objects.find((item) => item.title === "Channel Strategy")?.copy).toContain("Paid Media");
    expect(objects.find((item) => item.title === "KPI Definition")?.copy).toContain("H3 publish readiness");
  });

  it("keeps new campaign planning work objects aligned to the custom brief", () => {
    const run = createDefaultRun({
      campaignId: "camp_custom",
      name: "Benelux Firestop Launch",
      brief:
        "Launch a Benelux firestop campaign for facility managers. Budget EUR 80k. Markets NL, BE. Locales nl-NL, fr-BE. Channels LinkedIn, Email, HOL. No auto-publish."
    });
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(run));

    expect(objects.find((item) => item.title === "Campaign Objective")?.copy).toContain("firestop");
    expect(objects.find((item) => item.title === "Target Audience")?.copy).toContain("Facility managers");
    expect(objects.find((item) => item.title === "Budget Allocation")?.copy).toContain("EUR 80k");
    expect(objects.find((item) => item.title === "Campaign Timeline")?.copy).toContain("nl-NL");
    expect(objects.find((item) => item.title === "Channel Strategy")?.copy).not.toContain("Organic / HN");
  });

  it("scores campaign planning readiness for inline H1 approval", () => {
    const objects = campaignPlanningObjectsFromPlan(campaignPlanForRun(createDefaultRun())).map((item, index) =>
      index < 3 ? { ...item, status: "approved" as const } : item
    );
    const readiness = campaignPlanningReadiness(objects);

    expect(readiness.approved).toBe(3);
    expect(readiness.total).toBe(8);
    expect(readiness.blocked).toBe(1);
    expect(readiness.revision).toBe(0);
    expect(readiness.pct).toBe(38);
  });

  it("summarizes content object readiness for the canonical workspace", () => {
    const objects = createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun())))
      .map((item, index) => index < 2 ? { ...item, status: "approved" as const } : item);
    const readiness = contentWorkspaceReadiness(objects);

    expect(readiness.total).toBe(objects.length);
    expect(readiness.approved).toBe(2);
    expect(readiness.blocked).toBeGreaterThan(0);
    expect(readiness.channels).toContain("Paid Media");
    expect(readiness.pct).toBe(Math.round((2 / objects.length) * 100));
  });

  it("builds the RMB CP1-CP4 content planning bridge package", () => {
    const plan = campaignPlanForRun(createDefaultRun());
    const requirements = contentRequirementsFromPlan(plan);
    const bridge = buildContentPlanningBridge(plan, requirements);

    expect(bridge.creativeConcept.storyId).toBe("CP1");
    expect(bridge.requirements.storyId).toBe("CP2");
    expect(bridge.storyboard.storyId).toBe("CP3");
    expect(bridge.figmaBoard.storyId).toBe("CP4");
    expect(bridge.creativeConcept.head).toContain(campaignThemeHeadline(plan.heroProduct));
    expect(bridge.requirements.rows.length).toBe(requirements.length);
    expect(bridge.storyboard.frames.length).toBeGreaterThan(0);
    expect(bridge.figmaBoard.frames.length).toBeGreaterThan(0);
    expect(bridge.figmaBoard.mappingStatus).toBe("ready-to-create");
  });

  it("requires CP1-CP4 object approval before final H2 approval", () => {
    const bridge = buildContentPlanningBridge(campaignPlanForRun(createDefaultRun()), contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun())));

    expect(contentPlanningBridgeReadiness(bridge).readyForH2).toBe(false);
    expect(contentPlanningBridgeReadiness(bridge).approved).toBe(0);

    const approved = {
      ...bridge,
      creativeConcept: { ...bridge.creativeConcept, status: "approved" as const },
      requirements: { ...bridge.requirements, status: "approved" as const },
      storyboard: { ...bridge.storyboard, status: "approved" as const },
      figmaBoard: { ...bridge.figmaBoard, status: "approved" as const }
    };

    expect(contentPlanningBridgeReadiness(approved).approved).toBe(4);
    expect(contentPlanningBridgeReadiness(approved).readyForH2).toBe(true);
  });

  it("summarizes rollout readiness from lane-level publish objects", () => {
    const content = createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun())))
      .map((item) => ({ ...item, status: "approved" as const }));
    const rollout = createRolloutWorkObjectsFromContent(content);
    const readiness = rolloutWorkspaceReadiness(rollout);

    expect(readiness.total).toBe(rollout.length);
    expect(readiness.approved).toBe(0);
    expect(readiness.blocked).toBe(0);
    expect(readiness.lanes).toContain("Contentful");
    expect(readiness.sourceObjects).toBe(content.length);
  });

  it("requires all active content objects to be approved before H2 gate approval is ready", () => {
    const plan = campaignPlanForRun(createDefaultRun());
    const content = createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(plan));

    const blocked = gateApprovalReadiness({
      phase: "content",
      planningObjects: [],
      contentObjects: content,
      rolloutObjects: [],
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.reason).toContain("Approve every active content object");

    const approved = gateApprovalReadiness({
      phase: "content",
      planningObjects: [],
      contentObjects: content.map((item) => ({ ...item, status: "approved" as const })),
      rolloutObjects: [],
    });
    expect(approved.ready).toBe(true);
  });

  it("normalizes valid server specialist updates", () => {
    const result = normalizeServerUpdates([
      { action: "update_content_requirements", note: "Add MOCN-only content.", payload: { audience: "MOCN" } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      action: "update_content_requirements",
      note: "Add MOCN-only content.",
      targetId: undefined,
      status: undefined,
      payload: { audience: "MOCN" },
    });
  });

  it("accepts update_campaign_plan server updates", () => {
    const result = normalizeServerUpdates([
      { action: "update_campaign_plan", note: "Refresh the campaign plan.", payload: { markets: ["JP"] } },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      action: "update_campaign_plan",
      note: "Refresh the campaign plan.",
      targetId: undefined,
      status: undefined,
      payload: { markets: ["JP"] },
    });
  });

  it("filters out server updates with disallowed actions", () => {
    const result = normalizeServerUpdates([
      { action: "publish_campaign", note: "Publish now." },
      { action: "update_planning_object", note: "Valid planning update." },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("update_planning_object");
  });

  it("filters out server updates missing a note", () => {
    const result = normalizeServerUpdates([
      { action: "update_content_requirements" },
      { action: "update_rollout_lane", note: "" },
      { action: "update_content_object", note: "Valid note." },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("update_content_object");
  });

  it("limits server updates to 8", () => {
    const manyUpdates = Array.from({ length: 12 }, (_, i) => ({
      action: "update_content_requirements" as const,
      note: `Update ${i + 1}`,
    }));
    const result = normalizeServerUpdates(manyUpdates);
    expect(result).toHaveLength(8);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeServerUpdates(null)).toEqual([]);
    expect(normalizeServerUpdates(undefined)).toEqual([]);
    expect(normalizeServerUpdates("not an array")).toEqual([]);
    expect(normalizeServerUpdates({ updates: [] })).toEqual([]);
  });

  it("returns an empty array when all updates are invalid", () => {
    const result = normalizeServerUpdates([
      { action: "bad_action", note: "nope" },
      { note: "missing action" },
      null,
    ]);
    expect(result).toEqual([]);
  });

  it("trims notes to 500 characters", () => {
    const longNote = "x".repeat(600);
    const result = normalizeServerUpdates([
      { action: "update_planning_object", note: longNote },
    ]);
    expect(result[0].note).toHaveLength(500);
  });

  it("strips invalid server update status values", () => {
    const result = normalizeServerUpdates([
      { action: "update_planning_object", note: "Bad status.", status: "published" },
    ]);
    expect(result[0].status).toBeUndefined();
  });

  it("summarizes skills as knowledge and integration capability groups", () => {
    const summary = skillHubSummary(skillCapabilityItems());

    expect(summary.knowledge).toBeGreaterThan(0);
    expect(summary.integrations).toBeGreaterThan(0);
    expect(summary.active).toBeGreaterThan(0);
    expect(summary.mockOrNeedsSetup).toBeGreaterThan(0);
    expect(summary.workflowCoverage).toContain("Campaign Planning");
    expect(summary.workflowCoverage).toContain("Rollout");
  });
});
