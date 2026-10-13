// Lógica pura de una partida completa (sin Three.js ni DOM): une oleadas, apuntado, chorro,
// enemigos, contaminación y mejoras. La usan main.js (con el ratón) y la herramienta de balance
// (con un jugador automático), así los dos juegan con exactamente las mismas reglas.
//
// `datos` agrupa los JSON de src/data: { config, tipos, armas, oleadas, mejoras }.
import { actualizarApuntado, crearApuntado, puntoEnDireccion } from '../systems/apuntado.js';
import { actualizarChorro, crearChorro } from '../systems/chorro.js';
import {
  ESTADOS,
  actualizarEnemigo,
  crearEnemigo,
  esObjetivo,
  puntoEnZona,
  separarEnemigos,
} from '../systems/enemigos.js';
import { contaminar, crearContaminacion, estaPerdido } from '../systems/contaminacion.js';
import { FASES, actualizarOleadas, continuarOleadas, crearOleadas } from '../systems/oleadas.js';
import { aplicarMejoras, comprar, crearMejoras } from '../systems/mejoras.js';
import { actualizarPresion, crearPresion } from '../systems/presion.js';

// El pozo está siempre en el centro del mapa.
export const CENTRO_POZO = { x: 0, z: 0 };

// Distancia del eje del pozo a la que sale el agua: el cuerpo del avatar, pegado al brocal.
export function distanciaSalidaAgua(config) {
  return config.pozo.radio + config.avatar.distanciaAlBrocal;
}

// Parámetros vigentes: los de config.json con las mejoras compradas aplicadas.
function ajustesVigentes({ config, mejoras: catalogo }, mejoras) {
  return aplicarMejoras({ chorro: config.chorro, pozo: config.pozo, presion: config.presion }, mejoras, catalogo);
}

export function crearPartida(datos) {
  const mejoras = crearMejoras();
  return {
    apuntado: crearApuntado(),
    chorro: crearChorro(),
    presion: crearPresion(datos.config.presion.reserva),
    enemigos: [],
    // Golpes al pozo del último paso: { x, z, contaminacion } de quien golpeó (para sonido y efectos).
    golpes: [],
    contaminacion: crearContaminacion(),
    oleadas: crearOleadas(datos.config.oleadas.esperaInicial),
    limpiados: 0,
    agua: 0,
    mejoras,
    ajustes: ajustesVigentes(datos, mejoras),
    siguienteId: 0,
  };
}

// El arma del grupo de la oleada manda sobre la del tipo; "ninguna" la quita.
function armaDe(pedido, tipo, armas) {
  const id = pedido.arma ?? tipo.arma;
  if (!id || id === 'ninguna') return null;
  if (!armas[id]) throw new Error(`Arma desconocida: "${id}"`);
  return armas[id];
}

// Hace aparecer los enemigos que pide la oleada, un poco por fuera del borde del mapa
// (`enemigos.margenAparicion`): salen de la oscuridad en vez de surgir a la vista.
function actualizarOleada(partida, { config, tipos, armas, oleadas }, aleatorio, dt) {
  const entorno = { quedanSucios: partida.enemigos.some(esObjetivo), celebracion: config.oleadas.celebracion };
  const margen = config.enemigos.margenAparicion;
  const zonaDeAparicion = { ancho: config.mapa.ancho + margen * 2, alto: config.mapa.alto + margen * 2 };
  for (const pedido of actualizarOleadas(partida.oleadas, oleadas, entorno, aleatorio, dt)) {
    const tipo = tipos[pedido.tipo];
    if (!tipo) throw new Error(`Tipo de enemigo desconocido en waves.json: "${pedido.tipo}"`);
    const punto = puntoEnZona(zonaDeAparicion, pedido.zona, aleatorio);
    const arma = armaDe(pedido, tipo, armas);
    partida.enemigos.push(crearEnemigo(partida.siguienteId++, tipo, punto, config.enemigos.radioBase, arma));
  }
}

// Avanza la partida dt segundos con lo que hace el jugador: `objetivo` es el punto { x, z } al que
// apunta (o null si el cursor no está en el juego) y `disparando` si mantiene el clic.
// Devuelve los enemigos que quedaron limpios en este paso.
export function avanzarPartida(partida, datos, { objetivo, disparando }, dt, aleatorio = Math.random) {
  const { config } = datos;
  const { ajustes } = partida;
  actualizarOleada(partida, datos, aleatorio, dt);
  actualizarApuntado(partida.apuntado, CENTRO_POZO, objetivo, config.avatar.velocidadGiro, dt);
  const disparo = {
    disparando,
    origen: puntoEnDireccion(CENTRO_POZO, partida.apuntado.angulo, distanciaSalidaAgua(config)),
    angulo: partida.apuntado.angulo,
    caudal: actualizarPresion(partida.presion, disparando, ajustes.presion, dt),
  };
  const impactos = actualizarChorro(partida.chorro, disparo, partida.enemigos.filter(esObjetivo), ajustes.chorro, dt);

  const entorno = {
    radioPozo: config.pozo.radio,
    potencia: ajustes.chorro.potencia,
    regeneracion: config.limpieza.regeneracion,
    gracia: config.limpieza.gracia,
    pausaAlLimpiarse: config.enemigos.pausaAlLimpiarse,
    mapa: config.mapa,
    margenSalida: config.enemigos.margenSalida,
  };
  const limpiados = [];
  partida.golpes = [];
  for (const enemigo of partida.enemigos) {
    const estabaSucio = esObjetivo(enemigo);
    // Cada gota que le pegó equivale a 1/cadencia segundos de chorro.
    const segundosDeAgua = (impactos.get(enemigo.id) ?? 0) / ajustes.chorro.cadencia;
    const contaminacion = actualizarEnemigo(enemigo, segundosDeAgua, entorno, dt) * ajustes.pozo.factorContaminacion;
    if (contaminacion > 0) {
      contaminar(partida.contaminacion, contaminacion);
      partida.golpes.push({ x: enemigo.x, z: enemigo.z, contaminacion });
    }
    if (estabaSucio && enemigo.estado === ESTADOS.LIMPIO) {
      partida.limpiados++;
      partida.agua += enemigo.tipo.recompensa;
      limpiados.push(enemigo);
    }
  }
  separarEnemigos(partida.enemigos);
  partida.enemigos = partida.enemigos.filter((enemigo) => enemigo.estado !== ESTADOS.FUERA);
  return limpiados;
}

export function perdio(partida) {
  return estaPerdido(partida.contaminacion);
}

// Superó una oleada y espera a que el jugador elija mejoras.
export function esperaMejoras(partida) {
  return partida.oleadas.fase === FASES.ESPERANDO;
}

// Compra una mejora y recalcula los parámetros vigentes. Devuelve true si se compró.
export function comprarMejora(partida, datos, id) {
  if (!comprar(id, partida, datos.mejoras)) return false;
  partida.ajustes = ajustesVigentes(datos, partida.mejoras);
  return true;
}

// Cierra el menú de mejoras: arranca la cuenta regresiva de la siguiente oleada.
export function seguirConLaSiguienteOleada(partida, datos) {
  continuarOleadas(partida.oleadas, datos.config.oleadas.descanso);
}
