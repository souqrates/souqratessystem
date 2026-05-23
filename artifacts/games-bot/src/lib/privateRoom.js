import useAppStore from '../store/appStore';
import { getTelegramWebApp } from './telegram';

export function formatRoomCode(roomId) {
  if (!roomId) return '';
  return String(roomId).toUpperCase();
}

export function buildShareUrl(roomId, gameId, roomType = 'pvp') {
  const { appConfig } = useAppStore.getState();
  const bot = appConfig?.telegram_bot_username || 'Souqrates_skillz_bot';
  return `https://t.me/${bot}?startapp=room_${roomId}_${gameId}_${roomType}`;
}

export async function copyRoomCode(roomId) {
  try {
    await navigator.clipboard.writeText(String(roomId || ''));
    return true;
  } catch {
    return false;
  }
}

export function shareRoomTelegram(roomId, gameId, gameName, roomType = 'pvp', entryFee = 0) {
  const shareUrl = buildShareUrl(roomId, gameId, roomType);
  const feeNote = entryFee > 0 ? ` Entry: ${entryFee} SKZ` : '';
  const text = `Join my ${gameName} match!${feeNote} Code: ${formatRoomCode(roomId)}`;
  const wa = getTelegramWebApp();
  const fullUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(fullUrl);
  } else {
    window.open(fullUrl, '_blank');
  }
}

export function normalizeJoinCode(raw) {
  return String(raw || '').trim().toUpperCase();
}
