export interface UsuarioDemo {
  perfil: string;
  etiqueta: string;
  email: string;
  password: string;
  icono: string;
}

// Usuarios precargados en Supabase (mismos correos/claves) para los accesos rápidos del login.
export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  { perfil: 'dueno', etiqueta: 'Dueño', email: 'dueno@gmail.com', password: '123456', icono: 'briefcase-outline' },
  { perfil: 'supervisor', etiqueta: 'Supervisor', email: 'supervisor@gmail.com', password: '123456', icono: 'shield-checkmark-outline' },
  { perfil: 'metre', etiqueta: 'Metre', email: 'metre@gmail.com', password: '123456', icono: 'people-outline' },
  { perfil: 'mozo', etiqueta: 'Mozo', email: 'mozo@gmail.com', password: '123456', icono: 'restaurant-outline' },
  { perfil: 'cocinero', etiqueta: 'Cocinero', email: 'cocinero@gmail.com', password: '123456', icono: 'flame-outline' },
  { perfil: 'cantinero', etiqueta: 'Cantinero', email: 'cantinero@gmail.com', password: '123456', icono: 'wine-outline' },
  { perfil: 'cliente-registrado', etiqueta: 'Cliente registrado', email: 'matiasnetto25@gmail.com', password: '123456', icono: 'person-outline' },
];
