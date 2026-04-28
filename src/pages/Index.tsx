import { useMemo, useState, useRef, useEffect } from "react";
import { Search, Download, Loader2, MessageCircle, Globe, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import logo from "@/assets/sabueso-logo.png";
import { supabase } from "@/integrations/supabase/client";

type Opportunity = "Alta" | "Media" | "Baja";

interface BusinessResult {
  position: number;
  name: string;
  category: string;
  rating: number | null;
  reviews: number;
  phone: string | null;
  whatsapp: boolean;
  website: string | null;
  email: string | null;
  city: string;
  lat?: number;
  lng?: number;
  score: number;
  opportunity: Opportunity;
}

interface WebFingerprintResult {
  position: number;
  name: string;
  website: string | null;
  provider: string;
  priority: "Alta" | "Media" | "Baja";
  reason: string;
}

const CATEGORIES = [
  "Academia de baile","Academia de idiomas","Academia de música","Academia de oposiciones",
  "Abogado","Administrador de fincas","Agencia de marketing","Agencia de viajes",
  "Agencia inmobiliaria","Arquitecto","Asesoría / Gestoría","Bar / Cafetería",
  "Carpintería","Centro de estética","Centro de yoga","Centro médico","Cerrajero",
  "Clínica dental","Clínica estética","Clínica veterinaria","Copistería / Imprenta",
  "Electricista","Empresa de mudanzas","Empresa de reformas","Farmacia",
  "Fisioterapeuta","Floristería","Fontanero","Fotógrafo","Gestoría",
  "Gimnasio","Hotel","Informático / Técnico","Inmobiliaria","Joyería",
  "Lavandería","Librería","Logopeda","Médico","Notaría","Nutricionista",
  "Óptica","Ortopedia","Panadería / Pastelería","Peluquería","Pintor",
  "Podólogo","Psicólogo","Quiropráctico","Reformas","Residencia de ancianos",
  "Restaurante","Seguro","Taller mecánico","Tasador","Tienda de animales",
  "Tienda de deportes","Tienda de informática","Tienda de ropa","Transportista",
].sort();

const opportunityConfig: Record<Opportunity, string> = {
  Alta: "bg-[#E0007A]/10 text-[#E0007A] border border-[#E0007A]/30 font-semibold",
  Media: "bg-amber-50 text-amber-600 border border-amber-300 font-medium",
  Baja: "bg-zinc-100 text-zinc-600 border border-zinc-400 font-medium",
};

const providerConfig: Record<string, string> = {
  IONOS: "bg-yellow-100 text-yellow-800 border-yellow-300",
  BeeDIGITAL: "bg-orange-100 text-orange-800 border-orange-300",
  Wix: "bg-green-100 text-green-800 border-green-300",
  Webnode: "bg-blue-100 text-blue-800 border-blue-300",
  Jimdo: "bg-violet-100 text-violet-800 border-violet-300",
  WordPress: "bg-zinc-200 text-zinc-800 border-zinc-300",
  "Web propia": "bg-slate-100 text-slate-700 border-slate-300",
  "No accesible": "bg-red-100 text-red-700 border-red-300",
};

const ATTACKABLE_PROVIDERS = ["IONOS", "BeeDIGITAL", "Wix", "Webnode", "Jimdo"];

const CategoryInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.filter(c => c.toLowerCase().includes(q));
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E0007A]/30"
      >
        <span className={value ? "text-zinc-800" : "text-zinc-400"}>
          {value || "Selecciona o escribe una categoría…"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-zinc-200 bg-white shadow-xl">
          <div className="p-2 border-b border-zinc-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar categoría…"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E0007A]/30"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map(cat => (
              <li
                key={cat}
                onMouseDown={() => { onChange(cat); setOpen(false); setSearch(""); }}
                className={`cursor-pointer px-4 py-2 text-sm hover:bg-[#E0007A]/5 hover:text-[#E0007A] ${cat === value ? "bg-[#E0007A]/5 font-medium text-[#E0007A]" : "text-zinc-800"}`}
              >
                {cat}
              </li>
            ))}
          </ul>
          {search && (
            <div className="border-t border-zinc-100 p-2">
              <button
                onMouseDown={() => { onChange(search); setOpen(false); setSearch(""); }}
                className="w-full rounded-md bg-[#E0007A]/5 px-3 py-2 text-sm font-medium text-[#E0007A] hover:bg-[#E0007A]/10"
              >
                Buscar "{search}" directamente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};



const GMAPS_KEY = "AIzaSyD8ol2QCQgig4DJQfgcxRpjAxMk5NQwKCE";

const BusinessMap = ({ results }: { results: BusinessResult[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=marker&v=beta`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    const valid = results.filter(r => r.lat && r.lng);
    if (!valid.length) return;

    const center = { lat: valid[0].lat!, lng: valid[0].lng! };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        mapId: "sabueso_map",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      });
    }

    markersRef.current.forEach(m => m.map = null);
    markersRef.current = [];

    const colors = {
      Alta: "#E0007A",
      Media: "#D97706",
      Baja: "#6B7280",
    };

    valid.forEach(r => {
      const pin = document.createElement("div");
      pin.innerHTML = `
        <div style="
          background:${colors[r.opportunity]};
          color:white;
          border-radius:50%;
          width:28px;
          height:28px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:700;
          box-shadow:0 2px 6px rgba(0,0,0,0.25);
        ">
          ${r.position}
        </div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: r.lat!, lng: r.lng! },
        map: mapInstanceRef.current!,
        content: pin,
        title: r.name,
      });

      markersRef.current.push(marker);
    });
  }, [loaded, results]);

  if (!results.filter(r => r.lat && r.lng).length) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-700">Mapa</h2>
      </div>
      <div ref={mapRef} className="h-[320px] sm:h-[420px] w-full" />
    </div>
  );
};
const Index = () => {
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"business" | "web">("business");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [webResults, setWebResults] = useState<WebFingerprintResult[]>([]);
  const [debugError, setDebugError] = useState("");

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.score - a.score),
    [results],
  );

  const attackableWebResults = useMemo(
    () => webResults.filter(r => ATTACKABLE_PROVIDERS.includes(r.provider)),
    [webResults],
  );

  const cleanUrl = (url: string | null): string => {
    if (!url) return "";
    try { return new URL(url).origin + new URL(url).pathname; }
    catch { return url.split("?")[0]; }
  };

  const handleSearchBusinesses = async () => {
    if (!category.trim() || !location.trim()) {
      toast.error("Escribe una categoría y una ciudad o código postal.");
      return;
    }

    setMode("business");
    setLoading(true);
    setResults([]);
    setWebResults([]);
    setDebugError("");

    try {
      const { data, error } = await supabase.functions.invoke("search-businesses", {
        body: { category: category.trim(), location: location.trim() },
      });
      if (error) throw error;

      const list: BusinessResult[] = data?.results ?? [];
      setResults(list);

      if (list.length === 0) toast.info("Sin resultados para esa búsqueda.");
      else toast.success(`${list.length} negocios encontrados.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setDebugError(msg);
      toast.error(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchWebs = async () => {
    if (!category.trim() || !location.trim()) {
      toast.error("Escribe una categoría y una ciudad o código postal.");
      return;
    }

    setMode("web");
    setLoading(true);
    setWebResults([]);
    setDebugError("");

    try {
      let baseResults = results;

      if (baseResults.length === 0) {
        const { data, error } = await supabase.functions.invoke("search-businesses", {
          body: { category: category.trim(), location: location.trim() },
        });
        if (error) throw error;
        baseResults = data?.results ?? [];
        setResults(baseResults);
      }

      const items = baseResults
        .filter(r => r.website)
        .map(r => ({
          position: r.position,
          name: r.name,
          website: r.website,
        }));

      if (items.length === 0) {
        toast.info("No hay webs para analizar.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("search-web-fingerprint", {
        body: { items },
      });
      if (error) throw error;

      const list: WebFingerprintResult[] = data?.results ?? [];
      setWebResults(list);

      const atacables = list.filter(r => ATTACKABLE_PROVIDERS.includes(r.provider));
      toast.success(`${atacables.length} webs atacables detectadas.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setDebugError(msg);
      toast.error(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async (type: "business" | "web") => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();

    if (type === "business") {
      if (sortedResults.length === 0) return toast.error("No hay fichas para exportar.");
      const ws = wb.addWorksheet("Fichas GBP");
      ws.columns = [
        { header: "#", key: "position", width: 6 },
        { header: "Negocio", key: "name", width: 40 },
        { header: "Rating", key: "rating", width: 10 },
        { header: "Reseñas", key: "reviews", width: 10 },
        { header: "Teléfono", key: "phone", width: 18 },
        { header: "WhatsApp", key: "whatsapp", width: 12 },
        { header: "Web", key: "website", width: 40 },
        { header: "Email", key: "email", width: 35 },
        { header: "Score", key: "score", width: 10 },
        { header: "Oportunidad", key: "opportunity", width: 15 },
      ];
      sortedResults.forEach(r => ws.addRow({
        position: r.position,
        name: r.name,
        rating: r.rating ?? "",
        reviews: r.reviews,
        phone: r.phone ?? "",
        whatsapp: r.whatsapp ? "Sí" : "No",
        website: cleanUrl(r.website),
        email: r.email ?? "",
        score: r.score,
        opportunity: r.opportunity,
      }));
    }

    if (type === "web") {
      if (attackableWebResults.length === 0) return toast.error("No hay webs atacables para exportar.");
      const ws = wb.addWorksheet("Webs atacables");
      ws.columns = [
        { header: "#", key: "position", width: 6 },
        { header: "Negocio", key: "name", width: 40 },
        { header: "Web", key: "website", width: 45 },
        { header: "Proveedor", key: "provider", width: 18 },
        { header: "Prioridad", key: "priority", width: 14 },
        { header: "Motivo", key: "reason", width: 60 },
      ];
      attackableWebResults.forEach(r => ws.addRow({
        position: r.position,
        name: r.name,
        website: cleanUrl(r.website),
        provider: r.provider,
        priority: r.priority,
        reason: r.reason,
      }));
    }

    const ws = wb.worksheets[0];
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0007A" } };
      cell.alignment = { horizontal: "center" };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + ws.columnCount)}1` };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "business"
      ? `sabueso-fichas-${category}-${location}.xlsx`
      : `sabueso-webs-atacables-${category}-${location}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado.");
  };

  const exportPDF = (type: "business" | "web") => {
    const rows = type === "business" ? sortedResults : attackableWebResults;
    if (rows.length === 0) return toast.error("No hay datos para PDF.");

    const title = type === "business"
      ? `Informe fichas GBP — ${category} en ${location}`
      : `Informe webs atacables — ${category} en ${location}`;

    const bodyRows = type === "business"
      ? sortedResults.map(r => `
        <tr>
          <td>${r.position}</td><td>${r.name}</td><td>${r.rating ?? "—"}</td><td>${r.reviews}</td>
          <td>${r.phone ?? "—"}</td><td>${cleanUrl(r.website) || "Sin web"}</td><td>${r.email ?? "—"}</td><td>${r.opportunity}</td>
        </tr>`).join("")
      : attackableWebResults.map(r => `
        <tr>
          <td>${r.position}</td><td>${r.name}</td><td>${cleanUrl(r.website)}</td><td>${r.provider}</td><td>${r.priority}</td><td>${r.reason}</td>
        </tr>`).join("");

    const headers = type === "business"
      ? "<th>#</th><th>Negocio</th><th>Rating</th><th>Reseñas</th><th>Teléfono</th><th>Web</th><th>Email</th><th>Oportunidad</th>"
      : "<th>#</th><th>Negocio</th><th>Web</th><th>Proveedor</th><th>Prioridad</th><th>Motivo</th>";

    const win = window.open("", "_blank");
    if (!win) return toast.error("El navegador bloqueó la ventana PDF.");

    win.document.write(`
      <html>
      <head>
        <title>${title}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:28px;color:#111}
          h1{font-size:22px;margin-bottom:8px}
          p{color:#555;font-size:13px}
          table{border-collapse:collapse;width:100%;font-size:12px;margin-top:20px}
          th{background:#E0007A;color:white;text-align:left;padding:8px}
          td{border-bottom:1px solid #ddd;padding:7px;vertical-align:top}
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generado desde Sabueso V2.</p>
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <script>window.print()</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-[#f4f4f8] text-zinc-800">
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex w-full flex-col items-center py-3 px-6">
          <img src={logo} alt="Logo SABUESO" className="h-40 w-auto object-contain sm:h-56 md:h-64" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500">Categoría</label>
              <CategoryInput value={category} onChange={setCategory} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500">Ciudad o código postal</label>
              <Input
                placeholder="Ej. Valencia, 28013…"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-[#E0007A]/30"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleSearchBusinesses} disabled={loading} className="bg-[#E0007A] text-white hover:bg-[#c4006a]">
              {loading && mode === "business" ? <Loader2 className="animate-spin" /> : <Search />}
              Buscar fichas
            </Button>
            <Button onClick={handleSearchWebs} disabled={loading} variant="outline">
              {loading && mode === "web" ? <Loader2 className="animate-spin" /> : <Globe />}
              Buscar webs atacables
            </Button>
            <Button onClick={() => exportExcel("business")} variant="outline" disabled={sortedResults.length === 0}>
              <Download /> Excel fichas
            </Button>
            <Button onClick={() => exportExcel("web")} variant="outline" disabled={attackableWebResults.length === 0}>
              <Download /> Excel webs
            </Button>
            <Button onClick={() => exportPDF("business")} variant="outline" disabled={sortedResults.length === 0}>
              <FileText /> PDF fichas
            </Button>
            <Button onClick={() => exportPDF("web")} variant="outline" disabled={attackableWebResults.length === 0}>
              <FileText /> PDF webs
            </Button>
          </div>
        </section>

        {debugError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error:</strong> {debugError}
          </div>
        ) : null}

        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-zinc-400">Fichas encontradas</div>
            <div className="text-2xl font-bold">{sortedResults.length}</div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-zinc-400">Webs analizadas</div>
            <div className="text-2xl font-bold">{webResults.length}</div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-xs text-zinc-400">Webs atacables</div>
            <div className="text-2xl font-bold text-[#E0007A]">{attackableWebResults.length}</div>
          </div>
        </section>

        <BusinessMap results={sortedResults} />

        {mode === "business" ? (
          <section className="mt-4 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-700">Prospección de fichas</h2>
              <span className="text-xs text-zinc-400">{sortedResults.length} resultados</span>
            </div>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Negocio</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Reseñas</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Web</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Oportunidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map(r => (
                    <TableRow key={`${r.position}-${r.name}`}>
                      <TableCell>{r.position}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.rating ?? "—"}</TableCell>
                      <TableCell>{r.reviews}</TableCell>
                      <TableCell>
                        {r.phone ?? "—"}
                        {r.whatsapp && <MessageCircle size={13} className="inline ml-1 text-emerald-500" />}
                      </TableCell>
                      <TableCell>
                        {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-[#E0007A] hover:underline">Visitar</a> : "Sin web"}
                      </TableCell>
                      <TableCell>{r.email ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${opportunityConfig[r.opportunity]}`}>
                          {r.opportunity}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-700">Prospección de webs atacables</h2>
              <span className="text-xs text-zinc-400">{attackableWebResults.length} resultados atacables</span>
            </div>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Negocio</TableHead>
                    <TableHead>Web</TableHead>
                    <TableHead className="bg-gray-100">Proveedor</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attackableWebResults.map(r => (
                    <TableRow key={`${r.position}-${r.website}`}>
                      <TableCell>{r.position}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-[#E0007A] hover:underline">{cleanUrl(r.website)}</a> : "—"}
                      </TableCell>
                      <TableCell className="bg-gray-100">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${providerConfig[r.provider] ?? providerConfig["Web propia"]}`}>
                          {r.provider}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-[#E0007A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#E0007A]">
                          {r.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;