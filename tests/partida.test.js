import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avanzarPartida,
  comprarMejora,
  crearPartida,
  esperaMejoras,
  perdio,
  seguirConLaSiguienteOleada,
} from '../src/core/partida.js';
import { FASES } from '../src/systems/oleadas.js';
import { cargarDatos } from '../herramientas/datos.js';
import { crearAzar } from '../herramientas/azar.js';
import { crearJugadorAutomatico } from '../herramientas/jugadorAutomatico.js';

const DT = 1 / 60;
const QUIETO = { objetivo: null, disparando: false };

// Datos reales del juego con oleadas pequeñas y fijas, para que las pruebas no dependan del balance.
function datosDePrueba() {
  const datos = cargarDatos();
  datos.oleadas = {
    oleadas: [{ grupos: [{ tipo: 'peaton', cantidad: 3, intervalo: 3, aparicion: 'derecha' }] }],
    escalado: { cantidad: 1, intervalo: 1, intervaloMinimo: 1 },
  };
  return datos;
}

// Avanza hasta que `condicion` se cumpla o pasen `segundos`; devuelve los segundos que tardó.
function avanzarHasta(partida, datos, jugar, condicion, segundos, azar) {
  for (let t = 0; t < segundos; t += DT) {
    avanzarPartida(partida, datos, jugar(partida, datos, DT), DT, azar);
    if (condicion(partida)) return t;
  }
  return Infinity;
}

test('si nadie dispara, los enemigos llegan y contaminan el pozo hasta perder', () => {
  const datos = datosDePrueba();
  const partida = crearPartida(datos);
  const tiempo = avanzarHasta(partida, datos, () => QUIETO, perdio, 300, crearAzar(1));
  assert.ok(Number.isFinite(tiempo));
  assert.equal(partida.limpiados, 0);
});

test('un jugador que apunta y dispara supera la oleada y gana agua limpia', () => {
  const datos = datosDePrueba();
  const partida = crearPartida(datos);
  const jugador = crearJugadorAutomatico({ reaccion: 0.6 });
  const tiempo = avanzarHasta(partida, datos, jugador, esperaMejoras, 120, crearAzar(2));
  assert.ok(Number.isFinite(tiempo));
  assert.equal(partida.limpiados, 3);
  assert.equal(partida.agua, 3 * datos.tipos.peaton.recompensa);
  assert.ok(partida.contaminacion.porcentaje < 20);
});

test('comprar una mejora cambia los parámetros vigentes y cobra el agua', () => {
  const datos = datosDePrueba();
  const partida = crearPartida(datos);
  partida.agua = 100;
  const costo = datos.mejoras.potencia.niveles[0].costo;
  assert.equal(comprarMejora(partida, datos, 'potencia'), true);
  assert.equal(partida.ajustes.chorro.potencia, datos.mejoras.potencia.niveles[0].valor);
  assert.equal(partida.agua, 100 - costo);
});

test('tras el menú de mejoras arranca la cuenta regresiva de la siguiente oleada', () => {
  const datos = datosDePrueba();
  const partida = crearPartida(datos);
  avanzarHasta(partida, datos, crearJugadorAutomatico({ reaccion: 0.6 }), esperaMejoras, 120, crearAzar(3));
  seguirConLaSiguienteOleada(partida, datos);
  assert.equal(partida.oleadas.fase, FASES.DESCANSO);
  assert.equal(partida.oleadas.numero, 2);
});

test('anota cada golpe al pozo con la posición de quien golpeó y lo que contaminó', () => {
  const datos = datosDePrueba();
  const partida = crearPartida(datos);
  const golpes = [];
  avanzarHasta(
    partida,
    datos,
    () => QUIETO,
    (p) => {
      golpes.push(...p.golpes);
      return golpes.length >= 2;
    },
    120,
    crearAzar(4),
  );
  assert.ok(golpes.length >= 2);
  const total = golpes.reduce((suma, golpe) => suma + golpe.contaminacion, 0);
  assert.ok(Math.abs(total - partida.contaminacion.porcentaje) < 1e-9);
  for (const { x, z } of golpes) {
    const distancia = Math.hypot(x, z);
    assert.ok(distancia > datos.config.pozo.radio && distancia < datos.config.pozo.radio + 2);
  }
  // En un paso sin golpes la lista queda vacía.
  partida.enemigos = [];
  avanzarPartida(partida, datos, QUIETO, DT, crearAzar(5));
  assert.deepEqual(partida.golpes, []);
});
