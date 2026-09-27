/** «Nombre Apellido», sin espacios de más si falta el apellido. */
export function nombreCompleto(persona: { nombre: string; apellido?: string | null }): string {
  return `${persona.nombre} ${persona.apellido ?? ''}`.trim();
}
