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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    
    // Validate JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    const userId = user.id

    console.log(`Solicitação de exclusão recebida para o usuário: ${userId}. Iniciando período de retenção de 30 dias.`)

    // Em vez de deletar, marcamos o perfil como 'pending_deletion'
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        account_status: 'pending_deletion',
        deletion_requested_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
        console.error("Erro ao atualizar status do perfil:", updateError)
        throw updateError
    }

    // Opcional: Deslogar o usuário ou invalidar sessões se necessário, 
    // mas o frontend lidará com o logout após a resposta de sucesso.

    return new Response(
      JSON.stringify({ 
        message: 'Solicitação de exclusão registrada. A conta entrará em retenção por 30 dias.',
        retention_days: 30
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error("Erro na funcao account-destruction:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
