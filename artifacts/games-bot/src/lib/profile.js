import { supabase } from './supabase';

export function displayNameOf(u) {
  if (!u) return 'Player';
  const dn = (u.display_name || '').trim();
  if (dn) return dn;
  const fn = (u.first_name || '').trim();
  if (fn) return fn;
  const un = (u.username || '').trim();
  return un || 'Player';
}

export function avatarUrlOf(u) {
  if (!u) return '';
  return (u.custom_avatar_url || u.profile_photo_url || '').trim();
}

export function initialOf(u) {
  const n = displayNameOf(u);
  return (n[0] || 'P').toUpperCase();
}

export async function updateProfile(telegramId, { displayName, avatarUrl }) {
  if (!telegramId) throw new Error('no telegram id');
  const { data, error } = await supabase.rpc('user_update_profile', {
    p_telegram_id: telegramId,
    p_display_name: displayName ?? null,
    p_avatar_url:   avatarUrl   ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// Abstract SVG avatars (no people photos). Sourced from src/lib/avatars.js.
export { AVATAR_PRESETS } from './avatars';
