import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeCheck,
  Bot,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileUp,
  Flag,
  Layers3,
  MessageSquare,
  Mic,
  Paperclip,
  PenLine,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  X
} from "lucide-react";
import {
  AgentMessage,
  applyContentPlanningInstruction,
  applyPlanningInstruction,
  AppView,
  buildLeadershipFeedbackProposal,
  buildContentPlanningBridge,
  buildPlanPreviewSlides,
  buildAgentScope,
  buildPandaContextPacket,
  campaignPlanningObjectsFromPlan,
  campaignPlanningReadiness,
  campaignPlanForRun,
  CampaignPlan,
  CampaignRun,
  CampaignWorkspace,
  buildHomeCampaignDiscoveryReply,
  classifyHomeIntent,
  compactAgentMessages,
  ContentWorkObject,
  ContentPlanningApprovalStatus,
  ContentPlanningBridge,
  ContentRequirement,
  contentPlanningBridgeReadiness,
  contentRequirementsFromPlan,
  contentWorkspaceReadiness,
  createCampaignFromBrief,
  createContentWorkObjectsFromRequirements,
  createDefaultWorkspace,
  createRolloutWorkObjectsFromContent,
  currentPhaseMeta,
  defaultUserRole,
  displayCampaignSummary,
  draftSpecialistAgentResponse,
  GateId,
  navigationItems,
  nextPhase,
  PandaAgentResponse,
  PandaArtifact,
  PandaOrchestratorResponse,
  ObjectWorkspaceReadiness,
  PhaseId,
  PlanningReadiness,
  PlanningWorkObject,
  progressForCampaign,
  progressTaskDetailRoute,
  RolloutWorkObject,
  rolloutWorkspaceReadiness,
  restoreAppView,
  skillHubSummary,
  skillCapabilityItems,
  SkillCapability,
  LeadershipFeedbackProposal,
  PlanPreviewSlide,
  simulatedPlanDeckFilename,
  WorklogEntry,
  WorkObjectStatus,
  workspaceAgentMessageKey
} from "./lib/panda";
import "./styles.css";

const storageKey = "panda-v4-control-tower-workspace";
const viewStorageKey = "panda-v4-active-view";

const phaseViewMap: Partial<Record<AppView, PhaseId>> = {
  "campaign-planning": "planning",
  "content-planning": "content",
  content: "content",
  rollout: "rollout",
  optimize: "optimize"
};

