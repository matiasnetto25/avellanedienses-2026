import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonToggle,
  IonButton,
  IonBadge,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonText,
  IonFooter,
  AlertController,
  NavController,
} from '@ionic/angular/standalone';
import { AlturaDisponibleDirective } from '../../../../shared/directives/altura-disponible.directive';
import { AvatarPerfilComponent } from '../../../../shared/components/avatar-perfil/avatar-perfil.component';
import { BarraAccionesComponent } from '../../../../shared/components/barra-acciones/barra-acciones.component';
import { PerfilActual, PerfilActualService } from '../../../../core/services/perfil-actual.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { CamaraService } from '../../../../core/services/camara.service';
import { MesasService } from '../../../../core/services/mesas.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { MesaRow, TIPOS_MESA, etiquetaTipo } from '../../../../core/models/mesa.model';

@Component({
  selector: 'app-gestion-mesas',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardContent,
    IonToggle,
    IonButton,
    IonBadge,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonText,
    IonFooter,
    AvatarPerfilComponent,
    BarraAccionesComponent,
  ],
  templateUrl: './gestion-mesas.page.html',
  styleUrls: ['./gestion-mesas.page.scss'],
})
export class GestionMesasPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly avisos = inject(AvisosService);
  protected readonly camara = inject(CamaraService);
  private readonly mesasService = inject(MesasService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly alertController = inject(AlertController);
  private readonly nav = inject(NavController);
  private readonly perfilActual = inject(PerfilActualService);

  readonly perfil = signal<PerfilActual | null>(null);

  readonly tiposMesa = TIPOS_MESA;
  readonly etiquetaTipo = etiquetaTipo;

  readonly mesas = signal<MesaRow[]>([]);
  readonly cargandoLista = signal(true);
  readonly mesaEnEdicion = signal<string | null>(null);
  readonly fotoNuevaDataUrl = signal<string | null>(null);
  readonly guardandoEdicion = signal(false);

  /** Por cada mesa, qué imagen se está mostrando: 0 = foto, 1 = QR */
  private readonly indiceImagen = signal<Record<string, number>>({});

  formEdicion: FormGroup = this.fb.group({
    numero_mesa: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    cant_comensales: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    tipo: [null, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    void this.perfilActual.obtener().then((perfil) => this.perfil.set(perfil));
    await this.cargarMesas();
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.cargandoLista() && !this.mesaEnEdicion()) this.mesas.set(await this.mesasService.listar());
  }

  nuevaMesa(): void {
    this.nav.navigateForward('/administracion/salon/crear');
  }

  async cargarMesas(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();
    try {
      this.mesas.set(await this.mesasService.listar());
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }
  }

  urlFoto(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlFoto(mesa.foto);
  }

  urlQr(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlQr(mesa.qr);
  }

  /** 0 = mostrando foto, 1 = mostrando QR */
  imagenActual(mesa: MesaRow): number {
    return this.indiceImagen()[mesa.id] ?? 0;
  }

  alternarImagen(mesa: MesaRow): void {
    // Si no hay QR persistido todavía (mesas viejas o falló la generación),
    // no tiene sentido alternar a una imagen que no existe.
    if (!mesa.qr) return;
    this.indiceImagen.update((mapa) => ({
      ...mapa,
      [mesa.id]: this.imagenActual(mesa) === 0 ? 1 : 0,
    }));
  }

  async onCambioDisponibilidad(mesa: MesaRow, event: CustomEvent): Promise<void> {
    const nuevaDisponibilidad = event.detail.checked ? 'Ocupada' : 'Libre';
    this.loading.mostrar();
    try {
      const resultado = await this.mesasService.actualizarDisponibilidad(mesa.id, nuevaDisponibilidad);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo actualizar la disponibilidad.');
        await this.cargarMesas();
        return;
      }

      this.mesas.update((lista) =>
        lista.map((m) => (m.id === mesa.id ? { ...m, disponibilidad: nuevaDisponibilidad } : m))
      );
    } finally {
      this.loading.ocultar();
    }
  }

  iniciarEdicion(mesa: MesaRow): void {
    this.mesaEnEdicion.set(mesa.id);
    this.fotoNuevaDataUrl.set(null);
    this.formEdicion.setValue({
      numero_mesa: mesa.numero_mesa,
      cant_comensales: mesa.cant_comensales,
      tipo: mesa.tipo,
    });
  }

  cancelarEdicion(): void {
    this.mesaEnEdicion.set(null);
    this.fotoNuevaDataUrl.set(null);
    this.formEdicion.reset();
  }

  mensajeErrorEdicion(campo: 'numero_mesa' | 'cant_comensales' | 'tipo'): string | null {
    const control = this.formEdicion.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['pattern']) return 'Ingresá un número entero válido.';
    if (control.errors['min']) return 'El valor debe ser mayor a 0.';
    if (control.errors['numeroDuplicado']) return 'Ese número ya pertenece a otra mesa.';
    return null;
  }

  async onBlurNumeroEdicion(mesaId: string): Promise<void> {
    const control = this.formEdicion.get('numero_mesa');
    const valor = Number(control?.value);
    if (control?.errors || !valor) return;

    const existe = await this.mesasService.existeNumero(valor, mesaId);
    if (existe) {
      control?.setErrors({ numeroDuplicado: true });
      await this.avisos.error('Ese número ya pertenece a otra mesa.');
    }
  }

  async tomarNuevaFoto(): Promise<void> {
    const foto = await this.camara.tomarFotoConAviso();
    if (foto) this.fotoNuevaDataUrl.set(foto);
  }

  async guardarEdicion(mesa: MesaRow): Promise<void> {
    this.formEdicion.markAllAsTouched();
    if (this.formEdicion.invalid) {
      await this.avisos.error('Revisá los campos marcados antes de guardar.');
      return;
    }

    if (this.guardandoEdicion()) return;
    this.guardandoEdicion.set(true);
    this.loading.mostrar();

    try {
      const numero_mesa = Number(this.formEdicion.value.numero_mesa);

      if (numero_mesa !== mesa.numero_mesa) {
        const existe = await this.mesasService.existeNumero(numero_mesa, mesa.id);
        if (existe) {
          this.formEdicion.get('numero_mesa')?.setErrors({ numeroDuplicado: true });
          await this.avisos.error('Ese número ya pertenece a otra mesa.');
          return;
        }
      }

      const resultado = await this.mesasService.actualizarMesa(
        mesa,
        {
          numero_mesa,
          cant_comensales: Number(this.formEdicion.value.cant_comensales),
          tipo: this.formEdicion.value.tipo,
        },
        this.fotoNuevaDataUrl() ?? undefined
      );

      if (!resultado.ok || !resultado.mesa) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo guardar la mesa.');
        return;
      }

      this.mesas.update((lista) => lista.map((m) => (m.id === mesa.id ? resultado.mesa! : m)));

      // Sin toast verde: confirma la notificación push.
      this.notificaciones.avisarMesaActualizada(resultado.mesa.numero_mesa);

      this.cancelarEdicion();
    } finally {
      this.guardandoEdicion.set(false);
      this.loading.ocultar();
    }
  }

  async confirmarEliminar(mesa: MesaRow): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar mesa',
      message: `¿Estás seguro de que querés eliminar la Mesa ${mesa.numero_mesa}? Esta acción no se puede deshacer.`,
      cssClass: 'merlot-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar mesa',
          role: 'destructive',
          handler: () => this.eliminarMesa(mesa),
        },
      ],
    });
    await alert.present();
  }

  private async eliminarMesa(mesa: MesaRow): Promise<void> {
    this.loading.mostrar();
    try {
      const resultado = await this.mesasService.eliminarMesa(mesa);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo eliminar la mesa.');
        return;
      }
      this.mesas.update((lista) => lista.filter((m) => m.id !== mesa.id));

      // Sin toast verde: confirma la notificación push.
      this.notificaciones.avisarMesaEliminada(mesa.numero_mesa);
    } finally {
      this.loading.ocultar();
    }
  }
}
