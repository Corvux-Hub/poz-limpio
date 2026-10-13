import * as THREE from 'three';

// Textos que suben y se desvanecen sobre un punto del mundo (p. ej. "+10" al limpiar a alguien).
const DURACION = 1.2;
// Metros que sube el texto durante su vida.
const SUBIDA = 1.2;

export function crearEtiquetasFlotantes(contenedor) {
  const capa = document.createElement('div');
  capa.className = 'etiquetas';
  contenedor.appendChild(capa);

  const vivas = [];
  const proyectado = new THREE.Vector3();

  return {
    agregar(texto, { x, y, z }) {
      const elemento = document.createElement('div');
      elemento.className = 'etiqueta';
      elemento.textContent = texto;
      capa.appendChild(elemento);
      vivas.push({ elemento, posicion: new THREE.Vector3(x, y, z), edad: 0 });
    },
    // Las coloca en pantalla según la cámara; con dt = 0 quedan congeladas (pausa, menú).
    actualizar(camara, anchoPantalla, altoPantalla, dt) {
      for (let i = vivas.length - 1; i >= 0; i--) {
        const etiqueta = vivas[i];
        etiqueta.edad += dt;
        const avance = etiqueta.edad / DURACION;
        if (avance >= 1) {
          etiqueta.elemento.remove();
          vivas.splice(i, 1);
          continue;
        }
        proyectado.copy(etiqueta.posicion);
        proyectado.y += SUBIDA * avance;
        proyectado.project(camara);
        const x = ((proyectado.x + 1) / 2) * anchoPantalla;
        const y = ((1 - proyectado.y) / 2) * altoPantalla;
        etiqueta.elemento.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        etiqueta.elemento.style.opacity = String(1 - avance * avance);
      }
    },
    limpiar() {
      for (const { elemento } of vivas) elemento.remove();
      vivas.length = 0;
    },
  };
}
