import './estilos.css';
import config from './data/config.json';
import { crearEscena } from './core/escena.js';
import { ajustarCamara, crearCamara } from './core/camara.js';
import { crearInput } from './core/input.js';
import { crearPozo } from './entities/pozo.js';
import { crearJugador } from './entities/jugador.js';
import { actualizarApuntado, crearApuntado } from './systems/apuntado.js';

// El pozo está siempre en el centro del mapa.
const CENTRO_POZO = { x: 0, z: 0 };

const contenedor = document.getElementById('juego');
const { renderer, escena } = crearEscena(contenedor, config.mapa);
const camara = crearCamara(config.camara);
const input = crearInput(renderer.domElement, camara);

const pozo = crearPozo(config.pozo);
const jugador = crearJugador(pozo, config.avatar);
escena.add(pozo.grupo, jugador.grupo);

// Estado lógico (sin Three.js).
const apuntado = crearApuntado();

function redimensionar() {
  const { clientWidth: ancho, clientHeight: alto } = contenedor;
  renderer.setSize(ancho, alto);
  ajustarCamara(camara, config.mapa, config.camara.margen, ancho / alto);
}
window.addEventListener('resize', redimensionar);
redimensionar();

let tiempoAnterior = performance.now();

function cuadro(tiempo) {
  // Se limita dt para que volver de otra pestaña no produzca un salto enorme.
  const dt = Math.min(Math.max((tiempo - tiempoAnterior) / 1000, 0), config.juego.dtMaximo);
  tiempoAnterior = tiempo;

  actualizarApuntado(apuntado, CENTRO_POZO, input.puntoEnSuelo(), config.avatar.velocidadGiro, dt);

  jugador.sincronizar(apuntado);
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
