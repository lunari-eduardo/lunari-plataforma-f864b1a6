/**
 * Script to create example pricing data for testing
 */

import { supabase } from '@/integrations/supabase/client';

export async function createExamplePricingData() {
  try {
    console.log('🔄 Creating example pricing data...');
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get categories
    const { data: categories, error: categoryError } = await supabase
      .from('categorias')
      .select('id, nome')
      .limit(3);

    if (categoryError) {
      throw new Error(`Failed to get categories: ${categoryError.message}`);
    }

    // Create global pricing table
    const globalTableData = {
      user_id: user.id,
      nome: 'Tabela Global de Preços',
      tipo: 'global',
      categoria_id: null,
      faixas: [
        {
          de: 1,
          ate: 50,
          valor_foto_extra: 25.00
        },
        {
          de: 51,
          ate: 100,
          valor_foto_extra: 22.50
        },
        {
          de: 101,
          ate: 200,
          valor_foto_extra: 20.00
        },
        {
          de: 201,
          ate: 999999,
          valor_foto_extra: 15.00
        }
      ]
    };

    const { data: globalData, error: globalError } = await supabase
      .from('tabelas_precos')
      .upsert(globalTableData, {
        onConflict: 'tabelas_precos_global_unique'
      })
      .select()
      .single();

    if (globalError) {
      console.error('Failed to create global table:', globalError);
    } else {
      console.log('✅ Created global pricing table:', globalData.nome);
    }

    // Create category pricing tables
    if (categories && categories.length > 0) {
      for (const category of categories) {
        const categoryTableData = {
          user_id: user.id,
          nome: `Tabela ${category.nome}`,
          tipo: 'categoria',
          categoria_id: category.id,
          faixas: [
            {
              de: 1,
              ate: 30,
              valor_foto_extra: 30.00
            },
            {
              de: 31,
              ate: 80,
              valor_foto_extra: 27.50
            },
            {
              de: 81,
              ate: 150,
              valor_foto_extra: 25.00
            },
            {
              de: 151,
              ate: 999999,
              valor_foto_extra: 20.00
            }
          ]
        };

        const { data: categoryData, error: categoryError } = await supabase
          .from('tabelas_precos')
          .upsert(categoryTableData, {
            onConflict: 'tabelas_precos_categoria_unique'
          })
          .select()
          .single();

        if (categoryError) {
          console.error(`Failed to create category table for ${category.nome}:`, categoryError);
        } else {
          console.log(`✅ Created category pricing table: ${categoryData.nome}`);
        }
      }
    }

    console.log('🎉 Example pricing data creation completed!');
    return true;
  } catch (error) {
    console.error('❌ Failed to create example pricing data:', error);
    return false;
  }
}