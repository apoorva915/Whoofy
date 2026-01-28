import { createClient } from '@supabase/supabase-js';
import env from './env';
import logger from '@/utils/logger';

/**
 * Supabase Client Singleton
 */
let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Supabase client
 */
export function initSupabaseClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    logger.warn('Supabase credentials not configured. Some features may be unavailable.');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // Server-side, no session persistence needed
      },
    });
    logger.info('✅ Supabase client initialized');
  }

  return supabaseClient;
}

/**
 * Get Supabase client (initializes if needed)
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    return initSupabaseClient();
  }
  return supabaseClient;
}

/**
 * Get Supabase admin client (uses service role key for admin operations)
 */
export function getSupabaseAdminClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('Supabase admin credentials not configured. Admin operations unavailable.');
    return null;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

export default getSupabaseClient;
