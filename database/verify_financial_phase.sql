DO $$
DECLARE
  required_table TEXT;
  required_function TEXT;
  required_column TEXT;
  missing_objects TEXT[] := ARRAY[]::TEXT[];
  required_tables TEXT[] := ARRAY[
    'komerizo_configuracion_jac',
    'komerizo_autorizaciones_gasto',
    'komerizo_autorizaciones_gasto_historial',
    'komerizo_alertas_fiscales',
    'komerizo_alquiler_recursos',
    'komerizo_alquiler_recursos_items',
    'komerizo_ingresos_donaciones_cuotas',
    'komerizo_actividades_venta',
    'komerizo_ventas_actividad',
    'komerizo_bonos_solidarios',
    'komerizo_bono_compras',
    'komerizo_bono_puestos_ocupados',
    'komerizo_reportes_financieros',
    'komerizo_reportes_fiscales',
    'komerizo_solicitud_informes',
    'komerizo_informes'
  ];
  required_functions TEXT[] := ARRAY[
    'komerizo_registrar_egreso_autorizado',
    'komerizo_crear_solicitud_egreso_presidencia',
    'komerizo_corregir_solicitud_egreso_presidencia',
    'komerizo_devolver_egreso_presidencia',
    'komerizo_alertar_egreso_fiscal',
    'komerizo_fijar_cuantias_administrador',
    'komerizo_marcar_egreso_por_fiscal',
    'komerizo_incluir_alerta_reporte_fiscal',
    'komerizo_registrar_ingreso_financiero',
    'komerizo_confirmar_pago_salon',
    'komerizo_crear_alquiler_recursos',
    'komerizo_confirmar_pago_alquiler_recursos',
    'komerizo_registrar_donacion_cuota',
    'komerizo_crear_actividad_venta',
    'komerizo_registrar_venta_producto',
    'komerizo_pagar_reserva_producto',
    'komerizo_cobrar_venta_pendiente',
    'komerizo_cerrar_actividad_venta',
    'komerizo_crear_bono_solidario',
    'komerizo_registrar_compra_bono',
    'komerizo_pagar_reserva_bono',
    'komerizo_cerrar_bono_solidario',
    'komerizo_generar_reporte_financiero',
    'komerizo_generar_reporte_fiscal',
    'komerizo_estadisticas_financieras',
    'komerizo_responder_solicitud_informe',
    'komerizo_publicar_informe_gestion'
  ];
  required_columns TEXT[] := ARRAY[
    'komerizo_tesoreria.fecha_movimiento',
    'komerizo_tesoreria.beneficiario_destino',
    'komerizo_tesoreria.metodo_pago',
    'komerizo_tesoreria.archivo_adjunto_url',
    'komerizo_tesoreria.origen_tipo',
    'komerizo_tesoreria.origen_id',
    'komerizo_configuracion_jac.motivo_actualizacion',
    'komerizo_autorizaciones_gasto.estado',
    'komerizo_autorizaciones_gasto.fecha_egreso',
    'komerizo_autorizaciones_gasto.concepto',
    'komerizo_autorizaciones_gasto.beneficiario_destino',
    'komerizo_autorizaciones_gasto.metodo_pago',
    'komerizo_autorizaciones_gasto.movimiento_tesoreria_id',
    'komerizo_solicitud_informes.destinatario_rol_id',
    'komerizo_solicitud_informes.mensaje_solicitud',
    'komerizo_solicitud_informes.mensaje_respuesta',
    'komerizo_solicitud_informes.titulo_respuesta',
    'komerizo_solicitud_informes.archivo_respuesta_url',
    'komerizo_solicitud_informes.movimiento_tesoreria_id',
    'komerizo_informes.titulo',
    'komerizo_informes.contenido',
    'komerizo_informes.archivo_url',
    'komerizo_informes.tipo_informe',
    'komerizo_informes.es_publico',
    'komerizo_informes.estado'
  ];
BEGIN
  FOREACH required_table IN ARRAY required_tables LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      missing_objects := array_append(missing_objects, required_table);
    END IF;
  END LOOP;

  FOREACH required_function IN ARRAY required_functions LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = required_function) THEN
      missing_objects := array_append(missing_objects, required_function || '()');
    END IF;
  END LOOP;

  FOREACH required_column IN ARRAY required_columns LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = split_part(required_column, '.', 1)
        AND column_name = split_part(required_column, '.', 2)
    ) THEN
      RAISE EXCEPTION 'Missing column: %', required_column;
    END IF;
  END LOOP;

  IF cardinality(missing_objects) > 0 THEN
    RAISE EXCEPTION 'Komerizo financial/reporting phase preflight failed. Missing objects: %', array_to_string(missing_objects, ', ');
  END IF;

  RAISE NOTICE 'Komerizo financial/reporting phase preflight: OK';
END $$;
