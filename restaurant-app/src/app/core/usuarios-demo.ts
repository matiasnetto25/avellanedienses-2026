export interface UsuarioDemo {
  perfil: string;
  etiqueta: string;
  email: string;
  password: string;
}

// TODO: spec 6 - sincronizar estos usuarios de prueba con los que se precarguen en Supabase
// (mismos correos/claves), para que los accesos rápidos sigan funcionando contra el login real.
export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  { perfil: 'dueno', etiqueta: 'Dueño', email: 'dueno@merlot.com', password: 'Merlot2026' },
  { perfil: 'supervisor', etiqueta: 'Supervisor', email: 'supervisor@merlot.com', password: 'Merlot2026' },
  { perfil: 'metre', etiqueta: 'Metre', email: 'metre@merlot.com', password: 'Merlot2026' },
  { perfil: 'mozo', etiqueta: 'Mozo', email: 'mozo@merlot.com', password: 'Merlot2026' },
  { perfil: 'cocinero', etiqueta: 'Cocinero', email: 'cocinero@merlot.com', password: 'Merlot2026' },
  { perfil: 'cantinero', etiqueta: 'Cantinero', email: 'cantinero@merlot.com', password: 'Merlot2026' },
  { perfil: 'cliente-registrado', etiqueta: 'Cliente registrado', email: 'clienteregistrado@merlot.com', password: 'Merlot2026' },
];
