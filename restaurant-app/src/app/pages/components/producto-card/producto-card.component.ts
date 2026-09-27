import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  timeOutline,
  addOutline,
  removeOutline,
} from 'ionicons/icons';
import { Producto } from '../../../core/models/producto.model';
import { CANTIDAD_MAXIMA_ITEM } from '../../../core/models/pedido.model';

@Component({
  selector: 'app-producto-card',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonIcon, IonBadge, IonButton],
  templateUrl: './producto-card.component.html',
  styleUrls: ['./producto-card.component.scss'],
})
export class ProductoCardComponent {
  @Input({ required: true }) producto!: Producto;

  /**
   * Modo pedido (punto 12): si viene, se muestran los controles − y + con
   * esta cantidad. Sin este input, la tarjeta es la de la carta de solo
   * lectura.
   */
  @Input() cantidad?: number;
  @Output() cantidadCambio = new EventEmitter<number>();

  readonly cantidadMaxima = CANTIDAD_MAXIMA_ITEM;

  /** Índice de la imagen actualmente visible dentro del carrusel */
  indiceActual = 0;

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, timeOutline, addOutline, removeOutline });
  }

  sumar(delta: 1 | -1): void {
    const nueva = (this.cantidad ?? 0) + delta;
    if (nueva < 0 || nueva > CANTIDAD_MAXIMA_ITEM) return;
    this.cantidadCambio.emit(nueva);
  }

  imagenAnterior(event: Event): void {
    event.stopPropagation();
    const total = this.producto.imagenes.length;
    this.indiceActual = (this.indiceActual - 1 + total) % total;
  }

  imagenSiguiente(event: Event): void {
    event.stopPropagation();
    const total = this.producto.imagenes.length;
    this.indiceActual = (this.indiceActual + 1) % total;
  }

  irAImagen(index: number, event: Event): void {
    event.stopPropagation();
    this.indiceActual = index;
  }

  /**
   * Detecta si el string de imagen es una URL (real) o un emoji/texto (mock).
   * Así el mismo componente sirve tanto para testing con emojis
   * como para producción con imágenes de Supabase Storage.
   */
  esUrl(valor: string): boolean {
    return /^(https?:)?\/\//.test(valor) || valor.startsWith('data:image');
  }
}
