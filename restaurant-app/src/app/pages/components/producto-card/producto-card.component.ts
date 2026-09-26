import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonBadge,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  timeOutline,
} from 'ionicons/icons';
import { Producto } from '../../../core/models/producto.model';

@Component({
  selector: 'app-producto-card',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent, IonIcon, IonBadge],
  templateUrl: './producto-card.component.html',
  styleUrls: ['./producto-card.component.scss'],
})
export class ProductoCardComponent {
  @Input({ required: true }) producto!: Producto;

  /** Índice de la imagen actualmente visible dentro del carrusel */
  indiceActual = 0;

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, timeOutline });
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
