// Lógica pura de los enemigos: sin Three.js, todo en el plano del suelo (x, z), con el pozo en el origen.
import { aplicarAgua } from './limpieza.js';

export const ESTADOS = {
  AVANZANDO: 'avanzando',
  EN_POZO: 'en_pozo',
  LIMPIO: 'limpio',
  RETIRANDOSE: 'retirandose',
  FUERA: 'fuera',
};

export function crearEnemigo(id, tipo, { x, z }, radioBase) {
  return { id, tipo, x, z, radio: radioBase * tipo.tamano, exposicion: 0, estado: ESTADOS.AVANZANDO, espera: 0 };
}

// Mientras siga sucio, el chorro lo puede tocar.
export function esObjetivo(enemigo) {
  return enemigo.estado === ESTADOS.AVANZANDO || enemigo.estado === ESTADOS.EN_POZO;
}

// Punto al azar sobre el borde del mapa (rectángulo centrado en el pozo).
export function puntoEnBorde({ ancho, alto }, aleatorio) {
  let t = aleatorio() * 2 * (ancho + alto);
  if (t < ancho) return { x: t - ancho / 2, z: -alto / 2 };
  t -= ancho;
  if (t < alto) return { x: ancho / 2, z: t - alto / 2 };
  t -= alto;
  if (t < ancho) return { x: ancho / 2 - t, z: alto / 2 };
  t -= ancho;
  return { x: -ancho / 2, z: alto / 2 - t };
}

function avanzarHaciaElPozo(enemigo, radioPozo, dt) {
  const distancia = Math.hypot(enemigo.x, enemigo.z);
  // Se detiene cuando el brocal queda a su alcance de ataque.
  const parada = radioPozo + enemigo.radio + enemigo.tipo.alcance;
  const paso = Math.min(enemigo.tipo.velocidad * dt, distancia - parada);
  if (paso > 0) {
    enemigo.x -= (enemigo.x / distancia) * paso;
    enemigo.z -= (enemigo.z / distancia) * paso;
  }
  if (distancia - Math.max(paso, 0) <= parada) enemigo.estado = ESTADOS.EN_POZO;
}

function alejarseDelPozo(enemigo, { mapa, margenSalida }, dt) {
  const distancia = Math.hypot(enemigo.x, enemigo.z) || 1;
  const paso = enemigo.tipo.velocidad * dt;
  enemigo.x += (enemigo.x / distancia) * paso;
  enemigo.z += (enemigo.z / distancia) * paso;
  if (Math.abs(enemigo.x) > mapa.ancho / 2 + margenSalida || Math.abs(enemigo.z) > mapa.alto / 2 + margenSalida) {
    enemigo.estado = ESTADOS.FUERA;
  }
}

// Avanza un enemigo dt segundos. `entorno` trae radioPozo, potencia, regeneracion,
// pausaAlLimpiarse, mapa y margenSalida.
export function actualizarEnemigo(enemigo, recibeAgua, entorno, dt) {
  if (esObjetivo(enemigo) && aplicarAgua(enemigo, recibeAgua, entorno, dt)) {
    // Queda limpio: se detiene un momento y después se retira.
    enemigo.estado = ESTADOS.LIMPIO;
    enemigo.espera = entorno.pausaAlLimpiarse;
    return;
  }

  switch (enemigo.estado) {
    case ESTADOS.AVANZANDO:
      avanzarHaciaElPozo(enemigo, entorno.radioPozo, dt);
      break;
    case ESTADOS.LIMPIO:
      enemigo.espera -= dt;
      if (enemigo.espera <= 0) enemigo.estado = ESTADOS.RETIRANDOSE;
      break;
    case ESTADOS.RETIRANDOSE:
      alejarseDelPozo(enemigo, entorno, dt);
      break;
  }
}
