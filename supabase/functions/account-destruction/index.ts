import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    const userId = user.id

    console.log(\`Iniciando destruição da conta para o usuário: \${userId}\`)

    // 1. Marcar perfil como em exclusão (soft-ish para auditoria rápida antes do delete)
    await supabaseClient
      .from('profiles')
      .update({ suspected_duplicate: true }) // Reusando coluna para flag de "em processo"
      .eq('user_id', userId)

    // 2. O banco de dados deve ter ON DELETE CASCADE na maioria das tabelas vinculadas a auth.users.
    // Vamos garantir a remoção de arquivos no R2 antes de deletar o usuário.
    // TODO: Adicionar chamada para r2-delete-all-user-files se necessário

    // 3. Deletar o usuário do Auth (isso deve disparar os cascades no banco)
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return new Response(
      JSON.stringify({ message: 'Conta excluída com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
