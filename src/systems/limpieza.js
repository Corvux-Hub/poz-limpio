// Lógica pura de la limpieza: tiempo_de_limpieza = suciedad × tamaño ÷ potencia_del_chorro.
// La exposición se mide en segundos de chorro recibido: cada gota que pega aporta 1/cadencia s,
// así que limpiar no depende de cuántos cuadros por segundo dibuje el juego.

// Margen para que sumar muchas porciones pequeñas no se quede a una milésima de la meta.
const TOLERANCIA = 1e-9;

export function tiempoDeLimpieza({ suciedad, tamano }, potencia) {
  return (suciedad * tamano) / potencia;
}

// Suma `segundosDeAgua` de exposición. Si lleva más de `gracia` segundos sin agua, la pierde
// a razón de `regeneracion` (segundos de exposición por segundo). Devuelve true si ya quedó limpio.
export function aplicarAgua(enemigo, segundosDeAgua, { potencia, regeneracion, gracia }, dt) {
  if (segundosDeAgua > 0) {
    enemigo.exposicion += segundosDeAgua;
    enemigo.sinAgua = 0;
  } else {
    const antes = enemigo.sinAgua;
    enemigo.sinAgua = antes + dt;
    // Solo regenera la parte del paso que ya pasó la gracia.
    const tiempoRegenerando = antes >= gracia ? dt : Math.max(0, antes + dt - gracia);
    enemigo.exposicion = Math.max(0, enemigo.exposicion - regeneracion * tiempoRegenerando);
  }
  return enemigo.exposicion >= tiempoDeLimpieza(enemigo.tipo, potencia) - TOLERANCIA;
}

// Si le cayó agua hace poco (para el brillo azul de "mojado").
export function estaRecibiendoAgua(enemigo, gracia) {
  return enemigo.sinAgua <= gracia;
}

// Fracción de limpieza (0 = sucio, 1 = limpio), para aclarar su color.
export function progresoDeLimpieza(enemigo, potencia) {
  return Math.min(enemigo.exposicion / tiempoDeLimpieza(enemigo.tipo, potencia), 1);
}
