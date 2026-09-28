import { Component, Injector, Signal, computed, inject, runInInjectionContext, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbles,
  chatbubblesOutline,
  book,
  bookOutline,
  flash,
  flashOutline,
  gameController,
  gameControllerOutline,
  home,
  homeOutline,
  idCard,
  idCardOutline,
  people,
  peopleOutline,
  personAdd,
  personAddOutline,
  receipt,
  receiptOutline,
  restaurant,
  restaurantOutline,
  statsChart,
  statsChartOutline,
  wine,
  wineOutline,
} from 'ionicons/icons';
import { Pestana } from '../../../core/models/pestanas-por-perfil';

interface PestanaVista extends Pestana {
  cantidad: Signal<number> | null;
}

@Component({
  selector: 'app-pestanas-perfil',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  templateUrl: './pestanas-perfil.component.html',
})
export class PestanasPerfilComponent {
  private readonly injector = inject(Injector);
  private readonly contadores = new Map<string, Signal<number>>();

  /** En data.pestanas: una lista fija o una fábrica que devuelve la lista en vivo (el cliente, según su etapa). */
  private readonly origen: Signal<Pestana[]> = (() => {
    const dato = inject(ActivatedRoute).snapshot.data['pestanas'] as Pestana[] | (() => Signal<Pestana[]>);
    return Array.isArray(dato) ? signal(dato) : dato();
  })();

  readonly pestanas = computed<PestanaVista[]>(() =>
    this.origen().map(p => ({ ...p, cantidad: this.contador(p) }))
  );

  readonly activa = signal('');

  constructor() {
    addIcons({
      book, bookOutline, chatbubbles, chatbubblesOutline, flash, flashOutline,
      gameController, gameControllerOutline, home, homeOutline, idCard, idCardOutline,
      people, peopleOutline, personAdd, personAddOutline,
      receipt, receiptOutline, restaurant, restaurantOutline, statsChart, statsChartOutline,
      wine, wineOutline,
    });
  }

  private contador(p: Pestana): Signal<number> | null {
    if (!p.contador) return null;
    let cantidad = this.contadores.get(p.ruta);
    if (!cantidad) {
      cantidad = untracked(() => runInInjectionContext(this.injector, p.contador!));
      this.contadores.set(p.ruta, cantidad);
    }
    return cantidad;
  }

  icono(p: Pestana): string {
    return p.ruta === this.activa() ? p.icono.replace(/-outline$/, '') : p.icono;
  }
}
