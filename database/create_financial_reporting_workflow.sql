-- Orden SQL obligatorio:
-- 1. create_financial_expense_workflow.sql
-- 2. create_financial_income_workflow.sql
-- 3. create_product_sales_workflow.sql
-- 4. create_bonus_workflow.sql
-- 5. create_financial_reporting_workflow.sql

CREATE TABLE IF NOT EXISTS komerizo_reportes_financieros (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('bimestral','cuatrimestral')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  generado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_generador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  resumen JSONB NOT NULL,
  movimientos JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_reportes_financieros_fecha ON komerizo_reportes_financieros(fecha_fin DESC);
ALTER TABLE komerizo_reportes_financieros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reportes_financieros_public_access ON komerizo_reportes_financieros;
CREATE POLICY reportes_financieros_public_access ON komerizo_reportes_financieros FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS komerizo_reportes_fiscales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('bimestral','cuatrimestral')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  generado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_generador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  resumen JSONB NOT NULL,
  alertas JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reportes_fiscales_fecha ON komerizo_reportes_fiscales(fecha_fin DESC);
ALTER TABLE komerizo_reportes_fiscales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reportes_fiscales_public_access ON komerizo_reportes_fiscales;
CREATE POLICY reportes_fiscales_public_access ON komerizo_reportes_fiscales FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION komerizo_generar_reporte_financiero(
  p_tipo VARCHAR, p_fecha_fin DATE, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_inicio DATE; v_id BIGINT; v_ingresos DECIMAL(15,2); v_egresos DECIMAL(15,2); v_saldo_inicial DECIMAL(15,2); v_saldo_final DECIMAL(15,2); v_cant_ingresos BIGINT; v_cant_egresos BIGINT; v_resumen JSONB; v_movimientos JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  IF p_tipo NOT IN ('bimestral','cuatrimestral') THEN RAISE EXCEPTION 'El tipo de reporte no es válido'; END IF;
  IF p_fecha_fin IS NULL THEN RAISE EXCEPTION 'La fecha final es obligatoria'; END IF;
  v_inicio := CASE WHEN p_tipo = 'bimestral' THEN (p_fecha_fin - INTERVAL '2 months' + INTERVAL '1 day')::date ELSE (p_fecha_fin - INTERVAL '4 months' + INTERVAL '1 day')::date END;
  SELECT COALESCE(SUM(cantidad) FILTER (WHERE tipo = 'ingreso'),0), COALESCE(SUM(cantidad) FILTER (WHERE tipo = 'gasto'),0), COUNT(*) FILTER (WHERE tipo = 'ingreso'), COUNT(*) FILTER (WHERE tipo = 'gasto')
    INTO v_ingresos, v_egresos, v_cant_ingresos, v_cant_egresos
    FROM komerizo_tesoreria WHERE estado = 'registrado' AND fecha_movimiento BETWEEN v_inicio AND p_fecha_fin;
  SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN cantidad WHEN tipo = 'gasto' THEN -cantidad ELSE 0 END), 0)
    INTO v_saldo_inicial
    FROM komerizo_tesoreria
    WHERE estado = 'registrado' AND fecha_movimiento < v_inicio;
  v_saldo_final := v_saldo_inicial + v_ingresos - v_egresos;
  SELECT jsonb_build_object('total_ingresos', v_ingresos, 'total_egresos', v_egresos, 'resultado_periodo', v_ingresos - v_egresos, 'cantidad_ingresos', v_cant_ingresos, 'cantidad_egresos', v_cant_egresos, 'saldo_inicial', v_saldo_inicial, 'saldo_final', v_saldo_final, 'ingresos_por_origen', COALESCE((SELECT jsonb_agg(jsonb_build_object('origen', COALESCE(origen_tipo,'manual'), 'total', total) ORDER BY total DESC) FROM (SELECT COALESCE(origen_tipo,'manual') origen_tipo, SUM(cantidad) total FROM komerizo_tesoreria WHERE estado='registrado' AND tipo='ingreso' AND fecha_movimiento BETWEEN v_inicio AND p_fecha_fin GROUP BY COALESCE(origen_tipo,'manual')) q),'[]'::jsonb), 'egresos_por_concepto', COALESCE((SELECT jsonb_agg(jsonb_build_object('concepto', descripcion, 'total', total) ORDER BY total DESC) FROM (SELECT descripcion, SUM(cantidad) total FROM komerizo_tesoreria WHERE estado='registrado' AND tipo='gasto' AND fecha_movimiento BETWEEN v_inicio AND p_fecha_fin GROUP BY descripcion ORDER BY total DESC LIMIT 10) q),'[]'::jsonb)) INTO v_resumen;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'fecha', fecha_movimiento, 'tipo', tipo, 'descripcion', descripcion, 'monto', cantidad, 'saldo_anterior', saldo_anterior, 'saldo_nuevo', saldo_nuevo, 'origen_tipo', origen_tipo, 'beneficiario_destino', beneficiario_destino, 'metodo_pago', metodo_pago, 'referencia', referencia_externa) ORDER BY fecha_movimiento, id),'[]'::jsonb) INTO v_movimientos FROM komerizo_tesoreria WHERE estado='registrado' AND fecha_movimiento BETWEEN v_inicio AND p_fecha_fin;
  INSERT INTO komerizo_reportes_financieros(tipo, fecha_inicio, fecha_fin, generado_por, rol_generador_id, resumen, movimientos) VALUES (p_tipo, v_inicio, p_fecha_fin, p_tesorero_id, p_tesorero_rol_id, v_resumen, v_movimientos) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_generar_reporte_fiscal(
  p_tipo VARCHAR, p_fecha_fin DATE, p_fiscal_id BIGINT, p_fiscal_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_inicio DATE; v_id BIGINT; v_resumen JSONB; v_alertas JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_fiscal_rol_id AND r.nombre = 'Fiscal' AND ur.usuario_id = p_fiscal_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Fiscal'; END IF;
  IF p_tipo NOT IN ('bimestral','cuatrimestral') THEN RAISE EXCEPTION 'El tipo de reporte no es válido'; END IF;
  IF p_fecha_fin IS NULL THEN RAISE EXCEPTION 'La fecha final es obligatoria'; END IF;
  v_inicio := CASE WHEN p_tipo = 'bimestral' THEN (p_fecha_fin - INTERVAL '2 months' + INTERVAL '1 day')::date ELSE (p_fecha_fin - INTERVAL '4 months' + INTERVAL '1 day')::date END;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'fecha', a.created_at::date, 'origen', a.origen, 'estado', a.estado, 'motivo', a.motivo, 'comentario_fiscal', a.comentario_fiscal, 'autorizacion_gasto_id', a.autorizacion_gasto_id, 'movimiento_tesoreria_id', a.movimiento_tesoreria_id, 'monto', COALESCE(ag.monto_solicitado, t.cantidad, 0), 'concepto', COALESCE(ag.concepto, t.descripcion, '-')) ORDER BY a.created_at, a.id),'[]'::jsonb)
    INTO v_alertas
    FROM komerizo_alertas_fiscales a LEFT JOIN komerizo_autorizaciones_gasto ag ON ag.id=a.autorizacion_gasto_id LEFT JOIN komerizo_tesoreria t ON t.id=a.movimiento_tesoreria_id
    WHERE ((a.estado IN ('incluida_reporte','cerrada') AND a.created_at::date BETWEEN v_inicio AND p_fecha_fin) OR (a.estado='abierta' AND a.created_at::date BETWEEN v_inicio AND p_fecha_fin));
  SELECT jsonb_build_object('total_alertas', COUNT(*), 'alertas_abiertas', COUNT(*) FILTER (WHERE a.estado='abierta'), 'alertas_incluidas_reporte', COUNT(*) FILTER (WHERE a.estado='incluida_reporte'), 'alertas_cerradas', COUNT(*) FILTER (WHERE a.estado='cerrada'), 'alertas_origen_tesorero', COUNT(*) FILTER (WHERE a.origen='tesorero'), 'alertas_origen_fiscal', COUNT(*) FILTER (WHERE a.origen='fiscal'), 'monto_total_relacionado', COALESCE(SUM(COALESCE(ag.monto_solicitado,t.cantidad,0)),0)) INTO v_resumen FROM komerizo_alertas_fiscales a LEFT JOIN komerizo_autorizaciones_gasto ag ON ag.id=a.autorizacion_gasto_id LEFT JOIN komerizo_tesoreria t ON t.id=a.movimiento_tesoreria_id WHERE a.created_at::date BETWEEN v_inicio AND p_fecha_fin;
  INSERT INTO komerizo_reportes_fiscales(tipo, fecha_inicio, fecha_fin, generado_por, rol_generador_id, resumen, alertas) VALUES (p_tipo, v_inicio, p_fecha_fin, p_fiscal_id, p_fiscal_rol_id, v_resumen, v_alertas) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_estadisticas_financieras(p_meses INT DEFAULT 6)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_start DATE; v_current DATE := date_trunc('month', CURRENT_DATE)::date; v_current_income DECIMAL(15,2); v_current_expense DECIMAL(15,2); v_previous_income DECIMAL(15,2); v_previous_expense DECIMAL(15,2); v_balance DECIMAL(15,2); v_result JSONB;
