import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { AvisosService } from '../services/avisos.service';

/**
 * Llamar al principio de cada onSubmit. Si el formulario es válido devuelve true.
 * Si no: marca todo como tocado, vibra, avisa y enfoca el primer campo con error.
 *
 * Patrón en la pantalla:
 *
 * ```html
 * <ion-input class="campo" fill="outline" label="DNI" label-placement="floating"
 *            inputmode="numeric" formControlName="dni" aria-describedby="dni-aviso" />
 * <app-aviso-campo id="dni-aviso" [control]="form.controls.dni" />
 * ```
 *
 * ```ts
 * private readonly el = inject(ElementRef<HTMLElement>);
 *
 * async onSubmit() {
 *   if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) return;
 *   // …enviar
 * }
 * ```
 *
 * La acción principal NO se deshabilita por `form.invalid` (lineamientos §6):
 * solo mientras se envía.
 */
export async function validarFormulario(
  form: FormGroup,
  avisos: AvisosService,
  contenedor?: HTMLElement,
): Promise<boolean> {
  if (form.valid) {
    return true;
  }

  form.markAllAsTouched();
  // AvisosService.error() ya vibra.
  await Promise.all([avisos.error('Revisá los campos marcados.'), enfocarPrimerError(contenedor)]);
  return false;
}

const SELECTOR_CAMPO_CON_ERROR = ['ion-input', 'ion-textarea', 'ion-select', 'ion-checkbox', 'ion-radio-group', 'ion-datetime']
  .map((campo) => `${campo}.ion-invalid.ion-touched`)
  .join(', ');

async function enfocarPrimerError(contenedor?: HTMLElement): Promise<void> {
  if (!contenedor) return;

  // Ionic pone las clases ion-invalid/ion-touched en el próximo frame
  // después de markAllAsTouched: hay que esperarlo para encontrar el campo.
  await new Promise<void>((resolver) => requestAnimationFrame(() => resolver()));

  const campo = contenedor.querySelector<HTMLElement & { setFocus?: () => Promise<void> }>(SELECTOR_CAMPO_CON_ERROR);
  if (!campo) return;

  campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (campo.setFocus) {
    await campo.setFocus();
  } else {
    campo.focus();
  }
}

// -----------------------------------------------------------------------------
// Validadores de dominio compartidos entre formularios.
// Todos dejan pasar el valor vacío: eso lo controla Validators.required.
// Sus claves de error tienen mensaje por default en app-aviso-campo.
// -----------------------------------------------------------------------------

const REGEX_DNI = /^\d{7,8}$/;
const REGEX_CUIL = /^\d{2}-\d{8}-\d$/;
// Letras (con tildes, diéresis y ñ) y espacios, para nombre y apellido.
const REGEX_SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/;
// Mayor a 0 se controla aparte; acá solo el formato: entero o con hasta 2 decimales.
const REGEX_PRECIO = /^\d+([.,]\d{1,2})?$/;

function valorTexto(control: AbstractControl): string {
  return (control.value ?? '').toString().trim();
}

/** DNI argentino: solo números, 7 u 8 dígitos, sin puntos ni letras. */
export function dni(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = valorTexto(control);
    if (!valor) return null;
    return REGEX_DNI.test(valor) ? null : { formatoDni: true };
  };
}

/** CUIL con guiones (20-12345678-3) y dígito verificador correcto. */
export function cuil(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = valorTexto(control);
    if (!valor) return null;
    if (!REGEX_CUIL.test(valor)) return { formatoCuil: true };

    const digitos = valor.replace(/-/g, '');
    const verificador = digitoVerificadorCuil(digitos.slice(0, 10));
    return verificador === Number(digitos[10]) ? null : { formatoCuil: true };
  };
}

/** Nombre y apellido: solo letras (acepta tildes, ñ y espacios). */
export function soloLetras(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = valorTexto(control);
    if (!valor) return null;
    return REGEX_SOLO_LETRAS.test(valor) ? null : { soloTexto: true };
  };
}

/** Precio: mayor a 0, con hasta 2 decimales (acepta punto o coma). */
export function precio(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = valorTexto(control);
    if (!valor) return null;
    if (!REGEX_PRECIO.test(valor)) return { precio: true };
    return Number(valor.replace(',', '.')) > 0 ? null : { precio: true };
  };
}

/**
 * Dígito verificador de CUIL (algoritmo mod-11 de AFIP) a partir de los
 * primeros 10 dígitos (2 de prefijo + 8 de DNI). Devuelve null en el caso
 * borde en que el resultado es 10: con ese prefijo no hay CUIL válido.
 */
export function digitoVerificadorCuil(primeros10: string): number | null {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = primeros10.split('').reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const verificador = 11 - (suma % 11);
  if (verificador === 11) return 0;
  if (verificador === 10) return null;
  return verificador;
}
