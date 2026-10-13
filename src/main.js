import './estilos.css';
import config from './data/config.json';
import tiposDeEnemigo from './data/enemies.json';
import datosOleadas from './data/waves.json';
import { crearEscena } from './core/escena.js';
import { ajustarCamara, crearCamara } from './core/camara.js';
import { crearInput } from './core/input.js';
import { crearPozo } from './entities/pozo.js';
import { crearJugador } from './entities/jugador.js';
import { crearChorroVisual } from './entities/chorro.js';
import { crearEnemigoVisual } from './entities/enemigo.js';
import { crearHud } from './ui/hud.js';
import { actualizarApuntado, crearApuntado, puntoEnDireccion } from './systems/apuntado.js';
import { actualizarChorro, crearChorro } from './systems/chorro.js';
import {
  ESTADOS,
  actualizarEnemigo,
  crearEnemigo,
  esObjetivo,
  puntoEnZona,
  separarEnemigos,
} from './systems/enemigos.js';
import { progresoDeLimpieza } from './systems/limpieza.js';
import { contaminar, crearContaminacion, estaPerdido } from './systems/contaminacion.js';
import { FASES, actualizarOleadas, crearOleadas, porAparecer } from './systems/oleadas.js';

// El pozo está siempre en el centro del mapa.
const CENTRO_POZO = { x: 0, z: 0 };

const contenedor = document.getElementById('juego');
const { renderer, escena } = crearEscena(contenedor, config.mapa);
const camara = crearCamara(config.camara);
const input = crearInput(renderer.domElement, camara, config.apuntado.alturaPlano);

const pozo = crearPozo(config.pozo);
const jugador = crearJugador(pozo, config.avatar);
const chorroVisual = crearChorroVisual(
  config.chorro,
  jugador.alturaPunta,
  jugador.distanciaPunta - jugador.distanciaCuerpo,
);
escena.add(pozo.grupo, jugador.grupo, chorroVisual.grupo);
const hud = crearHud(document.body);

// Estado lógico (sin Three.js).
const apuntado = crearApuntado();
let partida;
let siguienteId = 0;

function nuevaPartida() {
  return {
    estado: 'jugando',
    chorro: crearChorro(),
    enemigos: [],
    contaminacion: crearContaminacion(),
    oleadas: crearOleadas(config.oleadas.esperaInicial),
    limpiados: 0,
  };
}

function reiniciar() {
  partida = nuevaPartida();
  hud.ocultarDerrota();
  hud.ocultarPausa();
}

function pausar() {
  if (partida.estado !== 'jugando') return;
  partida.estado = 'pausa';
  hud.mostrarPausa(reanudar);
}

function reanudar() {
  if (partida.estado !== 'pausa') return;
  partida.estado = 'jugando';
  hud.ocultarPausa();
}

input.alPedirPausa(() => (partida.estado === 'pausa' ? reanudar() : pausar()));
// Si el jugador cambia de ventana o de pestaña, la partida se pausa sola.
window.addEventListener('blur', pausar);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pausar();
});

const entornoEnemigos = {
  radioPozo: config.pozo.radio,
  potencia: config.chorro.potencia,
  regeneracion: config.limpieza.regeneracion,
  pausaAlLimpiarse: config.enemigos.pausaAlLimpiarse,
  mapa: config.mapa,
  margenSalida: config.enemigos.margenSalida,
};

// Visual de cada enemigo vivo, por id.
const visualesEnemigos = new Map();

function redimensionar() {
  const { clientWidth: ancho, clientHeight: alto } = contenedor;
  renderer.setSize(ancho, alto);
  ajustarCamara(camara, config.mapa, config.camara, ancho / alto);
}
window.addEventListener('resize', redimensionar);
redimensionar();

