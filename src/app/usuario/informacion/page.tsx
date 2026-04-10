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
      
      // Obtener Presidentes y Secretarios que pertenezcan a la misma comuna
      const { data: rolesData } = await supabase
        .from('komerizo_roles')
        .select('id, nombre')
        .in('nombre', ['Presidente', 'Secretario'])

      const roleIds = rolesData?.map((r: any) => r.id) || []

      // Obtener usuarios con estos roles y misma comuna
      let dirigentes: any = { presidente: null, secretario: null }
      
      if (roleIds.length > 0) {
        const { data: usuariosRolesData } = await supabase
          .from('komerizo_usuario_roles')
          .select('usuario_id, rol_id')
          .in('rol_id', roleIds)

        if (usuariosRolesData && usuariosRolesData.length > 0) {
          const usuarioIds = usuariosRolesData.map((ur: any) => ur.usuario_id)
          
          // Obtener usuarios completos
          const { data: usuariosData } = await supabase
            .from('komerizo_usuarios')
            .select('id, nombre, apellido, cc, telefono, correo_electronico, comuna_id')
            .in('id', usuarioIds)
            .eq('comuna_id', usuarioData?.comuna_id)

          if (usuariosData && usuariosData.length > 0) {
            // Filtrar por rol
            usuariosRolesData.forEach((ur: any) => {
              const usuario = usuariosData.find((u: any) => u.id === ur.usuario_id)
              if (usuario) {
                const roleName = rolesData?.find((r: any) => r.id === ur.rol_id)?.nombre
                if (roleName === 'Presidente') {
                  dirigentes.presidente = { ...usuario, rol: roleName }
                } else if (roleName === 'Secretario') {
                  dirigentes.secretario = { ...usuario, rol: roleName }
                }
              }
            })
          }
        }
      }

      // Crear PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageMargin = 15
      const contentWidth = pageWidth - (pageMargin * 2)
      
      // Color scheme
      const primaryColor: [number, number, number] = [32, 76, 175]
      const textColor: [number, number, number] = [51, 51, 51]

      // Encabezado
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      pdf.rect(0, 0, pageWidth, 30, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.text('CERTIFICADO DE AFILIACIÓN', pageWidth / 2, 12, { align: 'center' })
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Komerizo - JAC Management System', pageWidth / 2, 22, { align: 'center' })

      // Contenido principal
      pdf.setTextColor(textColor[0], textColor[1], textColor[2])
      let yPosition = 45

      // Texto principal del certificado
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'normal')

      const barrio = barrioName ? `Barrio ${barrioName}` : 'Barrio de esta localidad'
      const nombreComunaNum = comunaName ? `${comunaName}` : 'esta Comuna'

      const numeroComuna = usuarioData?.comuna_id || '0'

      // Texto introductorio centrado, negrita
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      const textoIntroduction = `La Junta de Acción Comunal del ${barrio} de la Comuna ${numeroComuna}`
      const textoPrincipal = pdf.splitTextToSize(textoIntroduction, contentWidth)
      pdf.text(textoPrincipal, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += textoPrincipal.length * 6 + 3

      // "CERTIFICA:" con tamaño aumentado, centrado, negrita
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text('CERTIFICA:', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 8

      // Párrafo de certificación - forma simplificada
      const nombreCompleto = `${usuarioData?.nombre || ''} ${usuarioData?.apellido || ''}`
      const estado = 'Activo'
      const tipoDoc = `${tipoDocumento || 'Documento'}`
      const noCedula = `${usuarioData?.cc || 'N/A'}`

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)

      // Construir el texto completo sin marcadores especiales
      const textoCertificacionCompleto = `Que la persona ${nombreCompleto}, identificado con ${tipoDoc} número ${noCedula}, se encuentra en estado ${estado}.`

      // Dividir en líneas que caben en el ancho disponible
      const lineasCert = pdf.splitTextToSize(textoCertificacionCompleto, contentWidth)

      // Dibujar línea por línea
      lineasCert.forEach((linea: string) => {
        // Usar un enfoque más simple: simplemente dibujar cada línea
        // Las palabras en negrita se aplicaran de forma aproximada
        if (linea.includes(nombreCompleto)) {
          // Reemplazar el nombre con versión en negrita
          const partes = linea.split(nombreCompleto)
          pdf.setFont('helvetica', 'normal')
          pdf.text(partes[0], pageMargin, yPosition)
          
          const anchoAntes = pdf.getTextWidth(partes[0])
          pdf.setFont('helvetica', 'bold')
          pdf.text(nombreCompleto, pageMargin + anchoAntes, yPosition)
          
          pdf.setFont('helvetica', 'normal')
          pdf.text(partes[1], pageMargin + anchoAntes + pdf.getTextWidth(nombreCompleto), yPosition)
        } else if (linea.includes(`${tipoDoc} número ${noCedula}`)) {
          const docInfo = `${tipoDoc} número ${noCedula}`
          const partes = linea.split(docInfo)
          pdf.setFont('helvetica', 'normal')
          pdf.text(partes[0], pageMargin, yPosition)
          
          const anchoAntes = pdf.getTextWidth(partes[0])
          pdf.setFont('helvetica', 'bold')
          pdf.text(docInfo, pageMargin + anchoAntes, yPosition)
          
          pdf.setFont('helvetica', 'normal')
          pdf.text(partes[1], pageMargin + anchoAntes + pdf.getTextWidth(docInfo), yPosition)
        } else if (linea.includes(estado)) {
          const partes = linea.split(estado)
          pdf.setFont('helvetica', 'normal')
          pdf.text(partes[0], pageMargin, yPosition)
          
          const anchoAntes = pdf.getTextWidth(partes[0])
          pdf.setFont('helvetica', 'bold')
          pdf.text(estado, pageMargin + anchoAntes, yPosition)
          
          pdf.setFont('helvetica', 'normal')
          pdf.text(partes[1], pageMargin + anchoAntes + pdf.getTextWidth(estado), yPosition)
        } else {
          pdf.setFont('helvetica', 'normal')
          pdf.text(linea, pageMargin, yPosition)
        }

        yPosition += 6
      })

      yPosition += 2

      yPosition += 8

      // Datos reportados
      pdf.setFont('helvetica', 'bold')
      pdf.text('Los datos reportados son los siguientes:', pageMargin, yPosition)
      yPosition += 7

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)

      const datosReportados = [
        `Correo Electrónico: ${usuarioData?.correo_electronico || 'N/A'}`,
        `Teléfono: ${usuarioData?.telefono || 'N/A'}`,
        `Dirección: ${usuarioData?.direccion || 'N/A'}`,
      ]

      datosReportados.forEach((dato) => {
        pdf.text(dato, pageMargin + 5, yPosition)
        yPosition += 6
      })

      // Fecha de generación
      yPosition += 5
      const now = new Date()
      const diasSemana = [
        'domingo',
        'lunes',
        'martes',
        'miércoles',
        'jueves',
        'viernes',
        'sábado',
      ]
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ]

      const diaSemana = diasSemana[now.getDay()]
      const dia = now.getDate()
      const mes = meses[now.getMonth()]
      const year = now.getFullYear()
      const horas = String(now.getHours()).padStart(2, '0')
      const minutos = String(now.getMinutes()).padStart(2, '0')
      const segundos = String(now.getSeconds()).padStart(2, '0')

      const fechaFormato = `${diaSemana} ${dia} de ${mes} de ${year} a las ${horas}:${minutos}:${segundos}`
      const textoFecha = `La presente certificación se genera mediante software el día ${fechaFormato}.`

      const textoFechaArray = pdf.splitTextToSize(textoFecha, contentWidth)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'italic')
      pdf.text(textoFechaArray, pageMargin, yPosition)
      yPosition += textoFechaArray.length * 5 + 10

      // Sección de Dirigentas
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('DIRECTIVA DE LA ORGANIZACIÓN', pageMargin, yPosition)
      yPosition += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)

      // Presidente
      if (dirigentes.presidente) {
        const pres = dirigentes.presidente
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${pres.nombre} ${pres.apellido}`, pageMargin, yPosition)
        yPosition += 6

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.text(`Rol: ${pres.rol}`, pageMargin + 3, yPosition)
        yPosition += 5
        pdf.text(`Cédula: ${pres.cc}`, pageMargin + 3, yPosition)
        yPosition += 5
        pdf.text(`Teléfono: ${pres.telefono}`, pageMargin + 3, yPosition)
        yPosition += 5
        pdf.text(`Correo: ${pres.correo_electronico}`, pageMargin + 3, yPosition)
        yPosition += 8
      } else {
        pdf.setFontSize(9)
        pdf.text('Presidente: No asignado en esta comuna', pageMargin, yPosition)
        yPosition += 8
      }

      // Secretario
      if (dirigentes.secretario) {
        const sec = dirigentes.secretario
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.text(`${sec.nombre} ${sec.apellido}`, pageMargin, yPosition)
        yPosition += 6

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.text(`Rol: ${sec.rol}`, pageMargin + 3, yPosition)
        yPosition += 5
        pdf.text(`Cédula: ${sec.cc}`, pageMargin + 3, yPosition)
        yPosition += 5
        pdf.text(`Teléfono: ${sec.telefono}`, pageMargin + 3, yPosition)
        yPosition += 5
        pdf.text(`Correo: ${sec.correo_electronico}`, pageMargin + 3, yPosition)
      } else {
        pdf.setFontSize(9)
        pdf.text('Secretario: No asignado en esta comuna', pageMargin, yPosition)
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
