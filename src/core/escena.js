import * as THREE from 'three';

const COLOR_FONDO = 0x050608;
const COLOR_SUELO = 0x2e3036;
// El suelo se extiende más allá del mapa para que no se vea su borde.
const EXTENSION_SUELO = 3;

const LUZ_AMBIENTE = { cielo: 0x6f7f99, suelo: 0x14100c, intensidad: 0.9 };
const LUZ_LUNA = { color: 0xaabbdd, intensidad: 1.8, posicion: [-10, 25, -8], resolucionSombra: 2048 };
// Farol cálido sobre el pozo: lo único bien iluminado del mapa.
const LUZ_POZO = { color: 0xffc98a, intensidad: 40, altura: 5, alcance: 12 };

export function crearEscena(contenedor, mapa) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLOR_FONDO);

  const ladoSuelo = Math.max(mapa.ancho, mapa.alto) * EXTENSION_SUELO;
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(ladoSuelo, ladoSuelo),
    new THREE.MeshStandardMaterial({ color: COLOR_SUELO, roughness: 1 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  escena.add(new THREE.HemisphereLight(LUZ_AMBIENTE.cielo, LUZ_AMBIENTE.suelo, LUZ_AMBIENTE.intensidad));

  const luna = new THREE.DirectionalLight(LUZ_LUNA.color, LUZ_LUNA.intensidad);
  luna.position.set(...LUZ_LUNA.posicion);
  luna.castShadow = true;
  luna.shadow.mapSize.setScalar(LUZ_LUNA.resolucionSombra);
  // La luz entra inclinada, así que la caja de sombras usa el lado mayor del mapa en ambos ejes.
  const mitadMapa = Math.max(mapa.ancho, mapa.alto) / 2;
  const sombra = luna.shadow.camera;
  sombra.left = -mitadMapa;
  sombra.right = mitadMapa;
  sombra.top = mitadMapa;
  sombra.bottom = -mitadMapa;
  sombra.far = luna.position.length() * 2;
  escena.add(luna);

  const farol = new THREE.PointLight(LUZ_POZO.color, LUZ_POZO.intensidad, LUZ_POZO.alcance);
  farol.position.set(0, LUZ_POZO.altura, 0);
  escena.add(farol);

  return { renderer, escena };
}
