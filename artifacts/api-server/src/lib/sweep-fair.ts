/**
 * SOUQRATES SWEEP — Provably Fair engine.
 *
 * Any third party can verify a result by:
 *   1. Taking the serverSeed and clientSeed from the ticket.
 *   2. Computing HMAC-SHA256(key=serverSeed, data=clientSeed) → hex string.
 *   3. Slicing the hex into 4-byte (8-hex-char) chunks and reading each as a
 *      uint32 to produce the game's random sequence.
 *   4. Applying the game-specific derivation below to reproduce the exact result.
 *
 * The serverSeedHash (= SHA256(serverSeed)) is committed on ticket creation so
 * the server cannot change the seed after seeing the clientSeed.
 */
import crypto from "crypto";

// ── Seed primitives ──────────────────────────────────────────────────────────

/** Generate a random 32-byte hex server seed. */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Hash a server seed with SHA-256 — committed to the user before play. */
export function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

// ── Random number extraction ─────────────────────────────────────────────────

/**
 * Derive a deterministic byte stream from (serverSeed, clientSeed).
 * Returns an array of floats in [0, 1).
 * nonce allows generating multiple independent values from the same seeds.
 */
function deriveFloats(serverSeed: string, clientSeed: string, nonce: number, count: number): number[] {
  const hmac = crypto.createHmac("sha256", serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hex = hmac.digest("hex");

  const floats: number[] = [];
  for (let i = 0; i < count && i * 8 + 8 <= hex.length; i++) {
    const chunk = hex.slice(i * 8, i * 8 + 8);
    const uint32 = parseInt(chunk, 16);
    floats.push(uint32 / 0x100000000);
  }
  // If we need more than 8 floats, extend with additional nonces
  let extra = 1;
  while (floats.length < count) {
    const hmac2 = crypto.createHmac("sha256", serverSeed);
    hmac2.update(`${clientSeed}:${nonce + extra}`);
    const hex2 = hmac2.digest("hex");
    for (let i = 0; i < 8 && floats.length < count; i++) {
      const chunk = hex2.slice(i * 8, i * 8 + 8);
      const uint32 = parseInt(chunk, 16);
      floats.push(uint32 / 0x100000000);
    }
    extra++;
  }
  return floats;
}

// ── Game result types ────────────────────────────────────────────────────────

export interface SlotResult {
  reels: number[];       // 3 reel symbol indices (0-based)
  symbols: string[];     // symbol names
  matchCount: number;    // how many reels match
  multiplier: number;    // prize multiplier from prize tiers
  prizeSkz: number;
}

export interface PrizeTier {
  matchCount: number;
  multiplier: number;
  label: string;
}

// ── Universal result deriver ─────────────────────────────────────────────────

const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "7️⃣", "🎰"];

/**
 * Derive a game result for a given game type slug.
 * The returned object is stored in sweep_tickets.result (JSONB).
 */
