import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MunicipioIBGE {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
        nome: string;
        regiao: {
          nome: string;
        };
      };
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se já existem municípios
    const { count } = await supabase
      .from('municipios_ibge')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Tabela já populada com ${count} municípios` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados da API do IBGE
    console.log('Buscando municípios da API do IBGE...');
    const response = await fetch(
      'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
    );

    if (!response.ok) {
      throw new Error(`Erro ao buscar IBGE: ${response.statusText}`);
    }

    const municipios: MunicipioIBGE[] = await response.json();
    console.log(`Recebidos ${municipios.length} municípios`);

    // Transformar para o formato do banco
    const dados = municipios.map((m) => ({
      id: m.id,
      nome: m.nome,
      uf: m.microrregiao.mesorregiao.UF.sigla,
      estado: m.microrregiao.mesorregiao.UF.nome,
      regiao: m.microrregiao.mesorregiao.UF.regiao.nome,
    }));

    // Inserir em lotes de 500
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < dados.length; i += BATCH_SIZE) {
      const batch = dados.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('municipios_ibge')
        .insert(batch);

      if (error) {
        console.error(`Erro no lote ${i / BATCH_SIZE}:`, error);
        throw error;
      }

      inserted += batch.length;
      console.log(`Inseridos ${inserted}/${dados.length}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Inseridos ${inserted} municípios com sucesso!` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
