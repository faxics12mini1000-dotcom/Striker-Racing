/* Identificación de piezas por el nombre del nodo del GLB (sin dependencias: lo usan el visor y los scripts de scripts/).
 * Cada nodo se llama «NN_Nombre» (NN = número de pieza, ver docs/PIPELINE_GLB.md); las llantas llevan dos mallas (__Llanta_* y __Rin_*). */
export const partKey = name => name.slice(0, 2);
export const isRim = name => /__Rin_/.test(name);
/* Clave de la tabla de piezas: llanta (t) y rin (r) se separan, igual que el soporte der./izq. del alerón; bujes y tubos de eje (opcionales) por nombre. */
export function pieceId(name) {
  const k = partKey(name);
  if (/__Rin_/.test(name)) return k + 'r';
  if (/__Llanta_/.test(name)) return k + 't';
  if (k === '06') return /Izq$/.test(name) ? '06i' : '06d';
  if (/Buje|Bushing/i.test(name)) return 'buje';
  if (/Tubo|Tube/i.test(name)) return 'tubo';
  return k;
}
