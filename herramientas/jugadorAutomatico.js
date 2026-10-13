// Jugador automático para medir el balance. Imita a un jugador humano decente, no a uno perfecto:
// - Se concentra en un enemigo hasta limpiarlo mientras lo tenga a su alcance.
// - Si no, elige al más urgente: el que ya golpea el pozo o el que llegará antes.
// - Cada vez que cambia de objetivo tarda `reaccion` segundos en volver a disparar (apuntar y reflejos).
// - Solo dispara si el objetivo está al alcance del agua.
import { ESTADOS, esObjetivo } from '../src/systems/enemigos.js';
import { distanciaSalidaAgua } from '../src/core/partida.js';

// Segundos que le faltan para empezar a golpear el pozo (0 si ya lo golpea).
function segundosParaLlegar(enemigo, radioPozo) {
  if (enemigo.estado === ESTADOS.EN_POZO) return 0;
  const parada = radioPozo + enemigo.radio + enemigo.alcance;
  return (Math.hypot(enemigo.x, enemigo.z) - parada) / enemigo.tipo.velocidad;
}

export function crearJugadorAutomatico({ reaccion }) {
  let objetivoId = null;
  let espera = 0;

  return function decidir(partida, { config }, dt) {
    const alcanceAgua = distanciaSalidaAgua(config) + partida.ajustes.chorro.alcance;
    const aAlcance = (enemigo) => Math.hypot(enemigo.x, enemigo.z) - enemigo.radio <= alcanceAgua;
    const sucios = partida.enemigos.filter(esObjetivo);

    let elegido = sucios.find((enemigo) => enemigo.id === objetivoId && aAlcance(enemigo));
    if (!elegido) {
      let menor = Infinity;
      for (const enemigo of sucios) {
        const llegada = segundosParaLlegar(enemigo, config.pozo.radio);
        if (llegada < menor) {
          menor = llegada;
          elegido = enemigo;
        }
      }
    }

    const id = elegido?.id ?? null;
    if (id !== objetivoId) {
      objetivoId = id;
      espera = reaccion;
    }
    espera -= dt;
    if (!elegido) return { objetivo: null, disparando: false };
    return { objetivo: { x: elegido.x, z: elegido.z }, disparando: espera <= 0 && aAlcance(elegido) };
  };
}

// Entre oleadas: purifica si el pozo va muy sucio y luego compra lo que alcance en orden de prioridad.
export function comprarConPrioridad(partida, datos, prioridad, umbralPurificar, comprarMejora) {
  while (partida.contaminacion.porcentaje >= umbralPurificar && comprarMejora(partida, datos, 'purificacion'));
  let compro = true;
  while (compro) {
    compro = false;
    for (const id of prioridad) {
      if (datos.mejoras[id] && comprarMejora(partida, datos, id)) compro = true;
    }
  }
}
