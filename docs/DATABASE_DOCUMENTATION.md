# Documentación de la Base de Datos (Firebase Firestore)

Este documento detalla la estructura de la base de datos, las colecciones utilizadas, los modelos de datos (interfaces TypeScript) y las funciones principales para interactuar con ella.

## Visión General

La aplicación utiliza **Firebase Firestore** como base de datos NoSQL en tiempo real. La estructura se basa en **colecciones** que contienen **documentos**.

La configuración de Firebase se encuentra en `services/firebase.ts`.

## Colecciones

A continuación se describen las colecciones principales utilizadas en la aplicación.

### 1. Products (`Products`)
Almacena el menú de productos disponibles para ordenar.

**Interfaz TypeScript:**
```typescript
export interface Product {
  id: string;          // ID único (ej: PROD-1715...)
  category: string;    // Nombre de la categoría (ej: "Pizzas")
  name: string;        // Nombre del producto
  description?: string;// Descripción opcional
  price: string;       // Precio como string
  imageUrl?: string;   // URL de la imagen
}
```

**Detalles:**
- **ID**: Generado automáticamente con prefijo `PROD-`.
- **Uso**: Se utiliza para poblar el menú en el sitio y en el panel de administración.

### 2. Categories (`Categories`)
Almacena las categorías de productos (ej: Pizzas, Empanadas).

**Interfaz TypeScript:**
```typescript
export interface Category {
  id: string;       // ID único (ej: CAT-1715...)
  name: string;     // Nombre visible
  imageUrl?: string;// Imagen representativa
  color?: string;   // Color hexadecimal para UI
}
```

### 3. Orders (`Orders`)
Almacena los pedidos realizados por los clientes.

**Interfaz TypeScript:**
```typescript
export interface Order {
  id: string;               // ID único (ej: ORD-1715...)
  customer: {
    name: string;
    phone?: string;
    address?: string;
  };
  items: OrderItem[];       // Lista de items
  total: number;            // Total a pagar
  status: OrderStatus;      // Estado actual (PENDING, CONFIRMED, etc.)
  type: OrderType;          // PICKUP, DELIVERY, DINE_IN
  createdAt: string;        // Fecha ISO
  statusHistory: StatusHistory[]; // Historial de cambios de estado
  finishedAt: string | null;
  tableIds?: string[];      // IDs de mesas (si es DINE_IN)
  guests?: number;          // Cantidad de comensales
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  paymentProofUrl?: string | null;
  reservationId?: string;   // ID de reserva asociada (opcional)
  createdBy: CreatedBy;     // Origen del pedido
}
```

**Estados de Orden (`OrderStatus`):**
- `Pendiente`, `Confirmado`, `En Preparación`, `Listo para Retirar/Entregar`, `En Camino`, `En Mesa (Pendiente de Pago)`, `Completado (Retirado)`, `Completado (Entregado)`, `Completado (En Mesa)`, `Cancelado`.

### 4. Reservations (`Reservations`)
Almacena las reservas de mesas.

**Interfaz TypeScript:**
```typescript
export interface Reservation {
  id: string;               // ID único (ej: RES-1715...)
  customerName: string;
  customerPhone?: string;
  guests: number;           // Cantidad de personas
  reservationTime: string;  // Fecha y hora ISO
  tableIds: string[];       // Mesas asignadas
  status: ReservationStatus;// PENDING, CONFIRMED, etc.
  statusHistory: StatusHistory[];
  finishedAt: string | null;
  cancellationReason?: ReservationCancellationReason;
  notes?: string;
  createdAt: string;
  orderId?: string;         // ID de pedido asociado (opcional)
  createdBy: CreatedBy;
}
```

### 5. Tables (`Tables`)
Almacena la configuración física de las mesas.

**Interfaz TypeScript:**
```typescript
export interface Table {
  id: string;               // ID único (ej: T1, T2...)
  name: string;             // Nombre visible (ej: "Mesa 1")
  capacity: number;         // Capacidad de personas
  allowsReservations: boolean;
  overrideStatus: 'Bloqueada' | null; // Bloqueo manual
  currentSession?: {        // Sesión actual de la mesa
    orderId: string;        // ID del pedido activo
    accessCode: string;     // Código de acceso de 4 dígitos
    createdAt: string;      // Fecha de inicio de la sesión
  } | null;
}
```

### 6. Customers (`Customers`)
Directorio de clientes frecuentes.

