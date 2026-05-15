// pages/api/kpis.js
// Retorna KPIs principais do projeto

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const obra_id = req.query.obra_id || 'flats_pampulha';

    // Buscar KPIs da view
    const { data: kpis, error: kpisError } = await supabase
      .from('v_kpis_projeto')
      .select('*')
      .eq('obra_id', obra_id)
      .single();

    if (kpisError) throw kpisError;

    // Buscar totais por grupo
    const { data: porGrupo, error: grupoError } = await supabase
      .from('v_custos_por_grupo')
      .select('*')
      .eq('obra_id', obra_id)
      .order('total_valor', { ascending: false });

    if (grupoError) throw grupoError;

    // Buscar distribuição por fase (planejado)
    const { data: fasesPlanejadas, error: fasesError } = await supabase
      .from('v_resumo_orcamento_por_fase')
      .select('*')
      .eq('obra_id', obra_id)
      .order('fase_numero');

    if (fasesError) throw fasesError;

    // Buscar custos por fase (realizado)
    const { data: fasesRealizadas, error: fasesRealError } = await supabase
      .from('v_custos_por_fase')
      .select('*')
      .eq('obra_id', obra_id);

    if (fasesRealError) throw fasesRealError;

    // Combinar fases planejado + realizado
    const fasesCombinadas = fasesPlanejadas.map(fp => {
      const realizado = fasesRealizadas.find(fr => fr.fase_obra === `Fase ${fp.fase_numero}`) || {};
      return {
        fase: fp.fase_numero,
        planejado: fp.valor_total,
        realizado: realizado.total_valor || 0,
        percentual_exec: fp.valor_total > 0 
          ? ((realizado.total_valor || 0) / fp.valor_total * 100).toFixed(1)
          : 0
      };
    });

    res.status(200).json({
      kpis: {
        orcamento_total: kpis.orcamento_total,
        planejado_acumulado: kpis.planejado_acumulado,
        realizado_total: kpis.realizado_total,
        desvio_financeiro: kpis.desvio_financeiro,
        desvio_financeiro_pct: kpis.desvio_financeiro_pct,
        cpi: kpis.cpi,
        saldo_restante: kpis.saldo_restante,
        saldo_restante_pct: kpis.saldo_restante_pct
      },
      por_grupo: porGrupo,
      por_fase: fasesCombinadas
    });

  } catch (error) {
    console.error('Erro ao buscar KPIs:', error);
    res.status(500).json({ error: error.message });
  }
}
