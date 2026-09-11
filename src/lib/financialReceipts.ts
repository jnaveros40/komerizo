/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from 'jspdf'

const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(value) || 0)

const addHeader = (pdf: jsPDF, title: string) => {
  pdf.setFontSize(18)
  pdf.text('komirezo', 20, 22)
  pdf.setFontSize(11)
  pdf.text('Junta de Acción Comunal', 20, 30)
  pdf.setFontSize(15)
  pdf.text(title, 20, 44)
}

const addRows = (pdf: jsPDF, rows: Array<[string, string]>, start = 58) => {
  pdf.setFontSize(10)
  let y = start
  rows.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${label}:`, 20, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(String(value ?? '-'), 75, y)
    y += 8
  })
  return y
}

const fullName = (data: any) => data.nombre_comprador || data.renter || `${data.nombres || ''} ${data.apellidos || ''}`.trim() || '-'
const dateRange = (data: any) => data.fecha_fin && data.fecha_fin !== data.fecha_inicio ? `${data.fecha_inicio} - ${data.fecha_fin}` : data.fecha_inicio || '-'

export function downloadTreasuryReceipt(data: any) {
  const pdf = new jsPDF()
  addHeader(pdf, 'RECIBO DE PAGO')
  addRows(pdf, [
    ['Número de movimiento', `#${data.id ?? data.movimiento_id ?? '-'}`],
    ['Fecha', data.fecha_movimiento || data.fecha || data.created_at || '-'],
    ['Concepto', data.descripcion || data.concepto || '-'],
    ['Pagador', data.pagador || data.nombre_persona || data.renter || '-'],
    ['Documento', data.documento || data.numero_documento || '-'],
    ['Monto', money(data.cantidad ?? data.monto)],
    ['Método de pago', data.metodo_pago || '-'],
    ['Referencia', data.referencia_externa || data.referencia || '-'],
    ['Responsable/Tesorero', data.responsable || data.tesorero || '-'],
    ...(data.deposito_garantia ? [['Depósito de garantía', money(data.deposito_garantia)] as [string, string]] : []),
  ])
  pdf.save(`recibo-tesoreria-${data.id ?? data.movimiento_id ?? 'pago'}.pdf`)
}

