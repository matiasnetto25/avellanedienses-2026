import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonFooter,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonModal,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { restaurantOutline, wineOutline, iceCreamOutline } from 'ionicons/icons';
import { ProductoCardComponent } from '../../../components/producto-card/producto-card.component';
import { ResumenPedidoComponent } from '../components/resumen-pedido/resumen-pedido.component';
import { AlturaDisponibleDirective } from '../../../../shared/directives/altura-disponible.directive';
import { Producto, CategoriaProducto } from '../../../../core/models/producto.model';
import { MenuItemsService } from '../../../../core/services/menu-items.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ClienteActualService } from '../../../../core/services/cliente-actual.service';
import { CarritoService } from '../../../../core/services/carrito.service';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';

@Component({
  selector: 'app-armar-pedido',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    CommonModule,
    IonContent,
    IonHeader,
    IonFooter,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonModal,
    ProductoCardComponent,
    ResumenPedidoComponent,
  ],
  templateUrl: './armar-pedido.page.html',
  // Los estilos de la carta, para que se vea igual que /menu.
  styleUrls: ['../../../menu/menu.component.scss', './armar-pedido.page.scss'],
})
export class ArmarPedidoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly menuItems = inject(MenuItemsService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly pedidos = inject(PedidosService);
  private readonly notificaciones = inject(NotificacionesService);
  protected readonly carrito = inject(CarritoService);

  readonly idMesa = this.route.snapshot.paramMap.get('idMesa') ?? '';
  readonly rutaMesa = `/mesa/${this.idMesa}`;

  /**
   * Número de mesa que llega por query param desde /mesa/:idMesa
   * (/mesa/:idMesa/pedido?mesa=5). Es solo informativo, para el título y
   * el resumen; null si se abrió desde otro lado.
   */
  readonly numeroMesa = signal<number | null>(this.leerNumeroMesa());

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly productos = signal<Producto[]>([]);
  readonly categoria = signal<CategoriaProducto>('comida');
  readonly resumenAbierto = signal(false);
  /** true mientras se envía: evita un segundo pedido por doble toque. */
  readonly enviando = signal(false);

  readonly productosFiltrados = computed(() =>
    this.productos().filter((producto) => producto.categoria === this.categoria())
  );

  constructor() {
    addIcons({ restaurantOutline, wineOutline, iceCreamOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const productos = await this.menuItems.listarActivos();
      if (!productos) {
        this.errorCarga.set(true);
        await this.avisos.error('No se pudo cargar la carta. Probá de nuevo.');
        return;
      }

      this.productos.set(productos);
    } catch (error) {
      console.error('Error cargando la carta:', error);
      this.errorCarga.set(true);
      await this.avisos.error('No se pudo cargar la carta. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  private leerNumeroMesa(): number | null {
    const valor = Number(this.route.snapshot.queryParamMap.get('mesa'));
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  }

  onCambioCategoria(event: CustomEvent): void {
    this.categoria.set(event.detail.value as CategoriaProducto);
  }

  cambiarCantidad(producto: Producto, cantidad: number): void {
    this.carrito.cambiarCantidad(producto, cantidad);
  }

  revisarPedido(): void {
    if (!this.carrito.vacio()) this.resumenAbierto.set(true);
  }

  /** «Seguir eligiendo»: cierra el resumen con el carrito intacto. */
  cerrarResumen(): void {
    if (!this.enviando()) this.resumenAbierto.set(false);
  }

  /**
   * Crea el pedido. Si sale bien, vacía el carrito, avisa a los mozos y
   * saca al cliente de la carta. Si falla, el carrito queda como estaba.
   */
  async enviarPedido(): Promise<void> {
    if (this.enviando() || this.carrito.vacio()) return;
    this.enviando.set(true);
    this.loading.mostrar();

    // Se toman antes de vaciar el carrito, para la push.
    const cantidadProductos = this.carrito.cantidadProductos();
    const total = this.carrito.total();
    const tiempo = this.carrito.tiempoEstimado();

    try {
      // El guard ya validó la estadía; acá solo hace falta el id para el
      // pedido. Se resuelve al enviar, no al entrar.
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      if (!clienteId) {
        await this.avisos.error('No pudimos identificarte. Volvé a escanear el QR de tu mesa.');
        return;
      }

      const resultado = await this.pedidos.crear(clienteId, this.carrito.lineas());

      if (resultado.ok) {
        this.carrito.vaciar();
        // Sin await: la push no bloquea, y si falla el pedido igual quedó creado.
        this.notificaciones.avisarNuevoPedido(
          resultado.numeroMesa ?? this.numeroMesa() ?? 0,
          cantidadProductos,
          total,
          tiempo
        );
        this.cerrarResumenTrasEnviar();
        await this.avisos.exito('Pedido enviado. Esperando confirmación del mozo.');
        this.irAlEstadoDelPedido();
        return;
      }

      if (resultado.pedidoExistenteId) {
        this.cerrarResumenTrasEnviar();
        await this.avisos.advertencia('Ya tenés un pedido en curso.');
        this.irAlEstadoDelPedido();
        return;
      }

      await this.avisos.error(resultado.mensaje ?? 'No se pudo enviar el pedido. Probá de nuevo.');
    } finally {
      this.enviando.set(false);
      this.loading.ocultar();
    }
  }

  /**
   * Cierra la hoja cuando el envío ya terminó. Primero baja «enviando»:
   * mientras está en true, [canDismiss] no deja cerrar el modal, y si se
   * navega con la hoja abierta queda colgada encima de /mesa.
   */
  private cerrarResumenTrasEnviar(): void {
    this.enviando.set(false);
    this.resumenAbierto.set(false);
  }

  /** replaceUrl: el botón atrás no vuelve a la carta del pedido ya enviado. */
  private irAlEstadoDelPedido(): void {
    this.router.navigate([this.rutaMesa, 'estado-pedido'], {
      replaceUrl: true,
      queryParamsHandling: 'preserve',
    });
  }

  reintentar(): void {
    this.errorCarga.set(false);
    this.cargando.set(true);
    void this.ngOnInit();
  }
}
