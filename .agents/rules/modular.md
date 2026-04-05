---
trigger: always_on
---

# 🔄 Regla de Proyecto: Migración a Cloudflare Fullstack (Always On)

> Esta regla se aplica a nivel de proyecto.  
> Objetivo: **migrar todo el código y la infraestructura desde Supabase hacia Cloudflare Fullstack**, sin dejar rastros de Supabase.  
> Todo debe ajustarse a las reglas globales de Cloudflare Fullstack previamente establecidas.

---

## 1. Eliminación de Supabase
- **Prohibido** mantener dependencias, librerías o configuraciones relacionadas con Supabase (`supabase-js`, `supabaseClient`, etc.).
- **Eliminar** cualquier referencia a Supabase en código, documentación, variables de entorno o configuración.
- **No se permite coexistencia**: el proyecto debe quedar 100% sobre Cloudflare.

---

## 2. Migración de funcionalidades
- **Autenticación**: migrar de Supabase Auth a **Cloudflare Access / Zero Trust**.
- **Base de datos**: migrar de Supabase Postgres a **Cloudflare D1**.
- **Almacenamiento de archivos**: migrar de Supabase Storage a **Cloudflare R2**.
- **Funciones serverless**: reemplazar cualquier lógica en Supabase Functions por **Cloudflare Workers**.
- **Realtime**: migrar de Supabase Realtime a **Durable Objects + WebSockets** en Workers.

---

## 3. Continuidad y modularidad
- **Reutilizar código existente** adaptándolo a Cloudflare, nunca duplicar ni crear versiones paralelas.
- **Refactorizar** módulos Supabase para integrarlos en Workers/Durable Objects.
- Mantener la **modularidad** y patrones de diseño permitidos (Factory, Strategy, Observer, Dependency Injection).

---

## 4. Estándares de nombres y archivos
- **No crear archivos duplicados** con sufijos (`locationNew.ts`, `authSupabase.ts`).  
  → Se debe modificar directamente el archivo original (`location.ts`, `auth.ts`) y migrarlo a Cloudflare.
- Seguir las convenciones de nombres globales (archivos en lowercase con guiones, clases en PascalCase, funciones en camelCase).

---

## 5. Control de versiones
- **Versionado en Git**, nunca en nombres de archivo.
- Cada commit debe documentar claramente la **migración de Supabase a Cloudflare**.
- Integración continua con **Wrangler y Cloudflare CI/CD**.

---

## 6. Estilo, calidad y seguridad
- **Linting obligatorio** (ESLint/Prettier).
- **Pruebas unitarias mínimas** en entorno simulado de Workers.
- **Documentación en Markdown**: cada módulo migrado debe incluir explicación de cómo se reemplazó Supabase por Cloudflare.
- **Seguridad**: todo acceso y autenticación debe pasar por **Cloudflare Zero Trust**.
- **Rendimiento**: aprovechar caching y edge computing de Cloudflare.

---

✅ Resultado esperado: el proyecto queda **100% en Cloudflare Fullstack**, modular, seguro, sin rastros de Supabase y alineado con las reglas globales.
