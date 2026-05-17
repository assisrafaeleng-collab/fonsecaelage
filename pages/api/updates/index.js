// pages/api/updates/index.js
// API com integração automática de custos

import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Buscar todas as atualizações com custos integrados
    try {
      const { data: updates, error: updatesError } = await supabase
        .from('atualizacoes_obra')
        .select('*')
        .eq('obra_id', 'flats_pampulha')
        .order('data', { ascending: true });

      if (updatesError) throw updatesError;

      // Para cada atualização, calcular custos até aquela data
      const enriched = await Promise.all(updates.map(async (u) => {
        // Buscar custos até a data da atualização
        const { data: custos, error: custosError } = await supabase
          .from('custos_lancamentos')
          .select('valor')
          .eq('obra_id', 'flats_pampulha')
          .eq('status', 'Normal')