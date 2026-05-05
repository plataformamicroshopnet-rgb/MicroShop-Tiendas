# Estandarización de Cabeceras Globales Premium

Este plan detalla la creación de un nuevo componente global `PageHeader` para la plataforma, que unificará la experiencia visual e integrará accesos limpios al retroceso del historial y a los temas oscuros/claros de toda la aplicación, en línea con la filosofía de diseño premium de Mercedes.

## User Review Required

> [!IMPORTANT]
> Se solicita confirmación para empezar la intervención masiva en las pantallas listadas a continuación. Este cambio es incremental y reemplazará las variadas etiquetas locales `<h1>` por el nuevo componente renderizado.

## Proposed Changes

### 1. Creación del componente core
#### [NEW] [PageHeader.tsx](file:///c:/Proyectos/MicroShop%20FFVV/webapp_snapshot/src/components/PageHeader.tsx)
Construcción del componente. 
**Estructura y Props propuestos:**
```tsx
interface PageHeaderProps {
  title: React.ReactNode;       // Permite strings o spans de colores (ej. "Tiempo Real" en cyan)
  subtitle?: string;            // Opcional, para no romper pantallas que hoy usan <p> debajo del h1
  showBack?: boolean;           // Renderiza la flecha de retroceso (←)
  showTheme?: boolean;          // Renderiza el sol/luna
  backFallback?: string;        // Opcional, ruta a la que retroceder si no hay historial previo
}
```

La alineación utilizará flexbox horizontal (`display: 'flex', justifyContent: 'space-between'`) garantizando que el título ocupe la izquierda y los iconos permanezcan aglutinados a la derecha con estados `hover` de baja opacidad.

1. **Navegación (Fallback):** El retroceso será evaluado con `window.history.length > 1 ? router.back() : router.push(backFallback || '/')`.
2. **Tema Visual:** Inyectará directamente `const { theme, toggleTheme } = useTheme()` importado de `@/components/ThemeProvider`.

---

### 2. Archivos implicados (Sustituciones)

Sustituiremos la lógica de título actual por `<PageHeader />` en las vistas troncales:

#### [MODIFY] [page.tsx (Dashboard)](file:///c:/Proyectos/MicroShop%20FFVV/webapp_snapshot/src/app/page.tsx)
Eliminaremos la inserción manual recién colocada de sol/luna y pasará a usar `<PageHeader showTheme={true} showBack={false} />`.

#### [MODIFY] pantallas principales
Las siguientes rutas cambiarán su título estático por `<PageHeader showTheme={true} showBack={true} />` o según aplique:
* `src/app/ffvv/page.tsx` (FFVV Hub)
* `src/app/admin/page.tsx` (Panel Administrativo)
* `src/app/seguimiento-ventas/page.tsx` (Jefe FFVV)
* `src/app/operaciones/page.tsx` (Ventas y Desgloses)
* `src/app/comisiones/page.tsx`
* `src/app/liquidacion/page.tsx` (Operaciones Telefónica / Liquidaciones)
* `src/app/ventas-ffvv/page.tsx`
* `src/app/back-office/page.tsx`

> [!NOTE]
> En casos especiales como `liquidacion/page.tsx`, donde los botones "Volver" se manejan estáticamente a través de un simple renderizado de estado (`setCurrentView`), el botón `Volver` interno permanecerá funcional *si pertenece a la capa secundaria de cartas*, pero la gran cabecera principal de la capa superior usará `PageHeader`.

## Open Questions
- ¿Existe algún color estricto que deba forzarse en los iconos `<-`  y `Sol/Luna` (como cyan/naranja) u optamos por grises variables puros al pasar el ratón para una estética minimalista "clean"?

## Verification Plan

### Manual Verification
1. Navegaremos a través del menú lateral para confirmar que todas las cabeceras se dibujan a la misma altura, formando una línea óptica consistente en la navegación.
2. Confirmaremos que pulsar en el botón oscuro/claro de cualquiera de estas páginas altera globalmente el contexto a través de `useTheme`, cambiando de inmediato el color del fondo y textos de la plataforma.
3. Se verificará que el historial de retroceso es fidedigno o cae de forma segura en una página principal de control.
