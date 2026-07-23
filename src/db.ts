import { supabase, isSupabaseConfigured } from './supabase';
import { ReferenceItem, UserAccount, PortalSettings, UserRole } from './types';
import { DEFAULT_REFERENCES, DEFAULT_SETTINGS, PRIMARY_ADMIN_EMAIL } from './seed';

// Local storage fallback keys
const STORAGE_REFS_KEY = 'eoc_references_store';
const STORAGE_SETTINGS_KEY = 'eoc_settings_store';
const STORAGE_USERS_KEY = 'eoc_users_store';

// Helper to read local storage
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (err) {
    console.warn(`Error parsing local storage key "${key}":`, err);
    return defaultVal;
  }
}

// Helper to save local storage
function setLocal<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn(`Error setting local storage key "${key}":`, err);
  }
}

/**
 * Seed initial database if empty
 */
export async function ensureSeedData(currentAuthEmail?: string) {
  // Ensure local storage seed first
  let localRefs = getLocal<ReferenceItem[]>(STORAGE_REFS_KEY, []);
  if (!localRefs || localRefs.length === 0) {
    localRefs = DEFAULT_REFERENCES.map((item, idx) => ({
      ...item,
      id: `ref-${idx + 1}`,
      order: idx + 1,
      createdAt: new Date().toISOString()
    }));
    setLocal(STORAGE_REFS_KEY, localRefs);
  }

  let localSettings = getLocal<PortalSettings | null>(STORAGE_SETTINGS_KEY, null);
  if (!localSettings) {
    setLocal(STORAGE_SETTINGS_KEY, DEFAULT_SETTINGS);
  }

  let localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []);
  const adminEmail = PRIMARY_ADMIN_EMAIL.toLowerCase();
  const currentEmail = currentAuthEmail ? currentAuthEmail.toLowerCase() : null;

  if (localUsers.length === 0) {
    localUsers = [
      {
        id: adminEmail,
        email: adminEmail,
        name: "EOC System Administrator",
        role: "Admin" as UserRole,
        status: "Active",
        createdAt: new Date().toISOString()
      }
    ];
    if (currentEmail && currentEmail !== adminEmail) {
      localUsers.push({
        id: currentEmail,
        email: currentEmail,
        name: currentEmail.split('@')[0].toUpperCase(),
        role: "Admin" as UserRole,
        status: "Active",
        createdAt: new Date().toISOString()
      });
    }
    setLocal(STORAGE_USERS_KEY, localUsers);
  }

  // Supabase Cloud Sync if configured
  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Check & seed settings in Supabase
      const { data: remoteSettings } = await supabase.from('settings').select('*').eq('id', 'portalConfig').single();
      if (!remoteSettings) {
        await supabase.from('settings').upsert({ id: 'portalConfig', ...DEFAULT_SETTINGS });
      }

      // 2. Check & seed references in Supabase
      const { data: remoteRefs } = await supabase.from('references').select('*');
      if (!remoteRefs || remoteRefs.length === 0) {
        await supabase.from('references').upsert(
          DEFAULT_REFERENCES.map((item, idx) => ({
            id: `ref-${idx + 1}`,
            title: item.title,
            icon: item.icon || 'website',
            logo_url: item.logoUrl || item.logo || '',
            category: item.category || 'General',
            badge: item.badge || '',
            url: item.url || '#',
            description: item.description || '',
            visible: item.visible !== false,
            display_order: idx + 1,
            created_at: new Date().toISOString()
          }))
        );
      }

      // 3. Check & seed users in Supabase
      const { data: remoteUsers } = await supabase.from('users').select('*');
      if (!remoteUsers || remoteUsers.length === 0) {
        await supabase.from('users').upsert([
          {
            id: adminEmail,
            email: adminEmail,
            name: "EOC System Administrator",
            role: "Admin",
            status: "Active",
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.warn('Supabase initial seed notice:', err);
    }
  }
}

/**
 * References Subscriptions & CRUD
 */
export function subscribeReferences(callback: (items: ReferenceItem[]) => void) {
  // Load initial local data immediately
  const localRefs = getLocal<ReferenceItem[]>(STORAGE_REFS_KEY, DEFAULT_REFERENCES.map((item, idx) => ({ ...item, id: `seed-${idx}`, order: idx + 1 })));
  callback(localRefs);

  if (isSupabaseConfigured && supabase) {
    // Perform initial fetch from Supabase
    supabase
      .from('references')
      .select('*')
      .order('display_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const items: ReferenceItem[] = data.map((d: any) => ({
            id: d.id,
            title: d.title,
            icon: d.icon,
            logoUrl: d.logo_url || d.logoUrl || '',
            category: d.category,
            badge: d.badge,
            url: d.url,
            description: d.description,
            visible: d.visible,
            order: d.display_order || d.order || 0
          }));
          setLocal(STORAGE_REFS_KEY, items);
          callback(items);
        }
      });

    // Realtime listener
    const channel = supabase
      .channel('public:references')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'references' }, () => {
        supabase
          .from('references')
          .select('*')
          .order('display_order', { ascending: true })
          .then(({ data }) => {
            if (data && data.length > 0) {
              const items: ReferenceItem[] = data.map((d: any) => ({
                id: d.id,
                title: d.title,
                icon: d.icon,
                logoUrl: d.logo_url || d.logoUrl || '',
                category: d.category,
                badge: d.badge,
                url: d.url,
                description: d.description,
                visible: d.visible,
                order: d.display_order || d.order || 0
              }));
              setLocal(STORAGE_REFS_KEY, items);
              callback(items);
            }
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  return () => {};
}

export async function saveReference(item: Partial<ReferenceItem>): Promise<string> {
  const logoUrlVal = item.logoUrl || item.logo || '';
  const refId = item.id || `ref-${Date.now()}`;
  const now = new Date().toISOString();

  // Local storage update
  const localRefs = getLocal<ReferenceItem[]>(STORAGE_REFS_KEY, []);
  const existingIndex = localRefs.findIndex((r) => r.id === refId);
  const updatedItem: ReferenceItem = {
    id: refId,
    title: item.title || 'Untitled Reference',
    icon: item.icon || 'website',
    logoUrl: logoUrlVal,
    category: item.category || 'General',
    badge: item.badge || '',
    url: item.url || '#',
    description: item.description || '',
    visible: item.visible !== false,
    order: item.order || (existingIndex >= 0 ? localRefs[existingIndex].order : Date.now())
  };

  if (existingIndex >= 0) {
    localRefs[existingIndex] = updatedItem;
  } else {
    localRefs.push(updatedItem);
  }
  setLocal(STORAGE_REFS_KEY, localRefs);

  // Supabase update if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('references').upsert({
        id: refId,
        title: updatedItem.title,
        icon: updatedItem.icon,
        logo_url: logoUrlVal,
        category: updatedItem.category,
        badge: updatedItem.badge,
        url: updatedItem.url,
        description: updatedItem.description,
        visible: updatedItem.visible,
        display_order: updatedItem.order,
        updated_at: now
      });
    } catch (err) {
      console.warn('Supabase saveReference warning:', err);
    }
  }

  return refId;
}

