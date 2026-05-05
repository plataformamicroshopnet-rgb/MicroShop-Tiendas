# Ajuste Fino de Layout en Cabeceras Premium

Este plan detalla las modificaciones exactas solicitadas para perfeccionar la ergonomía visual del componente `PageHeader`, recolocando los controles de navegación y limpieza de elementos redundantes según el criterio de diseño de la aplicación.

## User Review Required

> [!IMPORTANT]
> Se solicita confirmación explícita para aplicar estos pequeños ajustes estructurales. El impacto es puramente visual y decorativo, mejorando la UX de la navegación. Este cambio alterará las mismas pantallas que se modificaron previamente.

## Proposed Changes

### 1. Reestructuración de `PageHeader.tsx`
#### [MODIFY] [PageHeader.tsx](file:///c:/Proyectos/MicroShop%20FFVV/webapp_snapshot/src/components/PageHeader.tsx)

Se modificará el DOM interno del componente para cumplir el diseño dictado:
- El botón de `Volver` (`<ArrowLeft />`) se extirpará del contenedor derecho (alineado a la derecha) y se reubicará **a la izquierda** del contenedor del `Título/h1`.
- El Título y el Botón de Volver estarán aglutinados juntos mediante Flexbox (`gap: 16px`).
- El botón del **Modo Día/Noche** será el **ÚNICO** elemento que quedará flotando a la extrema derecha (alineado con `justify-content: space-between`).

### 2. Retirada de Toggles Redundantes
Se actuará en todos los archivos que ahora poseen `showTheme={true}` erróneamente, pasando flag a eliminar esa propiedad (por defo es falsa) para que **solo el Dashboard** ostente el botón luminoso.

**Archivos a corregir eliminando `showTheme`:**
1. `ffvv/page.tsx`
2. `seguimiento-ventas/page.tsx`
3. `seguimiento-ventas/productos/page.tsx`
4. `back-office/page.tsx`
5. `comisiones/page.tsx`
6. `operaciones/page.tsx`
7. `liquidacion/page.tsx`
8. `ventas-ffvv/page.tsx`
9. `admin/page.tsx`

*Excepción: `src/app/page.tsx` (Dashboard) conservará `showTheme={true}`.*

## Nivel de Riesgo
**Prácticamente Nulo (2%).**
Es un simple ajuste CSS de Flexbox interno en un componente central único y la eliminación de una property boolean (`showTheme`) en las llamadas al componente. No interactúa ni perturba renderizados de nivel inferior, accesos a Prisma ni lógica algorítmica.

## Verification Plan

### Manual Verification
1. Abrir la URL local del proyecto.
2. Confirmar que Dashboard muestra Título y Botón Sol/Luna a la derecha (sin botón Volver).
3. Navegar a Comisiones y verificar que se ve el icono `←` alineado limpiamente junto y a la izquierda de la Copa Trofeo.
4. Confirmar que el botón Sol/Luna brilla por su ausencia en esta última pantalla.
