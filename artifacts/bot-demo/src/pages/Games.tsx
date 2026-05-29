import { GAMES, GameConfig } from "../lib/games";

interface Props {
  onSelectGame: (game: GameConfig) => void;
}

function GameCard({ game, onClick }: { game: GameConfig; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="game-card rounded-2xl p-4 text-right w-full"
      style={{
        background: `linear-gradient(135deg, ${game.gradientFrom}cc, ${game.gradientTo}88)`,
        border: `1px solid ${game.accentColor}33`,
        boxShadow: `0 4px 20px ${game.accentColor}15`,
      }}
    >
      {/* Emoji */}
      <div className="text-4xl mb-2 leading-none">{game.emoji}</div>

      {/* Name */}
      <div className="font-bold text-white text-sm leading-snug mb-1">{game.nameAr}</div>

      {/* Mechanic */}
      <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{game.mechanic}</div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 8 }} />

      {/* Price + Max Prize */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>السعر</div>
          <div className="font-orbitron font-black text-sm" style={{ color: game.accentColor }}>
            {game.price} SKZ
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>أعلى جائزة</div>
          <div className="font-orbitron font-black text-sm" style={{ color: "#fcd34d" }}>
            {game.maxPrize.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Theme tag */}
      <div className="mt-2">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{
          background: `${game.accentColor}22`,
          color: game.accentColor,
          border: `1px solid ${game.accentColor}33`,
          fontSize: 9,
        }}>
          {game.theme}
        </span>
      </div>
    </button>
  );
}

export default function Games({ onSelectGame }: Props) {
  return (
    <div className="px-4 pt-6 fade-up">
      {/* Header */}
      <div className="mb-5">
        <div className="section-label mb-1">SOUQRATES SWEEP</div>
        <h2 className="font-orbitron font-black text-xl text-white">🎰 ألعاب الحك</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          اختر لعبتك — احك الورقة — اربح فوراً
        </p>
      </div>

      {/* Games grid 2×5 */}
      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} onClick={() => onSelectGame(game)} />
        ))}
      </div>

      {/* Footer note */}
      <div className="text-center mt-5 mb-2">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          🔐 جميع النتائج Provably Fair — شفافة وقابلة للتحقق
        </span>
      </div>
    </div>
  );
}
