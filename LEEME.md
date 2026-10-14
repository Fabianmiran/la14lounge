# La 14 Lounge — Fase 5: lector local Mega Súper

Instalar los archivos **desde la raíz de `la14lounge`**, rama `monitor-integracion`.

Este ZIP añade dos archivos nuevos y no modifica `search.ts`, `sources.ts` ni Supabase.

Comandos:

```bash
unzip -n ~/Downloads/LA14_MEGASUPER_FASE5_LOCAL.zip -d .
npx tsx scripts/test-megasuper-flight.ts
npx tsc --noEmit
npx eslint lib/competencia/megasuper.ts scripts/test-megasuper-flight.ts
git status --short
```

Si el archivo HTML de la búsqueda tiene otra ruta, usar:

```bash
npx tsx scripts/test-megasuper-flight.ts /ruta/archivo.html
```

## Límites

- Solo trabaja con el HTML de resultados obtenido previamente. No hace peticiones a Mega Súper.
- `price` se trata como precio BASE. Las ofertas deben validarse aparte; `quantity:24` no se interpreta automáticamente como mínimo de compra.
- El parser depende del formato Next.js Flight observado; los tests deben repetirse con varias capturas.
- La respuesta de `/robots.txt` fue HTML y no se conoce permiso para automatizar la extracción. No habilitar crawler o cron hasta confirmarlo.
- No se modifica ni escribe en Supabase.
