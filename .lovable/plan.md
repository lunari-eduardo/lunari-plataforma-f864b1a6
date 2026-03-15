

# Fix: Lead Cards Flash Back to Original Column During Drag

## Problem
When dropping a lead card into a new column, it briefly flashes/appears in the original column before moving. This happens because:

1. `onDragEnd` fires → calls `updateLead()` (async Supabase mutation) → then sets `activeId = null`
2. Setting `activeId = null` removes the DragOverlay and makes the original card visible again (`opacity: 0` → `opacity: 1`)
3. The card stays in the old column until the mutation succeeds and `invalidateQueries` refetches data

There is no **optimistic update** — the UI waits for the server round-trip.

## Solution
Add optimistic cache update to the `updateLeadMutation` in `useSupabaseLeads.ts`. This immediately updates the React Query cache before the Supabase call completes, so the card appears in the new column instantly.

## Changes

### `src/hooks/useSupabaseLeads.ts`
Add `onMutate` to `updateLeadMutation`:

- **Before mutation fires**: Snapshot current cache, then optimistically update the lead's status in the query cache
- **On error**: Roll back to the snapshot
- **On settled**: Always invalidate to ensure consistency

```text
onMutate → cancel queries → snapshot cache → update cache optimistically
onError  → restore snapshot
onSettled → invalidateQueries (replaces current onSuccess)
```

This is the standard React Query optimistic update pattern. One file changed.

