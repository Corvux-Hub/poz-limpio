import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contaminar, crearContaminacion, estaPerdido } from '../src/systems/contaminacion.js';

test('el pozo empieza limpio y suma contaminación', () => {
  const contaminacion = crearContaminacion();
  assert.equal(contaminacion.porcentaje, 0);
  contaminar(contaminacion, 30);
  contaminar(contaminacion, 25);
  assert.equal(contaminacion.porcentaje, 55);
  assert.equal(estaPerdido(contaminacion), false);
});

test('se pierde al llegar a 100 % y nunca pasa de ahí', () => {
  const contaminacion = crearContaminacion();
  contaminar(contaminacion, 95);
  contaminar(contaminacion, 20);
  assert.equal(contaminacion.porcentaje, 100);
  assert.equal(estaPerdido(contaminacion), true);
});
