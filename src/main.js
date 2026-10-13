import './estilos.css';
import config from './data/config.json';
import tiposDeEnemigo from './data/enemies.json';
import datosOleadas from './data/waves.json';
import catalogoMejoras from './data/upgrades.json';
import armas from './data/armas.json';
import { crearEscena } from './core/escena.js';
import { ajustarCamara, crearCamara } from './core/camara.js';
import { crearInput } from './core/input.js';
import {
  avanzarPartida,
  comprarMejora,
  crearPartida,
  esperaMejoras,
  perdio,
  seguirConLaSiguienteOleada,
} from './core/partida.js';
import { crearEscenario } from './entities/escenario.js';
import { crearPozo } from './entities/pozo.js';
import { crearJugador } from './entities/jugador.js';
import { crearChorroVisual } from './entities/chorro.js';
import { crearEnemigoVisual } from './entities/enemigo.js';
import { crearSalpicaduras } from './entities/salpicaduras.js';
import { crearHud } from './ui/hud.js';
import { crearMenuMejoras } from './ui/mejoras.js';
import { crearEtiquetasFlotantes } from './ui/etiquetas.js';
import { esObjetivo } from './systems/enemigos.js';
import { estaRecibiendoAgua, progresoDeLimpieza } from './systems/limpieza.js';
import { porAparecer } from './systems/oleadas.js';
import { estadoDeMejora } from './systems/mejoras.js';
import { estaSinPresion } from './systems/presion.js';

const datos = { config, tipos: tiposDeEnemigo, armas, oleadas: datosOleadas, mejoras: catalogoMejoras };
// Altura (m) desde la que sube el "+N" de agua limpia al limpiar a alguien.
const ALTURA_RECOMPENSA = 2.3;

const contenedor = document.getElementById('juego');
const { renderer, escena } = crearEscena(contenedor, config.mapa);
const camara = crearCamara(config.camara);
const input = crearInput(renderer.domElement, camara, config.apuntado.alturaPlano);

// El decorado con altura queda por fuera del rectángulo donde aparecen los enemigos.
const escenario = crearEscenario({
  x: config.mapa.ancho / 2 + config.enemigos.margenAparicion,
  z: config.mapa.alto / 2 + config.enemigos.margenAparicion,
});
const pozo = crearPozo(config.pozo);
const jugador = crearJugador(pozo, config.avatar);
const salpicaduras = crearSalpicaduras();
escena.add(escenario.grupo, pozo.grupo, jugador.grupo, salpicaduras.grupo);
// En orden de apilado: las etiquetas quedan debajo del HUD y de las pantallas.
const etiquetas = crearEtiquetasFlotantes(document.body);
const hud = crearHud(document.body);
const menuMejoras = crearMenuMejoras(document.body, catalogoMejoras);

// Estado lógico (sin Three.js) y estado de la pantalla: jugando, pausa, mejoras o derrota.
let partida;
let estado;

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
  partida = crearPartida(datos);
  estado = 'jugando';
  rehacerChorroVisual();
  etiquetas.limpiar();
  salpicaduras.limpiar();
  hud.ocultarDerrota();
  hud.ocultarPausa();
  menuMejoras.ocultar();
}

function pausar() {
  if (estado !== 'jugando') return;
  estado = 'pausa';
  hud.mostrarPausa(reanudar);
}

function reanudar() {
  if (estado !== 'pausa') return;
  estado = 'jugando';
  hud.ocultarPausa();
}

input.alPedirPausa(() => (estado === 'pausa' ? reanudar() : pausar()));
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
  estado = 'mejoras';
  const siguiente = partida.oleadas.numero;
  menuMejoras.mostrar({ oleadaSuperada: siguiente - 1, siguiente }, alComprarMejora, cerrarMejoras);
  refrescarMenuMejoras();
}

function alComprarMejora(id) {
  if (!comprarMejora(partida, datos, id)) return;
  rehacerChorroVisual();
  refrescarMenuMejoras();
}

function cerrarMejoras() {
  menuMejoras.ocultar();
  seguirConLaSiguienteOleada(partida, datos);
  estado = 'jugando';
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

// Avanza la lógica y abre la pantalla que toque. Devuelve los enemigos que quedaron limpios.
function jugar(dt) {
  const entrada = { objetivo: input.puntoApuntado(), disparando: input.disparando() };
  const limpiados = avanzarPartida(partida, datos, entrada, dt);
  if (perdio(partida)) {
    estado = 'derrota';
    hud.mostrarDerrota({ oleada: partida.oleadas.numero, limpiados: partida.limpiados }, reiniciar);
  } else if (esperaMejoras(partida)) {
    abrirMejoras();
  }
  return limpiados;
}

function sincronizarHud() {
  const { oleadas, enemigos, contaminacion } = partida;
  hud.actualizarContaminacion(contaminacion.porcentaje);
  hud.actualizarPresion(partida.presion.nivel / partida.ajustes.presion.reserva, estaSinPresion(partida.presion));
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
  const jugando = estado === 'jugando';
  const limpiados = jugando ? jugar(dt) : NINGUNO;
  const dtVisual = jugando ? dt : 0;

  // Render.
  escenario.actualizar(dtVisual);
  jugador.sincronizar(partida.apuntado, jugando && input.disparando(), dtVisual);
  pozo.sincronizar(partida.contaminacion.porcentaje, dtVisual);
  chorroVisual.sincronizar(partida.chorro);
  if (jugando) salpicaduras.emitir(partida.chorro.salpicaduras);
  salpicaduras.actualizar(dtVisual);
  sincronizarEnemigos(dtVisual);
  for (const enemigo of limpiados) {
    etiquetas.agregar(`+${enemigo.tipo.recompensa}`, { x: enemigo.x, y: ALTURA_RECOMPENSA, z: enemigo.z });
  }
  etiquetas.actualizar(camara, contenedor.clientWidth, contenedor.clientHeight, dtVisual);
  sincronizarHud();
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
