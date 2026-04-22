
# Ajuste de scoring comercial — SABUESO

Refinamos la heurística de oportunidad y el orden de resultados, más una optimización de rendimiento en el enriquecimiento web.

## Nueva fórmula de scoring

Cada negocio recibe un **score numérico**:

| Señal | Puntos |
|---|---|
| Sin web | +3 |
| Posición local > 10 | +2 |
| Posición local 6–10 | +1 |
| Email disponible | +1 |
| WhatsApp probable | +1 |
| **Más de 30 reseñas Y posición > 10** (autoridad desaprovechada) | **+2** |
| Rating < 4.0 | +0.5 |

Se elimina la regla "sin teléfono = +1".

## Clasificación

- Score **≥ 6** → **Alta**
- Score **4 – 5.9** → **Media**
- Score **< 4** → **Baja**

## Tabla de resultados

- Nueva columna **Score** (número con un decimal) junto a **Oportunidad comercial**.
- Orden por **score numérico descendente** (no por etiqueta), de modo que dentro de "Alta" aparece primero el de mayor score.

## Optimización de rendimiento

En la edge function `search-businesses`:

1. Traer los 50 resultados de Google Places y calcular un **score preliminar** solo con datos ya disponibles (posición, web sí/no, reseñas, rating, teléfono móvil).
2. Ordenar por score preliminar descendente.
3. Hacer **scraping profundo de email/web solo sobre los 20 primeros**.
4. Recalcular score final de los 20 (ya con email) y reordenar todo el conjunto.
5. Devolver los 50 resultados; los del puesto 21–50 mostrarán "No encontrado" en email salvo que Google Places ya lo trajera.

Esto reduce el tiempo de respuesta sin perder los resultados completos en pantalla.

## Archivos afectados

- `supabase/functions/search-businesses/index.ts` — nueva fórmula, scoring en dos fases, scraping limitado a top 20.
- `src/pages/Index.tsx` — añadir columna **Score**, ordenar por score numérico, ajustar tipos.
- Exportación Excel — incluir también la columna **Score**.
