export type UserRole = 'Admin' | 'Viewer' | 'admin' | 'viewer';

export interface UserAccount {
  id: string; // doc ID (user email address, e.g., admin@gmail.com)
  email: string;
  name?: string;
  role: UserRole;
  status?: 'Active' | 'Suspended';
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface ReferenceItem {
  id: string;
  title: string;
  icon: 'drive' | 'sheets' | 'slides' | 'meet' | 'forms' | 'pdf' | 'website' | string;
  logoUrl?: string;
  logo?: string;
  category: string;
  badge?: string;
  url: string;
  description?: string;
  visible: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortalSettings {
  title?: string;
  mainTitle?: string;
  subtitle?: string;
  footer?: string;
  agencyName?: string;
  bannerImage?: string;
  bannerUrl?: string;
  logo?: string;
  logoUrl?: string;
  bannerHeight?: number;
  primaryColor?: string;
  secondaryColor?: string;
  headerBgColor?: string;
}
