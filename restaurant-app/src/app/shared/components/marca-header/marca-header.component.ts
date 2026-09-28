import { Component, input } from '@angular/core';
import { NOMBRE_APP } from '../../../core/identidad-app';

@Component({
  selector: 'app-marca-header',
  standalone: true,
  templateUrl: './marca-header.component.html',
  styleUrls: ['./marca-header.component.scss'],
  host: { '[class.compacto]': 'compacto()' },
})
export class MarcaHeaderComponent {
  readonly nombreApp = NOMBRE_APP;
  readonly compacto = input(false);
}
