/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)
const header = (pdf: jsPDF, title: string) => { pdf.setFontSize(18); pdf.text('Komerizo', 20, 20); pdf.setFontSize(11); pdf.text('Junta de Acción Comunal', 20, 28); pdf.setFontSize(15); pdf.text(title, 20, 42) }
const periodTitle = (report: any) => report.tipo === 'bimestral' ? 'BIMESTRAL' : 'CUATRIMESTRAL'

export function downloadFinancialReport(report: any) {
  const summary = report.resumen || {}
  const pdf = new jsPDF()
  header(pdf, `REPORTE FINANCIERO ${periodTitle(report)}`)
  pdf.setFontSize(10)
  let y = 54
  const rows = [['Periodo', `${report.fecha_inicio || '-'} - ${report.fecha_fin || '-'}`], ['Fecha de generación', report.created_at || '-'], ['Saldo inicial', money(summary.saldo_inicial)], ['Ingresos', money(summary.total_ingresos)], ['Egresos', money(summary.total_egresos)], ['Resultado del periodo', money(summary.resultado_periodo)], ['Saldo final', money(summary.saldo_final)]]
  rows.forEach(([label, value]) => { pdf.setFont('helvetica', 'bold'); pdf.text(`${label}:`, 20, y); pdf.setFont('helvetica', 'normal'); pdf.text(value, 75, y); y += 7 })
  pdf.setFont('helvetica', 'bold'); pdf.text('Ingresos por origen', 20, y + 4); y += 9
  const originLabels: Record<string, string> = { manual: 'Otros ingresos', salon: 'Salón comunal', alquiler_recursos: 'Alquiler de recursos', alquiler_recursos_deposito: 'Depósitos aplicados', donacion: 'Donaciones', cuota: 'Cuotas', venta_producto: 'Venta de productos', bono_solidario: 'Bono solidario', bono_premio_no_entregado: 'Premio de bono no entregado' }
  autoTable(pdf, { startY: y, head: [['Origen', 'Total']], body: (summary.ingresos_por_origen || []).map((item: any) => [originLabels[item.origen] || item.origen, money(item.total)]), theme: 'grid', styles: { fontSize: 9 } })
  y = (pdf as any).lastAutoTable.finalY + 10; pdf.setFont('helvetica', 'bold'); pdf.text('Principales conceptos de egreso', 20, y); y += 5
  autoTable(pdf, { startY: y, head: [['Concepto', 'Total']], body: (summary.egresos_por_concepto || []).map((item: any) => [item.concepto, money(item.total)]), theme: 'grid', styles: { fontSize: 9 } })
  y = (pdf as any).lastAutoTable.finalY + 12; pdf.setFontSize(12); pdf.text('DETALLE DE MOVIMIENTOS', 20, y)
  autoTable(pdf, { startY: y + 4, head: [['Fecha', 'Tipo', 'Concepto', 'Monto', 'Saldo']], body: (report.movimientos || []).map((item: any) => [item.fecha || '-', item.tipo || '-', item.descripcion || '-', money(item.monto), money(item.saldo_nuevo)]), theme: 'striped', styles: { fontSize: 8 }, columnStyles: { 2: { cellWidth: 65 } } })
  pdf.save(`reporte-financiero-${report.id || 'reporte'}.pdf`)
}

export function downloadFiscalReport(report: any) {
  const summary = report.resumen || {}
  const pdf = new jsPDF()
  header(pdf, 'REPORTE DE AUDITORIA FISCAL')
  let y = 54
  const rows: Array<[string, string]> = [['Tipo', periodTitle(report)], ['Periodo', `${report.fecha_inicio || '-'} - ${report.fecha_fin || '-'}`], ['Fecha', report.created_at || '-'], ['Total alertas', String(summary.total_alertas || 0)], ['Abiertas', String(summary.alertas_abiertas || 0)], ['Incluidas en reporte', String(summary.alertas_incluidas_reporte || 0)], ['Cerradas', String(summary.alertas_cerradas || 0)], ['Alertas generadas por Tesorería', String(summary.alertas_origen_tesorero || 0)], ['Alertas generadas por Fiscalía', String(summary.alertas_origen_fiscal || 0)], ['Monto relacionado', money(summary.monto_total_relacionado)]]
  rows.forEach(([label, value]) => { pdf.setFont('helvetica', 'bold'); pdf.text(`${label}:`, 20, y); pdf.setFont('helvetica', 'normal'); pdf.text(value, 85, y); y += 7 })
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.text('ALERTAS', 20, y + 5)
  autoTable(pdf, { startY: y + 10, head: [['Fecha', 'Origen', 'Estado', 'Concepto', 'Monto', 'Motivo', 'Comentario Fiscal']], body: (report.alertas || []).map((item: any) => [item.fecha || '-', item.origen || '-', item.estado || '-', item.concepto || '-', money(item.monto), item.motivo || '-', item.comentario_fiscal || '-']), theme: 'striped', styles: { fontSize: 7 }, columnStyles: { 3: { cellWidth: 28 }, 5: { cellWidth: 35 }, 6: { cellWidth: 35 } } })
  pdf.save(`reporte-fiscal-${report.id || 'reporte'}.pdf`)
}
