

# Fix: Appointments Disappearing After Deletion

## Root Cause (2 bugs)

**Bug 1 — `deleteAppointment` does NOT block realtime**: Unlike `addAppointment` (which sets `isManualOperationRef.current = true`), `deleteAppointment` never sets this flag. So the DELETE triggers a Postgres realtime event, which hits the handler at line 228.

**Bug 2 — Realtime handler REPLACES all appointments with only current ±1 month**: The handler (line 238-239) loads only `now ± 1 month` and calls `setAppointments(apps)`, completely replacing the state. If the user navigated to a different month (e.g., May 2026 as in the screenshot), those appointments are wiped out. Even for the current month range, the timing can cause a flash where all appointments disappear.

**Combined effect**: User deletes one appointment → realtime event fires immediately → handler replaces entire state with a fresh query (which may resolve before the optimistic update settles, or may only cover current ±1 months) → all appointments vanish.

The WebSocket error in the console screenshot is the realtime connection failing, which means after the state is wiped by the handler's query, there's no subsequent realtime event to recover it.

## Fix Plan

### 1. Block realtime during `deleteAppointment` (same pattern as `addAppointment`)

**File**: `src/contexts/AgendaContext.tsx` (line ~440)

Add `isManualOperationRef.current = true` at the start of `deleteAppointment`, and reset it in `finally` with a timeout — identical to the pattern already used in `addAppointment`.

### 2. Realtime handler: MERGE instead of REPLACE

**File**: `src/contexts/AgendaContext.tsx` (lines 233-240)

Instead of `setAppointments(apps)` (full replace), use a merge strategy:

```typescript
// On realtime event, merge with existing state
setAppointments(prev => {
  const freshIds = new Set(apps.map(a => a.id));
  // Keep appointments from OTHER months (not in the reloaded range)
  const kept = prev.filter(a => {
    const d = a.date instanceof Date ? a.date : new Date(a.date);
    const dateStr = format(d, 'yyyy-MM-dd');
    // If appointment is within the reloaded range, let the fresh data decide
    if (dateStr >= rangeStart && dateStr <= rangeEnd) {
      return false; // will be replaced by fresh data
    }
    return true; // keep appointments outside reloaded range
  });
  return [...kept, ...apps];
});
```

This ensures appointments from months outside the reloaded range survive the realtime update.

### 3. Add realtime reconnection resilience

**File**: `src/contexts/AgendaContext.tsx`

The WebSocket failure shown in the screenshot means the realtime channel dies silently. Add a subscription status check: if the channel enters `CHANNEL_ERROR` or `TIMED_OUT`, attempt to reload data once to recover.

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AgendaContext.tsx` | Add manual operation lock to `deleteAppointment`, merge strategy in realtime handler, reconnection on channel error |

## Impact

- Deleting an appointment no longer wipes all other appointments
- Navigating to distant months preserves their data during realtime events
- WebSocket failures trigger a data reload instead of leaving stale/empty state

