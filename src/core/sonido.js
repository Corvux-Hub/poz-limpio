// Sonido sintetizado con Web Audio: ruido filtrado y osciladores, sin archivos de audio ni dependencias.
// El navegador no deja sonar nada hasta un gesto del jugador, así que `activar()` va en el clic de "Empezar";
// antes de eso todas las llamadas se ignoran.
//
// Capas continuas (se ajustan cada cuadro con `actualizar`): ambiente, chorro, agua que pega y latido de peligro.
// Efectos sueltos: golpe al pozo, ciudadano limpio, inicio y fin de oleada, cuenta regresiva, presión vacía,
// compra y derrota.

const CLAVE_SILENCIO = 'pozo-limpio.silencio';

// Volúmenes relativos de cada capa y efecto (el general viene de config.json).
const VOLUMEN = {
  viento: 0.25,
  zumbido: 0.025,
  chorro: 0.3,
  impacto: 0.45,
  golpe: 0.8,
  limpio: 0.22,
  aviso: 0.3,
  tic: 0.25,
  latido: 0.9,
  compra: 0.25,
};
// Chorro: ruido pasabanda que se apaga y se vuelve más grave con menos caudal; sin presión, chisporrotea.
const CHORRO = { frecuencia: 1300, q: 0.6, respuesta: 0.03, chisporroteo: 0.06, minimoChisporroteo: 0.15 };
// Agua chocando contra la ropa: ruido grave con textura irregular.
const IMPACTO = { frecuencia: 520, q: 0.9, respuesta: 0.05, textura: 0.04 };
// Viento de fondo: ruido grave cuyo filtro sube y baja muy despacio.
const VIENTO = { frecuencia: 360, vaiven: 160, velocidadVaiven: 0.07 };
// Zumbido de la ciudad: dos senos casi iguales que baten entre sí.
const ZUMBIDO = [55, 55.25];
// Latido con el pozo en peligro: más rápido mientras más cerca del 100 %.
const LATIDO = { intervaloLento: 1.1, intervaloRapido: 0.5, separacion: 0.17 };
// Ciudadano limpio: arpegio de La mayor; los más grandes suenan más graves.
const ARPEGIO_LIMPIO = [880, 1108.7, 1318.5];
const ARPEGIO_SUPERADA = [293.7, 370, 440, 587.3];
// Compresor general (dB y proporción).
const COMPRESOR = { umbral: -12, rodilla: 10, proporcion: 4 };
const SIN_SONIDO = 0.0001;

function leerSilencio() {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === '1';
  } catch {
    return false;
  }
}

function guardarSilencio(silenciado) {
  try {
    localStorage.setItem(CLAVE_SILENCIO, silenciado ? '1' : '0');
  } catch {
    // Sin almacenamiento (ventana privada, permisos): el silencio dura solo esta visita.
  }
}

