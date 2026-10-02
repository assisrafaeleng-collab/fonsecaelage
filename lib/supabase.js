// Cliente do Supabase usado SOMENTE no servidor (rotas em pages/api).
// Usa a chave secreta (sb_secret_...), que ignora o RLS — por isso nunca pode
// ir para o navegador. Como SUPABASE_SECRET_KEY nao tem o prefixo NEXT_PUBLIC_,
// o Next nunca a coloca no codigo do navegador; a trava abaixo deixa claro o
// erro se alguma pagina ou componente importar este arquivo.
// (O pacote 'server-only' nao funciona no diretorio pages/ do Next 14.)
import { createClient } from '@supabase/supabase-js'

if (typeof window !== 'undefined') {
  throw new Error('lib/supabase.js é só para o servidor (pages/api). Não importe em páginas ou componentes.')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY).')
}

export const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
