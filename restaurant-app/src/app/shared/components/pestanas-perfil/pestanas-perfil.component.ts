import { Component, Signal, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbles,
  chatbubblesOutline,
  flash,
  flashOutline,
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
  readonly pestanas: PestanaVista[] = (inject(ActivatedRoute).snapshot.data['pestanas'] as Pestana[]).map(p => ({
    ...p,
    cantidad: p.contador ? p.contador() : null,
  }));

  readonly activa = signal('');

  constructor() {
    addIcons({
      chatbubbles, chatbubblesOutline, flash, flashOutline, idCard, idCardOutline,
      people, peopleOutline, personAdd, personAddOutline,
      receipt, receiptOutline, restaurant, restaurantOutline, statsChart, statsChartOutline,
      wine, wineOutline,
    });
  }

  icono(p: Pestana): string {
    return p.ruta === this.activa() ? p.icono.replace(/-outline$/, '') : p.icono;
  }
}