function crearRuido(contexto, segundos) {
  const buffer = contexto.createBuffer(1, Math.floor(contexto.sampleRate * segundos), contexto.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  return buffer;
}

// Ganancia que sube en `ataque` segundos hasta `volumen` y se apaga al cumplir `duracion`.
function envolvente(contexto, inicio, ataque, duracion, volumen) {
  const ganancia = contexto.createGain();
  ganancia.gain.setValueAtTime(SIN_SONIDO, inicio);
  ganancia.gain.exponentialRampToValueAtTime(volumen, inicio + ataque);
  ganancia.gain.exponentialRampToValueAtTime(SIN_SONIDO, inicio + duracion);
  return ganancia;
}

function filtro(contexto, tipo, frecuencia, q = 1) {
  const nodo = contexto.createBiquadFilter();
  nodo.type = tipo;
  nodo.frequency.value = frecuencia;
  nodo.Q.value = q;
  return nodo;
}

export function crearSonido({ volumen }) {
  let contexto = null;
  let maestro = null;
  let ruido = null;
  let chorro = null;
  let impacto = null;
  let silenciado = leerSilencio();
  let chisporroteo = 0;
  let nivelChisporroteo = 1;
  let textura = 0;
  let nivelTextura = 1;
  let hastaLatido = 0;

  // Nota con altura que puede deslizarse de `desde` a `hasta`.
  function tono({ tipo = 'sine', desde, hasta = desde, inicio = contexto.currentTime, ataque = 0.005, duracion, volumen: v }) {
    const oscilador = contexto.createOscillator();
    oscilador.type = tipo;
    oscilador.frequency.setValueAtTime(desde, inicio);
    if (hasta !== desde) oscilador.frequency.exponentialRampToValueAtTime(hasta, inicio + duracion);
    oscilador.connect(envolvente(contexto, inicio, ataque, duracion, v)).connect(maestro);
    oscilador.start(inicio);
    oscilador.stop(inicio + duracion + 0.05);
  }

  // Ráfaga de ruido filtrado; el filtro puede barrer de `frecuencia` a `hasta`.
  function rafaga({ tipo = 'lowpass', frecuencia, hasta = frecuencia, q = 1, inicio = contexto.currentTime, ataque = 0.003, duracion, volumen: v }) {
    const fuente = contexto.createBufferSource();
    fuente.buffer = ruido;
    const pasa = filtro(contexto, tipo, frecuencia, q);
    pasa.frequency.setValueAtTime(frecuencia, inicio);
    if (hasta !== frecuencia) pasa.frequency.exponentialRampToValueAtTime(hasta, inicio + duracion);
    fuente.connect(pasa).connect(envolvente(contexto, inicio, ataque, duracion, v)).connect(maestro);
    fuente.start(inicio, Math.random() * Math.max(ruido.duration - duracion - 0.1, 0));
    fuente.stop(inicio + duracion + 0.05);
  }

  // Ruido en bucle por un filtro, con su propia ganancia (empieza en silencio).
  function capaDeRuido(tipo, frecuencia, q) {
    const fuente = contexto.createBufferSource();
    fuente.buffer = ruido;
    fuente.loop = true;
    const pasa = filtro(contexto, tipo, frecuencia, q);
    const ganancia = contexto.createGain();
    ganancia.gain.value = 0;
    fuente.connect(pasa).connect(ganancia).connect(maestro);
    fuente.start(0, Math.random() * ruido.duration);
    return { filtro: pasa, ganancia };
  }

  function crearAmbiente() {
    const viento = capaDeRuido('lowpass', VIENTO.frecuencia, 0.7);
    viento.ganancia.gain.value = VOLUMEN.viento;
    const vaiven = contexto.createOscillator();
    vaiven.frequency.value = VIENTO.velocidadVaiven;
    const profundidad = contexto.createGain();
    profundidad.gain.value = VIENTO.vaiven;
    vaiven.connect(profundidad).connect(viento.filtro.frequency);
    vaiven.start();
    for (const frecuencia of ZUMBIDO) {
      const oscilador = contexto.createOscillator();
      oscilador.frequency.value = frecuencia;
      const ganancia = contexto.createGain();
      ganancia.gain.value = VOLUMEN.zumbido;
      oscilador.connect(ganancia).connect(maestro);
      oscilador.start();
    }
  }

  function latido() {
    const ahora = contexto.currentTime;
    for (const [retraso, fuerza] of [[0, 1], [LATIDO.separacion, 0.7]]) {
      tono({ desde: 70, hasta: 38, inicio: ahora + retraso, ataque: 0.01, duracion: 0.22, volumen: VOLUMEN.latido * fuerza });
    }
  }

  const listo = () => contexto !== null;

  return {
    get silenciado() {
      return silenciado;
    },

    // Llamar dentro de un gesto del jugador (clic o tecla).
    activar() {
      if (contexto) {
        contexto.resume();
        return;
      }
      const Contexto = window.AudioContext ?? window.webkitAudioContext;
      if (!Contexto) return;
      contexto = new Contexto();
      // El compresor evita que varios golpes juntos saturen; suave, para no subir el fondo.
      const compresor = contexto.createDynamicsCompressor();
      compresor.threshold.value = COMPRESOR.umbral;
      compresor.knee.value = COMPRESOR.rodilla;
      compresor.ratio.value = COMPRESOR.proporcion;
      compresor.connect(contexto.destination);
      maestro = contexto.createGain();
      maestro.gain.value = silenciado ? 0 : volumen;
      maestro.connect(compresor);
      ruido = crearRuido(contexto, 2);
      crearAmbiente();
      chorro = capaDeRuido('bandpass', CHORRO.frecuencia, CHORRO.q);
      impacto = capaDeRuido('bandpass', IMPACTO.frecuencia, IMPACTO.q);
    },

    alternarSilencio() {
      silenciado = !silenciado;
      guardarSilencio(silenciado);
      if (listo()) maestro.gain.setTargetAtTime(silenciado ? 0 : volumen, contexto.currentTime, 0.02);
      return silenciado;
    },

    // En pausa todo el audio se congela, igual que el juego.
    pausar(pausado) {
      if (!listo()) return;
      if (pausado) contexto.suspend();
      else contexto.resume();
    },

    // Capas continuas, una vez por cuadro.
    // `disparando`, `caudal` (0..1) y `sinPresion` del chorro; `impacto`: fracción del chorro que pega en alguien (0..1);
    // `peligro`: 0 si el pozo está bien, de 0 a 1 entre el umbral de peligro y el 100 %.
    actualizar({ disparando, caudal, sinPresion, impacto: fraccionImpacto, peligro }, dt) {
      if (!listo()) return;
      const ahora = contexto.currentTime;

      chisporroteo -= dt;
      if (chisporroteo <= 0) {
        chisporroteo = CHORRO.chisporroteo;
        nivelChisporroteo = sinPresion ? CHORRO.minimoChisporroteo + Math.random() * (1 - CHORRO.minimoChisporroteo) : 1;
      }
      const chorroObjetivo = disparando ? VOLUMEN.chorro * (0.4 + 0.6 * caudal) * nivelChisporroteo : 0;
      chorro.ganancia.gain.setTargetAtTime(chorroObjetivo, ahora, CHORRO.respuesta);
      chorro.filtro.frequency.setTargetAtTime(CHORRO.frecuencia * (0.7 + 0.3 * caudal), ahora, CHORRO.respuesta);

      textura -= dt;
      if (textura <= 0) {
        textura = IMPACTO.textura;
        nivelTextura = 0.6 + Math.random() * 0.4;
      }
      impacto.ganancia.gain.setTargetAtTime(VOLUMEN.impacto * fraccionImpacto * nivelTextura, ahora, IMPACTO.respuesta);

      if (peligro > 0) {
        hastaLatido -= dt;
        if (hastaLatido <= 0) {
          latido();
          hastaLatido = LATIDO.intervaloLento + (LATIDO.intervaloRapido - LATIDO.intervaloLento) * peligro;
        }
      } else {
        hastaLatido = 0;
      }
    },

    // Golpe contra el brocal: un golpe sordo de piedra y un chapoteo turbio. `fuerza` de 0 a 1.
    golpePozo(fuerza) {
      if (!listo()) return;
      const v = VOLUMEN.golpe * (0.6 + 0.4 * fuerza);
      tono({ desde: 120, hasta: 45, ataque: 0.004, duracion: 0.3, volumen: v });
      rafaga({ frecuencia: 1400, hasta: 300, duracion: 0.12, volumen: v * 0.6 });
      rafaga({ tipo: 'bandpass', frecuencia: 380, hasta: 180, q: 1.5, inicio: contexto.currentTime + 0.05, ataque: 0.02, duracion: 0.35, volumen: v * 0.5 });
    },

    // Ciudadano limpio: campanitas que suben y un brillo de agua. `tamano` como en enemies.json.
    limpio(tamano) {
      if (!listo()) return;
      const ahora = contexto.currentTime;
      const altura = 1 / Math.sqrt(tamano);
      ARPEGIO_LIMPIO.forEach((frecuencia, i) => {
        const inicio = ahora + i * 0.07;
        tono({ desde: frecuencia * altura, inicio, ataque: 0.01, duracion: 0.7, volumen: VOLUMEN.limpio });
        tono({ tipo: 'triangle', desde: frecuencia * altura * 2, inicio, ataque: 0.01, duracion: 0.35, volumen: VOLUMEN.limpio * 0.25 });
      });
      rafaga({ tipo: 'highpass', frecuencia: 5000, duracion: 0.4, ataque: 0.02, volumen: VOLUMEN.limpio * 0.5 });
    },

    // Tic de la cuenta regresiva antes de cada oleada.
    tic() {
      if (!listo()) return;
      tono({ tipo: 'triangle', desde: 660, duracion: 0.08, volumen: VOLUMEN.tic });
    },

    // Empieza la oleada: un bramido grave que crece y se apaga.
    oleadaEmpieza() {
      if (!listo()) return;
      const ahora = contexto.currentTime;
      const pasa = filtro(contexto, 'lowpass', 180, 2);
      pasa.frequency.setValueAtTime(180, ahora);
      pasa.frequency.exponentialRampToValueAtTime(900, ahora + 0.6);
      pasa.frequency.exponentialRampToValueAtTime(200, ahora + 1.8);
      const ganancia = envolvente(contexto, ahora, 0.5, 1.9, VOLUMEN.aviso);
      pasa.connect(ganancia).connect(maestro);
      for (const frecuencia of [73.4, 73.9, 110]) {
        const oscilador = contexto.createOscillator();
        oscilador.type = 'sawtooth';
        oscilador.frequency.value = frecuencia;
        oscilador.connect(pasa);
        oscilador.start(ahora);
        oscilador.stop(ahora + 2);
      }
    },

    // Oleada superada: acorde que sube, suave.
    oleadaSuperada() {
      if (!listo()) return;
      const ahora = contexto.currentTime;
      ARPEGIO_SUPERADA.forEach((frecuencia, i) => {
        tono({ tipo: 'triangle', desde: frecuencia, inicio: ahora + i * 0.12, ataque: 0.02, duracion: 1.2, volumen: VOLUMEN.aviso * 0.7 });
      });
    },

    // La manguera se quedó sin presión: un siseo que se corta.
    sinPresion() {
      if (!listo()) return;
      rafaga({ tipo: 'bandpass', frecuencia: 3000, hasta: 900, q: 1.2, duracion: 0.3, volumen: VOLUMEN.chorro });
      tono({ desde: 160, hasta: 90, duracion: 0.12, volumen: VOLUMEN.chorro * 0.8 });
    },

    // Compra en el menú de mejoras: una gota que sube.
    compra() {
      if (!listo()) return;
      tono({ desde: 260, hasta: 640, ataque: 0.005, duracion: 0.18, volumen: VOLUMEN.compra });
    },

    // Derrota: tres notas graves que bajan.
    derrota() {
      if (!listo()) return;
      const ahora = contexto.currentTime;
      [220, 174.6, 146.8].forEach((frecuencia, i) => {
        tono({ tipo: 'triangle', desde: frecuencia, hasta: frecuencia * 0.97, inicio: ahora + i * 0.45, ataque: 0.04, duracion: 1.4, volumen: VOLUMEN.aviso });
      });
    },
  };
}
