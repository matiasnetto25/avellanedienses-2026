export interface UsuarioDemo {
  perfil: string;
  etiqueta: string;
  email: string;
  password: string;
}

// Usuarios precargados en Supabase (mismos correos/claves) para los accesos rápidos del login.
export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  { perfil: 'dueno', etiqueta: 'Dueño', email: 'dueno@gmail.com', password: '123456' },
  { perfil: 'supervisor', etiqueta: 'Supervisor', email: 'supervisor@gmail.com', password: '123456' },
  { perfil: 'metre', etiqueta: 'Metre', email: 'metre@gmail.com', password: '123456' },
  { perfil: 'mozo', etiqueta: 'Mozo', email: 'mozo@gmail.com', password: '123456' },
  { perfil: 'cocinero', etiqueta: 'Cocinero', email: 'cocinero@gmail.com', password: '123456' },
  { perfil: 'cantinero', etiqueta: 'Cantinero', email: 'cantinero@gmail.com', password: '123456' },
  { perfil: 'cliente-registrado', etiqueta: 'Cliente registrado', email: 'matiasnetto25@gmail.com', password: '123456' },
];
