import { useMemo, useState, useRef, useEffect } from "react";
import { Search, Download, Loader2, MessageCircle } from "lucide-react";
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

const opportunityConfig: Record<Opportunity, { label: string; className: string }> = {
  Alta: { label: "Alta", className: "bg-[#E0007A]/10 text-[#E0007A] border border-[#E0007A]/30 font-semibold" },
  Media: { label: "Media", className: "bg-amber-50 text-amber-600 border border-amber-300 font-medium" },
  Baja: { label: "Baja", className: "bg-zinc-100 text-zinc-600 border border-zinc-400 font-medium" },
};

// ── Category selector component ─────────────────────────────────────────────
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

  const select = (cat: string) => {
    onChange(cat);
    setOpen(false);
    setSearch("");
  };

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
        <svg className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-400 text-center">Sin resultados. Puedes buscar igualmente.</li>
            ) : filtered.map(cat => (
              <li
                key={cat}
                onMouseDown={() => select(cat)}
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


// ── Google Map component ────────────────────────────────────────────────────
const GMAPS_KEY = "AIzaSyD8ol2QCQgig4DJQfgcxRpjAxMk5NQwKCE";

const BusinessMap = ({ results }: { results: BusinessResult[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.google?.maps) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=marker&v=beta&loading=async`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || results.length === 0) return;
    try {
    const validResults = results.filter(r => r.lat && r.lng);
    if (validResults.length === 0) return;

    const center = { lat: validResults[0].lat!, lng: validResults[0].lng! };

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
    } else {
      mapInstanceRef.current.setCenter(center);
    }

    // Clear old markers
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
    if (infoWindowRef.current) infoWindowRef.current.close();
    infoWindowRef.current = new google.maps.InfoWindow();

    const oppColors: Record<string, string> = {
      Alta: "#E0007A",
      Media: "#D97706",
      Baja: "#6B7280",
    };

    validResults.forEach((r) => {
      const color = oppColors[r.opportunity] ?? "#6B7280";
      const pin = document.createElement("div");
      pin.innerHTML = `
        <div style="
          background:${color};
          color:white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          width:32px;height:32px;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          border:2px solid white;
          cursor:pointer;
        ">
          <span style="transform:rotate(45deg);font-size:11px;font-weight:700">${r.position}</span>
        </div>`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: r.lat!, lng: r.lng! },
        map: mapInstanceRef.current!,
        content: pin,
        title: r.name,
      });

      marker.addListener("gmp-click", () => {
        const content = `
          <div style="font-family:Arial,sans-serif;min-width:200px;padding:4px">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#111">${r.name}</div>
            <div style="font-size:12px;color:#555;margin-bottom:4px">⭐ ${r.rating ?? "—"} · ${r.reviews} reseñas</div>
            ${r.phone ? `<div style="font-size:12px;color:#555;margin-bottom:4px">📞 ${r.phone}</div>` : ""}
            ${r.website ? `<div style="font-size:12px;margin-bottom:4px"><a href="${r.website}" target="_blank" style="color:#E0007A;font-weight:600">🌐 Visitar web</a></div>` : '<div style="font-size:12px;color:#E0007A;font-weight:600;margin-bottom:4px">⚠️ Sin web</div>'}
            ${r.email ? `<div style="font-size:12px;color:#555">✉️ ${r.email}</div>` : ""}
            <div style="margin-top:8px">
              <span style="
                background:${oppColors[r.opportunity]};
                color:white;padding:2px 10px;
                border-radius:999px;font-size:11px;font-weight:700
              ">${r.opportunity}</span>
            </div>
          </div>`;
        infoWindowRef.current!.setContent(content);
        infoWindowRef.current!.open(mapInstanceRef.current!, marker);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (validResults.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validResults.forEach(r => bounds.extend({ lat: r.lat!, lng: r.lng! }));
      mapInstanceRef.current.fitBounds(bounds, 40);
    }
    } catch (e) {
      console.error("Map render error:", e);
    }
  }, [loaded, results]);

  const validResults = results.filter(r => r.lat && r.lng);
  if (validResults.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-700">Mapa</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E0007A]"></span>Alta</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></span>Media</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-400"></span>Baja</span>
        </div>
      </div>
      <div ref={mapRef} className="h-[420px] w-full" />
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────
const Index = () => {
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [debugError, setDebugError] = useState<string>("");

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.score - a.score),
    [results],
  );

  const handleSearch = async () => {
    if (!category.trim() || !location.trim()) {
      toast.error("Escribe una categoría y una ciudad o código postal.");
      return;
    }
    setLoading(true);
    setResults([]);
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

  const cleanUrl = (url: string | null): string => {
    if (!url) return "";
    try { return new URL(url).origin + new URL(url).pathname; }
    catch { return url.split("?")[0]; }
  };

  const handleExport = async () => {
    if (sortedResults.length === 0) { toast.error("No hay resultados para exportar."); return; }
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("SABUESO");
    const FUCSIA = "FFE0007A", WHITE = "FFFFFFFF", GREEN = "FF1E8B4E", RED = "FFB91C1C";
    const LIGHT_GREEN = "FFD1FAE5", LIGHT_RED = "FFFEE2E2", LIGHT_FUCSIA = "FFFCE7F3";
    const AMBER = "FFD97706", LIGHT_AMBER = "FFFEF3C7", GRAY = "FF6B7280", LIGHT_GRAY = "FFF3F4F6";
    const headers = ["#","Negocio","Rating","Reseñas","Teléfono","WhatsApp","Web","Email","Score","Oportunidad"];
    const colWidths = [6, 40, 9, 10, 16, 12, 40, 35, 8, 14];
    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] }));
    const headerRow = ws.getRow(1);
    headers.forEach((_, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUCSIA } };
      cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: "Arial" };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: WHITE } } };
    });
    headerRow.height = 22;
    sortedResults.forEach((r, idx) => {
      const row = ws.addRow([r.position, r.name, r.rating !== null ? Math.round(r.rating * 10) / 10 : "", r.reviews, r.phone ?? "", r.whatsapp ? "Sí" : "No", cleanUrl(r.website), r.email ?? "", parseFloat(r.score.toFixed(1)), r.opportunity]);
      row.height = 18;
      const rowBg = idx % 2 === 0 ? "FFFAFAFA" : WHITE;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { vertical: "middle", wrapText: false };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
        if ([1,3,4,5,6,9,10].includes(colNum)) cell.alignment = { horizontal: "center", vertical: "middle" };
        if (colNum === 6) {
          const isSi = cell.value === "Sí";
          cell.font = { name: "Arial", size: 10, bold: true, color: { argb: isSi ? GREEN : RED } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isSi ? LIGHT_GREEN : LIGHT_RED } };
        }
        if (colNum === 10) {
          if (cell.value === "Alta") { cell.font = { name: "Arial", size: 10, bold: true, color: { argb: FUCSIA } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_FUCSIA } }; }
          else if (cell.value === "Media") { cell.font = { name: "Arial", size: 10, bold: true, color: { argb: AMBER } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AMBER } }; }
          else { cell.font = { name: "Arial", size: 10, color: { argb: GRAY } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } }; }
        }
      });
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: "J1" };
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sabueso-${category}-${location}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado correctamente.");
  };

  return (
    <div className="min-h-screen bg-[#f4f4f8] text-zinc-800">
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex w-full flex-col items-center py-3 px-6">
          <img src={logo} alt="Logo SABUESO" className="h-40 w-auto object-contain sm:h-56 md:h-64" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <section aria-label="Búsqueda de negocios" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3">
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
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-[#E0007A]/30"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" onClick={() => { document.activeElement instanceof HTMLElement && document.activeElement.blur(); handleSearch(); }} disabled={loading} className="flex-1 bg-[#E0007A] text-white hover:bg-[#c4006a] disabled:opacity-50 sm:flex-none sm:min-w-[180px]">
                {loading ? <><Loader2 className="animate-spin" />Buscando…</> : <><Search />Buscar negocios</>}
              </Button>
              <Button onClick={handleExport} variant="outline" disabled={sortedResults.length === 0} className="flex-1 border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 sm:flex-none">
                <Download />Exportar Excel
              </Button>
            </div>
          </div>
        </section>

        {debugError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error:</strong> {debugError}
          </div>
        ) : null}
        {window.innerWidth >= 768 && <BusinessMap results={sortedResults} />}

        <section aria-label="Resultados" className="mt-4 rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-zinc-700">Resultados</h2>
            <span className="text-xs text-zinc-400">{sortedResults.length} {sortedResults.length === 1 ? "negocio" : "negocios"}</span>
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-100 hover:bg-transparent">
                  <TableHead className="w-8 whitespace-nowrap text-zinc-700">#</TableHead>
                  <TableHead className="text-zinc-500">Negocio</TableHead>
                  <TableHead className="whitespace-nowrap text-center text-zinc-700 border-l border-zinc-100">Rating</TableHead>
                  <TableHead className="whitespace-nowrap text-center text-zinc-700 border-l border-zinc-100">Reseñas</TableHead>
                  <TableHead className="whitespace-nowrap text-center text-zinc-700 border-l border-zinc-100">Teléfono</TableHead>
                  <TableHead className="whitespace-nowrap text-center text-zinc-700 border-l border-zinc-100">Web</TableHead>
                  <TableHead className="whitespace-nowrap text-zinc-700 border-l border-zinc-100">Email</TableHead>
                  <TableHead className="whitespace-nowrap text-center text-zinc-700 border-l border-zinc-100">Oportunidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.length === 0 ? (
                  <TableRow className="border-zinc-100 hover:bg-transparent">
                    <TableCell colSpan={8} className="h-48 text-center text-sm text-zinc-400">
                      Lanza una búsqueda para ver resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedResults.map((r) => (
                    <TableRow key={`${r.position}-${r.name}`} className="border-zinc-100 transition-colors hover:bg-zinc-50">
                      <TableCell className="whitespace-nowrap tabular-nums text-zinc-700">{r.position}</TableCell>
                      <TableCell className="font-medium text-zinc-800">{r.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-center tabular-nums text-zinc-800 border-l border-zinc-100">{r.rating ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-center tabular-nums text-zinc-800 border-l border-zinc-100">{r.reviews}</TableCell>
                      <TableCell className="whitespace-nowrap text-center border-l border-zinc-100">
                        {r.phone ? (
                          <span className="inline-flex items-center gap-1.5 text-zinc-700">
                            {r.phone}
                            {r.whatsapp && <MessageCircle size={13} className="shrink-0 text-emerald-500" />}
                          </span>
                        ) : <span className="text-zinc-400">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center border-l border-zinc-100">
                        {r.website
                          ? <a href={r.website} target="_blank" rel="noreferrer" className="text-[#E0007A] underline-offset-2 hover:underline">Visitar</a>
                          : <span className="font-medium text-[#E0007A]">Sin web</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-700 border-l border-zinc-100">
                        {r.email ?? <span className="text-zinc-400">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center border-l border-zinc-100">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${opportunityConfig[r.opportunity].className}`}>
                          {opportunityConfig[r.opportunity].label}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
