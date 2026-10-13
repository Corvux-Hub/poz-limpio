import * as THREE from 'three';

// Escenario: cruce de dos avenidas de noche con el pozo en una glorieta al centro.
// Todo es decorado hecho con primitivas. Dentro del área donde caminan los enemigos solo hay cosas
// planas (asfalto, marcas, charcos) para que nadie atraviese objetos; lo que tiene altura (edificios,
// postes, coches) queda por fuera del anillo de aparición. Los edificios altos van al fondo
// (z negativo), donde no tapan la acción; cerca de la cámara solo hay locales bajos.

// Medidas en metros. La avenida horizontal corre a lo largo de x y la vertical a lo largo de z.
const AVENIDA = { mediaVertical: 4.5, mediaHorizontal: 4, carril: 2.25 };
const GLORIETA = { radio: 4, alto: 0.03, guarnicion: 0.12, anillos: 7, segmentos: 64 };
const BANQUETA = { alto: 0.04, guarnicion: 0.1 };
// Hasta dónde se extiende el mundo dibujado (se pierde en la bruma).
const EXTENSION = 45;
// Separación extra entre el anillo de aparición de enemigos y cualquier objeto con altura.
const HOLGURA = 0.9;

const COLORES = {
  asfalto: 0x24262b,
  parche: 0x1c1e22,
  banqueta: 0x45433f,
  guarnicion: 0x8a8780,
  guarnicionAmarilla: 0xb08f2e,
  adoquinA: 0x4c463f,
  adoquinB: 0x5a5249,
  marcaBlanca: 0xa9a9a2,
  marcaAmarilla: 0xb08a2c,
  charco: 0x1c2531,
  coladera: 0x2b2b2d,
  basura: 0x4d473b,
  ventanaApagada: 0x10161e,
  ventanaEncendida: 0xffd08a,
  cortina: 0x6d6f72,
  tinaco: 0x141518,
  poste: 0x3a3d42,
  luzCalle: 0xff9a3c,
  tronco: 0x3b2c22,
  copa: 0x1f3324,
};
const EDIFICIOS = [0x4a4540, 0x5b4b3f, 0x3f4a4d, 0x544c5a, 0x6b5a45, 0x3d4440, 0x5c3f3a, 0x47504a];
const LETREROS = [0x2fd17a, 0xe0453a, 0x3a9be0, 0xf0b43a, 0xc85ad8];
const COCHES = [0x5a1f1f, 0x2d3b52, 0x6b6b6b, 0x3f4a2f, 0x8a7a55];

// Luces de la calle: pocas y cálidas, sin sombras, para dar charcos de luz.
const LUZ_CALLE = { intensidad: 32, alcance: 15, altura: 6.2 };
// Una lámpara parpadea, por el ambiente.
const PARPADEO = { minimo: 0.15, cambio: 0.08 };
// Semáforos: segundos en verde, ámbar y rojo.
const SEMAFORO = { verde: 6, ambar: 1.5, rojo: 7.5 };

// Generador con semilla: el escenario sale igual en cada partida.
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

const materiales = new Map();
function material(color, opciones = {}) {
  const clave = `${color}-${JSON.stringify(opciones)}`;
  if (!materiales.has(clave)) {
    materiales.set(clave, new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opciones }));
  }
  return materiales.get(clave);
}

function caja(ancho, alto, profundo, mat, x, y, z) {
  const malla = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, profundo), mat);
  malla.position.set(x, y, z);
  malla.castShadow = true;
  malla.receiveShadow = true;
  return malla;
}

// Muchas piezas planas iguales (marcas, franjas) en una sola malla instanciada.
// Cada pieza: { x, z, ancho (en x), largo (en z), giro, y }.
function piezasPlanas(piezas, mat) {
  const malla = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, piezas.length);
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 1, 0);
  piezas.forEach((p, i) => {
    giro.setFromAxisAngle(eje, p.giro ?? 0);
    matriz.compose(new THREE.Vector3(p.x, p.y ?? 0.012, p.z), giro, new THREE.Vector3(p.ancho, 1, p.largo));
    malla.setMatrixAt(i, matriz);
  });
  malla.receiveShadow = true;
  return malla;
}

