-- Add new email toggles to gallery_settings
ALTER TABLE gallery_settings
ADD COLUMN email_on_selection_reminder boolean DEFAULT true,
ADD COLUMN email_on_selection_confirmed boolean DEFAULT true,
ADD COLUMN email_summary_to_photographer boolean DEFAULT true,
ADD COLUMN reminder_days_before_expiration integer DEFAULT 2;
