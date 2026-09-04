import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { timer } from 'rxjs';
import { INTEGRANTES, NOMBRE_APP, NOMBRE_GRUPO } from '../../core/identidad-app';

// La secuencia de animación (ícono -> nombre -> divisor -> grupo -> integrantes) termina ~2.75s
// después de entrar; 4s le da margen para asentarse antes de navegar a /tabs.
const DURACION_MS = 4000;

@Component({
  selector: 'app-splash-animada',
  standalone: true,
  imports: [CommonModule, IonContent],
  templateUrl: './splash-animada.page.html',
  styleUrls: ['./splash-animada.page.scss'],
})
export class SplashAnimadaPage implements OnInit {
  readonly nombreApp = NOMBRE_APP;
  readonly nombreGrupo = NOMBRE_GRUPO;
  readonly integrantes = INTEGRANTES;

  @ViewChild('audioApertura', { static: true }) private audioApertura!: ElementRef<HTMLAudioElement>;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.audioApertura.nativeElement.play().catch(() => {
      // El navegador/WebView puede bloquear el autoplay; no es un error fatal para el flujo del splash.
    });

    timer(DURACION_MS).subscribe(() => {
      // TODO: spec 4 (login) - cambiar el destino final a '/login' cuando exista LoginPage.
      // Resuelto así con el equipo porque spec 4 todavía no está implementada.
      this.router.navigate(['/tabs'], { replaceUrl: true });
    });
  }
}
