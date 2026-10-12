import * as THREE from 'three';

const COLOR_MANGUERA = 0xc4161c;
const COLOR_BOQUILLA = 0x2b2e33;
const RADIO_MANGUERA = 0.07;
const BOQUILLA = { largo: 0.5, radioAtras: 0.06, radioPunta: 0.035 };
const SEGMENTOS_LARGO = 80;
const SEGMENTOS_RADIO = 10;

// Coordenadas del pivote: x hacia afuera del pozo, y arriba, z a la derecha del avatar.
// La manguera sale del agua, cruza el brocal, pasa por el costado derecho del avatar
// y entra a la boquilla que sostiene con ambas manos.
export function crearManguera(pozo, agarre, escalaAvatar) {
  const s = escalaAvatar;
  const ruta = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pozo.radioInterior * 0.15, pozo.alturaAgua - 0.1, 0),
    new THREE.Vector3(pozo.radioInterior * 0.55, pozo.altoBrocal + 0.2, 0.12),
    new THREE.Vector3(pozo.radio + 0.05, pozo.altoBrocal + 0.15, 0.25),
    new THREE.Vector3(agarre.x - 0.3 * s, agarre.y - 0.25 * s, 0.36 * s),
    new THREE.Vector3(agarre.x - 0.05 * s, agarre.y - 0.02 * s, 0.2 * s),
    agarre.clone(),
  ]);

  const manguera = new THREE.Mesh(
    new THREE.TubeGeometry(ruta, SEGMENTOS_LARGO, RADIO_MANGUERA, SEGMENTOS_RADIO),
    new THREE.MeshStandardMaterial({ color: COLOR_MANGUERA, roughness: 0.5 }),
  );

  const largo = BOQUILLA.largo * s;
  const boquilla = new THREE.Mesh(
    new THREE.CylinderGeometry(BOQUILLA.radioPunta * s, BOQUILLA.radioAtras * s, largo, SEGMENTOS_RADIO),
    new THREE.MeshStandardMaterial({ color: COLOR_BOQUILLA, metalness: 0.6, roughness: 0.4 }),
  );
  // El cilindro nace sobre +y; se acuesta para que la punta mire hacia +x.
  boquilla.rotation.z = -Math.PI / 2;
  boquilla.position.set(agarre.x + largo / 2, agarre.y, agarre.z);

  for (const pieza of [manguera, boquilla]) pieza.castShadow = true;

  const grupo = new THREE.Group();
  grupo.add(manguera, boquilla);
  return { grupo };
}
