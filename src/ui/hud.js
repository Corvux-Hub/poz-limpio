// HUD en HTML sobre el canvas: contaminación del pozo y pantalla de derrota.

// Color de la barra: azul con el pozo limpio, café cuando está contaminado.
const COLOR_LIMPIO = [74, 163, 214];
const COLOR_SUCIO = [140, 98, 44];

function mezclar(desde, hasta, t) {
  const canal = (i) => Math.round(desde[i] + (hasta[i] - desde[i]) * t);
  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

export function crearHud(contenedor) {
  const raiz = document.createElement('div');
  raiz.className = 'hud';
  raiz.innerHTML = `
    <div class="hud-contaminacion">
      <div class="hud-etiqueta"><span>Contaminación del pozo</span><span class="hud-valor">0 %</span></div>
      <div class="hud-barra"><div class="hud-relleno"></div></div>
    </div>
    <div class="derrota" hidden>
      <div class="derrota-tarjeta">
        <h1>El pozo se contaminó</h1>
        <p class="derrota-resumen"></p>
        <button type="button">Reintentar</button>
      </div>
    </div>
  `;
  contenedor.appendChild(raiz);

  const valor = raiz.querySelector('.hud-valor');
  const barra = raiz.querySelector('.hud-barra');
  const relleno = raiz.querySelector('.hud-relleno');
  const derrota = raiz.querySelector('.derrota');
  const resumen = raiz.querySelector('.derrota-resumen');
  const boton = raiz.querySelector('.derrota button');
  let alReintentar = null;
  boton.addEventListener('click', () => alReintentar?.());

  let mostrado = null;

  return {
    actualizarContaminacion(porcentaje) {
      if (porcentaje === mostrado) return;
      // Destello en la barra cada vez que sube.
      if (mostrado !== null && porcentaje > mostrado) {
        barra.classList.remove('golpe');
        void barra.offsetWidth;
        barra.classList.add('golpe');
      }
      mostrado = porcentaje;
      valor.textContent = `${Math.floor(porcentaje)} %`;
      relleno.style.width = `${porcentaje}%`;
      relleno.style.backgroundColor = mezclar(COLOR_LIMPIO, COLOR_SUCIO, porcentaje / 100);
    },
    mostrarDerrota(limpiados, reintentar) {
      resumen.textContent = `Limpiaste a ${limpiados} ${limpiados === 1 ? 'ciudadano' : 'ciudadanos'}.`;
      alReintentar = reintentar;
      derrota.hidden = false;
      boton.focus();
    },
    ocultarDerrota() {
      derrota.hidden = true;
      alReintentar = null;
    },
  };
}
