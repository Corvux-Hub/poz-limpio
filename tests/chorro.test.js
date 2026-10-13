import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actualizarChorro, crearChorro, entradaEnCirculo } from '../src/systems/chorro.js';

const CONFIG = { velocidad: 10, alcance: 5, cadencia: 50, ancho: 0.1 };
const ORIGEN = { x: 0, z: 0 };
const disparo = (disparando, angulo = 0) => ({ disparando, origen: ORIGEN, angulo });
const cerca = (a, b, tolerancia = 1e-9) => Math.abs(a - b) < tolerancia;

function simular(chorro, segundos, dt, parametros, objetivos = []) {
  const tocados = new Set();
  const pasos = Math.round(segundos / dt);
  for (let i = 0; i < pasos; i++) {
    for (const id of actualizarChorro(chorro, parametros, objetivos, CONFIG, dt).keys()) tocados.add(id);
  }
  return tocados;
}

test('entradaEnCirculo encuentra el primer punto de contacto', () => {
  assert.ok(cerca(entradaEnCirculo(0, 0, 10, 0, 5, 0, 1), 0.4));
  assert.equal(entradaEnCirculo(0, 0, 10, 0, 5, 2, 1), null);
  assert.equal(entradaEnCirculo(0, 0, 3, 0, 5, 0, 1), null);
  assert.equal(entradaEnCirculo(6, 0, 10, 0, 5, 0, 1), 0);
  assert.equal(entradaEnCirculo(7, 0, 10, 0, 5, 0, 1), null);
});

test('sin disparar no salen gotas', () => {
  const chorro = crearChorro();
  simular(chorro, 1, 0.01, disparo(false));
  assert.equal(chorro.gotas.length, 0);
});

test('emite según la cadencia y las gotas avanzan a su velocidad', () => {
  const chorro = crearChorro();
  actualizarChorro(chorro, disparo(true), [], CONFIG, 0.1);
  assert.equal(chorro.gotas.length, 5);
  const masLejana = Math.max(...chorro.gotas.map((g) => g.recorrido));
  // La primera gota del paso salió casi al inicio: lleva 0.08 s volando (las demás, menos).
  assert.ok(cerca(masLejana, 0.8));
});

test('las gotas desaparecen al llegar a su alcance', () => {
  const chorro = crearChorro();
  simular(chorro, 0.2, 0.01, disparo(true));
  simular(chorro, 0.6, 0.01, disparo(false));
  assert.equal(chorro.gotas.length, 0);
});

test('al soltar, el agua que ya salió sigue volando', () => {
  const chorro = crearChorro();
  simular(chorro, 0.2, 0.01, disparo(true));
  const enVuelo = chorro.gotas.length;
  simular(chorro, 0.1, 0.01, disparo(false));
  assert.equal(chorro.gotas.length, enVuelo);
});

test('no depende de los FPS: un paso de 100 ms equivale a diez de 10 ms', () => {
  const lento = crearChorro();
  const rapido = crearChorro();
  actualizarChorro(lento, disparo(true, 0.7), [], CONFIG, 0.1);
  simular(rapido, 0.1, 0.01, disparo(true, 0.7));
  const recorridos = (c) => c.gotas.map((g) => g.recorrido).sort((a, b) => a - b);
  assert.equal(lento.gotas.length, rapido.gotas.length);
  recorridos(lento).forEach((r, i) => assert.ok(cerca(r, recorridos(rapido)[i], 1e-6)));
});

test('detecta un objetivo en la línea de tiro y no uno fuera de ella', () => {
  const chorro = crearChorro();
  const objetivos = [
    { id: 'frente', x: 3, z: 0, radio: 0.4 },
    { id: 'lado', x: 3, z: 2, radio: 0.4 },
  ];
  const tocados = simular(chorro, 0.5, 0.01, disparo(true), objetivos);
  assert.deepEqual([...tocados], ['frente']);
});

test('no detecta objetivos más allá del alcance', () => {
  const chorro = crearChorro();
  const tocados = simular(chorro, 1, 0.01, disparo(true), [{ id: 'lejos', x: 6, z: 0, radio: 0.4 }]);
  assert.equal(tocados.size, 0);
});

test('el de adelante cubre al de atrás', () => {
  const chorro = crearChorro();
  const objetivos = [
    { id: 'atras', x: 4, z: 0, radio: 0.4 },
    { id: 'adelante', x: 2, z: 0, radio: 0.4 },
  ];
  const tocados = simular(chorro, 1, 0.01, disparo(true), objetivos);
  assert.deepEqual([...tocados], ['adelante']);
  assert.ok(chorro.gotas.every((g) => g.x < 2));
});

test('no atraviesa objetivos delgados aunque el paso sea grande', () => {
  const chorro = crearChorro();
  const tocados = simular(chorro, 1, 0.1, disparo(true), [{ id: 'delgado', x: 2.55, z: 0, radio: 0.05 }]);
  assert.deepEqual([...tocados], ['delgado']);
});

test('cuenta cuántas gotas le pegan a cada objetivo: tantas como la cadencia por segundo', () => {
  const chorro = crearChorro();
  const objetivo = { id: 'frente', x: 2, z: 0, radio: 0.4 };
  // Primero que el chorro llegue, luego medir un segundo exacto.
  simular(chorro, 0.5, 0.01, disparo(true), [objetivo]);
  let gotas = 0;
  for (let i = 0; i < 100; i++) gotas += actualizarChorro(chorro, disparo(true), [objetivo], CONFIG, 0.01).get('frente') ?? 0;
  assert.equal(gotas, CONFIG.cadencia);
});

test('con menos caudal salen proporcionalmente menos gotas', () => {
  const chorro = crearChorro();
  // En 0.4 s ninguna gota llega a su alcance (5 m a 10 m/s), así que todas siguen en el aire.
  for (let i = 0; i < 40; i++) actualizarChorro(chorro, { ...disparo(true), caudal: 0.5 }, [], CONFIG, 0.01);
  assert.equal(chorro.gotas.length, 0.5 * CONFIG.cadencia * 0.4);
});
