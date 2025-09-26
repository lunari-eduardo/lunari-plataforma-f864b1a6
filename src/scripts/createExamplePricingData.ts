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
        { min: 1, max: 50, valor: 25.0 },
        { min: 51, max: 100, valor: 22.5 },
        { min: 101, max: 200, valor: 20.0 },
        { min: 201, max: null, valor: 15.0 }
      ]
    };

    const { data: globalData, error: globalError } = await supabase
      .from('tabelas_precos')
      .upsert(globalTableData, {
        onConflict: 'user_id,tipo'
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
            { min: 1, max: 30, valor: 30.0 },
            { min: 31, max: 80, valor: 27.5 },
            { min: 81, max: 150, valor: 25.0 },
            { min: 151, max: null, valor: 20.0 }
          ]
        };

        const { data: categoryData, error: categoryError } = await supabase
          .from('tabelas_precos')
          .upsert(categoryTableData, {
            onConflict: 'user_id,tipo,categoria_id'
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