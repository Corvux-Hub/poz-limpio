import * as THREE from 'three';

// Pozo de piedra al centro de la glorieta, con armazón de madera, manivela y cubeta.
// El agua es el indicador principal de la contaminación: cambia de color, pierde su luz azul
// y se le junta basura flotando conforme el pozo se ensucia.

const COLORES = {
  piedra: 0x6f6a62,
  piedraTapa: 0x7d776d,
  mortero: 0x2e2b28,
  interior: 0x24211e,
  madera: 0x5a3e28,
  metal: 0x3d3f43,
  cuerda: 0x8c7b5a,
  basura: 0x2d2416,
};
// El agua pasa de limpia a sucia según el porcentaje de contaminación.
const AGUA_LIMPIA = { color: new THREE.Color(0x2f8fc0), brillo: new THREE.Color(0x0e4a6e) };
const AGUA_SUCIA = { color: new THREE.Color(0x3d3820), brillo: new THREE.Color(0x0d0b04) };
// El agua se enturbia rápido al principio: con poca contaminación ya se nota.
const CURVA_TURBIEDAD = 0.7;
const GROSOR_BROCAL = 0.35;
const PROFUNDIDAD_AGUA = 0.3;
const SEGMENTOS = 40;

// Piedras del brocal en hileras alternadas; cada una con tono y tamaño un poco distintos.
const PIEDRAS = { porHilera: 17, alto: 0.22, separacion: 0.025, variacionTono: 0.12 };
const TAPA = { piezas: 14, alto: 0.08, sobresale: 0.08 };
// Armazón: dos postes a los lados (izquierda y derecha en pantalla) para no tapar el agua.
const ARMAZON = { alto: 1.6, grueso: 0.14, viga: 0.12 };
// Luz azul que sale del agua limpia; se apaga conforme se contamina.
const LUZ_AGUA = { color: 0x58c4ff, intensidad: 7, alcance: 5.5, altura: 0.45 };
// Ondas en la superficie: aparecen cada tanto, crecen y se desvanecen.
const ONDAS = { cantidad: 3, cada: 0.75, duracion: 1.8, radioMaximo: 0.45, opacidad: 0.35 };
// Brillo que respira (frecuencia en rad/s y amplitud relativa).
const VAIVEN_BRILLO = { frecuencia: 2.1, amplitud: 0.18 };
// Basura flotante: una pieza más por cada tramo de contaminación; giran despacio (rad/s).
const BASURA = { piezas: 10, giro: 0.15 };

// Generador con semilla para que el pozo salga igual siempre.
function crearAzar(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function caja(ancho, alto, profundo, material) {
  const malla = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, profundo), material);
  malla.castShadow = true;
  malla.receiveShadow = true;
  return malla;
}

