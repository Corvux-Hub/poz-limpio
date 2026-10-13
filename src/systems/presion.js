// Lógica pura de la presión de la manguera.
// La reserva se mide en segundos de chorro a plena presión: disparar gasta 1 s por segundo.
// Tras `retrasoRecarga` segundos sin disparar se recarga a razón de `recarga` segundos por segundo.
// Sin reserva el agua sigue saliendo, pero solo al `caudalSinPresion` del caudal normal.

// Lo que quede por debajo de esto cuenta como vacío (restar muchos dt deja residuos minúsculos).
const TOLERANCIA = 1e-9;

export function crearPresion(reserva) {
  return { nivel: reserva, sinDisparar: 0 };
}

export function estaSinPresion(presion) {
  return presion.nivel <= 0;
}

// Avanza dt segundos y devuelve el caudal (0 a 1) con el que sale el agua en este paso.
export function actualizarPresion(presion, disparando, { reserva, recarga, retrasoRecarga, caudalSinPresion }, dt) {
  if (disparando) {
    presion.sinDisparar = 0;
    if (dt <= 0) return estaSinPresion(presion) ? caudalSinPresion : 1;
    const aPlenaPresion = Math.min(dt, presion.nivel);
    presion.nivel -= aPlenaPresion;
    if (presion.nivel < TOLERANCIA) presion.nivel = 0;
    // Si se vacía a mitad del paso, el resto del paso sale con el caudal reducido.
    return (aPlenaPresion + (dt - aPlenaPresion) * caudalSinPresion) / dt;
  }

  const antes = presion.sinDisparar;
  presion.sinDisparar = antes + dt;
  // Solo recarga la parte del paso que ya pasó el retraso.
  const tiempoRecargando = antes >= retrasoRecarga ? dt : Math.max(0, antes + dt - retrasoRecarga);
  presion.nivel = Math.min(reserva, presion.nivel + recarga * tiempoRecargando);
  return 0;
}
