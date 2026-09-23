import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBadge,
  IonButton,
  ToastController,
} from '@ionic/angular/standalone';
import { Auth } from '../../core/services/auth';
import { MesasService } from '../../core/services/mesas.service';
import { LoadingService } from '../../core/services/loading.service';
import { MesaRow, etiquetaTipo } from '../../core/models/mesa.model';
import { PUESTOS_VISTA_MESA } from '../../core/models/empleado.model';


@Component({
  selector: 'app-mesa',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonBadge, IonButton],
  templateUrl: './mesa.page.html',
  styleUrls: ['./mesa.page.scss'],
})
export class MesaPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly mesasService = inject(MesasService);
  private readonly loading = inject(LoadingService);
  private readonly toastController = inject(ToastController);

  readonly etiquetaTipo = etiquetaTipo;

  readonly cargando = signal(true);
  readonly mesa = signal<MesaRow | null>(null);
  readonly noEncontrada = signal(false);

  /** true = el que escaneó es personal (metre/mozo/dueño/supervisor), false = cliente */
  get esVistaStaff(): boolean {
    const s = this.auth.sesion();
    return !!s && s.estado === 'On' && (PUESTOS_VISTA_MESA as string[]).includes(s.puesto);
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const idMesa = this.route.snapshot.paramMap.get('idMesa');
      if (!idMesa) {
        this.noEncontrada.set(true);
        this.cargando.set(false);
        return;
      }

      const mesa = await this.mesasService.obtenerPorId(idMesa);
      this.mesa.set(mesa);
      this.noEncontrada.set(!mesa);
      this.cargando.set(false);
    } finally {
      this.loading.ocultar();
    }
  }

  async proximamente(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Esta función todavía no está disponible.',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }
}
