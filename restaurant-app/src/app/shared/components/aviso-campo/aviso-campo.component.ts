import { Component, computed, input, isDevMode } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline } from 'ionicons/icons';
import { map, startWith, switchMap } from 'rxjs';

type Mensaje = (error: any) => string;

/**
 * Mensajes por default, en voseo y diciendo qué hacer. Incluye las claves de
 * los validadores de dominio de core/utils/formularios.ts.
 * `pattern` no tiene default a propósito: el formato genérico no le dice
 * nada al usuario, cada pantalla lo define en `mensajes`.
 */
const MENSAJES_DEFAULT: Record<string, Mensaje> = {
  required: () => 'Completá este campo.',
  email: () => 'Revisá el correo: tiene que ser como nombre@dominio.com.',
  minlength: (e) => `Tiene que tener al menos ${e.requiredLength} caracteres.`,
  maxlength: (e) => `Puede tener como máximo ${e.requiredLength} caracteres.`,
  min: (e) => `Tiene que ser un número mayor o igual a ${e.min}.`,
  max: (e) => `Tiene que ser un número menor o igual a ${e.max}.`,
  formatoDni: () => 'Escribí el DNI con 7 u 8 números, sin puntos.',
  formatoCuil: () => 'Revisá el CUIL: tiene que ser como 20-12345678-3.',
  soloTexto: () => 'Usá solo letras y espacios.',
  precio: () => 'Escribí un precio mayor a 0, con hasta 2 decimales.',
};

const MENSAJE_GENERICO = 'Revisá este campo.';

/**
 * Aviso de campo (guía §7.3): va debajo del input y solo se ve cuando el
 * control es inválido y el usuario ya lo tocó.
 *
 *   <ion-input … formControlName="dni" aria-describedby="dni-aviso" />
 *   <app-aviso-campo id="dni-aviso" [control]="form.controls.dni" />
 *
 * Ver validarFormulario() en core/utils/formularios.ts.
 */
@Component({
  selector: 'app-aviso-campo',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './aviso-campo.component.html',
  styleUrls: ['./aviso-campo.component.scss'],
})
export class AvisoCampoComponent {
  readonly control = input.required<AbstractControl>();
  /** Mensajes propios por clave de error; pisan a los de default. */
  readonly mensajes = input<Record<string, string>>({});
  /** Texto de ayuda opcional: se ve mientras no hay error. */
  readonly ayuda = input<string>();

  // Cada evento del control (valor, estado, tocado) genera un objeto nuevo,
  // así el computed de abajo se recalcula aunque cambie solo "touched".
  private readonly cambios = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.events.pipe(startWith(null))),
      map(() => ({})),
    ),
  );

  readonly mensaje = computed<string | null>(() => {
    this.cambios();
    const control = this.control();
    if (!control.invalid || !(control.touched || control.dirty) || !control.errors) {
      return null;
    }

    const [clave, detalle] = Object.entries(control.errors)[0];
    const propio = this.mensajes()[clave];
    if (propio) return propio;

    const porDefault = MENSAJES_DEFAULT[clave];
    if (porDefault) return porDefault(detalle);

    if (isDevMode()) {
      const recordatorio =
        clave === 'pattern'
          ? 'app-aviso-campo: el error "pattern" no tiene mensaje por default. Definilo con [mensajes]="{ pattern: \'…\' }".'
          : `app-aviso-campo: el error "${clave}" no tiene mensaje. Definilo con [mensajes].`;
      console.error(recordatorio);
    }
    return MENSAJE_GENERICO;
  });

  constructor() {
    addIcons({ alertCircleOutline });
  }
}
