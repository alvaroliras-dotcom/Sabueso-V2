const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebFingerprintInput {
  position: number;
  name: string;
  website: string;
}

interface WebFingerprintResult {
  position: number;
  name: string;
  website: string | null;
  provider: string;
  priority: "Alta" | "Media" | "Baja";
  reason: string;
}

function normalizeHtml(html: string): string {
  return html.toLowerCase();
}

function detectProvider(html: string, website: string): { provider: string; priority: "Alta" | "Media" | "Baja"; reason: string } {
  const h = normalizeHtml(html);
  const url = website.toLowerCase();

  if (
    h.includes("ionos") ||
    h.includes("1and1") ||
    h.includes("1&1") ||
    url.includes("ionos") ||
    url.includes("1and1")
  ) {
    return {
      provider: "IONOS",
      priority: "Alta",
      reason: "Web detectada con huella IONOS / 1&1. Alta probabilidad de web industrializada y mejorable.",
    };
  }

  if (
    h.includes("beedigital") ||
    h.includes("bee digital") ||
    h.includes("producido por beedigital") ||
    url.includes("beedigital")
  ) {
    return {
      provider: "BeeDIGITAL",
      priority: "Alta",
      reason: "Web detectada con huella BeeDIGITAL. Posible web creada a granel y oportunidad comercial clara.",
    };
  }

  if (
    h.includes("wix.com") ||
    h.includes("wixsite") ||
    h.includes("x-wix") ||
    h.includes("wixstatic") ||
    url.includes("wixsite")
  ) {
    return {
      provider: "Wix",
      priority: "Alta",
      reason: "Web detectada con huella Wix. Constructor visual con posible margen de mejora SEO y conversión.",
    };
  }

  if (
    h.includes("webnode") ||
    url.includes("webnode")
  ) {
    return {
      provider: "Webnode",
      priority: "Alta",
      reason: "Web detectada con huella Webnode. Constructor estándar con oportunidad de mejora.",
    };
  }

  if (
    h.includes("jimdo") ||
    url.includes("jimdo")
  ) {
    return {
      provider: "Jimdo",
      priority: "Alta",
      reason: "Web detectada con huella Jimdo. Constructor estándar con oportunidad comercial.",
    };
  }

  if (
    h.includes("wp-content") ||
    h.includes("wp-includes") ||
    h.includes("wordpress")
  ) {
    return {
      provider: "WordPress",
      priority: "Media",
      reason: "Web WordPress detectada. Revisar manualmente calidad, diseño, SEO y conversión.",
    };
  }

  return {
    provider: "Web propia",
    priority: "Baja",
    reason: "No se detecta proveedor atacable. Posible web propia o proveedor no identificado.",
  };
}

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SabuesoWebFingerprint/1.0; +https://sabueso.app)",
      },
      redirect: "follow",
    });

    clearTimeout(timer);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    return await res.text();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const items: WebFingerprintInput[] = Array.isArray(body?.items)
      ? body.items
      : [];

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ results: [], count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const results: WebFingerprintResult[] = await Promise.all(
      items.map(async (item) => {
        const html = await fetchHtml(item.website);

        if (!html) {
          return {
            position: item.position,
            name: item.name,
            website: item.website,
            provider: "No accesible",
            priority: "Baja",
            reason: "No se pudo acceder al HTML de la web.",
          };
        }

        const detected = detectProvider(html, item.website);

        return {
          position: item.position,
          name: item.name,
          website: item.website,
          provider: detected.provider,
          priority: detected.priority,
          reason: detected.reason,
        };
      }),
    );

    return new Response(
      JSON.stringify({
        results,
        count: results.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});