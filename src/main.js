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
import { actualizarApuntado, crearApuntado, puntoEnDireccion } from './systems/apuntado.js';
import { actualizarChorro, crearChorro } from './systems/chorro.js';
import { ESTADOS, actualizarEnemigo, crearEnemigo, esObjetivo, puntoEnBorde } from './systems/enemigos.js';
import { progresoDeLimpieza } from './systems/limpieza.js';

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

// Estado lógico (sin Three.js).
const apuntado = crearApuntado();
const chorro = crearChorro();
let enemigos = [];
let siguienteId = 0;
let esperaReaparicion = 0;
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

// Hito 3: un solo enemigo a la vez; cuando se va, aparece otro en el borde del mapa.
function actualizarEnemigoDePrueba(dt) {
  if (enemigos.length > 0) return;
  esperaReaparicion -= dt;
  if (esperaReaparicion > 0) return;
  const tipo = tiposDeEnemigo[config.enemigoDePrueba.tipo];
  enemigos.push(crearEnemigo(siguienteId++, tipo, puntoEnBorde(config.mapa, Math.random), config.enemigos.radioBase));
  esperaReaparicion = config.enemigoDePrueba.reaparicion;
}

function sincronizarEnemigos(tocados, dt) {
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

let tiempoAnterior = performance.now();

function cuadro(tiempo) {
  // Se limita dt para que volver de otra pestaña no produzca un salto enorme.
  const dt = Math.min(Math.max((tiempo - tiempoAnterior) / 1000, 0), config.juego.dtMaximo);
  tiempoAnterior = tiempo;

  // Lógica.
  actualizarEnemigoDePrueba(dt);
  actualizarApuntado(apuntado, CENTRO_POZO, input.puntoApuntado(), config.avatar.velocidadGiro, dt);
  const disparo = {
    disparando: input.disparando(),
    origen: puntoEnDireccion(CENTRO_POZO, apuntado.angulo, jugador.distanciaCuerpo),
    angulo: apuntado.angulo,
  };
  const tocados = actualizarChorro(chorro, disparo, enemigos.filter(esObjetivo), config.chorro, dt);
  for (const enemigo of enemigos) actualizarEnemigo(enemigo, tocados.has(enemigo.id), entornoEnemigos, dt);
  enemigos = enemigos.filter((enemigo) => enemigo.estado !== ESTADOS.FUERA);

  // Render.
  jugador.sincronizar(apuntado);
  chorroVisual.sincronizar(chorro);
  sincronizarEnemigos(tocados, dt);
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
