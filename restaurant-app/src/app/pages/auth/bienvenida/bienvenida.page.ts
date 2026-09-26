import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonRouterLink } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../../shared/components/marca-header/marca-header.component';
import { NOMBRE_GRUPO } from '../../../core/identidad-app';
import { Auth } from '../../../core/services/auth';
import { ClienteAnonimoService } from '../../../core/services/cliente-anonimo.service';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [IonContent, IonButton, IonRouterLink, RouterLink, MarcaHeaderComponent],
  templateUrl: './bienvenida.page.html',
  styleUrls: ['./bienvenida.page.scss'],
})
export class BienvenidaPage implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);

  readonly nombreGrupo = NOMBRE_GRUPO;

  /**
   * Si ya hay sesión activa (empleado o cliente aprobado), no tiene
   * sentido mostrar esta pantalla de bienvenida con los botones de
   * Login/Registrarse — se lo manda directo a donde corresponda.
   *
   * Además, si es un cliente ANÓNIMO ya registrado en este dispositivo
   * (Preferences), también lo saltamos derecho a su landing — esto
   * importa sobre todo cuando Android mata el proceso de la WebView en
   * segundo plano (por ejemplo, mientras la cámara nativa del escáner
   * de QR está en primer plano) y la app "revive" desde cero: sin este
   * chequeo, volvería a mostrarle la bienvenida como si nunca se
   * hubiera registrado.
   */
  async ngOnInit(): Promise<void> {
    const redirigido = await this.auth.redirigirSiYaHaySesion();
    if (redirigido) return;

    const clienteAnonimo = await this.clienteAnonimo.obtenerClienteActual();
    if (clienteAnonimo) {
      this.router.navigate(['/cliente-anonimo'], { replaceUrl: true });
    }
  }

  registrarse(): void {
    this.router.navigate(['/registrar-cliente']);
  }
}
