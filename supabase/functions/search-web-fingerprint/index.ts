// supabase/functions/search-web-fingerprint/index.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FingerprintResult {
  position: number;
  name: string;
  website: string;
  provider: string;
  priority: string;
  reason: string;
  signals: string[];
  error: string | null;
}

interface FetchHtmlResult {
  html: string | null;
  headers: Record<string, string>;
  finalUrl: string;
  error: string | null;
}

type SignalType =
  | "html"
  | "meta"
  | "script"
  | "css"
  | "asset"
  | "header"
  | "cdn"
  | "footer"
  | "domain";

interface ProviderSignalRule {
  type: SignalType;
  pattern: RegExp;
  score: number;
  label: string;
}

interface DetectionMatch {
  provider: string;
  priority: "Alta" | "Media" | "Baja";
  reason: string;
  signals: string[];
}

interface ProviderRule {
  provider: string;
  rules: ProviderSignalRule[];
}

const providerRules: ProviderRule[] = [
  {
    provider: "IONOS",
    rules: [
      { type: "html", pattern: /ionos|1\s*&\s*1|1and1|1und1/i, score: 2, label: "Marca IONOS/1&1 en HTML" },
      { type: "script", pattern: /ionos\.|1and1\.|1und1\./i, score: 3, label: "Script servido por IONOS/1&1" },
      { type: "css", pattern: /ionos\.|1and1\.|1und1\./i, score: 3, label: "CSS servido por IONOS/1&1" },
      { type: "footer", pattern: /powered by ionos|creado con ionos|website by ionos|1&1/i, score: 4, label: "Footer IONOS/1&1" },
      { type: "domain", pattern: /(ionos|1and1|1und1)/i, score: 3, label: "Dominio técnico IONOS/1&1" },
      { type: "header", pattern: /(ionos|1and1|1und1)/i, score: 3, label: "Header de infraestructura IONOS/1&1" },
      { type: "cdn", pattern: /(ionos|1and1|1und1)/i, score: 2, label: "CDN de IONOS/1&1" },
    ],
  },
  {
    provider: "BeeDIGITAL",
    rules: [
      { type: "html", pattern: /beedigital|qdqmedia|digitalpresence/i, score: 3, label: "Marca BeeDIGITAL/QDQ en HTML" },
      { type: "script", pattern: /beedigital|qdq|digitalpresence/i, score: 4, label: "Script de BeeDIGITAL/QDQ" },
      { type: "footer", pattern: /diseñad[oa] por beedigital|powered by beedigital|web de beedigital/i, score: 5, label: "Footer BeeDIGITAL" },
      { type: "domain", pattern: /(beedigital|qdq)/i, score: 3, label: "Dominio técnico BeeDIGITAL/QDQ" },
      { type: "meta", pattern: /beedigital|qdq/i, score: 3, label: "Meta tag de BeeDIGITAL/QDQ" },
    ],
  },
  {
    provider: "GoDaddy Website Builder",
    rules: [
      { type: "domain", pattern: /(godaddysites\.com|secureserver\.net)/i, score: 5, label: "Dominio técnico GoDaddy" },
      { type: "script", pattern: /godaddy|secureserver/i, score: 4, label: "Script GoDaddy" },
      { type: "html", pattern: /website builder|godaddy/i, score: 2, label: "Marca GoDaddy en HTML" },
      { type: "header", pattern: /godaddy|secureserver/i, score: 3, label: "Header GoDaddy" },
    ],
  },
  {
    provider: "Hostinger",
    rules: [
      { type: "domain", pattern: /(hostinger|hostingersite\.com|hpanel)/i, score: 5, label: "Dominio técnico Hostinger" },
      { type: "html", pattern: /hostinger/i, score: 2, label: "Marca Hostinger en HTML" },
      { type: "script", pattern: /hostinger|hpanel/i, score: 4, label: "Script de Hostinger" },
      { type: "header", pattern: /hostinger/i, score: 3, label: "Header de infraestructura Hostinger" },
    ],
  },
  {
    provider: "Squarespace",
    rules: [
      { type: "domain", pattern: /(squarespace\.com|sqspcdn\.com)/i, score: 5, label: "Dominio técnico Squarespace" },
      { type: "script", pattern: /squarespace|sqspcdn/i, score: 4, label: "Script Squarespace" },
      { type: "css", pattern: /squarespace|sqspcdn/i, score: 4, label: "CSS Squarespace" },
      { type: "footer", pattern: /powered by squarespace/i, score: 5, label: "Footer Squarespace" },
    ],
  },
  {
    provider: "Webflow",
    rules: [
      { type: "domain", pattern: /(webflow\.io|webflow\.com)/i, score: 5, label: "Dominio técnico Webflow" },
      { type: "script", pattern: /webflow/i, score: 4, label: "Script Webflow" },
      { type: "css", pattern: /webflow/i, score: 4, label: "CSS Webflow" },
      { type: "html", pattern: /w-mod-js|w-mod-ix/i, score: 3, label: "Clases Webflow en HTML" },
      { type: "footer", pattern: /made in webflow|powered by webflow/i, score: 5, label: "Footer Webflow" },
    ],
  },
  {
    provider: "Wix",
    rules: [
      { type: "domain", pattern: /(wixsite\.com|wix\.com|parastorage\.com)/i, score: 5, label: "Dominio técnico Wix" },
      { type: "script", pattern: /wix|parastorage/i, score: 4, label: "Script Wix" },
      { type: "meta", pattern: /wix/i, score: 3, label: "Meta tag Wix" },
      { type: "footer", pattern: /powered by wix/i, score: 5, label: "Footer Wix" },
    ],
  },
  {
    provider: "Webnode",
    rules: [
      { type: "domain", pattern: /webnode\./i, score: 5, label: "Dominio técnico Webnode" },
      { type: "script", pattern: /webnode/i, score: 4, label: "Script Webnode" },
      { type: "footer", pattern: /creado con webnode|powered by webnode/i, score: 5, label: "Footer Webnode" },
    ],
  },
  {
    provider: "Jimdo",
    rules: [
      { type: "domain", pattern: /jimdo\./i, score: 5, label: "Dominio técnico Jimdo" },
      { type: "script", pattern: /jimdo/i, score: 4, label: "Script Jimdo" },
      { type: "footer", pattern: /powered by jimdo|creado con jimdo/i, score: 5, label: "Footer Jimdo" },
    ],
  },
  {
    provider: "Site123",
    rules: [
      { type: "domain", pattern: /(site123\.|cdn\.site123-static)/i, score: 5, label: "Dominio técnico Site123" },
      { type: "script", pattern: /site123/i, score: 4, label: "Script Site123" },
      { type: "footer", pattern: /powered by site123/i, score: 5, label: "Footer Site123" },
    ],
  },
  {
    provider: "WordPress",
    rules: [
      { type: "meta", pattern: /wordpress/i, score: 4, label: "Meta generator WordPress" },
      { type: "script", pattern: /wp-content|wp-includes/i, score: 3, label: "Assets WordPress" },
      { type: "css", pattern: /wp-content|wp-includes/i, score: 3, label: "CSS WordPress" },
      { type: "asset", pattern: /wp-content|wp-includes/i, score: 3, label: "Rutas de assets WordPress" },
    ],
  },
  {
    provider: "Elementor",
    rules: [
      { type: "html", pattern: /elementor/i, score: 3, label: "Marca Elementor en HTML" },
      { type: "script", pattern: /elementor/i, score: 4, label: "Script Elementor" },
      { type: "css", pattern: /elementor/i, score: 4, label: "CSS Elementor" },
      { type: "meta", pattern: /elementor/i, score: 3, label: "Meta Elementor" },
    ],
  },
  {
    provider: "Shopify",
    rules: [
      { type: "domain", pattern: /myshopify\.com/i, score: 5, label: "Dominio técnico Shopify" },
      { type: "html", pattern: /shopify/i, score: 3, label: "Marca Shopify en HTML" },
      { type: "script", pattern: /shopify/i, score: 4, label: "Script Shopify" },
      { type: "cdn", pattern: /cdn\.shopify\.com/i, score: 4, label: "CDN Shopify" },
      { type: "header", pattern: /shopify/i, score: 3, label: "Header Shopify" },
    ],
  },
  {
    provider: "Duda",
    rules: [
      { type: "domain", pattern: /duda\.co|dudamobile/i, score: 5, label: "Dominio técnico Duda" },
      { type: "script", pattern: /duda|dudamobile/i, score: 4, label: "Script Duda" },
      { type: "html", pattern: /duda/i, score: 3, label: "Marca Duda en HTML" },
    ],
  },
  {
    provider: "Strato",
    rules: [
      { type: "domain", pattern: /strato\./i, score: 5, label: "Dominio técnico Strato" },
      { type: "header", pattern: /strato/i, score: 3, label: "Header Strato" },
      { type: "html", pattern: /strato/i, score: 2, label: "Marca Strato en HTML" },
    ],
  },
  {
    provider: "Google Sites",
    rules: [
      { type: "domain", pattern: /sites\.google\.com/i, score: 5, label: "Dominio técnico Google Sites" },
      { type: "script", pattern: /googleapis|googlesite/i, score: 3, label: "Script Google Sites" },
      { type: "html", pattern: /google sites/i, score: 3, label: "Marca Google Sites en HTML" },
    ],
  },
];

