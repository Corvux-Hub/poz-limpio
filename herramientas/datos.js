// Carga los JSON de src/data para usarlos fuera del navegador (pruebas y herramientas).
import { readFileSync } from 'node:fs';

const leer = (archivo) => JSON.parse(readFileSync(new URL(`../src/data/${archivo}`, import.meta.url), 'utf8'));

// Mismo formato que arma main.js: { config, tipos, armas, oleadas, mejoras }.
export function cargarDatos() {
  return {
    config: leer('config.json'),
    tipos: leer('enemies.json'),
    armas: leer('armas.json'),
    oleadas: leer('waves.json'),
    mejoras: leer('upgrades.json'),
  };
}
