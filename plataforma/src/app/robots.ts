import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Las rutas internas y los resultados filtrados no aportan al índice.
        disallow: ['/api/', '/crm/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
