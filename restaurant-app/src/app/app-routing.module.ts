import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { puestoGuard } from './core/guards/puesto.guard';
import { clienteAprobadoGuard } from './core/guards/cliente-aprobado.guard';
import { inicioGuard } from './core/guards/inicio.guard';
import { estadiaEnMesaGuard } from './core/guards/estadia-en-mesa.guard';
import { PUESTOS_ADMIN } from './core/models/empleado.model';
import { PESTANAS_CANTINA, PESTANAS_COCINA, PESTANAS_MOZO } from './core/models/pestanas-por-perfil';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash-estatica',
    pathMatch: 'full'
  },
  {
    path: 'splash-estatica',
    loadComponent: () => import('./splash/splash-estatica/splash-estatica.page').then(m => m.SplashEstaticaPage)
  },
  {
    path: 'splash-animada',
    loadComponent: () => import('./splash/splash-animada/splash-animada.page').then(m => m.SplashAnimadaPage)
  },
  {
    path: 'bienvenida',
    loadComponent: () => import('./pages/auth/bienvenida/bienvenida.page').then(m => m.BienvenidaPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'inicio',
    canActivate: [inicioGuard],
    // Nunca se termina de mostrar: inicioGuard siempre redirige antes de
    // renderizar. Apunta a PrincipalPage solo porque Angular exige un
    // componente/loadComponent válido en la ruta.
    loadComponent: () => import('./pages/principal/principal.page').then(m => m.PrincipalPage)
  },
  {
    path: 'principal',
    loadComponent: () => import('./pages/principal/principal.page').then(m => m.PrincipalPage)
  },
  {
    path: 'menu',
    loadComponent: () => import('./pages/menu/menu.component').then(m => m.MenuComponent)
  },
  {
    path: 'administracion',
    canActivate: [puestoGuard(...PUESTOS_ADMIN)],
    loadComponent: () => import('./pages/administracion/administracion.page').then(m => m.AdministracionPage)
  },
  {
    path: 'administracion/personal',
    canActivate: [puestoGuard(...PUESTOS_ADMIN)],
    loadComponent: () => import('./pages/administracion/alta-personal-page/personal.page').then(m => m.PersonalPage)
  },
  {
    path: 'administracion/salon/crear',
    canActivate: [puestoGuard(...PUESTOS_ADMIN)],
    loadComponent: () => import('./pages/administracion/salon/crear-mesa/crear-mesa.page').then(m => m.CrearMesaPage)
  },
  {
    path: 'administracion/salon/gestion',
    canActivate: [puestoGuard(...PUESTOS_ADMIN)],
    loadComponent: () => import('./pages/administracion/salon/gestion-mesas/gestion-mesas.page').then(m => m.GestionMesasPage)
  },
  {
    path: 'administracion/solicitudes',
    canActivate: [puestoGuard(...PUESTOS_ADMIN)],
    loadComponent: () => import('./pages/administracion/solicitudes/solicitudes.page').then(m => m.SolicitudesClientesPage)
  },
  {
    // Fuera de las pestañas: el alta es una pantalla de tarea, sin barra.
    path: 'cocina/agregar-plato',
    canActivate: [puestoGuard('cocinero')],
    loadComponent: () => import('./pages/menu-item/agregar-menu-item.page').then(m => m.AgregarMenuItemPage)
  },
  { path: 'cocina/comandas', redirectTo: 'cocina/ahora', pathMatch: 'full' },
  {
    // Cocina y cantina comparten pantallas: el sector va en data.
    path: 'cocina',
    canActivate: [puestoGuard('cocinero')],
    loadComponent: () => import('./shared/components/pestanas-perfil/pestanas-perfil.component').then(m => m.PestanasPerfilComponent),
    data: { pestanas: PESTANAS_COCINA },
    children: [
      {
        path: 'ahora',
        data: { sector: 'cocina' },
        loadComponent: () => import('./pages/preparacion/ahora-preparacion.page').then(m => m.AhoraPreparacionPage)
      },
      {
        path: 'platos',
        data: { sector: 'cocina' },
        loadComponent: () => import('./pages/preparacion/productos-sector.page').then(m => m.ProductosSectorPage)
      },
      { path: '', redirectTo: 'ahora', pathMatch: 'full' },
    ]
  },
  {
    path: 'cantina/agregar-bebida',
    canActivate: [puestoGuard('cantinero')],
    loadComponent: () => import('./pages/menu-item/agregar-menu-item.page').then(m => m.AgregarMenuItemPage)
  },
  { path: 'cantina/comandas', redirectTo: 'cantina/ahora', pathMatch: 'full' },
  {
    path: 'cantina',
    canActivate: [puestoGuard('cantinero')],
    loadComponent: () => import('./shared/components/pestanas-perfil/pestanas-perfil.component').then(m => m.PestanasPerfilComponent),
    data: { pestanas: PESTANAS_CANTINA },
    children: [
      {
        path: 'ahora',
        data: { sector: 'bar' },
        loadComponent: () => import('./pages/preparacion/ahora-preparacion.page').then(m => m.AhoraPreparacionPage)
      },
      {
        path: 'bebidas',
        data: { sector: 'bar' },
        loadComponent: () => import('./pages/preparacion/productos-sector.page').then(m => m.ProductosSectorPage)
      },
      { path: '', redirectTo: 'ahora', pathMatch: 'full' },
    ]
  },
  {
    path: 'registrar-cliente',
    // Sin guard: la usa tanto el cliente anónimo (desde bienvenida) como
    // el metre logueado (desde su navbar) — el componente detecta quién
    // está entrando mirando auth.sesion().
    loadComponent: () => import('./pages/registrar-cliente/registrar-cliente.page').then(m => m.RegistrarClientePage)
  },
  {
    path: 'metre',
    canActivate: [puestoGuard('metre')],
    loadComponent: () => import('./pages/metre/metre.page').then(m => m.MetrePage)
  },
  {
    path: 'cliente',
    canActivate: [clienteAprobadoGuard],
    loadComponent: () => import('./pages/cliente/landing-cliente.page').then(m => m.LandingClientePage)
  },
  {
    path: 'metre/lista-espera',
    canActivate: [puestoGuard('metre')],
    loadComponent: () => import('./pages/metre/lista-espera/lista-espera.page').then(m => m.ListaEsperaPage)
  },
  {
    path: 'cliente-anonimo',
    // Sin guard: la identidad se resuelve con el id guardado en el
    // dispositivo (Capacitor Preferences), no con Supabase Auth — un
    // cliente anónimo no tiene sesión que un guard pueda revisar.
    loadComponent: () => import('./pages/cliente-anonimo/landing-cliente-anonimo.page').then(m => m.LandingClienteAnonimoPage)
  },
  {
    path: 'cliente-anonimo/escaneo-qr',
    loadComponent: () => import('./pages/cliente-anonimo/escaneo-qr/escaneo-qr.page').then(m => m.EscaneoQrPage)
  },

  {
    path: 'cliente-anonimo/escaneo-mesa',
    loadComponent: () => import('./pages/cliente-anonimo/escaneo-mesa/escaneo-mesa.page').then(m => m.EscaneoMesaPage)
  },
  {
    path: 'mozo',
    canActivate: [puestoGuard('mozo')],
    loadComponent: () => import('./shared/components/pestanas-perfil/pestanas-perfil.component').then(m => m.PestanasPerfilComponent),
    data: { pestanas: PESTANAS_MOZO },
    children: [
      {
        path: 'ahora',
        loadComponent: () => import('./pages/mozo/ahora/ahora-mozo.page').then(m => m.AhoraMozoPage)
      },
      {
        // Tiene que coincidir con la ruta de la push avisarNuevoPedido().
        path: 'pedidos',
        loadComponent: () => import('./pages/pedidos/mozo/pedidos-pendientes/pedidos-pendientes.page').then(m => m.PedidosPendientesPage)
      },
      {
        path: 'consultas',
        loadComponent: () => import('./pages/consultas/conversaciones/conversaciones.page').then(m => m.ConversacionesPage)
      },
      {
        path: 'mesas',
        loadComponent: () => import('./pages/mozo/mesas/mesas-mozo.page').then(m => m.MesasMozoPage)
      },
      { path: '', redirectTo: 'ahora', pathMatch: 'full' },
    ]
  },
  {
    path: 'cliente-anonimo/ver-mesas',
    loadComponent: () => import('./pages/cliente-anonimo/ver-mesas/ver-mesas.page').then(m => m.VerMesasPage)
  },
  {
    path: 'mesa/:idMesa',
    // Sin guard: la abren tanto el personal (sesión de Auth) como el
    // cliente anónimo (sin sesión) — el componente decide qué mostrar
    // según quién es y si está vinculado a ESTA mesa.
    loadComponent: () => import('./pages/mesa/mesa.page').then(m => m.MesaPage)
  },
  {
    path: 'mesa/:idMesa/pedido',
    // Solo el cliente (anónimo o registrado) vinculado a ESTA mesa. El
    // guard no mira la sesión de Auth: al anónimo lo identifica por el id
    // del dispositivo. Si no pasa, lo manda a /mesa/:idMesa.
    canActivate: [estadiaEnMesaGuard],
    loadComponent: () => import('./pages/pedidos/cliente/armar-pedido/armar-pedido.page').then(m => m.ArmarPedidoPage)
  },
  {
    path: 'mesa/:idMesa/estado-pedido',
    // Mismo control que la carta: solo el cliente vinculado a esta mesa.
    // Las push de los puntos 13 y 14 apuntan acá.
    canActivate: [estadiaEnMesaGuard],
    loadComponent: () => import('./pages/pedidos/cliente/estado-pedido/estado-pedido.page').then(m => m.EstadoPedidoPage)
  },
  {
    path: 'consultas',
    pathMatch: 'full',
    redirectTo: 'mozo/consultas'
  },
  {
    path: 'consultas/:solicitudId',
    // Sin guard: la usan el cliente de la estadía (anónimo, sin sesión) y
    // los mozos — el componente resuelve quién es y si puede entrar.
    loadComponent: () => import('./pages/consultas/chat/chat.page').then(m => m.ChatPage)
  },
  {
    path: '**',
    redirectTo: 'bienvenida'
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }