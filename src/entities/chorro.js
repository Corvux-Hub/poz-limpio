import * as THREE from 'three';

const COLOR_AGUA = 0xc4ebff;
const BRILLO_AGUA = 0x2f7fb0;
const OPACIDAD = 0.85;
// Puramente visual: cuánto baja el chorro al final de su alcance y cuánto se alarga cada gota.
const CAIDA = 0.8;
const ESTIRAMIENTO = 2.6;
const SEGMENTOS = 8;

const EJE_Z = new THREE.Vector3(0, 0, 1);

// Dibuja las gotas del estado lógico del chorro como esferas alargadas (una sola malla instanciada).
export function crearChorroVisual({ velocidad, alcance, cadencia, ancho }, alturaPunta) {
  // Gotas vivas a la vez: las que caben en el tiempo de vuelo, con holgura.
  const capacidad = Math.ceil(cadencia * (alcance / velocidad)) * 2;
  const malla = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, SEGMENTOS, SEGMENTOS / 2),
    new THREE.MeshStandardMaterial({
      color: COLOR_AGUA,
      emissive: BRILLO_AGUA,
      roughness: 0.2,
      transparent: true,
      opacity: OPACIDAD,
    }),
    capacidad,
  );
  malla.count = 0;
  // Las instancias se mueven por todo el mapa; la caja de la geometría base no sirve para descartar.
  malla.frustumCulled = false;

  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const direccion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3(ancho, ancho, ancho * ESTIRAMIENTO);

  return {
    grupo: malla,
    sincronizar(chorro) {
      const visibles = Math.min(chorro.gotas.length, capacidad);
      for (let i = 0; i < visibles; i++) {
        const gota = chorro.gotas[i];
        const avance = gota.recorrido / alcance;
        posicion.set(gota.x, alturaPunta - CAIDA * avance * avance, gota.z);
        giro.setFromUnitVectors(EJE_Z, direccion.set(gota.dx, 0, gota.dz));
        malla.setMatrixAt(i, matriz.compose(posicion, giro, escala));
      }
      malla.count = visibles;
      malla.instanceMatrix.needsUpdate = true;
    },
  };
}
