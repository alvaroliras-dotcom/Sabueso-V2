import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Safe localStorage access for mobile browsers
const safeStorage = (() => {
  try {
    localStorage.setItem('test', '1');
    localStorage.removeItem('test');
    return localStorage;
  } catch {
    return undefined;
  }
})();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: safeStorage,
    persistSession: safeStorage !== undefined,
    autoRefreshToken: true,
  }
});
