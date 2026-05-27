import { SubAgentTier } from "@workspace/api-client-react";

interface TierBadgeProps {
  tier: SubAgentTier;
  className?: string;
}

export default function TierBadge({ tier, className = "" }: TierBadgeProps) {
  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold text-white ${className}`}
      style={{ backgroundColor: tier.color }}
    >
      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
        {tier.level}
      </div>
      <span>{tier.name}</span>
    </div>
  );
}
