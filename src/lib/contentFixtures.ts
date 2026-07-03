import type { AdVariant, ContentBundle, LocalizedContent } from "@/types";

const cc = (h: string, b: string, c: string) => ({
  headline: h.length,
  body: b.length,
  cta: c.length,
});

const utm = (source: string, medium: string, variantId: string) => ({
  utm_source: source,
  utm_medium: medium,
  utm_campaign: "q4_powertool_eu",
  utm_content: variantId,
});

// ---------- Source variants (EN, brand-voice tone) ----------

const SOURCE_VARIANTS: AdVariant[] = [
  {
    id: "v_li_contractor",
    channel: "linkedin",
    segment: "Professional Contractor",
    headline: "Drive 2x faster. The SIW 6AT, engineered for the jobsite.",
    bodyCopy:
      "When every minute on the jobsite counts, you need an impact wrench that doesn't slow you down. The SIW 6AT delivers twice the driving speed of its predecessor — with the durability Hilti is known for. Tested in real conditions. Built to last.",
    cta: "See the specs →",
    utmParams: utm("linkedin", "paid_social", "v_li_contractor"),
    imagePlaceholder: "siw6at-jobsite-hero.jpg",
    characterCounts: cc(
      "Drive 2x faster. The SIW 6AT, engineered for the jobsite.",
      "When every minute on the jobsite counts, you need an impact wrench that doesn't slow you down. The SIW 6AT delivers twice the driving speed of its predecessor — with the durability Hilti is known for. Tested in real conditions. Built to last.",
      "See the specs →",
    ),
  },
  {
    id: "v_li_specifier",
    channel: "linkedin",
    segment: "Specifier / Engineer",
    headline: "Spec it once. The SIW 6AT meets EN 17075 out of the box.",
    bodyCopy:
      "Stop chasing certification PDFs. The SIW 6AT ships pre-certified for EN 17075 fastening, with traceable torque data per fastener. Document compliance without the paperwork.",
    cta: "Download spec sheet",
    utmParams: utm("linkedin", "paid_social", "v_li_specifier"),
    imagePlaceholder: "siw6at-spec-callout.jpg",
    characterCounts: cc(
      "Spec it once. The SIW 6AT meets EN 17075 out of the box.",
      "Stop chasing certification PDFs. The SIW 6AT ships pre-certified for EN 17075 fastening, with traceable torque data per fastener. Document compliance without the paperwork.",
      "Download spec sheet",
    ),
  },
  {
    id: "v_li_rental",
    channel: "linkedin",
    segment: "Tool Fleet / Rental",
    headline: "Your fleet, uptime guaranteed. The SIW 6AT on Hilti Fleet.",
    bodyCopy:
      "Add the SIW 6AT to your Hilti Fleet plan and replace downtime with predictable cost. Repairs, replacements, theft cover, and asset tracking included. Your crews keep working — your finance team gets one line on the invoice. Stop reacting to broken tools and start scheduling the next job. Built for the contractors who keep Europe building, the SIW 6AT joins a managed fleet that adapts to your jobsite, your projects, and your budget every single month.",
    cta: "See Fleet plans",
    utmParams: utm("linkedin", "paid_social", "v_li_rental"),
    imagePlaceholder: "fleet-vans-contractors.jpg",
    characterCounts: cc(
      "Your fleet, uptime guaranteed. The SIW 6AT on Hilti Fleet.",
      "Add the SIW 6AT to your Hilti Fleet plan and replace downtime with predictable cost. Repairs, replacements, theft cover, and asset tracking included. Your crews keep working — your finance team gets one line on the invoice. Stop reacting to broken tools and start scheduling the next job. Built for the contractors who keep Europe building, the SIW 6AT joins a managed fleet that adapts to your jobsite, your projects, and your budget every single month.",
      "See Fleet plans",
    ),
  },
  {
    id: "v_g_contractor",
    channel: "google",
    segment: "Professional Contractor",
    headline: "SIW 6AT Impact Wrench — Hilti",
    bodyCopy:
      "Drive twice as fast on the jobsite. 6Ah battery, brushless motor, full Hilti service. Free shipping across the EU.",
    cta: "Shop now",
    utmParams: utm("google", "cpc", "v_g_contractor"),
    characterCounts: cc(
      "SIW 6AT Impact Wrench — Hilti",
      "Drive twice as fast on the jobsite. 6Ah battery, brushless motor, full Hilti service. Free shipping across the EU.",
      "Shop now",
    ),
  },
  {
    id: "v_g_specifier",
    channel: "google",
    segment: "Specifier / Engineer",
    // Deliberate brand-voice violation: "revolutionary"
    headline: "Revolutionary new impact wrench — SIW 6AT by Hilti",
    bodyCopy:
      "EN 17075 pre-certified. Traceable torque per fastener. Specify once, document compliance instantly.",
    cta: "Get spec sheet",
    utmParams: utm("google", "cpc", "v_g_specifier"),
    characterCounts: cc(
      "Revolutionary new impact wrench — SIW 6AT by Hilti",
      "EN 17075 pre-certified. Traceable torque per fastener. Specify once, document compliance instantly.",
      "Get spec sheet",
    ),
  },
  {
    id: "v_email_contractor",
    channel: "email",
    segment: "Professional Contractor",
    headline: "Subject: Two minutes saved per fastener — across every shift",
    bodyCopy:
      "Preheader: The SIW 6AT is in stock across the EU.\n\nHi {{first_name}},\n\nIf your crew drives a hundred fasteners a day, the SIW 6AT gives you back roughly three hours a week. Same Hilti torque control. Twice the speed. Free trial on your next jobsite — we'll bring it to you.\n\n— Your Hilti account team",
    cta: "Book a jobsite trial",
    utmParams: utm("email", "email", "v_email_contractor"),
    characterCounts: cc(
      "Subject: Two minutes saved per fastener — across every shift",
      "Preheader: The SIW 6AT is in stock across the EU.\n\nHi {{first_name}},\n\nIf your crew drives a hundred fasteners a day, the SIW 6AT gives you back roughly three hours a week. Same Hilti torque control. Twice the speed. Free trial on your next jobsite — we'll bring it to you.\n\n— Your Hilti account team",
      "Book a jobsite trial",
    ),
  },
  {
    id: "v_hol_landing",
    channel: "hol",
    segment: "All segments",
    headline: "The SIW 6AT. Built to make every minute on the jobsite count.",
    bodyCopy:
      "Hero — Drive 2x faster than the predecessor.\nProof — EN 17075 certified · 6Ah platform battery · Active Torque Control.\nFleet — Available on Hilti Fleet across the EU.\nCTA — Book a jobsite trial with your local Hilti rep.",
    cta: "Book a trial",
    utmParams: utm("hol", "owned", "v_hol_landing"),
    imagePlaceholder: "siw6at-landing-hero.jpg",
    characterCounts: cc(
      "The SIW 6AT. Built to make every minute on the jobsite count.",
      "Hero — Drive 2x faster than the predecessor.\nProof — EN 17075 certified · 6Ah platform battery · Active Torque Control.\nFleet — Available on Hilti Fleet across the EU.\nCTA — Book a jobsite trial with your local Hilti rep.",
      "Book a trial",
    ),
  },
];

