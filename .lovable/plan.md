

# Fix: `checkout-process-payment` Boot Failure

## Problem

The edge function crashes on boot with:
```
Uncaught SyntaxError: Identifier 'installmentCount' has already been declared at line 248
```

`installmentCount` is destructured from the request body (line 39), then redeclared with `const` on line 295. Deno treats this as a duplicate declaration in the same scope, causing a boot failure. Since the function never boots, ALL payment requests fail with a CORS/network error.

## Fix

**File:** `supabase/functions/checkout-process-payment/index.ts`

Line 295: rename the second variable to avoid the conflict:

```typescript
// Before (line 295):
const installmentCount = paymentBody.installmentCount as number | undefined;

// After:
const resolvedInstallmentCount = paymentBody.installmentCount as number | undefined;
```

Update line 296 to use the new name:
```typescript
const totalParcelas = resolvedInstallmentCount && resolvedInstallmentCount > 1 ? resolvedInstallmentCount : 1;
```

Then redeploy the function.

## Impact

Only `checkout-process-payment` is affected. No other files need changes — this is a single-variable naming collision introduced during the last edit.

