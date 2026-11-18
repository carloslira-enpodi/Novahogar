/**
 * Inventario de demostración.
 *
 * Datos tomados del sitio público actual de Nova Hogar (noviembre 2026) para
 * que el sitio se vea con contenido real desde el primer `npm run dev`, sin
 * esperar a que Supabase esté conectado.
 *
 * Las fotos NO se enlazan a assets.easybroker.com a propósito: son marcadores
 * generados localmente. Enlazar al CDN ajeno sería exactamente el error que la
 * arquitectura busca evitar (ver ARQUITECTURA.md §4, regla 3).
 *
 * Cuando `SUPABASE_SERVICE_ROLE_KEY` esté configurado, el repositorio deja de
 * usar este archivo automáticamente.
 */

import type { Organization, Property } from './types';

export const DEMO_ORGANIZATION: Organization = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'novahogar',
  name: 'NOVAHOGAR Bienes Raíces',
  phone: '5567194040',
  whatsapp: '525537344749',
  email: 'ventas@novahogar.mx',
  address:
    'Plaza Girasoles, Calzada del Hueso #453 L.17, Fracc. Los Girasoles III, C.P. 04920, Coyoacán, CDMX',
  logoUrl: null,
};

/** Marcador de imagen generado localmente. Sin red, sin CDN ajeno. */
function placeholder(label: string, tone: number): string {
  const hue = tone % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="hsl(${hue} 32% 72%)"/>
<stop offset="100%" stop-color="hsl(${(hue + 28) % 360} 38% 52%)"/>
</linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<text x="400" y="310" font-family="system-ui,sans-serif" font-size="34" font-weight="600"
 fill="rgba(255,255,255,.92)" text-anchor="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function images(label: string, tone: number, count: number, alt: string) {
  return Array.from({ length: count }, (_, i) => ({
    url: placeholder(label, tone + i * 9),
    alt: `${alt} — foto ${i + 1} de ${count}`,
    position: i,
  }));
}

interface Seed {
  slug: string;
  title: string;
  description: string;
  propertyType: string;
  operation: 'sale' | 'rental';
  amount: number;
  neighborhood: string;
  municipality: string;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  constructionSize?: number;
  lotSize?: number;
  features?: string[];
  featured?: boolean;
  photos?: number;
}

