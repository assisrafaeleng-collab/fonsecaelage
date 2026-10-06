// pages/avanco-fisico-realizado.js
//
// Tela antiga de lancamento de avanco: DESATIVADA (out/26). Ela gravava
// INCREMENTOS no avanco_fisico_historico, e a regra atual le cada registro
// como o % ACUMULADO do item — um lancamento por aqui distorcia o avanco.
// O avanco agora e lancado na pagina semanal; o endereco antigo leva para la.
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AvancoFisicoRealizadoDesativado() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/semanal')
  }, [router])
  return (
    <div className="page">
      <div className="loading">
        Esta tela foi desativada: o avanço físico é lançado no Acompanhamento semanal. Abrindo...
      </div>
    </div>
  )
}
