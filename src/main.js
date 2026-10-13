import './estilos.css';
import config from './data/config.json';
import tiposDeEnemigo from './data/enemies.json';
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
import { ESTADOS, actualizarEnemigo, crearEnemigo, esObjetivo, puntoEnBorde } from './systems/enemigos.js';
import { progresoDeLimpieza } from './systems/limpieza.js';
import { contaminar, crearContaminacion, estaPerdido } from './systems/contaminacion.js';

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
    esperaReaparicion: 0,
    limpiados: 0,
  };
}

function reiniciar() {
  partida = nuevaPartida();
  hud.ocultarDerrota();
}

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

// Hasta el hito 5: un solo enemigo a la vez; cuando se va, aparece otro en el borde del mapa.
function actualizarEnemigoDePrueba(dt) {
  if (partida.enemigos.length > 0) return;
  partida.esperaReaparicion -= dt;
  if (partida.esperaReaparicion > 0) return;
  const tipo = tiposDeEnemigo[config.enemigoDePrueba.tipo];
  const punto = puntoEnBorde(config.mapa, Math.random);
  partida.enemigos.push(crearEnemigo(siguienteId++, tipo, punto, config.enemigos.radioBase));
  partida.esperaReaparicion = config.enemigoDePrueba.reaparicion;
}

// Avanza la partida dt segundos y devuelve los ids de los enemigos que recibieron agua.
function actualizarPartida(dt) {
  actualizarEnemigoDePrueba(dt);
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
  partida.enemigos = partida.enemigos.filter((enemigo) => enemigo.estado !== ESTADOS.FUERA);

  if (estaPerdido(partida.contaminacion)) {
    partida.estado = 'derrota';
    hud.mostrarDerrota(partida.limpiados, reiniciar);
  }
  return tocados;
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

  // Lógica: tras la derrota todo queda congelado detrás de la pantalla final.
  const jugando = partida.estado === 'jugando';
  const tocados = jugando ? actualizarPartida(dt) : SIN_TOCADOS;
  const dtVisual = jugando ? dt : 0;

  // Render.
  jugador.sincronizar(apuntado);
  pozo.sincronizar(partida.contaminacion.porcentaje);
  chorroVisual.sincronizar(partida.chorro);
  sincronizarEnemigos(tocados, dtVisual);
  hud.actualizarContaminacion(partida.contaminacion.porcentaje);
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
