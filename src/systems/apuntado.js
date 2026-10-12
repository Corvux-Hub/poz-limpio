// Lógica pura del apuntado: sin Three.js, todo en el plano del suelo (x, z).
// El ángulo se mide desde +x hacia +z, en radianes, normalizado a (-π, π].

const VUELTA = Math.PI * 2;

export function normalizarAngulo(angulo) {
  let a = angulo % VUELTA;
  if (a > Math.PI) a -= VUELTA;
  if (a <= -Math.PI) a += VUELTA;
  return a;
}

// Giro más corto para ir de `desde` a `hasta`, en (-π, π].
export function diferenciaAngular(desde, hasta) {
  return normalizarAngulo(hasta - desde);
}

export function crearApuntado(anguloInicial = 0) {
  return { angulo: normalizarAngulo(anguloInicial) };
}

// Gira hacia el objetivo sin superar `velocidadGiro` (rad/s).
// Si no hay objetivo o cae justo sobre el origen, conserva el ángulo actual.
export function actualizarApuntado(apuntado, origen, objetivo, velocidadGiro, dt) {
  if (!objetivo) return;
  const dx = objetivo.x - origen.x;
  const dz = objetivo.z - origen.z;
  if (dx === 0 && dz === 0) return;

  const diferencia = diferenciaAngular(apuntado.angulo, Math.atan2(dz, dx));
  const pasoMaximo = velocidadGiro * dt;
  const paso = Math.max(-pasoMaximo, Math.min(pasoMaximo, diferencia));
  apuntado.angulo = normalizarAngulo(apuntado.angulo + paso);
}
