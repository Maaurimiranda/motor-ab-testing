import type { Professional, SpecialtyCategory } from '../models.ts';
import { BookingStableService } from './stable.service.ts';

export type MatchType = 'exact' | 'partial' | 'none';

/**
 * Variante de prueba. Experimento en curso: "filtro de categorías clínicas".
 * Suma una búsqueda nueva; la búsqueda original (searchSpecialists) sigue intacta para el
 * flujo estable. Todo lo demás se hereda.
 *
 * Al cerrar el experimento: si gana, el método pasa a BookingStableService y la clase vuelve
 * a quedar vacía; si pierde, se borra.
 */
export class BookingTestingService extends BookingStableService {
  /**
   * Todas las categorías elegidas (exact); si ninguna profesional las tiene todas, las que tienen
   * alguna, ordenadas por coincidencias (partial); si tampoco, lista vacía (none).
   */
  async searchSpecialistsV2(
    bookingId: string,
    categories: SpecialtyCategory[],
  ): Promise<{ specialists: Professional[]; matchType: MatchType }> {
    await this.findOrThrow(bookingId);
    if (categories.length === 0) return { specialists: await this.findGynecologists({}), matchType: 'exact' };

    const exact = await this.findGynecologists({ specialtyCategories: { $all: categories } });
    if (exact.length > 0) return { specialists: exact, matchType: 'exact' };

    // ponytail: orden en memoria, son pocas profesionales; pasar a una agregación si el volumen crece.
    const matches = (p: Professional) => p.specialtyCategories!.filter((c) => categories.includes(c)).length;
    const partial = (await this.findGynecologists({ specialtyCategories: { $in: categories } }))
      .sort((a, b) => matches(b) - matches(a)); // sort estable: a igual coincidencia, sigue por nombre
    return partial.length > 0 ? { specialists: partial, matchType: 'partial' } : { specialists: [], matchType: 'none' };
  }
}
