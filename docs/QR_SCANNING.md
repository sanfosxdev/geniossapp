# Documentación del Sistema de Escaneo QR para Mesas

Este documento detalla el funcionamiento técnico, la lógica y los flujos de interacción del sistema de códigos QR para la gestión de pedidos en mesas.

## 1. Resumen General

El sistema permite generar un código QR único para cada mesa registrada en el panel de administración. Cuando un cliente escanea este código, es redirigido a una vista específica de la aplicación (`TableOrderView`) donde puede realizar pedidos que se asocian automáticamente a esa mesa.

No se utilizan endpoints de backend dedicados para la *redirección* o el *escaneo*; todo el enrutamiento se maneja en el cliente (Frontend) mediante parámetros de consulta en la URL (Query Parameters).

## 2. Flujo de Funcionamiento

### A. Generación del QR (Panel de Administración)

1.  **Ubicación:** En el panel de "Mesas" (`TablesPanel.tsx`), cada tarjeta de mesa tiene un botón de acción secundaria (icono de QR).
2.  **Componente:** Al hacer clic, se abre el modal `QRCodeModal.tsx`.
3.  **Librería:** Se utiliza la librería `qrcode` para generar el gráfico en un elemento `<canvas>`.
4.  **Construcción de la URL:**
    El sistema utiliza una utilidad centralizada (`utils/url.ts`) para determinar la URL base correcta:
    ```typescript
    // utils/url.ts
    export const getAppUrl = (): string => {
      if (import.meta.env.VITE_APP_URL) {
        return import.meta.env.VITE_APP_URL;
      }
      if (typeof window !== 'undefined') {
        return window.location.origin;
      }
      return '';
    };
    ```
    Esto permite configurar una URL específica para producción (ej. Vercel) mediante la variable de entorno `VITE_APP_URL`, asegurando que los QR generados en entornos de desarrollo o staging apunten al sitio correcto si es necesario.

### B. Funcionalidades del Modal

El modal de QR ha sido optimizado para ofrecer múltiples opciones:
*   **Visualización:** Muestra el código QR generado en pantalla.
*   **Copiar Enlace:** Permite copiar la URL directa al portapapeles para compartirla por mensajería.
*   **Descargar:** Permite guardar el código QR como imagen PNG (`QR-Mesa-Nombre.png`).
*   **Imprimir:** Genera una vista de impresión limpia y estilizada con el nombre de la mesa y el código QR, lista para impresoras térmicas o convencionales.

### C. Detección y Enrutamiento (App.tsx)

1.  **Carga de la App:** Cuando el cliente accede a la URL escaneada, la aplicación (`App.tsx`) se monta.
2.  **Verificación de Parámetros:**
    Un `useEffect` verifica si existe el parámetro `tableId` en la URL:
    ```typescript
    const urlParams = new URLSearchParams(window.location.search);
    const tableIdFromUrl = urlParams.get('tableId');
    if (tableIdFromUrl) {
      setTableId(tableIdFromUrl);
    }
    ```
3.  **Renderizado Condicional:**
    Si el estado `tableId` tiene un valor, la aplicación renderiza exclusivamente la vista de pedidos para mesas, omitiendo el Landing Page y el Admin:
    ```typescript
    if (tableId) {
      return <TableOrderView tableId={tableId} />;
    }
    ```

### D. Vista del Cliente (TableOrderView.tsx)

1.  **Contexto:** El componente recibe el `tableId` como prop.
2.  **Flujo de Sesión y Código de Acceso:**
    *   **Mesa Libre:** Si la mesa no tiene una sesión activa (`currentSession` es nulo), se muestra una pantalla de bienvenida. Al iniciar el pedido, se genera un código de acceso de 4 dígitos aleatorio, se crea un nuevo pedido en estado `PENDING` y se actualiza la mesa con la nueva sesión. El código se muestra al cliente para que pueda compartirlo con otros comensales.
    *   **Mesa Ocupada (Mismo Dispositivo):** Si la mesa tiene una sesión activa y el ID del pedido coincide con el guardado en el `sessionStorage` del cliente, se le permite continuar editando el pedido actual.
    *   **Mesa Ocupada (Nuevo Dispositivo):** Si la mesa tiene una sesión activa pero el cliente no tiene el ID del pedido en su sesión, se le solicita que ingrese el código de acceso de 4 dígitos. Si el código es correcto, se le permite unirse al pedido existente. Si es incorrecto, se le deniega el acceso.
3.  **Interacción:**
    *   Muestra el menú disponible (productos y promociones).
    *   Permite al usuario seleccionar productos, ajustar cantidades (con un límite máximo de 10 por producto) y confirmar el pedido.
    *   Los cambios en el carrito se sincronizan en tiempo real con la base de datos para que todos los dispositivos en la misma sesión vean el mismo pedido.
4.  **Envío del Pedido:**
    Al confirmar, el pedido cambia su estado de `PENDING` a `CONFIRMED`, lo que notifica a la cocina/administración. La sesión de la mesa se mantiene activa hasta que el pedido sea pagado y finalizado por el administrador.

## 3. Endpoints y Servicios Relacionados

Aunque el escaneo es frontend, la vista resultante interactúa con los siguientes servicios:

*   **`tableService.ts`**:
    *   `getTableById(id)`: Para verificar que la mesa existe, obtener su nombre y su estado de sesión actual.
    *   `updateTableSession(tableId, session)`: Para iniciar o limpiar la sesión de una mesa.
*   **`orderService.ts`**:
    *   `saveOrder(order)`: Para guardar el pedido generado, incluyendo el campo `tableIds`.
    *   `updateOrder(order)`: Para sincronizar los cambios del carrito en tiempo real.

## 4. Detalles Técnicos

*   **Persistencia:** El `tableId` se mantiene en el estado de React mientras el usuario no recargue la página sin el parámetro. El ID del pedido activo se guarda en `sessionStorage` para mantener la sesión si el usuario recarga la página.
*   **Seguridad:** El sistema utiliza un código de acceso de 4 dígitos para proteger los pedidos en curso de accesos no autorizados por parte de personas que escaneen el QR de una mesa ya ocupada.
*   **Impresión:** El modal de QR incluye una funcionalidad de impresión que abre una ventana nueva con solo el QR y el nombre de la mesa, optimizado para impresoras térmicas o de etiquetas.
*   **Sincronización:** Los pedidos en curso (`PENDING`) se sincronizan constantemente con la base de datos para permitir la colaboración entre múltiples dispositivos en la misma mesa.

## 5. Guía de Uso para el Desarrollador

Para probar el flujo localmente:
1.  Abre el panel de administración y crea una mesa.
2.  Haz clic en el icono de QR de la mesa.
3.  Copia la URL que generaría el QR (o escanéalo con tu móvil si estás en la misma red).
4.  Abre esa URL en una nueva pestaña (Simulando el Cliente A).
5.  Inicia un pedido. Anota el código de acceso de 4 dígitos que aparece en la parte superior.
6.  Abre la misma URL en una ventana de incógnito o en otro navegador (Simulando el Cliente B).
7.  El sistema te pedirá el código de acceso. Ingrésalo.
8.  Ahora ambos clientes pueden agregar productos al mismo carrito de forma colaborativa.
