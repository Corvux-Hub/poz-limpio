import * as THREE from 'three';

const COLOR_PIEDRA = 0x6b6862;
// El agua pasa de limpia a sucia según el porcentaje de contaminación.
const AGUA_LIMPIA = { color: new THREE.Color(0x2f8fc0), brillo: new THREE.Color(0x0b3a55) };
const AGUA_SUCIA = { color: new THREE.Color(0x4f4326), brillo: new THREE.Color(0x120d05) };
const GROSOR_BROCAL = 0.35;
const PROFUNDIDAD_AGUA = 0.3;
const SEGMENTOS = 40;

// Pozo centrado en el origen: muro exterior, muro interior, borde superior y espejo de agua.
export function crearPozo({ radio, altoBrocal }) {
  const grupo = new THREE.Group();
  const piedra = new THREE.MeshStandardMaterial({ color: COLOR_PIEDRA, roughness: 0.95 });
  const radioInterior = radio - GROSOR_BROCAL;

  const exterior = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, altoBrocal, SEGMENTOS, 1, true), piedra);
  exterior.position.y = altoBrocal / 2;

  const interior = new THREE.Mesh(
    new THREE.CylinderGeometry(radioInterior, radioInterior, altoBrocal, SEGMENTOS, 1, true),
    piedra.clone(),
  );
  interior.material.side = THREE.BackSide;
  interior.position.y = altoBrocal / 2;

  const borde = new THREE.Mesh(new THREE.RingGeometry(radioInterior, radio, SEGMENTOS), piedra);
  borde.rotation.x = -Math.PI / 2;
  borde.position.y = altoBrocal;

  const agua = new THREE.Mesh(
    new THREE.CircleGeometry(radioInterior, SEGMENTOS),
    new THREE.MeshStandardMaterial({ color: AGUA_LIMPIA.color, emissive: AGUA_LIMPIA.brillo, roughness: 0.5 }),
  );
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = altoBrocal - PROFUNDIDAD_AGUA;

  for (const pieza of [exterior, interior, borde]) {
    pieza.castShadow = true;
    pieza.receiveShadow = true;
  }
  agua.receiveShadow = true;

  grupo.add(exterior, interior, borde, agua);
  return {
    grupo,
    radio,
    altoBrocal,
    radioInterior,
    alturaAgua: agua.position.y,
    sincronizar(porcentajeContaminacion) {
      const t = porcentajeContaminacion / 100;
      agua.material.color.lerpColors(AGUA_LIMPIA.color, AGUA_SUCIA.color, t);
      agua.material.emissive.lerpColors(AGUA_LIMPIA.brillo, AGUA_SUCIA.brillo, t);
    },
  };
}
