import './estilos.css';
import config from './data/config.json';
import { crearEscena } from './core/escena.js';
import { ajustarCamara, crearCamara } from './core/camara.js';
import { crearInput } from './core/input.js';
import { crearPozo } from './entities/pozo.js';
import { crearJugador } from './entities/jugador.js';
import { crearChorroVisual } from './entities/chorro.js';
import { crearDiana } from './entities/diana.js';
import { actualizarApuntado, crearApuntado, puntoEnDireccion } from './systems/apuntado.js';
import { actualizarChorro, crearChorro } from './systems/chorro.js';

// El pozo está siempre en el centro del mapa.
const CENTRO_POZO = { x: 0, z: 0 };

const contenedor = document.getElementById('juego');
const { renderer, escena } = crearEscena(contenedor, config.mapa);
const camara = crearCamara(config.camara);
const input = crearInput(renderer.domElement, camara, config.apuntado.alturaPlano);

const pozo = crearPozo(config.pozo);
const jugador = crearJugador(pozo, config.avatar);
const chorroVisual = crearChorroVisual(config.chorro, jugador.alturaPunta);
escena.add(pozo.grupo, jugador.grupo, chorroVisual.grupo);

// Estado lógico (sin Three.js).
const apuntado = crearApuntado();
const chorro = crearChorro();
const dianas = config.dianasDePrueba.posiciones.map(([x, z], i) => ({
  id: i,
  x,
  z,
  radio: config.dianasDePrueba.radio,
}));

const dianasVisuales = dianas.map((diana) => crearDiana(diana, diana.radio));
for (const diana of dianasVisuales) escena.add(diana.grupo);

function redimensionar() {
  const { clientWidth: ancho, clientHeight: alto } = contenedor;
  renderer.setSize(ancho, alto);
  ajustarCamara(camara, config.mapa, config.camara, ancho / alto);
}
window.addEventListener('resize', redimensionar);
redimensionar();

let tiempoAnterior = performance.now();

function cuadro(tiempo) {
  // Se limita dt para que volver de otra pestaña no produzca un salto enorme.
  const dt = Math.min(Math.max((tiempo - tiempoAnterior) / 1000, 0), config.juego.dtMaximo);
  tiempoAnterior = tiempo;

  actualizarApuntado(apuntado, CENTRO_POZO, input.puntoApuntado(), config.avatar.velocidadGiro, dt);
  const disparo = {
    disparando: input.disparando(),
    origen: puntoEnDireccion(CENTRO_POZO, apuntado.angulo, jugador.distanciaPunta),
    angulo: apuntado.angulo,
  };
  const tocados = actualizarChorro(chorro, disparo, dianas, config.chorro, dt);

  jugador.sincronizar(apuntado);
  chorroVisual.sincronizar(chorro);
  dianasVisuales.forEach((visual, i) => visual.actualizar(tocados.has(dianas[i].id), dt));
  renderer.render(escena, camara);
}

renderer.setAnimationLoop(cuadro);
