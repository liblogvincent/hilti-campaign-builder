import { create } from "zustand";
import type {
  CampaignRun,
  NodeStatus,
  GateDecisionVerdict,
  RegistryArtifact,
  SkillProposal,
  GateId,
  ContentBundle,
  AdVariant,
} from "../types";
import { campaigns as fixtureCampaigns, registry as fixtureRegistry, proposals as fixtureProposals } from "../fixtures";
import { ALT_SOURCE_VARIANTS, SOURCE_VARIANTS_CAMP_04 } from "../lib/contentFixtures";
import {
  POST_APPROVE,
  POST_CHANGES,
  POST_REJECT,
  POST_H1_APPROVE,
  POST_H3_APPROVE,
  POST_H4_APPROVE,
  AT_H1,
  AT_H2,
  AT_H3,
  AT_H4,
} from "../lib/chatScript";
import { toast } from "sonner";
import { selectArchetype, adaptPlanWithRepair, executeAgentNode, buildExecuteInput } from "../lib/agentClient";
import { mapPlanToRunNodes } from "../lib/planMapper";
import { getArchetype } from "../lib/archetypes";
import { FIXTURE_PLAN } from "../lib/planFixtures";
import type { ArchetypeSelectOutput } from "../lib/agentSchemas";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  ts: number;
  progress?: ProgressLine[];
  action?: { label: string; kind: "open-h1" | "open-h2" | "open-h3" | "open-h4" };
  /** Present on the archetype-select agent message; UI renders an ArchetypeSelectCard + override dropdown from it. */
  archetype_pick?: ArchetypeSelectOutput;
}

export interface ProgressLine {
  nodeId: string;
  label: string;
  state: "pending" | "running" | "done";
  viewLabel?: string;
}

export interface PanelTab {
  id: string;
  label: string;
  kind: "node" | "gate" | "home";
}

interface LubanState {
  campaigns: CampaignRun[];
  registry: RegistryArtifact[];
  proposals: SkillProposal[];
  /** IDs of proposals already promoted in this session. */
  appliedImpactIds: string[];
  /** Per-campaign live content bundles (editable copy of fixture). */
  contentBundles: Record<string, ContentBundle>;
  /** Undo stack for regenerate, last 3 per campaign. */
  contentHistory: Record<string, ContentBundle[]>;
  /** H2 reviewer flags, key `${campaignId}:${variantId}`. */
  reviewFlags: Record<string, "ok" | "flag">;
  activeCampaignId: string;
  /** Per-campaign forced archetype overrides (campaignId -> archetype id). Set by the manual-override UI. */
  archetypeOverrides: Record<string, string>;
  chat: ChatMessage[];
  panelTabs: PanelTab[];
  activeTabId: string;
  layout: "panel" | "chat" | "both";
  centerView: "chat" | "graph";
  _seq: number;

  getCampaign: (id: string) => CampaignRun | undefined;
  getActive: () => CampaignRun;
  getRegistry: () => RegistryArtifact[];
  getContentBundle: (campaignId: string) => ContentBundle | undefined;

  addUserMessage: (text: string) => void;
  addAgentMessage: (msg: Omit<ChatMessage, "id" | "role" | "ts">) => string;
  updateAgentMessage: (id: string, patch: Partial<ChatMessage>) => void;

  setNodeStatus: (campaignId: string, nodeId: string, status: NodeStatus) => void;
  signGate: (
    campaignId: string,
    nodeId: string,
    verdict: GateDecisionVerdict,
    reviewer: string,
    note: string,
    signature?: string | null,
    signatureKind?: "drawn" | "typed",
    proposalActions?: { proposal_id: string; action: "promote" | "reject" }[],
  ) => void;
  addCost: (campaignId: string, delta: number) => void;
  setCampaignStatus: (campaignId: string, status: CampaignRun["status"]) => void;
  setConnectorCallStatus: (campaignId: string, nodeId: string, idx: number, status: "ok" | "pending" | "error") => void;

