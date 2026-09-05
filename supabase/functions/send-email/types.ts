export type EventType =
  | 'gallery_sent'
  | 'payment_confirmed'
  | 'gallery_reactivated'
  | 'selection_confirmed'
  | 'selection_reminder'
  | 'summary_sent';

export interface RequestBody {
  eventType?: EventType;
  galleryId?: string;
  paymentId?: string;
  publicToken?: string;
  visitorId?: string;
  forceResend?: boolean;
  isDeliver?: boolean;
  customSubject?: string;
  customBody?: string;
  recipientEmail?: string;
}

export interface DetailItem {
  label: string;
  value: string;
  isBold?: boolean;
}

export interface BuildLayoutParams {
  preview: string;
  title: string;
  children: string;
  buttonUrl?: string;
  buttonText?: string;
  studioName: string;
  studioLogoUrl?: string | null;
  primaryColor?: string | null;
  badgeText?: string | null;
  details?: DetailItem[];
}

export interface EventHandlerContext {
  supabase: any;
  callerUserId: string;
  body: RequestBody;
}