function crearBrocal(grupo, radio, altoBrocal, azar) {
  const radioInterior = radio - GROSOR_BROCAL;
  const radioPiedras = radio - GROSOR_BROCAL / 2;

  // Núcleo de mortero detrás de las piedras (se asoma entre las juntas) y pared interior oscura.
  const mortero = new THREE.Mesh(
    new THREE.CylinderGeometry(radio - 0.04, radio - 0.04, altoBrocal, SEGMENTOS, 1, true),
    new THREE.MeshStandardMaterial({ color: COLORES.mortero, roughness: 1 }),
  );
  mortero.position.y = altoBrocal / 2;
  const interior = new THREE.Mesh(
    new THREE.CylinderGeometry(radioInterior, radioInterior, altoBrocal, SEGMENTOS, 1, true),
    new THREE.MeshStandardMaterial({ color: COLORES.interior, roughness: 1, side: THREE.BackSide }),
  );
  interior.position.y = altoBrocal / 2;
  grupo.add(mortero, interior);

  const hileras = Math.round(altoBrocal / PIEDRAS.alto);
  const altoHilera = altoBrocal / hileras;
  const anchoPiedra = (2 * Math.PI * radioPiedras) / PIEDRAS.porHilera - PIEDRAS.separacion;
  const piedras = new THREE.InstancedMesh(
    new THREE.BoxGeometry(anchoPiedra, altoHilera - PIEDRAS.separacion, GROSOR_BROCAL),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
    hileras * PIEDRAS.porHilera,
  );
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 1, 0);
  const tono = new THREE.Color();
  let i = 0;
  for (let h = 0; h < hileras; h++) {
    // Cada hilera va corrida media piedra respecto a la anterior.
    const desfase = (h % 2) * 0.5;
    for (let p = 0; p < PIEDRAS.porHilera; p++) {
      const angulo = ((p + desfase) / PIEDRAS.porHilera) * Math.PI * 2;
      giro.setFromAxisAngle(eje, -angulo + Math.PI / 2 + (azar() - 0.5) * 0.06);
      const escala = 0.94 + azar() * 0.08;
      matriz.compose(
        new THREE.Vector3(Math.cos(angulo) * radioPiedras, altoHilera * (h + 0.5), Math.sin(angulo) * radioPiedras),
        giro,
        new THREE.Vector3(escala, 1, 1),
      );
      piedras.setMatrixAt(i, matriz);
      tono.set(COLORES.piedra).multiplyScalar(1 - PIEDRAS.variacionTono / 2 + azar() * PIEDRAS.variacionTono);
      piedras.setColorAt(i, tono);
      i++;
    }
  }
  piedras.castShadow = true;
  piedras.receiveShadow = true;
  grupo.add(piedras);

  // Losas de remate sobre el brocal, un poco más anchas que el muro.
  const tapaMaterial = new THREE.MeshStandardMaterial({ color: COLORES.piedraTapa, roughness: 0.9 });
  const radioTapa = radio - GROSOR_BROCAL / 2 + TAPA.sobresale / 2;
  const anchoTapa = (2 * Math.PI * radioTapa) / TAPA.piezas - 0.02;
  for (let p = 0; p < TAPA.piezas; p++) {
    const angulo = (p / TAPA.piezas) * Math.PI * 2;
    const losa = caja(anchoTapa, TAPA.alto, GROSOR_BROCAL + TAPA.sobresale, tapaMaterial);
    losa.position.set(Math.cos(angulo) * radioTapa, altoBrocal + TAPA.alto / 2, Math.sin(angulo) * radioTapa);
    losa.rotation.y = -angulo + Math.PI / 2;
    grupo.add(losa);
  }
}

function crearArmazon(grupo, radio, altoBrocal) {
  const madera = new THREE.MeshStandardMaterial({ color: COLORES.madera, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: COLORES.metal, roughness: 0.5, metalness: 0.6 });
  const xPoste = radio - GROSOR_BROCAL / 2;
  const base = altoBrocal + TAPA.alto;
  const arriba = base + ARMAZON.alto;
  for (const lado of [-1, 1]) {
    const poste = caja(ARMAZON.grueso, ARMAZON.alto, ARMAZON.grueso, madera);
    poste.position.set(lado * xPoste, base + ARMAZON.alto / 2, 0);
    grupo.add(poste);
  }
  const viga = caja(xPoste * 2 + ARMAZON.grueso * 2, ARMAZON.viga, ARMAZON.viga, madera);
  viga.position.set(0, arriba - ARMAZON.viga / 2, 0);
  grupo.add(viga);

  // Manivela por fuera del poste derecho.
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), metal);
  eje.rotation.z = Math.PI / 2;
  eje.position.set(xPoste + 0.22, arriba - 0.3, 0);
  const brazo = caja(0.05, 0.3, 0.05, metal);
  brazo.position.set(xPoste + 0.36, arriba - 0.42, 0);
  const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), madera);
  mango.rotation.z = Math.PI / 2;
  mango.position.set(xPoste + 0.43, arriba - 0.55, 0);
  grupo.add(eje, brazo, mango);

  // Cuerda y cubeta colgando un poco a un lado, para no tapar el centro del agua.
  const xCubeta = -0.35;
  const altoCubeta = base + 0.45;
  const cuerda = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, arriba - altoCubeta - 0.15, 6),
    new THREE.MeshStandardMaterial({ color: COLORES.cuerda, roughness: 1 }),
  );
  cuerda.position.set(xCubeta, (arriba + altoCubeta + 0.15) / 2, 0);
  const cubeta = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.24, 14, 1, true), metal);
  cubeta.material = metal.clone();
  cubeta.material.side = THREE.DoubleSide;
  cubeta.position.set(xCubeta, altoCubeta, 0);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 16, Math.PI), metal);
  asa.position.set(xCubeta, altoCubeta + 0.12, 0);
  for (const pieza of [cuerda, cubeta, asa]) pieza.castShadow = true;
  grupo.add(cuerda, cubeta, asa);
}

