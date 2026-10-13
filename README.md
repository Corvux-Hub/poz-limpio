# Pozo Limpio

Survival horror en vista 3/4: defiende el pozo de agua limpia con la manguera. Diseño y reglas en [`CLAUDE.md`](CLAUDE.md).

```bash
npm install
npm run dev       # juego en http://localhost:5173
npm test          # pruebas de la lógica (node --test)
npm run balance   # simulador de balance con un jugador automático
npm run build     # sitio estático en dist/
```

Requiere Node 22 (ver `.nvmrc`).

## Publicar

El build es un sitio estático (`dist/`) con rutas relativas, así que funciona en la raíz de un dominio o en una subruta.

- **GitHub Pages** (ya configurado): el workflow `.github/workflows/publicar.yml` prueba y construye el juego en cada push, y lo publica cuando el push llega a la rama principal del repositorio. Solo hay que activar Pages una vez en *Settings → Pages → Source: GitHub Actions*. El juego queda en `https://<usuario>.github.io/<repositorio>/`.
- **Cloudflare Pages** (alternativa): conectar el repositorio con el comando de build `npm run build` y el directorio de salida `dist`. Toma la versión de Node de `.nvmrc`.
