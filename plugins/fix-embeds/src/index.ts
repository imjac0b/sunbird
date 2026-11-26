// @description Rewrites X/Twitter, Instagram, TikTok, and custom links for working embeds
// @version 1.3.0
// @author cmdr-chara

const settings = phoenix.settings.define({
  twitter: {
    type: "switch",
    title: "X / Twitter",
    description: "Rewrite x.com and twitter.com links",
    default: true,
  },
  twitterDomain: {
    type: "select",
    title: "X / Twitter mirror",
    description: "Preset replacement domain",
    options: [
      { value: "fixupx.com", label: "fixupx.com" },
      { value: "goyimx.com", label: "goyimx.com" },
      { value: "fxtwitter.com", label: "fxtwitter.com" },
      { value: "vxtwitter.com", label: "vxtwitter.com" },
      { value: "fix.vg", label: "fix.vg" },
      { value: "custom", label: "Custom (use textbox below)" },
    ],
    default: "fixupx.com",
  },
  customTwitterDomain: {
    type: "text",
    title: "Custom X / Twitter domain",
    description: "Overrides preset when non-empty (e.g. goyimx.com)",
    default: "",
  },
  instagram: {
    type: "switch",
    title: "Instagram",
    description: "Rewrite instagram.com links",
    default: true,
  },
  instagramDomain: {
    type: "select",
    title: "Instagram mirror",
    description: "Preset replacement domain",
    options: [
      { value: "kkinstagram.com", label: "kkinstagram.com" },
      { value: "kirkstagram.com", label: "kirkstagram.com" },
      { value: "eeinstagram.com", label: "eeinstagram.com" },
      { value: "vxinstagram.com", label: "vxinstagram.com" },
      { value: "instagramez.com", label: "instagramez.com" },
      { value: "fix.vg", label: "fix.vg" },
      { value: "custom", label: "Custom (use textbox below)" },
    ],
    default: "kkinstagram.com",
  },
  customInstagramDomain: {
    type: "text",
    title: "Custom Instagram domain",
    description: "Overrides preset when non-empty",
    default: "",
  },
  tiktok: {
    type: "switch",
    title: "TikTok",
    description: "Rewrite tiktok.com links",
    default: true,
  },
  tiktokDomain: {
    type: "select",
    title: "TikTok mirror",
    description: "Preset replacement domain",
    options: [
      { value: "tnktok.com", label: "tnktok.com" },
      { value: "vxtiktok.com", label: "vxtiktok.com" },
      { value: "tfxktok.com", label: "tfxktok.com" },
      { value: "fix.vg", label: "fix.vg" },
      { value: "custom", label: "Custom (use textbox below)" },
    ],
    default: "tnktok.com",
  },
  customTiktokDomain: {
    type: "text",
    title: "Custom TikTok domain",
    description: "Overrides preset when non-empty",
    default: "",
  },
  customRules: {
    type: "text",
    title: "Custom domain rewrites",
    description: "Comma-separated from=to pairs (e.g. reddit.com=rxddit.com, bsky.app=bskx.app)",
    default: "",
  },
});

const TWITTER_HOST = /^(www\.|mobile\.)?(twitter\.com|x\.com)$/i;
const INSTAGRAM_HOST = /^(www\.|m\.)?instagram\.com$/i;
const TIKTOK_HOST = /^(www\.|m\.|vm\.|vt\.)?tiktok\.com$/i;

const FIX_VG_HOST = /^([a-z0-9-]+\.)*fix\.vg$/i;

const cleanHost = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

const pickDomain = (custom: string, preset: string, fallback: string) => {
  const cleaned = cleanHost(custom);
  if (cleaned) return cleaned;
  return preset === "custom" ? fallback : preset;
};

const parseCustomRules = (): [string, string][] => {
  const raw = settings.customRules.trim();
  if (!raw) return [];
  const rules: [string, string][] = [];
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const from = cleanHost(part.slice(0, eq)).toLowerCase();
    const to = cleanHost(part.slice(eq + 1));
    if (from && to) rules.push([from, to]);
  }
  return rules;
};

type Rewrite = { kind: "host"; host: string } | { kind: "prefix"; base: string };

const toRewrite = (target: string, swapped: string): Rewrite =>
  FIX_VG_HOST.test(target) ? { kind: "prefix", base: target.toLowerCase() } : { kind: "host", host: swapped };

const rewriteHost = (host: string, customRules: [string, string][]): Rewrite | null => {
  if (settings.twitter && TWITTER_HOST.test(host)) {
    const target = pickDomain(settings.customTwitterDomain, settings.twitterDomain, "fixupx.com");
    return toRewrite(target, target);
  }
  if (settings.instagram && INSTAGRAM_HOST.test(host)) {
    const target = pickDomain(settings.customInstagramDomain, settings.instagramDomain, "kkinstagram.com");
    return toRewrite(target, target);
  }
  if (settings.tiktok && TIKTOK_HOST.test(host)) {
    const target = pickDomain(settings.customTiktokDomain, settings.tiktokDomain, "tnktok.com");
    const sub = /^(vm\.|vt\.)/i.exec(host)?.[1]?.toLowerCase() ?? "";
    return toRewrite(target, `${sub}${target}`);
  }
  const lower = host.toLowerCase();
  const bare = lower.replace(/^(www\.|m\.|mobile\.)/, "");
  for (const [from, to] of customRules) {
    if (lower === from || bare === from) return { kind: "host", host: to };
  }
  return null;
};

const fix = (text: string) => {
  const customRules = parseCustomRules();
  return text.replace(/https?:\/\/[^\s<>()]+/gi, (url) => {
    const match = /^https?:\/\/([^/?#:]+)/i.exec(url);
    if (!match) return url;
    const next = rewriteHost(match[1], customRules);
    if (!next) return url;
    if (next.kind === "host") return url.replace(match[1], next.host);
    // fix.vg takes the original link after its own host: fix.vg/x.com/user/status/1
    return `https://${next.base}/${url.replace(/^https?:\/\//i, "")}`;
  });
};

phoenix.messages.onSend((text) => (/http/i.test(text) ? fix(text) : undefined));
