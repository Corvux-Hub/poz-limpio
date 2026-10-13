// Lógica pura del chorro: sin Three.js, todo en el plano del suelo (x, z).
// El chorro son gotas que salen de la boquilla y viajan en línea recta hasta su alcance.
// Cada cuadro, el trayecto de cada gota se revisa como segmento, así no atraviesa objetivos
// aunque dt sea grande. Una gota se detiene en el primer objetivo que toca.

// `salpicaduras` guarda los puntos { x, z } donde pegó el agua en el último paso (para dibujarlas).
export function crearChorro() {
  return { gotas: [], pendiente: 0, salpicaduras: [] };
}

// Fracción (0..1) del segmento a→b donde entra al círculo de centro c y radio r, o null si no lo toca.
export function entradaEnCirculo(ax, az, bx, bz, cx, cz, r) {
  const fx = ax - cx;
  const fz = az - cz;
  const c = fx * fx + fz * fz - r * r;
  if (c <= 0) return 0;

  const ex = bx - ax;
  const ez = bz - az;
  const a = ex * ex + ez * ez;
  if (a === 0) return null;
  const b = 2 * (fx * ex + fz * ez);
  const discriminante = b * b - 4 * a * c;
  if (discriminante < 0) return null;

  const t = (-b - Math.sqrt(discriminante)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

// Mueve la gota `distancia` metros. Devuelve false si toca un objetivo o agota su alcance.
// Si toca uno, anota el impacto y el punto donde pegó.
function avanzar(gota, distancia, objetivos, ancho, alcance, impactos, salpicaduras) {
  const destinoX = gota.x + gota.dx * distancia;
  const destinoZ = gota.z + gota.dz * distancia;

  let primero = null;
  let tPrimero = Infinity;
  for (const objetivo of objetivos) {
    const t = entradaEnCirculo(gota.x, gota.z, destinoX, destinoZ, objetivo.x, objetivo.z, objetivo.radio + ancho);
    if (t !== null && t < tPrimero) {
      primero = objetivo;
      tPrimero = t;
    }
  }
  if (primero) {
    impactos.set(primero.id, (impactos.get(primero.id) ?? 0) + 1);
    salpicaduras.push({ x: gota.x + gota.dx * distancia * tPrimero, z: gota.z + gota.dz * distancia * tPrimero });
    return false;
  }

  gota.x = destinoX;
  gota.z = destinoZ;
  gota.recorrido += distancia;
  return gota.recorrido < alcance;
}

// Avanza el chorro un paso de dt segundos y devuelve cuántas gotas le pegaron a cada objetivo
// en este paso (Map de id → gotas). Cada gota equivale a 1/cadencia segundos de chorro.
// `origen` es de donde sale el agua y `angulo` la dirección de disparo (de +x hacia +z).
// `caudal` (0 a 1) reduce cuántas gotas salen, p. ej. cuando la manguera se queda sin presión.
// `objetivos` es una lista de { id, x, z, radio }.
export function actualizarChorro(chorro, { disparando, origen, angulo, caudal = 1 }, objetivos, config, dt) {
  const { velocidad, alcance, cadencia, ancho } = config;
  const impactos = new Map();
  const salpicaduras = [];
  chorro.salpicaduras = salpicaduras;

  chorro.gotas = chorro.gotas.filter((gota) =>
    avanzar(gota, Math.min(velocidad * dt, alcance - gota.recorrido), objetivos, ancho, alcance, impactos, salpicaduras),
  );

  const ritmo = cadencia * caudal;
  if (!disparando || ritmo <= 0) {
    chorro.pendiente = 0;
    return impactos;
  }

  const dx = Math.cos(angulo);
  const dz = Math.sin(angulo);
  chorro.pendiente += ritmo * dt;
  while (chorro.pendiente >= 1) {
    chorro.pendiente -= 1;
    // Las gotas que tocaba emitir dentro de este paso ya llevan un rato volando.
    const edad = chorro.pendiente / ritmo;
    const gota = { x: origen.x, z: origen.z, dx, dz, recorrido: 0 };
    if (avanzar(gota, Math.min(velocidad * edad, alcance), objetivos, ancho, alcance, impactos, salpicaduras)) {
      chorro.gotas.push(gota);
    }
  }
  return impactos;
}
