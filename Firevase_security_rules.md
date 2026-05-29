# Firebase Security Rules

Este proyecto ahora usa dos capas para produccion:

- **Firebase Auth + `Users/{uid}`** para autorizar el panel admin por rol.
- **Endpoints `/api/*` con Firebase Admin SDK** para crear pedidos, reservas e historial del bot sin exponer escritura publica directa en Firestore.

El archivo real de reglas esta en:

```text
firestore.rules
```

## Roles disponibles

```text
DEV
ADMIN
MOZO
COCINA
```

Permisos recomendados:

- `DEV`: acceso total.
- `ADMIN`: gestion operativa completa.
- `MOZO`: pedidos, reservas, mesas y clientes.
- `COCINA`: pedidos.

## Estructura requerida para usuarios

Cada usuario de Firebase Auth debe tener un documento con su UID real:

```text
Users/{firebaseAuthUid}
```

Ejemplo:

```json
{
  "id": "UID_REAL_DE_FIREBASE_AUTH",
  "name": "Nombre Apellido",
  "email": "admin@tudominio.com",
  "role": "ADMIN",
  "active": true,
  "createdAt": "2026-05-28T00:00:00.000Z",
  "lastAccess": null
}
```

## Reglas Firestore

Copia el contenido de `firestore.rules` en:

```text
Firebase Console > Firestore Database > Rules
```

Las reglas hacen lo siguiente:

- Permiten lectura publica solo para datos necesarios del sitio: productos, categorias, promociones, horarios, mesas y configuracion.
- Bloquean escritura publica directa en Firestore.
- Permiten escritura solo a usuarios autenticados con rol autorizado.
- Permiten que cada usuario autenticado lea su propio documento `Users/{uid}`.
- Bloquean por defecto cualquier coleccion no contemplada.

## Variables necesarias para los endpoints backend

Los endpoints `/api/orders`, `/api/reservations` y `/api/chat-history` usan Firebase Admin SDK.

En Vercel configura una de estas variables server-only:

```text
FIREBASE_SERVICE_ACCOUNT_BASE64
```

O, como alternativa:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
```

Tambien se acepta este alias:

```text
FIREBASE_SERVICE_ACCOUNT
```

La opcion recomendada es `FIREBASE_SERVICE_ACCOUNT_BASE64`, que debe contener el JSON completo de la service account codificado en base64.

En `.env.local`, evita pegar el JSON multilinea directamente. Usa base64 o pega el JSON completo escapado en una sola linea.

## Flujo de produccion

1. El cliente publico crea pedidos/reservas llamando a `/api/orders` o `/api/reservations`.
2. El backend valida el payload y escribe con Firebase Admin SDK.
3. El panel admin inicia sesion con Firebase Auth.
4. El frontend lee `Users/{uid}` para conocer `role` y `active`.
5. Firestore Rules permiten o bloquean operaciones segun rol.

## Nota

El nombre de este archivo conserva el typo solicitado: `Firevase_security_rules.md`. El archivo aplicable por Firebase es `firestore.rules`.
