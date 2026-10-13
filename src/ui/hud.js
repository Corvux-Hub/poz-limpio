// HUD en HTML sobre el canvas: contaminación del pozo, presión de la manguera, agua limpia,
// oleada, avisos y pantallas de pausa y derrota.
import { FASES } from '../systems/oleadas.js';

// Color de la barra: azul con el pozo limpio, café cuando está contaminado.
const COLOR_LIMPIO = [74, 163, 214];
const COLOR_SUCIO = [140, 98, 44];

function mezclar(desde, hasta, t) {
  const canal = (i) => Math.round(desde[i] + (hasta[i] - desde[i]) * t);
  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

// Cambia el texto solo si cambió, para no tocar el DOM en cada cuadro.
function escribir(elemento, texto) {
  if (elemento.textContent !== texto) elemento.textContent = texto;
}

function crearPantalla(raiz, clase) {
  const pantalla = raiz.querySelector(clase);
  const boton = pantalla.querySelector('button');
  let alPresionar = null;
  boton.addEventListener('click', () => {
    boton.blur();
    alPresionar?.();
  });
  return {
    pantalla,
    boton,
    mostrar(accion) {
      alPresionar = accion;
      pantalla.hidden = false;
    },
    ocultar() {
      alPresionar = null;
      pantalla.hidden = true;
    },
  };
}

export function crearHud(contenedor) {
  const raiz = document.createElement('div');
  raiz.className = 'hud';
  raiz.innerHTML = `
    <div class="hud-contaminacion">
      <div class="hud-etiqueta"><span>Contaminación del pozo</span><span class="hud-valor">0 %</span></div>
      <div class="hud-barra hud-barra-contaminacion"><div class="hud-relleno"></div></div>
      <div class="hud-presion">
        <div class="hud-etiqueta"><span>Presión</span><span class="hud-presion-aviso"></span></div>
        <div class="hud-barra"><div class="hud-relleno hud-relleno-presion"></div></div>
      </div>
      <div class="hud-agua">Agua limpia: <span class="hud-agua-valor">0</span></div>
    </div>
    <div class="hud-oleada">
      <div class="hud-oleada-numero"></div>
      <div class="hud-oleada-quedan"></div>
    </div>
    <div class="hud-aviso" hidden>
      <div class="hud-aviso-titulo"></div>
      <div class="hud-aviso-detalle"></div>
    </div>
    <div class="pantalla pausa" hidden>
      <div class="pantalla-tarjeta">
        <h1>Pausa</h1>
        <p>Presiona Espacio o Esc para continuar.</p>
        <button type="button">Continuar</button>
      </div>
    </div>
    <div class="pantalla derrota" hidden>
      <div class="pantalla-tarjeta">
        <h1>El pozo se contaminó</h1>
        <p class="derrota-resumen"></p>
        <button type="button">Reintentar</button>
      </div>
    </div>
  `;
  contenedor.appendChild(raiz);

  const valor = raiz.querySelector('.hud-valor');
  const barra = raiz.querySelector('.hud-barra-contaminacion');
  const relleno = barra.querySelector('.hud-relleno');
  const presion = raiz.querySelector('.hud-presion');
  const rellenoPresion = raiz.querySelector('.hud-relleno-presion');
  const avisoPresion = raiz.querySelector('.hud-presion-aviso');
  const agua = raiz.querySelector('.hud-agua-valor');
  const numeroOleada = raiz.querySelector('.hud-oleada-numero');
  const quedan = raiz.querySelector('.hud-oleada-quedan');
  const aviso = raiz.querySelector('.hud-aviso');
  const avisoTitulo = raiz.querySelector('.hud-aviso-titulo');
  const avisoDetalle = raiz.querySelector('.hud-aviso-detalle');
  const pausa = crearPantalla(raiz, '.pausa');
  const derrota = crearPantalla(raiz, '.derrota');
  const resumen = raiz.querySelector('.derrota-resumen');

  let contaminacionMostrada = null;
  let presionMostrada = null;

  return {
    actualizarContaminacion(porcentaje) {
      if (porcentaje === contaminacionMostrada) return;
      // Destello en la barra cada vez que sube.
      if (contaminacionMostrada !== null && porcentaje > contaminacionMostrada) {
        barra.classList.remove('golpe');
        void barra.offsetWidth;
        barra.classList.add('golpe');
      }
      contaminacionMostrada = porcentaje;
      valor.textContent = `${Math.floor(porcentaje)} %`;
      relleno.style.width = `${porcentaje}%`;
      relleno.style.backgroundColor = mezclar(COLOR_LIMPIO, COLOR_SUCIO, porcentaje / 100);
    },

    // `fraccion` de 0 a 1 de la reserva; sin presión la barra se pone naranja y sugiere soltar.
    actualizarPresion(fraccion, sinPresion) {
      const porcentaje = Math.round(fraccion * 100);
      if (porcentaje !== presionMostrada) {
        presionMostrada = porcentaje;
        rellenoPresion.style.width = `${porcentaje}%`;
      }
      presion.classList.toggle('sin-presion', sinPresion);
      escribir(avisoPresion, sinPresion ? 'Suelta para recargar' : '');
    },

    actualizarAgua(cantidad) {
      escribir(agua, String(cantidad));
    },

    // `numero` es la oleada en curso o la siguiente; tras superar una ya apunta a la que viene.
    actualizarOleada({ numero, fase, segundos, sucios }) {
      const superada = fase === FASES.SUPERADA || fase === FASES.ESPERANDO;
      escribir(numeroOleada, `Oleada ${superada ? numero - 1 : numero}`);
      if (fase === FASES.EN_CURSO) escribir(quedan, `Quedan ${sucios}`);
      else escribir(quedan, superada ? 'Superada' : 'Preparándose');

      // Con el menú de mejoras abierto (ESPERANDO) el aviso se oculta: el menú ya lo dice.
      aviso.hidden = fase === FASES.EN_CURSO || fase === FASES.ESPERANDO;
      if (superada) {
        escribir(avisoTitulo, `Oleada ${numero - 1} superada`);
        escribir(avisoDetalle, '');
      } else if (fase === FASES.DESCANSO) {
        escribir(avisoTitulo, numero === 1 ? 'Defiende el pozo' : `Oleada ${numero}`);
        escribir(avisoDetalle, `Empieza en ${Math.ceil(segundos)}`);
      }
    },

    mostrarPausa: (alContinuar) => pausa.mostrar(alContinuar),
    ocultarPausa: () => pausa.ocultar(),

    mostrarDerrota({ oleada, limpiados }, alReintentar) {
      const ciudadanos = limpiados === 1 ? 'ciudadano' : 'ciudadanos';
      resumen.textContent = `Llegaste a la oleada ${oleada} y limpiaste a ${limpiados} ${ciudadanos}.`;
      derrota.mostrar(alReintentar);
      derrota.boton.focus();
    },
    ocultarDerrota: () => derrota.ocultar(),
  };
}
