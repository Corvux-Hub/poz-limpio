# POZO LIMPIO (nombre de trabajo)

Survival horror 3D con cámara fija en vista 3/4 (alta e inclinada). Defiendes un pozo de agua limpia contra oleadas de ciudadanos contaminados. No se mata a nadie: se les **limpia**. El agua limpia es el arma y la salvación.

## Visión

- El pozo está al centro del mapa. Es la base y lo que hay que proteger.
- Del pozo sale siempre una **manguera roja**, que es el arma. Apunta hacia donde el jugador dirige el cursor.
- Los atacantes son ciudadanos de cualquier urbe. Cuanto más sucios, más difíciles son. Cuanto más grandes u obesos, más tardan en limpiarse.
- Algunos llevan armas improvisadas (palos, escobas, tubos). Estas aumentan su alcance de ataque y cuánto contaminan el pozo.
- Un enemigo se derrota cuando acumula suficiente **tiempo de exposición** al agua limpia. Mientras recibe agua, su color se aclara visualmente.
- Entre oleadas el jugador mejora el pozo y la manguera.
- Tono: tensión y atmósfera oscura, sin gore. Los enemigos "se purifican", no mueren.

## Stack

- Three.js + Vite, JavaScript con módulos ES (sin frameworks de UI).
- Cámara fija en vista 3/4 (`PerspectiveCamera` alta e inclinada hacia el pozo, que queda al centro de la pantalla). No rota ni se mueve. Se ve al avatar de cuerpo completo y todo el mapa a la vez. Inclinación y campo de visión en `config.json`.
- Modelos finales en glTF/GLB (los hace el desarrollador). Mientras tanto, usar **primitivas** (cubos, cilindros, esferas).
- Despliegue final como sitio estático (Cloudflare Pages o GitHub Pages).

## Controles (v1)

- Ratón: la manguera apunta al cursor (raycast contra un plano horizontal a la altura de la cintura, `apuntado.alturaPlano`, para que apuntar al cuerpo de alguien le apunte a él y no al suelo detrás).
- Clic izquierdo mantenido: dispara el chorro.
- Tecla Espacio o Esc: pausa. La partida también se pausa sola si la ventana pierde el foco.
- Soporte táctil: fuera de alcance por ahora.

## Chorro

- El chorro son gotas que salen de la punta de la boquilla y viajan en línea recta (`velocidad`, `alcance`, `cadencia` y `ancho` en `config.json`).
- Una gota se detiene en el primer cuerpo que toca: los enemigos de adelante cubren a los de atrás.
- Al barrer con la manguera, el agua ya disparada conserva su dirección; al soltar, termina de caer.
- La lógica vive en `src/systems/chorro.js` (sin Three.js) y devuelve cada cuadro qué objetivos tocó. También anota en `chorro.salpicaduras` dónde pegó cada gota, para dibujar ahí gotitas que saltan (`src/entities/salpicaduras.js`).
- En la lógica el agua sale del cuerpo del avatar, no de la punta de la boquilla, para que también limpie a quien esté pegado a ella. Se dibuja desde la punta.

## Enemigos

- Aparecen un poco por fuera del borde del mapa (`enemigos.margenAparicion`), saliendo de la oscuridad, y caminan en línea recta hacia el pozo. Al retirarse se van hasta `enemigos.margenSalida` antes de desaparecer.
- Regla de balance: **cuanto más grandes y sucios, más lentos**. Atendido a tiempo, ninguno debería alcanzar el pozo antes de que dé tiempo de limpiarlo.
- Se detienen cuando el brocal queda a su `alcance` de ataque (en `enemies.json`), que los deja por fuera del avatar.
- Su color va de `colorBase` a `colorLimpio` según su progreso de limpieza; mientras reciben agua brillan en azul.
- En cuanto empiezan a recibir agua muestran una barra de limpieza sobre la cabeza.
- Al quedar limpios: destello blanco con un pequeño salto de tamaño, un "+N" flotante con su `recompensa` de agua limpia, y un brillo blanco suave mientras se retiran.
- Al quedar limpios se detienen un momento (`enemigos.pausaAlLimpiarse`), dejan de ser objetivo del chorro y se retiran hasta salir del mapa.
- Estados en `src/systems/enemigos.js`: `avanzando` → `en_pozo` → `limpio` → `retirandose` → `fuera`. La exposición vive en `src/systems/limpieza.js`.
- Los sucios no se enciman: `separarEnemigos` los aparta, y el que ya golpea el pozo no se deja empujar (los demás hacen fila o lo rodean).
- Miran al pozo mientras avanzan y golpean; al retirarse le dan la espalda. El tamaño los hace más anchos, no más altos.
- Aspecto provisional con primitivas (`src/entities/enemigo.js`): cuerpo humano con brazos y piernas que se balancean al caminar, panza si son grandes, y los `accesorios` de su `aspecto` en `enemies.json` (`gorra`, `casco`, `corbata`, `chaleco`) en `colorAccesorio`.
- Mientras están sucios despiden un brillo verdoso tenue ("tóxico") que se apaga al limpiarse; así se distinguen del asfalto oscuro.

## Armas improvisadas

