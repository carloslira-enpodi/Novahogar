/**
 * Inyecta datos estructurados.
 *
 * Se serializa escapando `<` para que un valor con HTML no pueda cerrar la
 * etiqueta <script> e inyectar marcado. Las descripciones vienen de EasyBroker,
 * es decir, de texto que escriben terceros: no es contenido de confianza.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