// Hace aparecer en el borde los enemigos que pide la oleada.
function actualizarOleada(dt) {
  const entorno = { quedanSucios: partida.enemigos.some(esObjetivo), descanso: config.oleadas.descanso };
  for (const pedido of actualizarOleadas(partida.oleadas, datosOleadas, entorno, Math.random, dt)) {
    const tipo = tiposDeEnemigo[pedido.tipo];
    if (!tipo) throw new Error(`Tipo de enemigo desconocido en waves.json: "${pedido.tipo}"`);
    const punto = puntoEnZona(config.mapa, pedido.zona, Math.random);
    partida.enemigos.push(crearEnemigo(siguienteId++, tipo, punto, config.enemigos.radioBase));
  }
}

// Avanza la partida dt segundos y devuelve los ids de los enemigos que recibieron agua.
function actualizarPartida(dt) {
  actualizarOleada(dt);
  actualizarApuntado(apuntado, CENTRO_POZO, input.puntoApuntado(), config.avatar.velocidadGiro, dt);
  const disparo = {
    disparando: input.disparando(),
    origen: puntoEnDireccion(CENTRO_POZO, apuntado.angulo, jugador.distanciaCuerpo),
    angulo: apuntado.angulo,
  };
  const tocados = actualizarChorro(partida.chorro, disparo, partida.enemigos.filter(esObjetivo), config.chorro, dt);

  for (const enemigo of partida.enemigos) {
    const estabaSucio = esObjetivo(enemigo);
    contaminar(partida.contaminacion, actualizarEnemigo(enemigo, tocados.has(enemigo.id), entornoEnemigos, dt));
    if (estabaSucio && enemigo.estado === ESTADOS.LIMPIO) partida.limpiados++;
  }
  separarEnemigos(partida.enemigos);
  partida.enemigos = partida.enemigos.filter((enemigo) => enemigo.estado !== ESTADOS.FUERA);

  if (estaPerdido(partida.contaminacion)) {
    partida.estado = 'derrota';
    hud.mostrarDerrota({ oleada: partida.oleadas.numero, limpiados: partida.limpiados }, reiniciar);
  }
  return tocados;
}

function sincronizarHud() {
  const { oleadas, enemigos, contaminacion } = partida;
  hud.actualizarContaminacion(contaminacion.porcentaje);
  hud.actualizarOleada({
    numero: oleadas.numero,
    enDescanso: oleadas.fase === FASES.DESCANSO,
    segundosParaEmpezar: oleadas.espera,
    sucios: porAparecer(oleadas) + enemigos.filter(esObjetivo).length,
  });
}

function sincronizarEnemigos(tocados, dt) {
  const { enemigos } = partida;
  for (const enemigo of enemigos) {
    let visual = visualesEnemigos.get(enemigo.id);
    if (!visual) {
      visual = crearEnemigoVisual(enemigo);
      visualesEnemigos.set(enemigo.id, visual);
      escena.add(visual.grupo);
    }
    visual.sincronizar(enemigo, tocados.has(enemigo.id), progresoDeLimpieza(enemigo, config.chorro.potencia), dt);
  }
  for (const [id, visual] of visualesEnemigos) {
    if (enemigos.some((enemigo) => enemigo.id === id)) continue;
    escena.remove(visual.grupo);
    visual.destruir();
    visualesEnemigos.delete(id);
  }
}

const SIN_TOCADOS = new Set();
let tiempoAnterior = performance.now();
reiniciar();

function cuadro(tiempo) {
  // Se limita dt para que volver de otra pestaña no produzca un salto enorme.
  const dt = Math.min(Math.max((tiempo - tiempoAnterior) / 1000, 0), config.juego.dtMaximo);
  tiempoAnterior = tiempo;

  // Lógica: en pausa o tras la derrota todo queda congelado detrás de la pantalla.
  const jugando = partida.estado === 'jugando';
  const tocados = jugando ? actualizarPartida(dt) : SIN_TOCADOS;
  const dtVisual = jugando ? dt : 0;

  // Render.
  jugador.sincronizar(apuntado);
  pozo.sincronizar(partida.contaminacion.porcentaje);
  chorroVisual.sincronizar(partida.chorro);
  sincronizarEnemigos(tocados, dtVisual);
  sincronizarHud();
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
