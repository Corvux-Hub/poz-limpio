import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actualizarPresion, crearPresion, estaSinPresion } from '../src/systems/presion.js';

const CONFIG = { reserva: 4, recarga: 2, retrasoRecarga: 0.5, caudalSinPresion: 0.25 };
const cerca = (a, b, tolerancia = 1e-9) => Math.abs(a - b) < tolerancia;

// Devuelve el caudal medio del periodo.
function simular(presion, segundos, dt, disparando) {
  let caudal = 0;
  const pasos = Math.round(segundos / dt);
  for (let i = 0; i < pasos; i++) caudal += actualizarPresion(presion, disparando, CONFIG, dt);
  return caudal / pasos;
}

test('con reserva el agua sale a caudal completo y gasta un segundo por segundo', () => {
  const presion = crearPresion(CONFIG.reserva);
  assert.ok(cerca(simular(presion, 3, 0.01, true), 1));
  assert.ok(cerca(presion.nivel, 1, 1e-6));
  assert.equal(estaSinPresion(presion), false);
});

test('sin reserva el agua sigue saliendo, pero con el caudal reducido', () => {
  const presion = crearPresion(CONFIG.reserva);
  simular(presion, 4, 0.01, true);
  assert.equal(estaSinPresion(presion), true);
  assert.ok(cerca(simular(presion, 2, 0.01, true), CONFIG.caudalSinPresion));
});

test('si se vacía a mitad del paso, solo ese resto sale reducido', () => {
  const presion = crearPresion(0.05);
  const caudal = actualizarPresion(presion, true, CONFIG, 0.1);
  assert.ok(cerca(caudal, (0.05 + 0.05 * CONFIG.caudalSinPresion) / 0.1));
  assert.equal(presion.nivel, 0);
});

test('al soltar recarga tras el retraso, sin pasar de la reserva', () => {
  const presion = crearPresion(CONFIG.reserva);
  simular(presion, 4, 0.01, true);
  assert.equal(simular(presion, 0.5, 0.01, false), 0);
  assert.ok(cerca(presion.nivel, 0, 1e-6));
  simular(presion, 1, 0.01, false);
  assert.ok(cerca(presion.nivel, 2, 1e-6));
  simular(presion, 10, 0.01, false);
  assert.equal(presion.nivel, CONFIG.reserva);
});

test('disparar aunque sea un instante reinicia el retraso de la recarga', () => {
  const presion = crearPresion(CONFIG.reserva);
  simular(presion, 4, 0.01, true);
  simular(presion, 0.4, 0.01, false);
  simular(presion, 0.01, 0.01, true);
  simular(presion, 0.4, 0.01, false);
  assert.ok(cerca(presion.nivel, 0, 1e-6));
});

test('la presión no depende de los FPS', () => {
  const lenta = crearPresion(CONFIG.reserva);
  const rapida = crearPresion(CONFIG.reserva);
  for (const [segundos, disparando] of [[5, true], [1.3, false], [0.6, true], [2, false]]) {
    simular(lenta, segundos, 0.1, disparando);
    simular(rapida, segundos, 1 / 144, disparando);
  }
  assert.ok(Math.abs(lenta.nivel - rapida.nivel) < 0.02, `${lenta.nivel} vs ${rapida.nivel}`);
});
