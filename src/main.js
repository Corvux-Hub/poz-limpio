import './estilos.css';
import config from './data/config.json';
import tiposDeEnemigo from './data/enemies.json';
import datosOleadas from './data/waves.json';
import catalogoMejoras from './data/upgrades.json';
import armas from './data/armas.json';
import { crearEscena } from './core/escena.js';
import { ajustarCamara, crearCamara } from './core/camara.js';
import { crearInput } from './core/input.js';
import { crearPozo } from './entities/pozo.js';
import { crearJugador } from './entities/jugador.js';
import { crearChorroVisual } from './entities/chorro.js';
import { crearEnemigoVisual } from './entities/enemigo.js';
import { crearHud } from './ui/hud.js';
import { crearMenuMejoras } from './ui/mejoras.js';
import { crearEtiquetasFlotantes } from './ui/etiquetas.js';
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
import { estaRecibiendoAgua, progresoDeLimpieza } from './systems/limpieza.js';
import { contaminar, crearContaminacion, estaPerdido } from './systems/contaminacion.js';
import { FASES, actualizarOleadas, continuarOleadas, crearOleadas, porAparecer } from './systems/oleadas.js';
import { aplicarMejoras, comprar, crearMejoras, estadoDeMejora } from './systems/mejoras.js';

// El pozo está siempre en el centro del mapa.
const CENTRO_POZO = { x: 0, z: 0 };
// Altura (m) desde la que sube el "+N" de agua limpia al limpiar a alguien.
const ALTURA_RECOMPENSA = 2.3;

const contenedor = document.getElementById('juego');
const { renderer, escena } = crearEscena(contenedor, config.mapa);
const camara = crearCamara(config.camara);
const input = crearInput(renderer.domElement, camara, config.apuntado.alturaPlano);

const pozo = crearPozo(config.pozo);
const jugador = crearJugador(pozo, config.avatar);
escena.add(pozo.grupo, jugador.grupo);
// En orden de apilado: las etiquetas quedan debajo del HUD y de las pantallas.
const etiquetas = crearEtiquetasFlotantes(document.body);
const hud = crearHud(document.body);
const menuMejoras = crearMenuMejoras(document.body, catalogoMejoras);

// Estado lógico (sin Three.js). Estados de la partida: jugando, pausa, mejoras y derrota.
const apuntado = crearApuntado();
let partida;
let siguienteId = 0;

function nuevaPartida() {
  const mejoras = crearMejoras();
  return {
    estado: 'jugando',
    chorro: crearChorro(),
    enemigos: [],
    contaminacion: crearContaminacion(),
    oleadas: crearOleadas(config.oleadas.esperaInicial),
    limpiados: 0,
    agua: 0,
    mejoras,
    // Parámetros vigentes: los de config.json con las mejoras compradas aplicadas.
    ajustes: aplicarMejoras({ chorro: config.chorro, pozo: config.pozo }, mejoras, catalogoMejoras),
  };
}

// El chorro visual depende del alcance y el ancho, así que se rehace cuando cambian.
let chorroVisual = null;
function rehacerChorroVisual() {
  if (chorroVisual) {
    escena.remove(chorroVisual.grupo);
    chorroVisual.destruir();
  }
  chorroVisual = crearChorroVisual(
    partida.ajustes.chorro,
    jugador.alturaPunta,
    jugador.distanciaPunta - jugador.distanciaCuerpo,
  );
  escena.add(chorroVisual.grupo);
}

