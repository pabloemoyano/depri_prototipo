# Instrucciones y Reglas de Desarrollo para el Proyecto

## Regla de Oro sobre Logotipos
- **NUNCA generes logotipos nuevos ni crees diseños de logotipos ficticios o basados en imágenes abstractas.**
- Siempre debes reutilizar el logotipo de la marca cargado por el usuario (`localStorage("barstock_app_custom_logo")`) o en su defecto la imagen del logotipo oficial del repositorio (`src/assets/images/deprimera_logo_1780923105846.png`).
- Si en alguna situación necesitas un logotipo diferente o alternativo y no está definido, pídeselo de forma expresa al usuario en lugar de intentar crearlo de manera automática.

## Reglas de Control de Impresión
- **No uses `zoom` ni `transform: scale()` para forzar dimensiones de página** en el CSS de impresión.
- Prioriza redefinir selectores específicos para impresiones limpias (desactivando `overflow` restrictivos, cambiando posicionamientos `fixed`/`absolute`/`sticky` a `static` o `block`, anulando márgenes y paddings globales a favor de estilos limpios).
- Utiliza la técnica de ventana temporal (`window.open`) cargando solo la sección `#print-section` si el aislamiento por CSS nativo de impresión en la página principal se ve comprometido.
