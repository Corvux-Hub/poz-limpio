import * as THREE from 'three';

// Avatar provisional hecho con primitivas hasta que exista el GLB.
// Paleta tomada de docs/referencias/avatar.jpg: camisa blanca de manga larga (doblada al antebrazo)
// con emblema naranja en el pecho, cuello abierto con collar, cinturón negro, pantalón gris oscuro,
// zapatos café y cabello oscuro peinado hacia atrás.
const COLORES = {
  camisa: 0xf1f1ee,
  sombraCamisa: 0xd9d9d4,
  emblema: 0xf07d1a,
  cinturon: 0x141414,
  hebilla: 0xa9adb3,
  pantalon: 0x3b3e43,
  zapatos: 0x3a1d16,
  suela: 0x111111,
  piel: 0xc98f6e,
  cabello: 0x241c18,
  collar: 0x1c1c1c,
};

// Proporciones en metros a escala 1. El avatar mira hacia +x, su derecha es +z y el origen está entre los pies.
const PIERNA = { radioArriba: 0.08, radioAbajo: 0.065, separacion: 0.11, alto: 0.92 };
const ZAPATO = { largo: 0.28, alto: 0.09, ancho: 0.11, adelanto: 0.04, suela: 0.025 };
const CADERA = { ancho: 0.34, alto: 0.14, profundo: 0.2 };
const CINTURA = { y: 0.92, radio: 0.17, alto: 0.06 };
const TORSO = { radio: 0.19, largo: 0.3, profundidad: 0.65 };
const EMBLEMA = { y: 1.33, lateral: -0.085, ancho: 0.12, alto: 0.07, grosor: 0.015, brillo: 0.35 };
const CUELLO = { radio: 0.055, alto: 0.1 };
const CABEZA = { radio: 0.11, escala: [1.05, 1.15, 0.9] };
const OREJA = { radio: 0.025, escala: [0.6, 1.2, 0.5] };
const BRAZO = { radio: 0.058 };
// La manga doblada llega a esta fracción del antebrazo; de ahí a la mano se ve la piel.
const MANGA = { hasta: 0.45, radio: 0.064, radioAntebrazo: 0.045 };
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
const materiales = new Map();

function malla(geometria, color, opciones = {}) {
  const clave = `${color}-${JSON.stringify(opciones)}`;
  if (!materiales.has(clave)) {
    materiales.set(clave, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opciones }));
  }
  const m = new THREE.Mesh(geometria, materiales.get(clave));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Cilindro (o cono truncado) tendido entre dos puntos.
function segmento(desde, hasta, radioDesde, color, radioHasta = radioDesde) {
  const direccion = new THREE.Vector3().subVectors(hasta, desde);
  const m = malla(new THREE.CylinderGeometry(radioHasta, radioDesde, direccion.length(), SEGMENTOS), color);
  m.position.copy(desde).add(hasta).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(EJE_Y, direccion.normalize());
  return m;
}

function esfera(radio, color, posicion) {
  const m = malla(new THREE.SphereGeometry(radio, SEGMENTOS, SEGMENTOS), color);
  m.position.copy(posicion);
  return m;
}

function crearPiernas(grupo) {
  for (const lado of [-1, 1]) {
    const z = lado * PIERNA.separacion;
    const suela = malla(new THREE.BoxGeometry(ZAPATO.largo + 0.01, ZAPATO.suela, ZAPATO.ancho + 0.01), COLORES.suela);
    suela.position.set(ZAPATO.adelanto, ZAPATO.suela / 2, z);
    const zapato = malla(new THREE.CapsuleGeometry(ZAPATO.ancho / 2, ZAPATO.largo - ZAPATO.ancho, 4, 10), COLORES.zapatos);
    zapato.rotation.z = Math.PI / 2;
    zapato.scale.set(1, 1, 0.8);
    zapato.position.set(ZAPATO.adelanto, ZAPATO.suela + ZAPATO.alto / 2, z);
    const pierna = segmento(
      new THREE.Vector3(0, ZAPATO.suela + ZAPATO.alto, z),
      new THREE.Vector3(0, PIERNA.alto, z),
      PIERNA.radioAbajo,
      COLORES.pantalon,
      PIERNA.radioArriba,
    );
    grupo.add(suela, zapato, pierna);
  }
  const cadera = malla(new THREE.BoxGeometry(CADERA.profundo, CADERA.alto, CADERA.ancho), COLORES.pantalon);
  cadera.position.y = CINTURA.y - CADERA.alto / 2;
  grupo.add(cadera);
}

