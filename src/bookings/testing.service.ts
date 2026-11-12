import { BookingStableService } from './stable.service.ts';

/**
 * Variante de prueba. Hoy no hay ningún experimento con cambios de comportamiento:
 * la clase vacía es exactamente un control A/A.
 *
 * Para abrir un experimento, se sobrescriben o agregan acá solo los métodos que cambia; el resto
 * se hereda del flujo estable, que no se toca. Al cerrarlo: si gana, esos métodos pasan a
 * BookingStableService y la clase vuelve a quedar vacía; si pierde, se borran.
 *
 * Historial (ver git log): "anticipación de exámenes" y "filtro de categorías clínicas"
 * pasaron por esta clase y fueron promovidas al estable.
 */
export class BookingTestingService extends BookingStableService {}
