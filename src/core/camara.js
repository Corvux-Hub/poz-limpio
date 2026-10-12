import * as THREE from 'three';

const PLANO_CERCANO = 0.1;
// Búsqueda de la distancia de encuadre, en metros.
const DISTANCIA_MAXIMA = 500;
const PRECISION_ENCUADRE = 0.01;

// Cámara fija en vista 3/4: alta, inclinada hacia el pozo y con perspectiva.
// En pantalla, +x queda a la derecha y +z hacia abajo (hacia la cámara).
export function crearCamara({ campoVision }) {
  return new THREE.PerspectiveCamera(campoVision, 1, PLANO_CERCANO, DISTANCIA_MAXIMA);
}

// Aleja la cámara lo justo para que quepa el mapa completo (con margen y la altura de los personajes
// en los bordes), manteniendo el pozo en el centro de la pantalla.
export function ajustarCamara(camara, mapa, { inclinacion, margen, alturaEncuadre }, aspecto) {
  const angulo = THREE.MathUtils.degToRad(inclinacion);
  const direccion = new THREE.Vector3(0, Math.sin(angulo), Math.cos(angulo));
  const mitadX = mapa.ancho / 2 + margen;
  const mitadZ = mapa.alto / 2 + margen;

  const puntos = [];
  for (const x of [-mitadX, mitadX]) {
    for (const z of [-mitadZ, mitadZ]) {
      for (const y of [0, alturaEncuadre]) puntos.push(new THREE.Vector3(x, y, z));
    }
  }

  const proyectado = new THREE.Vector3();
  const colocar = (distancia) => {
    camara.position.copy(direccion).multiplyScalar(distancia);
    camara.lookAt(0, 0, 0);
    camara.aspect = aspecto;
    camara.far = distancia + Math.hypot(mitadX, mitadZ) * 2;
    camara.updateProjectionMatrix();
    camara.updateMatrixWorld();
  };
  const cabe = () =>
    puntos.every((p) => {
      proyectado.copy(p).project(camara);
      return Math.abs(proyectado.x) <= 1 && Math.abs(proyectado.y) <= 1 && Math.abs(proyectado.z) <= 1;
    });

  // Más lejos siempre cabe más: búsqueda binaria de la distancia mínima que encuadra todo.
  let cerca = 0;
  let lejos = DISTANCIA_MAXIMA;
  while (lejos - cerca > PRECISION_ENCUADRE) {
    const medio = (cerca + lejos) / 2;
    colocar(medio);
    if (cabe()) lejos = medio;
    else cerca = medio;
  }
  colocar(lejos);
}
