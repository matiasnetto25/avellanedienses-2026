import { Producto } from './producto.model';
 
export const PRODUCTOS_MOCK: Producto[] = [
  // ---------- COMIDAS (tapeo) ----------
  {
    id: 'comida-01',
    nombre: 'Tabla de Jamón Ibérico',
    precio: 8500,
    descripcion:
      'Selección de jamón ibérico de bellota cortado a cuchillo, acompañado de pan tostado y aceite de oliva virgen extra.',
    tiempoElaboracion: '10-15 min',
    categoria: 'comida',
    imagenes: ['🍖', '🥖', '🫒'],
  },
  {
    id: 'comida-02',
    nombre: 'Croquetas de Jamón',
    precio: 5200,
    descripcion:
      'Croquetas caseras de jamón serrano y bechamel cremosa, fritas hasta lograr un dorado crujiente.',
    tiempoElaboracion: '12-18 min',
    categoria: 'comida',
    imagenes: ['🥟', '🍟', '🧈'],
  },
  {
    id: 'comida-03',
    nombre: 'Pulpo a la Gallega',
    precio: 9800,
    descripcion:
      'Pulpo cocido a fuego lento, laminado sobre cama de papas, con pimentón dulce, sal gruesa y aceite de oliva.',
    tiempoElaboracion: '20-25 min',
    categoria: 'comida',
    imagenes: ['🐙', '🥔', '🌶️'],
  },
  {
    id: 'comida-04',
    nombre: 'Tabla de Quesos',
    precio: 7600,
    descripcion:
      'Selección de quesos de cabra, oveja y vaca curados, con membrillo casero, nueces y frutos secos.',
    tiempoElaboracion: '8-10 min',
    categoria: 'comida',
    imagenes: ['🧀', '🥜', '🍯'],
  },
  {
    id: 'comida-05',
    nombre: 'Gambas al Ajillo',
    precio: 8900,
    descripcion:
      'Langostinos salteados en aceite de oliva con ajo, guindilla y perejil fresco, servidos en cazuela de barro.',
    tiempoElaboracion: '10-12 min',
    categoria: 'comida',
    imagenes: ['🍤', '🧄', '🌿'],
  },
 
  // ---------- BEBIDAS ----------
  {
    id: 'bebida-01',
    nombre: 'Malbec Reserva',
    precio: 6500,
    descripcion:
      'Vino tinto de Malbec añejado en barrica de roble francés, notas a ciruela, vainilla y especias. Copa 200ml.',
    tiempoElaboracion: '3-5 min',
    categoria: 'bebida',
    imagenes: ['🍷', '🍇', '🛢️'],
  },
  {
    id: 'bebida-02',
    nombre: 'Sauvignon Blanc',
    precio: 5900,
    descripcion:
      'Vino blanco fresco y aromático, con notas cítricas y herbáceas. Ideal para maridar con quesos y pescados.',
    tiempoElaboracion: '3-5 min',
    categoria: 'bebida',
    imagenes: ['🥂', '🍋', '🧊'],
  },
  {
    id: 'bebida-03',
    nombre: 'Espumante Extra Brut',
    precio: 7200,
    descripcion:
      'Burbujas finas y persistentes, elaborado por método tradicional. Perfecto para brindar o acompañar postres.',
    tiempoElaboracion: '3-5 min',
    categoria: 'bebida',
    imagenes: ['🍾', '🥂', '✨'],
  },
  {
    id: 'bebida-04',
    nombre: 'Vermú de la Casa',
    precio: 4800,
    descripcion:
      'Vermú artesanal macerado con hierbas y cítricos, servido con hielo, rodaja de naranja y aceituna.',
    tiempoElaboracion: '5-7 min',
    categoria: 'bebida',
    imagenes: ['🍹', '🍊', '🫒'],
  },
  {
    id: 'bebida-05',
    nombre: 'Agua Mineral con Gas',
    precio: 2200,
    descripcion:
      'Agua mineral premium, servida bien fría con rodajas de limón y menta fresca.',
    tiempoElaboracion: '2-3 min',
    categoria: 'bebida',
    imagenes: ['💧', '🍋', '🌿'],
  },
 
  // ---------- POSTRES ----------
  {
    id: 'postre-01',
    nombre: 'Tarta de Queso',
    precio: 4900,
    descripcion:
      'Tarta de queso horneada al estilo vasco, textura cremosa por dentro y caramelizada por fuera, con coulis de frutos rojos.',
    tiempoElaboracion: '5-8 min',
    categoria: 'postre',
    imagenes: ['🍰', '🍓', '🫐'],
  },
  {
    id: 'postre-02',
    nombre: 'Flan Casero',
    precio: 3800,
    descripcion:
      'Flan artesanal de huevo con caramelo, acompañado de crema chantilly y una teja de almendras.',
    tiempoElaboracion: '5-8 min',
    categoria: 'postre',
    imagenes: ['🍮', '🍦', '🥄'],
  },
  {
    id: 'postre-03',
    nombre: 'Helado Artesanal',
    precio: 4200,
    descripcion:
      'Dos bochas de helado artesanal a elección, servido con salsa de chocolate caliente y barquillo.',
    tiempoElaboracion: '3-5 min',
    categoria: 'postre',
    imagenes: ['🍨', '🍫', '🍪'],
  },
  {
    id: 'postre-04',
    nombre: 'Brownie con Helado',
    precio: 5400,
    descripcion:
      'Brownie de chocolate tibio, con una bocha de helado de vainilla, nueces y salsa de dulce de leche.',
    tiempoElaboracion: '8-10 min',
    categoria: 'postre',
    imagenes: ['🍫', '🍦', '🥜'],
  },
  {
    id: 'postre-05',
    nombre: 'Copa de Frutos Rojos',
    precio: 4600,
    descripcion:
      'Frutillas, arándanos y frambuesas frescas maceradas en almíbar de vino tinto, con crema y hojas de menta.',
    tiempoElaboracion: '5-7 min',
    categoria: 'postre',
    imagenes: ['🍓', '🫐', '🍒'],
  },
];