function getSignalBuckets(html: string, websiteUrl: string, headers: Record<string, string>): Record<SignalType, string> {
  const htmlLower = html.toLowerCase();
  const meta = [...htmlLower.matchAll(/<meta[^>]+>/g)].map((m) => m[0]).join("\n");
  const scripts = [...htmlLower.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]).join("\n");
  const css = [...htmlLower.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/g)].map((m) => m[1]).join("\n");
  const assets = [...htmlLower.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css|png|jpg|jpeg|svg|webp)[^"']*)["']/g)].map((m) => m[1]).join("\n");
  const footer = [...htmlLower.matchAll(/<footer[\s\S]*?<\/footer>/g)].map((m) => m[0]).join("\n");
  const headerContent = Object.entries(headers)
    .map(([k, v]) => `${k.toLowerCase()}: ${v.toLowerCase()}`)
    .join("\n");
  const cdn = [scripts, css, assets].join("\n");

  return {
    html: htmlLower,
    meta,
    script: scripts,
    css,
    asset: assets,
    header: headerContent,
    cdn,
    footer,
    domain: websiteUrl.toLowerCase(),
  };
}

export function detectProvider(
  html: string,
  url: string,
  headers: Record<string, string> = {},
): DetectionMatch | null {
  const signalBuckets = getSignalBuckets(html, url, headers);
  const matches = providerRules
    .map((providerRule) => {
      const matchedSignals = providerRule.rules
        .filter((rule) => rule.pattern.test(signalBuckets[rule.type]))
        .map((rule) => ({ label: `[${rule.type}] ${rule.label}`, score: rule.score }));

      const totalScore = matchedSignals.reduce((sum, signal) => sum + signal.score, 0);

      return {
        provider: providerRule.provider,
        totalScore,
        matchedSignals,
      };
    })
    .filter((m) => m.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore);

  if (!matches.length) {
    return null;
  }

  const bestMatch = matches[0];
  const priority: "Alta" | "Media" | "Baja" =
    bestMatch.totalScore >= 8 ? "Alta" : bestMatch.totalScore >= 5 ? "Media" : "Baja";

  return {
    provider: bestMatch.provider,
    priority,
    reason: `Detectado por ${bestMatch.matchedSignals.length} señales consistentes (${bestMatch.totalScore} puntos).`,
    signals: bestMatch.matchedSignals.map((signal) => signal.label),
  };
}