// ---------- Alternate variants for "Regenerate" ----------

export const ALT_SOURCE_VARIANTS: AdVariant[] = SOURCE_VARIANTS.map((v) => {
  if (v.id === "v_li_contractor") {
    const h = "Twice the speed. Same Hilti torque control. The SIW 6AT.";
    const b =
      "Your crew loses minutes to slow wrenches every single day. The SIW 6AT halves that. Brushless motor, 6Ah battery, Active Torque Control on every fastener. Try it on your next jobsite.";
    const c = "Request a trial";
    return { ...v, headline: h, bodyCopy: b, cta: c, characterCounts: cc(h, b, c) };
  }
  if (v.id === "v_g_specifier") {
    const h = "SIW 6AT — Pre-certified to EN 17075";
    const b =
      "Document fastening compliance per torque, per fastener. Cuts your spec-and-sign workflow in half.";
    const c = "Get spec sheet";
    return { ...v, headline: h, bodyCopy: b, cta: c, characterCounts: cc(h, b, c) };
  }
  return v;
});

// ---------- Localizations ----------

const localize = (
  v: AdVariant,
  patch: { headline: string; bodyCopy: string; cta: string },
): AdVariant => ({
  ...v,
  headline: patch.headline,
  bodyCopy: patch.bodyCopy,
  cta: patch.cta,
  characterCounts: cc(patch.headline, patch.bodyCopy, patch.cta),
});

