import { Component, OnInit, inject } from '@angular/core';
import { Auth } from './core/services/auth';
import { NotificacionesService } from './core/services/notificaciones.service';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly auth = inject(Auth);
  private readonly notificaciones = inject(NotificacionesService);
  readonly loading = inject(LoadingService);

  async ngOnInit(): Promise<void> {
    // 1) Restaura la sesión de Supabase Auth si ya había una activa
    //    (por ejemplo, al recargar la página o reabrir la app).
    await this.auth.restaurarSesion();

    // 2) Recién con la sesión ya restaurada (si la había) se inicializan
    //    las push notifications, porque guardarToken() necesita saber
    //    a qué empleado asociar el token del dispositivo.
    await this.notificaciones.inicializar();
  }
}
