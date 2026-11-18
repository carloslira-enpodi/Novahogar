/** Formateo es-MX. Un solo lugar, para que precios y medidas nunca difieran. */

import type { Operation, Property } from './types';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let f = currencyFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, f);
  }
  return f;
}

export function formatPrice(operation: Operation | null): string {
  if (!operation || operation.amount === null) return 'Precio a consultar';

  const amount = formatter(operation.currency).format(operation.amount);
  const suffix = operation.currency === 'MXN' ? ' MXN' : '';

  if (operation.unit === 'square_meter') return `${amount}${suffix} por m²`;
  if (operation.unit === 'hectare') return `${amount}${suffix} por hectárea`;

  if (operation.type === 'temporary_rental' && operation.period) {
    const periods = { monthly: 'al mes', weekly: 'por semana', daily: 'por noche' };
    return `${amount}${suffix} ${periods[operation.period]}`;
  }

  if (operation.type === 'rental') return `${amount}${suffix} al mes`;
  return `${amount}${suffix}`;
}

export function formatArea(value: number | null): string | null {
  if (value === null || value <= 0) return null;
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `${new Intl.NumberFormat('es-MX').format(rounded)} m²`;
}

/** "4 recámaras", "1 recámara" — el singular importa cuando hay una sola. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function propertyHighlights(property: Property): string[] {
  const out: string[] = [];
  if (property.bedrooms) out.push(pluralize(property.bedrooms, 'recámara', 'recámaras'));
  if (property.bathrooms) out.push(pluralize(property.bathrooms, 'baño', 'baños'));
  if (property.parkingSpaces) {
    out.push(pluralize(property.parkingSpaces, 'estacionamiento', 'estacionamientos'));
  }
  const construction = formatArea(property.constructionSize);
  if (construction) out.push(`${construction} construidos`);
  else {
    const lot = formatArea(property.lotSize);
    if (lot) out.push(`${lot} de terreno`);
  }
  return out;
}

/** Slug de alcaldía para las landings de zona: "Benito Juárez" → "benito-juarez". */
export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Recorta una descripción para meta description sin cortar palabras a la mitad. */
export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
