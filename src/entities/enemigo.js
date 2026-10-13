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
export function crearEnemigoVisual({ tipo, radio }, orientacionCamara) {
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
  const { barra, relleno } = crearBarra();
  barra.quaternion.copy(orientacionCamara);
  const grupo = new THREE.Group();
  grupo.add(figura, barra);

  let fase = 0;
  let mojado = 0;
  // Segundos desde que quedó limpio; null mientras siga sucio.
  let tiempoLimpio = null;

  return {
    grupo,
    // `progreso` va de 0 (sucio) a 1 (limpio).
    sincronizar(enemigo, recibeAgua, progreso, dt) {
      grupo.position.set(enemigo.x, 0, enemigo.z);

      const caminando = enemigo.estado === ESTADOS.AVANZANDO || enemigo.estado === ESTADOS.RETIRANDOSE;
      if (caminando) fase += PASO.frecuencia * dt;
      figura.position.y = caminando ? Math.abs(Math.sin(fase)) * PASO.altura : 0;

      // Se lanza hacia el pozo y regresa justo después de cada golpe.
      const avanceGolpe = enemigo.tiempoDesdeGolpe / EMBESTIDA.duracion;
      const golpeando = enemigo.estado === ESTADOS.EN_POZO && avanceGolpe < 1;
      const embestida = golpeando ? Math.sin(Math.PI * avanceGolpe) * EMBESTIDA.distancia : 0;
      const distancia = Math.hypot(enemigo.x, enemigo.z) || 1;
      figura.position.x = (-enemigo.x / distancia) * embestida;
      figura.position.z = (-enemigo.z / distancia) * embestida;

      material.color.lerpColors(colorBase, colorLimpio, progreso);

      const sucio = esObjetivo(enemigo);
      barra.visible = sucio && progreso > 0;
      relleno.scale.x = Math.max(progreso, 0.001);

      if (sucio) {
        mojado += ((recibeAgua ? 1 : 0) - mojado) * (1 - Math.exp(-RESPUESTA_BRILLO * dt));
        material.emissive.copy(BRILLO_MOJADO).multiplyScalar(mojado);
        return;
      }

      tiempoLimpio = tiempoLimpio === null ? 0 : tiempoLimpio + dt;
      const avance = Math.min(tiempoLimpio / DESTELLO.duracion, 1);
      material.emissive.copy(BLANCO).multiplyScalar(BRILLO_LIMPIO + (1 - BRILLO_LIMPIO) * (1 - avance));
      figura.scale.setScalar(1 + Math.sin(Math.PI * avance) * DESTELLO.crecimiento);
    },
    destruir() {
      cuerpo.geometry.dispose();
      cabeza.geometry.dispose();
      material.dispose();
    },
  };
}
