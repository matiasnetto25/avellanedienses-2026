import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { timer } from 'rxjs';
import { NOMBRE_APP } from '../../core/identidad-app';

// Sin animación que esperar acá, así que 3s alcanza para leer el nombre antes de pasar a la animada.
const DURACION_MS = 3000;

@Component({
  selector: 'app-splash-estatica',
  standalone: true,
  imports: [CommonModule, IonContent],
  templateUrl: './splash-estatica.page.html',
  styleUrls: ['./splash-estatica.page.scss'],
})
export class SplashEstaticaPage implements OnInit {
  readonly nombreApp = NOMBRE_APP;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    timer(DURACION_MS).subscribe(() => {
      this.router.navigate(['/splash-animada'], { replaceUrl: true });
    });
  }
}
