-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 12-05-2026 a las 00:46:31
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `olimpicbar`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `alerta`
--

CREATE TABLE `alerta` (
  `id_alerta` int(11) NOT NULL,
  `tipo` enum('Stock Bajo','Stock Critico','Sin Stock','Sistema') NOT NULL,
  `mensaje` varchar(300) NOT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `id_sede` int(11) NOT NULL,
  `id_inventario` int(11) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Alertas de stock crítico y eventos del sistema por sede';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categoria`
--

CREATE TABLE `categoria` (
  `id_categoria` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Categorías del menú (Platos fuertes, Bebidas, Postres, etc.)';

--
-- Volcado de datos para la tabla `categoria`
--

INSERT INTO `categoria` (`id_categoria`, `nombre`) VALUES
(1, 'Cocteles'),
(2, 'Cervezas'),
(3, 'Vinos'),
(4, 'Licores'),
(5, 'Comidas'),
(6, 'Sin Alcohol');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cierre_jornada`
--

CREATE TABLE `cierre_jornada` (
  `id_cierre` int(11) NOT NULL,
  `fecha_inicio` datetime NOT NULL,
  `fecha_cierre` datetime NOT NULL DEFAULT current_timestamp(),
  `total_ventas` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_mesas` int(11) NOT NULL DEFAULT 0,
  `total_items` int(11) NOT NULL DEFAULT 0,
  `total_cancelaciones` int(11) NOT NULL DEFAULT 0,
  `cobros_individuales` int(11) NOT NULL DEFAULT 0,
  `cobros_grupales` int(11) NOT NULL DEFAULT 0,
  `ticket_promedio` decimal(12,2) NOT NULL DEFAULT 0.00,
  `id_sede` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Resumen de ventas por turno, ejecutado por el cajero al cerrar jornada';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cliente`
--

CREATE TABLE `cliente` (
  `id_cliente` int(11) NOT NULL,
  `nombre_visible` varchar(30) NOT NULL,
  `rol_mesa` enum('Dueno','Acompanante') NOT NULL DEFAULT 'Acompanante',
  `token_sesion` varchar(8) DEFAULT NULL,
  `token_usado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_union` datetime NOT NULL DEFAULT current_timestamp(),
  `id_sesion` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Comensales anónimos que se unen a la sesión de una mesa';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cuenta`
--

CREATE TABLE `cuenta` (
  `id_cuenta` int(11) NOT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `estado` enum('Abierta','Cobrada') NOT NULL DEFAULT 'Abierta',
  `fecha_cierre` datetime DEFAULT NULL,
  `id_sesion` int(11) NOT NULL,
  `id_cliente` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Resumen de consumo individual de cada comensal en una sesión';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_pedido`
--

CREATE TABLE `detalle_pedido` (
  `id_detalle` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unitario` decimal(12,2) NOT NULL,
  `estado` enum('Pendiente','Alistando','Entregado','Cancelado') NOT NULL DEFAULT 'Pendiente',
  `fecha_estado` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `id_pedido` int(11) NOT NULL,
  `id_producto` int(11) NOT NULL,
  `id_usuario` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ítem individual de un pedido con estado Pendiente→Alistando→Entregado';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `importacion_inventario`
--

CREATE TABLE `importacion_inventario` (
  `id_importacion` int(11) NOT NULL,
  `nombre_archivo` varchar(200) NOT NULL,
  `productos_nuevos` int(11) NOT NULL DEFAULT 0,
  `productos_actualizados` int(11) NOT NULL DEFAULT 0,
  `errores` int(11) NOT NULL DEFAULT 0,
  `estado` enum('Exitosa','Fallida','Parcial') NOT NULL,
  `detalle_errores` text DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `id_sede` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historial de importaciones masivas de inventario por archivo Excel';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `inventario`
--

CREATE TABLE `inventario` (
  `id_inventario` int(11) NOT NULL,
  `stock_actual` int(11) NOT NULL DEFAULT 0,
  `stock_minimo` int(11) NOT NULL DEFAULT 0,
  `stock_maximo` int(11) NOT NULL DEFAULT 999,
  `id_producto` int(11) NOT NULL,
  `id_sede` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stock de cada producto por sede, con umbrales de alerta';

--
-- Volcado de datos para la tabla `inventario`
--

INSERT INTO `inventario` (`id_inventario`, `stock_actual`, `stock_minimo`, `stock_maximo`, `id_producto`, `id_sede`) VALUES
(1, 30, 5, 100, 1, 1),
(2, 30, 5, 100, 2, 1),
(3, 30, 5, 100, 3, 1),
(4, 30, 5, 100, 4, 1),
(5, 30, 5, 100, 5, 1),
(6, 30, 5, 100, 6, 1),
(7, 30, 5, 100, 7, 1),
(8, 30, 5, 100, 8, 1),
(9, 30, 5, 100, 9, 1),
(10, 30, 5, 100, 10, 1),
(11, 30, 5, 100, 11, 1),
(12, 30, 5, 100, 12, 1),
(13, 30, 5, 100, 13, 1),
(14, 30, 5, 100, 14, 1),
(15, 30, 5, 100, 15, 1),
(16, 30, 5, 100, 16, 1),
(17, 30, 5, 100, 17, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `log_acceso`
--

CREATE TABLE `log_acceso` (
  `id_log` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `exitoso` tinyint(1) NOT NULL,
  `ip_origen` varchar(45) DEFAULT NULL,
  `detalle` varchar(200) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `id_usuario` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de intentos de acceso al sistema, exitosos y fallidos';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `log_auditoria`
--

CREATE TABLE `log_auditoria` (
  `id_log` int(11) NOT NULL,
  `accion` varchar(100) NOT NULL,
  `entidad` varchar(50) NOT NULL,
  `id_entidad` int(11) DEFAULT NULL,
  `detalle` text DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `id_usuario` int(11) DEFAULT NULL,
  `id_sede` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de auditoría de acciones críticas del sistema';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `log_inventario`
--

CREATE TABLE `log_inventario` (
  `id_log` int(11) NOT NULL,
  `tipo_movimiento` enum('Salida','Entrada','Ajuste') NOT NULL,
  `cantidad` int(11) NOT NULL,
  `stock_anterior` int(11) NOT NULL,
  `stock_resultante` int(11) NOT NULL,
  `referencia` varchar(100) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `id_inventario` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de cada entrada o salida de stock con responsable';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `mesa`
--

CREATE TABLE `mesa` (
  `id_mesa` int(11) NOT NULL,
  `numero` int(11) NOT NULL,
  `qr_codigo` varchar(200) DEFAULT NULL,
  `qr_activo` tinyint(1) NOT NULL DEFAULT 0,
  `estado` enum('Libre','Ocupada','Pedido Pendiente','Por Pagar') NOT NULL DEFAULT 'Libre',
  `id_sede` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mesas físicas de cada sede con su QR asociado';

--
-- Volcado de datos para la tabla `mesa`
--

INSERT INTO `mesa` (`id_mesa`, `numero`, `qr_codigo`, `qr_activo`, `estado`, `id_sede`) VALUES
(1, 1, NULL, 0, 'Libre', 1),
(2, 2, NULL, 0, 'Libre', 1),
(3, 3, NULL, 0, 'Libre', 1),
(4, 4, NULL, 0, 'Libre', 1),
(5, 5, NULL, 0, 'Libre', 1),
(6, 6, NULL, 0, 'Libre', 1),
(7, 7, NULL, 0, 'Libre', 1),
(8, 8, NULL, 0, 'Libre', 1),
(9, 9, NULL, 0, 'Libre', 1),
(10, 10, NULL, 0, 'Libre', 1),
(11, 11, NULL, 0, 'Libre', 1),
(12, 12, NULL, 0, 'Libre', 1),
(13, 13, NULL, 0, 'Libre', 1),
(14, 14, NULL, 0, 'Libre', 1),
(15, 15, NULL, 0, 'Libre', 1),
(16, 16, NULL, 0, 'Libre', 1),
(17, 17, NULL, 0, 'Libre', 1),
(18, 18, NULL, 0, 'Libre', 1),
(19, 19, NULL, 0, 'Libre', 1),
(20, 20, NULL, 0, 'Libre', 1),
(26, 6, NULL, 0, 'Libre', 2),
(27, 7, NULL, 0, 'Libre', 2),
(28, 8, NULL, 0, 'Libre', 2),
(29, 9, NULL, 0, 'Libre', 2),
(30, 10, NULL, 0, 'Libre', 2),
(31, 11, NULL, 0, 'Libre', 2),
(32, 12, NULL, 0, 'Libre', 2),
(33, 13, NULL, 0, 'Libre', 2),
(34, 14, NULL, 0, 'Libre', 2),
(35, 15, NULL, 0, 'Libre', 2),
(36, 16, NULL, 0, 'Libre', 2),
(37, 17, NULL, 0, 'Libre', 2),
(38, 18, NULL, 0, 'Libre', 2),
(39, 19, NULL, 0, 'Libre', 2),
(40, 20, NULL, 0, 'Libre', 2),
(41, 1, NULL, 0, 'Libre', 3),
(42, 2, NULL, 0, 'Libre', 3),
(43, 3, NULL, 0, 'Libre', 3),
(44, 4, NULL, 0, 'Libre', 3),
(45, 5, NULL, 0, 'Libre', 3),
(46, 6, NULL, 0, 'Libre', 3),
(47, 7, NULL, 0, 'Libre', 3),
(48, 8, NULL, 0, 'Libre', 3),
(49, 9, NULL, 0, 'Libre', 3),
(50, 10, NULL, 0, 'Libre', 3),
(51, 11, NULL, 0, 'Libre', 3),
(52, 12, NULL, 0, 'Libre', 3),
(53, 13, NULL, 0, 'Libre', 3),
(54, 14, NULL, 0, 'Libre', 3),
(55, 15, NULL, 0, 'Libre', 3),
(56, 16, NULL, 0, 'Libre', 3),
(57, 17, NULL, 0, 'Libre', 3),
(58, 18, NULL, 0, 'Libre', 3),
(59, 19, NULL, 0, 'Libre', 3),
(60, 20, NULL, 0, 'Libre', 3);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pago`
--

CREATE TABLE `pago` (
  `id_pago` int(11) NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `metodo` enum('Efectivo','Tarjeta','Transferencia','Otro') NOT NULL,
  `modalidad` enum('Individual','Grupal') NOT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `id_cuenta` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Transacción de cobro procesada por el cajero';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedido`
--

CREATE TABLE `pedido` (
  `id_pedido` int(11) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `estado` enum('Activo','Cancelado','Completado') NOT NULL DEFAULT 'Activo',
  `notas` varchar(300) DEFAULT NULL,
  `id_sesion` int(11) NOT NULL,
  `id_cliente` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Pedido realizado por un comensal dentro de una sesión de mesa';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `producto`
--

CREATE TABLE `producto` (
  `id_producto` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(300) DEFAULT NULL,
  `precio_venta` decimal(12,2) NOT NULL,
  `costo` decimal(12,2) NOT NULL DEFAULT 0.00,
  `imagen_url` varchar(500) DEFAULT NULL,
  `visible` tinyint(1) NOT NULL DEFAULT 1,
  `id_categoria` int(11) NOT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Productos del menú con precio, costo e imagen';

--
-- Volcado de datos para la tabla `producto`
--

INSERT INTO `producto` (`id_producto`, `nombre`, `descripcion`, `precio_venta`, `costo`, `imagen_url`, `visible`, `id_categoria`, `fecha_creacion`, `fecha_actualizacion`) VALUES
(1, 'Mojito Clásico', 'Ron, menta, limón y soda', 18000.00, 7000.00, NULL, 1, 1, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(2, 'Piña Colada', 'Ron, piña y coco', 20000.00, 8000.00, NULL, 1, 1, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(3, 'Margarita', 'Tequila, triple sec y limón', 19000.00, 7500.00, NULL, 1, 1, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(4, 'Negroni', 'Gin, vermut y campari', 22000.00, 9000.00, NULL, 1, 1, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(5, 'Cerveza Artesanal IPA', 'Cerveza artesanal amarga', 12000.00, 5000.00, NULL, 1, 2, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(6, 'Cerveza Lager Nacional', 'Cerveza rubia suave', 8000.00, 3000.00, NULL, 1, 2, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(7, 'Cerveza Negra Stout', 'Cerveza oscura tostada', 13000.00, 5500.00, NULL, 1, 2, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(8, 'Vino Tinto Copa', 'Vino tinto de la casa', 15000.00, 6000.00, NULL, 1, 3, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(9, 'Vino Blanco Copa', 'Vino blanco seco', 14000.00, 5500.00, NULL, 1, 3, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(10, 'Ron Añejo Shot', 'Ron añejo premium', 9000.00, 3500.00, NULL, 1, 4, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(11, 'Whisky Shot', 'Whisky escocés', 11000.00, 4500.00, NULL, 1, 4, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(12, 'Tabla de Quesos', 'Selección de quesos y frutos secos', 25000.00, 10000.00, NULL, 1, 5, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(13, 'Nachos con Guacamole', 'Nachos con guacamole y pico de gallo', 18000.00, 7000.00, NULL, 1, 5, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(14, 'Alitas BBQ x6', 'Alitas en salsa BBQ', 22000.00, 9000.00, NULL, 1, 5, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(15, 'Agua Mineral', 'Agua mineral 500ml', 4000.00, 1200.00, NULL, 1, 6, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(16, 'Jugo Natural', 'Jugo natural del día', 7000.00, 2500.00, NULL, 1, 6, '2026-04-18 00:06:23', '2026-04-18 00:06:23'),
(17, 'Limonada Cerezada', 'Limonada con cereza', 9000.00, 3000.00, NULL, 1, 6, '2026-04-18 00:06:23', '2026-04-18 00:06:23');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `reporte_ventas`
--

CREATE TABLE `reporte_ventas` (
  `id_reporte` int(11) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `total_ingresos` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_mesas` int(11) NOT NULL DEFAULT 0,
  `ticket_promedio` decimal(12,2) NOT NULL DEFAULT 0.00,
  `top_producto` varchar(100) DEFAULT NULL,
  `generado_en` datetime NOT NULL DEFAULT current_timestamp(),
  `formato` enum('PDF','Excel','Pantalla') NOT NULL DEFAULT 'Pantalla',
  `id_sede` int(11) DEFAULT NULL,
  `id_usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Snapshots de métricas de ventas por sede y periodo para reportes';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rol`
--

CREATE TABLE `rol` (
  `id_rol` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles del sistema: Mesero, Cajero, Administrador';

--
-- Volcado de datos para la tabla `rol`
--

INSERT INTO `rol` (`id_rol`, `nombre`) VALUES
(1, 'Administrador'),
(3, 'Cajero'),
(2, 'Mesero');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sede`
--

CREATE TABLE `sede` (
  `id_sede` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `ubicacion` varchar(200) NOT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Establecimientos físicos de OlimpicBar';

--
-- Volcado de datos para la tabla `sede`
--

INSERT INTO `sede` (`id_sede`, `nombre`, `ubicacion`, `activa`, `fecha_creacion`) VALUES
(1, 'Chapinero', 'Calle 63 # 9-45, Chapinero, Bogotá', 1, '2026-04-14 17:07:16'),
(2, 'Usaquén', 'Calle 119 # 6-26, Usaquén, Bogotá', 1, '2026-04-14 17:07:16'),
(3, 'Zona Rosa', 'Calle 82 # 12-18, Zona Rosa, Bogotá', 1, '2026-04-14 17:07:16');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sesion_mesa`
--

CREATE TABLE `sesion_mesa` (
  `id_sesion` int(11) NOT NULL,
  `fecha_inicio` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_fin` datetime DEFAULT NULL,
  `estado` enum('Activa','Cerrada') NOT NULL DEFAULT 'Activa',
  `total_sesion` decimal(12,2) NOT NULL DEFAULT 0.00,
  `id_mesa` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ciclo completo de una mesa: apertura, uso y cierre';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `id_usuario` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `correo` varchar(100) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `contrasena_tmp` tinyint(1) NOT NULL DEFAULT 1,
  `intentos_login` tinyint(4) NOT NULL DEFAULT 0,
  `bloqueado_hasta` datetime DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `id_rol` int(11) NOT NULL,
  `id_sede` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Empleados del sistema con credenciales y rol asignado';

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`id_usuario`, `nombre`, `username`, `contrasena`, `correo`, `activo`, `contrasena_tmp`, `intentos_login`, `bloqueado_hasta`, `fecha_creacion`, `id_rol`, `id_sede`) VALUES
(1, '', 'admin01.chap', '$2a$10$NW7UAknUuzNDy4hNvwbHkuuXS/ZBlkZRIK4D8qyKSbDasO9JEeSkS', NULL, 1, 1, 0, NULL, '2026-04-17 23:53:30', 1, 1),
(2, '', 'mesero01.chap', '$2a$10$NW7UAknUuzNDy4hNvwbHkuuXS/ZBlkZRIK4D8qyKSbDasO9JEeSkS', NULL, 1, 1, 0, NULL, '2026-04-17 23:53:30', 2, 1),
(3, '', 'cajero01.chap', '$2a$10$NW7UAknUuzNDy4hNvwbHkuuXS/ZBlkZRIK4D8qyKSbDasO9JEeSkS', NULL, 1, 1, 0, NULL, '2026-04-17 23:53:30', 3, 1);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_cuentas_abiertas`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_cuentas_abiertas` (
`id_sesion` int(11)
,`sede` varchar(100)
,`mesa` int(11)
,`comensal` varchar(30)
,`rol_mesa` enum('Dueno','Acompanante')
,`total` decimal(12,2)
,`estado_cuenta` enum('Abierta','Cobrada')
,`fecha_inicio` datetime
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_margen_productos`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_margen_productos` (
`id_producto` int(11)
,`nombre` varchar(100)
,`precio_venta` decimal(12,2)
,`costo` decimal(12,2)
,`margen_pct` decimal(19,2)
,`categoria` varchar(100)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_stock_critico`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_stock_critico` (
`sede` varchar(100)
,`producto` varchar(100)
,`stock_actual` int(11)
,`stock_minimo` int(11)
,`nivel_alerta` varchar(13)
);

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_cuentas_abiertas`
--
DROP TABLE IF EXISTS `vista_cuentas_abiertas`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_cuentas_abiertas`  AS SELECT `sm`.`id_sesion` AS `id_sesion`, `se`.`nombre` AS `sede`, `m`.`numero` AS `mesa`, `c`.`nombre_visible` AS `comensal`, `c`.`rol_mesa` AS `rol_mesa`, `cu`.`total` AS `total`, `cu`.`estado` AS `estado_cuenta`, `sm`.`fecha_inicio` AS `fecha_inicio` FROM ((((`cuenta` `cu` join `cliente` `c` on(`c`.`id_cliente` = `cu`.`id_cliente`)) join `sesion_mesa` `sm` on(`sm`.`id_sesion` = `cu`.`id_sesion`)) join `mesa` `m` on(`m`.`id_mesa` = `sm`.`id_mesa`)) join `sede` `se` on(`se`.`id_sede` = `m`.`id_sede`)) WHERE `cu`.`estado` = 'Abierta' AND `sm`.`estado` = 'Activa' ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_margen_productos`
--
DROP TABLE IF EXISTS `vista_margen_productos`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_margen_productos`  AS SELECT `p`.`id_producto` AS `id_producto`, `p`.`nombre` AS `nombre`, `p`.`precio_venta` AS `precio_venta`, `p`.`costo` AS `costo`, round((`p`.`precio_venta` - `p`.`costo`) / `p`.`precio_venta` * 100,2) AS `margen_pct`, `c`.`nombre` AS `categoria` FROM (`producto` `p` join `categoria` `c` on(`c`.`id_categoria` = `p`.`id_categoria`)) ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_stock_critico`
--
DROP TABLE IF EXISTS `vista_stock_critico`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_stock_critico`  AS SELECT `s`.`nombre` AS `sede`, `p`.`nombre` AS `producto`, `i`.`stock_actual` AS `stock_actual`, `i`.`stock_minimo` AS `stock_minimo`, CASE WHEN `i`.`stock_actual` = 0 THEN 'Sin Stock' WHEN `i`.`stock_actual` <= `i`.`stock_minimo` * 0.5 THEN 'Stock Critico' WHEN `i`.`stock_actual` <= `i`.`stock_minimo` THEN 'Stock Bajo' ELSE 'Normal' END AS `nivel_alerta` FROM ((`inventario` `i` join `producto` `p` on(`p`.`id_producto` = `i`.`id_producto`)) join `sede` `s` on(`s`.`id_sede` = `i`.`id_sede`)) WHERE `i`.`stock_actual` <= `i`.`stock_minimo` ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `alerta`
--
ALTER TABLE `alerta`
  ADD PRIMARY KEY (`id_alerta`),
  ADD KEY `fk_alerta_sede` (`id_sede`),
  ADD KEY `fk_alerta_inventario` (`id_inventario`),
  ADD KEY `fk_alerta_usuario` (`id_usuario`);

--
-- Indices de la tabla `categoria`
--
ALTER TABLE `categoria`
  ADD PRIMARY KEY (`id_categoria`);

--
-- Indices de la tabla `cierre_jornada`
--
ALTER TABLE `cierre_jornada`
  ADD PRIMARY KEY (`id_cierre`),
  ADD KEY `fk_cierre_sede` (`id_sede`),
  ADD KEY `fk_cierre_usuario` (`id_usuario`);

--
-- Indices de la tabla `cliente`
--
ALTER TABLE `cliente`
  ADD PRIMARY KEY (`id_cliente`),
  ADD KEY `fk_cliente_sesion` (`id_sesion`);

--
-- Indices de la tabla `cuenta`
--
ALTER TABLE `cuenta`
  ADD PRIMARY KEY (`id_cuenta`),
  ADD UNIQUE KEY `uq_cuenta_cliente_sesion` (`id_cliente`,`id_sesion`),
  ADD KEY `fk_cuenta_sesion` (`id_sesion`);

--
-- Indices de la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  ADD PRIMARY KEY (`id_detalle`),
  ADD KEY `fk_detalle_pedido` (`id_pedido`),
  ADD KEY `fk_detalle_producto` (`id_producto`),
  ADD KEY `fk_detalle_usuario` (`id_usuario`);

--
-- Indices de la tabla `importacion_inventario`
--
ALTER TABLE `importacion_inventario`
  ADD PRIMARY KEY (`id_importacion`),
  ADD KEY `fk_import_sede` (`id_sede`),
  ADD KEY `fk_import_usuario` (`id_usuario`);

--
-- Indices de la tabla `inventario`
--
ALTER TABLE `inventario`
  ADD PRIMARY KEY (`id_inventario`),
  ADD UNIQUE KEY `uq_inventario_producto_sede` (`id_producto`,`id_sede`),
  ADD KEY `fk_inv_sede` (`id_sede`);

--
-- Indices de la tabla `log_acceso`
--
ALTER TABLE `log_acceso`
  ADD PRIMARY KEY (`id_log`),
  ADD KEY `fk_acceso_usuario` (`id_usuario`);

--
-- Indices de la tabla `log_auditoria`
--
ALTER TABLE `log_auditoria`
  ADD PRIMARY KEY (`id_log`),
  ADD KEY `fk_audit_usuario` (`id_usuario`),
  ADD KEY `fk_audit_sede` (`id_sede`);

--
-- Indices de la tabla `log_inventario`
--
ALTER TABLE `log_inventario`
  ADD PRIMARY KEY (`id_log`),
  ADD KEY `fk_log_inv_inventario` (`id_inventario`),
  ADD KEY `fk_log_inv_usuario` (`id_usuario`);

--
-- Indices de la tabla `mesa`
--
ALTER TABLE `mesa`
  ADD PRIMARY KEY (`id_mesa`),
  ADD UNIQUE KEY `uq_mesa_numero_sede` (`numero`,`id_sede`),
  ADD UNIQUE KEY `uq_mesa_qr` (`qr_codigo`),
  ADD KEY `fk_mesa_sede` (`id_sede`);

--
-- Indices de la tabla `pago`
--
ALTER TABLE `pago`
  ADD PRIMARY KEY (`id_pago`),
  ADD KEY `fk_pago_cuenta` (`id_cuenta`),
  ADD KEY `fk_pago_usuario` (`id_usuario`);

--
-- Indices de la tabla `pedido`
--
ALTER TABLE `pedido`
  ADD PRIMARY KEY (`id_pedido`),
  ADD KEY `fk_pedido_sesion` (`id_sesion`),
  ADD KEY `fk_pedido_cliente` (`id_cliente`);

--
-- Indices de la tabla `producto`
--
ALTER TABLE `producto`
  ADD PRIMARY KEY (`id_producto`),
  ADD KEY `fk_producto_categoria` (`id_categoria`);

--
-- Indices de la tabla `reporte_ventas`
--
ALTER TABLE `reporte_ventas`
  ADD PRIMARY KEY (`id_reporte`),
  ADD KEY `fk_reporte_sede` (`id_sede`),
  ADD KEY `fk_reporte_usuario` (`id_usuario`);

--
-- Indices de la tabla `rol`
--
ALTER TABLE `rol`
  ADD PRIMARY KEY (`id_rol`),
  ADD UNIQUE KEY `uq_rol_nombre` (`nombre`);

--
-- Indices de la tabla `sede`
--
ALTER TABLE `sede`
  ADD PRIMARY KEY (`id_sede`);

--
-- Indices de la tabla `sesion_mesa`
--
ALTER TABLE `sesion_mesa`
  ADD PRIMARY KEY (`id_sesion`),
  ADD KEY `fk_sesion_mesa` (`id_mesa`),
  ADD KEY `fk_sesion_usuario` (`id_usuario`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `uq_usuario_username` (`username`),
  ADD KEY `fk_usuario_rol` (`id_rol`),
  ADD KEY `fk_usuario_sede` (`id_sede`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `alerta`
--
ALTER TABLE `alerta`
  MODIFY `id_alerta` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `categoria`
--
ALTER TABLE `categoria`
  MODIFY `id_categoria` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `cierre_jornada`
--
ALTER TABLE `cierre_jornada`
  MODIFY `id_cierre` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `cliente`
--
ALTER TABLE `cliente`
  MODIFY `id_cliente` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `cuenta`
--
ALTER TABLE `cuenta`
  MODIFY `id_cuenta` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  MODIFY `id_detalle` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `importacion_inventario`
--
ALTER TABLE `importacion_inventario`
  MODIFY `id_importacion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `inventario`
--
ALTER TABLE `inventario`
  MODIFY `id_inventario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT de la tabla `log_acceso`
--
ALTER TABLE `log_acceso`
  MODIFY `id_log` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `log_auditoria`
--
ALTER TABLE `log_auditoria`
  MODIFY `id_log` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `log_inventario`
--
ALTER TABLE `log_inventario`
  MODIFY `id_log` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `mesa`
--
ALTER TABLE `mesa`
  MODIFY `id_mesa` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT de la tabla `pago`
--
ALTER TABLE `pago`
  MODIFY `id_pago` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pedido`
--
ALTER TABLE `pedido`
  MODIFY `id_pedido` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `producto`
--
ALTER TABLE `producto`
  MODIFY `id_producto` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT de la tabla `reporte_ventas`
--
ALTER TABLE `reporte_ventas`
  MODIFY `id_reporte` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `rol`
--
ALTER TABLE `rol`
  MODIFY `id_rol` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `sede`
--
ALTER TABLE `sede`
  MODIFY `id_sede` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `sesion_mesa`
--
ALTER TABLE `sesion_mesa`
  MODIFY `id_sesion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `alerta`
--
ALTER TABLE `alerta`
  ADD CONSTRAINT `fk_alerta_inventario` FOREIGN KEY (`id_inventario`) REFERENCES `inventario` (`id_inventario`),
  ADD CONSTRAINT `fk_alerta_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`),
  ADD CONSTRAINT `fk_alerta_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `cierre_jornada`
--
ALTER TABLE `cierre_jornada`
  ADD CONSTRAINT `fk_cierre_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`),
  ADD CONSTRAINT `fk_cierre_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `cliente`
--
ALTER TABLE `cliente`
  ADD CONSTRAINT `fk_cliente_sesion` FOREIGN KEY (`id_sesion`) REFERENCES `sesion_mesa` (`id_sesion`);

--
-- Filtros para la tabla `cuenta`
--
ALTER TABLE `cuenta`
  ADD CONSTRAINT `fk_cuenta_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  ADD CONSTRAINT `fk_cuenta_sesion` FOREIGN KEY (`id_sesion`) REFERENCES `sesion_mesa` (`id_sesion`);

--
-- Filtros para la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  ADD CONSTRAINT `fk_detalle_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`),
  ADD CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`id_producto`) REFERENCES `producto` (`id_producto`),
  ADD CONSTRAINT `fk_detalle_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `importacion_inventario`
--
ALTER TABLE `importacion_inventario`
  ADD CONSTRAINT `fk_import_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`),
  ADD CONSTRAINT `fk_import_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `inventario`
--
ALTER TABLE `inventario`
  ADD CONSTRAINT `fk_inv_producto` FOREIGN KEY (`id_producto`) REFERENCES `producto` (`id_producto`),
  ADD CONSTRAINT `fk_inv_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`);

--
-- Filtros para la tabla `log_acceso`
--
ALTER TABLE `log_acceso`
  ADD CONSTRAINT `fk_acceso_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `log_auditoria`
--
ALTER TABLE `log_auditoria`
  ADD CONSTRAINT `fk_audit_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`),
  ADD CONSTRAINT `fk_audit_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `log_inventario`
--
ALTER TABLE `log_inventario`
  ADD CONSTRAINT `fk_log_inv_inventario` FOREIGN KEY (`id_inventario`) REFERENCES `inventario` (`id_inventario`),
  ADD CONSTRAINT `fk_log_inv_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `mesa`
--
ALTER TABLE `mesa`
  ADD CONSTRAINT `fk_mesa_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`);

--
-- Filtros para la tabla `pago`
--
ALTER TABLE `pago`
  ADD CONSTRAINT `fk_pago_cuenta` FOREIGN KEY (`id_cuenta`) REFERENCES `cuenta` (`id_cuenta`),
  ADD CONSTRAINT `fk_pago_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `pedido`
--
ALTER TABLE `pedido`
  ADD CONSTRAINT `fk_pedido_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  ADD CONSTRAINT `fk_pedido_sesion` FOREIGN KEY (`id_sesion`) REFERENCES `sesion_mesa` (`id_sesion`);

--
-- Filtros para la tabla `producto`
--
ALTER TABLE `producto`
  ADD CONSTRAINT `fk_producto_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categoria` (`id_categoria`);

--
-- Filtros para la tabla `reporte_ventas`
--
ALTER TABLE `reporte_ventas`
  ADD CONSTRAINT `fk_reporte_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`),
  ADD CONSTRAINT `fk_reporte_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `sesion_mesa`
--
ALTER TABLE `sesion_mesa`
  ADD CONSTRAINT `fk_sesion_mesa` FOREIGN KEY (`id_mesa`) REFERENCES `mesa` (`id_mesa`),
  ADD CONSTRAINT `fk_sesion_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`id_rol`) REFERENCES `rol` (`id_rol`),
  ADD CONSTRAINT `fk_usuario_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
