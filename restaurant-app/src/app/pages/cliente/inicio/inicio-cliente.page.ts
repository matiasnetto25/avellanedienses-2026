import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonFooter, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  chatbubblesOutline,
  chevronForwardOutline,
  closeCircleOutline,
  qrCodeOutline,
  receiptOutline,
  starOutline,
  statsChartOutline,
  syncOutline,
  timeOutline,
} from 'ionicons/icons';
import { AlertController } from '@ionic/angular';
import { AvisosService } from '../../../core/services/avisos.service';
import { QrService } from '../../../core/services/qr.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';
import { EncuestasService } from '../../../core/services/encuestas.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { PedidosService } from '../../../core/services/pedidos.service';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
import { LoadingService } from '../../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { estadoSolicitudMesa } from '../../../core/utils/estado-visual';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { ChipEstadoComponent } from '../../../shared/components/chip-estado/chip-estado.component';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { Pedido } from '../../../core/models/pedido.model';
import { AvisoRechazoService } from '../../pedidos/cliente/components/aviso-rechazo/aviso-rechazo.service';
import { AvisoRecepcionService } from '../../pedidos/cliente/components/aviso-recepcion/aviso-recepcion.service';
import { TarjetaEstadoPedidoComponent } from '../../pedidos/cliente/components/tarjeta-estado-pedido/tarjeta-estado-pedido.component';

type AccionPrincipal = 'escanear-entrada' | 'escanear-mesa' | 'ver-menu';

@Component({
  selector: 'app-inicio-cliente',
  standalone: true,
  imports: [
    IonContent,
    IonFooter,
    IonButton,
    IonIcon,
    AlturaDisponibleDirective,
    BarraAccionesComponent,
    ChipEstadoComponent,
    EncabezadoPerfilComponent,
    NgTemplateOutlet,
    TarjetaEstadoPedidoComponent,
  ],
  templateUrl: './inicio-cliente.page.html',
  styleUrls: ['./inicio-cliente.page.scss'],
})
export class InicioClientePage implements OnInit {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly etapaCliente = inject(EtapaClienteService);
  private readonly avisoRechazo = inject(AvisoRechazoService);
  private readonly avisoRecepcion = inject(AvisoRecepcionService);
  private readonly encuestas = inject(EncuestasService);
  private readonly pedidos = inject(PedidosService);
  private readonly avisos = inject(AvisosService);
  private readonly notificaciones = inject(NotificacionesService);
  // De @ionic/angular (no de /standalone): igual que ModalController en los avisos.
  private readonly alertController = inject(AlertController);

  private readonly qr = inject(QrService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);

  readonly pidiendoCuenta = signal(false);
  readonly terminandoVisita = signal(false);

  readonly perfil = signal<PerfilActual | null>(null);
  readonly etapa = this.etapaCliente.etapa;
  readonly solicitudRechazada = this.etapaCliente.solicitudRechazada;
  readonly posicionEnLista = this.etapaCliente.posicionEnLista;
  readonly estadoSolicitudMesa = estadoSolicitudMesa;
  readonly encuestaHabilitada = this.etapaCliente.encuestaHabilitada;
  /** Si la estadía ya tiene encuesta (punto 20). null mientras no se sabe. */
  readonly encuestaCompletada = signal<boolean | null>(null);

  /** La estadía de la que se consultó la encuesta, para descartar respuestas viejas. */
  private solicitudConsultada: string | null = null;

  /** La estadía cuya encuesta se puede completar, o null. */
  private readonly solicitudConEncuesta = computed(() => {
    const etapa = this.etapa();
    return etapa?.tipo === 'estadia' && this.encuestaHabilitada() ? etapa.solicitud.id : null;
  });

  readonly titulo = computed(() => {
    const etapa = this.etapa();
    return etapa?.tipo === 'estadia' ? `MESA ${etapa.solicitud.numero_mesa}` : 'BIENVENIDO';
  });

  readonly accionPrincipal = computed<AccionPrincipal | null>(() => {
    const etapa = this.etapa();
    switch (etapa?.tipo) {
      case 'sin-mesa':
        return 'escanear-entrada';
      case 'mesa-asignada':
        return 'escanear-mesa';
      case 'estadia':
        return etapa.pedido ? null : 'ver-menu';
      default:
        return null;
    }
  });

