// pages/api/curva-s.js
// Retorna dados da Curva S (planejado vs realizado)

import { createClient } from '@supabase/supabase-js';
import { getHHPlanejadoAcumulado, getTotalPlanejadoHH } from '../../lib/cronograma-hh';

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

    const [{ data: orcamentoData, error: orcamentoError }, { data: realizadoData, error: realizadoError }] = await Promise.all([
      supabase.from('orcamento_planejado').select('hh, mes_inicio, mes_fim').eq('obra_id', obra_id),
      supabase.from('avanco_fisico_realizado').select('mes_numero, hh_realizado, codigo_eap, atividade_nome, pavimento').eq('obra_id', obra_id)
    ]);

    if (orcamentoError) throw orcamentoError;
    if (realizadoError) throw realizadoError;

    const itens = orcamentoData || [];
    const totalHh = getTotalPlanejadoHH() || itens.reduce((sum, item) => sum + (parseFloat(item.hh || 0) || 0), 0);

    const ultimoRealizadoPorItem = new Map();
    (realizadoData || []).forEach(item => {
      const key = item.codigo_eap || `${item.atividade_nome || 'atividade'}|${item.pavimento || ''}`;
      const novo = {
        ...item,
        hh_realizado: parseFloat(item.hh_realizado || 0),
        mes_numero: parseInt(item.mes_numero || 0)
      };
      const atual = ultimoRealizadoPorItem.get(key);
      if (!atual || novo.mes_numero > atual.mes_numero || (novo.mes_numero === atual.mes_numero && novo.hh_realizado > atual.hh_realizado)) {
        ultimoRealizadoPorItem.set(key, novo);
      }
    });

    const labels = [];
    const planejado = [];
    const realizado = [];

    for (let mes = 1; mes <= 20; mes++) {
      const mesLabel = `M${mes}`;
      labels.push(mesLabel);

      const planejadoAcum = getHHPlanejadoAcumulado(mes);

      const realizadoAcum = Array.from(ultimoRealizadoPorItem.values()).reduce((sum, item) => {
        return (parseInt(item.mes_numero || 0) <= mes) ? sum + (parseFloat(item.hh_realizado || 0) || 0) : sum;
      }, 0);

      planejado.push(totalHh > 0 ? (planejadoAcum / totalHh) * 100 : 0);
      realizado.push(totalHh > 0 ? (realizadoAcum / totalHh) * 100 : 0);
    }

    const raw = labels.map((label, index) => ({
      mes: index + 1,
      competencia: label,
      planejado_acumulado: planejado[index],
      realizado_acumulado: realizado[index]
    }));

    res.status(200).json({
      labels,
      datasets: [
        {
          label: 'Planejado Acumulado',
          data: planejado,
          borderColor: '#8B6F47',
          backgroundColor: 'rgba(139, 111, 71, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Realizado Acumulado',
          data: realizado,
          borderColor: '#3A6B1A',
          backgroundColor: 'rgba(58, 107, 26, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        }
      ],
      raw
    });

  } catch (error) {
    console.error('Erro ao buscar Curva S:', error);
    res.status(500).json({ error: error.message });
  }
}

