// Lógica pura de las oleadas: cuándo empieza cada una, qué enemigos pide y cuándo termina.
// Ciclo: DESCANSO (cuenta regresiva) → EN_CURSO → SUPERADA (un momento para celebrar)
// → ESPERANDO (el jugador está en el menú de mejoras) → continuarOleadas() → DESCANSO.
// Una oleada termina cuando ya salieron todos sus enemigos y no queda ninguno sucio en el mapa.

export const FASES = {
  DESCANSO: 'descanso',
  EN_CURSO: 'en_curso',
  SUPERADA: 'superada',
  ESPERANDO: 'esperando',
};

// Definición de la oleada `numero` (desde 1). Más allá de las definidas en waves.json,
// repite la última con más enemigos y saliendo más seguido.
export function definicionDeOleada(numero, { oleadas, escalado }) {
  if (numero <= oleadas.length) return oleadas[numero - 1];
  const extra = numero - oleadas.length;
  const ultima = oleadas[oleadas.length - 1];
  return {
    grupos: ultima.grupos.map((grupo) => ({
      ...grupo,
      cantidad: Math.round(grupo.cantidad * escalado.cantidad ** extra),
      intervalo: Math.max(escalado.intervaloMinimo, grupo.intervalo * escalado.intervalo ** extra),
    })),
  };
}

export function crearOleadas(esperaInicial) {
  return { numero: 1, fase: FASES.DESCANSO, espera: esperaInicial, grupos: [] };
}

// Enemigos de la oleada en curso que todavía no han salido.
export function porAparecer(oleadas) {
  return oleadas.grupos.reduce((total, grupo) => total + grupo.cantidad - grupo.emitidos, 0);
}

function elegirZona(aparicion, aleatorio) {
  if (!Array.isArray(aparicion)) return aparicion;
  return aparicion[Math.min(Math.floor(aleatorio() * aparicion.length), aparicion.length - 1)];
}

function iniciar(oleadas, datos) {
  oleadas.fase = FASES.EN_CURSO;
  oleadas.grupos = definicionDeOleada(oleadas.numero, datos).grupos.map((grupo) => ({
    ...grupo,
    emitidos: 0,
    espera: grupo.retraso ?? 0,
  }));
}

// Tras el menú de mejoras, arranca la cuenta regresiva de la siguiente oleada.
export function continuarOleadas(oleadas, descanso) {
  if (oleadas.fase !== FASES.ESPERANDO) return;
  oleadas.fase = FASES.DESCANSO;
  oleadas.espera = descanso;
}

// Avanza dt segundos y devuelve los enemigos que deben aparecer en este paso: [{ tipo, zona }].
// `quedanSucios` indica si sigue en el mapa algún enemigo sin limpiar.
export function actualizarOleadas(oleadas, datos, { quedanSucios, celebracion }, aleatorio, dt) {
  const pedidos = [];
  let tiempo = dt;

  if (oleadas.fase === FASES.ESPERANDO) return pedidos;
  if (oleadas.fase === FASES.SUPERADA) {
    oleadas.espera -= tiempo;
    if (oleadas.espera <= 0) oleadas.fase = FASES.ESPERANDO;
    return pedidos;
  }

  if (oleadas.fase === FASES.DESCANSO) {
    oleadas.espera -= tiempo;
    if (oleadas.espera > 0) return pedidos;
    // Lo que sobró del paso ya cuenta para la oleada nueva.
    tiempo = -oleadas.espera;
    iniciar(oleadas, datos);
  }

  for (const grupo of oleadas.grupos) {
    grupo.espera -= tiempo;
    while (grupo.espera <= 0 && grupo.emitidos < grupo.cantidad) {
      pedidos.push({ tipo: grupo.tipo, zona: elegirZona(grupo.aparicion, aleatorio) });
      grupo.emitidos++;
      grupo.espera += grupo.intervalo;
    }
  }

  if (pedidos.length === 0 && porAparecer(oleadas) === 0 && !quedanSucios) {
    oleadas.numero++;
    oleadas.fase = FASES.SUPERADA;
    oleadas.espera = celebracion;
    oleadas.grupos = [];
  }
  return pedidos;
}