export async function deleteReference(id: string) {
  const localRefs = getLocal<ReferenceItem[]>(STORAGE_REFS_KEY, []).filter((r) => r.id !== id);
  setLocal(STORAGE_REFS_KEY, localRefs);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('references').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteReference warning:', err);
    }
  }
}

export async function toggleReferenceVisibility(id: string, currentVisible: boolean) {
  const localRefs = getLocal<ReferenceItem[]>(STORAGE_REFS_KEY, []);
  const target = localRefs.find((r) => r.id === id);
  if (target) {
    target.visible = !currentVisible;
    setLocal(STORAGE_REFS_KEY, localRefs);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('references').update({ visible: !currentVisible }).eq('id', id);
    } catch (err) {
      console.warn('Supabase toggleReferenceVisibility warning:', err);
    }
  }
}

export async function updateReferencesOrder(items: ReferenceItem[]) {
  const updated = items.map((item, index) => ({ ...item, order: index + 1 }));
  setLocal(STORAGE_REFS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      const updates = updated.map((item) =>
        supabase.from('references').update({ display_order: item.order }).eq('id', item.id)
      );
      await Promise.all(updates);
    } catch (err) {
      console.warn('Supabase updateReferencesOrder warning:', err);
    }
  }
}

/**
 * Settings Subscriptions & Updates
 */
