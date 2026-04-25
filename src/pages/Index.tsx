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

// ── Autocomplete component ──────────────────────────────────────────────────
const CategoryInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!input.trim()) return CATEGORIES.slice(0, 8);
    const q = input.toLowerCase();
    return CATEGORIES.filter(c => c.toLowerCase().includes(q)).slice(0, 10);
  }, [input]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (cat: string) => {
    setInput(cat);
    onChange(cat);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <Input
        value={input}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Ej. Clínica dental, Fontanero…"
        className="border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-[#E0007A]/30"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {suggestions.map(cat => (
            <li
              key={cat}
              onMouseDown={() => select(cat)}
              className={`cursor-pointer px-4 py-2.5 text-sm text-zinc-800 hover:bg-[#E0007A]/5 hover:text-[#E0007A] ${cat === value ? "bg-[#E0007A]/5 font-medium text-[#E0007A]" : ""}`}
            >
              {cat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────
const Index = () => {
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);

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
      toast.error(`Error: ${e instanceof Error ? e.message : "Error desconocido"}`);
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
              <Button onClick={handleSearch} disabled={loading} className="flex-1 bg-[#E0007A] text-white hover:bg-[#c4006a] disabled:opacity-50 sm:flex-none sm:min-w-[180px]">
                {loading ? <><Loader2 className="animate-spin" />Buscando…</> : <><Search />Buscar negocios</>}
              </Button>
              <Button onClick={handleExport} variant="outline" disabled={sortedResults.length === 0} className="flex-1 border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 sm:flex-none">
                <Download />Exportar Excel
              </Button>
            </div>
          </div>
        </section>

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
