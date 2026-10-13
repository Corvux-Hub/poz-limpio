import * as THREE from 'three';

// Salpicaduras donde el agua le pega a alguien: gotitas que saltan, caen con la gravedad y se encogen.
// Puramente visual; las posiciones de impacto vienen de la lógica del chorro.
const CAPACIDAD = 400;
const POR_IMPACTO = 3;
// Altura (m) a la que pega el chorro en el cuerpo.
const ALTURA = 1.2;
// Velocidades en m/s, tiempos en s, tamaños en m.
const GOTITA = { horizontal: 1.8, subida: 2.6, gravedad: 9.8, vida: 0.5, tamano: 0.09 };
const COLOR = 0xcfefff;

export function crearSalpicaduras() {
  const malla = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 4),
    new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.85, depthWrite: false }),
    CAPACIDAD,
  );
  malla.count = 0;
  malla.frustumCulled = false;

  const gotitas = [];
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const posicion = new THREE.Vector3();
  const escala = new THREE.Vector3();

  return {
    grupo: malla,
    // `puntos`: lista de { x, z } donde pegó el agua en este paso.
    emitir(puntos) {
      for (const { x, z } of puntos) {
        for (let i = 0; i < POR_IMPACTO && gotitas.length < CAPACIDAD; i++) {
          const angulo = Math.random() * Math.PI * 2;
          const fuerza = GOTITA.horizontal * (0.4 + Math.random() * 0.6);
          gotitas.push({
            x,
            y: ALTURA,
            z,
            vx: Math.cos(angulo) * fuerza,
            vy: GOTITA.subida * (0.5 + Math.random() * 0.5),
            vz: Math.sin(angulo) * fuerza,
            edad: 0,
          });
        }
      }
    },
    // Con dt = 0 quedan congeladas (pausa).
    actualizar(dt) {
      let vivas = 0;
      for (const g of gotitas) {
        g.edad += dt;
        g.vy -= GOTITA.gravedad * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.z += g.vz * dt;
        if (g.edad >= GOTITA.vida || g.y <= 0) continue;
        gotitas[vivas++] = g;
      }
      gotitas.length = vivas;

      gotitas.forEach((g, i) => {
        escala.setScalar(GOTITA.tamano * (1 - g.edad / GOTITA.vida));
        malla.setMatrixAt(i, matriz.compose(posicion.set(g.x, g.y, g.z), giro, escala));
      });
      malla.count = gotitas.length;
      malla.instanceMatrix.needsUpdate = true;
    },
    limpiar() {
      gotitas.length = 0;
      malla.count = 0;
    },
  };
}
