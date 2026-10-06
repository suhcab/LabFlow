import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && /^https:\/\/[^/\s]+(?:\/)?$/.test(supabaseUrl) && supabasePublishableKey,
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://example.supabase.co',
  isSupabaseConfigured ? supabasePublishableKey! : 'missing-publishable-key',
  {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
    },
  },
);
