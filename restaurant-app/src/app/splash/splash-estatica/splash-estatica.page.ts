import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { timer } from 'rxjs';
import { NOMBRE_APP } from '../../core/identidad-app';

// Sin animación que esperar acá, así que 3s alcanza para leer el nombre antes de pasar a la animada.
const DURACION_MS = 3000;

@Component({
  selector: 'app-splash-estatica',
  standalone: true,
  imports: [IonContent],
  templateUrl: './splash-estatica.page.html',
  styleUrls: ['./splash-estatica.page.scss'],
})
export class SplashEstaticaPage implements OnInit {
  private readonly router = inject(Router);

  readonly nombreApp = NOMBRE_APP;

  ngOnInit(): void {
    timer(DURACION_MS).subscribe(() => {
      this.router.navigate(['/splash-animada'], { replaceUrl: true });
    });
  }
}
