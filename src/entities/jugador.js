import * as THREE from 'three';
import { crearAvatar } from './avatar.js';
import { crearManguera } from './manguera.js';

// Puramente visual: al disparar, el avatar retrocede un poco y vibra con la presión del agua;
// en reposo respira. Distancias en metros, frecuencias en rad/s.
const RETROCESO = { distancia: 0.045, vibracion: 0.008, frecuenciaVibracion: 55, respuesta: 12 };
const RESPIRACION = { amplitud: 0.006, frecuencia: 2.2 };

// El avatar y la manguera cuelgan de un pivote en el eje del pozo:
// al girar el pivote, el avatar rodea el brocal y la boquilla apunta hacia afuera.
export function crearJugador(pozo, { escala, distanciaAlBrocal }) {
  const pivote = new THREE.Group();
  // Avatar y boquilla se mueven juntos al retroceder, para que las manos no se separen de ella.
  const cuerpo = new THREE.Group();
  pivote.add(cuerpo);

  const avatar = crearAvatar();
  avatar.grupo.scale.setScalar(escala);
  avatar.grupo.position.x = pozo.radio + distanciaAlBrocal;
  const agarre = avatar.agarre.multiplyScalar(escala).add(avatar.grupo.position);

  const manguera = crearManguera(pozo, agarre, escala);
  cuerpo.add(avatar.grupo, manguera.grupo);

  let tiempo = 0;
  let retroceso = 0;

  return {
    grupo: pivote,
    // Distancias al eje del pozo. La boquilla queda sobre el eje radial del pivote (z = 0).
    distanciaCuerpo: avatar.grupo.position.x,
    distanciaPunta: manguera.punta.x,
    alturaPunta: manguera.punta.y,
    // El ángulo lógico va de +x hacia +z; en Three.js, rotation.y positiva gira de +x hacia -z.
    // `dt` anima la respiración y el retroceso; con 0 todo queda quieto (pausa).
    sincronizar(apuntado, disparando, dt) {
      pivote.rotation.y = -apuntado.angulo;
      tiempo += dt;
      retroceso += ((disparando ? 1 : 0) - retroceso) * (1 - Math.exp(-RETROCESO.respuesta * dt));
      const vibracion = Math.sin(tiempo * RETROCESO.frecuenciaVibracion) * RETROCESO.vibracion * retroceso;
      cuerpo.position.x = -RETROCESO.distancia * retroceso + vibracion;
      avatar.grupo.scale.y = escala * (1 + Math.sin(tiempo * RESPIRACION.frecuencia) * RESPIRACION.amplitud);
    },
  };
}
