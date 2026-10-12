import * as THREE from 'three';

// Traduce el cursor a un punto del suelo (y = 0) con un raycast desde la cámara.
export function crearInput(canvas, camara) {
  const raycaster = new THREE.Raycaster();
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const cursor = new THREE.Vector2();
  const punto = new THREE.Vector3();
  let cursorDentro = false;

  canvas.addEventListener('pointermove', (evento) => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
    cursor.y = -((evento.clientY - rect.top) / rect.height) * 2 + 1;
    cursorDentro = true;
  });

  return {
    // Se recalcula cada cuadro porque el encuadre cambia al redimensionar aunque el ratón no se mueva.
    // Devuelve null mientras el cursor no haya entrado al canvas.
    puntoEnSuelo() {
      if (!cursorDentro) return null;
      raycaster.setFromCamera(cursor, camara);
      return raycaster.ray.intersectPlane(planoSuelo, punto);
    },
  };
}
