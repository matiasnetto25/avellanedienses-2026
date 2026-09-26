import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { timer } from 'rxjs';
import { INTEGRANTES, NOMBRE_APP, NOMBRE_GRUPO } from '../../core/identidad-app';
import { SonidosService } from '../../core/services/sonidos.service';

// La secuencia de animación (ícono -> nombre -> divisor -> grupo -> integrantes) termina ~2.75s
// después de entrar; 4s le da margen para asentarse antes de navegar a /bienvenida.
const DURACION_MS = 4000;

@Component({
  selector: 'app-splash-animada',
  standalone: true,
  imports: [IonContent],
  templateUrl: './splash-animada.page.html',
  styleUrls: ['./splash-animada.page.scss'],
})
export class SplashAnimadaPage implements OnInit {
  private readonly router = inject(Router);
  private readonly sonidos = inject(SonidosService);

  readonly nombreApp = NOMBRE_APP;
  readonly nombreGrupo = NOMBRE_GRUPO;
  readonly integrantes = INTEGRANTES;

  ngOnInit(): void {
    this.sonidos.apertura();

    timer(DURACION_MS).subscribe(() => {
      this.router.navigate(['/bienvenida'], { replaceUrl: true });
    });
  }
}
