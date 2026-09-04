import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

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
    path: 'principal',
    loadComponent: () => import('./pages/principal/principal.page').then(m => m.PrincipalPage)
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
export class AppRoutingModule {}