  // skill compounding
  promoteProposal: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => void;

  // content layer
  updateContentVariant: (campaignId: string, variantId: string, patch: Partial<AdVariant>) => void;
  flagVariant: (campaignId: string, variantId: string, flag: "ok" | "flag") => void;
  requestTranslation: (campaignId: string, locale: string) => Promise<void>;
  regenerateContent: (campaignId: string) => Promise<void>;
  undoRegenerate: (campaignId: string) => void;
  runAutoFix: (campaignId: string, variantId: string) => Promise<void>;

  openTab: (tab: PanelTab) => void;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  setLayout: (l: "panel" | "chat" | "both") => void;
  setCenterView: (v: "chat" | "graph") => void;

  // Orchestrator
  runOpeningSequence: () => Promise<void>;
  /** Live-agent entry path: brief -> select archetype -> adapt plan -> map -> store nodes. */
  runBriefFlow: (brief: string) => Promise<void>;
  /** Walk the DAG: execute ready agent/tool nodes, pause at gate nodes. */
  executeNextNodes: (cid: string) => Promise<void>;
  /** Internal: build plan context string from completed nodes. */
  _planContext: (cid: string) => string;
  /** Internal: get the brief text from chat history. */
  _getBrief: (cid: string) => string;
  approveH1: (signer: string, signature: string, kind: "drawn" | "typed") => Promise<void>;
  rejectH1: (signer: string, signature: string, kind: "drawn" | "typed") => void;
  requestChangesH1: (signer: string, signature: string, kind: "drawn" | "typed") => void;

  approveH2: (signer: string, signature: string, kind: "drawn" | "typed") => Promise<void>;
  requestChangesH2: (signer: string, signature: string, kind: "drawn" | "typed") => void;
  rejectH2: (signer: string, signature: string, kind: "drawn" | "typed") => void;

  approveH3: (signer: string, signature: string, kind: "drawn" | "typed") => Promise<void>;
  holdH3: (signer: string, signature: string, kind: "drawn" | "typed") => void;

  approveH4: (
    signer: string,
    signature: string,
    kind: "drawn" | "typed",
    actions: { proposal_id: string; action: "promote" | "reject" }[],
  ) => void;

  reset: () => void;
}

const HOME_TAB: PanelTab = { id: "home", label: "★ Home", kind: "home" };