export function subscribeSettings(callback: (settings: PortalSettings) => void) {
  const localSettings = getLocal<PortalSettings>(STORAGE_SETTINGS_KEY, DEFAULT_SETTINGS);
  callback(localSettings);

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('settings')
      .select('*')
      .eq('id', 'portalConfig')
      .single()
      .then(({ data }) => {
        if (data) {
          const fetchedSettings: PortalSettings = {
            mainTitle: data.main_title || data.mainTitle || DEFAULT_SETTINGS.mainTitle,
            subtitle: data.subtitle || DEFAULT_SETTINGS.subtitle,
            agencyName: data.agency_name || data.agencyName || DEFAULT_SETTINGS.agencyName,
            logoUrl: data.logo_url || data.logoUrl || DEFAULT_SETTINGS.logoUrl,
            bannerUrl: data.banner_url || data.bannerUrl || DEFAULT_SETTINGS.bannerUrl,
            bannerHeight: data.banner_height || data.bannerHeight || DEFAULT_SETTINGS.bannerHeight,
            primaryColor: data.primary_color || data.primaryColor || DEFAULT_SETTINGS.primaryColor,
            headerBgColor: data.header_bg_color || data.headerBgColor || DEFAULT_SETTINGS.headerBgColor
          };
          setLocal(STORAGE_SETTINGS_KEY, fetchedSettings);
          callback(fetchedSettings);
        }
      });

    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        supabase
          .from('settings')
          .select('*')
          .eq('id', 'portalConfig')
          .single()
          .then(({ data }) => {
            if (data) {
              const fetchedSettings: PortalSettings = {
                mainTitle: data.main_title || data.mainTitle || DEFAULT_SETTINGS.mainTitle,
                subtitle: data.subtitle || DEFAULT_SETTINGS.subtitle,
                agencyName: data.agency_name || data.agencyName || DEFAULT_SETTINGS.agencyName,
                logoUrl: data.logo_url || data.logoUrl || DEFAULT_SETTINGS.logoUrl,
                bannerUrl: data.banner_url || data.bannerUrl || DEFAULT_SETTINGS.bannerUrl,
                bannerHeight: data.banner_height || data.bannerHeight || DEFAULT_SETTINGS.bannerHeight,
                primaryColor: data.primary_color || data.primaryColor || DEFAULT_SETTINGS.primaryColor,
                headerBgColor: data.header_bg_color || data.headerBgColor || DEFAULT_SETTINGS.headerBgColor
              };
              setLocal(STORAGE_SETTINGS_KEY, fetchedSettings);
              callback(fetchedSettings);
            }
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  return () => {};
}

export async function updatePortalSettings(settings: Partial<PortalSettings>) {
  const current = getLocal<PortalSettings>(STORAGE_SETTINGS_KEY, DEFAULT_SETTINGS);
  const updated = { ...current, ...settings };
  setLocal(STORAGE_SETTINGS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('settings').upsert({
        id: 'portalConfig',
        main_title: updated.mainTitle,
        subtitle: updated.subtitle,
        agency_name: updated.agencyName,
        logo_url: updated.logoUrl,
        banner_url: updated.bannerUrl,
        banner_height: updated.bannerHeight,
        primary_color: updated.primaryColor,
        header_bg_color: updated.headerBgColor,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase updatePortalSettings warning:', err);
    }
  }
}

/**
 * Users Subscriptions & CRUD
 */
export function subscribeUsers(callback: (users: UserAccount[]) => void) {
  const localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []);
  callback(localUsers);

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('users')
      .select('*')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const users: UserAccount[] = data.map((d: any) => ({
            id: d.id || d.email,
            email: d.email,
            name: d.name,
            role: d.role as UserRole,
            status: d.status,
            lastLogin: d.last_login || d.lastLogin,
            createdAt: d.created_at || d.createdAt
          }));
          setLocal(STORAGE_USERS_KEY, users);
          callback(users);
        }
      });

    const channel = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        supabase
          .from('users')
          .select('*')
          .then(({ data }) => {
            if (data && data.length > 0) {
              const users: UserAccount[] = data.map((d: any) => ({
                id: d.id || d.email,
                email: d.email,
                name: d.name,
                role: d.role as UserRole,
                status: d.status,
                lastLogin: d.last_login || d.lastLogin,
                createdAt: d.created_at || d.createdAt
              }));
              setLocal(STORAGE_USERS_KEY, users);
              callback(users);
            }
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  return () => {};
}

export async function getUserByEmail(email: string): Promise<UserAccount | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []);
  const localFound = localUsers.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('users').select('*').eq('email', normalizedEmail).single();
      if (data) {
        return {
          id: data.id || data.email,
          email: data.email,
          name: data.name,
          role: data.role as UserRole,
          status: data.status,
          lastLogin: data.last_login || data.lastLogin,
          createdAt: data.created_at || data.createdAt
        };
      }
    } catch (err) {
      console.warn('Supabase getUserByEmail warning:', err);
    }
  }

  return localFound || null;
}

