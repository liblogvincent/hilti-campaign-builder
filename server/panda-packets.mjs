export function buildFallback(payload) {
  const phase = payload.phase || "planning";
  if (phase === "content") return contentPacket();
  if (phase === "rollout") return rolloutPacket(payload);
  if (phase === "optimize") return optimizePacket(payload);
  return planningPacket(payload);
}

export function buildIntegrationPackage(payload) {
  const utmSet = buildUtmSet(payload);
  const qaReport = buildQaReport(payload, utmSet);
  const paidMediaBuild = buildPaidMediaBuildManifest(payload, utmSet);
  const publishManifest = buildPublishManifest(payload, utmSet, qaReport);
  return {
    artifacts: [
      artifact(
        "R10 UTM Set",
        "r10-utm-create-qa",
        `${utmSet.items.length} governed UTMs generated for Meta, LinkedIn, and Google Ads.`,
        utmSet,
        meta("Google Ads / Meta / LinkedIn", "Web Analytics / Paid Media Team", "file", "publish-held", "H3", "UTM file and deterministic checks"),
      ),
      artifact(
        "R11 Structural QA",
        "r11-paid-media-qa",
        `${qaReport.summary.pass} pass, ${qaReport.summary.warn} warnings, ${qaReport.summary.fail} critical fails across the 54-point paid-media QA surface.`,
        qaReport,
        meta("Ad Platforms / Excel", "Paid Media Team", "file", "manual-review-required", "H3", "Paid-media QA matrix"),
      ),
      artifact(
        "Paid Media Build Manifest",
        "paid-media-build-manifest",
        "Campaign, ad group, ad, asset, URL, UTM, audience, keyword, and naming draft build is held for H3.",
        paidMediaBuild,
        meta("Google Ads / Meta / LinkedIn", "Paid Media Team", "file", "publish-held", "H3", "Platform build manifest"),
      ),
      artifact(
        "Held Publish Manifest",
        "publish-manifest",
        `Publish candidates are held for H3 across ${publishManifest.platforms.join(", ")}. No live spend has been triggered.`,
        publishManifest,
        meta("Astra Gates", "Campaign Operations Manager", "manual", "publish-held", "H3", "H3 publish/hold decision record"),
      ),
    ],
  };
}

