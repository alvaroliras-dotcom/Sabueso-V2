import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Search, Download, Loader2 } from "lucide-react";
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
  "Abogado",
  "Academia",
  "Asesoría / Gestoría",
  "Bar / Cafetería",
  "Carpintería",
  "Cerrajero",
  "Clínica dental",
  "Clínica estética",
  "Clínica veterinaria",
  "Electricista",
  "Fisioterapeuta",
  "Floristería",
  "Fontanero",
  "Gimnasio",
  "Hotel",
  "Inmobiliaria",
  "Joyería",
  "Mudanzas",
  "Óptica",
  "Panadería",
  "Peluquería",
  "Pintor",
  "Psicólogo",
  "Reformas",
  "Restaurante",
  "Taller mecánico",
  "Tienda de ropa",
];

const opportunityClasses: Record<Opportunity, string> = {
  Alta: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  Media: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  Baja: "bg-muted text-muted-foreground border-border",
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
      Categoría: r.category,
      Ciudad: r.city,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <img
            src={logo}
            alt="Logo SABUESO"
            className="h-10 w-10 rounded-md object-contain"
          />
          <div className="flex flex-col leading-tight">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              SABUESO
            </h1>
            <p className="text-xs text-muted-foreground">
              Detector de oportunidades SEO local
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Search bar */}
        <section
          aria-label="Búsqueda de negocios"
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Categoría
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Ciudad o código postal
              </label>
              <Input
                placeholder="Ej. Valencia, 28013…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-transparent select-none">
                .
              </label>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="min-w-[170px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Buscando…
                  </>
                ) : (
                  <>
                    <Search />
                    Buscar negocios
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-transparent select-none">
                .
              </label>
              <Button
                onClick={handleExport}
                variant="outline"
                disabled={sortedResults.length === 0}
              >
                <Download />
                Exportar Excel
              </Button>
            </div>
          </div>
        </section>

        {/* Results table */}
        <section
          aria-label="Resultados"
          className="mt-6 rounded-lg border border-border bg-card shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Resultados
            </h2>
            <span className="text-xs text-muted-foreground">
              {sortedResults.length} negocio
              {sortedResults.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Reseñas</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Web</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Oportunidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="h-40 text-center text-sm text-muted-foreground"
                    >
                      Aún no hay resultados. Lanza una búsqueda para empezar.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedResults.map((r) => (
                    <TableRow key={`${r.position}-${r.name}`}>
                      <TableCell className="text-muted-foreground">
                        {r.position}
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.city}</TableCell>
                      <TableCell className="text-right">
                        {r.rating ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.reviews}</TableCell>
                      <TableCell>{r.phone ?? "—"}</TableCell>
                      <TableCell>{r.whatsapp ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        {r.website ? (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            Visitar
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Sin web</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.email ?? (
                          <span className="text-muted-foreground">
                            No encontrado
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.score.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${opportunityClasses[r.opportunity]}`}
                        >
                          {r.opportunity}
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