function crearSuelo(grupo, azar) {
  const asfalto = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENSION * 2, EXTENSION * 2).rotateX(-Math.PI / 2),
    material(COLORES.asfalto, { roughness: 0.95 }),
  );
  asfalto.receiveShadow = true;
  grupo.add(asfalto);

  // Banquetas: una losa por esquina, del borde de la avenida hacia afuera.
  const { mediaVertical: mv, mediaHorizontal: mh } = AVENIDA;
  const largo = EXTENSION - mv;
  const fondo = EXTENSION - mh;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const losa = caja(largo, BANQUETA.alto, fondo, material(COLORES.banqueta), sx * (mv + largo / 2), BANQUETA.alto / 2, sz * (mh + fondo / 2));
      losa.castShadow = false;
      grupo.add(losa);
      // Guarniciones: amarillas cerca del cruce (prohibido estacionarse), grises después.
      for (const [esX, inicio, fin, color] of [
        [true, mv, mv + 6, COLORES.guarnicionAmarilla],
        [true, mv + 6, EXTENSION, COLORES.guarnicion],
        [false, mh, mh + 4, COLORES.guarnicionAmarilla],
        [false, mh + 4, EXTENSION, COLORES.guarnicion],
      ]) {
        const tramo = fin - inicio;
        const g = esX
          ? caja(tramo, BANQUETA.guarnicion, 0.18, material(color), sx * (inicio + tramo / 2), BANQUETA.guarnicion / 2, sz * mh)
          : caja(0.18, BANQUETA.guarnicion, tramo, material(color), sx * mv, BANQUETA.guarnicion / 2, sz * (inicio + tramo / 2));
        g.castShadow = false;
        grupo.add(g);
      }
    }
  }

  // Parches de asfalto más oscuro, como reparaciones viejas.
  const parches = [];
  for (let i = 0; i < 14; i++) {
    const enHorizontal = azar() < 0.5;
    parches.push({
      x: enHorizontal ? (azar() - 0.5) * 2 * EXTENSION * 0.6 : (azar() - 0.5) * 2 * (mv - 0.5),
      z: enHorizontal ? (azar() - 0.5) * 2 * (mh - 0.5) : (azar() - 0.5) * 2 * EXTENSION * 0.6,
      ancho: 0.8 + azar() * 2.2,
      largo: 0.6 + azar() * 1.6,
      giro: azar() * Math.PI,
      y: 0.004,
    });
  }
  grupo.add(piezasPlanas(parches, material(COLORES.parche, { roughness: 0.95 })));
}

function crearGlorieta(grupo) {
  const { radio, alto, guarnicion, anillos, segmentos } = GLORIETA;
  // Adoquín en anillos alternados de dos tonos.
  for (let i = 0; i < anillos; i++) {
    const exterior = radio * (1 - i / anillos);
    const interior = radio * (1 - (i + 1) / anillos);
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(interior, exterior, segmentos).rotateX(-Math.PI / 2),
      material(i % 2 ? COLORES.adoquinA : COLORES.adoquinB),
    );
    anillo.position.y = alto;
    anillo.receiveShadow = true;
    grupo.add(anillo);
  }
  const borde = new THREE.Mesh(
    new THREE.CylinderGeometry(radio + 0.12, radio + 0.12, guarnicion, segmentos, 1, true),
    material(COLORES.guarnicionAmarilla, { side: THREE.DoubleSide }),
  );
  borde.position.y = guarnicion / 2;
  borde.receiveShadow = true;
  grupo.add(borde);
}