export function buildCampaignPlan(payload) {
  const brief = String(payload.brief || "");
  const requestedChannels = inferRequestedChannels(brief);
  const channels = defaultPlanChannels().filter((channel) => requestedChannels.size === 0 || requestedChannels.has(channel.name));
  return {
    campaignId: payload.campaign_id || "camp_04",
    name: inferCampaignName(brief, payload.campaign_id || "camp_04"),
    heroProduct: inferHeroProduct(brief),
    markets: inferDelimitedList(brief, /markets?\s+([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)/i, ["DE", "AT", "CH"]),
    locales: inferDelimitedList(brief, /locales?\s+([a-z]{2}-[A-Z]{2}(?:\s*,\s*[a-z]{2}-[A-Z]{2})*)/i, ["de-DE", "de-AT", "de-CH", "fr-CH"]),
    audience: inferAudience(brief),
    budget: inferBudget(brief),
    timeline: "Launch window; no auto-publish before H3 approval.",
    channels,
    kpis: [
      "Qualified HOL visits",
      "Paid-media CTR and CPC within benchmark",
      "Email engagement by locale",
      "H3 publish readiness without auto-publish",
    ],
    assumptions: [
      "Product docs and brand playbook are active Panda skills.",
      "Figma, Contentful, Sprinklr, SFMC, and paid media connectors are mocked in prototype.",
      "Live publish remains human-gated at H3.",
    ],
  };
}

export function buildOrchestratorAnswer(payload) {
  const question = String(payload.question || "What should I do next?").trim();
  const scopeSurface = payload.agent_scope?.surface || payload.current_view;
  const contentObjects = Array.isArray(payload.content_objects) ? payload.content_objects : [];
  const planningObjects = Array.isArray(payload.planning_objects) ? payload.planning_objects : [];
  const rolloutObjects = Array.isArray(payload.rollout_objects) ? payload.rollout_objects : [];
  const blockedContent = contentObjects.filter((item) => item?.status === "blocked");
  const revisionContent = contentObjects.filter((item) => item?.status === "revision-requested");
  const approvedContent = contentObjects.filter((item) => item?.status === "approved");
  const blockedRollout = rolloutObjects.filter((item) => item?.status === "blocked");
  const gate = payload.current_gate || gateForPhase(payload.phase);
  const route = routeForQuestion(question, payload.phase, scopeSurface);
  if (scopeSurface === "campaign-planning" && !asksForRollout(question)) {
    const blockedPlanning = planningObjects.filter((item) => item?.status === "blocked");
    const revisionPlanning = planningObjects.filter((item) => item?.status === "revision-requested");
    const answer = revisionPlanning.length || blockedPlanning.length
      ? `H1 plan editing is active. ${revisionPlanning.length} planning object${revisionPlanning.length === 1 ? "" : "s"} need revision and ${blockedPlanning.length} planning object${blockedPlanning.length === 1 ? " is" : "s are"} blocked. Panda can update objective, audience, KPIs, budget, channels, assumptions, and missing inputs without approving the gate.`
      : "H1 plan editing is active. Panda can update the campaign planning draft without approving the gate.";
    return {
      answer,
      highlights: [
        `${planningObjects.length} H1 planning object${planningObjects.length === 1 ? "" : "s"}`,
        `${revisionPlanning.length} revision request${revisionPlanning.length === 1 ? "" : "s"}`,
        `${blockedPlanning.length} blocked H1 input${blockedPlanning.length === 1 ? "" : "s"}`,
      ],
      suggested_actions: ["Revise H1 plan object", "Review missing H1 inputs", "Prepare H1 packet when ready"],
      route: "Campaign Planning",
    };
  }
  const highlights = [
    `${approvedContent.length}/${contentObjects.length} content objects approved`,
    `${blockedContent.length} blocked content object${blockedContent.length === 1 ? "" : "s"}`,
    `${revisionContent.length} content revision request${revisionContent.length === 1 ? "" : "s"}`,
    `${blockedRollout.length} blocked rollout lane${blockedRollout.length === 1 ? "" : "s"}`,
  ];
  const missing = [
    ...blockedContent.map((item) => `${item.title || item.id} is blocked with ${item.owner || "owner"} (${item.channel || "content"}).`),
    ...revisionContent.map((item) => `${item.title || item.id} needs revision before ${gate}.`),
    ...blockedRollout.map((item) => `${item.title || item.lane || item.id} blocks rollout readiness.`),
  ];
  const answer = missing.length
    ? `${gate} is not ready yet: ${missing.join(" ")} Panda can route these to the responsible workspace and prepare a revised gate packet after the blockers are cleared.`
    : `${gate} is on track. Panda sees no blocked objects in the provided context; the next step is to run or review the current phase packet, then ask the human gate owner for approval.`;

  return {
    answer,
    highlights,
    suggested_actions: suggestedActionsForContext(gate, blockedContent.length, revisionContent.length, blockedRollout.length),
    route,
  };
}

export function buildUtmSet(payload) {
  const campaignId = safeToken(payload.campaign_id || "camp_04");
  const family = "q4_powertool_eu";
  const platforms = ["meta", "linkedin", "google"];
  const locales = ["de-de", "de-at", "de-ch", "fr-ch"];
  const segments = ["contractor", "specifier"];
  const items = [];
  for (const platform of platforms) {
    for (const locale of locales) {
      for (const segment of segments) {
        items.push({
          id: `utm_${platform}_${locale}_${segment}`,
          platform,
          locale,
          segment,
          url: `https://www.hilti.group/c/${campaignId}?utm_source=${platform}&utm_medium=paid&utm_campaign=${family}&utm_content=${segment}_${locale}`,
          qa: "pass",
        });
      }
    }
  }
  return {
    schema_version: "r10-utm-create-qa.v1",
    campaign_id: payload.campaign_id || "camp_04",
    family,
    items,
    deterministic_checks: [
      { check: "lowercase", result: "pass" },
      { check: "required_params", result: "pass" },
      { check: "campaign_family", result: "pass" },
      { check: "locale_segment_join", result: "pass" },
    ],
  };
}

export function buildQaReport(payload, utmSet) {
  const warnings = [
    {
      id: "qa_warn_budget_split",
      severity: "warn",
      check: "budget_reconciliation",
      detail: "Swiss budget is held as one CH bucket until final de-CH/fr-CH split is confirmed.",
    },
    {
      id: "qa_warn_publish_credentials",
      severity: "warn",
      check: "connector_credentials",
      detail: "Ad-platform writes are file-export candidates in Panda; live publish connector is not enabled.",
    },
  ];

  return {
    schema_version: "r11-paid-media-qa.v1",
    campaign_id: payload.campaign_id || "camp_04",
    qa_surface: "54-point paid-media structural QA",
    summary: { pass: 52, warn: warnings.length, fail: 0 },
    disposition: "pass_with_warnings",
    warnings,
    evidence_refs: utmSet.items.slice(0, 6).map((item) => item.id),
    h3_requirement: "Human approval required before live spend or platform write.",
  };
}

export function buildPublishManifest(payload, utmSet, qaReport) {
  return {
    schema_version: "publish-manifest.v1",
    campaign_id: payload.campaign_id || "camp_04",
    status: "held_for_h3",
    platforms: ["Meta Ads", "LinkedIn Ads", "Google Ads"],
    publish_authority: "H3",
    no_auto_publish: true,
    candidates: ["Meta Ads", "LinkedIn Ads", "Google Ads"].map((platform) => ({
      platform,
      status: "draft",
      upload_mode: "file_export",
      utm_count: utmSet.items.filter((item) => platform.toLowerCase().startsWith(item.platform)).length || 8,
      qa_disposition: qaReport.disposition,
    })),
  };
}

function planningPacket(payload) {
  const campaignPlan = buildCampaignPlan(payload);
  return phasePacket(
    "H1",
    `Planning package created for ${campaignPlan.heroProduct}: Panda structured the brief and exposed the campaign plan for H1 review.`,
    [
      { agent: "a0", status: "done", message: "Structured the raw brief, markets, budget, hero products, timeline, and missing assumptions." },
      { agent: "a1", status: "done", message: "Attached DACH benchmarks and paid-media advisory context." },
      { agent: "a2", status: "done", message: "Generated the paid-media plan and marked HOL/email/social strategy gaps." },
    ],
    [
      artifact(
        "Structured Brief",
        "a0-structured-brief",
        `${campaignPlan.name}: ${campaignPlan.budget}, ${campaignPlan.markets.join("/")}, ${campaignPlan.locales.join("/")}, ${campaignPlan.audience.join(", ")}.`,
        { campaign_id: payload.campaign_id || "camp_04", budget: campaignPlan.budget, markets: campaignPlan.markets, locales: campaignPlan.locales },
        meta("PowerPoint / SharePoint", "Campaign Planning Owner", "manual", "source-of-truth", "H1", "Structured brief snapshot"),
      ),
      artifact(
        "Paid Media Plan",
        "campaign-plan.v3",
        `${campaignPlan.channels.map((channel) => channel.name).join(", ")} plan for ${campaignPlan.heroProduct}; downstream workspaces consume this artifact.`,
        campaignPlan,
        meta("Excel / Power BI / Ad Platforms", "Paid Media Team", "mock", "source-of-truth", "H1", "H1 paid-media plan"),
      ),
      artifact(
        "H1 Gap Register",
        "rmb-coverage-gap-register",
        "HOL journey, email strategy, and organic/HN strategy are required before Panda can claim full H1 coverage.",
        { missing: ["HOL Customer Journey Mapping", "Email Strategy & TA Brief", "Organic Social & HN Strategy"] },
        meta("Panda Coverage Matrix", "Campaign Planning Owner", "mock", "manual-review-required", "H1", "Coverage gap evidence"),
      ),
    ],
    "Approve H1 only for the current paid-media spine, or request HOL/email/social strategy expansion.",
    ["Review H1 packet", "Approve limited paid-media spine", "Request missing planning artifacts"],
  );
}

function contentPacket() {
  return phasePacket(
    "H2",
    "Content Planning bridge package created for H2: CP1 Creative Concept, CP2 Cross-Channel Requirements, CP3 Storyboarding, and CP4 Figma Mapping evidence are ready for object-level approval.",
    [
      { agent: "cp1", status: "done", message: "Selected a torque-first creative concept with contractor proof points." },
      { agent: "cp2", status: "done", message: "Mapped Meta, LinkedIn, Google, email, HOL, social, and HN asset requirements." },
      { agent: "cp3", status: "done", message: "Drafted storyboards, shot list, script beats, and production planning for key placements." },
      { agent: "cp4", status: "done", message: "Prepared a Figma mapping manifest instead of claiming a live Figma write." },
      { agent: "c2", status: "done", message: "Attached compliance evidence to asset-level outputs." },
    ],
    [
      artifact(
        "Creative Concept",
        "cp1-creative-concept",
        "Torque-first, proof-led campaign: show fewer reworks, faster fastening, and Hilti cordless-platform reliability.",
        { concept: "Torque without rework", risk: "low" },
        meta("PowerPoint / Figma", "Creative Manager", "mock", "source-of-truth", "H2", "Creative concept deck manifest"),
      ),
      artifact(
        "Cross-Channel Requirements",
        "cp2-cross-channel-requirements",
        "Asset requirements cover paid media, HOL, email, social, and HN even where Panda only generates paid-media content today.",
        { channels: ["Meta", "LinkedIn", "Google", "HOL", "Email", "Organic/HN"] },
        meta("Excel", "Content Planning Lead", "mock", "source-of-truth", "H2", "Requirements sheet"),
      ),
      artifact(
        "Storyboard Package",
        "cp3-storyboard-package",
        "Storyboard frames and shot plan translate the creative concept into production-ready scenes before final copy and assets are built.",
        {
          frames: ["Opening proof point", "Problem demonstration", "Solution moment", "CTA / next step"],
          productionPlan: ["Confirm claim evidence", "Assign channel owners", "Prepare static mockups for R-1"],
        },
        meta("PowerPoint / Figma", "Creative Producer", "mock", "source-of-truth", "H2", "Storyboard and production plan"),
      ),
      artifact(
        "Figma Mapping",
        "cp4-figma-mapping",
        "Mock Figma board with paid, HOL, email, social, and HN placeholders. MCP write not yet executed.",
        { frames: ["Paid media", "HOL LP", "Email", "Organic/HN", "Localization"], action: "create-figma-mapping" },
        meta("Figma", "Designer / Content Operations", "mock", "source-of-truth", "H2", "Figma board manifest"),
      ),
      artifact(
        "Compliance Report",
        "c2-compliance",
        "Creative/compliance QA is fused into H2. No legal-sensitive claims found; superlatives removed.",
        { disposition: "pass", checks: 9 },
        meta("Brand / Legal Guidelines", "Content Owner / Brand", "manual", "manual-review-required", "H2", "Compliance report"),
      ),
    ],
    "Approve H2 to release creative into rollout/build. H3 still needs tool-lane manifests.",
    ["Generate rollout manifests", "Prepare localization evidence", "Run H3 Rollout"],
  );
}

function rolloutPacket(payload) {
  return phasePacket(
    "H3",
    "Rollout & Publish Readiness package created across Figma/localization, Sprinklr, Contentful, SFMC/email, paid platforms, UTM, QA, and held publish lanes.",
    [
      { agent: "r2", status: "done", message: "Prepared Sprinklr draft manifest for organic/HN outputs." },
      { agent: "r3", status: "done", message: "Prepared Contentful LP blueprint manifest." },
      { agent: "r6", status: "blocked", message: "SFMC full journey configuration is marked [VERIFY]; Panda shows an email build manifest boundary." },
      { agent: "r8", status: "done", message: "Prepared Figma/localization board manifest with market review status." },
      { agent: "r11", status: "done", message: "Prepared structural QA matrix evidence for H3." },
    ],
    [
      artifact(
        "Figma Localization Manifest",
        "figma-localization-manifest",
        "Static and video localization boards are represented with market comments and unresolved local-review flags.",
        { campaign_id: payload.campaign_id || "camp_04", markets: ["DE", "AT", "CH"], locales: ["de-DE", "de-AT", "de-CH", "fr-CH"], review_status: "manual_review_required" },
        meta("Figma / Transperfect", "Localization support / local reviewers", "manual", "manual-review-required", "H3", "Market board and comment manifest"),
      ),
      artifact(
        "Sprinklr Draft Manifest",
        "sprinklr-draft-manifest",
        "Organic/HN posts are draft candidates only; no publishing action is executed.",
        { posts: 8, status: "draft" },
        meta("Sprinklr", "Social media team member", "file", "draft-write", "H3", "Draft post manifest"),
      ),
      artifact(
        "Contentful LP Manifest",
        "contentful-lp-manifest",
        "English HOL landing page blueprint is represented as a held Contentful draft mapped to the Figma mockup.",
        { pages: 1, status: "held_for_h3" },
        meta("Contentful", "HOL team member / Contentful profile", "mock", "publish-held", "H3", "LP draft manifest"),
      ),
      artifact(
        "Contentful/Weblate Banner Manifest",
        "contentful-weblate-banner-manifest",
        "Localized banner builds are represented with Contentful regional-space and Weblate string status.",
        { banners: 6, unresolved_locales: ["fr-CH"] },
        meta("Contentful / Weblate", "HOL team member / Localization support", "mock", "manual-review-required", "H3", "Banner localization manifest"),
      ),
      artifact(
        "SFMC Email Manifest",
        "sfmc-email-manifest",
        "Email basefile, preview, translated email build, and link QA are represented; full journey configuration remains [VERIFY].",
        { basefile: "ready", preview: "draft", journey_configuration: "verify" },
        meta("SFMC / Marketing Cloud", "Email Technical Architect", "mock", "publish-held", "H3", "Email build boundary manifest"),
      ),
      ...buildIntegrationPackage(payload).artifacts,
    ],
    "Approve H3 only after reviewing rollout tool lanes. H3 remains the only live authorization.",
    ["Review rollout lanes", "Acknowledge [VERIFY] boundaries", "Export H3 publish manifest"],
  );
}

function optimizePacket(payload) {
  return phasePacket(
    "H4",
    "Performance Insights & Optimization package created: Panda recommends paid-media, HOL landing page, and HOL banner optimizations before knowledge promotion.",
    [
      { agent: "opt1", status: "done", message: "Compared paid-media performance snapshot to plan and benchmark KPIs." },
      { agent: "opt2", status: "done", message: "Prepared HOL landing-page optimization recommendations from GA4/heat-map style evidence." },
      { agent: "opt3", status: "done", message: "Prepared HOL banner placement recommendations." },
      { agent: "opt5", status: "queued", message: "Knowledge promotion is available after performance recommendations are reviewed." },
    ],
    [
      artifact(
        "Paid Media Optimization",
        "paid-media-optimization",
        "Shift 8% budget from high-CPM Meta prospecting to LinkedIn retargeting if CPL remains above benchmark after three days.",
        { campaign_id: payload.campaign_id || "camp_04", recommendation_count: 3, source: "sample-performance-snapshot" },
        meta("Power BI / Ad Platforms", "Paid Media Team / Data Analytics", "mock", "read-only-evidence", "H4", "Plan-vs-actual KPI comparison"),
      ),
      artifact(
        "HOL LP Optimization",
        "hol-lp-optimization",
        "Move product selector and primary CTA higher on the page if scroll-depth and CTA click data stay below benchmark.",
        { recommendation_count: 2, source: "GA4 / heat-map sample" },
        meta("Google Analytics / GA4", "HOL team member / Web Analytics", "mock", "read-only-evidence", "H4", "LP performance recommendation"),
      ),
      artifact(
        "HOL Banner Optimization",
        "hol-banner-optimization",
        "Prioritize banner placements with stronger assisted conversion and replace low-engagement placements after H4 review.",
        { recommendation_count: 2, source: "GA4 banner placement sample" },
        meta("Google Analytics / GA4", "HOL team member / Web Analytics", "mock", "read-only-evidence", "H4", "Banner performance recommendation"),
      ),
      artifact(
        "Knowledge Promotion Candidates",
        "knowledge-promotion-candidates",
        "Promote selected optimization patterns into campaign-scoped knowledge only after H4 approval.",
        { candidates: 3, promotion_gate: "H4" },
        meta("Astra KB", "Campaign Steward", "manual", "manual-review-required", "H4", "Knowledge promotion decision"),
      ),
    ],
    "Approve H4 to accept optimization recommendations and choose which knowledge updates become governed knowledge.",
    ["Approve optimization package", "Promote selected knowledge", "Close campaign run"],
  );
}

function buildPaidMediaBuildManifest(payload, utmSet) {
  return {
    schema_version: "paid-media-build-manifest.v1",
    campaign_id: payload.campaign_id || "camp_04",
    platforms: ["Meta Ads", "LinkedIn Ads", "Google Ads"],
    status: "draft_file_export",
    build_depth: "campaign_adgroup_ad_asset_url_utm_audience_keyword_naming",
    utm_refs: utmSet.items.slice(0, 6).map((item) => item.id),
    h3_requirement: "Human approval required before live spend or platform write.",
  };
}

function phasePacket(gate, summary, worklog, artifacts, recommendation, nextActions) {
  return {
    summary,
    worklog,
    artifacts,
    gate: { id: gate, recommendation, risk: gate === "H3" ? "medium" : "low" },
    next_actions: nextActions,
  };
}

function artifact(name, type, content, data, metaData) {
  return { name, type, content, data, ...metaData };
}

function meta(tool, owner, integrationMode, authority, gate, evidence) {
  return { tool, owner, integrationMode, authority, gate, evidence };
}

function defaultPlanChannels() {
  return [
    {
      id: "paid-media",
      name: "Paid Media",
      owner: "Paid Media",
      objective: "Drive demand and qualified HOL traffic.",
      requiredAssets: ["Search ad headline", "CTA", "Paid social primary text"],
      rolloutTarget: "Paid Media",
    },
    {
      id: "email",
      name: "Email",
      owner: "Email TA",
      objective: "Nurture known audiences.",
      requiredAssets: ["Hero section", "Subject line", "Preview text", "Locale variant"],
      rolloutTarget: "SFMC",
    },
    {
      id: "hol-landing-page",
      name: "HOL Landing Page",
      owner: "HOL",
      objective: "Convert traffic with product proof, offer, and next-step CTA.",
      requiredAssets: ["Opening section", "Value proposition", "CTA module"],
      rolloutTarget: "Contentful",
    },
    {
      id: "organic-hn",
      name: "Organic / HN",
      owner: "Content / Creative",
      objective: "Support launch visibility through owned social and HN placements.",
      requiredAssets: ["Social post", "HN short hook"],
      rolloutTarget: "Sprinklr",
    },
    {
      id: "banner",
      name: "Banner",
      owner: "HOL",
      objective: "Promote launch offer from relevant Hilti web placements.",
      requiredAssets: ["Hardcoded banner copy"],
      rolloutTarget: "Contentful",
    },
  ];
}

function inferRequestedChannels(brief) {
  const text = brief.toLowerCase();
  if (!/channels?\s+/i.test(brief)) return new Set();
  const channels = new Set();
  if (text.includes("linkedin") || text.includes("paid") || text.includes("meta") || text.includes("google")) channels.add("Paid Media");
  if (text.includes("email")) channels.add("Email");
  if (text.includes("hol") || text.includes("landing")) channels.add("HOL Landing Page");
  if (text.includes("organic") || text.includes("social") || text.includes("hn")) channels.add("Organic / HN");
  if (text.includes("banner")) channels.add("Banner");
  return channels;
}

function inferDelimitedList(brief, pattern, fallback) {
  const match = brief.match(pattern);
  if (!match?.[1]) return fallback;
  return match[1].split(",").map((item) => item.trim()).filter(Boolean);
}

function inferBudget(brief) {
  const match = brief.match(/\b(EUR|USD|CHF|GBP)\s*([0-9]+(?:k|K|,[0-9]{3})?)/);
  return match ? `${match[1].toUpperCase()} ${match[2].toLowerCase()}` : "EUR 50k";
}

function inferAudience(brief) {
  const match = brief.match(/(?:for|target)\s+([^.]+?)(?:\.| budget| markets| locales| channels| no auto-publish|$)/i);
  if (!match?.[1]) return ["Contractors", "Specifiers"];
  return [sentenceCase(match[1].replace(/\b(first|second|primary|secondary)\b/gi, "").trim())];
}

function inferHeroProduct(brief) {
  const lower = brief.toLowerCase();
  if (lower.includes("firestop")) return "firestop";
  if (lower.includes("measuring")) return "measuring tools";
  if (lower.includes("siw 6at-a22")) return "SIW 6AT-A22";
  const match = brief.match(/campaign for\s+(.+?)(?:\.| budget| markets| locales| target| for |$)/i);
  return match?.[1]?.trim() || "power tools";
}

function inferCampaignName(brief, fallbackId) {
  const heroProduct = inferHeroProduct(brief);
  const markets = inferDelimitedList(brief, /markets?\s+([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)/i, []);
  return `${markets.length ? markets.join("/") : fallbackId} ${titleCase(heroProduct)} campaign`;
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function sentenceCase(value) {
  const clean = value.trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function gateForPhase(phase) {
  if (phase === "content") return "H2";
  if (phase === "rollout") return "H3";
  if (phase === "optimize") return "H4";
  return "H1";
}

function routeForQuestion(question, phase, scopeSurface) {
  if (scopeSurface === "campaign-planning") return "Campaign Planning";
  if (scopeSurface === "content-planning") return "Content Planning";
  if (scopeSurface === "content") return "Content";
  if (scopeSurface === "rollout") return "Rollout";
  if (scopeSurface === "optimize") return "Optimize";
  const text = question.toLowerCase();
  if (text.includes("content") || text.includes("h2") || phase === "content") return "Content";
  if (text.includes("rollout") || text.includes("publish") || text.includes("h3") || phase === "rollout") return "Rollout";
  if (text.includes("optimize") || text.includes("performance") || text.includes("h4") || phase === "optimize") return "Optimize";
  if (text.includes("plan") || text.includes("h1")) return "Campaign Planning";
  return "Progress";
}

function asksForRollout(question) {
  const text = question.toLowerCase();
  return /\b(rollout|publish|h3|sprinklr|sfmc|contentful|utm)\b/.test(text);
}

function suggestedActionsForContext(gate, blockedContentCount, revisionContentCount, blockedRolloutCount) {
  const actions = [];
  if (blockedContentCount > 0) actions.push("Resolve blocked content objects");
  if (revisionContentCount > 0) actions.push("Ask Content Panda to revise requested pieces");
  if (blockedRolloutCount > 0) actions.push("Clear blocked rollout lanes");
  actions.push(`Prepare ${gate} gate packet`);
  actions.push("Run current phase with Panda");
  return actions.slice(0, 5);
}

function safeToken(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "campaign";
}
