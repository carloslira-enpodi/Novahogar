import { PROPERTY_TYPES } from '@/lib/constants';

/**
 * Buscador del home. Es un <form> con método GET, sin JavaScript:
 * funciona aunque el JS falle y produce URLs compartibles e indexables.
 */
export function SearchBar({
  municipalities,
}: {
  municipalities: Array<{ name: string; slug: string }>;
}) {
  return (
    <form
      action="/propiedades"
      method="get"
      className="grid gap-3 rounded-xl bg-white/95 p-4 shadow-xl backdrop-blur sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label htmlFor="operacion" className="sr-only">Operación</label>
        <select
          id="operacion"
          name="operacion"
          defaultValue="sale"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-[#0b2a5b]/20"
        >
          <option value="sale">En venta</option>
          <option value="rental">En renta</option>
        </select>
      </div>

      <div>
        <label htmlFor="tipo" className="sr-only">Tipo de propiedad</label>
        <select
          id="tipo"
          name="tipo"
          defaultValue=""
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-[#0b2a5b]/20"
        >
          <option value="">Tipo de propiedad</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="alcaldia" className="sr-only">Alcaldía o municipio</label>
        <select
          id="alcaldia"
          name="alcaldia"
          defaultValue=""
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-[#0b2a5b]/20"
        >
          <option value="">Toda la CDMX</option>
          {municipalities.map((m) => (
            <option key={m.slug} value={m.slug}>{m.name}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-[#e8622c] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d25521] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#e8622c]/40"
      >
        Buscar propiedades
      </button>
    </form>
  );
}
