// Fuente única de verdad para cifras que cambian durante la temporada (meta de recaudación y
// cupos por nivel), compartida por las páginas en español e inglés. Editar aquí, no en el HTML.
window.STRIKER_CONFIG = {
  funding: { meta: 65450, recaudado: 0, currency: 'MXN' },
  sponsorTiers: [
    { id: 'colaborador', availability: { es: '5 de 5 espacios disponibles', en: '5 of 5 spots available' } },
    { id: 'impulsor', availability: { es: '5 de 5 espacios disponibles', en: '5 of 5 spots available' } },
    { id: 'aliado-tecnico', availability: { es: '4 de 4 espacios disponibles', en: '4 of 4 spots available' } },
    { id: 'partner', availability: { es: 'Cupo único · alianza personalizada', en: 'Single spot · custom partnership' } }
  ]
};
