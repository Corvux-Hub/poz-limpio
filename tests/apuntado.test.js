import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actualizarApuntado,
  crearApuntado,
  diferenciaAngular,
  normalizarAngulo,
} from '../src/systems/apuntado.js';

const ORIGEN = { x: 0, z: 0 };
const cerca = (a, b) => Math.abs(a - b) < 1e-9;

test('normalizarAngulo deja el ángulo en (-π, π]', () => {
  assert.ok(cerca(normalizarAngulo(Math.PI * 3), Math.PI));
  assert.ok(cerca(normalizarAngulo(-Math.PI), Math.PI));
  assert.ok(cerca(normalizarAngulo(Math.PI * 2.5), Math.PI / 2));
  assert.ok(cerca(normalizarAngulo(-Math.PI * 2.5), -Math.PI / 2));
});

test('diferenciaAngular toma el giro corto al cruzar ±π', () => {
  assert.ok(cerca(diferenciaAngular(Math.PI - 0.1, -Math.PI + 0.1), 0.2));
  assert.ok(cerca(diferenciaAngular(-Math.PI + 0.1, Math.PI - 0.1), -0.2));
});

test('llega al objetivo si el giro cabe en un paso', () => {
  const apuntado = crearApuntado(0);
  actualizarApuntado(apuntado, ORIGEN, { x: 0, z: 5 }, 10, 1);
  assert.ok(cerca(apuntado.angulo, Math.PI / 2));
});

test('limita el giro a velocidadGiro × dt', () => {
  const apuntado = crearApuntado(0);
  actualizarApuntado(apuntado, ORIGEN, { x: 0, z: 5 }, 10, 0.05);
  assert.ok(cerca(apuntado.angulo, 0.5));
});

test('gira por el lado corto cuando el objetivo cruza ±π', () => {
  const apuntado = crearApuntado(Math.PI - 0.1);
  actualizarApuntado(apuntado, ORIGEN, { x: -5, z: -0.5 }, 1, 0.05);
  // Debe pasar de π - 0.1 a π - 0.05 (sentido positivo), no retroceder.
  assert.ok(cerca(apuntado.angulo, Math.PI - 0.05));
});

test('no depende de los FPS: diez pasos de 10 ms equivalen a uno de 100 ms', () => {
  const objetivo = { x: -3, z: 4 };
  const lento = crearApuntado(0);
  const rapido = crearApuntado(0);
  actualizarApuntado(lento, ORIGEN, objetivo, 5, 0.1);
  for (let i = 0; i < 10; i++) actualizarApuntado(rapido, ORIGEN, objetivo, 5, 0.01);
  assert.ok(cerca(lento.angulo, rapido.angulo));
});

test('conserva el ángulo sin objetivo o con el objetivo sobre el origen', () => {
  const apuntado = crearApuntado(1);
  actualizarApuntado(apuntado, ORIGEN, null, 10, 0.1);
  actualizarApuntado(apuntado, ORIGEN, { x: 0, z: 0 }, 10, 0.1);
  assert.equal(apuntado.angulo, 1);
});
