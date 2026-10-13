import * as THREE from 'three';

// Efectos de partículas, puramente visuales. Los puntos de origen vienen de la lógica:
// - agua: gotitas que saltan donde el chorro le pega a alguien (chorro.salpicaduras);
// - barro: agua turbia que salpica fuera del pozo con cada golpe (partida.golpes);
// - destellos: motas de luz que suben de quien queda limpio.
// Velocidades en m/s, aceleraciones en m/s², tiempos en s y tamaños en m.
// `gravedad` negativa hace que la partícula suba cada vez más rápido.
const ESTILOS = {
  agua: { capacidad: 400, color: 0xcfefff, opacidad: 0.85, horizontal: 1.8, subida: 2.6, gravedad: 9.8, vida: 0.5, tamano: 0.09 },
  barro: { capacidad: 300, color: 0x463d26, opacidad: 0.95, horizontal: 1.5, subida: 4.2, gravedad: 9.8, vida: 0.9, tamano: 0.11 },
  destellos: {
    capacidad: 300,
    color: 0xdff6ff,
    opacidad: 0.9,
    aditiva: true,
    horizontal: 0.35,
    subida: 0.6,
    gravedad: -1.6,
    vida: 1.3,
    tamano: 0.09,
  },
};
// Gotitas por gota que pega y altura (m) a la que el chorro le pega a un cuerpo.
const AGUA = { porImpacto: 3, altura: 1.2 };
// Gotas de barro por golpe al pozo (con la fuerza máxima) y a qué fracción del radio del agua saltan.
const BARRO = { porGolpe: 16, haciaElBorde: 0.7 };
// Motas al quedar limpio y alto del cuerpo (m) del que salen.
const DESTELLOS = { cantidad: 30, alto: 1.7 };

function crearParticulas({ capacidad, color, opacidad, aditiva = false, ...movimiento }) {
  const malla = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacidad,
      depthWrite: false,
      blending: aditiva ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
    capacidad,
  );
  malla.count = 0;
  malla.frustumCulled = false;

  const particulas = [];
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const posicion = new THREE.Vector3();
  const escala = new THREE.Vector3();

  return {
    malla,
    // Salen de `origen` ({ x, y, z }), repartidas en un círculo de radio `dispersion` y hasta `alto` metros más arriba.
    emitir(origen, cantidad, { dispersion = 0, alto = 0 } = {}) {
      for (let i = 0; i < cantidad && particulas.length < capacidad; i++) {
        const angulo = Math.random() * Math.PI * 2;
        const fuerza = movimiento.horizontal * (0.4 + Math.random() * 0.6);
        const radio = Math.random() * dispersion;
        particulas.push({
          x: origen.x + Math.cos(angulo) * radio,
          y: origen.y + Math.random() * alto,
          z: origen.z + Math.sin(angulo) * radio,
          vx: Math.cos(angulo) * fuerza,
          vy: movimiento.subida * (0.5 + Math.random() * 0.5),
          vz: Math.sin(angulo) * fuerza,
          edad: 0,
          vida: movimiento.vida * (0.7 + Math.random() * 0.3),
        });
      }
    },
    // Con dt = 0 quedan congeladas (pausa).
    actualizar(dt) {
      let vivas = 0;
      for (const p of particulas) {
        p.edad += dt;
        p.vy -= movimiento.gravedad * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.edad >= p.vida || p.y <= 0) continue;
        particulas[vivas++] = p;
      }
      particulas.length = vivas;

      particulas.forEach((p, i) => {
        escala.setScalar(movimiento.tamano * (1 - p.edad / p.vida));
        malla.setMatrixAt(i, matriz.compose(posicion.set(p.x, p.y, p.z), giro, escala));
      });
      malla.count = particulas.length;
      malla.instanceMatrix.needsUpdate = true;
    },
    limpiar() {
      particulas.length = 0;
      malla.count = 0;
    },
  };
}

// `pozo`: el visual del pozo (radioInterior y alturaAgua).
export function crearEfectos(pozo) {
  const agua = crearParticulas(ESTILOS.agua);
  const barro = crearParticulas(ESTILOS.barro);
  const destellos = crearParticulas(ESTILOS.destellos);
  const todos = [agua, barro, destellos];
  const grupo = new THREE.Group();
  grupo.add(...todos.map((sistema) => sistema.malla));

  return {
    grupo,
    // `puntos`: lista de { x, z } donde pegó el agua en este paso.
    impactosDeAgua(puntos) {
      for (const { x, z } of puntos) agua.emitir({ x, y: AGUA.altura, z }, AGUA.porImpacto);
    },
    // El agua salta del lado de quien golpeó. `fuerza` de 0 a 1.
    golpeAlPozo({ x, z }, fuerza) {
      const distancia = Math.hypot(x, z) || 1;
      const hastaElBorde = pozo.radioInterior * BARRO.haciaElBorde;
      const origen = { x: (x / distancia) * hastaElBorde, y: pozo.alturaAgua, z: (z / distancia) * hastaElBorde };
      barro.emitir(origen, Math.ceil(BARRO.porGolpe * (0.5 + 0.5 * fuerza)), { dispersion: 0.25 });
    },
    // Motas de luz que suben del cuerpo de quien quedó limpio.
    limpio({ x, z, radio }) {
      destellos.emitir({ x, y: 0.2, z }, DESTELLOS.cantidad, { dispersion: radio, alto: DESTELLOS.alto });
    },
    actualizar(dt) {
      for (const sistema of todos) sistema.actualizar(dt);
    },
    limpiar() {
      for (const sistema of todos) sistema.limpiar();
    },
  };
}
