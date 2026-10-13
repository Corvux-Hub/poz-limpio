import * as THREE from 'three';

// Fondo y bruma del mismo color: lo lejano (edificios, avenidas) se pierde en la noche.
const COLOR_NOCHE = 0x07090f;
const NIEBLA = { cerca: 34, lejos: 78 };

const LUZ_AMBIENTE = { cielo: 0x6f7f99, suelo: 0x14100c, intensidad: 0.5 };
// Entra desde el lado de la cámara: ilumina el frente de lo que se ve y proyecta las sombras hacia atrás.
const LUZ_LUNA = { color: 0xaabbdd, intensidad: 1.25, posicion: [-8, 25, 12], resolucionSombra: 2048 };
// Las sombras cubren el mapa y un poco de lo que lo rodea.
const MARGEN_SOMBRAS = 6;

// Renderer, escena, bruma y luces generales. El suelo y el decorado los pone el escenario.
export function crearEscena(contenedor, mapa) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLOR_NOCHE);
  escena.fog = new THREE.Fog(COLOR_NOCHE, NIEBLA.cerca, NIEBLA.lejos);

  escena.add(new THREE.HemisphereLight(LUZ_AMBIENTE.cielo, LUZ_AMBIENTE.suelo, LUZ_AMBIENTE.intensidad));

  const luna = new THREE.DirectionalLight(LUZ_LUNA.color, LUZ_LUNA.intensidad);
  luna.position.set(...LUZ_LUNA.posicion);
  luna.castShadow = true;
  luna.shadow.mapSize.setScalar(LUZ_LUNA.resolucionSombra);
  // La luz entra inclinada, así que la caja de sombras usa el lado mayor del mapa en ambos ejes.
  const mitad = Math.max(mapa.ancho, mapa.alto) / 2 + MARGEN_SOMBRAS;
  const sombra = luna.shadow.camera;
  sombra.left = -mitad;
  sombra.right = mitad;
  sombra.top = mitad;
  sombra.bottom = -mitad;
  sombra.far = luna.position.length() * 3;
  escena.add(luna);

  return { renderer, escena };
}
