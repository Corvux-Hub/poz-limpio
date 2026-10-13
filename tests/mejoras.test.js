import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVOS, aplicarMejoras, comprar, costoDe, crearMejoras, estadoDeMejora } from '../src/systems/mejoras.js';
import { crearContaminacion } from '../src/systems/contaminacion.js';

const CATALOGO = {
  potencia: {
    parametro: 'chorro.potencia',
    niveles: [
      { valor: 1.5, costo: 30 },
      { valor: 2, costo: 60 },
    ],
  },
  purificacion: { purifica: 25, costo: 30, incrementoCosto: 15 },
};
const BASE = { chorro: { potencia: 1, alcance: 7 }, pozo: { factorContaminacion: 1 } };

function partidaCon(agua, contaminacion = 0) {
  const partida = { agua, mejoras: crearMejoras(), contaminacion: crearContaminacion() };
  partida.contaminacion.porcentaje = contaminacion;
  return partida;
}

test('una mejora por niveles cuesta lo de su siguiente nivel hasta llegar al máximo', () => {
  const partida = partidaCon(1000);
  assert.equal(costoDe('potencia', partida.mejoras, CATALOGO), 30);
  assert.equal(comprar('potencia', partida, CATALOGO), true);
  assert.equal(costoDe('potencia', partida.mejoras, CATALOGO), 60);
  assert.equal(comprar('potencia', partida, CATALOGO), true);
  assert.equal(costoDe('potencia', partida.mejoras, CATALOGO), null);
  assert.equal(comprar('potencia', partida, CATALOGO), false);
  assert.equal(estadoDeMejora('potencia', partida, CATALOGO).motivo, MOTIVOS.MAXIMO);
  assert.equal(partida.agua, 910);
});

test('no se compra sin agua suficiente y no se cobra nada', () => {
  const partida = partidaCon(20);
  const estado = estadoDeMejora('potencia', partida, CATALOGO);
  assert.equal(estado.disponible, false);
  assert.equal(estado.motivo, MOTIVOS.SIN_AGUA);
  assert.equal(comprar('potencia', partida, CATALOGO), false);
  assert.equal(partida.agua, 20);
  assert.equal(estadoDeMejora('potencia', partida, CATALOGO).nivel, 0);
});

test('purificar baja la contaminación y cada compra cuesta más', () => {
  const partida = partidaCon(100, 40);
  assert.equal(comprar('purificacion', partida, CATALOGO), true);
  assert.equal(partida.contaminacion.porcentaje, 15);
  assert.equal(costoDe('purificacion', partida.mejoras, CATALOGO), 45);
  assert.equal(comprar('purificacion', partida, CATALOGO), true);
  assert.equal(partida.contaminacion.porcentaje, 0);
  assert.equal(partida.agua, 25);
});

test('no deja purificar un pozo que ya está limpio', () => {
  const partida = partidaCon(100, 0);
  assert.equal(estadoDeMejora('purificacion', partida, CATALOGO).motivo, MOTIVOS.POZO_LIMPIO);
  assert.equal(comprar('purificacion', partida, CATALOGO), false);
  assert.equal(partida.agua, 100);
});

test('aplicarMejoras cambia el parámetro según el nivel sin tocar la base', () => {
  const partida = partidaCon(1000);
  assert.equal(aplicarMejoras(BASE, partida.mejoras, CATALOGO).chorro.potencia, 1);
  comprar('potencia', partida, CATALOGO);
  const ajustes = aplicarMejoras(BASE, partida.mejoras, CATALOGO);
  assert.equal(ajustes.chorro.potencia, 1.5);
  assert.equal(ajustes.chorro.alcance, 7);
  assert.equal(BASE.chorro.potencia, 1);
});

test('aplicarMejoras avisa si upgrades.json apunta a un parámetro que no existe', () => {
  const catalogo = { rara: { parametro: 'chorro.presion', niveles: [{ valor: 2, costo: 1 }] } };
  assert.throws(() => aplicarMejoras(BASE, crearMejoras(), catalogo), /Parámetro desconocido/);
});
