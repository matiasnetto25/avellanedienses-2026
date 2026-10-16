/** Mensajes de error de los formularios de empleado (alta y edición), por campo y tipo de error. */
export const MENSAJES_ERROR: Record<string, Record<string, string>> = {
  nombre: {
    required: 'Ingresá el nombre.',
    soloEspacios: 'El nombre no puede estar vacío.',
    minlength: 'El nombre debe tener al menos 4 caracteres.',
    soloTexto: 'El nombre solo puede contener letras.',
  },
  apellido: {
    required: 'Ingresá el apellido.',
    soloEspacios: 'El apellido no puede estar vacío.',
    minlength: 'El apellido debe tener al menos 4 caracteres.',
    soloTexto: 'El apellido solo puede contener letras.',
  },
  dni: {
    required: 'Ingresá el número de DNI.',
    formatoDni: 'El DNI debe tener 7 u 8 números, sin puntos.',
    dniNoCoincideConCuil: 'El DNI no coincide con el que figura en el CUIL.',
  },
  cuil: {
    required: 'Ingresá el CUIL.',
    formatoCuil: 'Revisá el CUIL: tiene que ser como 20-12345678-3, con el dígito verificador correcto.',
    cuilDuplicado: 'El CUIL ingresado ya pertenece a un empleado.',
  },
  email: {
    required: 'Ingresá el email.',
    email: 'El email ingresado no es válido.',
    emailDuplicado: 'El email ingresado ya pertenece a un empleado.',
  },
  password: {
    required: 'Ingresá una contraseña.',
    minlength: 'La contraseña debe tener al menos 6 caracteres.',
  },
  confirmarPassword: {
    required: 'Repetí la contraseña.',
    passwordsNoCoinciden: 'Las contraseñas no coinciden.',
  },
  puesto: { required: 'Seleccioná el puesto.' },
};