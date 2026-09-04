import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [IonContent, IonButton],
  templateUrl: './principal.page.html',
  styleUrls: ['./principal.page.scss'],
})
export class PrincipalPage {
  private readonly router = inject(Router);

  async cerrarSesion(): Promise<void> {
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
