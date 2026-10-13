import * as THREE from 'three';
import { ESTADOS, esObjetivo } from '../systems/enemigos.js';

// Ciudadano provisional hecho con primitivas (cuerpo y cabeza) hasta que exista el GLB.
// Medidas en metros; el ancho crece con el tamaño del tipo y la altura se mantiene.
const ALTO_HOMBROS = 1.38;
const RADIO_CABEZA = 0.16;
const SEGMENTOS = 16;
// Vaivén al caminar, puramente visual.
const PASO = { frecuencia: 9, altura: 0.05 };
// Embestida hacia el pozo en cada golpe, puramente visual (metros y segundos).
const EMBESTIDA = { distancia: 0.35, duracion: 0.3 };
// Tono azulado mientras recibe agua y qué tan rápido (1/s) aparece o se va.
const BRILLO_MOJADO = new THREE.Color(0x1d5f86);
const RESPUESTA_BRILLO = 10;
// Al quedar limpio: destello blanco con un pequeño salto de tamaño, y luego un brillo suave
// que lo distingue de los sucios mientras se retira.
const BLANCO = new THREE.Color(0xffffff);
const DESTELLO = { duracion: 0.6, crecimiento: 0.2 };
const BRILLO_LIMPIO = 0.18;
// Barra de limpieza sobre la cabeza: siempre de frente a la cámara y por encima de todo.
const BARRA = { ancho: 0.8, alto: 0.09, altura: 2.05, borde: 0.02, fondo: 0x07090c, opacidadFondo: 0.75, relleno: 0x8fd8ff };
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
const ARMA = { alturaManos: 1.0, agarre: 0.25, inclinacion: 0.25, golpe: 0.5, segmentos: 8 };

function crearArma(arma) {
  const grupo = new THREE.Group();
  const piezas = [];
  const palo = new THREE.Mesh(
    new THREE.CylinderGeometry(arma.grosor, arma.grosor, arma.largo, ARMA.segmentos),
    new THREE.MeshStandardMaterial({ color: arma.color, roughness: 0.8 }),
  );
  // El cilindro nace sobre +y; se acuesta hacia +x con un tramo detrás de las manos.
  palo.rotation.z = -Math.PI / 2;
  palo.position.x = arma.largo / 2 - ARMA.agarre;
  piezas.push(palo);
  if (arma.cabeza) {
    const cabeza = new THREE.Mesh(
      new THREE.BoxGeometry(arma.cabeza.largo, arma.grosor * 3, arma.cabeza.ancho),
      new THREE.MeshStandardMaterial({ color: arma.cabeza.color, roughness: 0.9 }),
    );
    cabeza.position.x = arma.largo - ARMA.agarre;
    piezas.push(cabeza);
  }
  for (const pieza of piezas) {
    pieza.castShadow = true;
    grupo.add(pieza);
  }
  return {
    grupo,
    destruir() {
      for (const pieza of piezas) {
        pieza.geometry.dispose();
        pieza.material.dispose();
      }
    },
  };
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

// `orientacionCamara` es el quaternion de la cámara fija, para que la barra le dé la cara.
export function crearEnemigoVisual({ tipo, radio, arma }, orientacionCamara) {
  const colorBase = new THREE.Color(tipo.colorBase);
  const colorLimpio = new THREE.Color(tipo.colorLimpio);
  const material = new THREE.MeshStandardMaterial({ color: colorBase, roughness: 0.9 });

  const cuerpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(radio, ALTO_HOMBROS - radio * 2, 4, SEGMENTOS),
    material,
  );
  cuerpo.position.y = ALTO_HOMBROS / 2;
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(RADIO_CABEZA, SEGMENTOS, SEGMENTOS), material);
  cabeza.position.y = ALTO_HOMBROS + RADIO_CABEZA * 0.8;

  const figura = new THREE.Group();
  figura.add(cuerpo, cabeza);
  for (const pieza of [cuerpo, cabeza]) {
    pieza.castShadow = true;
    pieza.receiveShadow = true;
  }
  const armaVisual = arma ? crearArma(arma) : null;
  if (armaVisual) {
    armaVisual.grupo.position.set(radio * 0.9, ARMA.alturaManos, radio * 0.5);
    figura.add(armaVisual.grupo);
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

  // Al quedar limpio suelta el arma: queda tirada en el suelo frente a donde estaba.
  function soltarArma(enemigo) {
    const { grupo: armaGrupo } = armaVisual;
    figura.remove(armaGrupo);
    armaGrupo.position.set(enemigo.x, arma.grosor, enemigo.z);
    armaGrupo.rotation.set(0, figura.rotation.y, 0);
    armaGrupo.translateX(radio);
    grupo.add(armaGrupo);
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

      const caminando = enemigo.estado === ESTADOS.AVANZANDO || enemigo.estado === ESTADOS.RETIRANDOSE;
      if (caminando) fase += PASO.frecuencia * dt;
      figura.position.y = caminando ? Math.abs(Math.sin(fase)) * PASO.altura : 0;

      // Se lanza hacia el pozo y regresa justo después de cada golpe.
      const avanceGolpe = enemigo.tiempoDesdeGolpe / EMBESTIDA.duracion;
      const golpeando = enemigo.estado === ESTADOS.EN_POZO && avanceGolpe < 1;
      const fuerzaGolpe = golpeando ? Math.sin(Math.PI * avanceGolpe) : 0;
      figura.position.x = (-enemigo.x / distancia) * fuerzaGolpe * EMBESTIDA.distancia;
      figura.position.z = (-enemigo.z / distancia) * fuerzaGolpe * EMBESTIDA.distancia;
      if (armaVisual && tiempoLimpio === null) armaVisual.grupo.rotation.z = -(ARMA.inclinacion + ARMA.golpe * fuerzaGolpe);

      material.color.lerpColors(colorBase, colorLimpio, progreso);

      const sucio = esObjetivo(enemigo);
      barra.visible = sucio && progreso > 0;
      relleno.scale.x = Math.max(progreso, 0.001);

      if (sucio) {
        mojado += ((recibeAgua ? 1 : 0) - mojado) * (1 - Math.exp(-RESPUESTA_BRILLO * dt));
        material.emissive.copy(BRILLO_MOJADO).multiplyScalar(mojado);
        return;
      }

      if (tiempoLimpio === null && armaVisual) soltarArma(enemigo);
      tiempoLimpio = tiempoLimpio === null ? 0 : tiempoLimpio + dt;
      const avance = Math.min(tiempoLimpio / DESTELLO.duracion, 1);
      material.emissive.copy(BLANCO).multiplyScalar(BRILLO_LIMPIO + (1 - BRILLO_LIMPIO) * (1 - avance));
      figura.scale.setScalar(1 + Math.sin(Math.PI * avance) * DESTELLO.crecimiento);
    },
    destruir() {
      cuerpo.geometry.dispose();
      cabeza.geometry.dispose();
      material.dispose();
      armaVisual?.destruir();
    },
  };
}
