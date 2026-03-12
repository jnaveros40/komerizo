/**
 * Paleta de Colores del Proyecto
 * 
 * Este archivo centraliza todos los colores utilizados en la aplicación.
 * Para cambiar el tema de colores, simplemente modifica los valores aquí.
 */

export const colors = {
  // Colores Primarios
  primary: {
    main: '#6366f1',      // Indigo vibrante
    light: '#818cf8',     // Indigo claro
    dark: '#4f46e5',      // Indigo oscuro
    contrast: '#ffffff',  // Texto sobre primario
  },

  // Colores Secundarios
  secondary: {
    main: '#ec4899',      // Rosa vibrante
    light: '#f472b6',     // Rosa claro
    dark: '#db2777',      // Rosa oscuro
    contrast: '#ffffff',  // Texto sobre secundario
  },

  // Colores de Acento
  accent: {
    main: '#10b981',      // Verde esmeralda
    light: '#34d399',     // Verde claro
    dark: '#059669',      // Verde oscuro
    contrast: '#ffffff',  // Texto sobre acento
  },

  // Colores Neutrales
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },

  // Colores de Estado
  status: {
    success: '#10b981',   // Verde
    warning: '#f59e0b',   // Ámbar
    error: '#ef4444',     // Rojo
    info: '#3b82f6',      // Azul
  },

  // Fondos
  background: {
    primary: '#ffffff',
    secondary: '#f4f4f5',
    dark: '#18181b',
    paper: '#ffffff',
  },

  // Texto
  text: {
    primary: '#18181b',
    secondary: '#52525b',
    disabled: '#a1a1aa',
    inverse: '#ffffff',
  },

  // Bordes y Divisores
  border: {
    light: '#e4e4e7',
    main: '#d4d4d8',
    dark: '#a1a1aa',
  },

  // Overlays y Sombras
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.3)',
    dark: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

// Tipo para autocompletado
export type ColorPalette = typeof colors;

// Exportación por defecto
export default colors;