const SEEDS: Seed[] = [
  {
    slug: 'casa-en-venta-calle-aniceto-ortega-del-valle-centro-eb-wj2001',
    title: 'Casa en venta en calle Aniceto Ortega, Del Valle con amplio jardín',
    description:
      'Excelente casa en dos niveles. Planta baja con vestíbulo, sala, comedor, área de bar, cocina integral y antecomedor. Jardín con terraza, medio baño de visitas y garaje techado para un auto. Cuarto de servicio con baño completo. Planta alta con cuatro recámaras, la principal con vestidor. Ubicación inmejorable en Del Valle Centro, a pasos de Insurgentes y del Metro Zapata.',
    propertyType: 'Casa',
    operation: 'sale',
    amount: 12400000,
    neighborhood: 'Del Valle Centro',
    municipality: 'Benito Juárez',
    bedrooms: 4,
    bathrooms: 2,
    parkingSpaces: 1,
    constructionSize: 270,
    lotSize: 199,
    features: ['Jardín', 'Terraza', 'Cocina integral', 'Cuarto de servicio', 'Vestidor'],
    featured: true,
    photos: 6,
  },
  {
    slug: 'casa-remodelada-campestre-churubusco-coyoacan-eb-wj2002',
    title: 'Casa remodelada a estrenar en Campestre Churubusco, Coyoacán',
    description:
      'Casa totalmente remodelada en una de las zonas más consolidadas de Coyoacán. Amplios espacios de convivencia, acabados nuevos, cocina equipada y jardín privado. Cuatro recámaras con closets, tres baños completos y estacionamiento para dos autos. Lista para habitarse.',
    propertyType: 'Casa',
    operation: 'sale',
    amount: 13500000,
    neighborhood: 'Campestre Churubusco',
    municipality: 'Coyoacán',
    bedrooms: 4,
    bathrooms: 3,
    parkingSpaces: 2,
    constructionSize: 360,
    lotSize: 280,
    features: ['Remodelada', 'Jardín', 'Cocina equipada', 'Closets'],
    featured: true,
    photos: 6,
  },
  {
    slug: 'bodega-comercial-moctezuma-2a-seccion-eb-wj2003',
    title: 'Bodega comercial en Moctezuma 2a Sección, Venustiano Carranza',
    description:
      'Bodega comercial de 743 m² con excelente acceso para carga y descarga. Altura libre aprovechable, instalación eléctrica trifásica y oficinas administrativas. Cercana al Aeropuerto Internacional y a vialidades primarias, ideal para logística o distribución.',
    propertyType: 'Bodega comercial',
    operation: 'sale',
    amount: 10900000,
    neighborhood: 'Moctezuma 2a Sección',
    municipality: 'Venustiano Carranza',
    constructionSize: 743,
    features: ['Andén de carga', 'Luz trifásica', 'Oficinas'],
    photos: 4,
  },
  {
    slug: 'terreno-sustentable-poxtla-ayapango-eb-wj2004',
    title: 'Terreno sustentable en Poxtla, Ayapango',
    description:
      'Terreno con vocación sustentable en Ayapango, Estado de México. Entorno natural privilegiado con vista a los volcanes, ideal para proyecto residencial campestre o ecoturístico. Servicios municipales disponibles en el frente.',
    propertyType: 'Terreno',
    operation: 'sale',
    amount: 7000000,
    neighborhood: 'Poxtla',
    municipality: 'Ayapango',
    lotSize: 5000,
    features: ['Vista a volcanes', 'Uso campestre'],
    photos: 3,
  },
  {
    slug: 'casa-en-venta-san-lorenzo-la-cebada-xochimilco-eb-wj2005',
    title: 'Casa en venta en San Lorenzo La Cebada, Xochimilco',
    description:
      'Casa amplia de cuatro recámaras y cuatro baños en San Lorenzo La Cebada. Distribución funcional en dos niveles, patio de servicio y estacionamiento techado. Zona tranquila con servicios y transporte a pocos minutos.',
    propertyType: 'Casa',
    operation: 'sale',
    amount: 5900000,
    neighborhood: 'San Lorenzo La Cebada',
    municipality: 'Xochimilco',
    bedrooms: 4,
    bathrooms: 4,
    parkingSpaces: 2,
    constructionSize: 311,
    lotSize: 200,
    features: ['Patio de servicio', 'Estacionamiento techado'],
    photos: 5,
  },
  {
    slug: 'casa-en-condominio-potrero-san-bernardino-xochimilco-eb-wj2006',
    title: 'Casa en condominio con jardín interior en Potrero de San Bernardino',
    description:
      'Casa en condominio muy iluminada, con jardín interior que aporta luz natural a todas las áreas comunes. Tres recámaras, tres baños completos y cocina integral. Condominio con vigilancia y acceso controlado.',
    propertyType: 'Casa en condominio',
    operation: 'sale',
    amount: 5590000,
    neighborhood: 'Potrero de San Bernardino',
    municipality: 'Xochimilco',
    bedrooms: 3,
    bathrooms: 3,
    parkingSpaces: 2,
    constructionSize: 210,
    features: ['Jardín interior', 'Vigilancia', 'Acceso controlado'],
    photos: 5,
  },
  {
    slug: 'casa-en-la-candelaria-coyoacan-eb-wj2007',
    title: 'Casa en La Candelaria, Coyoacán',
    description:
      'Casa de cinco recámaras en el barrio de La Candelaria, Coyoacán. Construcción sólida con gran potencial de remodelación, patio y espacio para dos autos. A unas calles del Centro Histórico de Coyoacán.',
    propertyType: 'Casa',
    operation: 'sale',
    amount: 5800000,
    neighborhood: 'La Candelaria',
    municipality: 'Coyoacán',
    bedrooms: 5,
    bathrooms: 1,
    parkingSpaces: 2,
    constructionSize: 224,
    lotSize: 180,
    features: ['Patio', 'Potencial de remodelación'],
    photos: 4,
  },
  {
    slug: 'casa-en-condominio-san-lorenzo-la-cebada-xochimilco-eb-wj2008',
    title: 'Casa en condominio en San Lorenzo La Cebada, Xochimilco',
    description:
      'Casa en condominio de tres recámaras con acabados en buen estado. Sala y comedor integrados, cocina con alacena y dos baños completos. Condominio pequeño, cuota de mantenimiento accesible.',
    propertyType: 'Casa en condominio',
    operation: 'sale',
    amount: 4998000,
    neighborhood: 'San Lorenzo La Cebada',
    municipality: 'Xochimilco',
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 1,
    constructionSize: 174.23,
    features: ['Alacena', 'Condominio pequeño'],
    photos: 4,
  },
  {
    slug: 'departamento-villa-lazaro-cardenas-tlalpan-eb-wj2009',
    title: 'Departamento de 127 m² con 3 recámaras y 2 cajones en Tlalpan',
    description:
      'Departamento amplio en Villa Lázaro Cárdenas con 127 m² de construcción. Tres recámaras, dos baños completos y dos cajones de estacionamiento. Edificio con elevador y zona bien comunicada hacia Periférico y Calzada de Tlalpan.',
    propertyType: 'Departamento',
    operation: 'sale',
    amount: 4490000,
    neighborhood: 'Villa Lázaro Cárdenas',
    municipality: 'Tlalpan',
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    constructionSize: 127,
    features: ['Elevador', 'Dos cajones'],
    photos: 5,
  },
  {
    slug: 'departamento-presidentes-de-mexico-iztapalapa-eb-wj2010',
    title: 'Departamento de 2 recámaras en Presidentes de México · Acepta Infonavit',
    description:
      'Departamento de dos recámaras en Presidentes de México. Acepta créditos Infonavit y Fovissste, ideal para primer patrimonio. Unidad con áreas comunes y transporte público a pocos metros.',
    propertyType: 'Departamento',
    operation: 'sale',
    amount: 1100000,
    neighborhood: 'Presidentes de México',
    municipality: 'Iztapalapa',
    bedrooms: 2,
    bathrooms: 1,
    constructionSize: 49.04,
    features: ['Acepta Infonavit', 'Acepta Fovissste'],
    photos: 4,
  },
  {
    slug: 'departamento-san-nicolas-tolentino-iztapalapa-eb-wj2011',
    title: 'Departamento en San Nicolás Tolentino con vigilancia 24 h',
    description:
      'Departamento de dos recámaras en conjunto con vigilancia las 24 horas. Sala comedor, cocina y baño completo. Excelente opción de inversión o primera vivienda en Iztapalapa.',
    propertyType: 'Departamento',
    operation: 'sale',
    amount: 1200000,
    neighborhood: 'San Nicolás Tolentino',
    municipality: 'Iztapalapa',
    bedrooms: 2,
    bathrooms: 1,
    constructionSize: 55.28,
    features: ['Vigilancia 24 h', 'Áreas comunes'],
    photos: 3,
  },
  {
    slug: 'departamento-renta-agricola-pantitlan-iztacalco-eb-wj2012',
    title: 'Departamento en renta en Agrícola Pantitlán, Iztacalco',
    description:
      'Departamento de dos recámaras en renta, 63 m² de construcción. Sala comedor, cocina equipada y baño completo. A corta distancia del Metro Pantitlán y vialidades principales.',
    propertyType: 'Departamento',
    operation: 'rental',
    amount: 12500,
    neighborhood: 'Agrícola Pantitlán',
    municipality: 'Iztacalco',
    bedrooms: 2,
    bathrooms: 1,
    constructionSize: 63,
    features: ['Cocina equipada', 'Cerca del Metro'],
    photos: 4,
  },
  {
    slug: 'departamento-renta-parque-tezontle-iztapalapa-eb-wj2013',
    title: 'Departamento en renta cerca de Parque Tezontle y Central de Abastos',
    description:
      'Departamento en renta con ubicación estratégica entre Parque Tezontle y la Central de Abastos. Dos recámaras, baño completo y área de lavado. Ideal para quien busca conectividad y servicios cerca.',
    propertyType: 'Departamento',
    operation: 'rental',
    amount: 14000,
    neighborhood: 'Chinampac de Juárez',
    municipality: 'Iztapalapa',
    bedrooms: 2,
    bathrooms: 1,
    constructionSize: 70,
    features: ['Área de lavado', 'Cerca de plaza comercial'],
    photos: 3,
  },
];