  constructor() {
    addIcons({
      cardOutline,
qrCodeOutline,
      starOutline,
      statsChartOutline,
      timeOutline,
      syncOutline,
      chatbubblesOutline,
      receiptOutline,
      chevronForwardOutline,
      closeCircleOutline,
    });

    effect(() => {
      if (this.etapaCliente.enEstadia()) {
        void this.avisoRechazo.vigilar();
        void this.avisoRecepcion.vigilar();
      }
    });

    // Cuando se habilita la encuesta o cambia la estadía, consulta si ya la completó.
    effect(() => {
      const solicitudId = this.solicitudConEncuesta();
      untracked(() => void this.consultarEncuesta(solicitudId));
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const [perfil] = await Promise.all([this.perfilActual.obtener(), this.etapaCliente.iniciar()]);
      this.perfil.set(perfil);
    } finally {
      this.loading.ocultar();
    }
  }

  ionViewWillEnter(): void {
    this.etapaCliente.mirandoInicio = true;
    if (this.etapa()) void this.etapaCliente.refrescar();
    // Al volver del formulario, la tarjeta pasa a «Ya completaste la encuesta».
    void this.consultarEncuesta(this.solicitudConEncuesta());
  }

  ionViewWillLeave(): void {
    this.etapaCliente.mirandoInicio = false;
  }

  escanearQrEntrada(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-qr']);
  }

  escanearQrMesa(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-mesa']);
  }

  /** La pestaña Menú es la misma carta con la que se pide. */
  irAlMenu(): void {
    if (this.etapa()?.tipo === 'estadia') this.router.navigate(['/cliente/menu']);
  }

  /** Punto 19: vuelve a abrir el aviso para confirmar que recibió el pedido. */
  confirmarRecepcion(pedido: Pedido | null): void {
    if (pedido) void this.avisoRecepcion.mostrar(pedido);
  }

  /**
   * Punto 22: con el pago confirmado, el cliente escanea el QR de SU mesa
   * para terminar la visita. Eso libera la mesa. Después de un mensaje de
   * agradecimiento, vuelve al principio (escanear el QR de ingreso).
   */
  async terminarVisita(): Promise<void> {
    const etapa = this.etapa();
    if (this.terminandoVisita() || etapa?.tipo !== 'estadia' || etapa.pedido?.estado !== 'pagado') return;

    this.terminandoVisita.set(true);
    try {
      const lectura = await this.qr.escanearQrMesa();
      if (!lectura.ok) {
        if (!lectura.cancelado) await this.avisos.error(lectura.mensaje ?? 'No se pudo escanear el código.');
        return;
      }
      if (lectura.mesaId !== etapa.solicitud.mesa_id) {
        await this.avisos.error('Ese QR es de otra mesa. Escaneá el QR de tu mesa.');
        return;
      }

      this.loading.mostrar();
      let resultado;
      try {
        resultado = await this.solicitudesMesa.finalizarEstadia(etapa.solicitud.id, etapa.solicitud.mesa_id);
      } finally {
        this.loading.ocultar();
      }
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo terminar la visita. Probá de nuevo.');
        return;
      }

      await this.agradecerVisita();
      await this.etapaCliente.refrescar();
    } finally {
      this.terminandoVisita.set(false);
    }
  }

  private async agradecerVisita(): Promise<void> {
    const alerta = await this.alertController.create({
      header: '¡Muchas gracias por tu visita!',
      message: 'Esperamos que hayas disfrutado la experiencia. ¡Te esperamos pronto!',
      buttons: [{ text: 'Cerrar', role: 'confirm' }],
      backdropDismiss: false,
    });
    await alerta.present();
    await alerta.onDidDismiss();
  }

  /** Punto 21: la cuenta con el detalle y la propina por QR. */
  verCuenta(): void {
    void this.router.navigate(['/cliente/cuenta']);
  }

  /** Punto 21: el cliente pide la cuenta; el mozo se entera por push. */
  async pedirCuenta(pedido: Pedido): Promise<void> {
    if (this.pidiendoCuenta()) return;
    const alerta = await this.alertController.create({
      header: '¿Pedir la cuenta?',
      message: 'Le vamos a avisar al mozo que querés pagar.',
      buttons: [
        { text: 'Todavía no', role: 'cancel' },
        { text: 'Pedir la cuenta', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;

    this.pidiendoCuenta.set(true);
    try {
      const resultado = await this.pedidos.pedirCuenta(pedido.id);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo pedir la cuenta. Probá de nuevo.');
        return;
      }
      if (resultado.numeroMesa !== undefined) {
        this.notificaciones.avisarCuentaPedida(resultado.numeroMesa);
      }
      await this.avisos.exito('Pediste la cuenta. El mozo ya fue avisado.');
    } finally {
      this.pidiendoCuenta.set(false);
    }
    // Primero la sugerencia de encuesta (si hace falta) y después la cuenta.
    const fueALaEncuesta = await this.sugerirEncuesta();
    if (!fueALaEncuesta) this.verCuenta();
  }

  /**
   * Al pedir la cuenta, si la estadía todavía no tiene encuesta, se la
   * sugiere en un modal (punto 20). Si falla la consulta no se muestra: la
   * encuesta sigue disponible en el inicio. Devuelve true si el cliente
   * aceptó y se lo llevó a la encuesta.
   */
  private async sugerirEncuesta(): Promise<boolean> {
    const etapa = this.etapa();
    if (etapa?.tipo !== 'estadia') return false;
    const resultado = await this.encuestas.estadiaTieneEncuesta(etapa.solicitud.id);
    if (!resultado.ok || resultado.dato) return false;

    const alerta = await this.alertController.create({
      header: '¿Nos contás cómo fue tu visita?',
      message: 'Antes de irte, completá la encuesta de satisfacción. Te lleva solo un minuto.',
      buttons: [
        { text: 'Ahora no', role: 'cancel' },
        { text: 'Hacer la encuesta', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return false;
    this.abrirEncuesta();
    return true;
  }

  verPedido(): void {
    const etapa = this.etapa();
    if (etapa?.tipo !== 'estadia') return;
    this.router.navigate(['/mesa', etapa.solicitud.mesa_id, 'estado-pedido'], {
      queryParams: { mesa: etapa.solicitud.numero_mesa },
    });
  }

  consultarAlMozo(): void {
    const etapa = this.etapa();
    if (etapa?.tipo === 'estadia') this.router.navigate(['/consultas', etapa.solicitud.id]);
  }

  abrirEncuesta(): void {
    this.router.navigate(['/cliente/encuesta']);
  }

  verResultadosEncuestas(): void {
    this.router.navigate(['/cliente/resultados-encuestas']);
  }

  private async consultarEncuesta(solicitudId: string | null): Promise<void> {
    this.solicitudConsultada = solicitudId;
    if (!solicitudId) {
      this.encuestaCompletada.set(null);
      return;
    }
    const resultado = await this.encuestas.estadiaTieneEncuesta(solicitudId);
    if (this.solicitudConsultada !== solicitudId) return;
    // Si falla la consulta, la tarjeta lleva al formulario: encuestaGuard vuelve a verificar.
    this.encuestaCompletada.set(resultado.ok ? resultado.dato : null);
  }
}