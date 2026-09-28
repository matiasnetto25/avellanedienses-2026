import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';


export function validadorTextoNoVacio(minLength = 2, maxLength = 120): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = (control.value ?? '') as string;
    const sinEspacios = valor.trim();

    if (!sinEspacios) {
      return { soloEspacios: true };
    }
    if (sinEspacios.length < minLength) {
      return { minlength: { requiredLength: minLength, actualLength: sinEspacios.length } };
    }
    if (sinEspacios.length > maxLength) {
      return { maxlength: { requiredLength: maxLength, actualLength: sinEspacios.length } };
    }
    return null;
  };
}

export function validadorEnteroPositivo(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (valor === null || valor === '' || valor === undefined) return null; // required lo maneja aparte
    const num = Number(valor);
    if (!Number.isFinite(num) || !Number.isInteger(num)) return { noEsEntero: true };
    if (num <= 0) return { noEsPositivo: true };
    return null;
  };
}
