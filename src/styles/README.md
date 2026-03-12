# 🎨 Sistema de Paleta de Colores

Este directorio contiene el sistema centralizado de colores para el proyecto.

## 📁 Archivos

### `colors.ts`
Contiene la paleta de colores exportada como un objeto TypeScript. Úsalo en tus componentes React:

```tsx
import colors from './styles/colors';

function MyComponent() {
  return (
    <div style={{ backgroundColor: colors.primary.main }}>
      <h1 style={{ color: colors.text.primary }}>Hola Mundo</h1>
    </div>
  );
}
```

### `variables.css`
Contiene las variables CSS personalizadas. Úsalas en tus archivos CSS:

```css
.my-component {
  background-color: var(--color-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-main);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}
```

## 🎨 Paleta de Colores Actual

- **Primario**: Indigo (#6366f1) - Para acciones principales
- **Secundario**: Rosa (#ec4899) - Para elementos destacados
- **Acento**: Verde Esmeralda (#10b981) - Para confirmaciones y éxito

## 🔄 Cómo Cambiar los Colores

1. Abre `colors.ts` y modifica los valores hexadecimales
2. Abre `variables.css` y actualiza las variables CSS correspondientes
3. Los cambios se aplicarán automáticamente en toda la aplicación

## 🌓 Modo Oscuro

El sistema incluye soporte automático para modo oscuro usando `prefers-color-scheme`. También puedes forzar el modo añadiendo las clases `.dark` o `.light` al elemento raíz.

## 💡 Buenas Prácticas

- ✅ Siempre usa las variables en lugar de colores hardcodeados
- ✅ Mantén la consistencia entre `colors.ts` y `variables.css`
- ✅ Usa colores semánticos (primary, success, error) en lugar de colores literales
- ✅ Aprovecha las variables de espaciado, sombras y transiciones
