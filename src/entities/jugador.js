import * as THREE from 'three';
import { crearAvatar } from './avatar.js';
import { crearManguera } from './manguera.js';

// El avatar y la manguera cuelgan de un pivote en el eje del pozo:
// al girar el pivote, el avatar rodea el brocal y la boquilla apunta hacia afuera.
export function crearJugador(pozo, { escala, distanciaAlBrocal }) {
  const pivote = new THREE.Group();

  const avatar = crearAvatar();
  avatar.grupo.scale.setScalar(escala);
  avatar.grupo.position.x = pozo.radio + distanciaAlBrocal;
  const agarre = avatar.agarre.multiplyScalar(escala).add(avatar.grupo.position);

  const manguera = crearManguera(pozo, agarre, escala);
  pivote.add(avatar.grupo, manguera.grupo);

  return {
    grupo: pivote,
    // Distancias al eje del pozo. La boquilla queda sobre el eje radial del pivote (z = 0).
    distanciaCuerpo: avatar.grupo.position.x,
    distanciaPunta: manguera.punta.x,
    alturaPunta: manguera.punta.y,
    // El ángulo lógico va de +x hacia +z; en Three.js, rotation.y positiva gira de +x hacia -z.
    sincronizar(apuntado) {
      pivote.rotation.y = -apuntado.angulo;
    },
  };
}
