import * as THREE from 'three';
import { ESTADOS, esObjetivo } from '../systems/enemigos.js';

// Ciudadano provisional hecho con primitivas hasta que exista el GLB: piernas y brazos que se
// balancean al caminar, torso, cabeza y un accesorio según su tipo (aspecto en enemies.json).
// Medidas en metros. El tamaño del tipo los hace más anchos (y con barriga), no más altos.
// La figura mira hacia +x y su derecha es +z.
const CUERPO = {
  cadera: 0.85,
  hombros: 1.38,
  radioPierna: 0.075,
  radioBrazo: 0.06,
  largoBrazo: 0.55,
  radioCabeza: 0.15,
  // El torso es una cápsula de este radio, estirada al ancho de cada enemigo.
  radioTorso: 0.22,
  profundidad: 0.75,
};
const SEGMENTOS = 14;
// Color de la piel: sucia al principio, limpia al final.
const PIEL = { sucia: new THREE.Color(0x5b4a3c), limpia: new THREE.Color(0xd6a888) };
// Andar: metros por zancada completa, cuánto abren piernas y brazos (rad) y cuánto rebotan (m).
const ANDAR = { zancada: 1.15, piernas: 0.5, brazos: 0.4, rebote: 0.04, balanceo: 0.06 };
// Embestida hacia el pozo en cada golpe, puramente visual (metros y segundos).
const EMBESTIDA = { distancia: 0.35, duracion: 0.3 };
// Brazos (rad, hacia el frente): frente al pozo, al golpear sin arma y sosteniendo un arma.
const BRAZOS = { enPozo: 0.25, golpe: 1.4, armaDerecho: 1.1, armaIzquierdo: 0.95 };
// Brillo tóxico de los sucios (se apaga al limpiarse) y azul mientras reciben agua.
const BRILLO_TOXICO = { color: new THREE.Color(0x34500f), intensidad: 0.22 };
const BRILLO_MOJADO = new THREE.Color(0x1d5f86);
const RESPUESTA_BRILLO = 10;
// Al quedar limpio: destello blanco con un pequeño salto de tamaño, y luego un brillo suave
// que lo distingue de los sucios mientras se retira.
const BLANCO = new THREE.Color(0xffffff);
const DESTELLO = { duracion: 0.6, crecimiento: 0.2 };
const BRILLO_LIMPIO = 0.18;
// Barra de limpieza sobre la cabeza: siempre de frente a la cámara y por encima de todo.
const BARRA = { ancho: 0.8, alto: 0.09, altura: 2.1, borde: 0.02, fondo: 0x07090c, opacidadFondo: 0.75, relleno: 0x8fd8ff };
const geometriaFondo = new THREE.PlaneGeometry(BARRA.ancho + BARRA.borde * 2, BARRA.alto + BARRA.borde * 2);
// El relleno crece desde su borde izquierdo.
const geometriaRelleno = new THREE.PlaneGeometry(BARRA.ancho, BARRA.alto).translate(BARRA.ancho / 2, 0, 0);
const materialFondo = new THREE.MeshBasicMaterial({
  color: BARRA.fondo,
  transparent: true,
  opacity: BARRA.opacidadFondo,
  depthTest: false,
});
const materialRelleno = new THREE.MeshBasicMaterial({ color: BARRA.relleno, depthTest: false });

// Arma improvisada (de armas.json) sostenida con las manos frente al cuerpo, apuntando hacia
// adelante (+x local) y un poco hacia abajo. En cada golpe baja un poco más.
const ARMA = { agarre: 0.25, inclinacion: 0.25, golpe: 0.5, segmentos: 8 };