**Interfaz TypeScript:**
```typescript
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  categoryId: string; // ID de categoría de cliente (VIP, Nuevo, etc.)
  createdAt: string;
}
```

### 7. Users (`Users`)
Usuarios con acceso al panel de administración.

**Interfaz TypeScript:**
```typescript
export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole; // ADMIN, EDITOR
    createdAt: string;
    lastAccess: string | null;
}
```

### 8. ReservationSettings (`ReservationSettings`)
Configuración global para el sistema de reservas.
*Nota: Esta colección contiene un único documento con ID `main`.*

**Interfaz TypeScript:**
```typescript
export interface ReservationSettings {
  duration: number;          // Duración estimada (minutos)
  minBookingTime: number;    // Tiempo mínimo antelación (minutos)
  initialBlockTime: number;  // Tiempo bloqueo inicial
  extensionBlockTime: number;// Tiempo extensión
  modificationLockTime: number;
  slotInterval: number;      // Intervalo de slots (minutos)
}
```

---

## Funciones de Servicio (Ejemplos)

Los archivos en `/services` encapsulan la lógica de interacción con Firebase. A continuación, ejemplos de cómo usar estas funciones.

### Obtener Datos (Lectura)

La mayoría de los servicios implementan un patrón de **cache-first**: intentan leer de Firebase, y si falla o está vacío, usan `localStorage`.

**Ejemplo: Obtener Productos**
```typescript
import { fetchAndCacheProducts, getProductsFromCache } from './services/productService';

// Opción 1: Asíncrona (desde Firebase)
const loadProducts = async () => {
  const products = await fetchAndCacheProducts();
  console.log(products);
};

// Opción 2: Síncrona (desde Cache local)
const products = getProductsFromCache();
```

### Agregar Datos (Escritura)

**Ejemplo: Crear un Pedido**
```typescript
import { saveOrder } from './services/orderService';
import { OrderType, PaymentMethod, CreatedBy } from './types';

const createNewOrder = async () => {
  const newOrderData = {
    customer: { name: "Juan Perez", phone: "123456789" },
    items: [{ name: "Muzzarella", quantity: 1, price: 9200, isPromotion: false, itemId: "..." }],
    total: 9200,
    type: OrderType.PICKUP,
    paymentMethod: PaymentMethod.CASH,
    createdBy: CreatedBy.ADMIN
  };

  try {
    const savedOrder = await saveOrder(newOrderData);
    console.log("Pedido creado con ID:", savedOrder.id);
  } catch (error) {
    console.error("Error al crear pedido:", error);
  }
};
```

### Actualizar Datos

**Ejemplo: Actualizar Estado de Pedido**
```typescript
import { updateOrderStatus } from './services/orderService';
import { OrderStatus } from './types';

const confirmOrder = async (orderId: string) => {
  try {
    await updateOrderStatus(orderId, OrderStatus.CONFIRMED);
    console.log("Pedido confirmado");
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### Eliminar Datos

**Ejemplo: Eliminar un Producto**
```typescript
import { deleteProduct } from './services/productService';

const removeProduct = async (productId: string) => {
  await deleteProduct(productId);
};
```

### Consultas Avanzadas (Queries)

Para consultas específicas que no están predefinidas en los servicios, se pueden usar las funciones de Firebase directamente importadas desde `services/firebase.ts`.

**Ejemplo: Buscar clientes por categoría**
```typescript
import { db, collection, query, where, getDocs } from './services/firebase';

const getVipCustomers = async () => {
  const q = query(collection(db, "Customers"), where("categoryId", "==", "vip-category-id"));
  const querySnapshot = await getDocs(q);
  const vips = querySnapshot.docs.map(doc => doc.data());
  return vips;
};
```

## Notas Importantes

1.  **IDs**: Los IDs se generan en el cliente (frontend) usando un patrón `PREFIX-TIMESTAMP-RANDOM` antes de enviarse a Firebase. Esto permite trabajar con el objeto completo antes de la confirmación del servidor.
2.  **Cache Local**: El sistema utiliza `localStorage` agresivamente para mantener una copia de los datos y reducir lecturas a Firebase, además de permitir funcionamiento offline parcial.
3.  **Fechas**: Todas las fechas se almacenan como cadenas ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`).
4.  **Límites de Pedido**: Se ha implementado una restricción en el frontend que limita la cantidad máxima de un mismo producto a 10 unidades por pedido para evitar errores o abusos.
