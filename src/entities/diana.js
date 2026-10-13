import * as THREE from 'three';

// Diana de prueba del hito 2: un bulto quieto que se pinta de azul mientras recibe agua.
// Desaparece cuando llegue el enemigo real (hito 3).
const COLOR_SECO = new THREE.Color(0x5b4a39);
const COLOR_MOJADO = new THREE.Color(0x8cc8e8);
const ALTO = 1.7;
// Qué tan rápido (1/s) el color sigue al estado de mojado.
const RESPUESTA_COLOR = 10;

export function crearDiana({ x, z }, radio) {
  const material = new THREE.MeshStandardMaterial({ color: COLOR_SECO, roughness: 0.9 });
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(radio, ALTO - radio * 2, 4, 16), material);
  cuerpo.position.set(x, ALTO / 2, z);
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;

  let mojado = 0;
  return {
    grupo: cuerpo,
    actualizar(recibeAgua, dt) {
      mojado += ((recibeAgua ? 1 : 0) - mojado) * (1 - Math.exp(-RESPUESTA_COLOR * dt));
      material.color.lerpColors(COLOR_SECO, COLOR_MOJADO, mojado);
    },
  };
}
