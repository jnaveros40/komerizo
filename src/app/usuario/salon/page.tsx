'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import '@/components/reuniones.css';

interface SalonConfig {
  id: number;
  valor_por_hora: number;
  valor_por_dia: number;
  hora_apertura: string;
  hora_cierre: string;
  descripcion: string;
}

interface Alquiler {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_alquiler: string;
  estado: string;
}

interface InventarioItem {
  id: number;
  nombre: string;
  cantidad: number;
  valor_alquiler: number;
  es_alquilable: boolean;
}

interface ItemAlquilerSeleccionado {
  inventario_id: number;
  nombre: string;
  cantidad_alquilada: number;
  valor_unitario: number;
  cantidad_disponible: number;
}

export default function UsuarioSalonPage() {
  const [config, setConfig] = useState<SalonConfig | null>(null);
  const [reservas, setReservas] = useState<Alquiler[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);
  const [userRole, setUserRole] = useState<any>(null);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [itemsSeleccionados, setItemsSeleccionados] = useState<ItemAlquilerSeleccionado[]>([]);
  const [precioItems, setPrecioItems] = useState(0);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Obtener fecha actual en zona local sin desfase
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Formatear fecha de forma correcta sin desfase de zona horaria
  const formatearFecha = (fechaString: string) => {
    const [year, month, day] = fechaString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Parsear fecha string "YYYY-MM-DD" a Date local sin desfase
  const parseLocalDate = (fechaString: string): Date => {
    const [year, month, day] = fechaString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const [showFormReserva, setShowFormReserva] = useState(false);
  const [formReserva, setFormReserva] = useState({
    tipo_alquiler: 'por_hora' as 'por_hora' | 'por_dia',
    cantidad: 1,
    fecha_inicio: getTodayDate(),
    fecha_fin: getTodayDate(),
    hora_inicio: '08:00',
    hora_fin: '09:00',
    motivo: '',
  });

  const [precioEstimado, setPrecioEstimado] = useState(0);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, []);

  // Calcular precio estimado cuando cambian parámetros
  useEffect(() => {
    if (config) {
      calcularPrecio();
    }
  }, [formReserva, config]);

  // Calcular cantidad de horas automáticamente cuando cambian las horas
  useEffect(() => {
    if (formReserva.tipo_alquiler === 'por_hora' && formReserva.hora_inicio && formReserva.hora_fin) {
      const [horaInicio, minInicio] = formReserva.hora_inicio.split(':').map(Number);
      const [horaFin, minFin] = formReserva.hora_fin.split(':').map(Number);
      
      const minutosInicio = horaInicio * 60 + minInicio;
      const minutosFin = horaFin * 60 + minFin;
      
      const diferencia = minutosFin - minutosInicio;
      const horas = Math.max(1, Math.ceil(diferencia / 60)); // Mínimo 1 hora
      
      setFormReserva(prev => ({
        ...prev,
        cantidad: horas
      }));
    }
  }, [formReserva.hora_inicio, formReserva.hora_fin, formReserva.tipo_alquiler]);

  const loadData = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) return;

      const userData = JSON.parse(storedUser);
      setUsuario(userData);

      // Obtener rol actual del usuario
      if (userData.roles && userData.roles.length > 0) {
        setUserRole(userData.roles[0]);
      }

      // Cargar configuración
      const { data: configData } = await supabase
        .from('komerizo_salon_config')
        .select('*')
        .eq('estado', 'activo')
        .single();

      if (configData) {
        setConfig(configData);
      }

      // Cargar reservas confirmadas
      const { data: reservasData } = await supabase
        .from('komerizo_alquileres')
        .select('*')
        .eq('estado', 'confirmado')
        .order('fecha_inicio', { ascending: true });

      if (reservasData) {
        setReservas(reservasData);
      }

      // Cargar inventario alquilable
      const { data: inventarioData } = await supabase
        .from('komerizo_inventario')
        .select('*')
        .eq('es_alquilable', true)
        .eq('estado', 'activo')
        .gt('cantidad', 0)
        .order('nombre', { ascending: true });

      if (inventarioData) {
        setInventario(inventarioData);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debug: Log reservas when loaded
  useEffect(() => {
    console.log('Reservas cargadas del servidor:', reservas);
    if (reservas.length > 0) {
      console.log('Primera reserva:', reservas[0]);
    }
  }, [reservas]);

  // Sincronizar fecha seleccionada del calendario con el formulario
  useEffect(() => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const fechaFormato = `${year}-${month}-${day}`;
      
      setFormReserva(prev => ({
        ...prev,
        fecha_inicio: fechaFormato,
        fecha_fin: fechaFormato
      }));
    }
  }, [selectedDate]);

  const calcularPrecio = () => {
    if (!config) return;

    let precio = 0;
    if (formReserva.tipo_alquiler === 'por_hora') {
      precio = parseFloat(formReserva.cantidad.toString()) * config.valor_por_hora;
    } else {
      precio = parseFloat(formReserva.cantidad.toString()) * config.valor_por_dia;
    }
    setPrecioEstimado(precio);
  };

  const handleCrearReserva = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config) return;

    try {
      // Validar disponibilidad usando parseLocalDate para mantener consistencia de timezone
      const reservasEnFecha = reservas.filter((r) => {
        const rStart = parseLocalDate(r.fecha_inicio);
        const rEnd = parseLocalDate(r.fecha_fin);
        const formStart = parseLocalDate(formReserva.fecha_inicio);
        const formEnd = parseLocalDate(formReserva.fecha_fin);

        return (
          (formStart >= rStart && formStart <= rEnd) ||
          (formEnd >= rStart && formEnd <= rEnd) ||
          (rStart >= formStart && rStart <= formEnd)
        );
      });

      if (reservasEnFecha.length > 0) {
        alert('El salón no está disponible en esas fechas');
        return;
      }

      // Calcular total: salón + items
      const precioTotal = precioEstimado + precioItems;

      const { data: alquilerData, error: errorAlquiler } = await supabase
        .from('komerizo_alquileres')
        .insert([
          {
            usuario_id: usuario.id,
            rol_id: userRole?.id,
            fecha_inicio: formReserva.fecha_inicio,
            fecha_fin: formReserva.fecha_fin,
            hora_inicio: formReserva.tipo_alquiler === 'por_hora' ? formReserva.hora_inicio : config.hora_apertura,
            hora_fin: formReserva.tipo_alquiler === 'por_hora' ? formReserva.hora_fin : config.hora_cierre,
            tipo_alquiler: formReserva.tipo_alquiler,
            cantidad: formReserva.cantidad,
            valor_total: precioTotal,
            motivo: formReserva.motivo,
            estado: 'confirmado',
          },
        ])
        .select();

      if (errorAlquiler) throw errorAlquiler;

      // Guardar items seleccionados
      if (alquilerData && alquilerData.length > 0 && itemsSeleccionados.length > 0) {
        const alquilerId = alquilerData[0].id;

        const itemsParaGuardar = itemsSeleccionados.map((item) => ({
          alquiler_id: alquilerId,
          inventario_id: item.inventario_id,
          cantidad_alquilada: item.cantidad_alquilada,
          valor_unitario: item.valor_unitario,
          valor_total: item.cantidad_alquilada * item.valor_unitario,
        }));

        const { error: errorItems } = await supabase
          .from('komerizo_alquiler_items')
          .insert(itemsParaGuardar);

        if (errorItems) throw errorItems;
      }

      alert('Reserva creada exitosamente');
      setShowFormReserva(false);
      setFormReserva({
        tipo_alquiler: 'por_hora',
        cantidad: 1,
        fecha_inicio: getTodayDate(),
        fecha_fin: getTodayDate(),
        hora_inicio: '08:00',
        hora_fin: '09:00',
        motivo: '',
      });
      setItemsSeleccionados([]);
      await loadData();
    } catch (error) {
      console.error('Error creando reserva:', error);
      alert('Error al crear la reserva');
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Generar array de horas disponibles
  const generarHorasDisponibles = () => {
    if (!config) return [];
    
    const [aperturaH, aperturaM] = config.hora_apertura.split(':').map(Number);
    const [cierreH, cierreM] = config.hora_cierre.split(':').map(Number);
    
    const horas = [];
    for (let h = aperturaH; h <= cierreH; h++) {
      horas.push(String(h).padStart(2, '0'));
    }
    return horas;
  };

  // Agregar item al carrito de items
  const agregarItem = (inventarioId: number) => {
    const item = inventario.find((i) => i.id === inventarioId);
    if (!item) return;

    // Verificar si ya está en la lista
    const yaExiste = itemsSeleccionados.find((i) => i.inventario_id === inventarioId);
    if (yaExiste) {
      alert('Este item ya está agregado');
      return;
    }

    const nuevoItem: ItemAlquilerSeleccionado = {
      inventario_id: inventarioId,
      nombre: item.nombre,
      cantidad_alquilada: 1,
      valor_unitario: item.valor_alquiler,
      cantidad_disponible: item.cantidad,
    };

    setItemsSeleccionados([...itemsSeleccionados, nuevoItem]);
  };

  // Eliminar item del carrito
  const eliminarItem = (inventarioId: number) => {
    setItemsSeleccionados(itemsSeleccionados.filter((i) => i.inventario_id !== inventarioId));
  };

  // Actualizar cantidad de item en carrito
  const actualizarCantidadItem = (inventarioId: number, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0 || nuevaCantidad > inventario.find((i) => i.id === inventarioId)?.cantidad!) return;
    
    setItemsSeleccionados(
      itemsSeleccionados.map((i) =>
        i.inventario_id === inventarioId
          ? { ...i, cantidad_alquilada: nuevaCantidad }
          : i
      )
    );
  };

  // Calcular total de items
  useEffect(() => {
    const total = itemsSeleccionados.reduce((sum, item) => {
      return sum + item.cantidad_alquilada * item.valor_unitario;
    }, 0);
    setPrecioItems(total);
  }, [itemsSeleccionados]);

  const isDateReserved = (date: Date) => {
    return reservas.some((r) => {
      const rStart = parseLocalDate(r.fecha_inicio);
      const rEnd = parseLocalDate(r.fecha_fin);
      
      // Comparar solo fecha, sin hora
      const dateToCompare = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      console.log('Checking date:', dateToCompare, 'Against reservation:', r.fecha_inicio, 'to', r.fecha_fin, 'Parsed:', rStart, 'to', rEnd);
      const isReserved = dateToCompare >= rStart && dateToCompare <= rEnd;
      if (isReserved) console.log('DATE IS RESERVED');
      return isReserved;
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Días vacíos al principio
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ background: '#0f1419' }}></div>);
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const reserved = isDateReserved(date);
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          style={{
            padding: '1rem',
            background: isSelected ? '#6c5ce7' : reserved ? '#c0392b' : '#1e2a3a',
            color: reserved ? '#fff' : '#a1aec6',
            border: '1px solid #3a4a5f',
            cursor: 'pointer',
            borderRadius: '4px',
            textAlign: 'center',
            fontWeight: isSelected ? 'bold' : 'normal',
          }}
        >
          <div>{day}</div>
          {reserved && <div style={{ fontSize: '0.7rem' }}>Reservado</div>}
        </div>
      );
    }

    return days;
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#a1aec6' }}>Cargando...</div>;
  }

  if (!config) {
    return (
      <div style={{ padding: '2rem', color: '#a1aec6', textAlign: 'center' }}>
        El salón comunal no está disponible en este momento
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#fff' }}>🏛️ Alquiler del Salón Comunal</h1>

      {/* INFORMACIÓN DE TARIFAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: '#1e2a3a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #3a4a5f' }}>
          <div style={{ color: '#a1aec6', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Valor por Hora</div>
          <div style={{ fontSize: '1.8rem', color: '#6c5ce7', fontWeight: 'bold' }}>${config.valor_por_hora.toFixed(2)}</div>
        </div>
        <div style={{ background: '#1e2a3a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #3a4a5f' }}>
          <div style={{ color: '#a1aec6', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Valor por Día</div>
          <div style={{ fontSize: '1.8rem', color: '#6c5ce7', fontWeight: 'bold' }}>${config.valor_por_dia.toFixed(2)}</div>
        </div>
        <div style={{ background: '#1e2a3a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #3a4a5f' }}>
          <div style={{ color: '#a1aec6', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Horario</div>
          <div style={{ fontSize: '1.2rem', color: '#fff' }}>
            {config.hora_apertura} - {config.hora_cierre}
          </div>
        </div>
      </div>

      {/* DESCRIPCIÓN */}
      {config.descripcion && (
        <div style={{ background: '#1e2a3a', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3a4a5f' }}>
          <p style={{ color: '#a1aec6' }}>{config.descripcion}</p>
        </div>
      )}

      {/* CALENDARIO */}
      <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3a4a5f' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            style={{ background: '#6c5ce7', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
          >
            ← Anterior
          </button>
          <h2 style={{ color: '#fff' }}>
            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            style={{ background: '#6c5ce7', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
          >
            Siguiente →
          </button>
        </div>

        {/* Encabezados de días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
            <div key={day} style={{ textAlign: 'center', color: '#a1aec6', fontWeight: 'bold', padding: '0.5rem' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>{renderCalendar()}</div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#6c5ce7', borderRadius: '4px' }}></div>
            <span style={{ color: '#a1aec6' }}>Seleccionado</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#c0392b', borderRadius: '4px' }}></div>
            <span style={{ color: '#a1aec6' }}>Reservado</span>
          </div>
        </div>
      </div>

      {/* BOTÓN NUEVA RESERVA */}
      {!showFormReserva && (
        <button
          onClick={() => setShowFormReserva(true)}
          style={{
            padding: '1rem 2rem',
            background: '#6c5ce7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            marginBottom: '2rem',
          }}
        >
          ➕ Nueva Reserva
        </button>
      )}

      {/* FORMULARIO NUEVA RESERVA */}
      {showFormReserva && (
        <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3a4a5f' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Crear Nueva Reserva</h3>
          <form onSubmit={handleCrearReserva}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Tipo de Alquiler:</label>
                <select
                  value={formReserva.tipo_alquiler}
                  onChange={(e) =>
                    setFormReserva({
                      ...formReserva,
                      tipo_alquiler: e.target.value as 'por_hora' | 'por_dia',
                      cantidad: 1,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f1419',
                    color: '#fff',
                    border: '1px solid #3a4a5f',
                    borderRadius: '4px',
                  }}
                >
                  <option value="por_hora">Por Hora</option>
                  <option value="por_dia">Por Día Completo</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>
                  {formReserva.tipo_alquiler === 'por_hora' ? 'Horas (calculadas)' : 'Cantidad de Días'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formReserva.cantidad}
                  onChange={(e) => 
                    formReserva.tipo_alquiler === 'por_dia' 
                      ? setFormReserva({ ...formReserva, cantidad: parseInt(e.target.value) })
                      : null
                  }
                  disabled={formReserva.tipo_alquiler === 'por_hora'}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: formReserva.tipo_alquiler === 'por_hora' ? '#2a3a4f' : '#0f1419',
                    color: '#fff',
                    border: '1px solid #3a4a5f',
                    borderRadius: '4px',
                    cursor: formReserva.tipo_alquiler === 'por_hora' ? 'not-allowed' : 'text',
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Fecha de la Reserva:</label>
                <input
                  type="date"
                  value={formReserva.fecha_inicio}
                  onChange={(e) =>
                    setFormReserva({ 
                      ...formReserva, 
                      fecha_inicio: e.target.value,
                      fecha_fin: e.target.value 
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f1419',
                    color: '#fff',
                    border: '1px solid #3a4a5f',
                    borderRadius: '4px',
                  }}
                  required
                />
              </div>
            </div>

            {formReserva.tipo_alquiler === 'por_hora' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Hora de Inicio:</label>
                  <select
                    value={formReserva.hora_inicio}
                    onChange={(e) => {
                      setFormReserva({ ...formReserva, hora_inicio: e.target.value });
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f1419',
                      color: '#fff',
                      border: '1px solid #3a4a5f',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    <option value="">Selecciona hora de inicio</option>
                    {generarHorasDisponibles().map((hora) => {
                      const horaCompleta = `${hora}:00`;
                      // Si hay hora de fin, evitar que hora inicio sea >= hora fin
                      if (formReserva.hora_fin && horaCompleta >= formReserva.hora_fin) {
                        return null;
                      }
                      return (
                        <option key={hora} value={horaCompleta}>
                          {hora}:00
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Hora de Fin:</label>
                  <select
                    value={formReserva.hora_fin}
                    onChange={(e) => {
                      setFormReserva({ ...formReserva, hora_fin: e.target.value });
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f1419',
                      color: '#fff',
                      border: '1px solid #3a4a5f',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    <option value="">Selecciona hora de fin</option>
                    {generarHorasDisponibles().map((hora) => {
                      const horaCompleta = `${hora}:00`;
                      // Solo mostrar horas después de la hora de inicio
                      if (formReserva.hora_inicio && horaCompleta <= formReserva.hora_inicio) {
                        return null;
                      }
                      return (
                        <option key={hora} value={horaCompleta}>
                          {hora}:00
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Motivo (opcional):</label>
              <input
                type="text"
                value={formReserva.motivo}
                onChange={(e) => setFormReserva({ ...formReserva, motivo: e.target.value })}
                placeholder="Ej: Reunión familiar, evento"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                }}
              />
            </div>

            {/* SECCIÓN DE ITEMS DEL INVENTARIO */}
            <div style={{ background: '#0f1419', padding: '1.5rem', borderRadius: '4px', marginBottom: '1.5rem', border: '1px solid #3a4a5f' }}>
              <h4 style={{ marginBottom: '1rem', color: '#a1aec6' }}>📦 Artículos Disponibles para Alquilar</h4>
              
              {inventario.length === 0 ? (
                <p style={{ color: '#a1aec6', fontSize: '0.9rem' }}>No hay artículos disponibles para alquilar</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  {inventario.map((item) => {
                    const yaAgregado = itemsSeleccionados.some((i) => i.inventario_id === item.id);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          background: '#1e2a3a',
                          border: '1px solid #3a4a5f',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{item.nombre}</div>
                          <div style={{ color: '#a1aec6', fontSize: '0.85rem' }}>
                            Stock: {item.cantidad} | ${item.valor_alquiler}/unidad
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => agregarItem(item.id)}
                          disabled={yaAgregado}
                          style={{
                            padding: '0.5rem 1rem',
                            background: yaAgregado ? '#555' : '#6c5ce7',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: yaAgregado ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          {yaAgregado ? '✓ Agregado' : '➕ Agregar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ITEMS SELECCIONADOS */}
              {itemsSeleccionados.length > 0 && (
                <div>
                  <h5 style={{ color: '#6c5ce7', marginBottom: '0.75rem', marginTop: '1rem' }}>Items Seleccionados:</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    {itemsSeleccionados.map((item) => (
                      <div
                        key={item.inventario_id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto auto auto',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.75rem',
                          background: '#151d27',
                          border: '1px solid #6c5ce7',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ color: '#a1aec6', minWidth: '120px' }}>{item.nombre}</div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label style={{ color: '#a1aec6', fontSize: '0.85rem' }}>Cantidad:</label>
                          <input
                            type="number"
                            min="1"
                            max={item.cantidad_disponible}
                            value={item.cantidad_alquilada}
                            onChange={(e) =>
                              actualizarCantidadItem(item.inventario_id, parseInt(e.target.value))
                            }
                            style={{
                              width: '60px',
                              padding: '0.4rem',
                              background: '#0f1419',
                              color: '#fff',
                              border: '1px solid #3a4a5f',
                              borderRadius: '4px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ color: '#a1aec6', fontSize: '0.85rem' }}>de {item.cantidad_disponible}</span>
                        </div>
                        
                        <div style={{ textAlign: 'right', minWidth: '70px' }}>
                          <div style={{ color: '#a1aec6', fontSize: '0.85rem' }}>${item.valor_unitario}</div>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>${(item.cantidad_alquilada * item.valor_unitario).toFixed(2)}</div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => eliminarItem(item.inventario_id)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: '#c0392b',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RESUMEN DE PRECIO */}
            <div style={{ background: '#0f1419', padding: '1.5rem', borderRadius: '4px', marginBottom: '1.5rem', border: '1px solid #3a4a5f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Fecha:</span>
                <span style={{ color: '#fff' }}>{formatearFecha(formReserva.fecha_inicio)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Horario:</span>
                <span style={{ color: '#fff' }}>
                  {formReserva.tipo_alquiler === 'por_hora'
                    ? `${formReserva.hora_inicio} - ${formReserva.hora_fin}`
                    : `${config.hora_apertura} - ${config.hora_cierre}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Cantidad:</span>
                <span style={{ color: '#fff' }}>{formReserva.cantidad} {formReserva.tipo_alquiler === 'por_hora' ? 'horas' : 'días'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Valor Unitario:</span>
                <span style={{ color: '#fff' }}>
                  ${formReserva.tipo_alquiler === 'por_hora' ? config.valor_por_hora : config.valor_por_dia}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Subtotal Salón:</span>
                <span style={{ color: '#fff' }}>${precioEstimado.toFixed(2)}</span>
              </div>
              {precioItems > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#a1aec6' }}>Subtotal Items:</span>
                  <span style={{ color: '#fff' }}>${precioItems.toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #3a4a5f',
                  paddingTop: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                <span style={{ color: '#6c5ce7', fontWeight: 'bold' }}>TOTAL:</span>
                <span style={{ color: '#6c5ce7', fontSize: '1.2rem', fontWeight: 'bold' }}>${(precioEstimado + precioItems).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn-reunion btn-editar" style={{ flex: 1 }}>
                ✅ Confirmar Reserva
              </button>
              <button
                type="button"
                className="btn-reunion btn-cancelar-reunion"
                onClick={() => setShowFormReserva(false)}
                style={{ flex: 1 }}
              >
                ✕ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
