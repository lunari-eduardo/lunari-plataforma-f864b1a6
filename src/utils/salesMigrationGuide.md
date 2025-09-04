# Sales Analytics Migration Guide

## Overview
This guide documents the refactoring of the sales analytics system for Supabase migration while maintaining backward compatibility.

## Architecture Changes

### Before (Original)
```
src/hooks/useSalesAnalytics.ts (310 lines)
├── Direct localStorage access
├── Inline data normalization
├── Mixed concerns (data + calculations)
└── Hard to test and migrate
```

### After (Refactored)
```
src/domain/sales/
├── sales-domain.ts              # Domain types
├── SalesDataSource.ts           # Data source interface
├── LocalStorageSalesDataSource.ts # Current localStorage implementation
├── SupabaseSalesDataSource.ts   # Future Supabase implementation
├── SalesRepository.ts           # Business logic layer
└── salesDataSourceFactory.ts   # Factory for data source selection

src/hooks/
├── useSalesAnalytics.ts         # Original (unchanged)
├── useSalesAnalyticsRefactored.ts # New implementation
└── useSalesAnalyticsWrapper.ts  # Feature flag wrapper
```

## Usage

### Current (Default)
```typescript
import { useSalesAnalytics } from '@/hooks/useSalesAnalytics';

// Uses original implementation
const { salesMetrics, monthlyData } = useSalesAnalytics(2024, null, 'all');
```

### Enable Refactored Version
Set environment variable:
```bash
VITE_USE_REFACTORED_SALES=true
```

## Feature Flags

### Available Environment Variables
- `VITE_USE_REFACTORED_SALES` - Enable refactored architecture
- `VITE_SALES_DATA_SOURCE` - Data source type ('localStorage' | 'supabase')  
- `VITE_DEBUG_SALES` - Enable debug logging

### Data Source Selection Priority
1. `VITE_SALES_DATA_SOURCE` environment variable
2. Auto-detect Supabase configuration
3. Default to localStorage

## Migration Plan

### Phase 1: Architecture (✅ Complete)
- [x] Create domain layer with clean interfaces
- [x] Implement LocalStorage data source
- [x] Implement repository pattern
- [x] Add feature flag wrapper
- [x] Create Supabase stub

### Phase 2: Testing & Validation
- [ ] Test refactored version with feature flag
- [ ] Validate data consistency between versions
- [ ] Performance benchmarking
- [ ] Error handling verification

### Phase 3: Migration
- [ ] Enable refactored version by default
- [ ] Remove original implementation
- [ ] Clean up dead code

### Phase 4: Supabase Integration
- [ ] Implement Supabase data source
- [ ] Database schema migration
- [ ] Switch to Supabase by default

## Testing

### Enable Refactored Version
```bash
# In .env or environment
VITE_USE_REFACTORED_SALES=true
VITE_DEBUG_SALES=true
```

### Validation Checklist
- [ ] Same metrics values as original
- [ ] Same monthly data structure
- [ ] Same filtering behavior
- [ ] Same performance characteristics
- [ ] Error handling works correctly

## Benefits

### Clean Architecture
- Separation of concerns
- Testable components
- Easy to extend

### Supabase Ready
- Database-agnostic interfaces
- Async-first design
- Query optimization ready

### Maintainable
- Smaller, focused files
- Clear dependencies
- Type-safe throughout

## Rollback Plan

If issues are found:
1. Set `VITE_USE_REFACTORED_SALES=false`
2. Original implementation remains unchanged
3. Fix issues in refactored version
4. Re-enable when ready

## Future Enhancements

### When Supabase is Available
1. Enable Supabase data source
2. Migrate data to database
3. Remove localStorage fallback
4. Add real-time subscriptions

### Performance Optimizations
- React Query caching
- Optimistic updates
- Background data fetching
- Memoized calculations