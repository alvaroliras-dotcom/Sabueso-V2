// SABUESO — search-businesses edge function
// Receives { category, location } and returns up to 50 local businesses
// enriched with email/whatsapp and a commercial opportunity score.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Opportunity = "Alta" | "Media" | "Baja";

interface BusinessResult {
  position: number;
  name: string;
  address: string;
  category: string;
  rating: number | null;
  reviews: number;
  phone: string | null;
  whatsapp: boolean;
  website: string | null;
  email: string | null;
  city: string;
  score: number;
  opportunity: Opportunity;
}

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BAD_EMAIL_HINTS = [
  "sentry",
  "wixpress",
  "example.com",
  "domain.com",
  "yourdomain",
  "@2x",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
];

function pickBestEmail(html: string): string | null {
  const matches = html.match(EMAIL_REGEX);
  if (!matches) return null;
  const cleaned = matches
    .map((e) => e.toLowerCase())
    .filter((e) => !BAD_EMAIL_HINTS.some((b) => e.includes(b)));
  if (cleaned.length === 0) return null;
  // Prefer info@ / contacto@ / hola@
  const preferred = cleaned.find((e) =>
    /^(info|contacto|hola|contact|admin|hello)@/.test(e),
  );
  return preferred ?? cleaned[0];
}

async function fetchHtml(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SabuesoBot/1.0; +https://sabueso.app)",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  } catch (_e) {
    return null;
  }
}

async function findEmailOnSite(website: string): Promise<string | null> {
  try {
    const base = new URL(website);
    const candidates = [
      base.toString(),
      new URL("/contacto", base).toString(),
      new URL("/contact", base).toString(),
      new URL("/aviso-legal", base).toString(),
      new URL("/legal", base).toString(),
    ];
    for (const url of candidates) {
      const html = await fetchHtml(url);
      if (!html) continue;
      const email = pickBestEmail(html);
      if (email) return email;
    }
  } catch (_e) {
    return null;
  }
  return null;
}

function detectWhatsapp(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  // Spanish mobile starts with 6 or 7 (9 digits, optionally +34)
  const local = digits.startsWith("34") ? digits.slice(2) : digits;
  return /^[67]\d{8}$/.test(local);
}

function computeScore(b: {
  position: number;
  website: string | null;
  email: string | null;
  whatsapp: boolean;
  reviews: number;
  rating: number | null;
}): { score: number; opportunity: Opportunity } {
  let score = 0;
  if (!b.website) score += 3;
  if (b.position > 10) score += 2;
  else if (b.position >= 6) score += 1;
  if (b.email) score += 1;
  if (b.whatsapp) score += 1;
  if (b.reviews > 30 && b.position > 10) score += 2;
  if (b.rating !== null && b.rating < 4.0) score += 0.5;

  let opportunity: Opportunity;
  if (score >= 6) opportunity = "Alta";
  else if (score >= 4) opportunity = "Media";
  else opportunity = "Baja";

  return { score: Math.round(score * 10) / 10, opportunity };
}

interface PlacesTextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}

interface PlaceDetails {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  name?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
}

async function textSearch(
  apiKey: string,
  query: string,
  pageToken?: string,
): Promise<{
  results: PlacesTextSearchResult[];
  nextPageToken?: string;
  status: string;
  errorMessage?: string;
}> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "es");
  if (pageToken) {
    url.searchParams.set("pagetoken", pageToken);
  } else {
    url.searchParams.set("query", query);
  }
  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    return {
      results: [],
      status: "NETWORK_ERROR",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
  if (!res.ok) {
    return {
      results: [],
      status: `HTTP_${res.status}`,
      errorMessage: await res.text().catch(() => ""),
    };
  }
  const data = await res.json().catch(() => ({}));
  return {
    results: Array.isArray(data.results) ? data.results : [],
    nextPageToken: data.next_page_token,
    status: data.status ?? "UNKNOWN",
    errorMessage: data.error_message,
  };
}

async function placeDetails(
  apiKey: string,
  placeId: string,
): Promise<PlaceDetails | null> {
  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "es");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set(
      "fields",
      [
        "name",
        "formatted_address",
        "address_components",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "rating",
        "user_ratings_total",
        "types",
      ].join(","),
    );
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (data.status !== "OK" || !data.result) return null;
    return data.result as PlaceDetails;
  } catch (_e) {
    return null;
  }
}

function extractCity(d: PlaceDetails): string {
  const comps = d.address_components ?? [];
  const locality = comps.find((c) => c.types.includes("locality"));
  if (locality) return locality.long_name;
  const admin = comps.find((c) =>
    c.types.includes("administrative_area_level_2"),
  );
  if (admin) return admin.long_name;
  return "";
}

