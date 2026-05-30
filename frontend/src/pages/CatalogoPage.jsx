import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mesasService, catalogoService } from '../services/api';

function ProductCard({ producto }) {
  const [agregado, setAgregado] = useState(false);
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden hover:border-gold/40 transition-all duration-300 group">
      <div className="relative h-44 overflow-hidden bg-surfaceHigh">
        <img
          src={producto.imagen_url}
          alt={producto.nombre}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { e.target.src = `https://placehold.co/400x300/1A1A1A/E2B05F?text=${encodeURIComponent(producto.nombre)}`; }}
        />
      </div>
      <div className="p-4">
        <h3 className="text-textPrimary font-semibold text-sm mb-1 truncate">{producto.nombre}</h3>
        <p className="text-textSecondary text-xs leading-relaxed line-clamp-2 mb-4">{producto.descripcion}</p>
        <div className="flex items-center justify-between">
          <span className="text-gold font-bold text-lg">${Number(producto.precio_venta).toLocaleString('es-CO')}</span>
          <button
            onClick={() => setAgregado(true)}
            className={`text-xs font-semibold px-4 py-2 rounded-lg ${agregado ? 'bg-success/20 text-success' : 'bg-gold text-background'}`}
          >
            {agregado ? '✓ Agregado' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogoPage({ isAdminView }) {
  const { qrToken } = useParams();
  const [productos, setProductos]   = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [catActiva, setCatActiva]   = useState('Todos');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [infoSede, setInfoSede]     = useState({ nombre: 'Cargando...', mesa: 'S/N' });

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        let sedeIdFinal = 1;

        if (!isAdminView) {
          const { data: mesaData } = await mesasService.getByToken(qrToken);
          sedeIdFinal = mesaData.id_sede;
          setInfoSede({ nombre: mesaData.sede_nombre, mesa: mesaData.numero });

          if (mesaData.estado === 'Libre') {
            await mesasService.ocupar(mesaData.id_mesa);
          }
        } else {
          setInfoSede({ nombre: 'Panel Administración', mesa: 'Admin' });
        }

        const { data: resCat } = await catalogoService.get(sedeIdFinal);
        const listaProductos = Array.isArray(resCat) ? resCat : (resCat.productos || []);

        setProductos(listaProductos);
        // Agrupa por id_categoria hasta que tengamos endpoint de categorías
        const cats = [...new Set(listaProductos.map(p => p.id_categoria).filter(Boolean))];
        setCategorias(cats);
      } catch (err) {
        setError(err.response?.data?.error || 'Error de conexión con el servidor');
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, [qrToken, isAdminView]);

  const filtrados = catActiva === 'Todos'
    ? productos
    : productos.filter(p => p.id_categoria === catActiva);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-gold">Cargando BaseMod...</div>;
  if (error)   return <div className="min-h-screen bg-background flex items-center justify-center text-error p-4 text-center">{error}</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border sticky top-0 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div>
            <p className="text-gold text-[10px] uppercase tracking-widest font-bold">BaseMod • {infoSede.nombre}</p>
            <h1 className="text-textPrimary font-semibold text-lg">Mesa {infoSede.mesa}</h1>
          </div>
          {isAdminView && (
            <Link
              to="/admin/qr"
              className="bg-gold/10 text-gold text-[10px] px-3 py-1.5 rounded border border-gold/20 hover:bg-gold/20 transition-colors font-bold"
            >
              Gestionar QR
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          <button onClick={() => setCatActiva('Todos')} className={`px-4 py-2 rounded-full text-xs font-bold border ${catActiva === 'Todos' ? 'bg-gold text-background' : 'bg-surface text-textSecondary border-border'}`}>Todos</button>
          {categorias.map(cat => (
            <button key={cat} onClick={() => setCatActiva(cat)} className={`px-4 py-2 rounded-full text-xs font-bold border ${catActiva === cat ? 'bg-gold text-background' : 'bg-surface text-textSecondary border-border'}`}>Cat. {cat}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtrados.map(prod => <ProductCard key={prod.id_producto} producto={prod} />)}
        </div>
      </div>
    </div>
  );
}