function crearMarcas(grupo, anillo) {
  const { mediaVertical: mv, mediaHorizontal: mh, carril } = AVENIDA;
  const blancas = [];
  const amarillas = [];
  const inicioH = GLORIETA.radio + 0.6;
  const inicioV = GLORIETA.radio + 0.6;

  for (const s of [-1, 1]) {
    // Pasos de cebra en los cuatro brazos del cruce.
    for (let z = -mh + 0.6; z <= mh - 0.6; z += 1) blancas.push({ x: s * (inicioH + 0.9), z, ancho: 1.8, largo: 0.5 });
    for (let x = -mv + 0.6; x <= mv - 0.6; x += 1) blancas.push({ x, z: s * (inicioV + 0.9), ancho: 0.5, largo: 1.8 });
    // Líneas de alto antes del paso de cebra.
    blancas.push({ x: s * (inicioH + 2.3), z: -s * mh * 0.5, ancho: 0.35, largo: mh - 0.4 });
    blancas.push({ x: s * mv * 0.5, z: s * (inicioV + 2.3), ancho: mv - 0.4, largo: 0.35 });

    // Doble línea amarilla al centro y líneas de carril discontinuas.
    const desdeH = inicioH + 2.6;
    const desdeV = inicioV + 2.6;
    const tramoH = EXTENSION - desdeH;
    const tramoV = EXTENSION - desdeV;
    for (const d of [-0.12, 0.12]) {
      amarillas.push({ x: s * (desdeH + tramoH / 2), z: d, ancho: tramoH, largo: 0.1 });
      amarillas.push({ x: d, z: s * (desdeV + tramoV / 2), ancho: 0.1, largo: tramoV });
    }
    for (let d = desdeH + 1; d < EXTENSION; d += 3) {
      for (const lado of [-1, 1]) blancas.push({ x: s * (d + 0.75), z: lado * carril * 0.9, ancho: 1.5, largo: 0.12 });
    }
    for (let d = desdeV + 1; d < EXTENSION; d += 3) {
      for (const lado of [-1, 1]) blancas.push({ x: lado * carril, z: s * (d + 0.75), ancho: 0.12, largo: 1.5 });
    }
    // Flechas de dirección en el carril (rectángulo y punta), lejos del centro.
    const xFlecha = s * Math.min(anillo.x - 2.5, desdeH + 3.5);
    blancas.push({ x: xFlecha, z: -s * carril * 1.4, ancho: 1.4, largo: 0.18 });
    blancas.push({ x: xFlecha - s * 0.75, z: -s * carril * 1.4, ancho: 0.45, largo: 0.45, giro: Math.PI / 4 });
  }
  grupo.add(piezasPlanas(blancas, material(COLORES.marcaBlanca, { roughness: 0.8 })));
  grupo.add(piezasPlanas(amarillas, material(COLORES.marcaAmarilla, { roughness: 0.8 })));
}

function crearDetallesDelSuelo(grupo, azar, anillo) {
  // Charcos: brillantes, reflejan las luces de la calle.
  // Sin mapa de entorno, un charco metálico se vería negro: brillo por rugosidad baja, no por metal.
  const charco = material(COLORES.charco, { roughness: 0.12, metalness: 0 });
  for (const [x, z, a, l] of [
    [-7.5, 1.8, 2.2, 1.1],
    [6.2, -2.6, 1.6, 0.9],
    [2.4, 5.6, 1.2, 0.8],
    [-2.8, -5.8, 1.8, 1],
    [9.6, 2.9, 1.3, 0.7],
  ]) {
    for (let i = 0; i < 3; i++) {
      const mancha = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), charco);
      mancha.position.set(x + (azar() - 0.5) * a * 0.6, 0.008 + i * 0.001, z + (azar() - 0.5) * l * 0.6);
      mancha.scale.set(a * (0.45 + azar() * 0.4), 1, l * (0.45 + azar() * 0.4));
      mancha.receiveShadow = true;
      grupo.add(mancha);
    }
  }

  // Coladeras y rejillas de desagüe junto a la guarnición.
  const metal = material(COLORES.coladera, { metalness: 0.6, roughness: 0.5 });
  for (const [x, z] of [[-1.2, 6.2], [8.5, -1.1], [-9.2, 0.9], [1.5, -7.6]]) {
    const tapa = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18).rotateX(-Math.PI / 2), metal);
    tapa.position.set(x, 0.014, z);
    grupo.add(tapa);
  }
  const rejillas = [];
  for (const s of [-1, 1]) {
    rejillas.push({ x: s * 7.5, z: AVENIDA.mediaHorizontal - 0.35, ancho: 0.9, largo: 0.4 });
    rejillas.push({ x: -s * 10, z: -AVENIDA.mediaHorizontal + 0.35, ancho: 0.9, largo: 0.4 });
    rejillas.push({ x: AVENIDA.mediaVertical - 0.35, z: s * 6.8, ancho: 0.4, largo: 0.9 });
  }
  grupo.add(piezasPlanas(rejillas, metal));

  // Basura tirada (papeles, bolsas aplastadas): plana, para que nadie tropiece visualmente.
  const basura = [];
  for (let i = 0; i < 16; i++) {
    basura.push({
      x: (azar() - 0.5) * 2 * (anillo.x - 0.5),
      z: (azar() - 0.5) * 2 * (anillo.z - 0.5),
      ancho: 0.15 + azar() * 0.3,
      largo: 0.1 + azar() * 0.25,
      giro: azar() * Math.PI,
      y: 0.05,
    });
  }
  grupo.add(piezasPlanas(basura, material(COLORES.basura)));
}

