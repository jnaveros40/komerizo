'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import './tienda.css'

type Producto = {
  id: number
  nombre: string
  descripcion: string
  precio_venta: number
  stock: number
  estado: string
}

type CarritoItem = Producto & { cantidad_comprar: number }

export default function UsuarioTienda() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [procesandoPago, setProcesandoPago] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')

  useEffect(() => {
    fetchProductos()
  }, [])

  const fetchProductos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('komerizo_tienda_productos')
        .select('*')
        .eq('estado', 'activo')
        .gt('stock', 0)
        .order('nombre', { ascending: true })

      if (error) throw error
      setProductos(data || [])
    } catch (error) {
      console.error('Error cargando productos:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount)
  }

  const addToCart = (prod: Producto) => {
    const existing = carrito.find(item => item.id === prod.id)
    if (existing) {
      if (existing.cantidad_comprar >= prod.stock) return // No puede comprar más que el stock
      setCarrito(carrito.map(item => 
        item.id === prod.id ? { ...item, cantidad_comprar: item.cantidad_comprar + 1 } : item
      ))
    } else {
      setCarrito([...carrito, { ...prod, cantidad_comprar: 1 }])
    }
  }

  const removeFromCart = (id: number) => {
    setCarrito(carrito.filter(item => item.id !== id))
  }

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.precio_venta * item.cantidad_comprar), 0)

  const handleComprar = async () => {
    if (carrito.length === 0) return
    
    try {
      setProcesandoPago(true)
      
      // Calculate total cost to be recorded
      // We don't have precio_costo in this view, so we will fetch it or assume it's 0 for now
      // Or we can let a backend function handle this. Since it's client-side, let's just insert the sale.
      
      const { data: ventaData, error: ventaError } = await supabase
        .from('komerizo_tienda_ventas')
        .insert({
          vendedor_id: user?.id, // En auto-servicio el usuario mismo puede ser el 'vendedor' o null
          comprador_id: user?.id,
          total_venta: totalCarrito,
          total_costo: 0, // Placeholder
          estado_pago: 'pendiente', // Requires treasurer approval
          metodo_pago: metodoPago
        })
        .select()
        .single()

      if (ventaError) throw ventaError

      // Insert details
      const detalles = carrito.map(item => ({
        venta_id: ventaData.id,
        producto_id: item.id,
        cantidad: item.cantidad_comprar,
        precio_unitario: item.precio_venta
      }))

      const { error: detallesError } = await supabase
        .from('komerizo_tienda_venta_detalles')
        .insert(detalles)

      if (detallesError) throw detallesError

      alert('Compra realizada con éxito. El tesorero validará tu pago y generará el recibo oficial.')
      setCarrito([])
      fetchProductos() // Recargar para actualizar (aunque el stock debe restarlo el tesorero)
    } catch (error) {
      console.error('Error al procesar compra:', error)
      alert('Hubo un error al procesar tu compra.')
    } finally {
      setProcesandoPago(false)
    }
  }

  return (
    <div className="tienda-container">
      <div className="tienda-header">
        <h1>🛍️ Tienda y Bazar</h1>
        <p className="header-subtitle">Compra certificados, boletos o productos para apoyar a la JAC</p>
      </div>

      <div className="tienda-grid">
        <div className="productos-section">
          <h2>Productos Disponibles</h2>
          {loading ? (
            <div className="loading">Cargando productos...</div>
          ) : productos.length === 0 ? (
            <div className="empty-state">No hay productos disponibles en este momento.</div>
          ) : (
            <div className="productos-list">
              {productos.map(prod => (
                <div key={prod.id} className="producto-card">
                  <div className="producto-info">
                    <h3>{prod.nombre}</h3>
                    <p className="producto-desc">{prod.descripcion}</p>
                    <div className="producto-meta">
                      <span className="producto-precio">{formatCurrency(prod.precio_venta)}</span>
                      <span className="producto-stock">Disponibles: {prod.stock}</span>
                    </div>
                  </div>
                  <button 
                    className="btn-add" 
                    onClick={() => addToCart(prod)}
                    disabled={carrito.find(c => c.id === prod.id)?.cantidad_comprar === prod.stock}
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="carrito-section">
          <h2>Tu Resumen</h2>
          <div className="carrito-content">
            {carrito.length === 0 ? (
              <p className="carrito-vacio">El carrito está vacío</p>
            ) : (
              <>
                <ul className="carrito-items">
                  {carrito.map(item => (
                    <li key={item.id} className="carrito-item">
                      <div className="item-details">
                        <span className="item-name">{item.nombre}</span>
                        <span className="item-qty">x{item.cantidad_comprar}</span>
                      </div>
                      <div className="item-actions">
                        <span className="item-price">{formatCurrency(item.precio_venta * item.cantidad_comprar)}</span>
                        <button className="btn-remove" onClick={() => removeFromCart(item.id)}>✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="carrito-total">
                  <span>Total a pagar:</span>
                  <strong>{formatCurrency(totalCarrito)}</strong>
                </div>

                <div className="metodo-pago-selector">
                  <label>Método de Pago:</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                    <option value="efectivo">Efectivo (Pagar al tesorero)</option>
                    <option value="transferencia">Transferencia (Enviar comprobante)</option>
                  </select>
                </div>

                <button 
                  className="btn-comprar" 
                  onClick={handleComprar}
                  disabled={procesandoPago}
                >
                  {procesandoPago ? 'Procesando...' : 'Confirmar Solicitud de Compra'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
