// pages/api/custos/import.js
//
// POST — recebe um arquivo .xlsx (multipart/form-data) + campo "competencia"
//        parseia, valida e insere no Supabase.
//
// Query params:
//   ?preview=true  → retorna os dados parseados SEM inserir (para o usuário confirmar)
//   ?preview=false → insere e retorna { inserted, skipped, errors }

import formidable from 'formidable'
import * as XLSX   from 'xlsx'
import fs          from 'fs'
import { createClient } from '@supabase/supabase-js'

// Desabilita o bodyParser padrão do Next.js para processar multipart
export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Converte serial do Excel para Date ISO
function excelDateToISO(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'string') {
    // Formato DD/MM/YYYY
    if (v.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = v.split('/')
      return `${y}-${m}-${d}`
    }
    // Formato YYYY-MM-DD (com ou sem HH:MM:SS)
    if (v.match(/^\d{4}-\d{2}-\d{2}/)) {
      return v.slice(0, 10)
    }
  }
  if (typeof v === 'number') {
    const date = new Date(Math.round((v - 25569) * 86400 * 1000))
    return date.toISOString().split('T')[0]
  }
  return null
}

// Normaliza valor monetário (string ou número)
function parseValor(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Parser do arquivo .xlsx — lê aba "Lançamentos"
function parseXlsx(filePath) {
  const wb   = XLSX.readFile(filePath, { cellDates: false })
  const sheetName = wb.SheetNames.includes('Lançamentos') ? 'Lançamentos' : wb.SheetNames[0]
  const ws   = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Detecta linha de cabeçalho (procura por "#" ou "Data Emissão")
  let headerRow = -1
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i]
    if (r && (r[0] === '#' || String(r[1] || '').toLowerCase().includes('data emissão') ||
              String(r[1] || '').toLowerCase().includes('data emiss'))) {
      headerRow = i
      break
    }
  }
  if (headerRow === -1) throw new Error('Cabeçalho não encontrado. Verifique se a aba se chama "Lançamentos".')

  const parsed   = []
  const warnings = []

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === null || c === '')) continue

    // Linha de total ou alerta
    const first = String(row[0] || '').trim()
    if (first.startsWith('TOTAL') || first.startsWith('⚠') || first === '') continue

    // Coluna 0 deve ser número sequencial
    const seq = parseInt(row[0])
    if (isNaN(seq)) continue

    const valor = parseValor(row[9])
    if (valor === null) {
      warnings.push(`Linha ${i + 1}: valor inválido ("${row[9]}") — ignorada`)
      continue
    }

    parsed.push({
      seq,
      data_emissao:    excelDateToISO(row[1]),
      fornecedor:      String(row[2] || '').trim() || null,
      historico:       String(row[3] || '').trim() || null,
      classificacao:   String(row[4] || '').trim() || null,
      grupo_custo:     String(row[5] || '').trim() || null,
      fase_obra:       String(row[6] || '').trim() || null,
      num_documento:   String(row[7] || '').trim() || null,
      data_vencimento: excelDateToISO(row[8]),
      valor,
      status:          String(row[10] || 'Normal').trim(),
    })
  }

  return { parsed, warnings }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const preview = req.query.preview !== 'false' // default = preview mode

  // ── Parse multipart ──────────────────────────────────────────
  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }) // 10 MB
  let fields, files
  try {
    ;[fields, files] = await form.parse(req)
  } catch (err) {
    return res.status(400).json({ error: `Erro ao receber arquivo: ${err.message}` })
  }

  const competencia = Array.isArray(fields.competencia)
    ? fields.competencia[0]
    : fields.competencia

  if (!competencia || !competencia.trim()) {
    return res.status(400).json({ error: 'Campo "competencia" é obrigatório (ex: Maio/2026)' })
  }

  const file = Array.isArray(files.arquivo) ? files.arquivo[0] : files.arquivo
  if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado. Use o campo "arquivo".' })

  // ── Parsear XLSX ──────────────────────────────────────────────
  let parsed, warnings
  try {
    ;({ parsed, warnings } = parseXlsx(file.filepath))
  } catch (err) {
    return res.status(422).json({ error: `Erro ao ler planilha: ${err.message}` })
  } finally {
    try { fs.unlinkSync(file.filepath) } catch {}
  }

  if (parsed.length === 0) {
    return res.status(422).json({
      error: 'Nenhum lançamento válido encontrado na planilha.',
      warnings
    })
  }

  // ── Modo preview: retorna os dados sem inserir ──────────────
  if (preview) {
    return res.status(200).json({
      preview:     true,
      competencia,
      total:       parsed.length,
      total_valor: parsed.filter(r => r.status === 'Normal').reduce((s, r) => s + r.valor, 0),
      lancamentos: parsed,
      warnings,
    })
  }

  // ── Modo commit: insere no Supabase ──────────────────────────

  // Evita duplicação: apaga lançamentos já existentes para essa competência + obra
  const obra_id = fields.obra_id?.[0] || 'flats_pampulha'
  await supabase
    .from('custos_lancamentos')
    .delete()
    .eq('obra_id', obra_id)
    .eq('competencia', competencia)

  const toInsert = parsed.map(r => ({
    obra_id,
    competencia,
    ...r,
  }))

  const { data, error } = await supabase
    .from('custos_lancamentos')
    .insert(toInsert)
    .select()

  if (error) {
    return res.status(500).json({ error: `Erro ao inserir: ${error.message}` })
  }

  return res.status(201).json({
    preview:     false,
    competencia,
    inserted:    data.length,
    skipped:     parsed.length - data.length,
    total_valor: data.filter(r => r.status === 'Normal').reduce((s, r) => s + Number(r.valor), 0),
    warnings,
  })
}