export async function addUserAccount(user: { email: string; role: UserRole; name?: string; status?: 'Active' | 'Suspended' }) {
  const normalizedEmail = user.email.toLowerCase().trim();
  const localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []);
  const existingIdx = localUsers.findIndex((u) => u.email.toLowerCase() === normalizedEmail);
  const now = new Date().toISOString();

  const newUser: UserAccount = {
    id: normalizedEmail,
    email: normalizedEmail,
    name: user.name || (existingIdx >= 0 ? localUsers[existingIdx].name : normalizedEmail.split('@')[0].toUpperCase()),
    role: user.role,
    status: user.status || 'Active',
    createdAt: existingIdx >= 0 ? localUsers[existingIdx].createdAt : now
  };

  if (existingIdx >= 0) {
    localUsers[existingIdx] = { ...localUsers[existingIdx], ...newUser };
  } else {
    localUsers.push(newUser);
  }
  setLocal(STORAGE_USERS_KEY, localUsers);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('users').upsert({
        id: normalizedEmail,
        email: normalizedEmail,
        name: newUser.name,
        role: newUser.role,
        status: newUser.status,
        updated_at: now
      });
    } catch (err) {
      console.warn('Supabase addUserAccount warning:', err);
    }
  }
}

export async function updateUserRole(email: string, role: UserRole) {
  const normalizedEmail = email.toLowerCase().trim();
  const localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []);
  const target = localUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (target) {
    target.role = role;
    setLocal(STORAGE_USERS_KEY, localUsers);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('users').update({ role }).eq('email', normalizedEmail);
    } catch (err) {
      console.warn('Supabase updateUserRole warning:', err);
    }
  }
}

export async function deleteUserAccount(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []).filter((u) => u.email.toLowerCase() !== normalizedEmail);
  setLocal(STORAGE_USERS_KEY, localUsers);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('users').delete().eq('email', normalizedEmail);
    } catch (err) {
      console.warn('Supabase deleteUserAccount warning:', err);
    }
  }
}

export async function recordUserLogin(email: string, name?: string, photoURL?: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const localUsers = getLocal<UserAccount[]>(STORAGE_USERS_KEY, []);
  const target = localUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
  const now = new Date().toISOString();

  if (target) {
    target.lastLogin = now;
    if (name) target.name = name;
    setLocal(STORAGE_USERS_KEY, localUsers);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('users').update({
        last_login: now,
        ...(name ? { name } : {})
      }).eq('email', normalizedEmail);
    } catch (err) {
      console.warn('Supabase recordUserLogin warning:', err);
    }
  }
}
