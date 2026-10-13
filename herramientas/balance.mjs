// Simulador de balance: juega muchas partidas con el jugador automático usando la lógica real
// del juego (sin gráficos) y resume cómo termina cada oleada.
//
//   npm run balance
//   npm run balance -- --partidas 40 --oleadas 12 --reaccion 0.8
//
// Escenarios:
// - "sin mejoras": nunca compra nada; mide si las primeras oleadas se pueden ganar a pura puntería.
// - "con mejoras": entre oleadas purifica si hace falta y compra en orden de prioridad.
import { parseArgs } from 'node:util';
import { cargarDatos } from './datos.js';
import { crearAzar } from './azar.js';
import { comprarConPrioridad, crearJugadorAutomatico } from './jugadorAutomatico.js';
import {
  avanzarPartida,
  comprarMejora,
  crearPartida,
  esperaMejoras,
  perdio,
  seguirConLaSiguienteOleada,
} from '../src/core/partida.js';

const { values: opciones } = parseArgs({
  options: {
    partidas: { type: 'string', default: '30' },
    oleadas: { type: 'string', default: '10' },
    reaccion: { type: 'string', default: '0.6' },
    fps: { type: 'string', default: '60' },
  },
});
const PARTIDAS = Number(opciones.partidas);
const OLEADAS = Number(opciones.oleadas);
const REACCION = Number(opciones.reaccion);
const DT = 1 / Number(opciones.fps);
// Tope de tiempo por partida, por si una oleada nunca terminara.
const SEGUNDOS_MAXIMOS = 60 * 30;

const PRIORIDAD = ['potencia', 'reserva', 'alcance', 'recarga', 'ancho', 'ampliacion'];
const UMBRAL_PURIFICAR = 30;

// Juega una partida y devuelve, por cada oleada alcanzada, la contaminación al terminarla (o null si ahí perdió).
function jugarPartida(datos, semilla, conMejoras) {
  const azar = crearAzar(semilla);
  const decidir = crearJugadorAutomatico({ reaccion: REACCION });
  const partida = crearPartida(datos);
  const resultados = [];
  for (let t = 0; t < SEGUNDOS_MAXIMOS; t += DT) {
    avanzarPartida(partida, datos, decidir(partida, datos, DT), DT, azar);
    if (perdio(partida)) {
      resultados.push(null);
      break;
    }
    if (esperaMejoras(partida)) {
      resultados.push(partida.contaminacion.porcentaje);
      if (resultados.length >= OLEADAS) break;
      if (conMejoras) comprarConPrioridad(partida, datos, PRIORIDAD, UMBRAL_PURIFICAR, comprarMejora);
      seguirConLaSiguienteOleada(partida, datos);
    }
  }
  return resultados;
}

function resumir(datos, conMejoras) {
  const partidas = [];
  for (let semilla = 1; semilla <= PARTIDAS; semilla++) partidas.push(jugarPartida(datos, semilla, conMejoras));

  const filas = [];
  for (let oleada = 1; oleada <= OLEADAS; oleada++) {
    const llegaron = partidas.filter((r) => r.length >= oleada);
    if (llegaron.length === 0) break;
    const superaron = llegaron.map((r) => r[oleada - 1]).filter((c) => c !== null);
    const promedio = superaron.length ? superaron.reduce((a, b) => a + b, 0) / superaron.length : null;
    filas.push({
      oleada,
      'la superan': `${Math.round((superaron.length / PARTIDAS) * 100)} %`,
      'contaminación media al terminar': promedio === null ? '—' : `${promedio.toFixed(0)} %`,
      'peor caso': superaron.length ? `${Math.max(...superaron).toFixed(0)} %` : '—',
    });
  }
  return filas;
}

const datos = cargarDatos();
console.log(`${PARTIDAS} partidas por escenario, reacción ${REACCION} s, ${opciones.fps} FPS.`);
for (const [nombre, conMejoras] of [
  ['Sin mejoras', false],
  ['Con mejoras', true],
]) {
  console.log(`\n${nombre}:`);
  console.table(resumir(datos, conMejoras));
}
