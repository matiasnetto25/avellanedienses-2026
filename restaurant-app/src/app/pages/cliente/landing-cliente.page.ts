import { Component, OnInit, inject, signal } from '@angular/core';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { AvisosService } from '../../core/services/avisos.service';
import { ClientesService } from '../../core/services/clientes.service';
import { SesionService } from '../../core/services/sesion.service';

@Component({
  selector: 'app-landing-cliente',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './landing-cliente.page.html',
  styleUrls: ['./landing-cliente.page.scss'],
})
export class LandingClientePage implements OnInit {
  private readonly clientesService = inject(ClientesService);
  protected readonly avisos = inject(AvisosService);
  protected readonly sesionService = inject(SesionService);

  readonly nombreCompleto = signal('');
  readonly fotoUrl = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const cliente = await this.clientesService.obtenerClienteActual();
    if (!cliente) return;

    this.nombreCompleto.set(`${cliente.nombre} ${cliente.apellido ?? ''}`.trim());
    this.fotoUrl.set(this.clientesService.obtenerUrlFoto(cliente.foto));
  }
}
