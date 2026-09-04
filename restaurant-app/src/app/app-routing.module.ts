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
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  }
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
