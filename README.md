# OlimpicBar — Sistema de Gestión de Bar/Restaurante

Sistema full-stack para la gestión integral de bares y restaurantes multi-sede. Permite a clientes ordenar desde sus mesas mediante códigos QR, y a los diferentes roles del staff (administrador, mesero, cajero) gestionar el flujo completo de una jornada.

---

## Tabla de Contenidos

1. [Tecnologías](#tecnologías)
2. [Arquitectura General](#arquitectura-general)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Roles del Sistema](#roles-del-sistema)
5. [Flujo Principal](#flujo-principal)
6. [Base de Datos](#base-de-datos)
7. [Algoritmos y Lógica Clave](#algoritmos-y-lógica-clave)
   - [Autenticación JWT + bcrypt](#1-autenticación-jwt--bcrypt)
   - [Control de Acceso por Roles (RBAC)](#2-control-de-acceso-por-roles-rbac)
   - [Máquina de Estados de Ítems](#3-máquina-de-estados-de-ítems)
   - [Backtracking para Códigos QR Únicos](#4-backtracking-para-códigos-qr-únicos)
   - [Algoritmo Voraz: Desglose de Cambio](#5-algoritmo-voraz-desglose-de-cambio)
   - [Programación Dinámica: Knapsack 0/1 para Re-stock](#6-programación-dinámica-knapsack-01-para-re-stock)
   - [QuickSort para Priorización de Mesas](#7-quicksort-para-priorización-de-mesas)
   - [Transacciones ACID en Cobros](#8-transacciones-acid-en-cobros)
   - [Agregación SQL con SUM(CASE WHEN)](#9-agregación-sql-con-sumcase-when)
   - [Paralelización con Promise.all](#10-paralelización-con-promiseall)
   - [Observer Pattern: WebSocket Broadcast](#11-observer-pattern-websocket-broadcast)
   - [Reconexión Automática WebSocket](#12-reconexión-automática-websocket)
   - [Inserción Atómica de Pedidos](#13-inserción-atómica-de-pedidos)
   - [Asignación Condicional de Rol en Mesa](#14-asignación-condicional-de-rol-en-mesa)
   - [Importación Masiva desde Excel (Two-mode Batch)](#15-importación-masiva-desde-excel-two-mode-batch)
   - [Generación de Reportes Excel/PDF](#16-generación-de-reportes-excelpdf)
8. [Seguridad](#seguridad)
9. [Instalación y Configuración](#instalación-y-configuración)

---

## Tecnologías

**Backend**
- Node.js + Express
- MySQL 8 con `mysql2/promise` (pool de conexiones)
- JWT (`jsonwebtoken`) + `bcryptjs` para autenticación
- WebSocket (`ws`) para actualizaciones en tiempo real
- `ExcelJS` + `PDFKit` para exportación de reportes
- `xlsx` + `multer` para importación de inventario
- `qrcode` para generación de QR

**Frontend**
- React 19 + Vite
- React Router v7
- Axios con interceptores
- TailwindCSS v4
- Context API para estado global

---

## Arquitectura General

```
Cliente (navegador)
    │
    ├── HTTP REST  ──────────► Express API (puerto 4000)
    │                              │
    └── WebSocket  ◄────────────── ws.Server (mismo puerto)
                                   │
                              MySQL (pool 10 conexiones)
```

El frontend se conecta al backend por dos canales simultáneos:
- **REST API** para todas las operaciones CRUD y de negocio.
- **WebSocket** para recibir actualizaciones en tiempo real (cambio de estado de mesas, nuevos pedidos) sin necesidad de polling.

---

## Estructura del Proyecto

```
basemod/
├── backend/
│   ├── src/
│   │   ├── app.js                   # Entrada, registro de rutas, arranque WS
│   │   ├── config/
│   │   │   └── db.js                # Pool MySQL + validación de conexión
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js          # JWT para staff + RBAC
│   │   │   └── clienteAuth.middleware.js  # JWT para clientes de mesa
│   │   ├── controllers/
│   │   │   ├── admin.controller.js        # Dashboard, reportes, usuarios
│   │   │   ├── auth.controller.js         # Login de staff
│   │   │   ├── cajero.controller.js       # Cobros, cierre de jornada, inventario
│   │   │   ├── catalogo.controller.js     # Catálogo para clientes (lectura)
│   │   │   ├── export.controller.js       # Exportación Excel y PDF
│   │   │   ├── mesas.controller.js        # Estado de mesas
│   │   │   ├── mesero.controller.js       # Gestión de ítems y mesas
│   │   │   ├── pedido.controller.js       # Creación de pedidos (clientes)
│   │   │   ├── productos.controller.js    # CRUD productos + importación Excel
│   │   │   ├── qr.controller.js           # Generación de QR únicos
│   │   │   └── sesion.controller.js       # Sesiones de mesa + registro de clientes
│   │   └── websocket.js                   # Servidor WS + broadcast
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                        # Router + rutas protegidas
│   │   ├── context/
│   │   │   └── AuthContext.jsx            # Contexto global de autenticación
│   │   ├── hooks/
│   │   │   └── useWebSocket.js            # Hook de conexión WS con reconexión
│   │   ├── services/
│   │   │   ├── api.js                     # Cliente Axios + interceptor JWT
│   │   │   ├── adminService.js
│   │   │   ├── cajeroService.js
│   │   │   ├── meseroService.js
│   │   │   ├── productosService.js
│   │   │   └── sesionService.js
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── CatalogoPage.jsx
│   │       ├── admin/
│   │       │   ├── AdminPage.jsx          # Dashboard ejecutivo (~1062 líneas)
│   │       │   ├── ProductosPage.jsx      # CRUD + importación masiva
│   │       │   └── QRPage.jsx             # Generación de QR por mesa
│   │       ├── cajero/
│   │       │   └── CajeroPage.jsx         # Cobros + inventario (~1060 líneas)
│   │       ├── mesero/
│   │       │   └── MeseroPage.jsx         # Vista de mesas e ítems
│   │       └── cliente/
│   │           ├── BienvenidaPage.jsx     # Entrada por QR
│   │           ├── MenuPage.jsx           # Menú interactivo + carrito
│   │           ├── UnirstePage.jsx        # Unirse con token de invitación
│   │           └── SesionTerminadaPage.jsx
└── olimpicbar.sql                         # Script DDL + datos iniciales
```

---

## Roles del Sistema

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| **Admin** | `/dashboard`, `/admin/productos`, `/admin/qr` | Reportes, usuarios, productos, QR |
| **Mesero** | `/mesero` | Ver mesas, avanzar estado de ítems |
| **Cajero** | `/cajero` | Cobros, cierre de jornada, inventario |
| **Cliente** | `/menu/:qr_codigo` | Menú y pedidos desde su mesa (JWT propio) |

---

## Flujo Principal

```
1. Admin genera QR para cada mesa  ──►  qr.controller.js
2. Cliente escanea QR              ──►  sesion.controller.js: iniciarSesion()
3. Cliente registra nombre         ──►  sesion.controller.js: registrarCliente()
4. Cliente navega menú y ordena    ──►  pedido.controller.js: crearPedido()
5. Mesero ve ítems pendientes      ──►  mesero.controller.js: cambiarEstadoItem()
   (Pendiente → Alistando → Entregado)
6. Cajero cobra (individual/grupal)──►  cajero.controller.js: procesarCobro()
7. Cajero cierra jornada           ──►  cajero.controller.js: cerrarJornada()
8. Admin consulta reportes / exporta ►  admin/export.controller.js
```

---

## Base de Datos

Esquema principal definido en `olimpicbar.sql`.

| Tabla | Propósito |
|-------|-----------|
| `usuario` | Staff con contraseña hasheada, rol y sede |
| `cliente` | Comensales anónimos con rol en mesa (Dueño/Acompañante) |
| `mesa` | Mesas físicas con estado y código QR |
| `sesion_mesa` | Apertura/cierre de una mesa (Activa/Cerrada) |
| `pedido` | Pedido agrupado por comensal y sesión |
| `detalle_pedido` | Ítem individual con estado de preparación |
| `producto` | Catálogo con precio, costo e imagen |
| `categoria` | Categorías de menú |
| `inventario` | Stock por producto y sede |
| `cuenta` | Resumen de consumo por cliente |
| `pago` | Registro de pago con método y modalidad |
| `cierre_jornada` | Snapshot del corte diario |

---

## Algoritmos y Lógica Clave

### 1. Autenticación JWT + bcrypt

**Archivos**: `backend/src/controllers/auth.controller.js`, `backend/src/controllers/admin.controller.js`

El sistema usa dos capas de seguridad para la autenticación de staff:

**Hashing de contraseña al crear usuario** (`admin.controller.js`, línea 137):
```javascript
const hash = await bcrypt.hash(password, 10);
```
`bcrypt` aplica el algoritmo PBKDF2 con un salt aleatorio y 2^10 = 1024 rondas de trabajo. El salt se embebe en el hash resultante (prefijo `$2a$10$`), por lo que no se almacena por separado. Esto garantiza que dos usuarios con la misma contraseña tengan hashes distintos.

**Verificación al login** (`auth.controller.js`, líneas 34 y 40–52):
```javascript
const match = await bcrypt.compare(password, usuario.contrasena);

const token = jwt.sign(
  { id_usuario, nombre, username, correo, rol, id_sede, sede_nombre },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES || '8h' }
);
```
Si las credenciales son válidas, se genera un JWT firmado con HMAC-SHA256. El token expira en 8 horas para staff y en 12 horas para clientes de mesa (`sesion.controller.js`, línea 143). El payload incluye el rol y la sede para evitar consultas adicionales a la base de datos en cada request.

---

### 2. Control de Acceso por Roles (RBAC)

**Archivo**: `backend/src/middleware/auth.middleware.js`

Dos middlewares encadenados protegen cada ruta:

```javascript
// Verifica firma y expiración del JWT (líneas 3–16)
const verificarToken = (req, res, next) => {
  const auth = req.headers['authorization'];
  const token = auth.slice(7); // Elimina "Bearer "
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  req.usuario = payload;
  next();
};

// Verifica que el rol esté autorizado para la ruta (líneas 18–22)
const verificarRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario.rol))
    return res.status(403).json({ error: 'Acceso denegado' });
  next();
};
```

`verificarRol` es una función de orden superior (curried): recibe la lista de roles permitidos y devuelve un middleware. Se usa así en las rutas:

```javascript
router.get('/dashboard', verificarToken, verificarRol('Admin'), getDashboard);
router.get('/mesas', verificarToken, verificarRol('Mesero', 'Admin'), getMesas);
```

En el frontend, `App.jsx` (líneas 14–19) replica la misma lógica para proteger rutas del SPA antes de que el request llegue al servidor.

---

### 3. Máquina de Estados de Ítems

**Archivo**: `backend/src/controllers/mesero.controller.js`, líneas 83–90

Cada ítem de un pedido pasa por tres estados en orden estricto: `Pendiente → Alistando → Entregado`. El controlador valida que la transición sea siempre un avance de exactamente un paso:

```javascript
const FLUJO = ['Pendiente', 'Alistando', 'Entregado'];
const idxActual = FLUJO.indexOf(estadoActual);
const idxNuevo  = FLUJO.indexOf(nuevoEstado);

if (idxNuevo !== idxActual + 1) {
  return res.status(400).json({ error: 'Transición de estado inválida' });
}
```

Esto impide saltar estados (p.ej. pasar de `Pendiente` directo a `Entregado`) o retroceder. Además, cuando un ítem llega a `Entregado`, se descuenta automáticamente del inventario (líneas 99–104):

```javascript
UPDATE inventario
SET stock_actual = stock_actual - ?
WHERE id_producto = ? AND id_sede = ?
```

El descuento ocurre en el momento de la entrega (no del pedido) para reflejar el consumo real.

---

### 4. Backtracking para Códigos QR Únicos

**Archivo**: `backend/src/controllers/qr.controller.js`, líneas 8–26

Los códigos QR siguen el formato `OB-SEDE-M##-XXXXXXXX` (ej. `OB-CHAP-M01-A1B2C3D4`). El sufijo de 8 caracteres se genera con UUID aleatorio y se verifica contra la base de datos. Si ya existe (colisión), la función se llama a sí misma con un nuevo UUID hasta un máximo de 10 intentos:

```javascript
const generarCodigoUnico = async (sedePrefix, numero, intentos = 0) => {
  if (intentos > 10) throw new Error('No se pudo generar un código único');

  const sufijo  = uuid().substring(0, 8).toUpperCase();
  const codigo  = `OB-${sedePrefix}-M${numero.toString().padStart(2, '0')}-${sufijo}`;

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) as total FROM mesa WHERE qr_codigo = ?', [codigo]
  );

  if (total > 0) return generarCodigoUnico(sedePrefix, numero, intentos + 1);
  return { codigo, intentos: intentos + 1 };
};
```

La probabilidad de colisión en un espacio de 36^8 ≈ 2.8 × 10^12 combinaciones es prácticamente nula, por lo que el límite de 10 intentos es solo una guardia de seguridad. Complejidad: O(1) en la práctica, O(10) en el peor caso.

---

### 5. Algoritmo Voraz: Desglose de Cambio

**Archivo**: `frontend/src/pages/cajero/CajeroPage.jsx`, líneas 26–39

Cuando el cajero ingresa el monto recibido del cliente, el sistema calcula automáticamente el cambio y lo desglosa en billetes y monedas colombianas usando un algoritmo voraz:

```javascript
function calcularCambio(montoPagado, totalCobro) {
  const denominaciones = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  let cambio = montoPagado - totalCobro;
  const resultado = [];

  for (const denom of denominaciones) {
    const cantidad = Math.floor(cambio / denom);
    if (cantidad > 0) {
      resultado.push({ denominacion: denom, cantidad });
      cambio -= cantidad * denom;
      cambio = Math.round(cambio); // Corrige errores de punto flotante
    }
  }
  return { cambio: montoPagado - totalCobro, desglose: resultado };
}
```

**Por qué funciona el algoritmo voraz aquí**: el sistema monetario colombiano tiene denominaciones con la propiedad de que siempre es óptimo tomar el billete/moneda más grande posible. El resultado se muestra al cajero como `2 × $50.000 + 1 × $10.000 + 1 × $1.000`.

Complejidad: O(9) — constante, una iteración por denominación.

---

### 6. Programación Dinámica: Knapsack 0/1 para Re-stock

**Archivo**: `frontend/src/pages/cajero/CajeroPage.jsx`, líneas 42–74

Cuando el inventario de algún producto baja del mínimo, el cajero puede pedir una sugerencia de re-stock óptima dado un presupuesto. El problema es un **Knapsack 0/1**: cada producto se compra o no (no hay fracciones), el "peso" es su costo y el "valor" es la criticidad del reabastecimiento.

```javascript
// Construye tabla DP: dp[i][w] = máximo valor usando los primeros i productos
//                                con presupuesto w (en miles)
const dp = Array(n + 1).fill(null).map(() => Array(W + 1).fill(0));

for (let i = 1; i <= n; i++) {
  const peso = Math.floor(items[i - 1].costo / 1000);
  const val  = items[i - 1].valor;

  for (let w = 0; w <= W; w++) {
    dp[i][w] = dp[i - 1][w]; // Opción A: no incluir el producto i
    if (peso <= w)
      dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - peso] + val); // Opción B: incluirlo
  }
}

// Backtrack para identificar qué productos se seleccionaron
const seleccionados = [];
let w = W;
for (let i = n; i > 0; i--) {
  if (dp[i][w] !== dp[i - 1][w]) {
    seleccionados.push(items[i - 1]);
    w -= Math.floor(items[i - 1].costo / 1000);
  }
}
```

La tabla DP se llena en O(n × W) donde W = presupuesto / 1000. La fase de backtrack recorre la tabla de abajo hacia arriba para reconstruir la selección óptima sin almacenar rutas adicionales.

---

### 7. QuickSort para Priorización de Mesas

**Archivos**: `frontend/src/pages/cajero/CajeroPage.jsx` y `frontend/src/pages/mesero/MeseroPage.jsx`, líneas 252–263

Las mesas se ordenan según urgencia para que el staff atienda primero las más críticas. La prioridad se calcula como `ítems_pendientes × 10 + total_comensales`:

```javascript
function quickSortMesas(arr) {
  if (arr.length <= 1) return arr;
  const pivot    = arr[Math.floor(arr.length / 2)];
  const prioridad = (mesa) => {
    if (mesa.estado !== 'Ocupada') return -1; // Mesas libres al final
    return mesa.items_pendientes * 10 + mesa.total_comensales;
  };

  const izquierda = arr.filter(m => prioridad(m) > prioridad(pivot));
  const centro    = arr.filter(m => prioridad(m) === prioridad(pivot));
  const derecha   = arr.filter(m => prioridad(m) < prioridad(pivot));
  return [...quickSortMesas(izquierda), ...centro, ...quickSortMesas(derecha)];
}
```

El multiplicador ×10 para ítems pendientes hace que una mesa con 1 ítem pendiente y 3 comensales (score: 13) supere a una con 0 ítems y 9 comensales (score: 9). Complejidad: O(n log n) promedio.

---

### 8. Transacciones ACID en Cobros

**Archivo**: `backend/src/controllers/cajero.controller.js`, líneas 93–190

El cobro de una mesa implica múltiples operaciones que deben ser atómicas: crear o actualizar la cuenta, registrar el pago, y marcar los ítems como cobrados. Si cualquier paso falla, todo se revierte:

```javascript
const conn = await pool.getConnection();
await conn.beginTransaction();
try {
  // 1. Verifica que no esté ya cobrado (prevención de duplicados)
  // 2. Para cada cliente: busca/crea cuenta → UPDATE o INSERT
  // 3. INSERT en tabla pago con método y modalidad
  total_cobrado += monto;
  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

La verificación de cobro duplicado (líneas 98–125) usa `COUNT(*)` para detectar si ya existe una cuenta cobrada para ese cliente en esa sesión, bloqueando el reintento antes de abrir la transacción.

---

### 9. Agregación SQL con SUM(CASE WHEN)

**Archivos**: `backend/src/controllers/admin.controller.js` (líneas 8–23), `backend/src/controllers/cajero.controller.js` (líneas 290–326)

En lugar de múltiples queries separadas, el dashboard obtiene todas las métricas de una sede en una sola pasada por la base de datos usando agregaciones condicionales:

```sql
SELECT
  COUNT(DISTINCT CASE WHEN m.estado = 'Ocupada' THEN m.id_mesa END) AS mesas_ocupadas,
  COUNT(DISTINCT s.id_sesion)                                        AS sesiones_activas,
  SUM(CASE WHEN dp.estado = 'Entregado' THEN dp.precio_unitario * dp.cantidad
           ELSE 0 END)                                               AS ventas_del_dia,
  SUM(CASE WHEN dp.estado = 'Pendiente' THEN 1 ELSE 0 END)          AS items_pendientes
FROM mesa m
LEFT JOIN sesion_mesa s ON s.id_mesa = m.id_mesa AND s.estado = 'Activa'
LEFT JOIN pedido p      ON p.id_sesion = s.id_sesion
LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
WHERE m.id_sede = ?
GROUP BY m.id_sede
```

El `SUM(CASE WHEN...)` evalúa la condición fila por fila y acumula solo cuando se cumple, equivalente a un `filter().reduce()` pero ejecutado directamente en el motor SQL.

---

### 10. Paralelización con Promise.all

**Archivos**: `backend/src/controllers/admin.controller.js` (línea 81), `backend/src/controllers/export.controller.js` (línea 138)

Cuando se generan reportes que requieren datos de múltiples tablas independientes entre sí, las queries se ejecutan en paralelo en lugar de secuencialmente:

```javascript
// export.controller.js — 5 queries simultáneas
const [resumen, topProductos, cobrosPorMetodo, detalleMesas, ventasCategoria] =
  await Promise.all([
    pool.query(queryResumen,        params),
    pool.query(queryTopProductos,   params),
    pool.query(queryCobrosPorMetodo,params),
    pool.query(queryDetalleMesas,   params),
    pool.query(queryVentasCategoria,params),
  ]);
```

Si cada query tarda 100ms, la ejecución secuencial tomaría 500ms; con `Promise.all` toma ~100ms (el tiempo de la más lenta). El motor MySQL puede procesar las consultas en paralelo en conexiones distintas del pool.

---

### 11. Observer Pattern: WebSocket Broadcast

**Archivo**: `backend/src/websocket.js`

El servidor mantiene el conjunto de todos los clientes conectados y, cuando ocurre un evento (mesa ocupada, ítem cambiado), notifica a todos simultáneamente:

```javascript
const broadcast = (data) => {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN)
      client.send(msg);
  });
};
```

Los controladores invocan `broadcast({ tipo: 'ACTUALIZAR_MESAS', id_sede })` después de cualquier cambio de estado. El frontend filtra por `id_sede` para ignorar eventos de otras sedes.

---

### 12. Reconexión Automática WebSocket

**Archivo**: `frontend/src/hooks/useWebSocket.js`

El hook maneja automáticamente las desconexiones (pérdida de red, reinicio del servidor) intentando reconectar cada 3 segundos:

```javascript
const connect = () => {
  const ws = new WebSocket(`ws://${window.location.hostname}:4000`);

  ws.onmessage = (e) => {
    try { onMessageRef.current(JSON.parse(e.data)); } catch {}
  };

  ws.onclose = () => {
    if (!unmountedRef.current) {
      timeoutRef.current = setTimeout(connect, 3000); // Reintenta en 3s
    }
  };
};
```

`unmountedRef` previene que el timeout dispare una reconexión si el componente ya fue desmontado (memory leak). `onMessageRef` permite actualizar el callback de mensajes sin recrear la conexión WebSocket.

---

### 13. Inserción Atómica de Pedidos

**Archivo**: `backend/src/controllers/pedido.controller.js`, líneas 4–57

Un pedido puede tener múltiples ítems. Para garantizar que o se insertan todos o ninguno, se usa una transacción. Los precios se consultan desde la base de datos (no se confía en los que envía el cliente) para evitar manipulación:

```javascript
// Obtiene precios reales desde BD usando el operador IN
const ids = items.map(i => i.id_producto);
const [productos] = await conn.query(
  `SELECT id_producto, precio_venta FROM producto
   WHERE id_producto IN (${ids.map(() => '?').join(',')})`,
  ids
);
const precioMap = Object.fromEntries(
  productos.map(p => [p.id_producto, p.precio_venta])
);

// INSERT del pedido, luego INSERT de cada detalle en la misma transacción
await conn.beginTransaction();
const [{ insertId }] = await conn.query('INSERT INTO pedido ...', [...]);
for (const item of items) {
  await conn.query('INSERT INTO detalle_pedido ...', [
    insertId, item.id_producto, item.cantidad, precioMap[item.id_producto]
  ]);
}
await conn.commit();
```

---

### 14. Asignación Condicional de Rol en Mesa

**Archivo**: `backend/src/controllers/sesion.controller.js`, líneas 112–122

El primer cliente que se registra en una mesa obtiene el rol `Dueno` (puede generar enlaces de invitación). Los siguientes son `Acompanante`. La asignación se basa en el COUNT actual de clientes en la sesión:

```javascript
const [[{ total }]] = await conn.query(
  'SELECT COUNT(*) as total FROM cliente WHERE id_sesion = ?',
  [id_sesion]
);
const rol_mesa = total === 0 ? 'Dueno' : 'Acompanante';
```

Se impone un límite máximo de 10 comensales por mesa verificado con la misma query. El sistema también soporta unirse mediante un token de invitación de 8 caracteres generado con `Math.random().toString(36)` (línea 173), que se invalida tras un solo uso (`token_usado = 1`).

---

### 15. Importación Masiva desde Excel (Two-mode Batch)

**Archivo**: `backend/src/controllers/productos.controller.js`, líneas 198–325

El administrador puede actualizar el inventario cargando un archivo `.xlsx`. Cada fila puede operar en dos modos: **reemplazar** el stock actual o **sumar** al existente:

```javascript
// Lectura del archivo en memoria (sin guardar en disco)
const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Validación por fila: tipo, rango, campos requeridos
// Búsqueda de producto por nombre (case-insensitive)
const [[prod]] = await conn.query(
  'SELECT id_producto FROM producto WHERE LOWER(TRIM(nombre)) = LOWER(?)',
  [nombre]
);

// Aplicación del modo correspondiente
if (op.modo === 'sumar') {
  await conn.query(
    'UPDATE inventario SET stock_actual = stock_actual + ? WHERE ...',
    [op.cantidad, ...]
  );
} else { // reemplazar
  await conn.query(
    'UPDATE inventario SET stock_actual = ? WHERE ...',
    [op.cantidad, ...]
  );
}
```

Los errores de validación por fila (tipo incorrecto, valor fuera de rango, producto no encontrado) se acumulan y se devuelven todos juntos para que el usuario corrija el archivo de una sola vez.

---

### 16. Generación de Reportes Excel/PDF

**Archivo**: `backend/src/controllers/export.controller.js`, líneas 150–594

Los reportes se generan en memoria y se envían como stream, sin archivos temporales en disco.

**Excel** (ExcelJS): Se construyen hojas con formato visual completo — celdas fusionadas, filtros automáticos, encabezado congelado, alternancia de color de filas y formato de moneda:

```javascript
// Alternancia de color de filas (stripe pattern, líneas 291–295)
const bg = idx % 2 === 0 ? 'white' : '#F5F5F5';
cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg.replace('#','FF') } };

// Cálculo de porcentaje en hoja de Top Productos (líneas 331–343)
const pct = total > 0 ? (row.total_vendido / total) : 0;
cell.numFmt = '0.00%';
```

**PDF** (PDFKit): Se dibuja con posicionamiento absoluto de coordenadas (X, Y), equivalente a un canvas:

```javascript
// Rectángulo de encabezado
doc.rect(0, 0, 595, 80).fill(DARK);
// Línea decorativa
doc.moveTo(50, 90).lineTo(545, 90).stroke();
// Tarjeta de métrica con color según valor
doc.rect(x, y, cardW, cardH).fillAndStroke(cardColor, BORDER);
```

---

## Seguridad

| Medida | Implementación | Ubicación |
|--------|---------------|-----------|
| Hashing de contraseñas | bcryptjs, cost factor 10, salt aleatorio | `admin.controller.js:137`, `auth.controller.js:34` |
| Tokens con expiración | JWT 8h (staff) / 12h (clientes) | `auth.controller.js:51`, `sesion.controller.js:143` |
| Separación de tokens | Header `Authorization` (staff) vs `x-cliente-token` (clientes) | `auth.middleware.js:4`, `clienteAuth.middleware.js:4` |
| Control de roles | Middleware `verificarRol()` en cada ruta | `auth.middleware.js:18` |
| Consultas parametrizadas | Solo placeholders `?`, nunca concatenación de strings | Todos los controladores |
| Transacciones ACID | `beginTransaction / commit / rollback` | `cajero.controller.js:93` |
| Validación de precios | El backend ignora precios del cliente y consulta la BD | `pedido.controller.js:21` |
| Tokens de invitación de un solo uso | `token_usado = 1` tras primer uso | `sesion.controller.js:101` |
| Límite de comensales | Máximo 10 por mesa validado en servidor | `sesion.controller.js:112` |

---

## Instalación y Configuración

### Requisitos
- Node.js 18+
- MySQL 8+

### Base de Datos
```bash
mysql -u root -p < olimpicbar.sql
```

### Backend
```bash
cd backend
npm install
```

Crear `backend/.env`:
```
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASS=tu_contraseña
DB_NAME=olimpicbar
JWT_SECRET=cambia_esto_por_un_secreto_seguro
JWT_EXPIRES=8h
FRONTEND_URL=http://localhost:5173
```

```bash
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Actualizar la `baseURL` en `frontend/src/services/api.js` con la IP del servidor backend.
