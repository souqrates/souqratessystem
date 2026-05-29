export interface TicketResult {
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  outcome: string[];
  isWinner: boolean;
  prize: number;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTicket(ticket: TicketResult): Promise<boolean> {
  const hash = await sha256Hex(ticket.serverSeed);
  return hash === ticket.serverSeedHash;
}

export function generateSeed(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic outcome derivation from (serverSeed, clientSeed, nonce).
 * Uses bytes of combined string as a deterministic PRNG — same inputs always
 * produce the same symbols. This is the same logic used server-side.
 */
export function deriveOutcome(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  symbols: string[],
  gridSize: number
): string[] {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const bytes: number[] = [];
  for (let i = 0; i < combined.length; i++) {
    bytes.push(combined.charCodeAt(i) & 0xff);
  }
  const result: string[] = [];
  for (let i = 0; i < gridSize; i++) {
    // Use a simple spread across bytes to avoid clustering
    const byteIdx = (i * 31) % bytes.length;
    const idx = bytes[byteIdx] % symbols.length;
    result.push(symbols[idx]);
  }
  return result;
}

export function checkWin(
  outcome: string[],
): { isWinner: boolean; multiplier: number } {
  const counts: Record<string, number> = {};
  outcome.forEach((s) => { counts[s] = (counts[s] ?? 0) + 1; });
  const maxCount = Math.max(...Object.values(counts));

  if (maxCount >= 3) {
    const mult = maxCount === outcome.length ? 10 : maxCount >= 4 ? 5 : 3;
    return { isWinner: true, multiplier: mult };
  }
  return { isWinner: false, multiplier: 0 };
}

/**
 * Generate a complete, verifiable mock ticket with real SHA-256 hash.
 * Returns a Promise because SHA-256 via crypto.subtle is async.
 */
export async function generateTicket(
  gameId: string,
  symbols: string[],
  gridSize: number,
  price: number,
  qty: number = 1
): Promise<TicketResult> {
  const serverSeed = generateSeed();
  const clientSeed = generateSeed();
  const nonce = Math.floor(Math.random() * 1_000_000);

  // Compute hash BEFORE revealing serverSeed (as a real server would)
  const serverSeedHash = await sha256Hex(serverSeed);

  const outcome = deriveOutcome(serverSeed, clientSeed, nonce, symbols, gridSize);
  const { isWinner, multiplier } = checkWin(outcome);
  const prize = isWinner ? price * qty * multiplier : 0;

  return {
    serverSeedHash,
    serverSeed,
    clientSeed,
    nonce,
    outcome,
    isWinner,
    prize,
  };
}