- Las define `src/data/armas.json`: `alcanceExtra` (se suma al `alcance` del tipo, así golpean desde más lejos), `multiplicadorContaminacion` (por golpe) y su aspecto (`largo`, `grosor`, `color` y `cabeza` opcional, como la de la escoba).
- Un tipo puede traer `arma` por defecto en `enemies.json`; un grupo de `waves.json` puede darle otra con `arma` (o quitarla con `"ninguna"`).
- La sostienen frente al cuerpo apuntando al pozo y la bajan en cada golpe. Al quedar limpios la sueltan y se queda tirada en el suelo.

## Oleadas

- Las define `src/data/waves.json`. Cada oleada es una lista de `grupos`, y cada grupo tiene:
  - `tipo`: clave de `enemies.json`.
  - `cantidad` e `intervalo` (segundos entre uno y otro).
  - `retraso` opcional: segundos desde que empieza la oleada hasta que sale el primero del grupo.
  - `arma` opcional: clave de `armas.json` (o `"ninguna"`), en lugar del arma del tipo.
  - `aparicion`: `arriba`, `abajo`, `izquierda`, `derecha` o `cualquiera`, o una lista de esas para elegir al azar. Arriba es el borde lejano de la cámara.
- Una oleada termina cuando ya salieron todos sus enemigos y no queda ninguno sucio.
- Ciclo: `descanso` (cuenta regresiva) → `en_curso` → `superada` (`oleadas.celebracion` segundos) → `esperando` (menú de mejoras abierto) → `descanso` otra vez. La primera oleada espera `oleadas.esperaInicial` y las demás `oleadas.descanso`.
- Después de las oleadas definidas se repite la última escalada: `escalado.cantidad` multiplica la cantidad e `escalado.intervalo` el intervalo por cada oleada extra, sin bajar de `escalado.intervaloMinimo`.
- La lógica vive en `src/systems/oleadas.js`.

## Mecánica central: limpieza

```
tiempo_de_limpieza = suciedad_base × multiplicador_de_tamaño ÷ potencia_del_chorro
```

- Cada enemigo acumula `exposicion` según el agua que recibe: cada gota que le pega suma 1/`cadencia` segundos. Así un chorro continuo limpia al mismo ritmo a cualquier FPS (nunca contar "cuadros tocados").
- Si deja de recibir agua más de `limpieza.gracia` segundos, la exposición se **regenera lentamente** (`limpieza.regeneracion`), para que no se pueda limpiar "a golpecitos".
- Cuando `exposicion >= tiempo_de_limpieza`, el enemigo queda limpio, se detiene y se retira.
- Referencia con el chorro básico (potencia 1), revisada en el hito 7 para que los pesados no tarden tanto:

| Enemigo | Suciedad | Tamaño | Tiempo | Velocidad | Golpe | Arma | Recompensa |
|---|---|---|---|---|---|---|---|
| Peatón ligero | 3 | ×1.0 | 3 s | 1.0 m/s | 4 % cada 2 s | — | 10 |
| Oficinista sucio | 5 | ×1.0 | 5 s | 0.75 m/s | 5 % cada 2 s | — | 18 |
| Obrero corpulento con palo | 6 | ×1.5 | 9 s | 0.5 m/s | 6 % cada 2.5 s | palo | 30 |
| Jefe de basurero | 8 | ×1.5 | 12 s | 0.35 m/s | 8 % cada 2.5 s | tubo | 60 |

Las armas multiplican el golpe (palo ×1.3, escoba ×1.2, tubo ×1.6).

## Avatar

- Referencia visual: `docs/referencias/avatar.jpg`.
- Camisa blanca de manga larga con emblema naranja en el pecho, cinturón negro, pantalón gris oscuro, zapatos café oscuro y cabello oscuro peinado hacia atrás.
- Mientras no haya GLB, se arma con primitivas usando esa paleta (`src/entities/avatar.js`): manga doblada al antebrazo, cuello abierto con collar y emblema con un poco de brillo para que se note de noche.
- Respira en reposo y, al disparar, retrocede un poco y vibra con la presión del agua (`src/entities/jugador.js`; solo visual).

## Escenario

- Un cruce de avenidas de noche (`src/entities/escenario.js`): el pozo ocupa la glorieta del centro, con pasos de cebra, carriles, charcos, coladeras, basura, coches abandonados, árboles, semáforos y faroles de sodio (uno parpadea).
- Todo se genera con una semilla fija: el mapa se ve igual en cada partida.
- Nada con volumen dentro del rectángulo de aparición de los enemigos (mapa + `margenAparicion`): ahí solo hay marcas planas en el suelo.
- Los edificios altos van solo al fondo (arriba en pantalla); a los lados, medianos; cerca de la cámara, solo locales bajos, para que no tapen el juego.
- Los faroles cercanos a la cámara aportan luz pero no se dibujan, por la misma razón.

## El pozo (aspecto)

- Brocal de hileras de piedra con tono variable, dos postes de madera con travesaño, manivela, cuerda y cubeta (`src/entities/pozo.js`).
- El agua respira, hace ondas y alumbra en azul. Con la contaminación se enturbia (más rápido al principio), su luz se apaga y aparecen desechos flotando (uno por cada 10 %).