function pieza(geometria, material) {
  const m = new THREE.Mesh(geometria, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function crearArma(arma) {
  const grupo = new THREE.Group();
  const palo = pieza(
    new THREE.CylinderGeometry(arma.grosor, arma.grosor, arma.largo, ARMA.segmentos),
    new THREE.MeshStandardMaterial({ color: arma.color, roughness: 0.8 }),
  );
  // El cilindro nace sobre +y; se acuesta hacia +x con un tramo detrás de las manos.
  palo.rotation.z = -Math.PI / 2;
  palo.position.x = arma.largo / 2 - ARMA.agarre;
  grupo.add(palo);
  if (arma.cabeza) {
    const cabeza = pieza(
      new THREE.BoxGeometry(arma.cabeza.largo, arma.grosor * 3, arma.cabeza.ancho),
      new THREE.MeshStandardMaterial({ color: arma.cabeza.color, roughness: 0.9 }),
    );
    cabeza.position.x = arma.largo - ARMA.agarre;
    grupo.add(cabeza);
  }
  return grupo;
}

function crearBarra() {
  const barra = new THREE.Group();
  const fondo = new THREE.Mesh(geometriaFondo, materialFondo);
  const relleno = new THREE.Mesh(geometriaRelleno, materialRelleno);
  relleno.position.set(-BARRA.ancho / 2, 0, 0.001);
  fondo.renderOrder = 10;
  relleno.renderOrder = 11;
  barra.add(fondo, relleno);
  barra.position.y = BARRA.altura;
  barra.visible = false;
  return { barra, relleno };
}

// Extremidad que cuelga de una articulación: el grupo es la articulación y se gira para moverla.
function crearExtremidad(radio, largo, material, materialPunta, radioPunta) {
  const articulacion = new THREE.Group();
  const hueso = pieza(new THREE.CapsuleGeometry(radio, largo - radio * 2, 4, SEGMENTOS), material);
  hueso.position.y = -largo / 2;
  const punta = pieza(new THREE.SphereGeometry(radioPunta, 10, 8), materialPunta);
  punta.position.y = -largo;
  articulacion.add(hueso, punta);
  return articulacion;
}

// Accesorios que distinguen a cada tipo. Todos usan el material del accesorio.
const ACCESORIOS = {
  gorra(figura, material, { yCabeza }) {
    const copa = pieza(new THREE.SphereGeometry(CUERPO.radioCabeza * 1.04, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), material);
    copa.position.y = yCabeza + 0.01;
    const visera = pieza(new THREE.BoxGeometry(0.15, 0.015, 0.17), material);
    visera.position.set(CUERPO.radioCabeza * 0.95, yCabeza + 0.035, 0);
    figura.add(copa, visera);
  },
  casco(figura, material, { yCabeza }) {
    const copa = pieza(new THREE.SphereGeometry(CUERPO.radioCabeza * 1.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), material);
    copa.position.y = yCabeza + 0.02;
    const ala = pieza(new THREE.CylinderGeometry(CUERPO.radioCabeza * 1.45, CUERPO.radioCabeza * 1.45, 0.02, 18), material);
    ala.position.y = yCabeza + 0.03;
    figura.add(copa, ala);
  },
  corbata(figura, material, { frenteTorso }) {
    const corbata = pieza(new THREE.BoxGeometry(0.012, 0.32, 0.06), material);
    corbata.position.set(frenteTorso + 0.006, CUERPO.hombros - 0.22, 0);
    const nudo = pieza(new THREE.BoxGeometry(0.02, 0.05, 0.07), material);
    nudo.position.set(frenteTorso + 0.004, CUERPO.hombros - 0.05, 0);
    figura.add(corbata, nudo);
  },
  chaleco(figura, material, { torso }) {
    // Franjas reflejantes alrededor del torso.
    for (const y of [-0.1, 0.12]) {
      const franja = pieza(new THREE.CylinderGeometry(CUERPO.radioTorso * 1.03, CUERPO.radioTorso * 1.03, 0.05, 18, 1, true), material);
      franja.position.copy(torso.position);
      franja.position.y += y;
      franja.scale.copy(torso.scale);
      figura.add(franja);
    }
  },
};

// `orientacionCamara` es el quaternion de la cámara fija, para que la barra le dé la cara.
export function crearEnemigoVisual({ tipo, radio, arma }, orientacionCamara) {
  const ropaSucia = new THREE.Color(tipo.colorBase);
  const ropaLimpia = new THREE.Color(tipo.colorLimpio);
  const pantalonSucio = ropaSucia.clone().multiplyScalar(0.6);
  const pantalonLimpio = ropaLimpia.clone().multiplyScalar(0.82);
  const accesorioLimpio = new THREE.Color(tipo.aspecto?.colorAccesorio ?? tipo.colorLimpio).lerp(BLANCO, 0.3);
  const accesorioSucio = new THREE.Color(tipo.aspecto?.colorAccesorio ?? tipo.colorBase).lerp(ropaSucia, 0.55).multiplyScalar(0.7);

  const ropa = new THREE.MeshStandardMaterial({ color: ropaSucia, roughness: 0.9 });
  const pantalon = new THREE.MeshStandardMaterial({ color: pantalonSucio, roughness: 0.9 });
  const piel = new THREE.MeshStandardMaterial({ color: PIEL.sucia, roughness: 0.8 });
  const accesorio = new THREE.MeshStandardMaterial({ color: accesorioSucio, roughness: 0.6 });
  const materiales = [ropa, pantalon, piel, accesorio];

  const figura = new THREE.Group();
  const grueso = radio / CUERPO.radioTorso;
  const separacionPiernas = radio * 0.42;

  // Piernas colgando de la cadera.
  const piernas = [-1, 1].map((lado) => {
    const pierna = crearExtremidad(CUERPO.radioPierna * Math.sqrt(grueso), CUERPO.cadera, pantalon, pantalon, CUERPO.radioPierna * 1.1);
    pierna.position.set(0, CUERPO.cadera, lado * separacionPiernas);
    figura.add(pierna);
    return pierna;
  });

  // Torso estirado al ancho del enemigo; los corpulentos llevan barriga.
  const largoTorso = CUERPO.hombros - CUERPO.cadera + 0.05 - CUERPO.radioTorso * 2;
  const torso = pieza(new THREE.CapsuleGeometry(CUERPO.radioTorso, largoTorso, 4, SEGMENTOS), ropa);
  torso.position.y = (CUERPO.cadera + CUERPO.hombros) / 2;
  torso.scale.set(grueso * CUERPO.profundidad, 1, grueso);
  figura.add(torso);
  if (tipo.tamano > 1) {
    const barriga = pieza(new THREE.SphereGeometry(radio * 0.62, SEGMENTOS, 10), ropa);
    barriga.position.set(radio * 0.42, CUERPO.cadera + 0.18, 0);
    barriga.scale.set(0.9, 0.85, 1.1);
    figura.add(barriga);
  }

  const yCabeza = CUERPO.hombros + 0.05 + CUERPO.radioCabeza;
  const cabeza = pieza(new THREE.SphereGeometry(CUERPO.radioCabeza, SEGMENTOS, 12), piel);
  cabeza.position.y = yCabeza;
  figura.add(cabeza);

  // Brazos colgando de los hombros, por fuera del torso.
  const brazos = [-1, 1].map((lado) => {
    const brazo = crearExtremidad(CUERPO.radioBrazo * Math.sqrt(grueso), CUERPO.largoBrazo, ropa, piel, CUERPO.radioBrazo * 0.9);
    brazo.position.set(0, CUERPO.hombros - 0.06, lado * (radio + CUERPO.radioBrazo * 0.5));
    figura.add(brazo);
    return brazo;
  });
  const [brazoIzquierdo, brazoDerecho] = brazos;

  const frenteTorso = CUERPO.radioTorso * grueso * CUERPO.profundidad;
  for (const nombre of tipo.aspecto?.accesorios ?? []) {
    ACCESORIOS[nombre]?.(figura, accesorio, { yCabeza, frenteTorso, torso });
  }

  // Arma en la mano derecha, con el brazo extendido al frente.
  const armaGrupo = arma ? crearArma(arma) : null;
  if (armaGrupo) {
    armaGrupo.position.set(
      Math.sin(BRAZOS.armaDerecho) * CUERPO.largoBrazo,
      brazoDerecho.position.y - Math.cos(BRAZOS.armaDerecho) * CUERPO.largoBrazo,
      brazoDerecho.position.z * 0.6,
    );
    figura.add(armaGrupo);
  }

  const { barra, relleno } = crearBarra();
  barra.quaternion.copy(orientacionCamara);
  // `movil` sigue al enemigo; `grupo` queda fijo en el origen para que el arma soltada se quede donde cayó.
  const movil = new THREE.Group();
  movil.add(figura, barra);
  const grupo = new THREE.Group();
  grupo.add(movil);

  let fase = 0;
  let mojado = 0;
  // Segundos desde que quedó limpio; null mientras siga sucio.
  let tiempoLimpio = null;
  let armaEnMano = Boolean(armaGrupo);
  const brillo = new THREE.Color();

  // Al quedar limpio suelta el arma: queda tirada en el suelo frente a donde estaba.
  function soltarArma(enemigo) {
    figura.remove(armaGrupo);
    armaGrupo.position.set(enemigo.x, arma.grosor, enemigo.z);
    armaGrupo.rotation.set(0, figura.rotation.y, 0);
    armaGrupo.translateX(radio + 0.2);
    grupo.add(armaGrupo);
    armaEnMano = false;
  }

  function moverExtremidades(enemigo, dt, fuerzaGolpe) {
    const caminando = enemigo.estado === ESTADOS.AVANZANDO || enemigo.estado === ESTADOS.RETIRANDOSE;
    // El paso va al ritmo de su velocidad: los grandes y lentos caminan más pesado.
    if (caminando) fase += ((enemigo.tipo.velocidad * dt) / ANDAR.zancada) * Math.PI * 2;
    const vaiven = caminando ? Math.sin(fase) : 0;
    piernas[0].rotation.z = vaiven * ANDAR.piernas;
    piernas[1].rotation.z = -vaiven * ANDAR.piernas;
    figura.position.y = caminando ? Math.abs(Math.sin(fase)) * ANDAR.rebote : 0;
    figura.rotation.x = caminando ? Math.sin(fase) * ANDAR.balanceo * (enemigo.tipo.tamano - 0.5) : 0;

    if (armaEnMano) {
      brazoDerecho.rotation.z = BRAZOS.armaDerecho;
      brazoIzquierdo.rotation.z = BRAZOS.armaIzquierdo;
      armaGrupo.rotation.z = -(ARMA.inclinacion + ARMA.golpe * fuerzaGolpe);
    } else if (enemigo.estado === ESTADOS.EN_POZO) {
      const alcance = BRAZOS.enPozo + BRAZOS.golpe * fuerzaGolpe;
      brazoDerecho.rotation.z = alcance;
      brazoIzquierdo.rotation.z = alcance;
    } else {
      brazoDerecho.rotation.z = -vaiven * ANDAR.brazos;
      brazoIzquierdo.rotation.z = vaiven * ANDAR.brazos;
    }
  }

  return {
    grupo,
    // `progreso` va de 0 (sucio) a 1 (limpio).
    sincronizar(enemigo, recibeAgua, progreso, dt) {
      movil.position.set(enemigo.x, 0, enemigo.z);
      const distancia = Math.hypot(enemigo.x, enemigo.z) || 1;
      // Mira al pozo; al retirarse le da la espalda. El ángulo va de +x hacia +z.
      const sentido = enemigo.estado === ESTADOS.RETIRANDOSE ? 1 : -1;
      figura.rotation.y = -Math.atan2(sentido * enemigo.z, sentido * enemigo.x);

      // Se lanza hacia el pozo y regresa justo después de cada golpe.
      const avanceGolpe = enemigo.tiempoDesdeGolpe / EMBESTIDA.duracion;
      const golpeando = enemigo.estado === ESTADOS.EN_POZO && avanceGolpe < 1;
      const fuerzaGolpe = golpeando ? Math.sin(Math.PI * avanceGolpe) : 0;
      figura.position.x = (-enemigo.x / distancia) * fuerzaGolpe * EMBESTIDA.distancia;
      figura.position.z = (-enemigo.z / distancia) * fuerzaGolpe * EMBESTIDA.distancia;
      moverExtremidades(enemigo, dt, fuerzaGolpe);

      ropa.color.lerpColors(ropaSucia, ropaLimpia, progreso);
      pantalon.color.lerpColors(pantalonSucio, pantalonLimpio, progreso);
      piel.color.lerpColors(PIEL.sucia, PIEL.limpia, progreso);
      accesorio.color.lerpColors(accesorioSucio, accesorioLimpio, progreso);

      const sucio = esObjetivo(enemigo);
      barra.visible = sucio && progreso > 0;
      relleno.scale.x = Math.max(progreso, 0.001);

      if (sucio) {
        mojado += ((recibeAgua ? 1 : 0) - mojado) * (1 - Math.exp(-RESPUESTA_BRILLO * dt));
        // Brillo tóxico que se apaga conforme se limpia, más el azul de estar mojado.
        brillo.copy(BRILLO_TOXICO.color).multiplyScalar(BRILLO_TOXICO.intensidad * (1 - progreso));
        brillo.lerp(BRILLO_MOJADO, mojado);
        for (const material of materiales) material.emissive.copy(brillo);
        return;
      }

      if (tiempoLimpio === null && armaEnMano) soltarArma(enemigo);
      tiempoLimpio = tiempoLimpio === null ? 0 : tiempoLimpio + dt;
      const avance = Math.min(tiempoLimpio / DESTELLO.duracion, 1);
      brillo.copy(BLANCO).multiplyScalar(BRILLO_LIMPIO + (1 - BRILLO_LIMPIO) * (1 - avance));
      for (const material of materiales) material.emissive.copy(brillo);
      figura.scale.setScalar(1 + Math.sin(Math.PI * avance) * DESTELLO.crecimiento);
    },
    destruir() {
      grupo.traverse((objeto) => {
        if (!objeto.isMesh || objeto.geometry === geometriaFondo || objeto.geometry === geometriaRelleno) return;
        objeto.geometry.dispose();
        if (!materiales.includes(objeto.material)) objeto.material.dispose();
      });
      for (const material of materiales) material.dispose();
    },
  };
}