const initialState = () => ({
  campaigns: JSON.parse(JSON.stringify(fixtureCampaigns)) as CampaignRun[],
  registry: JSON.parse(JSON.stringify(fixtureRegistry)) as RegistryArtifact[],
  proposals: JSON.parse(JSON.stringify(fixtureProposals)) as SkillProposal[],
  appliedImpactIds: [] as string[],
  contentBundles: {
    camp_04: JSON.parse(
      JSON.stringify(
        (fixtureCampaigns.find((c) => c.id === "camp_04")!.nodes.find((n) => n.id === "content") as { content_bundle: ContentBundle }).content_bundle,
      ),
    ) as ContentBundle,
  } as Record<string, ContentBundle>,
  contentHistory: {} as Record<string, ContentBundle[]>,
  reviewFlags: {} as Record<string, "ok" | "flag">,
  activeCampaignId: "camp_04",
  archetypeOverrides: {} as Record<string, string>,
  chat: [] as ChatMessage[],
  panelTabs: [HOME_TAB] as PanelTab[],
  activeTabId: "home",
  layout: "both" as const,
  centerView: "chat" as const,
  _seq: 0,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const GATE_LABEL: Record<GateId, string> = {
  H1: "H1 — Plan Approval",
  H2: "H2 — Content Review",
  H3: "H3 — Publish Gate",
  H4: "H4 — Insights & Skill Promotion",
};
const GATE_ACTION: Record<GateId, ChatMessage["action"]> = {
  H1: { label: "Review at H1 Gate →", kind: "open-h1" },
  H2: { label: "Review at H2 Gate →", kind: "open-h2" },
  H3: { label: "Review at H3 Gate →", kind: "open-h3" },
  H4: { label: "Review at H4 Gate →", kind: "open-h4" },
};

export const useLuban = create<LubanState>((set, get) => ({
  ...initialState(),

  getCampaign: (id) => get().campaigns.find((c) => c.id === id),
  getActive: () => get().campaigns.find((c) => c.id === get().activeCampaignId)!,
  getRegistry: () => get().registry,
  getContentBundle: (id) => get().contentBundles[id],

  updateContentVariant: (campaignId, variantId, patch) => {
    set((s) => {
      const bundle = s.contentBundles[campaignId];
      if (!bundle) return s;
      const nextVariants = bundle.source.variants.map((v) => {
        if (v.id !== variantId) return v;
        const merged = { ...v, ...patch };
        merged.characterCounts = {
          headline: merged.headline.length,
          body: merged.bodyCopy.length,
          cta: merged.cta.length,
        };
        return merged;
      });
      const nextBundle: ContentBundle = {
        ...bundle,
        source: { ...bundle.source, variants: nextVariants },
      };
      // Re-run brand-voice check against patched variant
      const HYPE = /\b(revolutionary|game-changer|cutting-edge|groundbreaking|disruptive|world-class|amazing|incredible)\b/i;
      const campaigns = s.campaigns.map((c) => {
        if (c.id !== campaignId) return c;
        return {
          ...c,
          nodes: c.nodes.map((n) => {
            if (n.id !== "qa" || !n.validations) return n;
            const validations = n.validations.map((val) => {
              if (val.rule.startsWith("Brand Voice") && val.variant_id === variantId) {
                const target = nextVariants.find((v) => v.id === variantId);
                if (!target) return val;
                const offender = HYPE.exec(`${target.headline} ${target.bodyCopy}`);
                if (offender) {
                  return { ...val, result: "fail" as const, excerpt: target.headline };
                }
                return { ...val, result: "pass" as const, excerpt: undefined, detail: "Hype-word check passes for this variant." };
              }
              return val;
            });
            return { ...n, validations };
          }),
          nodes_dirty: undefined,
        } as CampaignRun;
      });
      return {
        contentBundles: { ...s.contentBundles, [campaignId]: nextBundle },
        campaigns,
      };
    });
    toast.success("Variant saved");
  },

  flagVariant: (campaignId, variantId, flag) => {
    set((s) => ({
      reviewFlags: { ...s.reviewFlags, [`${campaignId}:${variantId}`]: flag },
    }));
  },

  requestTranslation: async (campaignId, locale) => {
    set((s) => {
      const bundle = s.contentBundles[campaignId];
      if (!bundle) return s;
      const localizations = bundle.localizations.map((l) =>
        l.locale === locale ? { ...l, translationStatus: "in_progress" as const } : l,
      );
      return { contentBundles: { ...s.contentBundles, [campaignId]: { ...bundle, localizations } } };
    });
    toast(`Translation requested · ${locale}`, { description: "Routing to the localization workflow…" });
    await sleep(1200);
    set((s) => {
      const bundle = s.contentBundles[campaignId];
      if (!bundle) return s;
      const localizations = bundle.localizations.map((l) => {
        if (l.locale !== locale) return l;
        const source = bundle.source.variants;
        const variants = source.map((v) => ({
          ...v,
          headline: `[${locale}] ${v.headline}`,
          bodyCopy: `[${locale}] ${v.bodyCopy}`,
        }));
        return {
          ...l,
          translationStatus: "complete" as const,
          variants,
          translatorNotes: `Auto-generated draft from ${l.translationStatus === "pending" ? "source" : "previous"} content.`,
        };
      });
      return { contentBundles: { ...s.contentBundles, [campaignId]: { ...bundle, localizations } } };
    });
    toast.success(`Translation complete · ${locale}`);
  },

  regenerateContent: async (campaignId) => {
    const current = get().contentBundles[campaignId];
    if (!current) return;
    set((s) => {
      const prev = s.contentHistory[campaignId] ?? [];
      const next = [JSON.parse(JSON.stringify(current)) as ContentBundle, ...prev].slice(0, 3);
      return { contentHistory: { ...s.contentHistory, [campaignId]: next } };
    });
    toast("Regenerating content variants…", { description: "Re-running Content agent with prior context." });
    await sleep(1500);
    set((s) => {
      const bundle = s.contentBundles[campaignId];
      if (!bundle) return s;
      const variants =
        campaignId === "camp_04"
          ? JSON.parse(JSON.stringify(ALT_SOURCE_VARIANTS)) as AdVariant[]
          : bundle.source.variants;
      return {
        contentBundles: {
          ...s.contentBundles,
          [campaignId]: { ...bundle, source: { ...bundle.source, variants } },
        },
      };
    });
    toast.success("Content regenerated · undo available");
  },

  undoRegenerate: (campaignId) => {
    set((s) => {
      const hist = s.contentHistory[campaignId];
      if (!hist || hist.length === 0) return s;
      const [restore, ...rest] = hist;
      return {
        contentBundles: { ...s.contentBundles, [campaignId]: restore },
        contentHistory: { ...s.contentHistory, [campaignId]: rest },
      };
    });
    toast.success("Regeneration undone");
  },

  runAutoFix: async (campaignId, variantId) => {
    toast("Re-running Content agent on the flagged variant…");
    await sleep(1200);
    const bundle = get().contentBundles[campaignId];
    const variant = bundle?.source.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const cleanedHeadline = variant.headline
      .replace(/\bRevolutionary\b/gi, "Built")
      .replace(/\bgame[- ]changer\b/gi, "upgrade")
      .replace(/\bcutting-edge\b/gi, "engineered")
      .replace(/\bgroundbreaking\b/gi, "purpose-built");
    get().updateContentVariant(campaignId, variantId, { headline: cleanedHeadline });
    toast.success(`Auto-fix applied to ${variantId}`);
  },


  addUserMessage: (text) => {
    set((s) => ({
      _seq: s._seq + 1,
      chat: [...s.chat, { id: `m${s._seq + 1}`, role: "user", text, ts: Date.now() }],
    }));
  },

  addAgentMessage: (msg) => {
    const s = get();
    const id = `m${s._seq + 1}`;
    set({
      _seq: s._seq + 1,
      chat: [...s.chat, { id, role: "agent", ts: Date.now(), ...msg } as ChatMessage],
    });
    return id;
  },

  updateAgentMessage: (id, patch) => {
    set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  },

  setNodeStatus: (campaignId, nodeId, status) => {
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id !== campaignId ? c : { ...c, nodes: c.nodes.map((n) => (n.id === nodeId ? { ...n, status } : n)) },
      ),
    }));
  },

  signGate: (campaignId, nodeId, verdict, reviewer, note, signature, signatureKind, proposalActions) => {
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id !== campaignId
          ? c
          : {
              ...c,
              nodes: c.nodes.map((n) =>
                n.id !== nodeId
                  ? n
                  : {
                      ...n,
                      status: verdict === "approved" ? "done" : "blocked",
                      decision: {
                        gate: n.gate!,
                        verdict,
                        reviewer,
                        note,
                        decided_at: new Date().toISOString(),
                        signature: signature ?? null,
                        signature_kind: signatureKind,
                        proposal_actions: proposalActions,
                      },
                    },
              ),
            },
      ),
    }));
  },

  addCost: (campaignId, delta) => {
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id !== campaignId ? c : { ...c, total_cost_usd: +(c.total_cost_usd + delta).toFixed(2) },
      ),
    }));
  },

  setCampaignStatus: (campaignId, status) => {
    set((s) => ({ campaigns: s.campaigns.map((c) => (c.id !== campaignId ? c : { ...c, status })) }));
  },

  setConnectorCallStatus: (campaignId, nodeId, idx, status) => {
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id !== campaignId
          ? c
          : {
              ...c,
              nodes: c.nodes.map((n) => {
                if (n.id !== nodeId || !n.connector_calls) return n;
                const calls = n.connector_calls.map((cc, i) =>
                  i === idx ? { ...cc, status, timestamp: new Date().toISOString() } : cc,
                );
                return { ...n, connector_calls: calls };
              }),
            },
      ),
    }));
  },

  promoteProposal: (proposalId) => {
    const p = get().proposals.find((x) => x.id === proposalId);
    if (!p || p.status !== "Proposed") return;
    const newArtifact: RegistryArtifact = {
      id: `${p.id}_v1`,
      name: p.name,
      type: p.type,
      version: 1,
      scope: p.scope,
      status: "Approved",
      provenance: "ai_proposed",
      promoted_from: "camp_04",
      body: p.body,
    };
    set((s) => ({
      registry: [...s.registry, newArtifact],
      proposals: s.proposals.map((x) => (x.id === proposalId ? { ...x, status: "Promoted" } : x)),
      appliedImpactIds: [...s.appliedImpactIds, proposalId],
    }));
  },

  rejectProposal: (proposalId) => {
    set((s) => ({
      proposals: s.proposals.map((x) => (x.id === proposalId ? { ...x, status: "Rejected" } : x)),
    }));
  },

  openTab: (tab) => {
    set((s) => {
      const exists = s.panelTabs.some((t) => t.id === tab.id);
      return {
        panelTabs: exists ? s.panelTabs : [...s.panelTabs, tab],
        activeTabId: tab.id,
        layout: s.layout === "chat" ? "both" : s.layout,
      };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  closeTab: (id) =>
    set((s) => {
      if (id === "home") return s;
      const tabs = s.panelTabs.filter((t) => t.id !== id);
      const activeTabId = s.activeTabId === id ? "home" : s.activeTabId;
      return { panelTabs: tabs, activeTabId };
    }),

  setLayout: (l) => set({ layout: l }),
  setCenterView: (v) => set({ centerView: v }),

  runOpeningSequence: async () => {
    const { addAgentMessage, setNodeStatus, addCost } = get();
    const cid = "camp_04";

    await sleep(500);
    addAgentMessage({
      text: `Here's my plan:

1. Draft a structured brief from the paid-media-launch-v1 template
2. Pause for your H1 sign-off
3. Generate a 5-channel strategy plan (reusing your approved skills)
4. Create content variants per channel
5. Run QA — pause for H2 sign-off before roll-out
6. Stage roll-out across connectors — pause for H3 sign-off to publish
7. Run Insights — pause for H4 sign-off to promote new skills`,
    });

    await sleep(400);
    setNodeStatus(cid, "brief", "running");
    const briefMsg = addAgentMessage({
      text: "",
      progress: [{ nodeId: "brief", label: "Drafting brief…", state: "running" }],
    });
    await sleep(900);
    setNodeStatus(cid, "brief", "done");
    addCost(cid, 2.4);
    get().updateAgentMessage(briefMsg, {
      progress: [{ nodeId: "brief", label: "Brief ready · 1 standard applied · 4 hrs saved vs. manual", state: "done", viewLabel: "View Brief" }],
    });

    await sleep(300);
    setNodeStatus(cid, "h1", "blocked");
    addAgentMessage({ text: AT_H1, action: GATE_ACTION.H1 });
  },

  runBriefFlow: async (brief) => {
    const cid = get().activeCampaignId;
    get().addUserMessage(brief);
    const forced = get().archetypeOverrides[cid];

    try {
      const pick: ArchetypeSelectOutput = forced
        ? {
            archetype_id: forced,
            archetype_version: getArchetype(forced)!.version,
            selection_rationale: {
              decided: `Operator-forced: ${forced}`,
              why: ["manual override"],
              alternatives: [],
              confidence: 1,
              knowledge_cited: [],
            },
          }
        : await selectArchetype(brief);

      const archetypeRecord = getArchetype(pick.archetype_id, pick.archetype_version);
      const archetypeLabel = archetypeRecord?.label ?? pick.archetype_id;
      // UI (Task 11) renders the ArchetypeSelectCard + override dropdown from archetype_pick.
      get().addAgentMessage({
        text: `Using **${archetypeLabel} v${pick.archetype_version}**. ${pick.selection_rationale.decided}`,
        archetype_pick: pick,
      });

      const archetype = archetypeRecord!;
      const { plan, cost_usd, repairAttempts } = await adaptPlanWithRepair(
        brief,
        { id: pick.archetype_id, version: pick.archetype_version },
        archetype,
      );
      // Mark planning-phase nodes as done (LLM just completed them)
      const nodes = mapPlanToRunNodes(plan).map((n) =>
        n.id === "brief" || n.id === "strategy" ? { ...n, status: "done" as const } : n,
      );

      set((s) => ({
        campaigns: s.campaigns.map((c) =>
          c.id !== cid
            ? c
            : {
                ...c,
                nodes,
                archetype: { id: plan.archetype_id, version: plan.archetype_version },
                adaptation_params: plan.adaptation_params,
                template_id: plan.archetype_id, // deprecated alias kept in sync
                template_label: archetype.label,
              },
        ),
      }));
      if (cost_usd) get().addCost(cid, cost_usd);
      get().setNodeStatus(cid, "h1", "blocked");
      get().addAgentMessage({
        text: repairAttempts
          ? `Plan adapted (${repairAttempts} self-repair). Review at H1.`
          : "Plan adapted. Review at H1.",
        action: { label: "Review at H1 Gate →", kind: "open-h1" },
      });
    } catch {
      get().addAgentMessage({
        text: "I couldn't produce a valid plan. Falling back to the demo campaign.",
      });
      // FIXTURE_PLAN.nodes is already RunNode[]; deep-clone so the fixture stays immutable.
      const fallbackNodes = JSON.parse(JSON.stringify(FIXTURE_PLAN.nodes)) as typeof FIXTURE_PLAN.nodes;
      set((s) => ({
        campaigns: s.campaigns.map((c) =>
          c.id !== cid ? c : { ...c, nodes: fallbackNodes, archetype: FIXTURE_PLAN.archetype },
        ),
      }));
      get().setNodeStatus(cid, "h1", "blocked");
    }
  },

  // ── DAG execution engine ──
  // After a gate is approved, walk the plan's nodes in dependency order,
  // executing agent/tool nodes and pausing at gate nodes.

  /** Build a one-line summary of completed nodes for the plan context. */
  _planContext: (cid: string) => {
    const campaign = get().getCampaign(cid);
    if (!campaign) return "";
    return campaign.nodes
      .filter((n) => n.status === "done")
      .map((n) => `${n.id} (${n.status})${(n as any)._outputSummary ? ": " + (n as any)._outputSummary : ""}`)
      .join("; ");
  },

  /** Get the brief text from the campaign's chat history. */
  _getBrief: (cid: string): string => {
    const msgs = get().chat;
    const userMsg = [...msgs].reverse().find((m) => m.role === "user");
    return userMsg?.text ?? "";
  },

  /** Execute the next ready nodes in the DAG. Stops when it hits a gate. */
  executeNextNodes: async (cid: string) => {
    const { setNodeStatus, addCost, addAgentMessage, updateAgentMessage, _planContext, _getBrief } = get();
    const campaign = get().getCampaign(cid);
    if (!campaign) return;

    // Find nodes whose dependencies are all satisfied and status is "waiting"
    const nextNode = campaign.nodes.find((n) => {
      if (n.status !== "waiting") return false;
      return n.depends_on.every((depId) => {
        const dep = campaign.nodes.find((d) => d.id === depId);
        return dep && (dep.status === "done");
      });
    });

    if (!nextNode) return;

    // Gate node: pause for human review
    if (nextNode.kind === "gate") {
      setNodeStatus(cid, nextNode.id, "blocked");
      const gateLabel = nextNode.gate ?? nextNode.id;
      const gateMessages: Record<string, { text: string; action: { label: string; kind: "open-h1" | "open-h2" | "open-h3" | "open-h4" } }> = {
        H1: { text: "Plan ready for your review.", action: { label: "Review at H1 Gate →", kind: "open-h1" } },
        H2: { text: "Content and QA complete. Review before rollout.", action: { label: "Review at H2 Gate →", kind: "open-h2" } },
        H3: { text: "Rollout staged. Review and publish.", action: { label: "Review at H3 Gate →", kind: "open-h3" } },
        H4: { text: "Campaign complete. Review insights and promote skills.", action: { label: "Review at H4 Gate →", kind: "open-h4" } },
      };
      const gm = gateMessages[gateLabel.toUpperCase()];
      if (gm) addAgentMessage(gm);
      return;
    }

    // Agent node: call live LLM
    if (nextNode.kind === "agent") {
      setNodeStatus(cid, nextNode.id, "running");
      const pid = addAgentMessage({
        text: "",
        progress: [{ nodeId: nextNode.id, label: `${nextNode.label}…`, state: "running" }],
      });

      try {
        const brief = _getBrief(cid);
        const planCtx = _planContext(cid);
        const result = await executeAgentNode(
          buildExecuteInput(brief, nextNode.id, nextNode.label, nextNode.task_id, planCtx),
        );

        setNodeStatus(cid, nextNode.id, "done");
        if (result.cost_usd) addCost(cid, result.cost_usd);
        // Store output summary on the node for downstream context
        const outputStr = typeof result.output === "string" ? result.output : JSON.stringify(result.output);
        const summary = outputStr.slice(0, 120).replace(/\n/g, " ");
        const outKey = "_outputSummary";
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id !== cid
              ? c
              : {
                  ...c,
                  nodes: c.nodes.map((n) =>
                    n.id === nextNode.id
                      ? { ...n, output: { agent: nextNode.label, generated: result.output, model: "claude-opus-4-8" as string } as any, [outKey]: summary }
                      : n,
                  ),
                },
          ),
        }));
        updateAgentMessage(pid, {
          progress: [{ nodeId: nextNode.id, label: `${nextNode.label} · done`, state: "done", viewLabel: "View Output" }],
        });
      } catch {
        setNodeStatus(cid, nextNode.id, "done");
        updateAgentMessage(pid, {
          progress: [{ nodeId: nextNode.id, label: `${nextNode.label} · fell back (no gateway)`, state: "done" }],
        });
      }

      // Continue to next node
      await sleep(200);
      await get().executeNextNodes(cid);
      return;
    }

    // Tool node: execute the connector (stubbed for now)
    if (nextNode.kind === "tool") {
      setNodeStatus(cid, nextNode.id, "running");
      const pid = addAgentMessage({
        text: "",
        progress: [{ nodeId: nextNode.id, label: `${nextNode.label}…`, state: "running" }],
      });

      // Simulate connector calls if defined
      const calls = nextNode.connector_calls ?? [];
      for (let i = 0; i < calls.length; i++) {
        await sleep(200);
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id !== cid
              ? c
              : {
                  ...c,
                  nodes: c.nodes.map((n) => {
                    if (n.id !== nextNode.id || !n.connector_calls) return n;
                    const updated = [...n.connector_calls];
                    updated[i] = { ...updated[i], status: "ok" as const };
                    return { ...n, connector_calls: updated };
                  }),
                },
          ),
        }));
      }

      setNodeStatus(cid, nextNode.id, "done");
      addCost(cid, calls.length * 0.5);
      updateAgentMessage(pid, {
        progress: [{ nodeId: nextNode.id, label: `${nextNode.label} · ${calls.length} connectors`, state: "done" }],
      });

      await sleep(200);
      await get().executeNextNodes(cid);
      return;
    }
  },

  // ── Gate functions (use actual campaign ID, delegate to DAG executor) ──

  approveH1: async (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage } = get();
    signGate(cid, "h1", "approved", signer, "Plan approved. Executing campaign.", signature, kind);
    addAgentMessage({ text: `Plan approved by ${signer}. Executing the campaign plan…` });
    await sleep(300);
    await get().executeNextNodes(cid);
  },

  requestChangesH1: (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage } = get();
    signGate(cid, "h1", "changes_requested", signer, "Please revise plan.", signature, kind);
    addAgentMessage({ text: POST_CHANGES });
  },
  rejectH1: (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage, setCampaignStatus } = get();
    signGate(cid, "h1", "rejected", signer, "Plan rejected.", signature, kind);
    setCampaignStatus(cid, "Awaiting Review");
    addAgentMessage({ text: POST_REJECT });
  },

  approveH2: async (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage, reviewFlags } = get();
    const flagged = Object.entries(reviewFlags)
      .filter(([k, v]) => k.startsWith(`${cid}:`) && v === "flag")
      .map(([k]) => k.split(":")[1]);
    const note = flagged.length
      ? `Approved with flags: ${flagged.join(", ")}.`
      : "Approved for rollout.";
    signGate(cid, "h2", "approved", signer, note, signature, kind);
    addAgentMessage({ text: `Content approved by ${signer}. Proceeding to rollout…` });
    await sleep(300);
    await get().executeNextNodes(cid);
  },

  requestChangesH2: (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, setNodeStatus, addAgentMessage } = get();
    signGate(cid, "h2", "changes_requested", signer, "Please revise content.", signature, kind);
    setNodeStatus(cid, "content", "blocked");
    addAgentMessage({ text: POST_CHANGES });
  },
  rejectH2: (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage, setCampaignStatus } = get();
    signGate(cid, "h2", "rejected", signer, "Campaign paused.", signature, kind);
    setCampaignStatus(cid, "Awaiting Review");
    addAgentMessage({ text: POST_REJECT });
  },

  approveH3: async (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage } = get();
    signGate(cid, "h3", "approved", signer, "Published.", signature, kind);
    addAgentMessage({ text: `Published by ${signer}. Campaign is live.` });
    await sleep(300);
    await get().executeNextNodes(cid);
  },
  holdH3: (signer, signature, kind) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage, setCampaignStatus } = get();
    signGate(cid, "h3", "rejected", signer, "Held — do not publish.", signature, kind);
    setCampaignStatus(cid, "Awaiting Review");
    addAgentMessage({ text: "Held at H3. Rollout staged but not published." });
  },

  approveH4: (signer, signature, kind, actions) => {
    const cid = get().activeCampaignId;
    const { signGate, addAgentMessage, setCampaignStatus, promoteProposal, rejectProposal } = get();
    actions.forEach((a) => {
      if (a.action === "promote") promoteProposal(a.proposal_id);
      else rejectProposal(a.proposal_id);
    });
    const promotedCount = actions.filter((a) => a.action === "promote").length;
    signGate(
      cid,
      "h4",
      "approved",
      signer,
      `${promotedCount} skill(s) promoted, ${actions.length - promotedCount} rejected.`,
      signature,
      kind,
      actions,
    );
    setCampaignStatus(cid, "Published");
    addAgentMessage({ text: POST_H4_APPROVE });
  },

  reset: () => set(initialState()),
}));

export { GATE_LABEL };