// Un edificio: cuerpo, ventanas en las caras que mira la cámara, local con cortina metálica,
// letrero luminoso a veces y tinacos en la azotea.
function crearEdificio(grupo, azar, { x, z, ancho, profundo, alto, caras }, ventanas) {
  const color = EDIFICIOS[Math.floor(azar() * EDIFICIOS.length)];
  grupo.add(caja(ancho, alto, profundo, material(color, { roughness: 0.95 }), x, alto / 2, z));

  for (const cara of caras) {
    // `cara` es la dirección hacia la que mira la fachada: [1,0], [-1,0], [0,1] o [0,-1].
    const [nx, nz] = cara;
    const anchoCara = nx !== 0 ? profundo : ancho;
    const cx = x + (nx * ancho) / 2;
    const cz = z + (nz * profundo) / 2;
    const giro = Math.atan2(nx, nz);
    const columnas = Math.max(1, Math.floor((anchoCara - 0.8) / 1.8));
    for (let piso = 0, y = 4.2; y < alto - 1; piso++, y += 3) {
      for (let c = 0; c < columnas; c++) {
        const desplazamiento = (c - (columnas - 1) / 2) * 1.8;
        ventanas.push({
          x: cx + nx * 0.02 + (nz !== 0 ? desplazamiento : 0),
          y,
          z: cz + nz * 0.02 + (nx !== 0 ? desplazamiento : 0),
          giro,
          encendida: azar() < 0.22,
        });
      }
    }
    // Planta baja: cortina metálica y, a veces, letrero encendido encima.
    const cortina = caja(Math.min(anchoCara - 1, 3.2), 2.4, 0.08, material(COLORES.cortina, { metalness: 0.4 }), 0, 1.2, 0);
    cortina.rotation.y = giro;
    cortina.position.set(cx + nx * 0.04, 1.2, cz + nz * 0.04);
    grupo.add(cortina);
    if (azar() < 0.45) {
      const colorLetrero = LETREROS[Math.floor(azar() * LETREROS.length)];
      const letrero = caja(Math.min(anchoCara - 1.2, 2.6), 0.55, 0.12, material(colorLetrero, { emissive: colorLetrero, emissiveIntensity: 1.6 }), 0, 0, 0);
      letrero.rotation.y = giro;
      letrero.position.set(cx + nx * 0.1, 2.85, cz + nz * 0.1);
      letrero.castShadow = false;
      grupo.add(letrero);
    }
  }

  // Tinacos (y a veces una antena) en la azotea.
  const tinacos = 1 + Math.floor(azar() * 2);
  for (let i = 0; i < tinacos; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.2, 14), material(COLORES.tinaco, { roughness: 0.6 }));
    t.position.set(x + (azar() - 0.5) * (ancho - 1.5), alto + 0.6, z + (azar() - 0.5) * (profundo - 1.5));
    t.castShadow = true;
    grupo.add(t);
  }
  if (azar() < 0.4) {
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 6), material(COLORES.poste, { metalness: 0.5 }));
    antena.position.set(x + (azar() - 0.5) * ancho * 0.6, alto + 1.25, z + (azar() - 0.5) * profundo * 0.6);
    grupo.add(antena);
  }
}