function crearTorso(grupo) {
  const cinturon = malla(new THREE.CylinderGeometry(CINTURA.radio, CINTURA.radio, CINTURA.alto, SEGMENTOS), COLORES.cinturon);
  cinturon.position.y = CINTURA.y;
  cinturon.scale.x = TORSO.profundidad;
  const hebilla = malla(new THREE.BoxGeometry(0.02, 0.05, 0.07), COLORES.hebilla, { metalness: 0.8, roughness: 0.3 });
  hebilla.position.set(CINTURA.radio * TORSO.profundidad + 0.005, CINTURA.y, 0);

  // Torso: cápsula aplanada de frente a espalda, para hombros y cintura redondeados.
  const torso = malla(new THREE.CapsuleGeometry(TORSO.radio, TORSO.largo, 6, SEGMENTOS), COLORES.camisa);
  const centroTorso = CINTURA.y + CINTURA.alto / 2 + TORSO.largo / 2 + TORSO.radio * 0.7;
  torso.position.y = centroTorso;
  torso.scale.set(TORSO.profundidad, 1, 1.12);
  const alturaHombros = centroTorso + TORSO.largo / 2 + TORSO.radio * 0.6;

  // Emblema naranja en el pecho izquierdo, con un poco de brillo para que se note de noche.
  const frente = TORSO.radio * TORSO.profundidad;
  const emblema = malla(new THREE.BoxGeometry(EMBLEMA.grosor, EMBLEMA.alto, EMBLEMA.ancho), COLORES.emblema, {
    emissive: COLORES.emblema,
    emissiveIntensity: EMBLEMA.brillo,
  });
  emblema.position.set(frente + 0.002, EMBLEMA.y, EMBLEMA.lateral);

  // Cuello abierto: dos solapas blancas, la piel del escote y un collar oscuro.
  const yCuello = alturaHombros - 0.03;
  for (const lado of [-1, 1]) {
    const solapa = malla(new THREE.BoxGeometry(0.02, 0.07, 0.09), COLORES.sombraCamisa);
    solapa.position.set(frente * 0.85, yCuello, lado * 0.05);
    solapa.rotation.set(lado * 0.5, 0, -0.35);
    grupo.add(solapa);
  }
  const escote = malla(new THREE.BoxGeometry(0.01, 0.09, 0.05), COLORES.piel);
  escote.position.set(frente * 0.93, yCuello - 0.05, 0);
  escote.rotation.z = -0.25;
  const cuello = malla(new THREE.CylinderGeometry(CUELLO.radio, CUELLO.radio * 1.1, CUELLO.alto, SEGMENTOS), COLORES.piel);
  cuello.position.y = alturaHombros + CUELLO.alto / 2 - 0.02;
  const collar = malla(new THREE.TorusGeometry(CUELLO.radio * 1.15, 0.006, 6, 20), COLORES.collar, { metalness: 0.4 });
  collar.rotation.x = Math.PI / 2;
  collar.rotation.y = 0.35;
  collar.position.set(0.01, alturaHombros - 0.01, 0);

  grupo.add(cinturon, hebilla, torso, emblema, escote, cuello, collar);
  return alturaHombros;
}

function crearCabeza(grupo, alturaHombros) {
  const centro = new THREE.Vector3(0, alturaHombros + CUELLO.alto + CABEZA.radio * CABEZA.escala[1] * 0.75, 0);
  const cabeza = esfera(CABEZA.radio, COLORES.piel, centro);
  cabeza.scale.set(...CABEZA.escala);
  for (const lado of [-1, 1]) {
    const oreja = esfera(OREJA.radio, COLORES.piel, new THREE.Vector3(-0.01, centro.y, lado * CABEZA.radio * CABEZA.escala[2]));
    oreja.scale.set(...OREJA.escala);
    grupo.add(oreja);
  }
  // Cabello peinado hacia atrás: casquete que cubre arriba y atrás, con volumen al frente.
  const cabello = malla(
    new THREE.SphereGeometry(CABEZA.radio * 1.07, SEGMENTOS, SEGMENTOS, 0, Math.PI * 2, 0, Math.PI * 0.48),
    COLORES.cabello,
  );
  cabello.position.copy(centro);
  cabello.scale.set(CABEZA.escala[0] * 1.04, CABEZA.escala[1], CABEZA.escala[2] * 1.03);
  cabello.rotation.z = Math.PI * 0.09;
  const copete = malla(new THREE.SphereGeometry(CABEZA.radio * 0.55, 12, 10), COLORES.cabello);
  copete.position.set(centro.x + 0.04, centro.y + CABEZA.radio * 0.95, 0);
  copete.scale.set(1.2, 0.55, 1.5);
  grupo.add(cabeza, cabello, copete);
}

function crearBrazos(grupo) {
  for (const [hombro, codo, mano] of [
    [HOMBRO_DER, CODO_DER, MANO_DER],
    [HOMBRO_IZQ, CODO_IZQ, MANO_IZQ],
  ]) {
    // Manga doblada: termina con un puño un poco más grueso a mitad del antebrazo.
    const finManga = new THREE.Vector3().lerpVectors(codo, mano, MANGA.hasta);
    grupo.add(
      esfera(BRAZO.radio * 1.15, COLORES.camisa, hombro),
      segmento(hombro, codo, BRAZO.radio, COLORES.camisa),
      esfera(BRAZO.radio, COLORES.camisa, codo),
      segmento(codo, finManga, MANGA.radio, COLORES.sombraCamisa, BRAZO.radio),
      segmento(finManga, mano, MANGA.radioAntebrazo, COLORES.piel),
      esfera(MANO.radio, COLORES.piel, mano),
    );
  }
}

export function crearAvatar() {
  const grupo = new THREE.Group();
  crearPiernas(grupo);
  const alturaHombros = crearTorso(grupo);
  crearCabeza(grupo, alturaHombros);
  crearBrazos(grupo);
  return { grupo, agarre: AGARRE.clone() };
}
