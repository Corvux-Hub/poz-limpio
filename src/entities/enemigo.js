import * as THREE from 'three';
import { ESTADOS } from '../systems/enemigos.js';

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

export function crearEnemigoVisual({ tipo, radio }) {
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
  const grupo = new THREE.Group();
  grupo.add(figura);

  let fase = 0;
  let mojado = 0;

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
      mojado += ((recibeAgua ? 1 : 0) - mojado) * (1 - Math.exp(-RESPUESTA_BRILLO * dt));
      material.emissive.copy(BRILLO_MOJADO).multiplyScalar(mojado);
    },
    destruir() {
      cuerpo.geometry.dispose();
      cabeza.geometry.dispose();
      material.dispose();
    },
  };
}
