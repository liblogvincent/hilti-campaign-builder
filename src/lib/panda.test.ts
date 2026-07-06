import { describe, expect, it } from "vitest";
import {
  artifactMetadataComplete,
  agentModeForPhase,
  agentStackItems,
  buildAgentScope,
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
  createDefaultRun,
  createRolloutWorkObjectsFromContent,
  displayCampaignSummary,
  draftWorkspaceAgentAnswer,
  applyContentPlanningInstruction,
  buildLeadershipFeedbackProposal,
  buildPlanPreviewSlides,
  buildContentPlanningBridge,
  buildHomeCampaignDiscoveryReply,
  campaignConversationKey,
  classifyHomeIntent,
  contentPlanningBridgeReadiness,
  compactAgentMessages,
  simulatedPlanDeckFilename,
  currentPhaseMeta,
  defaultUserRole,
  draftSpecialistAgentResponse,
  homeRouteAfterCampaignLaunch,
  isHomeCampaignCreationIntent,
  navigationItems,
  nextPhase,
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

  it("creates a campaign only when the user gives a launch action and enough brief detail", () => {
    expect(classifyHomeIntent("create campaign for TE70 in DACH for installers with paid media and email").type).toBe("create-campaign");
  });

  it("asks campaign brief questions before creating a shallow campaign", () => {
    const reply = buildHomeCampaignDiscoveryReply("launch a campaign for TE60-22");

    expect(reply).toContain("TE60-22");
    expect(reply).toContain("audience");
    expect(reply).toContain("markets");
    expect(reply).toContain("channels");
    expect(reply).toContain("create it");
    expect(reply).toContain("brief");
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

  it("combines shared campaign conversation before workspace-specific agent history", () => {
    const shared = [
      { id: "brief", role: "user" as const, text: "Launch a campaign for TE60-22", timestamp: "2026-07-06T01:00:00.000Z" },
      { id: "home", role: "agent" as const, text: "Home Panda created the campaign brief.", timestamp: "2026-07-06T01:00:01.000Z" }
    ];
    const local = [
      { id: "local", role: "agent" as const, text: "Campaign Planning Panda is ready.", timestamp: "2026-07-06T01:00:02.000Z" }
    ];

    expect(visibleWorkspaceMessages(shared, local).map((message) => message.id)).toEqual(["brief", "home", "local"]);
  });

  it("compacts agent messages by normalized role and text", () => {
    const messages = [
      { id: "a", role: "agent" as const, text: "I created New campaign · TE30 AVR.", timestamp: "2026-07-06T01:00:00.000Z" },
      { id: "b", role: "agent" as const, text: "I created   New campaign · TE30 AVR.", timestamp: "2026-07-06T01:00:01.000Z" },
      { id: "c", role: "user" as const, text: "launch campaign", timestamp: "2026-07-06T01:00:02.000Z" }
    ];

    expect(compactAgentMessages(messages).map((message) => message.id)).toEqual(["b", "c"]);
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

  it("hands campaign planning into content planning requirements", () => {
    const requirements = contentRequirementsFromPlan(campaignPlanForRun(createDefaultRun()));

    expect(requirements.length).toBeGreaterThan(7);
    expect(requirements.some((item) => item.channel === "Paid Media" && item.assetType === "Search ad headline")).toBe(true);
    expect(requirements.some((item) => item.channel === "Email" && item.assetType === "Hero section")).toBe(true);
    expect(requirements.some((item) => item.channel === "HOL Landing Page" && item.rolloutTarget === "Contentful")).toBe(true);
    expect(requirements.some((item) => item.locale === "fr-CH" && item.source === "Content Planning matrix")).toBe(true);
    expect(requirements[0].title).toContain("SIW 6AT-A22");
    expect(requirements.every((item) => item.evidence.includes("H1 Campaign Plan"))).toBe(true);
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
    expect(bridge.creativeConcept.head).toContain(plan.heroProduct);
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
