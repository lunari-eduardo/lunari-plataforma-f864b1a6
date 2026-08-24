-- Change default email settings to false for new users (except photographer summary)
ALTER TABLE gallery_settings
ALTER COLUMN email_sending_enabled SET DEFAULT false,
ALTER COLUMN email_on_gallery_sent SET DEFAULT false,
ALTER COLUMN email_on_payment_confirmed SET DEFAULT false,
ALTER COLUMN email_on_gallery_reactivated SET DEFAULT false,
ALTER COLUMN email_on_selection_reminder SET DEFAULT false,
ALTER COLUMN email_on_selection_confirmed SET DEFAULT false;
