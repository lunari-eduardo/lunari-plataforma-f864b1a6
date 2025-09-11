-- Phase 7: Safe cleanup of duplicate sessions (keeping oldest for each appointment)
-- This will run after the unique index is in place to safely remove duplicates

DO $$
DECLARE
    duplicate_record RECORD;
    sessions_to_keep TEXT[];
    sessions_to_delete TEXT[];
    transaction_updates INTEGER := 0;
    sessions_deleted INTEGER := 0;
BEGIN
    -- Log start of cleanup
    RAISE NOTICE 'Starting duplicate session cleanup...';
    
    -- Find sessions to keep (oldest per user_id/appointment_id combination)
    FOR duplicate_record IN
        SELECT 
            user_id,
            appointment_id,
            MIN(created_at) as oldest_created_at,
            COUNT(*) as duplicate_count
        FROM public.clientes_sessoes 
        WHERE appointment_id IS NOT NULL 
        GROUP BY user_id, appointment_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Get the session to keep (oldest one)
        SELECT ARRAY_AGG(id::text) INTO sessions_to_keep
        FROM public.clientes_sessoes 
        WHERE user_id = duplicate_record.user_id 
        AND appointment_id = duplicate_record.appointment_id 
        AND created_at = duplicate_record.oldest_created_at;
        
        -- Get sessions to delete (all except the oldest)
        SELECT ARRAY_AGG(id::text) INTO sessions_to_delete
        FROM public.clientes_sessoes 
        WHERE user_id = duplicate_record.user_id 
        AND appointment_id = duplicate_record.appointment_id 
        AND created_at > duplicate_record.oldest_created_at;
        
        IF array_length(sessions_to_delete, 1) > 0 THEN
            -- Log what we're doing
            RAISE NOTICE 'Found % duplicates for appointment %, keeping session %, removing %', 
                duplicate_record.duplicate_count, 
                duplicate_record.appointment_id, 
                sessions_to_keep[1],
                array_to_string(sessions_to_delete, ', ');
            
            -- Update transactions to point to the session we're keeping
            -- Get session_ids for the sessions we're deleting
            FOR duplicate_record IN
                SELECT session_id 
                FROM public.clientes_sessoes 
                WHERE id = ANY(sessions_to_delete::uuid[])
            LOOP
                UPDATE public.clientes_transacoes 
                SET session_id = (
                    SELECT session_id 
                    FROM public.clientes_sessoes 
                    WHERE id = sessions_to_keep[1]::uuid
                )
                WHERE session_id = duplicate_record.session_id;
                
                GET DIAGNOSTICS transaction_updates = ROW_COUNT;
                IF transaction_updates > 0 THEN
                    RAISE NOTICE 'Updated % transactions from session % to %', 
                        transaction_updates, 
                        duplicate_record.session_id,
                        (SELECT session_id FROM public.clientes_sessoes WHERE id = sessions_to_keep[1]::uuid);
                END IF;
            END LOOP;
            
            -- Now safely delete the duplicate sessions
            DELETE FROM public.clientes_sessoes 
            WHERE id = ANY(sessions_to_delete::uuid[]);
            
            GET DIAGNOSTICS sessions_deleted = ROW_COUNT;
            RAISE NOTICE 'Deleted % duplicate sessions', sessions_deleted;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Duplicate cleanup completed successfully';
END $$;