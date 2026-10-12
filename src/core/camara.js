import * as THREE from 'three';

// Cámara cenital fija: mira recto hacia abajo, con +x a la derecha y +z hacia abajo en pantalla.
export function crearCamara({ altura }) {
  const camara = new THREE.OrthographicCamera();
  camara.position.set(0, altura, 0);
  camara.up.set(0, 0, -1);
  camara.lookAt(0, 0, 0);
  camara.near = 0.1;
  camara.far = altura * 2;
  return camara;
}

// Ajusta el encuadre para que el mapa completo (más el margen) quepa con cualquier relación de aspecto.
export function ajustarCamara(camara, mapa, margen, aspecto) {
  let ancho = mapa.ancho + margen * 2;
  let alto = mapa.alto + margen * 2;
  if (ancho / alto < aspecto) ancho = alto * aspecto;
  else alto = ancho / aspecto;

  camara.left = -ancho / 2;
  camara.right = ancho / 2;
  camara.top = alto / 2;
  camara.bottom = -alto / 2;
  camara.updateProjectionMatrix();
}
