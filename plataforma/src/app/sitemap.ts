import type { MetadataRoute } from 'next';
import { getCurrentOrganization, getSiteUrl } from '@/lib/site';
import { listAllSlugs, listMunicipalities } from '@/lib/repositories/properties';

/** Sitemap generado desde el inventario real, no una lista escrita a mano. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await getSiteUrl();
  const org = await getCurrentOrganization();

  const [slugs, municipalities] = await Promise.all([
    listAllSlugs(org.id),
    listMunicipalities(org.id),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/propiedades`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/nosotros`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/contacto`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/aviso-de-privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const zoneRoutes: MetadataRoute.Sitemap = municipalities.map((m) => ({
    url: `${siteUrl}/venta/${m.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const propertyRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${siteUrl}/propiedades/${slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...zoneRoutes, ...propertyRoutes];
}