const DE_DE: LocalizedContent = {
  locale: "de-DE",
  label: "German (DE)",
  translationStatus: "complete",
  variants: SOURCE_VARIANTS.map((v) => {
    switch (v.id) {
      case "v_li_contractor":
        return localize(v, {
          headline: "Doppelt so schnell schrauben. Der SIW 6AT — für die Baustelle gemacht.",
          bodyCopy:
            "Wenn auf der Baustelle jede Minute zählt, brauchen Sie einen Schlagschrauber, der mithält. Der SIW 6AT liefert die doppelte Schraubgeschwindigkeit seines Vorgängers — mit der Langlebigkeit, für die Hilti steht. Im realen Einsatz getestet. Für den Dauerbetrieb gebaut.",
          cta: "Technische Daten ansehen →",
        });
      case "v_g_contractor":
        return localize(v, {
          headline: "SIW 6AT Schlagschrauber — Hilti",
          bodyCopy:
            "Doppelt so schnell schrauben. 6 Ah Akku, bürstenloser Motor, voller Hilti-Service. Versandkostenfrei in der gesamten EU. Preise inkl. 19 % MwSt.",
          cta: "Jetzt kaufen",
        });
      default:
        return localize(v, { headline: v.headline, bodyCopy: v.bodyCopy, cta: v.cta });
    }
  }),
};

const DE_AT: LocalizedContent = {
  locale: "de-AT",
  label: "German (AT)",
  translationStatus: "needs_review",
  translatorNotes:
    "AT uses 'Baustelle' identically; verify VAT (20%) and AT-specific phone number on landing.",
  variants: SOURCE_VARIANTS.map((v) => {
    switch (v.id) {
      case "v_li_contractor":
        return localize(v, {
          headline: "Doppelt so schnell schrauben. Der SIW 6AT — für die Baustelle gemacht.",
          bodyCopy:
            "Auf der Baustelle zählt jede Minute. Der SIW 6AT liefert die doppelte Schraubgeschwindigkeit seines Vorgängers — mit der Hilti-Langlebigkeit. Im echten Einsatz getestet.",
          cta: "Technische Daten ansehen →",
        });
      case "v_g_contractor":
        return localize(v, {
          headline: "SIW 6AT Schlagschrauber — Hilti Österreich",
          bodyCopy:
            "Doppelt so schnell schrauben. 6 Ah Akku, bürstenloser Motor, voller Hilti-Service. Preise inkl. 20 % USt.",
          cta: "Jetzt kaufen",
        });
      default:
        return localize(v, { headline: v.headline, bodyCopy: v.bodyCopy, cta: v.cta });
    }
  }),
};

const DE_CH: LocalizedContent = {
  locale: "de-CH",
  label: "German (CH)",
  translationStatus: "in_progress",
  translatorNotes: "CHF pricing pending finance approval. Only LinkedIn variants drafted.",
  variants: SOURCE_VARIANTS.filter((v) => v.channel === "linkedin").map((v) =>
    localize(v, {
      headline:
        v.id === "v_li_contractor"
          ? "Doppelt so schnell schrauben. Der SIW 6AT — für die Schweizer Baustelle."
          : v.headline,
      bodyCopy:
        v.id === "v_li_contractor"
          ? "Auf der Schweizer Baustelle zählt jede Minute. Der SIW 6AT liefert die doppelte Schraubgeschwindigkeit. Preise in CHF, inkl. MWST."
          : v.bodyCopy,
      cta: "Datenblatt ansehen",
    }),
  ),
};

const FR_FR: LocalizedContent = {
  locale: "fr-FR",
  label: "French (FR)",
  translationStatus: "pending",
  variants: [],
};

// ---------- Bundle ----------

export const CONTENT_BUNDLE_CAMP_04: ContentBundle = {
  source: {
    variants: SOURCE_VARIANTS,
    briefId: "task_brief_04",
    strategyRef: "task_strategy_04",
    totalVariants: SOURCE_VARIANTS.length,
    channels: Array.from(new Set(SOURCE_VARIANTS.map((v) => v.channel))),
  },
  localizations: [DE_DE, DE_AT, DE_CH, FR_FR],
};

export const SOURCE_VARIANTS_CAMP_04 = SOURCE_VARIANTS;