export function crearPozo({ radio, altoBrocal }) {
  const grupo = new THREE.Group();
  const azar = crearAzar(11);
  const radioInterior = radio - GROSOR_BROCAL;
  const alturaAgua = altoBrocal - PROFUNDIDAD_AGUA;

  crearBrocal(grupo, radio, altoBrocal, azar);
  crearArmazon(grupo, radio, altoBrocal);

  const agua = new THREE.Mesh(
    new THREE.CircleGeometry(radioInterior, SEGMENTOS).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: AGUA_LIMPIA.color, emissive: AGUA_LIMPIA.brillo, roughness: 0.25 }),
  );
  agua.position.y = alturaAgua;
  agua.receiveShadow = true;
  grupo.add(agua);

  const luz = new THREE.PointLight(LUZ_AGUA.color, LUZ_AGUA.intensidad, LUZ_AGUA.alcance);
  luz.position.y = alturaAgua + LUZ_AGUA.altura;
  grupo.add(luz);

  // Ondas: anillos que reutilizan su malla cuando terminan.
  const ondas = Array.from({ length: ONDAS.cantidad }, () => {
    const malla = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0, depthWrite: false }),
    );
    malla.position.y = alturaAgua + 0.005;
    grupo.add(malla);
    return { malla, edad: ONDAS.duracion };
  });
  let siguienteOnda = 0;

  // Basura flotante: polígonos irregulares oscuros repartidos por la superficie.
  const materialBasura = new THREE.MeshStandardMaterial({ color: COLORES.basura, roughness: 1 });
  const basura = Array.from({ length: BASURA.piezas }, (_, i) => {
    const pieza = new THREE.Mesh(new THREE.CircleGeometry(0.07 + azar() * 0.08, 5 + (i % 3)).rotateX(-Math.PI / 2), materialBasura);
    const angulo = azar() * Math.PI * 2;
    const distancia = Math.sqrt(azar()) * (radioInterior - 0.15);
    pieza.position.set(Math.cos(angulo) * distancia, alturaAgua + 0.01, Math.sin(angulo) * distancia);
    pieza.scale.set(1, 1, 0.6 + azar() * 0.6);
    pieza.visible = false;
    grupo.add(pieza);
    return { pieza, angulo, distancia };
  });

  let tiempo = 0;
  const brillo = new THREE.Color();

  return {
    grupo,
    radio,
    altoBrocal,
    radioInterior,
    alturaAgua,
    // `dt` anima el agua (ondas, brillo, basura); con 0 se queda quieta (pausa).
    sincronizar(porcentajeContaminacion, dt) {
      tiempo += dt;
      const t = porcentajeContaminacion / 100;
      const turbiedad = t ** CURVA_TURBIEDAD;
      const limpieza = 1 - turbiedad;

      agua.material.color.lerpColors(AGUA_LIMPIA.color, AGUA_SUCIA.color, turbiedad);
      brillo.lerpColors(AGUA_LIMPIA.brillo, AGUA_SUCIA.brillo, turbiedad);
      agua.material.emissive.copy(brillo).multiplyScalar(1 + Math.sin(tiempo * VAIVEN_BRILLO.frecuencia) * VAIVEN_BRILLO.amplitud);
      luz.intensity = LUZ_AGUA.intensidad * limpieza * limpieza;

      // Las ondas se notan menos cuanto más turbia está el agua.
      siguienteOnda -= dt;
      for (const onda of ondas) {
        onda.edad += dt;
        if (onda.edad >= ONDAS.duracion && siguienteOnda <= 0) {
          onda.edad = 0;
          siguienteOnda = ONDAS.cada;
          const angulo = Math.random() * Math.PI * 2;
          const distancia = Math.random() * (radioInterior - ONDAS.radioMaximo);
          onda.malla.position.x = Math.cos(angulo) * distancia;
          onda.malla.position.z = Math.sin(angulo) * distancia;
        }
        const avance = Math.min(onda.edad / ONDAS.duracion, 1);
        onda.malla.scale.setScalar(0.05 + avance * ONDAS.radioMaximo);
        onda.malla.material.opacity = (1 - avance) * ONDAS.opacidad * limpieza;
      }

      // Una pieza de basura más por cada décimo de contaminación; giran despacio alrededor del centro.
      const visibles = Math.round(t * BASURA.piezas);
      basura.forEach((b, i) => {
        b.pieza.visible = i < visibles;
        const angulo = b.angulo + tiempo * BASURA.giro;
        b.pieza.position.x = Math.cos(angulo) * b.distancia;
        b.pieza.position.z = Math.sin(angulo) * b.distancia;
        b.pieza.rotation.y = angulo * 2;
      });
    },
  };
}
