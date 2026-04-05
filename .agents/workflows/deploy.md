---
description: Hace deploy a cloudflare fullstack
---

1. Construir la aplicación:
`npm run build`

2. Aplicar migraciones a la base de datos remota (si hay cambios):
`npx wrangler d1 execute zipp_database --remote --file=./drizzle/0000_premium_black_cat.sql`

3. Desplegar a Cloudflare Pages:
`npx wrangler pages deploy dist --project-name zipp`

El dominio configurado debe ser: zipp.inteligent.software