// Hilera de edificios a lo largo del eje x o z, de `desde` a `hasta` (distancias positivas al centro)
// del lado que indica `signo`. `linea` es la coordenada del otro eje donde va el centro de la hilera.
function crearManzana(grupo, azar, { eje, signo, desde, hasta, linea, fondo, altoMin, altoMax, caras }, ventanas) {
  for (let p = desde; p < hasta - 2; ) {
    const ancho = Math.min(4 + azar() * 4, hasta - p);
    const alto = altoMin + azar() * (altoMax - altoMin);
    const centro = signo * (p + ancho / 2);
    const datos =
      eje === 'x'
        ? { x: centro, z: linea, ancho, profundo: fondo, alto }
        : { x: linea, z: centro, ancho: fondo, profundo: ancho, alto };
    crearEdificio(grupo, azar, { ...datos, caras }, ventanas);
    p += ancho + 0.15;
  }
}

function crearEdificios(grupo, azar, anillo) {
  const ventanas = [];
  const { mediaVertical: mv, mediaHorizontal: mh } = AVENIDA;
  const banqueta = 2.2;
  // Líneas de fachada: todo por fuera del anillo de aparición de los enemigos.
  const fachadaFondo = anillo.z + HOLGURA;
  const fachadaLado = anillo.x + HOLGURA;
  const fondoTorres = 9;
  const fondoLado = 8;
  const fondoLocales = 6;
  for (const s of [-1, 1]) {
    // Al fondo (lejos de la cámara): torres altas con fachada hacia el cruce y hacia la avenida vertical.
    crearManzana(grupo, azar, {
      eje: 'x', signo: s, desde: mv + banqueta, hasta: EXTENSION, linea: -(fachadaFondo + fondoTorres / 2),
      fondo: fondoTorres, altoMin: 9, altoMax: 22, caras: [[0, 1], [-s, 0]],
    }, ventanas);
    // A los lados, mitad lejana: edificios medianos; el más cercano a la avenida horizontal muestra su frente.
    crearManzana(grupo, azar, {
      eje: 'z', signo: -1, desde: mh + banqueta, hasta: fachadaFondo, linea: s * (fachadaLado + fondoLado / 2),
      fondo: fondoLado, altoMin: 7, altoMax: 13, caras: [[-s, 0], [0, 1]],
    }, ventanas);
    // A los lados, mitad cercana: más bajos, para no tapar las esquinas de abajo.
    crearManzana(grupo, azar, {
      eje: 'z', signo: 1, desde: mh + banqueta, hasta: EXTENSION * 0.6, linea: s * (fachadaLado + fondoLado / 2),
      fondo: fondoLado, altoMin: 4, altoMax: 8, caras: [[-s, 0]],
    }, ventanas);
    // Cerca de la cámara: locales bajos entre la avenida vertical y los edificios de los lados.
    crearManzana(grupo, azar, {
      eje: 'x', signo: s, desde: mv + banqueta, hasta: fachadaLado, linea: anillo.z + 2.6 + fondoLocales / 2,
      fondo: fondoLocales, altoMin: 3.2, altoMax: 4.2, caras: [],
    }, ventanas);
  }

  // Ventanas: dos mallas instanciadas (encendidas y apagadas).
  for (const [encendidas, mat] of [
    [true, material(COLORES.ventanaEncendida, { emissive: COLORES.ventanaEncendida, emissiveIntensity: 1.3 })],
    [false, material(COLORES.ventanaApagada, { roughness: 0.3, metalness: 0.4 })],
  ]) {
    const lista = ventanas.filter((v) => v.encendida === encendidas);
    const malla = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.3), mat, lista.length);
    const matriz = new THREE.Matrix4();
    const giro = new THREE.Quaternion();
    const eje = new THREE.Vector3(0, 1, 0);
    lista.forEach((v, i) => {
      giro.setFromAxisAngle(eje, v.giro);
      malla.setMatrixAt(i, matriz.compose(new THREE.Vector3(v.x, v.y, v.z), giro, new THREE.Vector3(1, 1, 1)));
    });
    grupo.add(malla);
  }
}

