// Lógica pura de la contaminación del pozo, en porcentaje: 0 = limpio, 100 = derrota.
const MAXIMA = 100;

export function crearContaminacion() {
  return { porcentaje: 0 };
}

export function contaminar(contaminacion, cantidad) {
  contaminacion.porcentaje = Math.min(MAXIMA, contaminacion.porcentaje + cantidad);
}

export function estaPerdido(contaminacion) {
  return contaminacion.porcentaje >= MAXIMA;
}

export function purificar(contaminacion, cantidad) {
  contaminacion.porcentaje = Math.max(0, contaminacion.porcentaje - cantidad);
}
