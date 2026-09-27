/**
 * Resultado de buscar una fila que puede no existir. Distingue los dos
 * casos que la pantalla trata distinto:
 *  - { ok: true, dato: null }  → la consulta anduvo, pero no hay fila.
 *  - { ok: false }             → la consulta falló (red, permisos, etc.).
 */
export type ResultadoBusqueda<T> = { ok: true; dato: T | null } | { ok: false };
