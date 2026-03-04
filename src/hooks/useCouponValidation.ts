import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CouponResult {
  valid: boolean;
  couponId?: string;
  code?: string;
  discountType?: 'percentage' | 'fixed_cents';
  discountValue?: number;
  description?: string;
  error?: string;
}

export function useCouponValidation() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CouponResult | null>(null);

  const validate = useCallback(async (code: string, planCode?: string, appliesTo?: string) => {
    if (!code.trim()) {
      setResult(null);
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        const res: CouponResult = { valid: false, error: 'Cupom não encontrado' };
        setResult(res);
        return res;
      }

      const now = new Date();
      if (data.valid_from && new Date(data.valid_from) > now) {
        const res: CouponResult = { valid: false, error: 'Cupom ainda não está válido' };
        setResult(res);
        return res;
      }
      if (data.valid_until && new Date(data.valid_until) < now) {
        const res: CouponResult = { valid: false, error: 'Cupom expirado' };
        setResult(res);
        return res;
      }
      if (data.max_uses !== null && data.current_uses >= data.max_uses) {
        const res: CouponResult = { valid: false, error: 'Cupom esgotado' };
        setResult(res);
        return res;
      }

      // Check applies_to
      if (data.applies_to !== 'all' && appliesTo && data.applies_to !== appliesTo) {
        const res: CouponResult = { valid: false, error: 'Cupom não aplicável a este produto' };
        setResult(res);
        return res;
      }

      // Check plan_codes
      if (data.plan_codes && data.plan_codes.length > 0 && planCode && !data.plan_codes.includes(planCode)) {
        const res: CouponResult = { valid: false, error: 'Cupom não aplicável a este plano' };
        setResult(res);
        return res;
      }

      const res: CouponResult = {
        valid: true,
        couponId: data.id,
        code: data.code,
        discountType: data.discount_type as 'percentage' | 'fixed_cents',
        discountValue: data.discount_value,
        description: data.description || undefined,
      };
      setResult(res);
      return res;
    } catch {
      const res: CouponResult = { valid: false, error: 'Erro ao validar cupom' };
      setResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setResult(null), []);

  const calculateDiscount = useCallback((originalCents: number): number => {
    if (!result?.valid) return 0;
    if (result.discountType === 'percentage') {
      return Math.round(originalCents * (result.discountValue! / 100));
    }
    return Math.min(result.discountValue!, originalCents);
  }, [result]);

  return { validate, clear, result, loading, calculateDiscount };
}
