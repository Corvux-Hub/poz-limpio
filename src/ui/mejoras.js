// Menú de mejoras entre oleadas: una tarjeta por mejora de upgrades.json y un botón para seguir.
import { MOTIVOS } from '../systems/mejoras.js';

function textoDelBoton(mejora, { costo, motivo }) {
  switch (motivo) {
    case MOTIVOS.MAXIMO:
      return 'Al máximo';
    case MOTIVOS.POZO_LIMPIO:
      return 'El pozo está limpio';
    case MOTIVOS.SIN_AGUA:
      return `Cuesta ${costo}`;
    default:
      return `${mejora.accion ?? 'Mejorar'} · ${costo}`;
  }
}

function textoDelNivel(mejora, { nivel, nivelMaximo }) {
  if (nivelMaximo !== null) return `Nivel ${nivel} de ${nivelMaximo}`;
  if (mejora.purifica !== undefined) return `−${mejora.purifica} % de contaminación`;
  return '';
}

export function crearMenuMejoras(contenedor, catalogo) {
  const pantalla = document.createElement('div');
  pantalla.className = 'pantalla mejoras';
  pantalla.hidden = true;
  pantalla.innerHTML = `
    <div class="mejoras-panel">
      <h1 class="mejoras-titulo"></h1>
      <p class="mejoras-agua"></p>
      <div class="mejoras-lista"></div>
      <button type="button" class="mejoras-continuar"></button>
    </div>
  `;
  contenedor.appendChild(pantalla);

  const titulo = pantalla.querySelector('.mejoras-titulo');
  const agua = pantalla.querySelector('.mejoras-agua');
  const lista = pantalla.querySelector('.mejoras-lista');
  const continuar = pantalla.querySelector('.mejoras-continuar');

  let alComprar = null;
  let alContinuar = null;
  continuar.addEventListener('click', () => alContinuar?.());

  const tarjetas = new Map();
  for (const [id, mejora] of Object.entries(catalogo)) {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'mejora';
    tarjeta.innerHTML = `
      <div class="mejora-nombre"></div>
      <div class="mejora-descripcion"></div>
      <div class="mejora-nivel"></div>
      <button type="button" class="mejora-comprar"></button>
    `;
    tarjeta.querySelector('.mejora-nombre').textContent = mejora.nombre;
    tarjeta.querySelector('.mejora-descripcion').textContent = mejora.descripcion;
    const boton = tarjeta.querySelector('.mejora-comprar');
    boton.addEventListener('click', () => alComprar?.(id));
    lista.appendChild(tarjeta);
    tarjetas.set(id, { nivel: tarjeta.querySelector('.mejora-nivel'), boton });
  }

  return {
    mostrar({ oleadaSuperada, siguiente }, comprar, seguir) {
      titulo.textContent = `Oleada ${oleadaSuperada} superada`;
      continuar.textContent = `Empezar oleada ${siguiente}`;
      alComprar = comprar;
      alContinuar = seguir;
      pantalla.hidden = false;
      continuar.focus();
    },
    // `estados`: lista de estadoDeMejora(); `aguaDisponible`: agua limpia del jugador.
    actualizar(estados, aguaDisponible) {
      agua.textContent = `Tienes ${aguaDisponible} de agua limpia`;
      for (const estado of estados) {
        const { nivel, boton } = tarjetas.get(estado.id);
        const mejora = catalogo[estado.id];
        nivel.textContent = textoDelNivel(mejora, estado);
        boton.textContent = textoDelBoton(mejora, estado);
        boton.disabled = !estado.disponible;
      }
    },
    ocultar() {
      pantalla.hidden = true;
      alComprar = null;
      alContinuar = null;
    },
  };
}
