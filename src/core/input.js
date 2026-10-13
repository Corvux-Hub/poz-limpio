import * as THREE from 'three';

const TECLAS_PAUSA = new Set(['Space', 'Escape']);

// Traduce el cursor a un punto de un plano horizontal (raycast desde la cámara), lleva el estado del clic
// y avisa cuando se pide pausa (Espacio o Esc).
// El plano va a la altura de la cintura: con la cámara inclinada, poner el cursor sobre el cuerpo
// de alguien apunta a ese alguien y no al suelo detrás de él.
export function crearInput(canvas, camara, alturaPlano) {
  const raycaster = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -alturaPlano);
  const cursor = new THREE.Vector2();
  const punto = new THREE.Vector3();
  let cursorDentro = false;
  let disparando = false;
  let alPedirPausa = null;

  const leerCursor = (evento) => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
    cursor.y = -((evento.clientY - rect.top) / rect.height) * 2 + 1;
    cursorDentro = true;
  };

  canvas.addEventListener('pointermove', leerCursor);
  canvas.addEventListener('pointerdown', (evento) => {
    if (evento.button !== 0) return;
    leerCursor(evento);
    disparando = true;
    // Sigue recibiendo movimientos aunque el cursor salga del canvas con el botón apretado.
    canvas.setPointerCapture(evento.pointerId);
  });
  canvas.addEventListener('pointerup', (evento) => {
    if (evento.button === 0) disparando = false;
  });
  canvas.addEventListener('lostpointercapture', () => {
    disparando = false;
  });
  window.addEventListener('blur', () => {
    disparando = false;
  });
  window.addEventListener('keydown', (evento) => {
    if (!TECLAS_PAUSA.has(evento.code) || evento.repeat) return;
    // Sobre un botón, Espacio lo presiona; ahí no se interpreta como pausa.
    if (evento.code === 'Space' && evento.target instanceof HTMLButtonElement) return;
    evento.preventDefault();
    alPedirPausa?.();
  });

  return {
    // Se recalcula cada cuadro porque el encuadre cambia al redimensionar aunque el ratón no se mueva.
    // Devuelve null mientras el cursor no haya entrado al canvas.
    puntoApuntado() {
      if (!cursorDentro) return null;
      raycaster.setFromCamera(cursor, camara);
      return raycaster.ray.intersectPlane(plano, punto);
    },
    disparando: () => disparando,
    alPedirPausa(funcion) {
      alPedirPausa = funcion;
    },
  };
}
