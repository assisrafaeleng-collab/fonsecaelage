import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const mes = parseInt(req.query.mes) || 20;

    const { data, error } = await supabase
      .from('custos_indiretos_planejados')
      .select('categoria, valor_total, mes_desembolso');

    if (error) throw error;

    const TOTAL_MESES = 20;

    const categorias = data.map(item => {
      const md = item.mes_desembolso;
      let valorAcumulado = 0;
      let valorNoMes = 0;

      if (md === 0) {
        // Distribuído linearmente
        const mensal = item.valor_total / TOTAL_MESES;
        valorAcumulado = mensal * mes;
        valorNoMes = mensal;
      } else {
        // Desembolso pontual no mês específico
        valorAcumulado = mes >= md ? item.valor_total : 0;
        valorNoMes = mes === md ? item.valor_total : 0;
      }

      return {
        categoria: item.categoria,
        valor_total_projeto: item.valor_total,
        valor_no_mes: Math.round(valorNoMes * 100) / 100,
        valor_acumulado: Math.round(valorAcumulado * 100) / 100,
        mes_desembolso: md
      };
    });

    // Filtrar: só mostrar categorias que têm valor acumulado > 0 no período
    const categoriasVisiveis = categorias.filter(c => c.valor_acumulado > 0);

    const totalAcumulado = categoriasVisiveis.reduce((s, c) => s + c.valor_acumulado, 0);
    const totalNoMes = categorias.reduce((s, c) => s + c.valor_no_mes, 0);
    const totalProjeto = data.reduce((s, c) => s + c.valor_total, 0);

    res.status(200).json({
      mes,
      total_acumulado: Math.round(totalAcumulado * 100) / 100,
      total_no_mes: Math.round(totalNoMes * 100) / 100,
      total_projeto: Math.round(totalProjeto * 100) / 100,
      qtd_categorias: categoriasVisiveis.length,
      categorias: categoriasVisiveis
    });
  } catch (err) {
    console.error('Erro custos-indiretos-planejados:', err);
    res.status(500).json({ error: err.message });
  }
}
