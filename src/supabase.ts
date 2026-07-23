import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = (): string => {
  return import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('eoc_supabase_url') || 'https://yrxzpmbubhfknirhhagd.supabase.co';
};

const getSupabaseAnonKey = (): string => {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('eoc_supabase_anon_key') || 'sb_publishable_SiAMK5c3yzOEiU83qut4Iw_UPbdSrsv';
};

export const supabaseUrl = getSupabaseUrl();
export const supabaseAnonKey = getSupabaseAnonKey();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('YOUR_SUPABASE')
);

// Initialize Supabase Client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Upload a File to Supabase Storage bucket and return its public URL.
 * Falls back to base64 Data URL if Supabase storage is not configured.
 */
export async function uploadFileToStorage(file: File, path: string): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    try {
      const bucket = 'reference-logos';
      const cleanPath = path.replace(/^\/+/, '');
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(cleanPath, file, { upsert: true });

      if (error) {
        console.warn('Supabase storage upload returned error, using base64 fallback:', error.message);
      } else if (data) {
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(cleanPath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (err) {
      console.warn('Supabase Storage upload exception, using base64 fallback:', err);
    }
  }

  // Base64 Data URL Fallback
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
