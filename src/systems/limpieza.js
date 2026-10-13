// Lógica pura de la limpieza: tiempo_de_limpieza = suciedad × tamaño ÷ potencia_del_chorro.
// La exposición se mide en segundos de agua recibida.

// Margen para que sumar muchos dt pequeños no se quede a una milésima de la meta.
const TOLERANCIA = 1e-9;

export function tiempoDeLimpieza({ suciedad, tamano }, potencia) {
  return (suciedad * tamano) / potencia;
}

// Suma exposición mientras recibe agua; sin agua la pierde a razón de `regeneracion`
// (segundos de exposición por segundo). Devuelve true si ya quedó limpio.
export function aplicarAgua(enemigo, recibeAgua, { potencia, regeneracion }, dt) {
  if (recibeAgua) enemigo.exposicion += dt;
  else enemigo.exposicion = Math.max(0, enemigo.exposicion - regeneracion * dt);
  return enemigo.exposicion >= tiempoDeLimpieza(enemigo.tipo, potencia) - TOLERANCIA;
}

// Fracción de limpieza (0 = sucio, 1 = limpio), para aclarar su color.
export function progresoDeLimpieza(enemigo, potencia) {
  return Math.min(enemigo.exposicion / tiempoDeLimpieza(enemigo.tipo, potencia), 1);
}
