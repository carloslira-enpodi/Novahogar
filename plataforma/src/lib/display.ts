/**
 * Política de presentación del portal.
 *
 * Decisión de producto: el portal NO muestra precios. El objetivo es destacar
 * la propiedad y que el interesado contacte a un asesor.
 *
 * Está centralizado en una bandera para que volver a mostrarlos sea cambiar
 * un valor, no rehacer el diseño. Todo lo que dependa de esta política debe
 * leerse desde aquí y nunca decidirlo por su cuenta.
 */

export const SHOW_PRICES = false;

/** Texto que ocupa el lugar del precio en tarjetas y fichas. */
export const PRICE_PLACEHOLDER = 'Precio a consultar';

/** Llamado a la acción que sustituye al precio. */
export const PRICE_CTA = 'Consultar precio';