## Pozo y mejoras

- El pozo tiene un **porcentaje de contaminación**: 0 % es agua limpia y 100 % es la derrota.
- Los enemigos que llegan lo golpean cada `intervaloGolpe` segundos y cada golpe suma su `contaminacion` (%). No baja sola.
- El agua del pozo pasa de azul a café según el porcentaje, y el HUD lo muestra en una barra.
- La lógica vive en `src/systems/contaminacion.js`.
- Mejoras entre oleadas (todas definidas en `data/upgrades.json`):
  - potencia del chorro
  - alcance
  - ancho del chorro
  - reserva y recarga de presión
  - purificación (baja la contaminación) y ampliación del pozo (cada golpe ensucia menos)
  - segunda manguera (mejora tardía)

## Presión de la manguera

- La reserva se mide en segundos de chorro a plena presión (`presion.reserva`). Disparar gasta 1 s por segundo, también si el agua no le pega a nadie.
- Al soltar el clic, tras `presion.retrasoRecarga` segundos, se recarga a `presion.recarga` segundos por segundo.
- Sin presión el agua sigue saliendo, pero al `presion.caudalSinPresion` del caudal (menos gotas), así que limpia más lento: conviene soltar un momento.
- El HUD muestra la barra de presión; al vaciarse se pone naranja y dice "Suelta para recargar".
- La lógica vive en `src/systems/presion.js`; el caudal que devuelve regula cuántas gotas emite el chorro.

## Agua limpia y menú de mejoras

- Cada ciudadano limpiado da su `recompensa` (en `enemies.json`) de **agua limpia**, la moneda de las mejoras. Se muestra en el HUD.
- Al superar una oleada se abre el menú de mejoras con el juego detenido; "Empezar oleada N" lo cierra y arranca la cuenta regresiva.
- `upgrades.json` tiene dos clases de mejora:
  - Por niveles: `parametro` (`seccion.campo` de `config.json`, p. ej. `chorro.potencia`) y `niveles`, una lista de `{ valor, costo }`. El nivel 0 es el valor de `config.json`.
  - Consumibles: `costo`, `incrementoCosto` (cuánto sube con cada compra) y su efecto; por ahora solo `purifica` (puntos de contaminación que quita). `accion` cambia el texto del botón.
- La lógica vive en `src/systems/mejoras.js`; `aplicarMejoras` da los parámetros vigentes de la partida.

## Balance

- `npm run balance` juega muchas partidas con un jugador automático (`herramientas/`) usando la misma lógica que el juego (`src/core/partida.js`) y resume, por oleada, cuántas partidas la superan y con cuánta contaminación, sin mejoras y comprando mejoras.
- El jugador automático imita a un humano decente: se concentra en un objetivo, tarda en reaccionar al cambiarlo (`--reaccion`) y puede soltar el clic al quedarse sin presión (`--recargar-al 0.5`) o nunca soltarlo (`--recargar-al no`). Apunta perfecto, así que una persona rinde algo peor.
- Antes y después de cambiar números de balance, correrlo y comparar. Meta actual: sin mejoras se ganan las oleadas 1 a 3 (la 3 deja el pozo a media contaminación); de la 4 en adelante hacen falta mejoras; con mejoras se llega a la 7 u 8 y el escalado termina por ganar.

## Datos primero

Nada de números mágicos en el código. Todo el balance vive en JSON dentro de `src/data/`:

- `enemies.json`: suciedad, tamaño, velocidad, alcance, contaminación por golpe, intervalo entre golpes, recompensa, arma por defecto, color base, color limpio y aspecto (accesorios).
- `armas.json`: alcance extra, multiplicador de contaminación y aspecto de cada arma improvisada.
- `waves.json`: composición, cantidad, ritmo y puntos de aparición de cada oleada.
- `upgrades.json`: efectos, niveles y costos.
- `config.json`: presión, regeneración de exposición, tiempos entre oleadas y demás parámetros globales.

## Estructura sugerida

```
src/
  main.js          # arranque, game loop y pantallas (traduce el ratón y dibuja)
  core/            # escena, cámara, input y partida.js (lógica pura de una partida)
  entities/        # pozo, manguera, enemigos, proyectil de agua
  systems/         # oleadas, limpieza, colisiones, mejoras
  ui/              # HUD: contaminación, presión, oleada, menú de mejoras
  data/            # JSON de balance
public/models/     # GLB finales (vacío al inicio)
herramientas/      # simulador de balance y jugador automático (no entran al build)
tests/             # pruebas de la lógica (node --test)
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

1. **Esqueleto**: Vite + Three.js, cámara fija, suelo, pozo y manguera roja que sigue al cursor.
2. **Chorro**: clic mantenido dispara agua visible (partículas o línea simple), con detección de impacto contra enemigos.
3. **Un enemigo**: camina hacia el pozo, recibe agua, se aclara de color y se limpia según la fórmula.
4. **Contaminación del pozo**: los enemigos llegan, golpean y suben el porcentaje de contaminación. Pantalla de derrota al 100 %.
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
