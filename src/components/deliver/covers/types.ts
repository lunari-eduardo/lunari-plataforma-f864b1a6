import type { PhotoPaths } from '@/lib/photoUrl';
import type { TitleCaseMode } from '@/types/gallery';
import type { ComponentType, LazyExoticComponent } from 'react';

export interface CoverVariantProps {
  coverPhoto: PhotoPaths | null;
  sessionName: string;
  subtitle?: string;
  sessionDate?: string | Date | null;
  category?: string;
  issueNumber?: string;
  studioName?: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  isDark?: boolean;
  textColor?: string;
  textOverlayColor?: string;
  primaryColor?: string;
  onEnter: () => void;
}

export interface CoverVariant {
  id: string;
  name: string;
  description: string;
  Component: LazyExoticComponent<ComponentType<CoverVariantProps>>;
  Thumbnail: ComponentType<{ className?: string }>;
}