function reiniciar() {
  partida = nuevaPartida();
  rehacerChorroVisual();
  etiquetas.limpiar();
  hud.ocultarDerrota();
  hud.ocultarPausa();
  menuMejoras.ocultar();
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

function refrescarMenuMejoras() {
  const estados = Object.keys(catalogoMejoras).map((id) => estadoDeMejora(id, partida, catalogoMejoras));
  menuMejoras.actualizar(estados, partida.agua);
}

function abrirMejoras() {
  partida.estado = 'mejoras';
  const siguiente = partida.oleadas.numero;
  menuMejoras.mostrar({ oleadaSuperada: siguiente - 1, siguiente }, comprarMejora, cerrarMejoras);
  refrescarMenuMejoras();
}

function comprarMejora(id) {
  if (!comprar(id, partida, catalogoMejoras)) return;
  partida.ajustes = aplicarMejoras({ chorro: config.chorro, pozo: config.pozo }, partida.mejoras, catalogoMejoras);
  rehacerChorroVisual();
  refrescarMenuMejoras();
}

function cerrarMejoras() {
  menuMejoras.ocultar();
  continuarOleadas(partida.oleadas, config.oleadas.descanso);
  partida.estado = 'jugando';
}

// Visual de cada enemigo vivo, por id.
const visualesEnemigos = new Map();

function redimensionar() {
  const { clientWidth: ancho, clientHeight: alto } = contenedor;
  renderer.setSize(ancho, alto);
  ajustarCamara(camara, config.mapa, config.camara, ancho / alto);
}
window.addEventListener('resize', redimensionar);
redimensionar();

// El arma del grupo de la oleada manda sobre la del tipo; "ninguna" la quita.
function armaDe(pedido, tipo) {
  const id = pedido.arma ?? tipo.arma;
  if (!id || id === 'ninguna') return null;
  if (!armas[id]) throw new Error(`Arma desconocida: "${id}"`);
  return armas[id];
}

// Hace aparecer en el borde los enemigos que pide la oleada.
function actualizarOleada(dt) {
  const entorno = { quedanSucios: partida.enemigos.some(esObjetivo), celebracion: config.oleadas.celebracion };
  for (const pedido of actualizarOleadas(partida.oleadas, datosOleadas, entorno, Math.random, dt)) {
    const tipo = tiposDeEnemigo[pedido.tipo];
    if (!tipo) throw new Error(`Tipo de enemigo desconocido en waves.json: "${pedido.tipo}"`);
    const punto = puntoEnZona(config.mapa, pedido.zona, Math.random);
    partida.enemigos.push(crearEnemigo(siguienteId++, tipo, punto, config.enemigos.radioBase, armaDe(pedido, tipo)));
  }
}

// Avanza la partida dt segundos. Devuelve los enemigos que quedaron limpios en este paso.
function actualizarPartida(dt) {
  const { ajustes } = partida;
  actualizarOleada(dt);
  actualizarApuntado(apuntado, CENTRO_POZO, input.puntoApuntado(), config.avatar.velocidadGiro, dt);
  const disparo = {
    disparando: input.disparando(),
    origen: puntoEnDireccion(CENTRO_POZO, apuntado.angulo, jugador.distanciaCuerpo),
    angulo: apuntado.angulo,
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
  for (const enemigo of partida.enemigos) {
    const estabaSucio = esObjetivo(enemigo);
    // Cada gota que le pegó equivale a 1/cadencia segundos de chorro.
    const segundosDeAgua = (impactos.get(enemigo.id) ?? 0) / ajustes.chorro.cadencia;
    const golpes = actualizarEnemigo(enemigo, segundosDeAgua, entorno, dt);
    contaminar(partida.contaminacion, golpes * ajustes.pozo.factorContaminacion);
    if (estabaSucio && enemigo.estado === ESTADOS.LIMPIO) {
      partida.limpiados++;
      partida.agua += enemigo.tipo.recompensa;
      limpiados.push(enemigo);
    }
  }
  separarEnemigos(partida.enemigos);
  partida.enemigos = partida.enemigos.filter((enemigo) => enemigo.estado !== ESTADOS.FUERA);

  if (estaPerdido(partida.contaminacion)) {
    partida.estado = 'derrota';
    hud.mostrarDerrota({ oleada: partida.oleadas.numero, limpiados: partida.limpiados }, reiniciar);
  } else if (partida.oleadas.fase === FASES.ESPERANDO) {
    abrirMejoras();
  }
  return limpiados;
}

function sincronizarHud() {
  const { oleadas, enemigos, contaminacion } = partida;
  hud.actualizarContaminacion(contaminacion.porcentaje);
  hud.actualizarAgua(partida.agua);
  hud.actualizarOleada({
    numero: oleadas.numero,
    fase: oleadas.fase,
    segundos: oleadas.espera,
    sucios: porAparecer(oleadas) + enemigos.filter(esObjetivo).length,
  });
}

function sincronizarEnemigos(dt) {
  const { enemigos } = partida;
  for (const enemigo of enemigos) {
    let visual = visualesEnemigos.get(enemigo.id);
    if (!visual) {
      visual = crearEnemigoVisual(enemigo, camara.quaternion);
      visualesEnemigos.set(enemigo.id, visual);
      escena.add(visual.grupo);
    }
    const progreso = progresoDeLimpieza(enemigo, partida.ajustes.chorro.potencia);
    visual.sincronizar(enemigo, estaRecibiendoAgua(enemigo, config.limpieza.gracia), progreso, dt);
  }
  for (const [id, visual] of visualesEnemigos) {
    if (enemigos.some((enemigo) => enemigo.id === id)) continue;
    escena.remove(visual.grupo);
    visual.destruir();
    visualesEnemigos.delete(id);
  }
}

const NINGUNO = [];
let tiempoAnterior = performance.now();
reiniciar();

function cuadro(tiempo) {
  // Se limita dt para que volver de otra pestaña no produzca un salto enorme.
  const dt = Math.min(Math.max((tiempo - tiempoAnterior) / 1000, 0), config.juego.dtMaximo);
  tiempoAnterior = tiempo;

  // Lógica: fuera de 'jugando' (pausa, mejoras, derrota) todo queda congelado detrás de la pantalla.
  const jugando = partida.estado === 'jugando';
  const limpiados = jugando ? actualizarPartida(dt) : NINGUNO;
  const dtVisual = jugando ? dt : 0;

  // Render.
  jugador.sincronizar(apuntado);
  pozo.sincronizar(partida.contaminacion.porcentaje);
  chorroVisual.sincronizar(partida.chorro);
  sincronizarEnemigos(dtVisual);
  for (const enemigo of limpiados) {
    etiquetas.agregar(`+${enemigo.tipo.recompensa}`, { x: enemigo.x, y: ALTURA_RECOMPENSA, z: enemigo.z });
  }
  etiquetas.actualizar(camara, contenedor.clientWidth, contenedor.clientHeight, dtVisual);
  sincronizarHud();
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
