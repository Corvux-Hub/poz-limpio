import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FASES, actualizarOleadas, crearOleadas, definicionDeOleada, porAparecer } from '../src/systems/oleadas.js';

const DATOS = {
  oleadas: [
    { grupos: [{ tipo: 'peaton', cantidad: 3, intervalo: 1, aparicion: 'cualquiera' }] },
    {
      grupos: [
        { tipo: 'peaton', cantidad: 2, intervalo: 2, aparicion: 'arriba' },
        { tipo: 'peaton', cantidad: 2, intervalo: 2, retraso: 1, aparicion: ['izquierda', 'derecha'] },
      ],
    },
  ],
  escalado: { cantidad: 1.5, intervalo: 0.5, intervaloMinimo: 0.6 },
};
const DESCANSO = 4;
const azar = () => 0.7;

// Simula y devuelve todos los pedidos de aparición.
function simular(oleadas, segundos, dt, quedanSucios = false) {
  const pedidos = [];
  for (let i = 0; i < Math.round(segundos / dt); i++) {
    pedidos.push(...actualizarOleadas(oleadas, DATOS, { quedanSucios, descanso: DESCANSO }, azar, dt));
  }
  return pedidos;
}

test('la primera oleada empieza tras la espera inicial', () => {
  const oleadas = crearOleadas(2);
  assert.equal(simular(oleadas, 1.9, 0.01, true).length, 0);
  assert.equal(oleadas.fase, FASES.DESCANSO);
  const pedidos = simular(oleadas, 0.2, 0.01, true);
  assert.equal(oleadas.fase, FASES.EN_CURSO);
  assert.equal(oleadas.numero, 1);
  assert.deepEqual(pedidos, [{ tipo: 'peaton', zona: 'cualquiera' }]);
});

test('cada grupo suelta su cantidad al ritmo de su intervalo, respetando su retraso', () => {
  const oleadas = crearOleadas(0);
  oleadas.numero = 2;
  const enElPrimerSegundo = simular(oleadas, 0.5, 0.01, true);
  assert.deepEqual(enElPrimerSegundo, [{ tipo: 'peaton', zona: 'arriba' }]);
  const despues = simular(oleadas, 3, 0.01, true);
  assert.equal(despues.length, 3);
  assert.equal(porAparecer(oleadas), 0);
  // aparicion con varias zonas: con azar 0.7 elige la segunda.
  assert.ok(despues.some((p) => p.zona === 'derecha'));
});

test('no termina mientras quede algún enemigo sucio', () => {
  const oleadas = crearOleadas(0);
  simular(oleadas, 5, 0.01, true);
  assert.equal(porAparecer(oleadas), 0);
  assert.equal(oleadas.fase, FASES.EN_CURSO);
  simular(oleadas, 0.01, 0.01, false);
  assert.equal(oleadas.fase, FASES.DESCANSO);
  assert.equal(oleadas.numero, 2);
});

test('tras el descanso arranca la siguiente oleada', () => {
  const oleadas = crearOleadas(0);
  simular(oleadas, 5, 0.01, true);
  simular(oleadas, 0.01, 0.01, false);
  simular(oleadas, DESCANSO - 0.1, 0.01, false);
  assert.equal(oleadas.fase, FASES.DESCANSO);
  simular(oleadas, 0.2, 0.01, true);
  assert.equal(oleadas.fase, FASES.EN_CURSO);
});

test('las apariciones no dependen de los FPS', () => {
  const lento = crearOleadas(0.35);
  const rapido = crearOleadas(0.35);
  assert.equal(simular(lento, 2.5, 0.1, true).length, simular(rapido, 2.5, 0.01, true).length);
});

test('después de las oleadas definidas repite la última escalada', () => {
  assert.equal(definicionDeOleada(2, DATOS), DATOS.oleadas[1]);
  const tercera = definicionDeOleada(3, DATOS);
  assert.equal(tercera.grupos[0].cantidad, 3);
  assert.equal(tercera.grupos[0].intervalo, 1);
  const cuarta = definicionDeOleada(4, DATOS);
  assert.equal(cuarta.grupos[0].cantidad, 5);
  // 2 × 0.5² = 0.5, pero nunca baja del mínimo.
  assert.equal(cuarta.grupos[0].intervalo, 0.6);
  assert.equal(cuarta.grupos[1].retraso, 1);
});
