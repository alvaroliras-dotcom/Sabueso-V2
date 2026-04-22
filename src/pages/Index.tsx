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
    className: "bg-[#E0007A]/10 text-[#E0007A] border border-[#E0007A]/30 font-semibold",
  },
  Media: {
    label: "Media",
    className: "bg-amber-50 text-amber-600 border border-amber-300 font-medium",
  },
  Baja: {
    label: "Baja",
    className: "bg-zinc-100 text-zinc-600 border border-zinc-400 font-medium",
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
    <div className="min-h-screen bg-[#f4f4f8] text-zinc-800">
      {/* HERO HEADER */}
      <header className="border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex w-full flex-col items-center py-3 px-6">
          <img
            src={logo}
            alt="Logo SABUESO"
            className="h-64 w-auto object-contain"
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* SEARCH BAR */}
        <section
          aria-label="Búsqueda de negocios"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500">Categoría</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-zinc-300 bg-white text-zinc-800 focus:ring-[#E0007A]/30">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent className="max-h-72 border-zinc-200 bg-white text-zinc-800">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-zinc-100 focus:text-zinc-900">
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
                className="border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-[#E0007A]/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-transparent select-none">.</label>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="min-w-[170px] bg-[#E0007A] text-white hover:bg-[#c4006a] disabled:opacity-50"
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
                className="border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 disabled:opacity-40"
              >
                <Download />Exportar Excel
              </Button>
            </div>
          </div>
        </section>

        {/* RESULTS TABLE */}
        <section
          aria-label="Resultados"
          className="mt-4 rounded-xl border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-zinc-700">Resultados</h2>
            <span className="text-xs text-zinc-400">
              {sortedResults.length} {sortedResults.length === 1 ? "negocio" : "negocios"}
            </span>
          </div>

          <div className="overflow-auto">
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
                    <TableRow
                      key={`${r.position}-${r.name}`}
                      className="border-zinc-100 transition-colors hover:bg-zinc-50"
                    >
                      <TableCell className="whitespace-nowrap tabular-nums text-zinc-700">{r.position}</TableCell>
                      <TableCell className="font-medium text-zinc-800">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-300">
                        {r.rating ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-400">
                        {r.reviews}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center border-l border-zinc-100">
                        {r.phone ? (
                          <span className="flex items-center gap-1.5 text-zinc-700">
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
                      <TableCell className="whitespace-nowrap text-center border-l border-zinc-100">
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
                          <span className="font-medium text-[#E0007A]">Sin web</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-700 border-l border-zinc-100">
                        {r.email ?? <span className="text-zinc-600">—</span>}
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
