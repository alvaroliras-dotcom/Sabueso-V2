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
}

function detectProvider(html: string, url: string): {
  provider: string;
  priority: string;
  reason: string;
} | null {
  const content = `${html} ${url}`.toLowerCase();

  if (content.includes("ionos")) {
    return {
      provider: "IONOS",
      priority: "Alta",
      reason: "Infraestructura detectada de IONOS",
    };
  }

  if (content.includes("wix")) {
    return {
      provider: "Wix",
      priority: "Alta",
      reason: "Constructor Wix detectado",
    };
  }

  if (content.includes("webnode")) {
    return {
      provider: "Webnode",
      priority: "Alta",
      reason: "Webnode detectado",
    };
  }

  if (content.includes("jimdo")) {
    return {
      provider: "Jimdo",
      priority: "Alta",
      reason: "Jimdo detectado",
    };
  }

  if (content.includes("site123")) {
    return {
      provider: "Site123",
      priority: "Alta",
      reason: "Site123 detectado",
    };
  }

  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) return null;

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
    const body = await req.json();
    const businesses = body.businesses ?? [];

    const results: FingerprintResult[] = [];

    for (const business of businesses) {
      if (!business.website) continue;

      const html = await fetchHtml(business.website);
      if (!html) continue;

      const detected = detectProvider(html, business.website);
      if (!detected) continue;

      results.push({
        position: business.position,
        name: business.name,
        website: business.website,
        provider: detected.provider,
        priority: detected.priority,
        reason: detected.reason,
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