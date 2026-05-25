import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants';

const url = SUPABASE_CONFIG.url;
const anonKey = SUPABASE_CONFIG.anonKey;

function makeStub() {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY غير مضبوطة — يعمل الـ client بنمط no-op');
  }
  const EMPTY = { data: null, error: null };
  const EMPTY_ARR = { data: [], error: null };

  function makeBuilder(arrayShape = false) {
    const result = arrayShape ? EMPTY_ARR : EMPTY;
    const builder = {
      select: () => makeBuilder(true),
      insert: () => makeBuilder(false),
      update: () => makeBuilder(false),
      upsert: () => makeBuilder(false),
      delete: () => makeBuilder(false),
      eq: () => builder,
      neq: () => builder,
      gt: () => builder,
      lt: () => builder,
      gte: () => builder,
      lte: () => builder,
      like: () => builder,
      ilike: () => builder,
      in: () => builder,
      is: () => builder,
      contains: () => builder,
      containedBy: () => builder,
      filter: () => builder,
      match: () => builder,
      not: () => builder,
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      single: () => Promise.resolve(EMPTY),
      maybeSingle: () => Promise.resolve(EMPTY),
      throwOnError: () => builder,
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      catch: (onRej) => Promise.resolve(result).catch(onRej),
      finally: (cb) => Promise.resolve(result).finally(cb),
    };
    return builder;
  }

  const channel = {
    on: function () { return this; },
    subscribe: function () { return this; },
    unsubscribe: function () { return this; },
    send: async () => 'ok',
  };

  return {
    from: () => makeBuilder(false),
    rpc: () => makeBuilder(false),
    channel: () => channel,
    removeChannel: () => {},
    removeAllChannels: () => {},
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => EMPTY,
        download: async () => EMPTY,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => EMPTY,
        list: async () => EMPTY_ARR,
      }),
    },
    functions: {
      invoke: async () => EMPTY,
    },
  };
}

export const supabase = (url && anonKey)
  ? createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      },
    })
  : makeStub();
