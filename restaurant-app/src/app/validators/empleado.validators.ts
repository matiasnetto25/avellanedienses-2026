import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { digitoVerificadorCuil, soloLetras } from '../core/utils/formularios';
 
// Formato de email simple (misma exigencia que valida Supabase Auth del lado del servidor).
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    return soloLetras()(control);
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
 * «Repetir contraseña»: validador del PROPIO control (así app-aviso-campo
 * muestra el error debajo del campo). La pantalla vuelve a validarlo cuando
 * cambia la contraseña.
 */
export function validadorRepetirPassword(campoPassword: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.parent?.get(campoPassword)?.value;
    if (!control.value || !password) return null;
    return control.value === password ? null : { passwordsNoCoinciden: true };
  };
}

/**
 * Validador del control DNI: tiene que ser el que figura en el CUIL
 * (XX-<DNI>-X). La pantalla vuelve a validarlo cuando cambia el CUIL.
 */
export function validadorDniDelCuil(campoCuil: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const dni = (control.value ?? '').toString().trim();
    const partes = (control.parent?.get(campoCuil)?.value ?? '').toString().trim().split('-');
    if (!dni || partes.length !== 3 || !/^\d+$/.test(partes[1])) return null;
    return Number(partes[1]) === Number(dni) ? null : { dniNoCoincideConCuil: true };
  };
}

/**
 * El DNI no se guarda (la tabla empleados no tiene esa columna) porque ya va
 * dentro del CUIL: XX-<DNI>-X. Este validador de grupo evita que se cargue un
 * DNI que no corresponde al CUIL ingresado.
 */
export function validadorDniCoincideConCuil(campoDni: string, campoCuil: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const dni = (grupo.get(campoDni)?.value ?? '').toString().trim();
    const cuil = (grupo.get(campoCuil)?.value ?? '').toString().trim();
    const partes = cuil.split('-');
    if (!dni || partes.length !== 3 || !/^\d+$/.test(partes[1])) return null;
    return Number(partes[1]) === Number(dni) ? null : { dniNoCoincideConCuil: true };
  };
}

/**
 * Arma el CUIL completo a partir del DNI, con el dígito verificador de
 * digitoVerificadorCuil (core/utils/formularios.ts).
 * Se usa solo para SUGERIR un valor al escanear el DNI; el usuario debe poder
 * revisarlo y corregirlo, porque el prefijo (20/23/24/27/30/33/34) no siempre
 * es 100% determinable solo con el sexo.
 */
export function calcularCuilSugerido(dni: string, esFemenino: boolean): string | null {
  const dniLimpio = dni.replace(/\D/g, '');
  if (dniLimpio.length < 7 || dniLimpio.length > 8) return null;

  const dniPadded = dniLimpio.padStart(8, '0');
  // Caso borde: si con 20/27 el verificador da 10, se prueba con el prefijo alternativo (23).
  return calcularCuilConPrefijo(dniPadded, esFemenino ? '27' : '20') ?? calcularCuilConPrefijo(dniPadded, '23');
}

function calcularCuilConPrefijo(dniPadded: string, prefijo: string): string | null {
  const verificador = digitoVerificadorCuil(`${prefijo}${dniPadded}`);
  if (verificador === null) return null; // no se pudo determinar, que lo cargue a mano
  return `${prefijo}-${dniPadded}-${verificador}`;
}