// Con `soloLuz`, pone la luz sin el poste: cerca de la cámara el poste quedaría fuera de cuadro
// y solo se verían su brazo y su lámpara flotando al pie de la pantalla.
function crearPoste(grupo, x, z, haciaX, haciaZ, soloLuz = false) {
  const xLampara = x + haciaX * 1.35;
  const zLampara = z + haciaZ * 1.35;
  const luz = new THREE.PointLight(COLORES.luzCalle, LUZ_CALLE.intensidad, LUZ_CALLE.alcance);
  luz.position.set(xLampara, LUZ_CALLE.altura - 0.4, zLampara);
  grupo.add(luz);
  if (soloLuz) return { luz, lampara: null };

  const metal = material(COLORES.poste, { metalness: 0.5, roughness: 0.6 });
  const poste = caja(0.16, LUZ_CALLE.altura, 0.16, metal, x, LUZ_CALLE.altura / 2, z);
  grupo.add(poste);
  // Brazo hacia la calle y lámpara.
  const brazo = caja(1.4, 0.1, 0.1, metal, 0, 0, 0);
  const angulo = Math.atan2(-haciaZ, haciaX);
  brazo.rotation.y = angulo;
  brazo.position.set(x + haciaX * 0.7, LUZ_CALLE.altura, z + haciaZ * 0.7);
  grupo.add(brazo);
  const lampara = caja(0.5, 0.14, 0.3, material(COLORES.luzCalle, { emissive: COLORES.luzCalle, emissiveIntensity: 2 }), xLampara, LUZ_CALLE.altura - 0.1, zLampara);
  lampara.rotation.y = angulo;
  lampara.castShadow = false;
  grupo.add(lampara);
  return { luz, lampara };
}

function crearSemaforo(grupo, x, z, giro) {
  const metal = material(COLORES.poste, { metalness: 0.5, roughness: 0.6 });
  grupo.add(caja(0.12, 3.2, 0.12, metal, x, 1.6, z));
  const cuerpo = caja(0.34, 0.95, 0.3, material(0x1a1b1e), x, 3.45, z);
  cuerpo.rotation.y = giro;
  grupo.add(cuerpo);
  const focos = [0xff3b30, 0xffb020, 0x3bd16f].map((color, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0 });
    const foco = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), mat);
    foco.position.set(x + Math.sin(giro) * 0.16, 3.75 - i * 0.3, z + Math.cos(giro) * 0.16);
    foco.rotation.y = giro;
    grupo.add(foco);
    return mat;
  });
  return focos;
}

function crearCoche(grupo, azar, x, z, giro) {
  const color = COCHES[Math.floor(azar() * COCHES.length)];
  const coche = new THREE.Group();
  coche.add(caja(4.2, 0.75, 1.8, material(color, { roughness: 0.5, metalness: 0.3 }), 0, 0.65, 0));
  coche.add(caja(2.2, 0.6, 1.6, material(color, { roughness: 0.5, metalness: 0.3 }), -0.2, 1.3, 0));
  const vidrio = material(0x0c1118, { roughness: 0.2, metalness: 0.5 });
  coche.add(caja(2.25, 0.45, 1.62, vidrio, -0.2, 1.32, 0));
  for (const [rx, rz] of [[-1.35, -0.85], [1.35, -0.85], [-1.35, 0.85], [1.35, 0.85]]) {
    const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14), material(0x111111));
    rueda.rotation.x = Math.PI / 2;
    rueda.position.set(rx, 0.36, rz);
    coche.add(rueda);
  }
  coche.position.set(x, 0, z);
  coche.rotation.y = giro;
  grupo.add(coche);
}

function crearArbol(grupo, azar, x, z) {
  const alto = 2.6 + azar() * 1.2;
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, alto, 8), material(COLORES.tronco));
  tronco.position.set(x, alto / 2, z);
  tronco.castShadow = true;
  grupo.add(tronco);
  const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + azar() * 0.5, 0), material(COLORES.copa));
  copa.position.set(x, alto + 0.6, z);
  copa.castShadow = true;
  grupo.add(copa);
}