export function deriveResult(
  serverSeed: string,
  clientSeed: string,
  gameSlug: string,
  priceSKZ: number,
  prizeTiers: PrizeTier[],
): { result: Record<string, unknown>; prizeSkz: number; isWin: boolean } {
  const sortedTiers = [...prizeTiers].sort((a, b) => b.matchCount - a.matchCount);

  if (gameSlug === "lotto-quick-pick") {
    // Generate 6 unique numbers 1-49
    const numbers = deriveUniqueNumbers(serverSeed, clientSeed, 6, 49);
    return {
      result: { numbers, type: "quick_pick" },
      prizeSkz: 0,
      isWin: false,
    };
  }

  if (gameSlug === "coin-flip") {
    const [f] = deriveFloats(serverSeed, clientSeed, 0, 1);
    const side = f! < 0.5 ? "heads" : "tails";
    const chosen = clientSeed.endsWith("h") ? "heads" : "tails";
    const isWin = side === chosen;
    const multiplier = isWin ? (sortedTiers[0]?.multiplier ?? 1.8) : 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { side, chosen, isWin },
      prizeSkz,
      isWin,
    };
  }

  if (gameSlug === "dice-roll") {
    const [f] = deriveFloats(serverSeed, clientSeed, 0, 1);
    const roll = Math.floor(f! * 6) + 1;
    const chosen = parseInt(clientSeed, 10) || 0;
    const isWin = roll === chosen;
    const multiplier = isWin ? (sortedTiers.find((t) => t.matchCount === 1)?.multiplier ?? 5) : 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { roll, chosen, isWin },
      prizeSkz,
      isWin,
    };
  }

  if (gameSlug === "number-guess") {
    const [f] = deriveFloats(serverSeed, clientSeed, 0, 1);
    const secret = Math.floor(f! * 10) + 1;
    const guess = parseInt(clientSeed, 10) || 0;
    const isWin = secret === guess;
    const multiplier = isWin ? (sortedTiers[0]?.multiplier ?? 8) : 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { secret, guess, isWin },
      prizeSkz,
      isWin,
    };
  }

  if (gameSlug === "hi-lo") {
    const [f1, f2] = deriveFloats(serverSeed, clientSeed, 0, 2);
    const card = Math.floor(f1! * 13) + 1;
    const next = Math.floor(f2! * 13) + 1;
    const prediction = clientSeed.endsWith("h") ? "higher" : "lower";
    const isWin = prediction === "higher" ? next > card : next < card;
    const multiplier = isWin ? (sortedTiers[0]?.multiplier ?? 1.9) : 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { card, next, prediction, isWin },
      prizeSkz,
      isWin,
    };
  }

  if (gameSlug === "scratch-card") {
    const floats = deriveFloats(serverSeed, clientSeed, 0, 6);
    const symbols = floats.map((f) => SLOT_SYMBOLS[Math.floor(f * SLOT_SYMBOLS.length)]!);
    const counts: Record<string, number> = {};
    for (const s of symbols) counts[s] = (counts[s] ?? 0) + 1;
    const maxMatch = Math.max(...Object.values(counts));
    const tier = sortedTiers.find((t) => t.matchCount <= maxMatch);
    const multiplier = tier?.multiplier ?? 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { symbols, maxMatch },
      prizeSkz,
      isWin: prizeSkz > 0,
    };
  }

  if (gameSlug === "wheel-of-fortune") {
    const [f] = deriveFloats(serverSeed, clientSeed, 0, 1);
    const segments = 12;
    const segment = Math.floor(f! * segments);
    const tier = sortedTiers.find((t) => t.matchCount <= segments - segment) ?? null;
    const multiplier = tier?.multiplier ?? 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { segment, totalSegments: segments },
      prizeSkz,
      isWin: prizeSkz > 0,
    };
  }

  if (gameSlug === "roulette") {
    const [f] = deriveFloats(serverSeed, clientSeed, 0, 1);
    const pocket = Math.floor(f! * 37); // 0-36
    const chosen = parseInt(clientSeed, 10);
    const isExact = pocket === chosen;
    const multiplier = isExact ? (sortedTiers[0]?.multiplier ?? 35) : 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { pocket, chosen, isExact },
      prizeSkz,
      isWin: isExact,
    };
  }

  if (gameSlug === "blackjack-simple") {
    const floats = deriveFloats(serverSeed, clientSeed, 0, 4);
    const playerCards = [Math.floor(floats[0]! * 13) + 1, Math.floor(floats[1]! * 13) + 1];
    const dealerCards = [Math.floor(floats[2]! * 13) + 1, Math.floor(floats[3]! * 13) + 1];
    const playerSum = Math.min(playerCards.reduce((a, b) => a + Math.min(b, 10), 0), 21);
    const dealerSum = Math.min(dealerCards.reduce((a, b) => a + Math.min(b, 10), 0), 21);
    const isWin = playerSum > dealerSum && playerSum <= 21;
    const multiplier = isWin ? (sortedTiers[0]?.multiplier ?? 1.9) : 0;
    const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
    return {
      result: { playerCards, dealerCards, playerSum, dealerSum, isWin },
      prizeSkz,
      isWin,
    };
  }

  // Default: 3-reel slot machine
  const floats = deriveFloats(serverSeed, clientSeed, 0, 3);
  const reels = floats.slice(0, 3).map((f) => Math.floor(f * SLOT_SYMBOLS.length));
  const symbols = reels.map((i) => SLOT_SYMBOLS[i]!);
  const matchCount = reels[0] === reels[1] && reels[1] === reels[2] ? 3 : reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2] ? 2 : 0;
  const tier = sortedTiers.find((t) => t.matchCount <= matchCount);
  const multiplier = tier?.multiplier ?? 0;
  const prizeSkz = parseFloat((priceSKZ * multiplier).toFixed(2));
  return {
    result: { reels, symbols, matchCount },
    prizeSkz,
    isWin: prizeSkz > 0,
  };
}

// ── Lotto utilities ──────────────────────────────────────────────────────────

/**
 * Derive N unique integers in range [1, max] from seeds (Fisher-Yates shuffle subset).
 * Used for both lotto draw results and quick-pick ticket generation.
 */
export function deriveUniqueNumbers(
  serverSeed: string,
  clientSeed: string,
  count: number,
  max: number,
): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const floats = deriveFloats(serverSeed, clientSeed, 0, count);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    // pool.length shrinks by 1 each iteration via splice, so we use
    // pool.length directly (NOT pool.length - i which double-subtracts i
    // and biases the output toward the front of the pool).
    const idx = Math.floor(floats[i]! * pool.length);
    result.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return result.sort((a, b) => a - b);
}

/** Count how many of the user's chosen numbers match the winning numbers. */
export function countLottoMatches(chosen: number[], winning: number[]): number {
  const winSet = new Set(winning);
  return chosen.filter((n) => winSet.has(n)).length;
}
