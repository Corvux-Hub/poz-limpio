# POZO LIMPIO (nombre de trabajo)

Survival horror 3D con cámara cenital fija. Defiendes un pozo de agua limpia contra oleadas de ciudadanos contaminados. No se mata a nadie: se les **limpia**. El agua limpia es el arma y la salvación.

## Visión

- El pozo está al centro del mapa. Es la base y lo que hay que proteger.
- Del pozo sale siempre una **manguera roja**, que es el arma. Apunta hacia donde el jugador dirige el cursor.
- Los atacantes son ciudadanos de cualquier urbe. Cuanto más sucios, más difíciles son. Cuanto más grandes u obesos, más tardan en limpiarse.
- Algunos llevan armas improvisadas (palos, escobas, tubos). Estas aumentan su alcance de ataque y su daño al pozo.
- Un enemigo se derrota cuando acumula suficiente **tiempo de exposición** al agua limpia. Mientras recibe agua, su color se aclara visualmente.
- Entre oleadas el jugador mejora el pozo y la manguera.
- Tono: tensión y atmósfera oscura, sin gore. Los enemigos "se purifican", no mueren.

## Stack

- Three.js + Vite, JavaScript con módulos ES (sin frameworks de UI).
- Cámara cenital fija (`OrthographicCamera` mirando hacia abajo). No rota ni se mueve.
- Modelos finales en glTF/GLB (los hace el desarrollador). Mientras tanto, usar **primitivas** (cubos, cilindros, esferas).
- Despliegue final como sitio estático (Cloudflare Pages o GitHub Pages).

## Controles (v1)

- Ratón: la manguera apunta al cursor (raycast contra el plano del suelo).
- Clic izquierdo mantenido: dispara el chorro.
- Tecla Espacio o Esc: pausa.
- Soporte táctil: fuera de alcance por ahora.

## Mecánica central: limpieza

```
tiempo_de_limpieza = suciedad_base × multiplicador_de_tamaño ÷ potencia_del_chorro
```

- Cada enemigo acumula `exposicion` solo mientras el chorro lo toca.
- Si deja de recibir agua, la exposición se **regenera lentamente** (valor configurable), para que no se pueda limpiar "a golpecitos".
- Cuando `exposicion >= tiempo_de_limpieza`, el enemigo queda limpio, se detiene y se retira.
- Referencia con el chorro básico (potencia 1):

| Enemigo | Suciedad | Tamaño | Tiempo |
|---|---|---|---|
| Peatón ligero | 3 | ×1.0 | 3 s |
| Oficinista sucio | 6 | ×1.0 | 6 s |
| Obrero corpulento con palo | 8 | ×1.5 | 12 s |
| Jefe de basurero | 10 | ×1.5 | 15 s |

## Avatar

- Referencia visual: `docs/referencias/avatar.jpg`.
- Camisa blanca de manga larga con emblema naranja en el pecho, cinturón negro, pantalón gris oscuro, zapatos café oscuro y cabello oscuro peinado hacia atrás.
- Mientras no haya GLB, se arma con primitivas usando esa paleta (`src/entities/avatar.js`).

## Pozo y mejoras

- El pozo tiene **integridad** (vida). Los enemigos la reducen al llegar a él y golpearlo.
- La manguera tiene **presión** (reserva de agua). Se agota al disparar y se recarga con pausas.
- Mejoras entre oleadas (todas definidas en `data/upgrades.json`):
  - potencia del chorro
  - alcance
  - ancho del chorro
  - reserva y recarga de presión
  - reparación y ampliación del pozo
  - segunda manguera (mejora tardía)

## Datos primero

Nada de números mágicos en el código. Todo el balance vive en JSON dentro de `src/data/`:

- `enemies.json`: suciedad, tamaño, velocidad, daño, alcance, color base y color limpio.
- `waves.json`: composición, cantidad, ritmo y puntos de aparición de cada oleada.
- `upgrades.json`: efectos, niveles y costos.
- `config.json`: presión, regeneración de exposición, tiempos entre oleadas y demás parámetros globales.

## Estructura sugerida

```
src/
  main.js          # arranque y game loop
  core/            # escena, cámara, input, estados del juego
  entities/        # pozo, manguera, enemigos, proyectil de agua
  systems/         # oleadas, limpieza, colisiones, mejoras
  ui/              # HUD: integridad, presión, oleada, menú de mejoras
  data/            # JSON de balance
public/models/     # GLB finales (vacío al inicio)
```

## Reglas de trabajo para Claude

1. Antes de escribir código en tareas grandes, usar modo plan y esperar aprobación.
2. Avanzar por hitos pequeños. Cada hito debe quedar **jugable y probado** antes de pasar al siguiente.
3. Hacer commits pequeños con mensajes claros, uno por hito o sub-hito.
4. Usar `deltaTime` en toda la lógica. Nada de lógica atada a los FPS.
5. Mantener la lógica del juego separada del render, para poder balancear sin tocar Three.js.
6. No agregar dependencias sin justificarlo.
7. Después de cada hito, explicar en pocas líneas cómo probarlo (`npm run dev`).
8. No inventar arte. Usar primitivas hasta que haya GLB.

## Hitos

1. **Esqueleto**: Vite + Three.js, cámara cenital, suelo, pozo y manguera roja que sigue al cursor.
2. **Chorro**: clic mantenido dispara agua visible (partículas o línea simple), con detección de impacto contra enemigos.
3. **Un enemigo**: camina hacia el pozo, recibe agua, se aclara de color y se limpia según la fórmula.
4. **Daño al pozo**: los enemigos llegan, golpean y bajan la integridad. Pantalla de derrota.
5. **Oleadas**: generador desde `waves.json`, pausa entre oleadas, contador y escalado.
6. **Mejoras**: menú entre oleadas con `upgrades.json` y efectos reales.
7. **Variedad**: más tipos de enemigo y armas improvisadas con alcance distinto.
8. **Presión de la manguera** y gestión de recursos.
9. **Integración de GLB**.
10. **Pulido**: sonido, partículas, feedback de impacto, balance y despliegue.

## Decisiones abiertas

- ¿El avatar se mueve (por ejemplo WASD alrededor del pozo) o está fijo y solo apunta la manguera?
  - Provisional desde el hito 1: está pegado al brocal y gira alrededor del pozo para quedar siempre del lado del cursor.
- Nombre final del juego.
- Si habrá persistencia (récord de oleada en `localStorage`).