BEGIN
  IF p_meses NOT IN (3,6,12) THEN RAISE EXCEPTION 'El periodo debe ser de 3, 6 o 12 meses'; END IF;
  v_start := (v_current - ((p_meses - 1) || ' months')::interval)::date;
  SELECT COALESCE(SUM(cantidad) FILTER (WHERE tipo='ingreso'),0), COALESCE(SUM(cantidad) FILTER (WHERE tipo='gasto'),0) INTO v_current_income, v_current_expense FROM komerizo_tesoreria WHERE estado='registrado' AND fecha_movimiento >= v_current AND fecha_movimiento < (v_current + INTERVAL '1 month')::date;
  SELECT COALESCE(SUM(cantidad) FILTER (WHERE tipo='ingreso'),0), COALESCE(SUM(cantidad) FILTER (WHERE tipo='gasto'),0) INTO v_previous_income, v_previous_expense FROM komerizo_tesoreria WHERE estado='registrado' AND fecha_movimiento >= (v_current - INTERVAL '1 month')::date AND fecha_movimiento < v_current;
  SELECT COALESCE(saldo_actual,0) INTO v_balance FROM komerizo_tesoreria_saldo ORDER BY id DESC LIMIT 1;
  SELECT jsonb_build_object('saldo_actual', COALESCE(v_balance,0), 'total_ingresos_periodo', COALESCE((SELECT SUM(cantidad) FROM komerizo_tesoreria WHERE estado='registrado' AND tipo='ingreso' AND fecha_movimiento >= v_start AND fecha_movimiento < (v_current + INTERVAL '1 month')::date),0), 'total_egresos_periodo', COALESCE((SELECT SUM(cantidad) FROM komerizo_tesoreria WHERE estado='registrado' AND tipo='gasto' AND fecha_movimiento >= v_start AND fecha_movimiento < (v_current + INTERVAL '1 month')::date),0), 'resultado_periodo', COALESCE((SELECT SUM(CASE WHEN tipo='ingreso' THEN cantidad ELSE -cantidad END) FROM komerizo_tesoreria WHERE estado='registrado' AND fecha_movimiento >= v_start AND fecha_movimiento < (v_current + INTERVAL '1 month')::date),0), 'mes_actual', jsonb_build_object('ingresos',v_current_income,'egresos',v_current_expense), 'mes_anterior', jsonb_build_object('ingresos',v_previous_income,'egresos',v_previous_expense), 'variacion_ingresos_porcentaje', CASE WHEN v_previous_income=0 THEN NULL ELSE ROUND(((v_current_income-v_previous_income)/v_previous_income)*100,2) END, 'variacion_egresos_porcentaje', CASE WHEN v_previous_expense=0 THEN NULL ELSE ROUND(((v_current_expense-v_previous_expense)/v_previous_expense)*100,2) END, 'mensual', COALESCE((SELECT jsonb_agg(jsonb_build_object('mes', to_char(month_start,'YYYY-MM'),'ingresos',ingresos,'egresos',egresos,'resultado',ingresos-egresos) ORDER BY month_start) FROM (SELECT gs::date month_start, COALESCE(SUM(t.cantidad) FILTER (WHERE t.tipo='ingreso'),0) ingresos, COALESCE(SUM(t.cantidad) FILTER (WHERE t.tipo='gasto'),0) egresos FROM generate_series(v_start, v_current, INTERVAL '1 month') gs LEFT JOIN komerizo_tesoreria t ON t.fecha_movimiento >= gs::date AND t.fecha_movimiento < (gs + INTERVAL '1 month')::date AND t.estado='registrado' GROUP BY gs) m),'[]'::jsonb), 'origenes_ingreso', COALESCE((SELECT jsonb_agg(jsonb_build_object('origen',COALESCE(origen_tipo,'manual'),'total',total) ORDER BY total DESC) FROM (SELECT origen_tipo,SUM(cantidad) total FROM komerizo_tesoreria WHERE estado='registrado' AND tipo='ingreso' AND fecha_movimiento >= v_start AND fecha_movimiento < (v_current + INTERVAL '1 month')::date GROUP BY origen_tipo ORDER BY total DESC LIMIT 10) o),'[]'::jsonb), 'principales_egresos', COALESCE((SELECT jsonb_agg(jsonb_build_object('concepto',descripcion,'total',total) ORDER BY total DESC) FROM (SELECT descripcion,SUM(cantidad) total FROM komerizo_tesoreria WHERE estado='registrado' AND tipo='gasto' AND fecha_movimiento >= v_start AND fecha_movimiento < (v_current + INTERVAL '1 month')::date GROUP BY descripcion ORDER BY total DESC LIMIT 5) e),'[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;
