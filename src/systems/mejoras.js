// Lógica pura de las mejoras que se compran entre oleadas con agua limpia.
// Hay dos clases en upgrades.json:
// - Por niveles: cambian un parámetro (`parametro`, p. ej. "chorro.potencia") al valor de cada nivel.
// - Consumibles: se compran varias veces, cada vez más caras (`costo` + `incrementoCosto` por compra).
//   Por ahora el único efecto consumible es `purifica` (baja la contaminación del pozo).
import { purificar } from './contaminacion.js';

export const MOTIVOS = { MAXIMO: 'maximo', SIN_AGUA: 'sin_agua', POZO_LIMPIO: 'pozo_limpio' };

export function crearMejoras() {
  return { niveles: {}, compras: {} };
}

function nivelDe(mejoras, id) {
  return mejoras.niveles[id] ?? 0;
}

function comprasDe(mejoras, id) {
  return mejoras.compras[id] ?? 0;
}

// Costo de la siguiente compra, o null si ya está al máximo.
export function costoDe(id, mejoras, catalogo) {
  const mejora = catalogo[id];
  if (mejora.niveles) {
    const nivel = nivelDe(mejoras, id);
    return nivel < mejora.niveles.length ? mejora.niveles[nivel].costo : null;
  }
  return mejora.costo + comprasDe(mejoras, id) * mejora.incrementoCosto;
}

// Lo que el menú necesita saber de una mejora. `partida` trae mejoras, agua y contaminacion.
export function estadoDeMejora(id, partida, catalogo) {
  const mejora = catalogo[id];
  const costo = costoDe(id, partida.mejoras, catalogo);
  let motivo = null;
  if (costo === null) motivo = MOTIVOS.MAXIMO;
  else if (mejora.purifica !== undefined && partida.contaminacion.porcentaje <= 0) motivo = MOTIVOS.POZO_LIMPIO;
  else if (partida.agua < costo) motivo = MOTIVOS.SIN_AGUA;
  return {
    id,
    nivel: mejora.niveles ? nivelDe(partida.mejoras, id) : null,
    nivelMaximo: mejora.niveles ? mejora.niveles.length : null,
    costo,
    disponible: motivo === null,
    motivo,
  };
}

// Compra la mejora si se puede. Devuelve true si se compró.
export function comprar(id, partida, catalogo) {
  const { disponible, costo } = estadoDeMejora(id, partida, catalogo);
  if (!disponible) return false;
  const mejora = catalogo[id];
  if (mejora.niveles) {
    partida.mejoras.niveles[id] = nivelDe(partida.mejoras, id) + 1;
  } else {
    partida.mejoras.compras[id] = comprasDe(partida.mejoras, id) + 1;
    if (mejora.purifica !== undefined) purificar(partida.contaminacion, mejora.purifica);
  }
  partida.agua -= costo;
  return true;
}

// Devuelve una copia de `base` (secciones de config.json) con los parámetros que cambian las mejoras.
export function aplicarMejoras(base, mejoras, catalogo) {
  const ajustes = structuredClone(base);
  for (const [id, mejora] of Object.entries(catalogo)) {
    if (!mejora.niveles) continue;
    const [seccion, campo] = mejora.parametro.split('.');
    if (!(seccion in ajustes) || !(campo in ajustes[seccion])) {
      throw new Error(`Parámetro desconocido en upgrades.json: "${mejora.parametro}"`);
    }
    const nivel = nivelDe(mejoras, id);
    if (nivel > 0) ajustes[seccion][campo] = mejora.niveles[nivel - 1].valor;
  }
  return ajustes;
}
