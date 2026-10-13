import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarAgua, progresoDeLimpieza, tiempoDeLimpieza } from '../src/systems/limpieza.js';
import { ESTADOS, actualizarEnemigo, crearEnemigo, esObjetivo, puntoEnBorde } from '../src/systems/enemigos.js';

const PEATON = { suciedad: 3, tamano: 1, velocidad: 1, alcance: 0.5, contaminacion: 5, intervaloGolpe: 1.5 };
const MAPA = { ancho: 20, alto: 10 };
const ENTORNO = {
  radioPozo: 1,
  potencia: 1,
  regeneracion: 0.5,
  pausaAlLimpiarse: 0.5,
  mapa: MAPA,
  margenSalida: 1,
};
const cerca = (a, b, tolerancia = 1e-6) => Math.abs(a - b) < tolerancia;

// Devuelve la contaminación total que causó en ese tiempo.
function simular(enemigo, segundos, dt, recibeAgua) {
  let contaminacion = 0;
  for (let i = 0; i < Math.round(segundos / dt); i++) contaminacion += actualizarEnemigo(enemigo, recibeAgua, ENTORNO, dt);
  return contaminacion;
}

// Un peatón ya parado frente al pozo.
function enemigoEnPozo() {
  const enemigo = crearEnemigo(1, PEATON, { x: 1.9, z: 0 }, 0.4);
  simular(enemigo, 0.01, 0.01, false);
  assert.equal(enemigo.estado, ESTADOS.EN_POZO);
  return enemigo;
}

test('tiempoDeLimpieza coincide con la tabla de referencia del diseño', () => {
  assert.equal(tiempoDeLimpieza({ suciedad: 3, tamano: 1 }, 1), 3);
  assert.equal(tiempoDeLimpieza({ suciedad: 6, tamano: 1 }, 1), 6);
  assert.equal(tiempoDeLimpieza({ suciedad: 8, tamano: 1.5 }, 1), 12);
  assert.equal(tiempoDeLimpieza({ suciedad: 10, tamano: 1.5 }, 1), 15);
  assert.equal(tiempoDeLimpieza({ suciedad: 10, tamano: 1.5 }, 2), 7.5);
});

test('queda limpio tras recibir agua el tiempo de limpieza', () => {
  const enemigo = { tipo: PEATON, exposicion: 0 };
  let limpio = false;
  for (let i = 0; i < 299; i++) limpio = aplicarAgua(enemigo, true, ENTORNO, 0.01);
  assert.equal(limpio, false);
  assert.equal(aplicarAgua(enemigo, true, ENTORNO, 0.01), true);
  assert.ok(cerca(progresoDeLimpieza(enemigo, 1), 1));
});

test('sin agua la exposición se regenera y no baja de cero', () => {
  const enemigo = { tipo: PEATON, exposicion: 1 };
  aplicarAgua(enemigo, false, ENTORNO, 1);
  assert.ok(cerca(enemigo.exposicion, 0.5));
  aplicarAgua(enemigo, false, ENTORNO, 5);
  assert.equal(enemigo.exposicion, 0);
});

test('no se puede limpiar a golpecitos espaciados', () => {
  const enemigo = { tipo: PEATON, exposicion: 0 };
  let limpio = false;
  for (let ronda = 0; ronda < 20; ronda++) {
    for (let i = 0; i < 50; i++) limpio ||= aplicarAgua(enemigo, true, ENTORNO, 0.01);
    for (let i = 0; i < 150; i++) limpio ||= aplicarAgua(enemigo, false, ENTORNO, 0.01);
  }
  assert.equal(limpio, false);
});

