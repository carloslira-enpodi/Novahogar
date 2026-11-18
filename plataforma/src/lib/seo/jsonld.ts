/**
 * Datos estructurados JSON-LD.
 *
 * El sitio actual de Nova Hogar tiene CERO datos estructurados: sus fichas no
 * pueden aparecer en Google con precio, superficie ni fotos enriquecidas.
 * Aquí se generan automáticamente para cada propiedad, sin depender de que
 * nadie se acuerde de ponerlos.
 */

import { primaryOperation, zoneLabel, type Organization, type Property } from '@/lib/types';
import { truncate } from '@/lib/format';

export function organizationJsonLd(org: Organization, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${siteUrl}/#organization`,
    name: org.name,
    url: siteUrl,
    ...(org.logoUrl ? { logo: org.logoUrl } : {}),
    ...(org.email ? { email: org.email } : {}),
    ...(org.phone ? { telephone: `+52${org.phone}` } : {}),
    ...(org.address
      ? { address: { '@type': 'PostalAddress', streetAddress: org.address, addressCountry: 'MX' } }
      : {}),
    areaServed: { '@type': 'City', name: 'Ciudad de México' },
  };
}

export function websiteJsonLd(org: Organization, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: org.name,
    inLanguage: 'es-MX',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/propiedades?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function propertyJsonLd(
  property: Property,
  org: Organization,
  siteUrl: string,
) {
  const url = `${siteUrl}/propiedades/${property.slug}`;
  const operation = primaryOperation(property);
  const zone = zoneLabel(property);

  /*
   * Oferta SIN precio.
   *
   * El portal no publica precios, así que tampoco pueden ir en los datos
   * estructurados: Google los mostraría en resultados y filtraría la cifra que
   * el sitio decidió no mostrar. Se conserva la oferta para declarar la
   * operación y la disponibilidad, que sí son públicas.
   */
  const offer = operation
    ? {
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          businessFunction:
            operation.type === 'sale'
              ? 'https://schema.org/Sell'
              : 'https://schema.org/LeaseOut',
          priceCurrency: operation.currency,
          url,
        },
      }
    : {};

  return {
    '@context': 'https://schema.org',
    '@type': ['Residence', 'Product'],
    '@id': `${url}#listing`,
    name: property.title,
    url,
    ...(property.description
      ? { description: truncate(property.description, 500) }
      : {}),
    image: property.images.slice(0, 8).map((img) => img.url),
    ...offer,
    address: {
      '@type': 'PostalAddress',
      ...(property.neighborhood ? { addressLocality: property.neighborhood } : {}),
      ...(property.municipality ? { addressRegion: property.municipality } : {}),
      addressCountry: 'MX',
    },
    ...(property.latitude && property.longitude && property.showExactLocation
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: property.latitude,
            longitude: property.longitude,
          },
        }
      : {}),
    ...(property.bedrooms ? { numberOfRooms: property.bedrooms } : {}),
    ...(property.bathrooms ? { numberOfBathroomsTotal: property.bathrooms } : {}),
    ...(property.constructionSize
      ? {
          floorSize: {
            '@type': 'QuantitativeValue',
            value: property.constructionSize,
            unitCode: 'MTK',
          },
        }
      : {}),
    ...(property.features.length ? { amenityFeature: property.features } : {}),
    broker: { '@id': `${siteUrl}/#organization` },
    ...(zone ? { areaServed: zone } : {}),
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function itemListJsonLd(properties: Property[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: properties.length,
    itemListElement: properties.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/propiedades/${p.slug}`,
      name: p.title,
    })),
  };
}