function App() {
  const [workspace, setWorkspace] = useState<CampaignWorkspace>(() => loadWorkspace());
  const [view, setView] = useState<AppView>(() => restoreAppView(localStorage.getItem(viewStorageKey)));
  const [busy, setBusy] = useState(false);
  const [reviewer, setReviewer] = useState("Vincent");
  const [homePrompt, setHomePrompt] = useState("");
  const [agentInput, setAgentInput] = useState("");
  const [workspaceAgentMessages, setWorkspaceAgentMessages] = useState<Record<string, AgentMessage[]>>({});
  const [workspaceAgentBusy, setWorkspaceAgentBusy] = useState<Record<string, boolean>>({});
  const [globalPandaOpen, setGlobalPandaOpen] = useState(false);
  const [globalPandaInput, setGlobalPandaInput] = useState("");
  const [globalPandaBusy, setGlobalPandaBusy] = useState(false);
  const [globalPandaMessages, setGlobalPandaMessages] = useState<Array<{ id: string; role: "user" | "agent"; text: string; route?: string; highlights?: string[]; actions?: string[] }>>([
    {
      id: "welcome",
      role: "agent",
      text: "Ask me anything about this campaign. I can explain blockers, owners, gates, handoffs, and next actions."
    }
  ]);
  const [planningObjectRecords, setPlanningObjectRecords] = useState<Record<string, PlanningWorkObject[]>>({});
  const [contentRequirementRecords, setContentRequirementRecords] = useState<Record<string, ContentRequirement[]>>({});
  const [contentObjectRecords, setContentObjectRecords] = useState<Record<string, ContentWorkObject[]>>({});
  const [rolloutObjectRecords, setRolloutObjectRecords] = useState<Record<string, RolloutWorkObject[]>>({});

  const run = workspace.campaigns.find((campaign) => campaign.campaignId === workspace.activeCampaignId) ?? workspace.campaigns[0];
  const activePhase = currentPhaseMeta(run.phase);
  const phaseGate = run.currentGate?.id === activePhase.gate ? run.currentGate : undefined;
  const gateApproved = run.gateDecisions.some((decision) => decision.gateId === activePhase.gate && decision.decision === "approved");
  const campaignPlan = useMemo(() => campaignPlanForRun(run), [run]);
  const generatedPlanningObjects = useMemo(() => campaignPlanningObjectsFromPlan(campaignPlan), [campaignPlan]);
  const planningObjects = planningObjectRecords[run.campaignId] ?? generatedPlanningObjects;
  const planningReadiness = useMemo(() => campaignPlanningReadiness(planningObjects), [planningObjects]);
  const generatedContentRequirements = useMemo(() => contentRequirementsFromPlan(campaignPlan), [campaignPlan]);
  const contentRequirements = contentRequirementRecords[run.campaignId] ?? generatedContentRequirements;
  const generatedContentObjects = useMemo(() => createContentWorkObjectsFromRequirements(contentRequirements), [contentRequirements]);
  const contentObjects = contentObjectRecords[run.campaignId] ?? generatedContentObjects;
  const generatedRolloutObjects = useMemo(() => createRolloutWorkObjectsFromContent(contentObjects), [contentObjects]);
  const rolloutObjects = rolloutObjectRecords[run.campaignId] ?? generatedRolloutObjects;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    localStorage.setItem(viewStorageKey, view);
  }, [view]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view, workspace.activeCampaignId]);

  const completion = useMemo(() => {
    const approved = new Set(run.gateDecisions.filter((decision) => decision.decision === "approved").map((decision) => decision.gateId));
    return Math.round((approved.size / 4) * 100);
  }, [run.gateDecisions]);

  function updateRun(updater: (run: CampaignRun) => CampaignRun) {
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) => campaign.campaignId === current.activeCampaignId ? updater(campaign) : campaign)
    }));
  }

  function addMessage(campaignId: string, message: Omit<AgentMessage, "id" | "timestamp">) {
    setWorkspace((current) => ({
      ...current,
      messages: {
        ...current.messages,
        [campaignId]: [
          ...(current.messages[campaignId] ?? []),
          { ...message, id: crypto.randomUUID(), timestamp: new Date().toISOString() }
        ]
      }
    }));
  }

  function phaseForView(targetView: AppView): PhaseId {
    return phaseViewMap[targetView] ?? run.phase;
  }

  function pandaContextFor(targetView: AppView) {
    return buildPandaContextPacket({
      run,
      currentView: targetView,
      currentPhase: phaseForView(targetView),
      userRole: defaultUserRole,
      campaignPlan,
      planningObjects,
      contentRequirements,
      contentObjects: targetView === "campaign-planning" ? [] : contentObjects,
      rolloutObjects: targetView === "campaign-planning" ? [] : rolloutObjects
    });
  }

  function appendWorkspaceAgentMessage(targetView: AppView, message: Omit<AgentMessage, "id" | "timestamp">) {
    const key = workspaceAgentMessageKey(run.campaignId, targetView);
    setWorkspaceAgentMessages((current) => ({
      ...current,
      [key]: [
        ...(current[key] ?? []),
        { ...message, id: crypto.randomUUID(), timestamp: new Date().toISOString() }
      ]
    }));
  }

  function applyContentPlanningInstructionToWorkspace(instruction: string) {
    const updatedRequirements = applyContentPlanningInstruction(contentRequirements, campaignPlan, instruction);
    if (updatedRequirements === contentRequirements) return false;
    const updatedObjects = createContentWorkObjectsFromRequirements(updatedRequirements);
    setContentRequirementRecords((current) => ({ ...current, [run.campaignId]: updatedRequirements }));
    setContentObjectRecords((current) => ({ ...current, [run.campaignId]: updatedObjects }));
    return true;
  }

  function applyCampaignPlanningInstructionToWorkspace(instruction: string) {
    const updatedObjects = applyPlanningInstruction(planningObjects, instruction);
    if (updatedObjects === planningObjects) return false;
    setPlanningObjectRecords((current) => ({ ...current, [run.campaignId]: updatedObjects }));
    return true;
  }

  function applyCampaignPlanningFeedback(proposal: LeadershipFeedbackProposal) {
    for (const change of proposal.changes) {
      if (change.id === "add-mocn-content") {
        updatePlanningObject("target-audience", "revision-requested", "Leadership feedback: prioritize MOCN audience and reflect downstream content impact.");
      }
      if (change.id === "clarify-kpi") {
        updatePlanningObject("kpi-definition", "revision-requested", "Leadership feedback: clarify KPI ownership and measurement source.");
      }
      if (change.action === "flag-risk") {
        updatePlanningObject("assumptions-risks", "revision-requested", "Leadership feedback: add visible risk note for gate review.");
      }
    }
  }

  async function askWorkspacePanda(targetView: AppView, question: string) {
    const text = question.trim();
    if (!text) return;
    const key = workspaceAgentMessageKey(run.campaignId, targetView);
    let context = pandaContextFor(targetView);
    appendWorkspaceAgentMessage(targetView, { role: "user", text });

    const specialistDraft = draftSpecialistAgentResponse(targetView, text, context);
    if (targetView === "campaign-planning" && specialistDraft.updates.some((update) => update.target === "planning_object")) {
      applyCampaignPlanningInstructionToWorkspace(text);
      const updatedPlanningObjects = applyPlanningInstruction(planningObjects, text);
      context = buildPandaContextPacket({
        run,
        currentView: targetView,
        currentPhase: phaseForView(targetView),
        userRole: defaultUserRole,
        campaignPlan,
        planningObjects: updatedPlanningObjects,
        contentRequirements,
        contentObjects: [],
        rolloutObjects: []
      });
    }

    if (targetView === "content-planning" && specialistDraft.updates.some((update) => update.target === "content_requirements")) {
      applyContentPlanningInstructionToWorkspace(text);
      const updatedRequirements = applyContentPlanningInstruction(contentRequirements, campaignPlan, text);
      const updatedObjects = createContentWorkObjectsFromRequirements(updatedRequirements);
      context = buildPandaContextPacket({
        run,
        currentView: targetView,
        currentPhase: phaseForView(targetView),
        userRole: defaultUserRole,
        campaignPlan,
        planningObjects,
        contentRequirements: updatedRequirements,
        contentObjects: updatedObjects,
        rolloutObjects: createRolloutWorkObjectsFromContent(updatedObjects)
      });
    }

    appendWorkspaceAgentMessage(targetView, { role: "agent", text: specialistDraft.answer });
    setWorkspaceAgentBusy((current) => ({ ...current, [key]: true }));

    try {
      const response = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...context,
          question: text,
          agent_scope: buildAgentScope(targetView)
        })
      });
      const packet = (await response.json()) as PandaOrchestratorResponse;
      appendWorkspaceAgentMessage(targetView, {
        role: "agent",
        text: packet.warning ? `${packet.answer}\n\nNote: ${packet.warning}` : packet.answer
      });
    } catch (error) {
      appendWorkspaceAgentMessage(targetView, {
        role: "agent",
        text: error instanceof Error ? `I could not answer yet: ${error.message}` : "I could not answer yet. Please try again."
      });
    } finally {
      setWorkspaceAgentBusy((current) => ({ ...current, [key]: false }));
    }
  }

  function createCampaignFromPrompt(prompt: string) {
    const brief = prompt.trim();
    if (!brief) return;
    const campaign = createCampaignFromBrief(brief);
    setWorkspace((current) => ({
      activeCampaignId: campaign.campaignId,
      campaigns: [campaign, ...current.campaigns],
      messages: {
        ...current.messages,
        [campaign.campaignId]: [
          { id: crypto.randomUUID(), role: "user", text: brief, timestamp: new Date().toISOString() },
          {
            id: crypto.randomUUID(),
            role: "agent",
            text: "I created a campaign workspace and can now plan, build, and prepare gate-ready work objects.",
            timestamp: new Date().toISOString()
          }
        ]
      }
    }));
    setContentObjectRecords((current) => ({
      ...current,
      [campaign.campaignId]: contentObjectsForRun(campaign)
    }));
    setContentRequirementRecords((current) => ({
      ...current,
      [campaign.campaignId]: contentRequirementsFromPlan(campaignPlanForRun(campaign))
    }));
    setRolloutObjectRecords((current) => ({
      ...current,
      [campaign.campaignId]: rolloutObjectsForRun(campaign)
    }));
    setPlanningObjectRecords((current) => ({
      ...current,
      [campaign.campaignId]: campaignPlanningObjectsFromPlan(campaignPlanForRun(campaign))
    }));
    setWorkspaceAgentMessages((current) => ({
      ...current,
      [workspaceAgentMessageKey(campaign.campaignId, "campaign-planning")]: [
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: "I created the campaign workspace. Open Campaign Planning when you are ready to shape the H1 plan packet, identify missing inputs, and prepare the first gate review.",
          timestamp: new Date().toISOString()
        }
      ]
    }));
    setHomePrompt("");
    setGlobalPandaOpen(false);
    setGlobalPandaMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "agent",
        text: `I created ${campaign.name} and kept you on the Home control tower. Open Campaign Planning from the campaign card when you want to work the H1 plan.`,
        route: "Campaign Planning",
        highlights: ["Campaign workspace created", "H1 planning is ready", "No automatic navigation"],
        actions: ["Open Campaign Planning", "Review active campaigns", "Ask Panda for blockers"]
      }
    ]);
  }

  async function runPhase(userInstruction?: string) {
    setBusy(true);
    const started = new Date().toISOString();
    const campaignId = run.campaignId;
    addMessage(campaignId, {
      role: "agent",
      text: `I am running ${activePhase.label}. I will produce artifacts, worklog entries, and the ${activePhase.gate} gate packet.`
    });
    updateRun((current) => ({
      ...current,
      worklog: [
        ...current.worklog,
        {
          id: crypto.randomUUID(),
          agent: "panda-agent",
          status: "running",
          message: `Running ${currentPhaseMeta(current.phase).label} with DeepSeek.`,
          phase: current.phase,
          createdAt: started
        }
      ],
      updatedAt: started
    }));

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prototype: "panda-v4",
          phase: run.phase,
          brief: run.brief,
          campaign_id: run.campaignId,
          approved_gates: run.gateDecisions.filter((decision) => decision.decision === "approved").map((decision) => decision.gateId),
          existing_artifacts: run.artifacts.map((artifact) => ({ name: artifact.name, type: artifact.type, phase: artifact.phase })),
          instruction: userInstruction || "Create the next gate-ready artifact packet. Keep evidence visible, and never auto-publish."
        })
      });
      const packet = (await response.json()) as PandaAgentResponse;
      applyAgentPacket(packet);
      addMessage(campaignId, { role: "agent", text: `${packet.gate.id} packet is ready. ${packet.summary}` });
    } finally {
      setBusy(false);
    }
  }

  function applyAgentPacket(packet: PandaAgentResponse) {
    const now = new Date().toISOString();
    updateRun((current) => {
      const worklog: WorklogEntry[] = packet.worklog.map((entry) => ({ ...entry, id: crypto.randomUUID(), phase: current.phase, createdAt: now }));
      const artifacts: PandaArtifact[] = packet.artifacts.map((artifact) => ({
        ...artifact,
        id: crypto.randomUUID(),
        phase: current.phase,
        createdAt: now,
        data: artifact.data ?? {}
      }));
      return {
        ...current,
        modelMode: packet.mode,
        summary: packet.summary,
        warning: packet.warning,
        worklog: [...current.worklog.filter((entry) => !(entry.phase === current.phase && entry.agent !== "orchestrator")), ...worklog],
        artifacts: [...current.artifacts.filter((artifact) => artifact.phase !== current.phase), ...artifacts],
        currentGate: packet.gate,
        nextActions: packet.next_actions,
        updatedAt: now
      };
    });
  }

  function sendAgentMessage() {
    const text = agentInput.trim();
    if (!text) return;
    setAgentInput("");
    void askWorkspacePanda("content", text);
  }

  async function askGlobalPanda(questionOverride?: string) {
    const question = (questionOverride ?? globalPandaInput).trim();
    if (!question) return;
    if (view !== "home") setGlobalPandaOpen(true);
    setGlobalPandaInput("");
    setGlobalPandaBusy(true);
    setGlobalPandaMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: question }]);

    try {
      const response = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pandaContextFor(view),
          question,
          agent_scope: buildAgentScope(view)
        })
      });
      const packet = (await response.json()) as PandaOrchestratorResponse;
      setGlobalPandaMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: packet.warning ? `${packet.answer}\n\nNote: ${packet.warning}` : packet.answer,
          route: packet.route,
          highlights: packet.highlights,
          actions: packet.suggested_actions
        }
      ]);
    } catch (error) {
      setGlobalPandaMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: error instanceof Error
            ? `I could not reach the live orchestrator, but I am still here. I understood: "${question}". Tell me the audience, markets, channels, KPI, budget, or timing you want to add, and I will keep shaping the brief.`
            : `I am still here. I understood: "${question}". Tell me the audience, markets, channels, KPI, budget, or timing you want to add, and I will keep shaping the brief.`
        }
      ]);
    } finally {
      setGlobalPandaBusy(false);
    }
  }

  function submitHomePrompt() {
    const prompt = homePrompt.trim();
    if (!prompt) return;
    const confirmsDraftBrief = /\b(create it|use this brief|ready to create|go ahead)\b/i.test(prompt);
    const recentHomeBrief = globalPandaMessages
      .filter((message) => message.role === "user")
      .slice(-3)
      .map((message) => message.text)
      .join(" ")
      .trim();
    const promptForIntent = confirmsDraftBrief && recentHomeBrief ? `${recentHomeBrief} ${prompt}` : prompt;
    const intent = classifyHomeIntent(promptForIntent);

    if (intent.type === "create-campaign") {
      createCampaignFromPrompt(confirmsDraftBrief && recentHomeBrief ? recentHomeBrief : prompt);
      return;
    }
    if (confirmsDraftBrief) {
      setHomePrompt("");
      setGlobalPandaMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "user", text: prompt },
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: buildHomeCampaignDiscoveryReply(promptForIntent),
          highlights: ["Brief discovery", "No campaign created yet", "More campaign detail needed"],
          actions: ["Add audience, market, channel, KPI, budget, or timing", "Then say create it"]
        }
      ]);
      return;
    }
    if (intent.type === "plan-campaign") {
      setHomePrompt("");
      setGlobalPandaOpen(false);
      setGlobalPandaMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "user", text: prompt },
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: buildHomeCampaignDiscoveryReply(prompt),
          highlights: ["Brief discovery", "No campaign created yet", "Waiting for audience/market/channel detail"],
          actions: ["Answer brief questions", "Say create it when ready"]
        }
      ]);
      return;
    }
    if (intent.type === "route") {
      setHomePrompt("");
      setView(intent.view);
      return;
    }
    if (intent.type === "update-campaign") {
      setHomePrompt("");
      addMessage(run.campaignId, { role: "user", text: prompt });
      void askWorkspacePanda("campaign-planning", prompt);
      setGlobalPandaOpen(false);
      setGlobalPandaMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: "I routed this as a Campaign Planning revision and kept you on the Home control tower. Campaign Planning Panda will update the H1 draft objects without approving the gate.",
          route: "Campaign Planning",
          highlights: ["Planning revision", "No gate approval", "Shared campaign context updated"],
          actions: ["Open Campaign Planning", "Review H1 changes"]
        }
      ]);
      return;
    }

    setHomePrompt("");
    addMessage(run.campaignId, { role: "user", text: prompt });
    void askGlobalPanda(prompt);
  }

  function approveGate() {
    const gateId = (phaseGate?.id ?? activePhase.gate) as GateId;
    const reviewed = run.artifacts.filter((artifact) => artifact.phase === run.phase).map((artifact) => artifact.id);
    const timestamp = new Date().toISOString();
    updateRun((current) => ({
      ...current,
      phase: nextPhase(current.phase),
      currentGate: undefined,
      nextActions: [`Run ${currentPhaseMeta(nextPhase(current.phase)).label}`, "Review the next gate packet"],
      gateDecisions: [
        ...current.gateDecisions.filter((decision) => !(decision.gateId === gateId && decision.decision === "approved")),
        {
          gateId,
          decision: "approved",
          reviewer,
          comment: gateId === "H3" ? "Publish authorization granted for held candidates. External connector still requires live credentials." : "Approved in Panda prototype.",
          artifactsReviewed: reviewed,
          timestamp
        }
      ],
      worklog: [
        ...current.worklog,
        { id: crypto.randomUUID(), agent: "human-gate", status: "done", message: `${gateId} approved by ${reviewer}.`, phase: current.phase, createdAt: timestamp }
      ],
      updatedAt: timestamp
    }));
    addMessage(run.campaignId, { role: "system", text: `${gateId} approved by ${reviewer}. I moved the campaign to ${currentPhaseMeta(nextPhase(run.phase)).label}.` });
  }

  function requestRevision() {
    const gateId = (phaseGate?.id ?? activePhase.gate) as GateId;
    const timestamp = new Date().toISOString();
    updateRun((current) => ({
      ...current,
      gateDecisions: [
        ...current.gateDecisions,
        { gateId, decision: "revision_requested", reviewer, comment: "Revision requested from Panda before approval.", artifactsReviewed: current.artifacts.filter((artifact) => artifact.phase === current.phase).map((artifact) => artifact.id), timestamp }
      ],
      nextActions: ["Tell Panda what to revise", "Run phase again", "Re-open gate packet"],
      updatedAt: timestamp
    }));
    addMessage(run.campaignId, { role: "system", text: `${gateId} revision requested. Tell me what to change and I will rerun the phase.` });
  }

  function downloadRunRecord() {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.campaignId}-panda-run-record.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetWorkspace() {
    setWorkspace(createDefaultWorkspace());
    setPlanningObjectRecords({});
    setContentRequirementRecords({});
    setContentObjectRecords({});
    setRolloutObjectRecords({});
    setView("home");
  }

  function updatePlanningObject(id: string, status: WorkObjectStatus, comment: string) {
    setPlanningObjectRecords((current) => {
      const base = current[run.campaignId] ?? planningObjects;
      return {
        ...current,
        [run.campaignId]: base.map((item) =>
          item.id === id
            ? { ...item, status, evidence: comment ? [comment, ...item.evidence] : item.evidence }
            : item
        )
      };
    });
  }

  function updateContentObject(id: string, status: WorkObjectStatus, comment: string) {
    setContentObjectRecords((current) => {
      const base = current[run.campaignId] ?? contentObjects;
      return {
        ...current,
        [run.campaignId]: base.map((item) => item.id === id ? { ...item, status, comments: [comment, ...item.comments] } : item)
      };
    });
  }

  function updateRolloutObject(id: string, status: WorkObjectStatus, evidence: string) {
    setRolloutObjectRecords((current) => {
      const base = current[run.campaignId] ?? rolloutObjects;
      return {
        ...current,
        [run.campaignId]: base.map((item) =>
          item.id === id
            ? { ...item, status, evidence: evidence ? [evidence, ...item.evidence] : item.evidence }
            : item
        )
      };
    });
  }

  const selectedPhase = phaseViewMap[view] ?? run.phase;
  const contentAgentKey = workspaceAgentMessageKey(run.campaignId, "content");
  const workflowAgentKey = workspaceAgentMessageKey(run.campaignId, view);

  return (
    <main className="appFrame">
      <header className="topbar appTopbar">
        <div className="brand">
          <span className="mark">P</span>
          <div>
            <strong>Panda</strong>
            <small>Agentic E2E campaign workspace</small>
          </div>
        </div>
        <div className="topbarControls">
          {workspace.campaigns.length > 1 ? (
            <label className="campaignSelect">
              Campaign
              <select value={workspace.activeCampaignId} onChange={(event) => setWorkspace((current) => ({ ...current, activeCampaignId: event.target.value }))}>
                {workspace.campaigns.map((campaign) => <option value={campaign.campaignId} key={campaign.campaignId}>{campaign.campaignId} · {campaign.name}</option>)}
              </select>
            </label>
          ) : (
            <span className="topCampaignContext">
              <small>Active campaign</small>
              <strong>{run.name}</strong>
            </span>
          )}
          <span className="roleChip">{defaultUserRole}</span>
          <button title="Download run record" onClick={downloadRunRecord}><Download size={18} /></button>
          <button title="Reset workspace" onClick={resetWorkspace}><RotateCcw size={18} /></button>
          <button className="primary" onClick={() => setGlobalPandaOpen(true)}>
            <Bot size={18} />
            Ask Panda
          </button>
        </div>
      </header>

      <div className="appBody">
        <aside className="sideNav">
          <nav>
            {navigationItems.map((item) => (
              <button className={view === item.id ? "selected" : ""} onClick={() => setView(item.id)} key={item.id}>
                {navIcon(item.id)}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sideCampaigns">
            <small>Campaigns</small>
            {workspace.campaigns.map((campaign) => (
              <button className={campaign.campaignId === run.campaignId ? "selected" : ""} key={campaign.campaignId} onClick={() => setWorkspace((current) => ({ ...current, activeCampaignId: campaign.campaignId }))}>
                <strong>{campaign.name}</strong>
                <span>{campaign.campaignId} · {currentPhaseMeta(campaign.phase).label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="pageSurface">
          {view === "home" && (
            <HomeLauncher
              run={run}
              prompt={homePrompt}
              busy={busy}
              campaigns={workspace.campaigns}
              messages={globalPandaMessages}
              pandaBusy={globalPandaBusy}
              onPromptChange={setHomePrompt}
              onSubmit={submitHomePrompt}
              onOpenCampaign={(campaignId) => setWorkspace((current) => ({ ...current, activeCampaignId: campaignId }))}
              onOpenProgress={() => setView("progress")}
              onOpenSkills={() => setView("skills")}
            />
          )}
          {view === "progress" && <ProgressView run={run} completion={completion} onNavigate={setView} />}
          {view === "skills" && <SkillsView />}
          {view === "content" && (
            <ContentWorkspace
              run={run}
              messages={workspaceAgentMessages[contentAgentKey] ?? []}
              busy={busy || Boolean(workspaceAgentBusy[contentAgentKey])}
              agentInput={agentInput}
              contentObjects={contentObjects}
              contentRequirements={contentRequirements}
              onAgentInputChange={setAgentInput}
              onSendAgentMessage={sendAgentMessage}
              onRun={() => runPhase()}
              onUpdateObject={updateContentObject}
              phaseGate={phaseGate}
              reviewer={reviewer}
              gateApproved={gateApproved}
              onReviewerChange={setReviewer}
              onApproveGate={approveGate}
              onRequestRevision={requestRevision}
            />
          )}
          {["campaign-planning", "content-planning", "rollout", "optimize"].includes(view) && (
            <WorkflowShell
              view={view}
              phase={selectedPhase}
              run={run}
              campaignPlan={campaignPlan}
              planningObjects={planningObjects}
              planningReadiness={planningReadiness}
              contentRequirements={contentRequirements}
              contentObjects={contentObjects}
              rolloutObjects={rolloutObjects}
              busy={busy || Boolean(workspaceAgentBusy[workflowAgentKey])}
              messages={workspaceAgentMessages[workflowAgentKey] ?? []}
              onRun={(instruction) => runPhase(instruction)}
              onAsk={(targetView, question) => askWorkspacePanda(targetView, question)}
              onApplyContentPlanningInstruction={applyContentPlanningInstructionToWorkspace}
              onApplyCampaignPlanningFeedback={applyCampaignPlanningFeedback}
              onUpdatePlanningObject={updatePlanningObject}
              onUpdateRolloutObject={updateRolloutObject}
            />
          )}
        </section>
      </div>
      {globalPandaOpen && (
        <GlobalPandaDrawer
          run={run}
          view={view}
          busy={busy || globalPandaBusy}
          input={globalPandaInput}
          messages={globalPandaMessages}
          contentObjects={contentObjects}
          rolloutObjects={rolloutObjects}
          onInputChange={setGlobalPandaInput}
          onClose={() => setGlobalPandaOpen(false)}
          onAsk={askGlobalPanda}
          onRunPhase={() => runPhase()}
          onNavigate={(target) => {
            setView(target);
            setGlobalPandaOpen(false);
          }}
        />
      )}
    </main>
  );
}

function navIcon(view: AppView) {
  const props = { size: 18 };
  if (view === "home") return <Sparkles {...props} />;
  if (view === "progress") return <Activity {...props} />;
  if (view === "skills") return <BookOpen {...props} />;
  if (view === "rollout") return <Layers3 {...props} />;
  if (view === "optimize") return <ShieldCheck {...props} />;
  return <PenLine {...props} />;
}

function GlobalPandaDrawer({
  run,
  view,
  busy,
  input,
  messages,
  contentObjects,
  rolloutObjects,
  onInputChange,
  onClose,
  onAsk,
  onRunPhase,
  onNavigate
}: {
  run: CampaignRun;
  view: AppView;
  busy: boolean;
  input: string;
  messages: Array<{ id: string; role: "user" | "agent"; text: string; route?: string; highlights?: string[]; actions?: string[] }>;
  contentObjects: ContentWorkObject[];
  rolloutObjects: RolloutWorkObject[];
  onInputChange: (value: string) => void;
  onClose: () => void;
  onAsk: (questionOverride?: string) => Promise<void>;
  onRunPhase: () => void | Promise<void>;
  onNavigate: (target: AppView) => void;
}) {
  const activePhase = currentPhaseMeta(run.phase);
  const blockedContent = contentObjects.filter((item) => item.status === "blocked").length;
  const approvedContent = contentObjects.filter((item) => item.status === "approved").length;
  const blockedRollout = rolloutObjects.filter((item) => item.status === "blocked").length;
  const prompts = [
    `What is missing before ${activePhase.gate} approval?`,
    "What should the Campaign Owner do next?",
    "Which workstream is blocked and who owns it?",
    "Explain the handoff from planning to rollout."
  ];

  return (
    <div className="pandaOverlay" role="presentation">
      <aside className="globalPandaDrawer" aria-label="Global Panda orchestrator">
        <header className="drawerHeader">
          <div>
            <p className="eyebrow">Global orchestrator</p>
            <h2>Ask Panda</h2>
            <span>{run.campaignId} · {activePhase.gate} · {viewLabel(view)}</span>
          </div>
          <button title="Close Panda" onClick={onClose}><X size={18} /></button>
        </header>

        <section className="drawerContext">
          <article><small>Content</small><strong>{approvedContent}/{contentObjects.length}</strong><span>approved</span></article>
          <article><small>Blockers</small><strong>{blockedContent + blockedRollout}</strong><span>open</span></article>
          <article><small>Route</small><strong>{activePhase.label}</strong><span>{activePhase.gate}</span></article>
        </section>

        <div className="quickPrompts">
          {prompts.map((prompt) => (
            <button key={prompt} onClick={() => void onAsk(prompt)} disabled={busy}>{prompt}</button>
          ))}
        </div>

        <section className="globalMessages">
          {messages.map((message) => (
            <article className={`globalMessage ${message.role}`} key={message.id}>
              <b>{message.role === "agent" ? "Panda" : "You"}</b>
              {message.text.split("\n").map((line) => <p key={line}>{line}</p>)}
              {message.highlights && (
                <div className="evidenceTags">
                  {message.highlights.map((item) => <span key={item}>{item}</span>)}
                </div>
              )}
              {message.actions && (
                <div className="drawerActions">
                  {message.actions.map((action) => <span key={action}>{action}</span>)}
                </div>
              )}
              {message.route && routeToView(message.route) && (
                <button className="secondary" onClick={() => onNavigate(routeToView(message.route)!)}>Open {message.route}</button>
              )}
            </article>
          ))}
        </section>

        <footer className="drawerComposer">
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Ask about gates, blockers, owners, handoffs, or next steps..."
          />
          <div>
            <button className="secondary" onClick={() => void onRunPhase()} disabled={busy}>
              {busy ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
              Run current phase
            </button>
            <button className="primary" onClick={() => void onAsk()} disabled={busy || !input.trim()}>
              {busy ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
              Ask
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function viewLabel(view: AppView) {
  return navigationItems.find((item) => item.id === view)?.label ?? "Workspace";
}

function routeToView(route: string): AppView | undefined {
  const normalized = route.toLowerCase();
  if (normalized.includes("campaign planning")) return "campaign-planning";
  if (normalized.includes("content planning")) return "content-planning";
  if (normalized === "content" || normalized.includes("content")) return "content";
  if (normalized.includes("rollout")) return "rollout";
  if (normalized.includes("optimize")) return "optimize";
  if (normalized.includes("progress")) return "progress";
  if (normalized.includes("skills")) return "skills";
  return undefined;
}

function HomeLauncher({
  run,
  prompt,
  busy,
  campaigns,
  messages,
  pandaBusy,
  onPromptChange,
  onSubmit,
  onOpenCampaign,
  onOpenProgress,
  onOpenSkills
}: {
  run: CampaignRun;
  prompt: string;
  busy: boolean;
  campaigns: CampaignRun[];
  messages: Array<{ id: string; role: "user" | "agent"; text: string; route?: string; highlights?: string[]; actions?: string[] }>;
  pandaBusy: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onOpenCampaign: (campaignId: string) => void;
  onOpenProgress: () => void;
  onOpenSkills: () => void;
}) {
  const visibleMessages = compactAgentMessages(messages).slice(-5);
  return (
    <div className="homePage">
      <section className="homeHero">
        <p className="eyebrow">Panda for Hilti</p>
        <h1>Ask Panda what to do next.</h1>
        <p>Use Home as the orchestrator: ask a question, create a new campaign, update the current plan, or route work to a specialist workspace.</p>
        <div className="promptCard">
          <div className="homeChatHeader">
            <span className="agentAvatar"><Bot size={15} /></span>
            <div>
              <b>Panda</b>
              <small>Orchestrator</small>
            </div>
          </div>
          <div className="homeAgentTranscript">
            {visibleMessages.map((message) => (
              <article key={message.id} className={message.role === "agent" ? "agent" : "user"}>
                <b>{message.role === "agent" ? "Panda" : "You"}</b>
                <p>{message.text}</p>
              </article>
            ))}
            {pandaBusy && <article className="agent thinking"><b>Panda</b><p>Working across the shared campaign context...</p></article>}
          </div>
          <textarea value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder="Ask a question, update the current campaign, or launch a new campaign..." />
          <div className="promptActions">
            <button className="secondaryAction" onClick={onOpenSkills}><Plus size={18} /> Add skill/file</button>
            <span className="orchestratorMode"><Bot size={15} /> Orchestrator</span>
            <button className="sendFab" onClick={onSubmit} disabled={busy || !prompt.trim()}>
              {busy ? <RefreshCw className="spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </section>

      <section className="recentCampaigns">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Active work</p>
            <h2>Campaigns</h2>
          </div>
          <button className="linkButton" onClick={onOpenProgress}>Open Progress <ChevronRight size={16} /></button>
        </div>
        <div className="campaignCards">
          {campaigns.map((campaign) => (
            <button className={campaign.campaignId === run.campaignId ? "selected" : ""} key={campaign.campaignId} onClick={() => onOpenCampaign(campaign.campaignId)}>
              <strong>{campaign.name}</strong>
              <small>{campaign.campaignId} · {currentPhaseMeta(campaign.phase).label}</small>
              <span>{campaign.nextActions[0]}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProgressView({ run, completion, onNavigate }: { run: CampaignRun; completion: number; onNavigate: (target: AppView) => void }) {
  const progress = progressForCampaign(run, defaultUserRole);
  return (
    <div className="progressPage">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Active campaign progress</p>
          <h1>{run.name}</h1>
          <p>{displayCampaignSummary(run.summary)}</p>
        </div>
        <div className="readinessBadge">
          <small>Launch readiness</small>
          <strong>{Math.max(progress.launchReadiness, completion)}%</strong>
        </div>
      </div>

      <div className="progressGrid">
        <Panel title="Workflow Status" icon={<Activity size={18} />}>
          <div className="workflowStatus">
            {progress.workflowStatus.map((item) => (
              <article className={item.status} key={item.id}>
                <div className="progressItemTop">
                  <div>
                    <b>{item.label}</b>
                    <small>{item.gate} · {item.owner}</small>
                  </div>
                  <span>{item.status}</span>
                </div>
                <p>{item.nextTask}</p>
                <button className="detailButton" onClick={() => onNavigate(item.id)}>Detail <ChevronRight size={14} /></button>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="My Tasks" icon={<BadgeCheck size={18} />}>
          <TaskList tasks={progress.myTasks} onDetail={(task) => onNavigate(progressTaskDetailRoute(task, defaultUserRole))} />
        </Panel>

        <Panel title="Team Tasks" icon={<Layers3 size={18} />}>
          <div className="teamTasks">
            {progress.teamTasks.map((task) => (
              <article className={task.status} key={`${task.owner}-${task.task}`}>
                <div>
                  <b>{task.owner}</b>
                  <span>{task.task}</span>
                  <small>{task.status}</small>
                </div>
                <button className="detailButton compact" onClick={() => onNavigate(progressTaskDetailRoute(task.task, task.owner))}>Detail <ChevronRight size={14} /></button>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Blocked / Needs Input" icon={<Flag size={18} />}>
          <TaskList tasks={progress.blockers} onDetail={(task) => onNavigate(progressTaskDetailRoute(task))} />
        </Panel>

        <Panel title="Panda Running Tasks" icon={<Bot size={18} />}>
          <TaskList tasks={progress.pandaTasks} onDetail={(task) => onNavigate(progressTaskDetailRoute(task))} />
        </Panel>
      </div>
    </div>
  );
}

function SkillsView() {
  const skills = skillCapabilityItems();
  const summary = skillHubSummary(skills);
  const knowledge = skills.filter((item) => item.category === "knowledge");
  const integrations = skills.filter((item) => item.category === "integration");
  return (
    <div className="skillsPage">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Panda Skills</p>
          <h1>Skills that shape Panda's work</h1>
          <p>Mock knowledge upload and connector activation for campaign planning, content, rollout, and optimization.</p>
        </div>
        <label className="mockUpload">
          <FileUp size={18} />
          Add mock skill file
          <input type="file" multiple />
        </label>
      </div>
      <section className="skillsControlStrip">
        <article><small>Knowledge</small><strong>{summary.knowledge}</strong><span>uploadable skills</span></article>
        <article><small>Integrations</small><strong>{summary.integrations}</strong><span>mock connectors</span></article>
        <article><small>Active</small><strong>{summary.active}</strong><span>ready for Panda</span></article>
        <article><small>Coverage</small><strong>{summary.workflowCoverage.length}</strong><span>workflows powered</span></article>
      </section>
      <section className="skillsHubGrid">
        <div className="skillLibraryPanel">
          <Panel title="Knowledge Skills" icon={<BookOpen size={18} />}>
            <div className="skillStack">
              {knowledge.map((item) => <SkillCapabilityCard item={item} key={item.id} />)}
            </div>
          </Panel>
        </div>
        <div className="integrationPanel">
          <Panel title="Tool Integrations" icon={<PlugZap size={18} />}>
            <div className="integrationRows">
              {integrations.map((item) => <SkillCapabilityCard item={item} key={item.id} />)}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function CapabilityGroup({ title, icon, items }: { title: string; icon: React.ReactNode; items: SkillCapability[] }) {
  return (
    <Panel title={title} icon={icon}>
      <div className="skillGrid">
        {items.map((item) => (
          <article className="skillCard" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span className={`skillStatus ${item.status.replace(/\s/g, "-")}`}>{item.status}</span>
            </div>
            <p>{item.description}</p>
            <small>Used by {item.usedBy.join(", ")}</small>
            <button className={item.status === "active" ? "secondary" : "primary"}>{item.category === "knowledge" ? "Toggle skill" : "Connect mock"}</button>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function SkillCapabilityCard({ item }: { item: SkillCapability }) {
  return (
    <article className={`skillCard ${item.category}`}>
      <div>
        <strong>{item.name}</strong>
        <span className={`skillStatus ${item.status.replace(/\s/g, "-")}`}>{item.status}</span>
      </div>
      <p>{item.description}</p>
      <div className="workflowTags">
        {item.usedBy.map((workflow) => <span key={workflow}>{workflow}</span>)}
      </div>
      <button className={item.status === "active" ? "secondary" : "primary"}>
        {item.category === "knowledge" ? "Manage skill" : "Configure mock"}
      </button>
    </article>
  );
}

function ContentWorkspace({
  run,
  messages,
  busy,
  agentInput,
  contentObjects,
  contentRequirements,
  phaseGate,
  reviewer,
  gateApproved,
  onAgentInputChange,
  onSendAgentMessage,
  onRun,
  onUpdateObject,
  onReviewerChange,
  onApproveGate,
  onRequestRevision
}: {
  run: CampaignRun;
  messages: AgentMessage[];
  busy: boolean;
  agentInput: string;
  contentObjects: ContentWorkObject[];
  contentRequirements: ContentRequirement[];
  phaseGate?: CampaignRun["currentGate"];
  reviewer: string;
  gateApproved: boolean;
  onAgentInputChange: (value: string) => void;
  onSendAgentMessage: () => void;
  onRun: () => void;
  onUpdateObject: (id: string, status: WorkObjectStatus, comment: string) => void;
  onReviewerChange: (value: string) => void;
  onApproveGate: () => void;
  onRequestRevision: () => void;
}) {
  const [selectedObjectId, setSelectedObjectId] = useState(contentObjects[0]?.id ?? "");
  const groups = Array.from(new Set(contentObjects.map((item) => item.channel)));
  const readiness = contentWorkspaceReadiness(contentObjects);
  const locales = Array.from(new Set(contentRequirements.map((item) => item.locale))).filter((locale) => locale !== "master");
  const selectedObject = contentObjects.find((item) => item.id === selectedObjectId) ?? contentObjects[0];
  return (
    <div className="workflowPage">
      <AgentPanel
        title="Content Panda"
        subtitle={`Consumes Content Planning matrix · ${readiness.approved}/${readiness.total} approved`}
        busy={busy}
        agentInput={agentInput}
        messages={messages}
        suggestions={workflowSuggestionsForView("content")}
        onAgentInputChange={onAgentInputChange}
        onSendAgentMessage={onSendAgentMessage}
        onRun={onRun}
      />
      <section className="objectWorkspace">
        <div className="pageHeader compact">
          <div>
            <p className="eyebrow">Canonical workspace</p>
            <h1>Content</h1>
            <p>Approve, revise, comment, and attach evidence per piece, channel, locale, and claim.</p>
          </div>
          <GatePanel
            run={run}
            phaseGate={phaseGate}
            reviewer={reviewer}
            gateApproved={gateApproved}
            onReviewerChange={onReviewerChange}
            onApproveGate={onApproveGate}
            onRequestRevision={onRequestRevision}
          />
        </div>
        <div className="handoffStrip">
          <span><b>{contentRequirements.length}</b> content requirements from Content Planning</span>
          <span><b>{readiness.channels.length}</b> channel workspaces</span>
          <span><b>{locales.length || 1}</b> locale-specific handoffs</span>
          <span><b>{readiness.blocked}</b> blocked · <b>{readiness.revision}</b> revisions</span>
          <span>Next: approved H2 objects feed Rollout build lanes</span>
        </div>
        <ObjectDetailWorkspace
          groups={groups}
          contentObjects={contentObjects}
          selectedObject={selectedObject}
          readiness={readiness}
          onSelect={setSelectedObjectId}
          onUpdate={onUpdateObject}
        />
      </section>
    </div>
  );
}

function ObjectDetailWorkspace({
  groups,
  contentObjects,
  selectedObject,
  readiness,
  onSelect,
  onUpdate
}: {
  groups: ContentWorkObject["channel"][];
  contentObjects: ContentWorkObject[];
  selectedObject?: ContentWorkObject;
  readiness: ObjectWorkspaceReadiness;
  onSelect: (id: string) => void;
  onUpdate: (id: string, status: WorkObjectStatus, comment: string) => void;
}) {
  if (!selectedObject) {
    return (
      <div className="objectDetailWorkspace empty">
        <p>No content objects are available yet. Run Content Planning to create the matrix.</p>
      </div>
    );
  }
  return (
    <div className="objectDetailWorkspace">
      <aside className="objectQueue">
        <div className="objectListHeader">
          <small>H2 object queue</small>
          <strong>{readiness.approved}/{readiness.total} approved</strong>
        </div>
        <div className="readinessMeter">
          <span style={{ width: `${readiness.pct}%` }} />
        </div>
        {groups.map((group) => (
          <section className="queueGroup" key={group}>
            <h3>{group}</h3>
            {contentObjects.filter((item) => item.channel === group).map((item) => (
              <button
                className={item.id === selectedObject.id ? "selected" : ""}
                onClick={() => onSelect(item.id)}
                key={item.id}
              >
                <span className={`statusDot ${item.status}`} />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.type} · {item.owner}</small>
                </div>
                <span className={`objectStatus ${item.status}`}>{item.status}</span>
              </button>
            ))}
          </section>
        ))}
      </aside>

      <section className="objectDetailPanel">
        <div className="detailHeader">
          <div>
            <small>{selectedObject.channel} · {selectedObject.type}</small>
            <h2>{selectedObject.title}</h2>
            <p>{selectedObject.owner} owns this H2 work object.</p>
          </div>
          <span className={`objectStatus ${selectedObject.status}`}>{selectedObject.status}</span>
        </div>

        <div className="detailCopy">
          <small>Draft copy / asset instruction</small>
          <p>{selectedObject.copy}</p>
        </div>

        <div className="detailGrid">
          <section>
            <h3>Evidence</h3>
            <div className="evidenceTags">
              {selectedObject.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}
            </div>
          </section>
          <section>
            <h3>Comments</h3>
            <div className="commentStack">
              {selectedObject.comments.map((comment) => (
                <article key={comment}>
                  <MessageSquare size={15} />
                  <span>{comment}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="objectActions detailActions">
          <button onClick={() => onUpdate(selectedObject.id, "in-review", "Comment added by Campaign Owner.")}>Comment</button>
          <button onClick={() => onUpdate(selectedObject.id, "in-review", "Panda drafted a tighter revision.")}>Edit with Panda</button>
          <button onClick={() => onUpdate(selectedObject.id, "approved", "Approved by Campaign Owner.")}>Approve this piece</button>
          <button onClick={() => onUpdate(selectedObject.id, "revision-requested", "Revision requested before H2.")}>Request revision</button>
          <button onClick={() => onUpdate(selectedObject.id, "blocked", "Compliance flag raised.")}>Flag compliance</button>
        </div>
      </section>

      <aside className="objectPandaPanel">
        <div className="agentStatus">
          <span className="agentPulse" />
          <strong>Panda revision brief</strong>
          <small>Scoped to this content object</small>
        </div>
        <div className="detailPromptBox">
          <small>Suggested instruction</small>
          <p>Revise {selectedObject.title} for {selectedObject.channel}, preserve evidence, and explain what changed before H2 approval.</p>
        </div>
        <div className="handoffList">
          {selectedObject.actions.map((action) => <span key={action}>{action}</span>)}
        </div>
      </aside>
    </div>
  );
}

function WorkflowShell({
  view,
  phase,
  run,
  campaignPlan,
  planningObjects,
  planningReadiness,
  contentRequirements,
  contentObjects,
  rolloutObjects,
  busy,
  messages,
  onRun,
  onAsk,
  onApplyContentPlanningInstruction,
  onApplyCampaignPlanningFeedback,
  onUpdatePlanningObject,
  onUpdateRolloutObject
}: {
  view: AppView;
  phase: PhaseId;
  run: CampaignRun;
  campaignPlan: CampaignPlan;
  planningObjects: PlanningWorkObject[];
  planningReadiness: PlanningReadiness;
  contentRequirements: ContentRequirement[];
  contentObjects: ContentWorkObject[];
  rolloutObjects: RolloutWorkObject[];
  busy: boolean;
  messages: AgentMessage[];
  onRun: (instruction?: string) => void;
  onAsk: (targetView: AppView, question: string) => void | Promise<void>;
  onApplyContentPlanningInstruction: (instruction: string) => boolean;
  onApplyCampaignPlanningFeedback: (proposal: LeadershipFeedbackProposal) => void;
  onUpdatePlanningObject: (id: string, status: WorkObjectStatus, comment: string) => void;
  onUpdateRolloutObject: (id: string, status: WorkObjectStatus, evidence: string) => void;
}) {
  const [workflowAgentInput, setWorkflowAgentInput] = useState("");
  const [selectedRolloutId, setSelectedRolloutId] = useState(rolloutObjects[0]?.id ?? "");
  const label = navigationItems.find((item) => item.id === view)?.label ?? currentPhaseMeta(phase).label;
  const samples = lighterWorkflowObjects(view);
  const handoff = handoffForView(view, campaignPlan, contentRequirements, contentObjects, rolloutObjects);
  const suggestions = workflowSuggestionsForView(view);
  function sendWorkflowInstruction() {
    const instruction = workflowAgentInput.trim();
    if (!instruction) return;
    setWorkflowAgentInput("");
    void onAsk(view, instruction);
  }
  return (
    <div className="workflowPage">
      <AgentPanel
        title={`${label} Panda`}
        subtitle={handoff.agentSubtitle}
        busy={busy}
        agentInput={workflowAgentInput}
        messages={messages}
        suggestions={suggestions}
        onAgentInputChange={setWorkflowAgentInput}
        onSendAgentMessage={sendWorkflowInstruction}
        onRun={() => onRun(workflowAgentInput || undefined)}
      />
      <section className="objectWorkspace">
        <div className="pageHeader compact">
          <div>
            <p className="eyebrow">Workflow workspace</p>
            <h1>{label}</h1>
            <p>{currentPhaseMeta(phase).description}</p>
          </div>
          <div className="activeCampaignContext">
            <small>Active campaign</small>
            <strong>{run.name}</strong>
            <span>{run.campaignId}</span>
          </div>
        </div>
        <div className="handoffStrip">
          {handoff.metrics.map((metric) => <span key={metric}>{metric}</span>)}
        </div>
        {view === "campaign-planning" && (
          <CampaignPlanningWorkspace
            plan={campaignPlan}
            objects={planningObjects}
            readiness={planningReadiness}
            requirements={contentRequirements}
            onApplyFeedback={onApplyCampaignPlanningFeedback}
            onUpdate={onUpdatePlanningObject}
          />
        )}
        {view === "content-planning" && (
          <ContentPlanningBoard
            plan={campaignPlan}
            requirements={contentRequirements}
            onApplyInstruction={onApplyContentPlanningInstruction}
          />
        )}
        {view === "rollout" && (
          <RolloutBoard
            rolloutObjects={rolloutObjects}
            selectedRolloutId={selectedRolloutId}
            onSelect={setSelectedRolloutId}
            onUpdate={onUpdateRolloutObject}
          />
        )}
        {view === "optimize" && (
          <div className="workObjectGrid">
            {samples.map((item) => (
              <article className="workObjectCard light" key={item.title}>
                <small>{item.owner}</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className={`objectStatus ${item.status}`}>{item.status}</span>
              </article>
            ))}
          </div>
        )}
        {!["campaign-planning", "content-planning", "rollout", "optimize"].includes(view) && (
          <div className="workObjectGrid">
            {samples.map((item) => (
            <article className="workObjectCard light" key={item.title}>
              <small>{item.owner}</small>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className={`objectStatus ${item.status}`}>{item.status}</span>
            </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CampaignPlanningWorkspace({
  plan,
  objects,
  readiness,
  requirements,
  onApplyFeedback,
  onUpdate
}: {
  plan: CampaignPlan;
  objects: PlanningWorkObject[];
  readiness: PlanningReadiness;
  requirements: ContentRequirement[];
  onApplyFeedback: (proposal: LeadershipFeedbackProposal) => void;
  onUpdate: (id: string, status: WorkObjectStatus, comment: string) => void;
}) {
  const [tab, setTab] = useState<"work" | "preview" | "feedback" | "versions">("work");
  const [versions, setVersions] = useState<string[]>([]);
  const sections = objects.filter((item) => item.id !== "missing-inputs");
  const missing = objects.find((item) => item.id === "missing-inputs");
  const slides = buildPlanPreviewSlides("campaign-planning", plan, requirements);

  function downloadDeck() {
    const filename = simulatedPlanDeckFilename("campaign-planning", plan.campaignId, versions.length + 1);
    simulatePrototypeDeckDownload(filename, slides);
    setVersions((current) => [`${filename} · shared with leadership`, ...current]);
  }

  return (
    <div className="campaignPlanningBoard">
      <section className="planningGateStrip" aria-label="H1 planning readiness">
        <div>
          <small>H1 Plan Gate</small>
          <strong>{readiness.approved}/{readiness.total} work objects approved</strong>
          <span>{readiness.blocked} blocked · {readiness.revision} revision requested</span>
        </div>
        <div className="readinessMeter">
          <span style={{ width: `${readiness.pct}%` }} />
        </div>
        <button className="secondary" onClick={() => objects.forEach((item) => onUpdate(item.id, "approved", "Approved for H1 planning packet."))}>
          <Check size={16} /> Approve ready plan
        </button>
      </section>

      <PlanPacketTabs active={tab} onChange={setTab} />

      {tab === "preview" && (
        <PlanPreviewPanel
          title="H1 Campaign Plan Preview"
          description="Leadership-facing preview before the simulated PPTX handoff."
          slides={slides}
          onDownload={downloadDeck}
        />
      )}

      {tab === "feedback" && (
        <LeadershipFeedbackPanel
          view="campaign-planning"
          onApply={(proposal) => {
            onApplyFeedback(proposal);
            setVersions((current) => [`Leadership feedback applied to H1 plan · ${proposal.summary}`, ...current]);
          }}
        />
      )}

      {tab === "versions" && <VersionHistoryPanel versions={versions} empty="No leadership deck has been shared yet." />}

      {tab === "work" && (
      <div className="planningWorkspaceGrid">
        <section className="planDocument">
          <div className="planDocumentHeader">
            <div>
              <small>H1 plan packet · approved campaign direction</small>
              <h2>{plan.name}</h2>
              <p>{plan.heroProduct} · {plan.markets.join(", ")} · {plan.budget}</p>
            </div>
            <span className="objectStatus in-review">H1 packet</span>
          </div>

          <div className="planSummary">
            <article><small>Markets</small><strong>{plan.markets.join(", ")}</strong></article>
            <article><small>Locales</small><strong>{plan.locales.join(", ")}</strong></article>
            <article><small>Audience</small><strong>{plan.audience.join(" / ")}</strong></article>
            <article><small>Timeline</small><strong>{plan.timeline}</strong></article>
          </div>

          <div className="planSectionGrid">
            {sections.map((item) => (
              <PlanningSectionCard item={item} key={item.id} onUpdate={onUpdate} />
            ))}
          </div>

          <section className="channelHandoff">
            <div>
              <small>What happens after H1 approval</small>
              <strong>Content Planning turns this plan into channel-by-asset requirements.</strong>
            </div>
            <div className="evidenceTags">
              {plan.channels.map((channel) => (
                <span key={channel.id}>{channel.name} → {channel.rolloutTarget}</span>
              ))}
            </div>
          </section>
        </section>

        <aside className="planningObjectRows">
          <div className="objectListHeader">
            <small>Work objects</small>
            <strong>H1 review queue</strong>
          </div>
          {objects.map((item) => (
            <PlanningObjectRow item={item} key={item.id} onUpdate={onUpdate} />
          ))}
          {missing && (
            <article className="missingInputCallout">
              <Flag size={18} />
              <div>
                <strong>{missing.title}</strong>
                <p>{missing.copy}</p>
              </div>
            </article>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}

function PlanningSectionCard({
  item,
  onUpdate
}: {
  item: PlanningWorkObject;
  onUpdate: (id: string, status: WorkObjectStatus, comment: string) => void;
}) {
  return (
    <article className="planSectionCard">
      <div className="objectTop">
        <small>{item.lane} · {item.owner}</small>
        <span className={`objectStatus ${item.status}`}>{item.status}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.copy}</p>
      <div className="evidenceTags">
        {item.evidence.slice(0, 3).map((evidence) => <span key={evidence}>{evidence}</span>)}
      </div>
      <div className="objectActions">
        <button onClick={() => onUpdate(item.id, "in-review", "Comment added on H1 planning object.")}>Comment</button>
        <button onClick={() => onUpdate(item.id, "revision-requested", "Ask Panda to revise this planning object.")}>Ask AI to revise</button>
        <button onClick={() => onUpdate(item.id, "approved", "Approved for H1 planning packet.")}>Approve</button>
        <button onClick={() => onUpdate(item.id, "revision-requested", "Revision requested before H1 approval.")}>Request revision</button>
      </div>
    </article>
  );
}

function PlanningObjectRow({
  item,
  onUpdate
}: {
  item: PlanningWorkObject;
  onUpdate: (id: string, status: WorkObjectStatus, comment: string) => void;
}) {
  return (
    <article className="planningObjectRow">
      <span className={`statusDot ${item.status}`} />
      <div>
        <strong>{item.title}</strong>
        <small>{item.lane} · {item.owner}</small>
      </div>
      <span className={`objectStatus ${item.status}`}>{item.status}</span>
      <button title="Approve" onClick={() => onUpdate(item.id, "approved", "Approved from H1 queue.")}>
        <Check size={15} />
      </button>
    </article>
  );
}

function PlanPacketTabs({
  active,
  onChange,
  workLabel = "Work Objects"
}: {
  active: "work" | "preview" | "feedback" | "versions";
  onChange: (tab: "work" | "preview" | "feedback" | "versions") => void;
  workLabel?: string;
}) {
  const tabs = [
    { id: "work" as const, label: workLabel },
    { id: "preview" as const, label: "Plan Preview" },
    { id: "feedback" as const, label: "Leadership Feedback" },
    { id: "versions" as const, label: "Version History" }
  ];
  return (
    <div className="planPacketTabs">
      {tabs.map((tab) => (
        <button className={active === tab.id ? "selected" : ""} onClick={() => onChange(tab.id)} key={tab.id}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PlanPreviewPanel({
  title,
  description,
  slides,
  onDownload
}: {
  title: string;
  description: string;
  slides: PlanPreviewSlide[];
  onDownload: () => void;
}) {
  return (
    <section className="planPreviewPanel">
      <div className="previewHeader">
        <div>
          <small>Leadership deck preview</small>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="secondary" onClick={onDownload}><Download size={16} /> Download PPTX</button>
      </div>
      <div className="slidePreviewGrid">
        {slides.map((slide, index) => (
          <article className="slidePreviewCard" key={`${slide.title}-${index}`}>
            <small>{slide.kicker}</small>
            <h3>{slide.title}</h3>
            <ul>
              {slide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function LeadershipFeedbackPanel({
  view,
  onApply
}: {
  view: "campaign-planning" | "content-planning";
  onApply: (proposal: LeadershipFeedbackProposal, feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [proposal, setProposal] = useState<LeadershipFeedbackProposal | undefined>();

  function parseFeedback() {
    setProposal(buildLeadershipFeedbackProposal(view, feedback));
  }

  function applyAll() {
    if (!proposal) return;
    onApply(proposal, feedback);
  }

  return (
    <section className="leadershipFeedbackPanel">
      <div className="feedbackInput">
        <small>Leadership feedback intake</small>
        <h2>Paste leadership input for Panda</h2>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Example: Leadership wants MOCN audience only and clearer KPI ownership before approval."
        />
        <div className="feedbackActions">
          <button className="secondary" onClick={parseFeedback} disabled={!feedback.trim()}>
            <Sparkles size={16} /> Ask Panda to propose changes
          </button>
          <button className="primary" onClick={applyAll} disabled={!proposal?.changes.length}>
            <Check size={16} /> Apply all
          </button>
        </div>
      </div>

      <div className="proposalList">
        <small>Proposed changes</small>
        <strong>{proposal?.summary ?? "No feedback parsed yet."}</strong>
        {proposal?.changes.map((change) => (
          <article key={change.id}>
            <span className="objectStatus in-review">{change.action}</span>
            <h3>{change.label}</h3>
            <p>{change.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VersionHistoryPanel({ versions, empty }: { versions: string[]; empty: string }) {
  return (
    <section className="versionHistoryPanel">
      <small>Plan artifact history</small>
      <h2>Leadership handoff versions</h2>
      {versions.length === 0 ? <p>{empty}</p> : versions.map((version) => <span key={version}>{version}</span>)}
    </section>
  );
}

function simulatePrototypeDeckDownload(filename: string, slides: PlanPreviewSlide[]) {
  const body = [
    `Prototype PPTX placeholder: ${filename}`,
    "",
    ...slides.map((slide, index) => [`Slide ${index + 1}: ${slide.title}`, slide.kicker, ...slide.bullets.map((bullet) => `- ${bullet}`), ""].join("\n"))
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ContentPlanningBoard({
  plan,
  requirements,
  onApplyInstruction
}: {
  plan: CampaignPlan;
  requirements: ContentRequirement[];
  onApplyInstruction: (instruction: string) => boolean;
}) {
  const bridge = useMemo(() => buildContentPlanningBridge(plan, requirements), [plan, requirements]);
  const [tab, setTab] = useState<"concept" | "requirements" | "storyboard" | "figma" | "preview" | "feedback" | "versions">("concept");
  const [approvals, setApprovals] = useState<Record<keyof ContentPlanningBridge, ContentPlanningApprovalStatus>>({
    creativeConcept: bridge.creativeConcept.status,
    requirements: bridge.requirements.status,
    storyboard: bridge.storyboard.status,
    figmaBoard: bridge.figmaBoard.status
  });
  const [versions, setVersions] = useState<string[]>([]);
  const approvedBridge: ContentPlanningBridge = {
    creativeConcept: { ...bridge.creativeConcept, status: approvals.creativeConcept },
    requirements: { ...bridge.requirements, status: approvals.requirements },
    storyboard: { ...bridge.storyboard, status: approvals.storyboard },
    figmaBoard: { ...bridge.figmaBoard, status: approvals.figmaBoard }
  };
  const readiness = contentPlanningBridgeReadiness(approvedBridge);
  const channels = Array.from(new Set(requirements.map((item) => item.channel)));
  const locales = Array.from(new Set(requirements.map((item) => item.locale)));
  const rolloutTargets = Array.from(new Set(requirements.map((item) => item.rolloutTarget)));
  const priorityItems = requirements.slice(0, 4);
  const slides = buildPlanPreviewSlides("content-planning", plan, requirements);

  function updateApproval(key: keyof ContentPlanningBridge, status: ContentPlanningApprovalStatus) {
    setApprovals((current) => ({ ...current, [key]: status }));
  }

  function downloadDeck() {
    const filename = simulatedPlanDeckFilename("content-planning", plan.campaignId, versions.length + 1);
    simulatePrototypeDeckDownload(filename, slides);
    setVersions((current) => [`${filename} · shared with leadership`, ...current]);
  }

  return (
    <div className="contentPlanningBoard">
      <ContentPlanningTabs active={tab} onChange={setTab} />

      <section className={readiness.readyForH2 ? "cpReadiness ready" : "cpReadiness"}>
        <div>
          <small>H2 readiness</small>
          <strong>{readiness.approved}/4 CP packages approved</strong>
          <p>{readiness.readyForH2 ? "Final H2 approval is ready." : `Pending before H2: ${readiness.pending.join(", ")}`}</p>
        </div>
        <button disabled={!readiness.readyForH2}>
          <Check size={16} /> Final H2 approval
        </button>
      </section>

      {tab === "preview" && (
        <PlanPreviewPanel
          title="H2 Content Plan Preview"
          description="Slide-style leadership preview of the content matrix, Figma mapping, localization, and H2 ask."
          slides={slides}
          onDownload={downloadDeck}
        />
      )}

      {tab === "feedback" && (
        <LeadershipFeedbackPanel
          view="content-planning"
          onApply={(proposal, feedback) => {
            if (proposal.changes.some((change) => change.id === "add-mocn-content")) {
              onApplyInstruction(feedback);
            }
            setVersions((current) => [`Leadership feedback applied to H2 content plan · ${proposal.summary}`, ...current]);
          }}
        />
      )}

      {tab === "versions" && <VersionHistoryPanel versions={versions} empty="No content planning deck has been shared yet." />}

      {tab === "concept" && (
        <CreativeConceptPanel packageData={approvedBridge.creativeConcept} onUpdate={(status) => updateApproval("creativeConcept", status)} />
      )}

      {tab === "storyboard" && (
        <StoryboardPanel packageData={approvedBridge.storyboard} onUpdate={(status) => updateApproval("storyboard", status)} />
      )}

      {tab === "figma" && (
        <FigmaBoardPanel packageData={approvedBridge.figmaBoard} onUpdate={(status) => updateApproval("figmaBoard", status)} />
      )}

      {tab === "requirements" && (
      <>
      <section className="handoffSourcePanel">
        <div>
          <small>Input from Campaign Planning</small>
          <h2>H1 plan is the source for this matrix</h2>
          <p>
            Panda reads the approved campaign direction, channels, locales, and rollout targets, then creates the content requirements that the Content workspace will build and approve piece by piece.
          </p>
        </div>
        <div className="sourceFacts">
          <article>
            <small>Campaign</small>
            <strong>{plan.name}</strong>
          </article>
          <article>
            <small>Markets</small>
            <strong>{plan.markets.join(", ")}</strong>
          </article>
          <article>
            <small>Locales</small>
            <strong>{locales.join(", ")}</strong>
          </article>
        </div>
      </section>

      <section className="matrixOverview">
        <article>
          <small>Requirements</small>
          <strong>{requirements.length}</strong>
          <span>content pieces to create</span>
        </article>
        <article>
          <small>Channels</small>
          <strong>{channels.length}</strong>
          <span>{channels.join(", ")}</span>
        </article>
        <article>
          <small>Rollout targets</small>
          <strong>{rolloutTargets.length}</strong>
          <span>{rolloutTargets.join(", ")}</span>
        </article>
      </section>

      <section className="contentMatrixShell">
        <div className="objectListHeader">
          <small>Content requirement matrix</small>
          <strong>Next handoff to Content workspace</strong>
        </div>
        <ContentRequirementMatrix requirements={requirements} featuredIds={new Set(priorityItems.map((item) => item.id))} />
        <ObjectApprovalStrip status={approvedBridge.requirements.status} onUpdate={(status) => updateApproval("requirements", status)} />
      </section>
      </>
      )}
    </div>
  );
}

function ContentPlanningTabs({
  active,
  onChange
}: {
  active: "concept" | "requirements" | "storyboard" | "figma" | "preview" | "feedback" | "versions";
  onChange: (tab: "concept" | "requirements" | "storyboard" | "figma" | "preview" | "feedback" | "versions") => void;
}) {
  const tabs = [
    ["concept", "Creative Concept"],
    ["requirements", "Requirements Matrix"],
    ["storyboard", "Storyboard"],
    ["figma", "Figma Board"],
    ["preview", "Plan Preview"],
    ["feedback", "Leadership Feedback"],
    ["versions", "Version History"]
  ] as const;
  return (
    <div className="planTabs cpTabs">
      {tabs.map(([id, label]) => <button className={active === id ? "active" : ""} key={id} onClick={() => onChange(id)}>{label}</button>)}
    </div>
  );
}

function ObjectApprovalStrip({ status, onUpdate }: { status: ContentPlanningApprovalStatus; onUpdate: (status: ContentPlanningApprovalStatus) => void }) {
  return (
    <div className="objectApprovalStrip">
      <span className={`objectStatus ${status}`}>{status}</span>
      <button onClick={() => onUpdate("approved")}><Check size={15} /> Approve object</button>
      <button onClick={() => onUpdate("revision-requested")}>Request revision</button>
    </div>
  );
}

function CreativeConceptPanel({ packageData, onUpdate }: { packageData: ContentPlanningBridge["creativeConcept"]; onUpdate: (status: ContentPlanningApprovalStatus) => void }) {
  return (
    <section className="cpPackagePanel creativeConceptPanel">
      <PackageHeader storyId={packageData.storyId} title={packageData.title} status={packageData.status} onUpdate={onUpdate} />
      <div className="headHeartHands">
        <article><small>Head</small><strong>Big idea</strong><p>{packageData.head}</p></article>
        <article><small>Heart</small><strong>Look & feel</strong><p>{packageData.heart}</p></article>
        <article><small>Hands</small><strong>In-situ proof</strong><p>{packageData.hands}</p></article>
      </div>
      <div className="cpTwoColumn">
        <ChecklistBlock title="Proof points" items={packageData.proofPoints} />
        <ChecklistBlock title="Visual directions" items={packageData.visualDirections} />
      </div>
    </section>
  );
}

function StoryboardPanel({ packageData, onUpdate }: { packageData: ContentPlanningBridge["storyboard"]; onUpdate: (status: ContentPlanningApprovalStatus) => void }) {
  return (
    <section className="cpPackagePanel">
      <PackageHeader storyId={packageData.storyId} title={packageData.title} status={packageData.status} onUpdate={onUpdate} />
      <div className="storyboardGrid">
        {packageData.frames.map((frame) => (
          <article key={frame.id}>
            <small>{frame.channel}</small>
            <strong>{frame.scene}</strong>
            <p>{frame.direction}</p>
            <span>{frame.script}</span>
          </article>
        ))}
      </div>
      <div className="cpTwoColumn">
        <ChecklistBlock title="Shotlist" items={packageData.shotlist} />
        <ChecklistBlock title="Production plan" items={packageData.productionPlan} />
      </div>
    </section>
  );
}

function FigmaBoardPanel({ packageData, onUpdate }: { packageData: ContentPlanningBridge["figmaBoard"]; onUpdate: (status: ContentPlanningApprovalStatus) => void }) {
  return (
    <section className="cpPackagePanel">
      <PackageHeader storyId={packageData.storyId} title={packageData.title} status={packageData.status} onUpdate={onUpdate} />
      <div className="figmaActionBar">
        <button><Sparkles size={16} /> Create Figma Mapping</button>
        <button className="secondary" onClick={() => window.open(packageData.figmaUrl, "_blank", "noopener,noreferrer")}>Open Figma</button>
        <span>{packageData.mappingStatus}</span>
      </div>
      <div className="figmaBoardMock">
        {packageData.frames.map((frame) => (
          <article key={frame.id}>
            <div className="figmaFramePreview">
              {Array.from({ length: Math.max(1, Math.min(frame.placeholderCount, 5)) }).map((_, index) => <span key={index} />)}
            </div>
            <strong>{frame.name}</strong>
            <small>{frame.ratio} · {frame.placeholderCount} placeholders</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function PackageHeader({ storyId, title, status, onUpdate }: { storyId: string; title: string; status: ContentPlanningApprovalStatus; onUpdate: (status: ContentPlanningApprovalStatus) => void }) {
  return (
    <header className="cpPackageHeader">
      <div>
        <small>{storyId} object-level approval</small>
        <h2>{title}</h2>
      </div>
      <ObjectApprovalStrip status={status} onUpdate={onUpdate} />
    </header>
  );
}

function ChecklistBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="checklistBlock">
      <h3>{title}</h3>
      {items.map((item) => <span key={item}><Check size={14} /> {item}</span>)}
    </div>
  );
}

function ContentRequirementMatrix({ requirements, featuredIds = new Set<string>() }: { requirements: ContentRequirement[]; featuredIds?: Set<string> }) {
  return (
    <div className="requirementMatrix">
      {requirements.map((item) => (
        <article className={featuredIds.has(item.id) ? "requirementRow featured" : "requirementRow"} key={item.id}>
          <div>
            <small>{item.channel} · {item.locale}</small>
            <strong>{item.title}</strong>
            <span>{item.assetType}</span>
          </div>
          <p>{item.compliance}</p>
          <div className="evidenceTags">
            <span>{item.owner}</span>
            <span>{item.rolloutTarget}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function RolloutBoard({
  rolloutObjects,
  selectedRolloutId,
  onSelect,
  onUpdate
}: {
  rolloutObjects: RolloutWorkObject[];
  selectedRolloutId: string;
  onSelect: (id: string) => void;
  onUpdate: (id: string, status: WorkObjectStatus, evidence: string) => void;
}) {
  const readiness = rolloutWorkspaceReadiness(rolloutObjects);
  const selected = rolloutObjects.find((item) => item.id === selectedRolloutId) ?? rolloutObjects[0];
  if (!selected) {
    return (
      <div className="objectDetailWorkspace empty">
        <p>No rollout lanes are available yet. Approve content objects to create H3 rollout work.</p>
      </div>
    );
  }
  return (
    <div className="rolloutDetailWorkspace">
      <aside className="objectQueue">
        <div className="objectListHeader">
          <small>H3 rollout lanes</small>
          <strong>{readiness.approved}/{readiness.total} approved</strong>
        </div>
        <div className="readinessMeter">
          <span style={{ width: `${readiness.pct}%` }} />
        </div>
        <div className="queueMeta">
          <span>{readiness.sourceObjects} source objects</span>
          <span>{readiness.blocked} blocked</span>
        </div>
        {rolloutObjects.map((item) => (
          <button
            className={item.id === selected.id ? "selected" : ""}
            onClick={() => onSelect(item.id)}
            key={item.id}
          >
            <span className={`statusDot ${item.status}`} />
            <div>
              <strong>{item.lane}</strong>
              <small>{item.owner} · {item.sourceContentIds.length} source objects</small>
            </div>
            <span className={`objectStatus ${item.status}`}>{item.status}</span>
          </button>
        ))}
      </aside>

      <section className="objectDetailPanel rolloutDetailPanel">
        <div className="detailHeader">
          <div>
            <small>{selected.owner} · {selected.gate}</small>
            <h2>{selected.title}</h2>
            <p>{selected.lane} build lane remains held until H3 publish approval.</p>
          </div>
          <span className={`objectStatus ${selected.status}`}>{selected.status}</span>
        </div>

        <div className="detailGrid">
          <section>
            <h3>Evidence Pack</h3>
            <div className="evidenceTags">
              {selected.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}
            </div>
          </section>
          <section>
            <h3>Source Content</h3>
            <div className="handoffList">
              {selected.sourceContentIds.length > 0
                ? selected.sourceContentIds.map((id) => <span key={id}>{id}</span>)
                : <span>No approved H2 sources yet</span>}
            </div>
          </section>
        </div>

        <section className="rolloutChecklist">
          <h3>Lane Actions</h3>
          {selected.actions.map((action) => (
            <label key={action}>
              <input type="checkbox" checked={selected.status === "approved"} readOnly />
              <span>{action}</span>
            </label>
          ))}
        </section>

        <div className="objectActions detailActions">
          <button onClick={() => onUpdate(selected.id, "in-review", "H3 evidence reviewed by Campaign Owner.")}>Mark in review</button>
          <button onClick={() => onUpdate(selected.id, "approved", "Approved for H3 publish readiness packet.")}>Approve lane</button>
          <button onClick={() => onUpdate(selected.id, "revision-requested", "Revision requested before H3.")}>Request revision</button>
          <button onClick={() => onUpdate(selected.id, "blocked", "Connector or owner input missing before H3.")}>Block lane</button>
        </div>
      </section>

      <aside className="objectPandaPanel">
        <div className="agentStatus">
          <span className="agentPulse" />
          <strong>Panda rollout brief</strong>
          <small>Scoped to {selected.lane}</small>
        </div>
        <div className="detailPromptBox">
          <small>Suggested instruction</small>
          <p>Build the {selected.lane} H3 evidence packet, verify connector assumptions, and keep publish held.</p>
        </div>
        <div className="handoffList">
          <span>Contentful</span>
          <span>Sprinklr</span>
          <span>SFMC</span>
          <span>Paid media QA</span>
        </div>
      </aside>
    </div>
  );
}

function handoffForView(
  view: AppView,
  plan: CampaignPlan,
  requirements: ContentRequirement[],
  contentObjects: ContentWorkObject[],
  rolloutObjects: RolloutWorkObject[]
) {
  if (view === "campaign-planning") {
    return {
      agentSubtitle: "Produces the H1 campaign plan consumed by every downstream workspace",
      metrics: [
        `${plan.channels.length} channels`,
        `${plan.locales.length} locales`,
        `${plan.kpis.length} KPIs`,
        "Feeds Content Planning matrix"
      ]
    };
  }
  if (view === "content-planning") {
    return {
      agentSubtitle: "Consumes H1 plan and produces the channel-by-asset requirement matrix",
      metrics: [
        `${requirements.length} requirements`,
        `${new Set(requirements.map((item) => item.channel)).size} channels`,
        "Feeds Content workspace",
        "Carries Figma and compliance evidence"
      ]
    };
  }
  if (view === "rollout") {
    const approved = contentObjects.filter((item) => item.status === "approved").length;
    return {
      agentSubtitle: "Consumes approved H2 content objects and builds H3 publish readiness",
      metrics: [
        `${approved}/${contentObjects.length} H2 objects approved`,
        `${rolloutObjects.length} rollout lanes`,
        "Contentful / Sprinklr / SFMC / paid media handoff",
        "No auto-publish"
      ]
    };
  }
  return {
    agentSubtitle: "Consumes live/read-only performance evidence for H4 optimization",
    metrics: ["Paid media performance", "HOL behavior", "Email engagement", "Knowledge promotion candidates"]
  };
}

function workflowSuggestionsForView(view: AppView) {
  if (view === "campaign-planning") {
    return [
      { label: "Draft objective", prompt: "Draft a sharper H1 campaign objective and explain downstream impact." },
      { label: "Suggest KPIs", prompt: "Review the KPI Definition object and propose measurable paid-media, HOL, email, and H3 readiness KPIs." },
      { label: "Review budget", prompt: "Check whether the budget allocation matches the channel strategy and flag missing assumptions." },
      { label: "Find gaps", prompt: "Scan the H1 plan against RMB requested outputs and list missing inputs before approval." }
    ];
  }
  if (view === "content-planning") {
    return [
      { label: "Build matrix", prompt: "Expand the content planning matrix from the approved H1 plan." },
      { label: "Check Figma", prompt: "Identify which planned assets need Figma layout mapping evidence." },
      { label: "Locale gaps", prompt: "Find missing locale variants and owners for the content plan." }
    ];
  }
  if (view === "rollout") {
    return [
      { label: "Prepare H3", prompt: "Prepare the H3 publish readiness checklist from approved H2 content objects." },
      { label: "Connector gaps", prompt: "List missing Contentful, Sprinklr, SFMC, and paid media connector inputs." }
    ];
  }
  return [
    { label: "Explain status", prompt: "Explain the current workspace status and next gate action." },
    { label: "Find blockers", prompt: "Find blockers, owners, and next actions for this workflow." }
  ];
}

function AgentPanel({
  title,
  subtitle,
  busy,
  agentInput,
  messages,
  suggestions = [],
  onAgentInputChange,
  onSendAgentMessage,
  onRun
}: {
  title: string;
  subtitle: string;
  busy: boolean;
  agentInput: string;
  messages: AgentMessage[];
  suggestions?: Array<{ label: string; prompt: string }>;
  onAgentInputChange: (value: string) => void;
  onSendAgentMessage: () => void;
  onRun: () => void;
}) {
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const agentLabel = title.replace(" Panda", "");

  function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    setAttachments((current) => [...current, ...Array.from(files).map((file) => file.name)].slice(-4));
  }

  return (
    <aside className="workflowAgent">
      <div className="agentShellTop">
        <div className="agentIdentity">
          <div className="agentAvatar"><Bot size={15} /></div>
          <div>
            <strong>Panda</strong>
            <small>{agentLabel} agent</small>
          </div>
          <span className={busy ? "agentPulse running" : "agentPulse"} title={busy ? "Running" : "Ready"} />
        </div>

        <div className="agentBrief">
          <small>Context</small>
          <p>{subtitle}</p>
        </div>

        {suggestions.length > 0 && (
          <div className="agentSuggestions">
            {suggestions.map((suggestion) => (
              <button key={suggestion.label} onClick={() => onAgentInputChange(suggestion.prompt)}>
                <Sparkles size={13} /> {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="messages compactMessages">
        {messages.length === 0 && (
          <article className="message agent">
            <b>Panda</b>
            <p>Ready to plan, build, revise, and prepare gate evidence for this workspace.</p>
          </article>
        )}
        {messages.slice(-5).map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <span className="messageAvatar">{message.role === "agent" ? <Bot size={12} /> : message.role === "user" ? <User size={12} /> : <Sparkles size={12} />}</span>
            <div>
              <b>{message.role === "agent" ? "Panda" : message.role === "user" ? "You" : "System"}</b>
              <p>{message.text}</p>
            </div>
          </article>
        ))}
        {busy && (
          <article className="message agent">
            <span className="messageAvatar"><Bot size={12} /></span>
            <div>
              <b>Panda</b>
              <p>I am reading the shared campaign context and preparing a scoped answer.</p>
            </div>
          </article>
        )}
      </div>

      <div className="agentComposer figmaComposer">
        {attachments.length > 0 && (
          <div className="attachmentChips">
            {attachments.map((item) => (
              <span key={item}>
                <Paperclip size={11} />
                {item}
                <button onClick={() => setAttachments((current) => current.filter((name) => name !== item))} title={`Remove ${item}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea value={agentInput} onChange={(event) => onAgentInputChange(event.target.value)} placeholder="Ask Panda to plan, revise, or build..." />
        <div className="composerToolbar">
          <input ref={fileRef} type="file" multiple onChange={(event) => addAttachments(event.target.files)} />
          <div className="composerTools">
            <button title="Upload file" aria-label="Upload file" onClick={() => fileRef.current?.click()}><Plus size={15} /></button>
            <button title="Use evidence" aria-label="Use evidence" onClick={() => onAgentInputChange(agentInput || "Use the available campaign evidence for this workspace answer.")}><Paperclip size={14} /></button>
            <button title="Use skills" aria-label="Use skills" onClick={() => onAgentInputChange(agentInput || "Use the relevant Panda skills for this workspace.")}><Sparkles size={14} /></button>
          </div>
          <select className="modelSelectCompact" aria-label="Model placeholder" defaultValue="deepseek" title="DeepSeek model">
            <option value="deepseek">DS</option>
            <option value="gemini">Gemini</option>
            <option value="creative">Creative</option>
          </select>
          <button className="sendRound" onClick={onSendAgentMessage} disabled={busy || !agentInput.trim()}>
            {busy ? <RefreshCw className="spin" size={15} /> : <Send size={14} />}
            <span>Send</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function WorkObjectCard({ item, onUpdate }: { item: ContentWorkObject; onUpdate: (id: string, status: WorkObjectStatus, comment: string) => void }) {
  return (
    <article className="workObjectCard">
      <div className="objectTop">
        <small>{item.type} · {item.owner}</small>
        <span className={`objectStatus ${item.status}`}>{item.status}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.copy}</p>
      <div className="evidenceTags">
        {item.evidence.map((evidence) => <span key={evidence}>{evidence}</span>)}
      </div>
      <div className="objectComments">
        <MessageSquare size={15} />
        <span>{item.comments[0]}</span>
      </div>
      <div className="objectActions">
        <button onClick={() => onUpdate(item.id, "in-review", "Comment added by Campaign Owner.")}>Comment</button>
        <button onClick={() => onUpdate(item.id, "in-review", "Panda drafted a tighter revision.")}>Ask AI to revise</button>
        <button onClick={() => onUpdate(item.id, "approved", "Approved by Campaign Owner.")}>Approve</button>
        <button onClick={() => onUpdate(item.id, "revision-requested", "Revision requested before H2.")}>Request revision</button>
        <button onClick={() => onUpdate(item.id, "blocked", "Compliance flag raised.")}>Flag compliance</button>
      </div>
    </article>
  );
}

function GatePanel({
  run,
  phaseGate,
  reviewer,
  gateApproved,
  onReviewerChange,
  onApproveGate,
  onRequestRevision
}: {
  run: CampaignRun;
  phaseGate?: CampaignRun["currentGate"];
  reviewer: string;
  gateApproved: boolean;
  onReviewerChange: (value: string) => void;
  onApproveGate: () => void;
  onRequestRevision: () => void;
}) {
  const activePhase = currentPhaseMeta(run.phase);
  return (
    <div className="gateInline">
      <strong>{phaseGate?.id ?? activePhase.gate}</strong>
      <span>{phaseGate?.recommendation ?? "Roll-up gate becomes ready when required work objects are approved."}</span>
      <input value={reviewer} onChange={(event) => onReviewerChange(event.target.value)} />
      <button className="approve" onClick={onApproveGate} disabled={!phaseGate || gateApproved}><Check size={16} /> {gateApproved ? "Signed" : "Approve Gate"}</button>
      <button className="secondary" onClick={onRequestRevision} disabled={!phaseGate}>Revise</button>
    </div>
  );
}

function TaskList({ tasks, onDetail }: { tasks: string[]; onDetail?: (task: string) => void }) {
  return (
    <div className="taskList">
      {tasks.map((task) => (
        <span key={task} className={onDetail ? "taskWithDetail" : undefined}>
          <span>{task}</span>
          {onDetail && <button className="detailButton compact" onClick={() => onDetail(task)}>Detail <ChevronRight size={14} /></button>}
        </span>
      ))}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panelTitle">
        {icon}
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

function lighterWorkflowObjects(view: AppView) {
  const map: Record<string, Array<{ title: string; owner: string; description: string; status: WorkObjectStatus }>> = {
    "campaign-planning": [
      { title: "Campaign objectives", owner: "Campaign Owner", description: "Business objective, launch window, KPI, and risk assumptions.", status: "in-review" },
      { title: "Audience and segment brief", owner: "Paid Media", description: "Contractor/specifier priority and DACH locale split.", status: "draft" },
      { title: "Budget and channel split", owner: "Campaign Owner", description: "Budget allocation and channel role for H1 readiness.", status: "draft" }
    ],
    "content-planning": [
      { title: "Creative concept", owner: "Content / Creative", description: "Campaign story, proof points, and message architecture.", status: "in-review" },
      { title: "Figma mapping", owner: "Content / Creative", description: "Frame, placeholder, and asset requirements for production.", status: "draft" },
      { title: "Localization requirements", owner: "Campaign Owner", description: "Locale needs, market reviewer plan, and translation evidence.", status: "draft" }
    ],
    rollout: [
      { title: "Contentful LP build", owner: "HOL", description: "Landing page manifest and held publish evidence.", status: "draft" },
      { title: "SFMC journey build", owner: "Email TA", description: "Email build, translation, and journey-readiness evidence.", status: "blocked" },
      { title: "Paid media QA matrix", owner: "Paid Media", description: "Ad group, keyword, UTM, and URL checks before H3.", status: "draft" }
    ],
    optimize: [
      { title: "Paid media recommendation", owner: "Paid Media", description: "Budget, audience, and creative optimization proposal.", status: "draft" },
      { title: "HOL landing page insight", owner: "HOL", description: "GA4 and heat-map-backed improvement recommendation.", status: "draft" },
      { title: "Knowledge promotion candidate", owner: "Campaign Owner", description: "Reusable learning candidate for future Panda skills.", status: "in-review" }
    ]
  };
  return map[view] ?? [];
}

function contentObjectsForRun(run: CampaignRun): ContentWorkObject[] {
  return createContentWorkObjectsFromRequirements(contentRequirementsFromPlan(campaignPlanForRun(run)));
}

function rolloutObjectsForRun(run: CampaignRun): RolloutWorkObject[] {
  return createRolloutWorkObjectsFromContent(contentObjectsForRun(run));
}

function loadWorkspace(): CampaignWorkspace {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored) as CampaignWorkspace;
    const legacy = localStorage.getItem("panda-v4-run");
    if (legacy) {
      const run = JSON.parse(legacy) as CampaignRun;
      return { activeCampaignId: run.campaignId, campaigns: [run], messages: { [run.campaignId]: [] } };
    }
    return createDefaultWorkspace();
  } catch {
    return createDefaultWorkspace();
  }
}

createRoot(document.getElementById("root")!).render(<App />);
