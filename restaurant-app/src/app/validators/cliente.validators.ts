import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const REGEX_DNI = /^\d{7,8}$/;

/** DNI argentino: solo números, 7 u 8 dígitos, sin puntos ni letras. */
export function validadorDni(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = (control.value ?? '').toString().trim();
    if (!valor) return null; // el "required" lo maneja otro validador
    return REGEX_DNI.test(valor) ? null : { formatoDni: true };
  };
}