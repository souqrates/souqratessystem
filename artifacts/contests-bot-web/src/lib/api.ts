const BASE = "/api";

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

export type Contest = {
  id: number;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  status: "draft" | "active" | "ended" | "cancelled";
  startsAt: string | null;
  endsAt: string | null;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
};

export type Contestant = {
  id: number;
  contestId: number;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  voteCount: number;
  isDisqualified: boolean;
  sortOrder: number;
};

export type VotePack = {
  id: number;
  name: string;
  description: string | null;
  votes: number;
  bonusVotes: number;
  priceSkz: string;
  bonusDescription: string | null;
  bonusFileUrl: string | null;
  bonusFileName: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type ActivePayload = {
  contest: Contest | null;
  contestants: Contestant[];
  packs: VotePack[];
};

export const getActive = () => jget<ActivePayload>("/contests/active");
export const getLeaderboard = (id: number) =>
  jget<{ contestants: Pick<Contestant, "id" | "name" | "photoUrl" | "voteCount" | "isDisqualified">[]; totalVotes: number }>(
    `/contests/${id}/leaderboard`,
  );
export const getPacks = () => jget<VotePack[]>("/contests/packs");
