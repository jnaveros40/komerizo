/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { downloadFinancialReport } from '@/lib/financialReports'
import './reportes.css'

const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)
export default function TesoreroReportesPage() {
  const { user } = useAuth(); const [roleId, setRoleId] = useState<number | null>(null); const [reports, setReports] = useState<any[]>([]); const [type, setType] = useState('bimestral'); const [end, setEnd] = useState(new Date().toISOString().slice(0, 10)); const [busy, setBusy] = useState(false)
  const load = async () => { const [{ data: role }, { data }] = await Promise.all([supabase.from('komerizo_roles').select('id').eq('nombre', 'Tesorero').single(), supabase.from('komerizo_reportes_financieros').select('*').order('created_at', { ascending: false })]); if (role) setRoleId(role.id); setReports(data || []) }
  useEffect(() => { if (user?.id) load() }, [user?.id])
  const generate = async () => { if (!user?.id || !roleId) return; setBusy(true); const { error } = await supabase.rpc('komerizo_generar_reporte_financiero', { p_tipo: type, p_fecha_fin: end, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false); if (error) alert(error.message); else await load() }
  return <main className="financial-reports-page"><h1>Reportes financieros</h1><section className="report-controls"><label>Tipo:<select value={type} onChange={e => setType(e.target.value)}><option value="bimestral">Bimestral</option><option value="cuatrimestral">Cuatrimestral</option></select></label><label>Fecha final del periodo<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label><button onClick={generate} disabled={busy}>Generar reporte</button></section><section className="reports-list">{reports.map(report => <article className="report-card" key={report.id}><div><h2>{report.tipo === 'bimestral' ? 'Bimestral' : 'Cuatrimestral'}</h2><p>Periodo: {report.fecha_inicio} - {report.fecha_fin}</p><p>Ingresos: {money(report.resumen?.total_ingresos)} · Egresos: {money(report.resumen?.total_egresos)} · Resultado: {money(report.resumen?.resultado_periodo)}</p><p>Saldo final: {money(report.resumen?.saldo_final)} · Fecha generacion: {report.created_at}</p></div><button onClick={() => downloadFinancialReport(report)}>Descargar PDF</button></article>)}</section></main>
}