export function downloadRentalVoucher(data: any) {
  const pdf = new jsPDF()
  addHeader(pdf, 'COMPROBANTE DE ALQUILER / RESERVA')
  let y = addRows(pdf, [
    ['Número de alquiler', `#${data.id ?? '-'}`],
    ['Arrendatario', fullName(data)],
    ['Documento', data.numero_documento || '-'],
    ['Contacto', [data.celular, data.correo].filter(Boolean).join(' · ') || '-'],
    ['Fecha de inicio', data.fecha_inicio || '-'],
    ['Fecha de fin', data.fecha_fin || '-'],
    ['Valor del alquiler', money(data.valor_alquiler ?? data.valor_total)],
    ['Depósito de garantía', money(data.deposito_garantia)],
    ['Estado del pago', data.estado_pago || '-'],
  ])
  pdf.setFont('helvetica', 'bold')
  pdf.text('Recursos', 20, y + 2)
  pdf.setFont('helvetica', 'normal')
  y += 10
    ; (data.items || []).forEach((item: any) => {
      const name = item.nombre || item.komerizo_inventario?.nombre || item.inventario?.nombre || 'Recurso'
      pdf.text(`${name} · ${item.cantidad_alquilada ?? item.cantidad ?? 0} · ${money(item.valor_total)}`, 25, y)
      y += 7
    })
  y += 6
  pdf.setFont('helvetica', 'bold')
  pdf.text('Cláusulas de uso', 20, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(pdf.splitTextToSize(String(data.clausulas_uso || ''), 170), 20, y + 8)
  pdf.save(`comprobante-alquiler-${data.id ?? 'reserva'}.pdf`)
}

export function downloadSalonReservationVoucher(data: any) {
  const pdf = new jsPDF()
  addHeader(pdf, 'COMPROBANTE DE RESERVA DEL SALÓN')
  let y = addRows(pdf, [
    ['Número de reserva', `#${data.id ?? '-'}`],
    ['Fecha(s)', dateRange(data)],
    ['Horario', `${data.hora_inicio || '-'} - ${data.hora_fin || '-'}`],
    ['Tipo de alquiler', data.tipo_alquiler === 'por_dia' ? 'Por día' : 'Por hora'],
    ['Motivo', data.motivo || '-'],
    ['Valor total', money(data.valor_total)],
    ['Estado del pago', data.estado_pago || 'pendiente'],
  ])
  pdf.setFont('helvetica', 'bold')
  pdf.text('Recursos adicionales', 20, y + 2)
  pdf.setFont('helvetica', 'normal')
  y += 10
    ; (data.items || data.komerizo_alquiler_items || []).forEach((item: any) => {
      const name = item.nombre || item.komerizo_inventario?.nombre || item.inventario?.nombre || 'Recurso'
      pdf.text(`${name} · ${item.cantidad_alquilada ?? item.cantidad ?? 0} · ${money(item.valor_total)}`, 25, y)
      y += 7
    })
  y += 12
  pdf.setFont('helvetica', 'bold')
  pdf.text(pdf.splitTextToSize('ESTE DOCUMENTO ES UN COMPROBANTE DE RESERVA. NO REPRESENTA UN RECIBO DE PAGO.', 170), 20, y)
  pdf.save(`comprobante-reserva-salon-${data.id ?? 'reserva'}.pdf`)
}

export function downloadSalonInternalVoucher(data: any) {
  const pdf = new jsPDF()
  addHeader(pdf, 'COMPROBANTE DE CONSUMO INTERNO')
  addRows(pdf, [
    ['Número de reserva', `#${data.id ?? '-'}`],
    ['Fecha(s)', dateRange(data)],
    ['Horario', `${data.hora_inicio || '-'} - ${data.hora_fin || '-'}`],
    ['Motivo', data.motivo || '-'],
    ['Valor', '$0'],
    ['Estado', 'EXONERADO / CONSUMO INTERNO'],
  ])
  pdf.save(`comprobante-consumo-interno-${data.id ?? 'reserva'}.pdf`)
}

type ProductVoucherType = 'pago' | 'reserva' | 'pendiente_pago'

export function downloadProductSaleVoucher(data: any, type: ProductVoucherType) {
  if (!['pago', 'reserva', 'pendiente_pago'].includes(type)) return
  const titles: Record<ProductVoucherType, string> = { pago: 'COMPROBANTE DE PAGO', reserva: 'COMPROBANTE DE RESERVA', pendiente_pago: 'COMPROBANTE PENDIENTE DE PAGO' }
  const states: Record<ProductVoucherType, string> = { pago: 'Pagada', reserva: 'Reservada', pendiente_pago: 'Pendiente de pago' }
  const pdf = new jsPDF()
  addHeader(pdf, titles[type])
  let y = addRows(pdf, [
    ['Número de venta', `#${data.id ?? '-'}`],
    ['Actividad', data.actividad_nombre || data.actividad?.nombre || '-'],
    ['Producto', data.producto_nombre || data.actividad?.producto_nombre || '-'],
    ['Fecha de entrega', data.fecha_entrega || data.actividad?.fecha_entrega || '-'],
    ['Comprador', data.nombre_comprador || '-'],
    ['Documento', data.numero_documento || '-'],
    ['Cantidad', String(data.cantidad ?? '-')],
    ['Valor unitario', money(data.precio_unitario)],
    ['Valor total', money(data.total ?? Number(data.cantidad || 0) * Number(data.precio_unitario || 0))],
    ['Fecha', data.fecha_pago || data.fecha_registro || data.created_at || '-'],
    ['Estado', states[type]],
  ])
  if (type === 'pago') {
    y = addRows(pdf, [['Método de pago', data.metodo_pago || '-'], ['Número de movimiento de tesorería', `#${data.tesoreria_movimiento_id ?? '-'}`]], y + 4)
  }
  const footer = type === 'pago' ? 'VÁLIDO PARA RECLAMAR EL PRODUCTO.' : type === 'reserva' ? 'NO VÁLIDO PARA RECLAMAR EL PRODUCTO.' : 'PENDIENTE DE PAGO - VÁLIDO PARA RECLAMAR EL PRODUCTO.'
  pdf.setFont('helvetica', 'bold')
  pdf.text(pdf.splitTextToSize(footer, 170), 20, y + 14)
  pdf.save(`comprobante-venta-${data.id ?? 'producto'}-${type}.pdf`)
}

export function downloadProductSalesReport(activity: any) {
  const summary = activity?.resumen_cierre || {}
  const pdf = new jsPDF()
  addHeader(pdf, 'REPORTE DE ACTIVIDAD DE VENTA')
  addRows(pdf, [
    ['Actividad', activity?.nombre || '-'],
    ['Producto', activity?.producto_nombre || '-'],
    ['Fecha de entrega', activity?.fecha_entrega || '-'],
    ['Fecha de cierre', activity?.fecha_cierre || '-'],
    ['Cantidad inicial', String(summary.cantidad_inicial ?? activity?.cantidad_inicial ?? 0)],
    ['Unidades pagadas', String(summary.unidades_pagadas ?? 0)],
    ['Unidades pendientes de pago', String(summary.unidades_pendientes_pago ?? 0)],
    ['Unidades reservadas no reportadas', String(summary.unidades_reservadas_no_reportadas ?? 0)],
    ['Unidades canceladas', String(summary.unidades_canceladas ?? 0)],
    ['Unidades sin asignar', String(summary.unidades_sin_asignar ?? 0)],
    ['Ingresos pagados', money(summary.ingresos_pagados)],
    ['Cartera pendiente', money(summary.cartera_pendiente)],
    ['Valor de pérdidas por reservas', money(summary.valor_perdida_reservas ?? summary.valor_reservas_no_reportadas)],
    ['Egresos asociados', money(summary.egresos_asociados)],
    ['Resultado de caja', money(summary.resultado_caja)],
  ])
  pdf.save(`reporte-actividad-venta-${activity?.id ?? 'actividad'}.pdf`)
}

type BonusVoucherType = 'pago' | 'reserva'

export function downloadBonusVoucher(data: any, type: BonusVoucherType) {
  const pdf = new jsPDF()
  const bonoNombre = data.bono_nombre ?? data.bono?.nombre ?? data.komerizo_bonos_solidarios?.nombre ?? '-'
  addHeader(pdf, type === 'pago' ? 'COMPROBANTE DE PAGO - BONO SOLIDARIO' : 'COMPROBANTE DE RESERVA - BONO SOLIDARIO')
  let y = addRows(pdf, [
    ['Número de compra', `#${data.id ?? '-'}`],
    ['Bono solidario', bonoNombre],
    ['Comprador', data.nombre_comprador || '-'],
    ['Documento', data.numero_documento || '-'],
    ['Puestos', Array.isArray(data.puestos) ? data.puestos.join(', ') : '-'],
    ['Cantidad de puestos', String(data.cantidad_puestos ?? '-')],
    ['Valor unitario', money(data.valor_unitario)],
    ['Valor total', money(data.total)],
    ['Fecha', data.fecha_pago || data.fecha_registro || data.created_at || '-'],
    ['Estado', type === 'pago' ? 'Pagado' : 'Reservado'],
  ])
  if (type === 'pago') {
    y = addRows(pdf, [['Método de pago', data.metodo_pago || '-'], ['Movimiento de tesorería', `#${data.tesoreria_movimiento_id ?? '-'}`]], y + 4)
  }
  pdf.setFont('helvetica', 'bold')
  const footer = type === 'pago' ? 'VÁLIDO PARA PARTICIPAR EN EL BONO SOLIDARIO.' : 'NO VÁLIDO PARA PARTICIPAR HASTA REALIZAR EL PAGO.'
  pdf.text(pdf.splitTextToSize(footer, 170), 20, y + 14)
  pdf.save(`comprobante-bono-${data.id ?? 'compra'}-${type}.pdf`)
}

export function downloadBonusReport(bono: any) {
  const summary = bono?.resumen_cierre || {}
  const pdf = new jsPDF()
  addHeader(pdf, 'REPORTE DE BONO SOLIDARIO')
  addRows(pdf, [
    ['Nombre', bono?.nombre || '-'],
    ['Fecha de actividad', bono?.fecha_actividad || '-'],
    ['Fecha de cierre', bono?.fecha_cierre || '-'],
    ['Puestos totales', String(summary.puestos_totales ?? 0)],
    ['Puestos pagados', String(summary.puestos_pagados ?? 0)],
    ['Puestos reservados sin pagar', String(summary.puestos_reservados_no_pagados ?? 0)],
    ['Puestos disponibles', String(summary.puestos_disponibles ?? 0)],
    ['Compras pagadas', String(summary.compras_pagadas ?? 0)],
    ['Compras reservadas', String(summary.compras_reservadas ?? 0)],
    ['Compras canceladas', String(summary.compras_canceladas ?? 0)],
    ['Ingresos por puestos pagados', money(summary.ingresos_ventas_pagadas)],
    ['Puesto ganador', String(summary.puesto_ganador ?? '-')],
    ['Resultado del premio', summary.resultado_premio || '-'],
    ['Valor del premio', money(summary.valor_premio)],
    ['Ingreso por premio no entregado', money(summary.ingreso_premio_no_entregado)],
    ['Ingresos totales para la Junta', money(summary.ingresos_totales_junta)],
  ])
  pdf.save(`reporte-bono-${bono?.id ?? 'bono'}.pdf`)
}
