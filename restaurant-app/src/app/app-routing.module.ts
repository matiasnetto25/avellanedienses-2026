import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { cocineroGuard } from './core/guards/cocinero.guard';
import { cantineroGuard } from './core/guards/cantinero.guard';
import { metreGuard } from './core/guards/metre.guard';
import { clienteAprobadoGuard } from './core/guards/cliente-aprobado.guard';
import { mozoGuard } from './core/guards/mozo.guard';
import { inicioGuard } from './core/guards/inicio.guard';

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
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/administracion/administracion.page').then(m => m.AdministracionPage)
  },
  {
    path: 'administracion/personal',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/administracion/alta-personal-page/personal.page').then(m => m.PersonalPage)
  },
  {
    path: 'administracion/salon/crear',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/administracion/salon/crear-mesa/crear-mesa.page').then(m => m.CrearMesaPage)
  },
  {
    path: 'administracion/salon/gestion',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/administracion/salon/gestion-mesas/gestion-mesas.page').then(m => m.GestionMesasPage)
  },
  {
    path: 'administracion/solicitudes',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/administracion/solicitudes/solicitudes.page').then(m => m.SolicitudesClientesPage)
  },
  {
    path: 'cocina',
    canActivate: [cocineroGuard],
    loadComponent: () => import('./pages/cocina/cocina.page').then(m => m.CocinaPage)
  },
  {
    path: 'cocina/agregar-plato',
    canActivate: [cocineroGuard],
    loadComponent: () => import('./pages/menu-item/agregar-menu-item.page').then(m => m.AgregarMenuItemPage)
  },
  {
    path: 'cantina',
    canActivate: [cantineroGuard],
    loadComponent: () => import('./pages/cantina/cantina.page').then(m => m.CantinaPage)
  },
  {
    path: 'cantina/agregar-bebida',
    canActivate: [cantineroGuard],
    loadComponent: () => import('./pages/menu-item/agregar-menu-item.page').then(m => m.AgregarMenuItemPage)
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
    canActivate: [metreGuard],
    loadComponent: () => import('./pages/metre/metre.page').then(m => m.MetrePage)
  },
  {
    path: 'cliente',
    canActivate: [clienteAprobadoGuard],
    loadComponent: () => import('./pages/cliente/landing-cliente.page').then(m => m.LandingClientePage)
  },
  {
    path: 'metre/lista-espera',
    canActivate: [metreGuard],
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
    canActivate: [mozoGuard],
    loadComponent: () => import('./pages/mozo/mozo.page').then(m => m.MozoPage)
  },
  {
    path: 'cliente-anonimo/ver-mesas',
    loadComponent: () => import('./pages/cliente-anonimo/ver-mesas/ver-mesas.page').then(m => m.VerMesasPage)
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