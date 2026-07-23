import { supabase, isSupabaseConfigured } from './supabase';
import { getUserByEmail, recordUserLogin, ensureSeedData, addUserAccount } from './db';
import { UserAccount, UserRole } from './types';
import { PRIMARY_ADMIN_EMAIL } from './seed';

export interface AuthState {
  user: { email: string; displayName?: string; photoURL?: string } | null;
  account: UserAccount | null;
  loading: boolean;
  accessDenied: boolean;
  deniedEmail: string | null;
}

let currentAuthState: AuthState = {
  user: null,
  account: null,
  loading: true,
  accessDenied: false,
  deniedEmail: null
};

type AuthListener = (state: AuthState) => void;
const listeners: AuthListener[] = [];

export function subscribeAuth(listener: AuthListener) {
  listeners.push(listener);
  listener(currentAuthState);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach(fn => fn(currentAuthState));
}

export function getCurrentAuthState(): AuthState {
  return currentAuthState;
}

/**
 * Trigger Google Sign In via Supabase OAuth
 */
export async function loginWithGoogle() {
  if (isSupabaseConfigured && supabase) {
    try {
      currentAuthState = { ...currentAuthState, loading: true };
      notifyListeners();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.warn('Supabase Google Sign-In error:', err);
      currentAuthState = { ...currentAuthState, loading: false };
      notifyListeners();
      alert(`Supabase OAuth Notice: ${err.message || 'Unable to log in with Google.'}\n\nYou can also sign in directly using your authorized DSWD or Admin email address!`);
    }
  } else {
    // If Supabase is not yet configured with keys, prompt email login directly
    const userEmail = prompt("Enter your authorized DSWD or Admin email address to log in:");
    if (userEmail) {
      await loginWithEmail(userEmail);
    } else {
      currentAuthState = { ...currentAuthState, loading: false };
      notifyListeners();
    }
  }
}

/**
 * Trigger Sign Out
 */
export async function logoutUser() {
  localStorage.removeItem('eoc_authorized_email');
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase SignOut warning:', err);
    }
  }
  currentAuthState = {
    user: null,
    account: null,
    loading: false,
    accessDenied: false,
    deniedEmail: null
  };
  notifyListeners();
}

/**
 * Sign in directly with an authorized email (Direct Access for DSWD / Admin personnel)
 */
export async function loginWithEmail(emailInput: string) {
  const email = emailInput.toLowerCase().trim();
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  currentAuthState = { ...currentAuthState, loading: true };
  notifyListeners();

  try {
    try {
      await ensureSeedData(email);
    } catch (e) {
      console.warn('Seed data warning (proceeding):', e);
    }

    let account: UserAccount | null = null;
    try {
      account = await getUserByEmail(email);
    } catch (e) {
      console.warn('getUserByEmail warning (proceeding):', e);
    }

    // If account doesn't exist, check if email is admin email or dswd email
    if (!account) {
      const isPrimary = email === PRIMARY_ADMIN_EMAIL.toLowerCase();
      const isDswd = email.endsWith('@dswd.gov.ph') || email === 'mblvillareal@dswd.gov.ph';

      if (isPrimary || isDswd) {
        account = {
          id: email,
          email,
          name: email.split('@')[0].replace('.', ' ').toUpperCase(),
          role: 'Admin' as UserRole,
          status: 'Active',
          createdAt: new Date().toISOString()
        };

        try {
          await addUserAccount(account);
        } catch (e) {
          console.warn('addUserAccount warning (proceeding):', e);
        }
      }
    }

    if (!account || account.status === 'Suspended') {
      currentAuthState = {
        user: null,
        account: null,
        loading: false,
        accessDenied: true,
        deniedEmail: email
      };
      notifyListeners();
      return;
    }

    // Record login and save local auth email
    try {
      await recordUserLogin(email, account.name);
    } catch (e) {
      console.warn('recordUserLogin warning:', e);
    }
    localStorage.setItem('eoc_authorized_email', email);

    currentAuthState = {
      user: { email, displayName: account.name },
      account: account,
      loading: false,
      accessDenied: false,
      deniedEmail: null
    };

    notifyListeners();
  } catch (err: any) {
    currentAuthState = { ...currentAuthState, loading: false };
    notifyListeners();
    throw err;
  }
}

/**
 * Initialize Auth Listener
 */
export function initAuth() {
  // Check for stored local email auth first for seamless access
  const savedEmail = localStorage.getItem('eoc_authorized_email');
  if (savedEmail) {
    loginWithEmail(savedEmail).catch((err) => {
      console.warn('Auto restore email auth failed:', err);
      localStorage.removeItem('eoc_authorized_email');
    });
  } else {
    currentAuthState = { ...currentAuthState, loading: false };
    notifyListeners();
  }

  // Supabase Auth State Listener
  if (isSupabaseConfigured && supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && session.user.email) {
        const email = session.user.email.toLowerCase().trim();
        try {
          await loginWithEmail(email);
        } catch (e) {
          console.warn('Supabase auth state login error:', e);
        }
      }
    });
  }
}
