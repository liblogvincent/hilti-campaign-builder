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
import { selectArchetype, adaptPlanWithRepair } from "../lib/agentClient";
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
  H1: "H1 — Brief Approval",
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
      const nodes = mapPlanToRunNodes(plan);

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

  approveH1: async (signer, signature, kind) => {
    const cid = "camp_04";
    const { signGate, setNodeStatus, addCost, addAgentMessage, updateAgentMessage } = get();
    signGate(cid, "h1", "approved", signer, "Brief approved for strategy.", signature, kind);
    addAgentMessage({ text: POST_H1_APPROVE });

    await sleep(400);
    const steps = [
      { nodeId: "strategy", running: "Generating strategy…", done: "Strategy ready · 4 standards applied · 28 hrs saved vs. manual", viewLabel: "View Plan", cost: 10.8 },
      { nodeId: "content", running: "Creating content…", done: "Content ready · 3 standards applied · 180 hrs saved vs. manual", viewLabel: "Preview", cost: 12.6 },
      { nodeId: "qa", running: "Running QA…", done: "QA passed · 4 checks automated · 40 hrs saved vs. manual", viewLabel: "View QA", cost: 0 },
    ];
    const pid = addAgentMessage({
      text: "",
      progress: steps.map((s) => ({ nodeId: s.nodeId, label: s.running, state: "pending" })),
    });
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      updateAgentMessage(pid, {
        progress: steps.map((s, idx) => ({
          nodeId: s.nodeId,
          label: idx < i ? s.done : s.running,
          state: idx < i ? "done" : idx === i ? "running" : "pending",
          viewLabel: idx < i ? s.viewLabel : undefined,
        })),
      });
      setNodeStatus(cid, step.nodeId, "running");
      await sleep(900);
      setNodeStatus(cid, step.nodeId, "done");
      if (step.cost) addCost(cid, step.cost);
      updateAgentMessage(pid, {
        progress: steps.map((s, idx) => ({
          nodeId: s.nodeId,
          label: idx <= i ? s.done : s.running,
          state: idx <= i ? "done" : "pending",
          viewLabel: idx <= i ? s.viewLabel : undefined,
        })),
      });
      await sleep(300);
    }
    setNodeStatus(cid, "h2", "blocked");
    await sleep(300);
    addAgentMessage({ text: AT_H2, action: GATE_ACTION.H2 });
  },

  requestChangesH1: (signer, signature, kind) => {
    const { signGate, addAgentMessage } = get();
    signGate("camp_04", "h1", "changes_requested", signer, "Please revise brief.", signature, kind);
    addAgentMessage({ text: POST_CHANGES });
  },
  rejectH1: (signer, signature, kind) => {
    const { signGate, addAgentMessage, setCampaignStatus } = get();
    signGate("camp_04", "h1", "rejected", signer, "Brief rejected.", signature, kind);
    setCampaignStatus("camp_04", "Awaiting Review");
    addAgentMessage({ text: POST_REJECT });
  },

  approveH2: async (signer, signature, kind) => {
    const cid = "camp_04";
    const { signGate, setNodeStatus, addCost, addAgentMessage, setConnectorCallStatus, reviewFlags } = get();
    const flagged = Object.entries(reviewFlags)
      .filter(([k, v]) => k.startsWith(`${cid}:`) && v === "flag")
      .map(([k]) => k.split(":")[1]);
    const note = flagged.length
      ? `Approved with flags: ${flagged.join(", ")}. Please address before next iteration.`
      : "Approved for roll-out. All variants cleared review.";
    signGate(cid, "h2", "approved", signer, note, signature, kind);
    await sleep(300);
    setNodeStatus(cid, "rollout", "running");
    const calls = get().getCampaign(cid)?.nodes.find((n) => n.id === "rollout")?.connector_calls ?? [];
    for (let i = 0; i < calls.length; i++) {
      await sleep(250);
      setConnectorCallStatus(cid, "rollout", i, "ok");
    }
    setNodeStatus(cid, "rollout", "done");
    addCost(cid, 4.5);
    await sleep(400);
    setNodeStatus(cid, "h3", "blocked");
    addAgentMessage({ text: AT_H3, action: GATE_ACTION.H3 });
  },

  requestChangesH2: (signer, signature, kind) => {
    const { signGate, setNodeStatus, addAgentMessage } = get();
    signGate("camp_04", "h2", "changes_requested", signer, "Please revise content.", signature, kind);
    setNodeStatus("camp_04", "content", "blocked");
    addAgentMessage({ text: POST_CHANGES });
  },
  rejectH2: (signer, signature, kind) => {
    const { signGate, addAgentMessage, setCampaignStatus } = get();
    signGate("camp_04", "h2", "rejected", signer, "Campaign paused.", signature, kind);
    setCampaignStatus("camp_04", "Awaiting Review");
    addAgentMessage({ text: POST_REJECT });
  },

  approveH3: async (signer, signature, kind) => {
    const cid = "camp_04";
    const { signGate, setNodeStatus, addCost, addAgentMessage } = get();
    signGate(cid, "h3", "approved", signer, "Published.", signature, kind);
    await sleep(400);
    setNodeStatus(cid, "learn", "running");
    await sleep(1100);
    setNodeStatus(cid, "learn", "done");
    addCost(cid, 4.7);
    await sleep(400);
    setNodeStatus(cid, "h4", "blocked");
    addAgentMessage({ text: POST_H3_APPROVE });
    await sleep(300);
    addAgentMessage({ text: AT_H4, action: GATE_ACTION.H4 });
  },
  holdH3: (signer, signature, kind) => {
    const { signGate, addAgentMessage, setCampaignStatus } = get();
    signGate("camp_04", "h3", "rejected", signer, "Held — do not publish.", signature, kind);
    setCampaignStatus("camp_04", "Awaiting Review");
    addAgentMessage({ text: "Held at H3. Roll-out staged but not published." });
  },

  approveH4: (signer, signature, kind, actions) => {
    const cid = "camp_04";
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