test('camina hacia el pozo a su velocidad y se detiene a su alcance del brocal', () => {
  const enemigo = crearEnemigo(1, PEATON, { x: 10, z: 0 }, 0.4);
  simular(enemigo, 2, 0.01, false);
  assert.ok(cerca(enemigo.x, 8));
  assert.equal(enemigo.estado, ESTADOS.AVANZANDO);
  simular(enemigo, 10, 0.01, false);
  // Brocal (1) + su radio (0.4) + alcance (0.5).
  assert.ok(cerca(enemigo.x, 1.9));
  assert.equal(enemigo.estado, ESTADOS.EN_POZO);
});

test('el movimiento no depende de los FPS', () => {
  const lento = crearEnemigo(1, PEATON, { x: 6, z: -3 }, 0.4);
  const rapido = crearEnemigo(2, PEATON, { x: 6, z: -3 }, 0.4);
  simular(lento, 1, 0.1, false);
  simular(rapido, 1, 0.01, false);
  assert.ok(cerca(lento.x, rapido.x) && cerca(lento.z, rapido.z));
});

test('al limpiarse se detiene, deja de ser objetivo y luego se retira hasta salir del mapa', () => {
  const enemigo = crearEnemigo(1, PEATON, { x: 8, z: 0 }, 0.4);
  simular(enemigo, 3, 0.01, true);
  assert.equal(enemigo.estado, ESTADOS.LIMPIO);
  assert.equal(esObjetivo(enemigo), false);
  const xAlLimpiarse = enemigo.x;

  simular(enemigo, 0.4, 0.01, false);
  assert.equal(enemigo.x, xAlLimpiarse);
  assert.equal(enemigo.exposicion > 0, true);

  simular(enemigo, 0.2, 0.01, false);
  assert.equal(enemigo.estado, ESTADOS.RETIRANDOSE);
  simular(enemigo, 10, 0.01, false);
  assert.equal(enemigo.estado, ESTADOS.FUERA);
  assert.ok(enemigo.x > MAPA.ancho / 2 + ENTORNO.margenSalida);
});

test('puntoEnBorde siempre cae sobre el borde del mapa', () => {
  for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999]) {
    const { x, z } = puntoEnBorde(MAPA, () => t);
    const enBordeVertical = cerca(Math.abs(x), MAPA.ancho / 2) && Math.abs(z) <= MAPA.alto / 2 + 1e-9;
    const enBordeHorizontal = cerca(Math.abs(z), MAPA.alto / 2) && Math.abs(x) <= MAPA.ancho / 2 + 1e-9;
    assert.ok(enBordeVertical || enBordeHorizontal, `t=${t} → (${x}, ${z})`);
  }
});

test('mientras camina no contamina el pozo', () => {
  const enemigo = crearEnemigo(1, PEATON, { x: 10, z: 0 }, 0.4);
  assert.equal(simular(enemigo, 5, 0.01, false), 0);
});

test('frente al pozo lo golpea cada intervaloGolpe y cada golpe suma su contaminación', () => {
  const enemigo = enemigoEnPozo();
  assert.equal(simular(enemigo, 1.4, 0.01, false), 0);
  assert.equal(enemigo.tiempoDesdeGolpe, Infinity);
  assert.equal(simular(enemigo, 0.2, 0.01, false), 5);
  assert.ok(enemigo.tiempoDesdeGolpe < 0.2);
  assert.equal(simular(enemigo, 3, 0.01, false), 10);
});

test('los golpes no dependen de los FPS', () => {
  const lento = enemigoEnPozo();
  const rapido = enemigoEnPozo();
  // 5.5 s: tres golpes (1.5, 3 y 4.5 s), lejos de un límite donde el redondeo decida.
  assert.equal(simular(lento, 5.5, 0.1, false), 15);
  assert.equal(simular(rapido, 5.5, 0.01, false), 15);
});

test('limpio deja de contaminar aunque esté frente al pozo', () => {
  const enemigo = enemigoEnPozo();
  simular(enemigo, 3, 0.01, true);
  assert.equal(enemigo.estado, ESTADOS.LIMPIO);
  assert.equal(simular(enemigo, 0.5, 0.01, false), 0);
});
