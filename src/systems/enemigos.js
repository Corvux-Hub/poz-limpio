// Lógica pura de los enemigos: sin Three.js, todo en el plano del suelo (x, z), con el pozo en el origen.
import { aplicarAgua } from './limpieza.js';

export const ESTADOS = {
  AVANZANDO: 'avanzando',
  EN_POZO: 'en_pozo',
  LIMPIO: 'limpio',
  RETIRANDOSE: 'retirandose',
  FUERA: 'fuera',
};

// `arma` (de armas.json) es opcional: suma alcance de ataque y multiplica la contaminación de cada golpe.
export function crearEnemigo(id, tipo, { x, z }, radioBase, arma = null) {
  return {
    id,
    tipo,
    arma,
    x,
    z,
    radio: radioBase * tipo.tamano,
    alcance: tipo.alcance + (arma?.alcanceExtra ?? 0),
    contaminacion: tipo.contaminacion * (arma?.multiplicadorContaminacion ?? 1),
    exposicion: 0,
    // Segundos desde la última gota que le pegó.
    sinAgua: Infinity,
    estado: ESTADOS.AVANZANDO,
    espera: 0,
    // Segundos desde su último golpe al pozo (para animarlo); Infinity si aún no golpea.
    tiempoDesdeGolpe: Infinity,
  };
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

// Punto al azar sobre un lado del mapa: 'arriba', 'abajo', 'izquierda', 'derecha' o 'cualquiera'.
// Arriba es el borde lejano de la cámara (z negativo).
export function puntoEnZona(mapa, zona, aleatorio) {
  const { ancho, alto } = mapa;
  switch (zona) {
    case 'arriba':
      return { x: (aleatorio() - 0.5) * ancho, z: -alto / 2 };
    case 'abajo':
      return { x: (aleatorio() - 0.5) * ancho, z: alto / 2 };
    case 'izquierda':
      return { x: -ancho / 2, z: (aleatorio() - 0.5) * alto };
    case 'derecha':
      return { x: ancho / 2, z: (aleatorio() - 0.5) * alto };
    case 'cualquiera':
      return puntoEnBorde(mapa, aleatorio);
    default:
      throw new Error(`Zona de aparición desconocida: "${zona}"`);
  }
}

// Separa a los enemigos sucios que se enciman. El que ya está frente al pozo no se deja empujar:
// el otro se hace a un lado (o se queda detrás, haciendo fila).
export function separarEnemigos(enemigos) {
  const activos = enemigos.filter(esObjetivo);
  for (let i = 0; i < activos.length; i++) {
    for (let j = i + 1; j < activos.length; j++) {
      const a = activos[i];
      const b = activos[j];
      const distancia = Math.hypot(b.x - a.x, b.z - a.z);
      const solape = a.radio + b.radio - distancia;
      if (solape <= 0) continue;
      // Si están exactamente en el mismo punto, cualquier dirección sirve.
      const nx = distancia > 0 ? (b.x - a.x) / distancia : 1;
      const nz = distancia > 0 ? (b.z - a.z) / distancia : 0;
      const fijoA = a.estado === ESTADOS.EN_POZO;
      const fijoB = b.estado === ESTADOS.EN_POZO;
      const parteA = fijoA === fijoB ? 0.5 : fijoA ? 0 : 1;
      a.x -= nx * solape * parteA;
      a.z -= nz * solape * parteA;
      b.x += nx * solape * (1 - parteA);
      b.z += nz * solape * (1 - parteA);
    }
  }
}

function avanzarHaciaElPozo(enemigo, radioPozo, dt) {
  const distancia = Math.hypot(enemigo.x, enemigo.z);
  // Se detiene cuando el brocal queda a su alcance de ataque.
  const parada = radioPozo + enemigo.radio + enemigo.alcance;
  const paso = Math.min(enemigo.tipo.velocidad * dt, distancia - parada);
  if (paso > 0) {
    enemigo.x -= (enemigo.x / distancia) * paso;
    enemigo.z -= (enemigo.z / distancia) * paso;
  }
  if (distancia - Math.max(paso, 0) <= parada) {
    enemigo.estado = ESTADOS.EN_POZO;
    enemigo.espera = enemigo.tipo.intervaloGolpe;
  }
}

// Golpea el pozo cada `intervaloGolpe` segundos. Devuelve la contaminación (%) que causó en este paso.
function golpearElPozo(enemigo, dt) {
  enemigo.espera -= dt;
  enemigo.tiempoDesdeGolpe += dt;
  let contaminacion = 0;
  while (enemigo.espera <= 0) {
    contaminacion += enemigo.contaminacion;
    enemigo.espera += enemigo.tipo.intervaloGolpe;
    enemigo.tiempoDesdeGolpe = enemigo.tipo.intervaloGolpe - enemigo.espera;
  }
  return contaminacion;
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

// Avanza un enemigo dt segundos con los `segundosDeAgua` de chorro que recibió en este paso.
// Devuelve la contaminación (%) que le causó al pozo.
// `entorno` trae radioPozo, potencia, regeneracion, gracia, pausaAlLimpiarse, mapa y margenSalida.
export function actualizarEnemigo(enemigo, segundosDeAgua, entorno, dt) {
  if (esObjetivo(enemigo) && aplicarAgua(enemigo, segundosDeAgua, entorno, dt)) {
    // Queda limpio: se detiene un momento y después se retira.
    enemigo.estado = ESTADOS.LIMPIO;
    enemigo.espera = entorno.pausaAlLimpiarse;
    return 0;
  }

  switch (enemigo.estado) {
    case ESTADOS.AVANZANDO:
      avanzarHaciaElPozo(enemigo, entorno.radioPozo, dt);
      break;
    case ESTADOS.EN_POZO:
      return golpearElPozo(enemigo, dt);
    case ESTADOS.LIMPIO:
      enemigo.espera -= dt;
      if (enemigo.espera <= 0) enemigo.estado = ESTADOS.RETIRANDOSE;
      break;
    case ESTADOS.RETIRANDOSE:
      alejarseDelPozo(enemigo, entorno, dt);
      break;
  }
  return 0;
}