export const DEMO_PROPERTIES: Property[] = SEEDS.map((seed, index) => {
  const zone = `${seed.neighborhood}, ${seed.municipality}`;
  const altBase = `${seed.propertyType} en ${zone}`;
  return {
    id: `demo-${String(index + 1).padStart(3, '0')}`,
    slug: seed.slug,
    title: seed.title,
    description: seed.description,
    propertyType: seed.propertyType,
    status: 'published',
    bedrooms: seed.bedrooms ?? null,
    bathrooms: seed.bathrooms ?? null,
    halfBathrooms: null,
    parkingSpaces: seed.parkingSpaces ?? null,
    constructionSize: seed.constructionSize ?? null,
    lotSize: seed.lotSize ?? null,
    neighborhood: seed.neighborhood,
    municipality: seed.municipality,
    state: seed.municipality === 'Ayapango' ? 'Estado de México' : 'Ciudad de México',
    latitude: null,
    longitude: null,
    showExactLocation: false,
    operations: [
      {
        type: seed.operation,
        amount: seed.amount,
        currency: 'MXN',
        unit: 'total',
        period: null,
      },
    ],
    images: images(seed.propertyType, index * 37 + 190, seed.photos ?? 4, altBase),
    features: seed.features ?? [],
    featured: seed.featured ?? false,
    externalId: `EB-WJ2${String(index + 1).padStart(3, '0')}`,
    updatedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  };
});