export async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  try {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const res = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WebFingerprintBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    const headers = Object.fromEntries(res.headers.entries());

    if (!res.ok) {
      return {
        html: null,
        headers,
        finalUrl: res.url || normalizedUrl,
        error: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();

    return {
      html,
      headers,
      finalUrl: res.url || normalizedUrl,
      error: null,
    };
  } catch (error) {
    return {
      html: null,
      headers: {},
      finalUrl: url,
      error: error instanceof Error ? error.message : "No se pudo descargar HTML",
    };
  }
}

if (typeof Deno !== "undefined") {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const body = await req.json();
      const businesses = body.businesses ?? [];

      const results: FingerprintResult[] = [];

      for (const business of businesses) {
        if (!business.website) continue;

        const fetched = await fetchHtml(business.website);

        if (fetched.error || !fetched.html) {
          results.push({
            position: business.position,
            name: business.name,
            website: business.website,
            provider: "No detectado",
            priority: "Baja",
            reason: "No fue posible analizar la web",
            signals: [],
            error: fetched.error ?? "Sin contenido HTML",
          });
          continue;
        }

        const detected = detectProvider(fetched.html, fetched.finalUrl || business.website, fetched.headers);

        results.push({
          position: business.position,
          name: business.name,
          website: business.website,
          provider: detected?.provider ?? "No detectado",
          priority: detected?.priority ?? "Baja",
          reason: detected?.reason ?? "No se encontraron señales suficientes",
          signals: detected?.signals ?? [],
          error: null,
        });
      }

      return new Response(
        JSON.stringify({
          results,
          count: results.length,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  });
}
