import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Search, Download, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  "Abogado","Academia","Asesoría / Gestoría","Bar / Cafetería","Carpintería",
  "Cerrajero","Clínica dental","Clínica estética","Clínica veterinaria",
  "Electricista","Fisioterapeuta","Floristería","Fontanero","Gimnasio","Hotel",
  "Inmobiliaria","Joyería","Mudanzas","Óptica","Panadería","Peluquería",
  "Pintor","Psicólogo","Reformas","Restaurante","Taller mecánico","Tienda de ropa",
];

const opportunityConfig: Record<Opportunity, { label: string; className: string }> = {
  Alta: {
    label: "Alta",
    className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  },
  Media: {
    label: "Media",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  Baja: {
    label: "Baja",
    className: "bg-zinc-700/50 text-zinc-400 border border-zinc-600/40",
  },
};

const Index = () => {
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.score - a.score),
    [results],
  );

  const handleSearch = async () => {
    if (!category || !location.trim()) {
      toast.error("Selecciona categoría y escribe ciudad o código postal.");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke(
        "search-businesses",
        { body: { category, location: location.trim() } },
      );
      if (error) throw error;
      const list: BusinessResult[] = data?.results ?? [];
      setResults(list);
      if (list.length === 0) {
        toast.info("Sin resultados para esa búsqueda.");
      } else {
        toast.success(`${list.length} negocios encontrados.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(`Error en la búsqueda: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (sortedResults.length === 0) {
      toast.error("No hay resultados para exportar todavía.");
      return;
    }
    const rows = sortedResults.map((r) => ({
      Posición: r.position,
      Negocio: r.name,
      Rating: r.rating ?? "",
      Reseñas: r.reviews,
      Teléfono: r.phone ?? "",
      WhatsApp: r.whatsapp ? "Sí" : "No",
      Web: r.website ?? "",
      Email: r.email ?? "",
      Score: r.score.toFixed(1),
      Oportunidad: r.opportunity,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SABUESO");
    XLSX.writeFile(wb, `sabueso-${category}-${location}.xlsx`);
  };

  return (
    <div className="dark min-h-screen bg-[#0e0e12] text-zinc-100">
      {/* HERO HEADER */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center py-2 px-6">
          <img
            src={logo}
            alt="Logo SABUESO"
            className="h-[28rem] w-auto object-contain"
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* SEARCH BAR */}
        <section
          aria-label="Búsqueda de negocios"
          className="rounded-xl border border-white/5 bg-[#1a1a24] p-5 shadow-xl shadow-black/30"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500">Categoría</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-white/10 bg-[#0e0e12] text-zinc-200 focus:ring-[#E0007A]/40">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent className="max-h-72 border-white/10 bg-[#1a1a24] text-zinc-200">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-white/5 focus:text-zinc-100">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500">Ciudad o código postal</label>
              <Input
                placeholder="Ej. Valencia, 28013…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="border-white/10 bg-[#0e0e12] text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-[#E0007A]/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-transparent select-none">.</label>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="min-w-[170px] bg-[#E0007A] text-zinc-100 hover:bg-[#c4006a] disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 className="animate-spin" />Buscando…</>
                ) : (
                  <><Search />Buscar negocios</>
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-transparent select-none">.</label>
              <Button
                onClick={handleExport}
                variant="outline"
                disabled={sortedResults.length === 0}
                className="border-white/10 bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:opacity-40"
              >
                <Download />Exportar Excel
              </Button>
            </div>
          </div>
        </section>

        {/* RESULTS TABLE */}
        <section
          aria-label="Resultados"
          className="mt-6 rounded-xl border border-white/5 bg-[#1a1a24] shadow-xl shadow-black/30"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-zinc-300">Resultados</h2>
            <span className="text-xs text-zinc-600">
              {sortedResults.length} {sortedResults.length === 1 ? "negocio" : "negocios"}
            </span>
          </div>

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-10 text-zinc-500">#</TableHead>
                  <TableHead className="text-zinc-500">Negocio</TableHead>
                  <TableHead className="text-right text-zinc-500">Rating</TableHead>
                  <TableHead className="text-right text-zinc-500">Reseñas</TableHead>
                  <TableHead className="text-zinc-500">Teléfono</TableHead>
                  <TableHead className="text-zinc-500">Web</TableHead>
                  <TableHead className="text-zinc-500">Email</TableHead>
                  <TableHead className="text-zinc-500">Oportunidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.length === 0 ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell colSpan={8} className="h-48 text-center text-sm text-zinc-600">
                      Lanza una búsqueda para ver resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedResults.map((r) => (
                    <TableRow
                      key={`${r.position}-${r.name}`}
                      className="border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <TableCell className="tabular-nums text-zinc-600">{r.position}</TableCell>
                      <TableCell className="font-medium text-zinc-200">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-300">
                        {r.rating ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-400">
                        {r.reviews}
                      </TableCell>
                      <TableCell>
                        {r.phone ? (
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            {r.phone}
                            {r.whatsapp && (
                              <MessageCircle
                                size={13}
                                className="shrink-0 text-emerald-500"
                                aria-label="WhatsApp disponible"
                              />
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.website ? (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#E0007A] underline-offset-2 hover:underline"
                          >
                            Visitar
                          </a>
                        ) : (
                          <span className="text-zinc-600">Sin web</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {r.email ?? <span className="text-zinc-600">No encontrado</span>}
                      </TableCell>
                      <TableCell>
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
