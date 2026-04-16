'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import '@/components/reuniones.css';

// Función para dibujar tablas manualmente en jsPDF con soporte multilínea
const drawTable = (doc: any, startY: number, headers: string[], rows: any[][], primaryColor: number[]) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const cellWidth = (pageWidth - 2 * margin) / headers.length;
  const padding = 2;
  const maxTextWidth = cellWidth - padding * 2;
  let yPos = startY;

  // Sanitizar caracteres no soportados por las fuentes normales (ej. flecha → por ->)
  const sanitize = (text: any) => String(text || '').replace(/→/g, '->');

  // Procesar encabezados
  const headerLinesArr = headers.map(header => doc.splitTextToSize(sanitize(header), maxTextWidth));
  const maxHeaderLines = Math.max(1, ...headerLinesArr.map((lines: any[]) => lines.length));
  const headerHeight = Math.max(10, maxHeaderLines * 5 + 4);

  // Dibujar encabezados
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  
  headers.forEach((_, i) => {
    doc.rect(margin + i * cellWidth, yPos, cellWidth, headerHeight, 'F');
    doc.text(headerLinesArr[i], margin + i * cellWidth + padding, yPos + 6);
  });

  yPos += headerHeight;

  // Dibujar filas
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  rows.forEach((row: any[]) => {
    // Primero, dividir el texto para calcular el alto necesario para cada celda
    const cellLines = row.map(cell => doc.splitTextToSize(sanitize(cell), maxTextWidth));
    const maxLines = Math.max(1, ...cellLines.map((lines: any[]) => lines.length));
    // 5 unidades por línea más algo de padding vertical
    const rowHeight = Math.max(10, maxLines * 5 + 4); 

    // Validar si necesitamos nueva página
    if (yPos + rowHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      
      // Volver a dibujar encabezados en página nueva
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      headers.forEach((_, i) => {
        doc.rect(margin + i * cellWidth, yPos, cellWidth, headerHeight, 'F');
        doc.text(headerLinesArr[i], margin + i * cellWidth + padding, yPos + 6);
      });
      yPos += headerHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }

    cellLines.forEach((lines: any[], colIndex: number) => {
      doc.rect(margin + colIndex * cellWidth, yPos, cellWidth, rowHeight);
      doc.text(lines, margin + colIndex * cellWidth + padding, yPos + 7);
    });
    
    yPos += rowHeight;
  });

  return yPos + 10;
};

interface InventarioItem {
  id: number;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  valor_unitario: number;
  valor_total: number;
  categoria: string;
  estado: string;
  es_alquilable: boolean;
  valor_alquiler: number;
  fecha_ingreso: string;
  fecha_actualizacion: string;
}

interface HistorialCambio {
  id: number;
  inventario_id: number;
  usuario_id: number;
  rol_id: number;
  tipo_cambio: string;
  cantidad_anterior: number;
  cantidad_nueva: number;
  valor_unitario_anterior: number;
  valor_unitario_nueva: number;
  estado_anterior: string;
  estado_nuevo: string;
  justificacion: string;
  observaciones: string;
  fecha_cambio: string;
}

interface Reporte {
  id: number;
  tipo_reporte: string;
  fecha_inicio: string;
  fecha_fin: string;
  generado_por: number;
  total_cambios: number;
  valor_inicial: number;
  valor_final: number;
  estado: string;
  fecha_generacion: string;
}

