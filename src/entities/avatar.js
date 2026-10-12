import * as THREE from 'three';

// Avatar provisional hecho con primitivas hasta que exista el GLB.
// Paleta tomada de docs/referencias/avatar.jpg.
const COLORES = {
  camisa: 0xf1f1ee,
  emblema: 0xf07d1a,
  cinturon: 0x141414,
  pantalon: 0x3b3e43,
  zapatos: 0x3a1d16,
  piel: 0xc98f6e,
  cabello: 0x241c18,
};

// Proporciones en metros a escala 1. El avatar mira hacia +x, su derecha es +z y el origen está entre los pies.
const PIERNA = { radio: 0.075, separacion: 0.11, alto: 0.92 };
const ZAPATO = { largo: 0.28, alto: 0.1, ancho: 0.11, adelanto: 0.04 };
const CINTURA = { y: 0.92, radio: 0.17, alto: 0.06 };
const TORSO = { radioArriba: 0.21, radioAbajo: 0.17, alto: 0.55, profundidad: 0.62 };
const HOMBROS = { radio: 0.085, ancho: 0.32 };
const EMBLEMA = { y: 1.33, lateral: -0.08, ancho: 0.1, alto: 0.05, grosor: 0.01 };
const CUELLO = { radio: 0.055, alto: 0.1 };
const CABEZA = { radio: 0.11, escala: [1.05, 1.15, 0.9] };
const BRAZO = { radio: 0.055 };
const MANO = { radio: 0.048 };
const SEGMENTOS = 16;

// Brazos sosteniendo la boquilla al frente con las dos manos, a la altura de la cintura.
const HOMBRO_DER = new THREE.Vector3(0, 1.43, 0.23);
const CODO_DER = new THREE.Vector3(0.1, 1.2, 0.26);
const MANO_DER = new THREE.Vector3(0.32, 1.1, 0.04);
const HOMBRO_IZQ = new THREE.Vector3(0, 1.43, -0.23);
const CODO_IZQ = new THREE.Vector3(0.16, 1.22, -0.24);
const MANO_IZQ = new THREE.Vector3(0.46, 1.12, -0.03);
// Donde la manguera entra a la boquilla: detrás de la mano derecha.
const AGARRE = new THREE.Vector3(0.27, 1.1, 0);

const EJE_Y = new THREE.Vector3(0, 1, 0);

function malla(geometria, color) {
  const m = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Cilindro tendido entre dos puntos.
function segmento(desde, hasta, radio, color) {
  const direccion = new THREE.Vector3().subVectors(hasta, desde);
  const m = malla(new THREE.CylinderGeometry(radio, radio, direccion.length(), SEGMENTOS), color);
  m.position.copy(desde).add(hasta).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(EJE_Y, direccion.normalize());
  return m;
}

function esfera(radio, color, posicion) {
  const m = malla(new THREE.SphereGeometry(radio, SEGMENTOS, SEGMENTOS), color);
  m.position.copy(posicion);
  return m;
}

export function crearAvatar() {
  const grupo = new THREE.Group();

  for (const lado of [-1, 1]) {
    const z = lado * PIERNA.separacion;
    const zapato = malla(new THREE.BoxGeometry(ZAPATO.largo, ZAPATO.alto, ZAPATO.ancho), COLORES.zapatos);
    zapato.position.set(ZAPATO.adelanto, ZAPATO.alto / 2, z);
    const pierna = segmento(
      new THREE.Vector3(0, ZAPATO.alto, z),
      new THREE.Vector3(0, PIERNA.alto, z),
      PIERNA.radio,
      COLORES.pantalon,
    );
    grupo.add(zapato, pierna);
  }

  const cinturon = malla(new THREE.CylinderGeometry(CINTURA.radio, CINTURA.radio, CINTURA.alto, SEGMENTOS), COLORES.cinturon);
  cinturon.position.y = CINTURA.y;
  cinturon.scale.x = TORSO.profundidad;

  const torso = malla(
    new THREE.CylinderGeometry(TORSO.radioArriba, TORSO.radioAbajo, TORSO.alto, SEGMENTOS),
    COLORES.camisa,
  );
  torso.position.y = CINTURA.y + CINTURA.alto / 2 + TORSO.alto / 2;
  torso.scale.x = TORSO.profundidad;
  const alturaHombros = torso.position.y + TORSO.alto / 2;

  const hombros = malla(new THREE.CapsuleGeometry(HOMBROS.radio, HOMBROS.ancho, 4, SEGMENTOS), COLORES.camisa);
  hombros.rotation.x = Math.PI / 2;
  hombros.position.y = alturaHombros - HOMBROS.radio;

  // El torso es un cono truncado: el emblema va sobre la superficie a su altura.
  const baseTorso = torso.position.y - TORSO.alto / 2;
  const radioEnEmblema =
    TORSO.radioAbajo + (TORSO.radioArriba - TORSO.radioAbajo) * ((EMBLEMA.y - baseTorso) / TORSO.alto);
  const emblema = malla(new THREE.BoxGeometry(EMBLEMA.grosor, EMBLEMA.alto, EMBLEMA.ancho), COLORES.emblema);
  emblema.position.set(radioEnEmblema * TORSO.profundidad, EMBLEMA.y, EMBLEMA.lateral);

  const cuello = malla(new THREE.CylinderGeometry(CUELLO.radio, CUELLO.radio, CUELLO.alto, SEGMENTOS), COLORES.piel);
  cuello.position.y = alturaHombros + CUELLO.alto / 2;

  const centroCabeza = new THREE.Vector3(0, alturaHombros + CUELLO.alto + CABEZA.radio * CABEZA.escala[1] * 0.8, 0);
  const cabeza = esfera(CABEZA.radio, COLORES.piel, centroCabeza);
  cabeza.scale.set(...CABEZA.escala);
  // Cabello peinado hacia atrás: casquete que cubre la parte superior y trasera de la cabeza.
  const cabello = malla(
    new THREE.SphereGeometry(CABEZA.radio * 1.06, SEGMENTOS, SEGMENTOS, 0, Math.PI * 2, 0, Math.PI * 0.45),
    COLORES.cabello,
  );
  cabello.position.copy(centroCabeza);
  cabello.scale.set(...CABEZA.escala);
  cabello.rotation.z = Math.PI * 0.08;

  grupo.add(cinturon, torso, hombros, emblema, cuello, cabeza, cabello);

  for (const [hombro, codo, mano] of [
    [HOMBRO_DER, CODO_DER, MANO_DER],
    [HOMBRO_IZQ, CODO_IZQ, MANO_IZQ],
  ]) {
    grupo.add(
      segmento(hombro, codo, BRAZO.radio, COLORES.camisa),
      segmento(codo, mano, BRAZO.radio, COLORES.camisa),
      esfera(MANO.radio, COLORES.piel, mano),
    );
  }

  return { grupo, agarre: AGARRE.clone() };
}
