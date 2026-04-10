'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import '../usuario.css'

export default function UsuarioInformacionPage() {
  const { user } = useAuth()
  const [comunaName, setComunaName] = useState('')
  const [barrioName, setBarrioName] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [usuarioData, setUsuarioData] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loadingCertificate, setLoadingCertificate] = useState(false)

  useEffect(() => {
    fetchUserData()
  }, [user])

  const fetchUserData = async () => {
    if (!user?.id) return

    try {
      // Obtener datos frescos del usuario de Supabase
      const { data: userData, error: userError } = await supabase
        .from('komerizo_usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      setUsuarioData(userData)

      // Obtener roles del usuario
      const { data: userRolesData, error: rolesError } = await supabase
        .from('komerizo_usuario_roles')
        .select('rol_id')
        .eq('usuario_id', user.id)

      if (!rolesError && userRolesData && userRolesData.length > 0) {
        const roleIds = userRolesData.map((ur: any) => ur.rol_id)
        const { data: rolesData } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .in('id', roleIds)
        setRoles(rolesData || [])
      }

      // Comuna
      if (userData?.comuna_id) {
        const { data: comunaData } = await supabase
          .from('komerizo_comunas')
          .select('nombre')
          .eq('id', userData.comuna_id)
          .single()
        setComunaName(comunaData?.nombre || '')
      }

      // Barrio
      if (userData?.barrio_id) {
        const { data: barrioData } = await supabase
          .from('komerizo_barrios')
          .select('nombre')
          .eq('id', userData.barrio_id)
          .single()
        setBarrioName(barrioData?.nombre || '')
      }

      // Tipo de documento
      if (userData?.tipo_documento_id) {
        const { data: tipoDocData } = await supabase
          .from('komerizo_tipo_documento')
          .select('nombre')
          .eq('id', userData.tipo_documento_id)
          .single()
        setTipoDocumento(tipoDocData?.nombre || '')
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
    }
  }

  const downloadCertificate = async () => {
    try {
      setLoadingCertificate(true)
      
      // Obtener Presidentes y Secretarios
      const { data: rolesData } = await supabase
        .from('komerizo_roles')
        .select('id, nombre')
        .in('nombre', ['Presidente', 'Secretario'])

      const roleIds = rolesData?.map((r: any) => r.id) || []

      // Obtener usuarios con estos roles
      let dirigentesList: any[] = []
      if (roleIds.length > 0) {
        const { data: usuariosRolesData } = await supabase
          .from('komerizo_usuario_roles')
          .select('usuario_id, rol_id')
          .in('rol_id', roleIds)

        if (usuariosRolesData && usuariosRolesData.length > 0) {
          const usuarioIds = usuariosRolesData.map((ur: any) => ur.usuario_id)
          const { data: usuariosData } = await supabase
            .from('komerizo_usuarios')
            .select('nombre, apellido')
            .in('id', usuarioIds)
          
          dirigentesList = usuariosData || []
        }
      }

      // Crear PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // Color scheme
      const primaryColor: [number, number, number] = [32, 76, 175] // #204cab azul
      const textColor: [number, number, number] = [51, 51, 51] // Gris oscuro
      const lightGray: [number, number, number] = [200, 200, 200]

      // Encabezado
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      pdf.rect(0, 0, 210, 35, 'F')

      // Título
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(24)
      pdf.text('CERTIFICADO DE AFILIACIÓN', 105, 15, { align: 'center' })
      pdf.setFontSize(10)
      pdf.text('Komerizo - JAC Management System', 105, 23, { align: 'center' })

      // Contenido principal
      pdf.setTextColor(textColor[0], textColor[1], textColor[2])
      pdf.setFontSize(11)

      let yPosition = 45

      // Sección de información
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('INFORMACIÓN DEL AFILIADO', 15, yPosition)
      yPosition += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)

      // Detalles del usuario
      const details = [
        { label: 'Nombre:', value: `${usuarioData?.nombre || ''} ${usuarioData?.apellido || ''}` },
        { label: 'Tipo Documento:', value: tipoDocumento || 'N/A' },
        { label: 'Cédula:', value: usuarioData?.cc || 'N/A' },
        { label: 'Teléfono:', value: usuarioData?.telefono || 'N/A' },
        { label: 'Correo:', value: usuarioData?.correo_electronico || 'N/A' },
        { label: 'Dirección:', value: usuarioData?.direccion || 'N/A' },
        { label: 'Comuna:', value: comunaName || 'N/A' },
        { label: 'Barrio:', value: barrioName || 'N/A' },
      ]

      details.forEach((detail) => {
        pdf.setFont('helvetica', 'bold')
        pdf.text(detail.label, 15, yPosition)
        pdf.setFont('helvetica', 'normal')
        pdf.text(detail.value, 50, yPosition)
        yPosition += 7
      })

      // Información del documento
      yPosition += 5
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('ESTADO DEL DOCUMENTO', 15, yPosition)
      yPosition += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      
      const now = new Date()
      const dateStr = now.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      const timeStr = now.toLocaleTimeString('es-CO')

      pdf.text(`Fecha de Descarga: ${dateStr}`, 15, yPosition)
      yPosition += 7
      pdf.text(`Hora de Descarga: ${timeStr}`, 15, yPosition)
      yPosition += 7
      pdf.text(`Estado: Activo`, 15, yPosition)
      yPosition += 7
      pdf.text(`Afiliación Válida: Sí`, 15, yPosition)

      // Pie de página con dirigentas
      yPosition += 15
      pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2])
      pdf.rect(0, yPosition - 5, 210, 80, 'F')

      yPosition += 5
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.text('DIRECTIVA DE LA ORGANIZACIÓN', 15, yPosition)
      yPosition += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)

      if (dirigentesList.length > 0) {
        let col1Count = Math.ceil(dirigentesList.length / 2)
        let col1X = 15
        let col2X = 110
        let currentY1 = yPosition
        let currentY2 = yPosition

        dirigentesList.forEach((dirigente, index) => {
          const fullName = `${dirigente.nombre} ${dirigente.apellido}`
          if (index < col1Count) {
            pdf.text(`• ${fullName}`, col1X, currentY1)
            currentY1 += 5
          } else {
            pdf.text(`• ${fullName}`, col2X, currentY2)
            currentY2 += 5
          }
        })
      } else {
        pdf.text('No hay directiva registrada', 15, yPosition)
      }

      // Descargar PDF
      const fileName = `Certificado_${usuarioData?.nombre}_${new Date().getTime()}.pdf`
      pdf.save(fileName)

      setLoadingCertificate(false)
    } catch (error) {
      console.error('Error al generar certificado:', error)
      setLoadingCertificate(false)
    }
  }

  
  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>📋 Mi Información</h1>
        <p className="header-subtitle">Datos de tu perfil</p>
      </div>

      <div className="info-card">
        <div className="info-section">
          <h3>Datos Personales</h3>

          <div className="info-grid">
            <div className="info-item">
              <label>Tipo de Documento:</label>
              <p>{tipoDocumento || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Cédula:</label>
              <p>{usuarioData?.cc || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Nombre:</label>
              <p>{usuarioData?.nombre || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Apellido:</label>
              <p>{usuarioData?.apellido || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Correo Electrónico:</label>
              <p>{usuarioData?.correo_electronico || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Teléfono:</label>
              <p>{usuarioData?.telefono || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Dirección:</label>
              <p>{usuarioData?.direccion || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h3>Ubicación</h3>

          <div className="info-grid">
            <div className="info-item">
              <label>Comuna:</label>
              <p>{comunaName || 'Cargando...'}</p>
            </div>

            <div className="info-item">
              <label>Barrio:</label>
              <p>{barrioName || 'Cargando...'}</p>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h3>Roles Asignados</h3>
          <div className="roles-list">
            {roles && roles.length > 0 ? (
              roles.map((role: any) => (
                <div key={role.id} className="role-item">
                  <span className={`role-badge ${role.nombre.toLowerCase().replace(/ /g, '-')}`}>{role.nombre}</span>
                </div>
              ))
            ) : (
              <p>No hay roles asignados</p>
            )}
          </div>
        </div>
      </div>

      <div className="certificate-section">
        <button
          onClick={downloadCertificate}
          disabled={loadingCertificate}
          className="download-certificate-btn"
        >
          {loadingCertificate ? '⏳ Generando...' : '📄 Descargar Certificado'}
        </button>
        <p className="certificate-info">
          Descarga tu certificado de afiliación con tus datos actuales y la información de la directiva
        </p>
      </div>

      <div className="info-note">
        <p>
          Los datos mostrados aquí son los registrados en el sistema.
          Recuerda que puedes editar tu informacion personal en el menu Mi Perfil.
                    
        </p>
      </div>
    </div>
  )
}