function prettyCategory(types: string[] | undefined, fallback: string): string {
  if (!types || types.length === 0) return fallback;
  const skip = new Set([
    "point_of_interest",
    "establishment",
    "premise",
    "food",
  ]);
  const main = types.find((t) => !skip.has(t)) ?? types[0];
  return main.replace(/_/g, " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const category = String(body?.category ?? "").trim();
    const location = String(body?.location ?? "").trim();
    if (!category || !location) {
      return new Response(
        JSON.stringify({ error: "category and location are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // If location is just a postal code (digits), help Google by adding context
    const isPostalCode = /^\d{4,5}$/.test(location);
    const query = isPostalCode
      ? `${category} cerca de ${location} España`
      : `${category} en ${location}`;

    // 1) Collect up to 60 places via paginated text search (3 pages of 20)
    const collected: PlacesTextSearchResult[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      if (page > 0) {
        // Google requires a short delay before nextPageToken is valid
        await new Promise((r) => setTimeout(r, 2100));
      }
      const { results, nextPageToken, status, errorMessage } = await textSearch(
        apiKey,
        query,
        pageToken,
      );

      // First page: if Google rejects the query, surface a clean error.
      if (page === 0 && status !== "OK" && status !== "ZERO_RESULTS") {
        console.error("textsearch first page failed:", status, errorMessage);
        return new Response(
          JSON.stringify({
            error: `No se pudo consultar Google Places (${status}). Prueba con una ciudad en vez de solo el código postal.`,
            results: [],
            count: 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Subsequent pages: ignore failures (commonly INVALID_REQUEST when
      // the page token isn't ready yet) and just stop paginating.
      if (page > 0 && status !== "OK") {
        if (status !== "ZERO_RESULTS") {
          console.warn("textsearch pagination stopped:", status, errorMessage);
        }
        break;
      }

      collected.push(...results);
      if (!nextPageToken || collected.length >= 50) break;
      pageToken = nextPageToken;
    }

    const top = collected.slice(0, 50);

    if (top.length === 0) {
      return new Response(
        JSON.stringify({ results: [], count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Fetch details (phone, website) for ALL — cheap relative to scraping
    const detailed = await Promise.all(
      top.map(async (p, idx) => {
        const d = await placeDetails(apiKey, p.place_id);
        const phone =
          d?.formatted_phone_number ?? d?.international_phone_number ?? null;
        const website = d?.website ?? null;
        const rating = d?.rating ?? p.rating ?? null;
        const reviews = d?.user_ratings_total ?? p.user_ratings_total ?? 0;
        const types = d?.types ?? p.types;
        return {
          position: idx + 1,
          name: p.name,
          address: d?.formatted_address ?? p.formatted_address ?? "",
          city: d ? extractCity(d) : "",
          phone,
          website,
          rating,
          reviews,
          category: prettyCategory(types, category),
        };
      }),
    );

    // 3) Preliminary scoring (without email) to pick TOP 20 to deep-scrape
    const withPrelim = detailed.map((b) => {
      const whatsapp = detectWhatsapp(b.phone);
      const { score } = computeScore({
        position: b.position,
        website: b.website,
        email: null,
        whatsapp,
        reviews: b.reviews,
        rating: b.rating,
      });
      return { ...b, whatsapp, prelimScore: score };
    });

    const sortedForScrape = [...withPrelim].sort(
      (a, b) => b.prelimScore - a.prelimScore,
    );
    const scrapeSet = new Set(
      sortedForScrape.slice(0, 20).map((b) => b.position),
    );

    // 4) Deep email scraping only for top 20
    const enriched: BusinessResult[] = await Promise.all(
      withPrelim.map(async (b) => {
        let email: string | null = null;
        if (b.website && scrapeSet.has(b.position)) {
          email = await findEmailOnSite(b.website);
        }
        const { score, opportunity } = computeScore({
          position: b.position,
          website: b.website,
          email,
          whatsapp: b.whatsapp,
          reviews: b.reviews,
          rating: b.rating,
        });
        return {
          position: b.position,
          name: b.name,
          address: b.address,
          category: b.category,
          city: b.city,
          phone: b.phone,
          whatsapp: b.whatsapp,
          website: b.website,
          email,
          rating: b.rating,
          reviews: b.reviews,
          score,
          opportunity,
        };
      }),
    );

    // 5) Sort by final score desc
    enriched.sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({ results: enriched, count: enriched.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("search-businesses error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
