import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
 
const REGEX_CUIL = /^\d{2}-\d{8}-\d{1}$/;
// Letras (con acentos/ñ) y espacios, para nombre/apellido.
const REGEX_SOLO_TEXTO = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
// Formato de email simple (misma exigencia que valida Supabase Auth del lado del servidor).
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validadorCuil(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = (control.value ?? '').trim();
    if (!valor) return null; // el "required" lo maneja otro validador
    return REGEX_CUIL.test(valor) ? null : { formatoCuil: true };
  };
}

/**
 * Reemplaza a Validators.email de Angular, que NO tolera espacios al
 * principio/final del valor. En mobile es común que el teclado agregue
 * un espacio invisible al autocompletar, lo que hacía que un email
 * perfectamente válido (ej. "mozo1@gmail.com ") se marcara como inválido.
 * Acá se trimea antes de validar el formato.
 */
export function validadorEmailValido(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = (control.value ?? '').trim();
    if (!valor) return null; // el "required" lo maneja otro validador
    return REGEX_EMAIL.test(valor) ? null : { email: true };
  };
}
 
export function validadorTextoValido(minLength = 4): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = (control.value ?? '');
    const sinEspacios = valor.trim();
 
    if (!sinEspacios) {
      return { soloEspacios: true };
    }
    if (sinEspacios.length < minLength) {
      return { minlength: { requiredLength: minLength, actualLength: sinEspacios.length } };
    }
    if (!REGEX_SOLO_TEXTO.test(sinEspacios)) {
      return { soloTexto: true };
    }
    return null;
  };
}
 
export function validadorFechaNacimiento(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!valor) return null;
 
    const fecha = new Date(valor);
    if (isNaN(fecha.getTime())) {
      return { fechaInvalida: true };
    }
 
    const hoy = new Date();
    if (fecha > hoy) {
      return { fechaFutura: true };
    }
 
    const edadMinima = 16; // edad mínima laboral razonable
    const edadMaxima = 90;
    const edad = hoy.getFullYear() - fecha.getFullYear();
    if (edad < edadMinima || edad > edadMaxima) {
      return { edadFueraDeRango: true };
    }
 
    return null;
  };
}
 
export function validadorPasswordsCoinciden(campoPassword: string, campoRepetir: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const password = grupo.get(campoPassword)?.value;
    const repetir = grupo.get(campoRepetir)?.value;
    if (!password || !repetir) return null;
    return password === repetir ? null : { passwordsNoCoinciden: true };
  };
}
 
/**
 * Calcula el dígito verificador de CUIL (algoritmo mod-11 estándar de AFIP).
 * Recibe los primeros 10 dígitos (2 de prefijo + 8 de DNI) y devuelve el CUIL completo.
 * Se usa solo para SUGERIR un valor al escanear el DNI; el usuario debe poder
 * revisarlo y corregirlo, porque el prefijo (20/23/24/27/30/33/34) no siempre
 * es 100% determinable solo con el sexo.
 */
export function calcularCuilSugerido(dni: string, esFemenino: boolean): string | null {
  const dniLimpio = dni.replace(/\D/g, '');
  if (dniLimpio.length < 7 || dniLimpio.length > 8) return null;
 
  const dniPadded = dniLimpio.padStart(8, '0');
  const prefijo = esFemenino ? '27' : '20';
  const base = `${prefijo}${dniPadded}`;
 
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = base
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
 
  const resto = suma % 11;
  let verificador = 11 - resto;
 
  if (verificador === 11) verificador = 0;
  if (verificador === 10) {
    // Caso borde: se prueba con el prefijo alternativo (23) en vez de 20/27
    return calcularCuilConPrefijo(dniPadded, '23');
  }
 
  return `${prefijo}-${dniPadded}-${verificador}`;
}
 
function calcularCuilConPrefijo(dniPadded: string, prefijo: string): string | null {
  const base = `${prefijo}${dniPadded}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = base
    .split('')
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = suma % 11;
  let verificador = 11 - resto;
  if (verificador === 11) verificador = 0;
  if (verificador === 10) return null; // no se pudo determinar, que lo cargue a mano
  return `${prefijo}-${dniPadded}-${verificador}`;
}