export default function TesoreroInventarioPage() {
  const [tab, setTab] = useState<'inventario' | 'historial' | 'reportes'>('inventario');
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [historial, setHistorial] = useState<HistorialCambio[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);

  // Cargar plugin autoTable cuando el componente monta
  useEffect(() => {
    // Plugin ya no es necesario - usamos función manual
  }, []);

  const [showFormNuevo, setShowFormNuevo] = useState(false);
  const [itemEditando, setItemEditando] = useState<InventarioItem | null>(null);
  const [showFormEditar, setShowFormEditar] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    cantidad: 0,
    unidad: 'unidades',
    valor_unitario: 0,
    categoria: '',
    es_alquilable: false,
    valor_alquiler: 0,
  });

  const [formEditar, setFormEditar] = useState({
    cantidad: 0,
    valor_unitario: 0,
    estado: 'activo',
    justificacion: '',
    observaciones: '',
  });

  // Cargar datos
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) return;

      const user = JSON.parse(storedUser);
      setUsuario(user);

      // Cargar inventario
      const { data: inventarioData, error: inventarioError } = await supabase
        .from('komerizo_inventario')
        .select('*')
        .eq('estado', 'activo')
        .order('categoria');

      if (inventarioError) throw inventarioError;
      setInventario(inventarioData || []);

      // Cargar historial (últimos 50)
      const { data: historialData, error: historialError } = await supabase
        .from('komerizo_inventario_historial')
        .select('*')
        .order('fecha_cambio', { ascending: false })
        .limit(50);

      if (historialError) throw historialError;
      setHistorial(historialData || []);

      // Cargar reportes
      const { data: reportesData, error: reportesError } = await supabase
        .from('komerizo_inventario_reportes')
        .select('*')
        .order('fecha_generacion', { ascending: false });

      if (reportesError) throw reportesError;
      setReportes(reportesData || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Crear nuevo item
  const handleCrearItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim() || formData.cantidad <= 0) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    try {
      const { data: newItem, error: createError } = await supabase
        .from('komerizo_inventario')
        .insert([
          {
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            cantidad: formData.cantidad,
            unidad: formData.unidad,
            valor_unitario: formData.valor_unitario,
            categoria: formData.categoria,
            es_alquilable: formData.es_alquilable,
            valor_alquiler: formData.es_alquilable ? formData.valor_alquiler : 0,
            estado: 'activo',
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      // Registrar en historial
      await supabase.from('komerizo_inventario_historial').insert([
        {
          inventario_id: newItem.id,
          usuario_id: usuario.id,
          rol_id: 2, // Tesorero ID
          tipo_cambio: 'creacion',
          cantidad_nueva: formData.cantidad,
          valor_unitario_nueva: formData.valor_unitario,
          estado_nuevo: 'activo',
          justificacion: 'Ingreso inicial al inventario',
        },
      ]);

      alert('Item creado exitosamente');
      setFormData({ nombre: '', descripcion: '', cantidad: 0, unidad: 'unidades', valor_unitario: 0, categoria: '', es_alquilable: false, valor_alquiler: 0 });
      setShowFormNuevo(false);
      await loadData();
    } catch (error) {
      console.error('Error creando item:', error);
      alert('Error al crear el item');
    }
  };

  // Editar item
  const handleEditarItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemEditando || !formEditar.justificacion.trim()) {
      alert('La justificación es obligatoria');
      return;
    }

    try {
      // Registrar en historial PRIMERO
      await supabase.from('komerizo_inventario_historial').insert([
        {
          inventario_id: itemEditando.id,
          usuario_id: usuario.id,
          rol_id: 2, // Tesorero
          tipo_cambio: 'modificacion',
          cantidad_anterior: itemEditando.cantidad,
          cantidad_nueva: formEditar.cantidad,
          valor_unitario_anterior: itemEditando.valor_unitario,
          valor_unitario_nueva: formEditar.valor_unitario,
          estado_anterior: itemEditando.estado,
          estado_nuevo: formEditar.estado,
          justificacion: formEditar.justificacion,
          observaciones: formEditar.observaciones,
        },
      ]);

      // Actualizar inventario
      const { error: updateError } = await supabase
        .from('komerizo_inventario')
        .update({
          cantidad: formEditar.cantidad,
          valor_unitario: formEditar.valor_unitario,
          estado: formEditar.estado,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', itemEditando.id);

      if (updateError) throw updateError;

      alert('Item actualizado exitosamente');
      setItemEditando(null);
      setShowFormEditar(false);
      await loadData();
    } catch (error) {
      console.error('Error editando item:', error);
      alert('Error al actualizar el item');
    }
  };

  // Generar reporte
  const handleGenerarReporte = async (tipoReporte: 'bimestral' | 'cuatrimestral') => {
    try {
      const hoy = new Date();
      const dias = tipoReporte === 'bimestral' ? 60 : 120;
      const fechaInicio = new Date(hoy.getTime() - dias * 24 * 60 * 60 * 1000);

      // Obtener cambios en el período
      const { data: cambios, error: cambiosError } = await supabase
        .from('komerizo_inventario_historial')
        .select('*')
        .gte('fecha_cambio', fechaInicio.toISOString())
        .lte('fecha_cambio', hoy.toISOString());

      if (cambiosError) throw cambiosError;

      // Calcular valores
      const inventarioTotal = inventario.reduce((sum, item) => sum + (item.valor_total || 0), 0);

      // Crear reporte
      const { error: reporteError } = await supabase.from('komerizo_inventario_reportes').insert([
        {
          tipo_reporte: tipoReporte,
          fecha_inicio: fechaInicio.toISOString(),
          fecha_fin: hoy.toISOString(),
          generado_por: usuario.id,
          total_cambios: cambios?.length || 0,
          valor_final: inventarioTotal,
          estado: 'generado',
          detalles: JSON.stringify({ cambios: cambios || [] }),
        },
      ]);

      if (reporteError) throw reporteError;

      alert(`Reporte ${tipoReporte} generado exitosamente`);
      await loadData();
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al generar el reporte');
    }
  };

  // Descargar reporte como PDF
  const handleDescargarPDF = async (reporte: Reporte) => {
    try {
      console.log('📥 Iniciando descarga de PDF...');
      console.log('Inventario disponible:', inventario);
      console.log('Reporte:', reporte);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Color principal
      const primaryColor = [108, 92, 231]; // #6c5ce7

      console.log('✅ jsPDF inicializado');
      
      // Verificar que autoTable está disponible
      if (!(inventario && inventario.length > 0)) {
        console.warn('⚠️ No hay inventario disponible');
        doc.setFontSize(16);
        doc.text('Reporte de Inventario', 20, 20);
        doc.setFontSize(10);
        doc.text('No hay datos de inventario para mostrar.', 20, 40);
        doc.save(`Reporte_Inventario.pdf`);
        return;
      }

      // Título
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Reporte de Inventario ${reporte.tipo_reporte.toUpperCase()}`, pageWidth / 2, yPosition, {
        align: 'center',
      });

      yPosition += 15;

      // Información general
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Período: ${new Date(reporte.fecha_inicio).toLocaleDateString('es-ES')} - ${new Date(reporte.fecha_fin).toLocaleDateString('es-ES')}`, 20, yPosition);
      yPosition += 8;

      doc.text(`Fecha de Generación: ${new Date(reporte.fecha_generacion).toLocaleString('es-ES')}`, 20, yPosition);
      yPosition += 8;

      doc.text(`Estado: ${reporte.estado}`, 20, yPosition);
      yPosition += 15;

      console.log('✅ Información general agregada');

      // ===== SECCIÓN 1: INVENTARIO ACTUAL =====
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Inventario Actual', 20, yPosition);
      yPosition += 10;

      console.log('📦 Creando tabla de inventario. Items:', inventario.length);

      // Tabla de inventario
      if (inventario && inventario.length > 0) {
        const inventarioTableData = inventario.map((item) => [
          item.nombre,
          item.categoria,
          `${item.cantidad} ${item.unidad}`,
          `$${item.valor_unitario.toFixed(2)}`,
          `$${(item.valor_total || 0).toFixed(2)}`,
        ]);

        console.log('Datos de tabla de inventario:', inventarioTableData);

        yPosition = drawTable(
          doc,
          yPosition,
          ['Nombre', 'Categoría', 'Cantidad', 'Valor Unit.', 'Valor Total'],
          inventarioTableData,
          primaryColor
        );

        console.log('✅ Tabla de inventario creada');

        // Resumen de inventario
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        const totalInventario = inventario.reduce((sum, item) => sum + (item.valor_total || 0), 0);
        doc.text(`Total Items: ${inventario.length}`, 20, yPosition);
        yPosition += 7;
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(12);
        doc.text(
          `Valor Total: $${totalInventario.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          20,
          yPosition
        );
        yPosition += 15;
      } else {
        console.warn('⚠️ No hay items en inventario');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('No hay items en inventario', 20, yPosition);
        yPosition += 15;
      }

      // ===== SECCIÓN 2: RESUMEN FINANCIERO =====
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Resumen del Período', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Valor Total del Inventario: $${reporte.valor_final?.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        20,
        yPosition
      );
      yPosition += 8;

      doc.text(`Total de Cambios Registrados: ${reporte.total_cambios}`, 20, yPosition);
      yPosition += 15;

      console.log('Resumen financiero agregado');

      // ===== SECCIÓN 3: DETALLE DE CAMBIOS =====
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Detalle de Cambios Registrados', 20, yPosition);
      yPosition += 10;

      if ((reporte as any).detalles) {
        try {
          console.log('Detalles del reporte:', (reporte as any).detalles);
          const detalles = JSON.parse((reporte as any).detalles);
          const cambios = detalles.cambios || [];

          console.log('Cambios parseados:', cambios.length);

          if (cambios.length > 0) {
            // Crear tabla detallada de cambios
            const tableData = cambios.map((cambio: any) => {
              let detalle = '';

              if (cambio.cantidad_anterior !== cambio.cantidad_nueva) {
                detalle += `Cant: ${cambio.cantidad_anterior} -> ${cambio.cantidad_nueva}\n`;
              }

              if (cambio.valor_unitario_anterior !== cambio.valor_unitario_nueva) {
                detalle += `Valor: $${cambio.valor_unitario_anterior} -> $${cambio.valor_unitario_nueva}\n`;
              }

              if (cambio.estado_anterior !== cambio.estado_nuevo) {
                detalle += `Estado: ${cambio.estado_anterior} -> ${cambio.estado_nuevo}`;
              }

              return [
                new Date(cambio.fecha_cambio).toLocaleDateString('es-ES'),
                cambio.tipo_cambio,
                detalle || 'Creación inicial',
                cambio.justificacion?.substring(0, 25) + (cambio.justificacion?.length > 25 ? '...' : ''),
              ];
            });

            console.log('Datos de tabla de cambios:', tableData);

            yPosition = drawTable(
              doc,
              yPosition,
              ['Fecha', 'Tipo', 'Cambios', 'Justificación'],
              tableData,
              primaryColor
            );

            console.log('✅ Tabla de cambios creada');

            // Mostrar justificaciones completas si hay espacio
            if (cambios.length <= 5) {
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);

              cambios.forEach((cambio: any, index: number) => {
                // Agregar nueva página si es necesario
                if (yPosition > pageHeight - 40) {
                  console.log('📄 Agregando nueva página');
                  doc.addPage();
                  yPosition = 20;
                }

                doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.setFontSize(10);
                doc.text(`Cambio #${index + 1} - ${new Date(cambio.fecha_cambio).toLocaleDateString('es-ES')}`, 20, yPosition);
                yPosition += 6;

                doc.setTextColor(0, 0, 0);
                doc.setFontSize(9);

                // Resumen de cambios
                if (cambio.cantidad_anterior !== cambio.cantidad_nueva) {
                  doc.text(`  • Cantidad: ${cambio.cantidad_anterior} → ${cambio.cantidad_nueva}`, 25, yPosition);
                  yPosition += 5;
                }

                if (cambio.valor_unitario_anterior !== cambio.valor_unitario_nueva) {
                  doc.text(`  • Valor Unitario: $${cambio.valor_unitario_anterior} → $${cambio.valor_unitario_nueva}`, 25, yPosition);
                  yPosition += 5;
                }

                if (cambio.estado_anterior !== cambio.estado_nuevo) {
                  doc.text(`  • Estado: ${cambio.estado_anterior} → ${cambio.estado_nuevo}`, 25, yPosition);
                  yPosition += 5;
                }

                // Justificación
                doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                doc.text('Justificación:', 25, yPosition);
                yPosition += 4;

                doc.setTextColor(0, 0, 0);
                const splitJustificacion = doc.splitTextToSize(cambio.justificacion || '', 160);
                doc.text(splitJustificacion, 28, yPosition);
                yPosition += splitJustificacion.length * 4 + 8;
              });
            }
          } else {
            console.warn('⚠️ No hay cambios en este período');
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text('No hay cambios registrados en este período', 20, yPosition);
          }
        } catch (e) {
          console.error('❌ Error parseando detalles:', e);
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text('Error al cargar detalles de cambios', 20, yPosition);
        }
      } else {
        console.warn('⚠️ No hay detalles en el reporte');
      }

      // Pie de página
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      console.log('✅ PDF generado con', totalPages, 'páginas');

      // Descargar
      const nombreArchivo = `Reporte_Inventario_${reporte.tipo_reporte}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(nombreArchivo);

      console.log('✅ PDF descargado:', nombreArchivo);
      alert('PDF descargado exitosamente');
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      console.error('Stack trace:', (error as any)?.stack);
      alert(`Error al descargar el PDF: ${(error as any)?.message || 'Error desconocido'}`);
    }
  };

  if (loading) {
    return (
      <div className="reuniones-container">
        <div className="reuniones-loading">Cargando inventario...</div>
      </div>
    );
  }

  const totalInventario = inventario.reduce((sum, item) => sum + (item.valor_total || 0), 0);

  return (
    <div className="reuniones-container">
      <div className="reuniones-header">
        <div>
          <h1>📦 Inventario</h1>
          <p className="header-subtitle">Gestión de inventario con historial de cambios</p>
        </div>
        <button className="btn-nueva-reunion" onClick={() => setShowFormNuevo(true)}>
          ➕ Nuevo Item
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #3a4a5f' }}>
        <button
          onClick={() => setTab('inventario')}
          style={{
            padding: '0.75rem 1.5rem',
            background: tab === 'inventario' ? '#6c5ce7' : 'transparent',
            color: tab === 'inventario' ? '#fff' : '#a1aec6',
            border: 'none',
            borderBottom: tab === 'inventario' ? '2px solid #6c5ce7' : 'transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          📦 Inventario Actual
        </button>
        <button
          onClick={() => setTab('historial')}
          style={{
            padding: '0.75rem 1.5rem',
            background: tab === 'historial' ? '#6c5ce7' : 'transparent',
            color: tab === 'historial' ? '#fff' : '#a1aec6',
            border: 'none',
            borderBottom: tab === 'historial' ? '2px solid #6c5ce7' : 'transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          📋 Historial de Cambios
        </button>
        <button
          onClick={() => setTab('reportes')}
          style={{
            padding: '0.75rem 1.5rem',
            background: tab === 'reportes' ? '#6c5ce7' : 'transparent',
            color: tab === 'reportes' ? '#fff' : '#a1aec6',
            border: 'none',
            borderBottom: tab === 'reportes' ? '2px solid #6c5ce7' : 'transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          📊 Reportes Programados
        </button>
      </div>

      {/* FORMULARIO NUEVO ITEM */}
      {showFormNuevo && (
        <div
          style={{
            background: '#1e2a3a',
            padding: '2rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            border: '1px solid #3a4a5f',
          }}
        >
          <h3 style={{ marginBottom: '1.5rem' }}>Nuevo Item de Inventario</h3>
          <form onSubmit={handleCrearItem}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Nombre *:</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Categoría *:</label>
                <input
                  type="text"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ej: Equipos, Materiales"
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

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Descripción:</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Cantidad *:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cantidad}
                  onChange={(e) => setFormData({ ...formData, cantidad: parseFloat(e.target.value) })}
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Unidad:</label>
                <input
                  type="text"
                  value={formData.unidad}
                  onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                  placeholder="kg, litros, etc"
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Valor Unitario:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => setFormData({ ...formData, valor_unitario: parseFloat(e.target.value) })}
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="checkbox"
                  checked={formData.es_alquilable}
                  onChange={(e) => setFormData({ ...formData, es_alquilable: e.target.checked })}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                  }}
                />
                <label style={{ color: '#a1aec6', cursor: 'pointer' }}>¿Es alquilable?</label>
              </div>
              {formData.es_alquilable && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Valor del Alquiler:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_alquiler}
                    onChange={(e) => setFormData({ ...formData, valor_alquiler: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f1419',
                      color: '#fff',
                      border: '1px solid #3a4a5f',
                      borderRadius: '4px',
                    }}
                    placeholder="Ej: 50000"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn-reunion btn-editar" style={{ flex: 1 }}>
                Crear Item
              </button>
              <button
                type="button"
                className="btn-reunion btn-cancelar-reunion"
                onClick={() => setShowFormNuevo(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB INVENTARIO ACTUAL */}
      {tab === 'inventario' && (
        <div>
          <div
            style={{
              background: '#1e2a3a',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '2rem',
              border: '1px solid #3a4a5f',
            }}
          >
            <h3 style={{ marginBottom: '0.5rem' }}>Valor Total del Inventario</h3>
            <p style={{ fontSize: '1.5rem', color: '#6c5ce7', fontWeight: 'bold' }}>
              ${totalInventario.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#a1aec6', marginTop: '0.5rem' }}>
              {inventario.length} items en inventario
            </p>
          </div>

          <div className="reuniones-grid">
            {inventario.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No hay items en inventario</h3>
              </div>
            ) : (
              inventario.map((item) => (
                <div key={item.id} className="reunion-card">
                  <div className="reunion-header">
                    <div style={{ flex: 1 }}>
                      <h3 className="reunion-titulo">{item.nombre}</h3>
                      <span className="reunion-tipo">{item.categoria}</span>
                    </div>
                    <span className={`estado-badge ${item.estado}`}>{item.estado.toUpperCase()}</span>
                  </div>

                  <div className="reunion-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📊</span>
                      {item.cantidad} {item.unidad}
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">💰</span>${item.valor_unitario}
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">🔢</span>${item.valor_total?.toFixed(2)}
                    </div>
                    {item.es_alquilable && (
                      <div className="meta-item">
                        <span className="meta-icon">🏪</span>Alquiler: ${item.valor_alquiler}
                      </div>
                    )}
                  </div>

                  {item.descripcion && <div className="reunion-descripcion">{item.descripcion}</div>}

                  <div style={{ marginTop: '1rem', color: '#a1aec6', fontSize: '0.8rem' }}>
                    Actualizado: {new Date(item.fecha_actualizacion).toLocaleDateString('es-ES')}
                  </div>

                  <div className="reunion-acciones">
                    <button
                      className="btn-reunion btn-editar"
                      onClick={() => {
                        setItemEditando(item);
                        setFormEditar({
                          cantidad: item.cantidad,
                          valor_unitario: item.valor_unitario,
                          estado: item.estado,
                          justificacion: '',
                          observaciones: '',
                        });
                        setShowFormEditar(true);
                      }}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FORMULARIO EDITAR */}
      {showFormEditar && itemEditando && (
        <div
          style={{
            background: '#1e2a3a',
            padding: '2rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            border: '1px solid #3a4a5f',
          }}
        >
          <h3 style={{ marginBottom: '1.5rem' }}>Editar: {itemEditando.nombre}</h3>
          <form onSubmit={handleEditarItem}>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0f1419', borderRadius: '4px' }}>
              <h4 style={{ color: '#a1aec6', marginBottom: '0.5rem' }}>Valores Actuales</h4>
              <p>Cantidad: {itemEditando.cantidad} {itemEditando.unidad}</p>
              <p>Valor Unitario: ${itemEditando.valor_unitario}</p>
              <p>Estado: {itemEditando.estado}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Nueva Cantidad *:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formEditar.cantidad}
                  onChange={(e) => setFormEditar({ ...formEditar, cantidad: parseFloat(e.target.value) })}
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
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Nuevo Valor Unitario *:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formEditar.valor_unitario}
                  onChange={(e) => setFormEditar({ ...formEditar, valor_unitario: parseFloat(e.target.value) })}
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

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Estado:</label>
              <select
                value={formEditar.estado}
                onChange={(e) => setFormEditar({ ...formEditar, estado: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                }}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="dañado">Dañado</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Justificación *:</label>
              <textarea
                value={formEditar.justificacion}
                onChange={(e) => setFormEditar({ ...formEditar, justificacion: e.target.value })}
                placeholder="¿Por qué se realiza este cambio?"
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Observaciones:</label>
              <textarea
                value={formEditar.observaciones}
                onChange={(e) => setFormEditar({ ...formEditar, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn-reunion btn-editar" style={{ flex: 1 }}>
                Guardar Cambios
              </button>
              <button
                type="button"
                className="btn-reunion btn-cancelar-reunion"
                onClick={() => {
                  setShowFormEditar(false);
                  setItemEditando(null);
                }}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB HISTORIAL */}
      {tab === 'historial' && (
        <div className="reuniones-grid">
          {historial.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No hay cambios registrados</h3>
            </div>
          ) : (
            historial.map((cambio) => (
              <div key={cambio.id} className="reunion-card">
                <div className="reunion-header">
                  <div style={{ flex: 1 }}>
                    <h3 className="reunion-titulo">Cambio #{cambio.id}</h3>
                    <span className="reunion-tipo">{cambio.tipo_cambio}</span>
                  </div>
                  <span className="estado-badge confirmada">{new Date(cambio.fecha_cambio).toLocaleDateString()}</span>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <div style={{ color: '#a1aec6', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                    📝 Cambios Registrados:
                  </div>

                  {cambio.cantidad_anterior !== cambio.cantidad_nueva && (
                    <div
                      style={{
                        background: '#0f1419',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                      }}
                    >
                      <strong>Cantidad:</strong> {cambio.cantidad_anterior} → {cambio.cantidad_nueva}
                    </div>
                  )}

                  {cambio.valor_unitario_anterior !== cambio.valor_unitario_nueva && (
                    <div
                      style={{
                        background: '#0f1419',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                      }}
                    >
                      <strong>Valor Unitario:</strong> ${cambio.valor_unitario_anterior} → ${cambio.valor_unitario_nueva}
                    </div>
                  )}

                  {cambio.estado_anterior !== cambio.estado_nuevo && (
                    <div
                      style={{
                        background: '#0f1419',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                      }}
                    >
                      <strong>Estado:</strong> {cambio.estado_anterior} → {cambio.estado_nuevo}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3a4a5f' }}>
                  <div style={{ color: '#a1aec6', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    💬 Justificación:
                  </div>
                  <p style={{ fontSize: '0.9rem', margin: 0 }}>{cambio.justificacion}</p>

                  {cambio.observaciones && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#a1aec6' }}>
                      Nota: {cambio.observaciones}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6c7a8f' }}>
                  {new Date(cambio.fecha_cambio).toLocaleString('es-ES')}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB REPORTES */}
      {tab === 'reportes' && (
        <div>
          <div
            style={{
              background: '#1e2a3a',
              padding: '2rem',
              borderRadius: '8px',
              marginBottom: '2rem',
              border: '1px solid #3a4a5f',
            }}
          >
            <h3 style={{ marginBottom: '1.5rem' }}>Generar Reportes Programados</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                className="btn-reunion btn-editar"
                onClick={() => handleGenerarReporte('bimestral')}
                style={{ padding: '1rem' }}
              >
                📊 Generar Reporte Bimestral (60 días)
              </button>
              <button
                className="btn-reunion btn-editar"
                onClick={() => handleGenerarReporte('cuatrimestral')}
                style={{ padding: '1rem' }}
              >
                📊 Generar Reporte Cuatrimestral (120 días)
              </button>
            </div>
          </div>

          <div className="reuniones-grid">
            {reportes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>No hay reportes generados</h3>
              </div>
            ) : (
              reportes.map((reporte) => (
                <div key={reporte.id} className="reunion-card">
                  <div className="reunion-header">
                    <div style={{ flex: 1 }}>
                      <h3 className="reunion-titulo">{reporte.tipo_reporte.toUpperCase()}</h3>
                      <span className="reunion-tipo">{reporte.total_cambios} cambios registrados</span>
                    </div>
                    <span className="estado-badge confirmada">{reporte.estado}</span>
                  </div>

                  <div className="reunion-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📅</span>
                      {new Date(reporte.fecha_inicio).toLocaleDateString('es-ES')} -{' '}
                      {new Date(reporte.fecha_fin).toLocaleDateString('es-ES')}
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">💰</span>${reporte.valor_final?.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#a1aec6' }}>
                    Generado: {new Date(reporte.fecha_generacion).toLocaleString('es-ES')}
                  </div>

                  <div className="reunion-acciones">
                    <button
                      className="btn-reunion btn-editar"
                      onClick={() => handleDescargarPDF(reporte)}
                    >
                      📥 Descargar PDF
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