// `anillo` es la mitad del rectángulo donde aparecen los enemigos: { x, z }.
export function crearEscenario(anillo) {
  const grupo = new THREE.Group();
  const azar = crearAzar(7);
  crearSuelo(grupo, azar);
  crearGlorieta(grupo);
  crearMarcas(grupo, anillo);
  crearDetallesDelSuelo(grupo, azar, anillo);
  crearEdificios(grupo, azar, anillo);

  // Postes de luz en las esquinas, por fuera del anillo de aparición.
  const fueraX = anillo.x + HOLGURA;
  const fueraZ = anillo.z + HOLGURA;
  const postes = [
    crearPoste(grupo, -fueraX, -(AVENIDA.mediaHorizontal + 0.8), 0, 1),
    crearPoste(grupo, fueraX, -(AVENIDA.mediaHorizontal + 0.8), 0, 1),
    crearPoste(grupo, -fueraX, AVENIDA.mediaHorizontal + 0.8, 0, -1),
    crearPoste(grupo, fueraX, AVENIDA.mediaHorizontal + 0.8, 0, -1),
    crearPoste(grupo, -(AVENIDA.mediaVertical + 3.2), -fueraZ, 1, 0),
    crearPoste(grupo, AVENIDA.mediaVertical + 3.2, -fueraZ, -1, 0),
    crearPoste(grupo, -(AVENIDA.mediaVertical + 3.2), fueraZ, 1, 0, true),
    crearPoste(grupo, AVENIDA.mediaVertical + 3.2, fueraZ, -1, 0, true),
  ];
  const parpadeante = postes[1];

  const semaforos = [
    crearSemaforo(grupo, -(AVENIDA.mediaVertical + 0.6), -fueraZ, 0),
    crearSemaforo(grupo, AVENIDA.mediaVertical + 0.6, fueraZ, Math.PI),
    crearSemaforo(grupo, -fueraX, AVENIDA.mediaHorizontal + 0.6, Math.PI / 2),
    crearSemaforo(grupo, fueraX, -(AVENIDA.mediaHorizontal + 0.6), -Math.PI / 2),
  ];

  // Coches abandonados más allá del cruce.
  crearCoche(grupo, azar, -(fueraX + 4.5), 2.1, 0.08);
  crearCoche(grupo, azar, fueraX + 6, -1.9, Math.PI - 0.12);
  crearCoche(grupo, azar, 2.1, -(fueraZ + 6.5), Math.PI / 2 + 0.06);
  crearCoche(grupo, azar, -(fueraX + 11), -2.2, Math.PI + 0.3);

  // Árboles en las banquetas del fondo.
  for (const x of [-11.5, -16, 11.5, 16]) crearArbol(grupo, azar, x, -(fueraZ + 0.4));

  let tiempo = 0;
  let siguienteCambio = 0;
  return {
    grupo,
    // Animaciones del decorado: la lámpara que parpadea y el ciclo de los semáforos.
    actualizar(dt) {
      tiempo += dt;
      if (tiempo >= siguienteCambio) {
        const encendida = azar() > 0.25;
        const fuerza = encendida ? 1 : PARPADEO.minimo;
        parpadeante.luz.intensity = LUZ_CALLE.intensidad * fuerza;
        if (parpadeante.lampara) parpadeante.lampara.material.emissiveIntensity = 2 * fuerza;
        siguienteCambio = tiempo + PARPADEO.cambio + azar() * (encendida ? 1.2 : 0.15);
      }
      const ciclo = SEMAFORO.verde + SEMAFORO.ambar + SEMAFORO.rojo;
      semaforos.forEach((focos, i) => {
        // Los de una avenida van desfasados con los de la otra.
        const t = (tiempo + (i % 2) * (SEMAFORO.verde + SEMAFORO.ambar)) % ciclo;
        const activo = t < SEMAFORO.verde ? 2 : t < SEMAFORO.verde + SEMAFORO.ambar ? 1 : 0;
        focos.forEach((mat, j) => (mat.emissiveIntensity = j === activo ? 2.2 : 0.05));
      });
    },
  };
}
