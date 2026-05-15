// pages/api/curva-s.js
// Retorna dados da Curva S (planejado vs realizado)

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

    // Buscar curva S completa da view
    const { data, error } = await supabase
      .from('v_curva_s_completa')
      .select('*')
      .eq('obra_id', obra_id)
      .order('mes');

    if (error) throw error;

    // Formatar dados para o gráfico
    const labels = data.map(d => d.competencia);
    const planejado = data.map(d => parseFloat(d.planejado_acumulado) || 0);
    const realizado = data.map(d => parseFloat(d.realizado_acumulado) || 0);

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
      raw: data
    });

  } catch (error) {
    console.error('Erro ao buscar Curva S:', error);
    res.status(500).json({ error: error.message });
  }
}

