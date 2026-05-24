import { lazy, Suspense } from 'react';

const GAME_MAP = {
  // Core originals
  1:   lazy(() => import('./games/StopTheBar')),
  2:   lazy(() => import('./games/GravityFlipPro')),
  3:   lazy(() => import('./games/DodgeSpikes')),
  4:   lazy(() => import('./games/HexBlast')),
  5:   lazy(() => import('./games/StackMaster')),
  6:   lazy(() => import('./games/CodeStrike')),
  7:   lazy(() => import('./games/GlyphForge')),
  8:   lazy(() => import('./games/SequenceBlink')),
  9:   lazy(() => import('./games/PlasmaCatch')),
  10:  lazy(() => import('./games/ShadowSnap')),
  11:  lazy(() => import('./games/FlashTap')),
  22:  lazy(() => import('./games/PulseStrike')),
  42:  lazy(() => import('./games/ChargeShot')),
  43:  lazy(() => import('./games/SlashBlitz')),
  45:  lazy(() => import('./games/SignalSnap')),
  47:  lazy(() => import('./games/TapStorm')),
  48:  lazy(() => import('./games/PressureLock')),
  49:  lazy(() => import('./games/DriftRacer')),
  51:  lazy(() => import('./games/ColorCode')),
  52:  lazy(() => import('./games/RingDodge')),
  54:  lazy(() => import('./games/BeatForge')),
  55:  lazy(() => import('./games/CalcBlitz')),
  56:  lazy(() => import('./games/QuantumTap')),
  57:  lazy(() => import('./games/PulseDrift')),
  58:  lazy(() => import('./games/OrbitalStrike')),
  59:  lazy(() => import('./games/SkySlasher')),
  60:  lazy(() => import('./games/LaneSprint')),
  71:  lazy(() => import('./games/RhythmHold')),
  72:  lazy(() => import('./games/BounceShot')),
  73:  lazy(() => import('./games/GridSnipe')),
  74:  lazy(() => import('./games/GlyphMemory')),
  75:  lazy(() => import('./games/PulseMatch')),
  76:  lazy(() => import('./games/NeonPinball')),
  77:  lazy(() => import('./games/MazeRunPro')),
  78:  lazy(() => import('./games/RuneForge')),
  79:  lazy(() => import('./games/BeatDrop')),
  80:  lazy(() => import('./games/StarMap')),
  81:  lazy(() => import('./games/GravityWell')),
  82:  lazy(() => import('./games/LightTrace')),
  83:  lazy(() => import('./games/CipherCrack')),
  84:  lazy(() => import('./games/CometTrail')),
  85:  lazy(() => import('./games/EchoChamber')),
  106: lazy(() => import('./games/PathTrace')),
  107: lazy(() => import('./games/LaneNotes')),
  108: lazy(() => import('./games/CountBurst')),
  109: lazy(() => import('./games/NumberSnipe')),
  110: lazy(() => import('./games/TileFlash')),
  112: lazy(() => import('./games/ColorRush')),
  113: lazy(() => import('./games/ShadowSnap')),
  114: lazy(() => import('./games/ChainTap')),
  116: lazy(() => import('./games/GlyphForge')),
  117: lazy(() => import('./games/OrbitSlingshot')),
  118: lazy(() => import('./games/SushiSlicePro')),
  119: lazy(() => import('./games/QuakeTycoon')),
  120: lazy(() => import('./games/EchoPainter')),
  121: lazy(() => import('./games/TimeHeist')),
  122: lazy(() => import('./games/TugOfWarRune')),
  123: lazy(() => import('./games/MirrorDuel')),
  124: lazy(() => import('./games/InkTrapArena')),
  125: lazy(() => import('./games/BeatSlasher')),
  146: lazy(() => import('./games/PerfectCut')),
  147: lazy(() => import('./games/ColorMatchDrop')),
  148: lazy(() => import('./games/RingHop')),
  149: lazy(() => import('./games/StopTheBar')),
  150: lazy(() => import('./games/PendulumStrike')),
  151: lazy(() => import('./games/SequenceBlink')),
  152: lazy(() => import('./games/CardFlipPro')),
  153: lazy(() => import('./games/SoundMemory')),
  154: lazy(() => import('./games/GridTrace')),
  155: lazy(() => import('./games/SymbolShift')),
  156: lazy(() => import('./games/FlickShot')),
  157: lazy(() => import('./games/CannonMerge')),
  158: lazy(() => import('./games/RopeSlice')),
  159: lazy(() => import('./games/LaserBounce')),
  160: lazy(() => import('./games/TowerBalance')),
  161: lazy(() => import('./games/TapColorRushPro')),
  162: lazy(() => import('./games/MathDash')),
  163: lazy(() => import('./games/WordSwipe')),
  164: lazy(() => import('./games/ShapeSort')),
  165: lazy(() => import('./games/PatternBreak')),
  166: lazy(() => import('./games/FlowConnect')),
  167: lazy(() => import('./games/BlockEscape')),
  168: lazy(() => import('./games/PipeMaster')),
  169: lazy(() => import('./games/HexFill')),
  170: lazy(() => import('./games/MazeRunPro')),
  171: lazy(() => import('./games/BeatTap')),
  172: lazy(() => import('./games/LaneSwitcher')),
  173: lazy(() => import('./games/DotRhythm')),
  174: lazy(() => import('./games/DrumLoop')),
  175: lazy(() => import('./games/LineRiderPro')),
  176: lazy(() => import('./games/MazeBalance')),
  177: lazy(() => import('./games/ThreadNeedle')),
  178: lazy(() => import('./games/CurveDraw')),
  179: lazy(() => import('./games/DodgeSpikes')),
  180: lazy(() => import('./games/StackMaster')),
  181: lazy(() => import('./games/RopeSwing')),
  182: lazy(() => import('./games/GravityFlipPro')),
  183: lazy(() => import('./games/WallJump')),
  184: lazy(() => import('./games/QuickSort')),
  185: lazy(() => import('./games/OddOneOut')),
  186: lazy(() => import('./games/EquationBuild')),
  187: lazy(() => import('./games/TrafficControl')),
  188: lazy(() => import('./games/SniperFocus')),
  189: lazy(() => import('./games/TypeSpeedPro')),
  190: lazy(() => import('./games/MicroDrag')),
  191: lazy(() => import('./games/BounceCount')),
  192: lazy(() => import('./games/ZenBalance')),
  193: lazy(() => import('./games/ColorGridLogic')),
  194: lazy(() => import('./games/PixelPaintPro')),
  195: lazy(() => import('./games/VocalPitch')),
};

const FallbackGame = lazy(() => import('./games/FlashTap'));

// Stable-height skeleton matching the in-game area so the layout doesn't
// shift when the lazy chunk resolves — the user no longer sees a "Loading…"
// flash followed by a sudden jump.
function GameLoading() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: 320,
      borderRadius: 18,
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'gk-shimmer 1.4s linear infinite',
      }} />
      <style>{`@keyframes gk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

export default function GameEngine({ game, phase, setPhase, onScoreUpdate }) {
  const GameComponent = GAME_MAP[game?.id] || FallbackGame;
  return (
    <Suspense fallback={<GameLoading />}>
      <GameComponent
        game={game}
        phase={phase}
        setPhase={setPhase}
        onScoreUpdate={onScoreUpdate}
      />
    </Suspense>
  );
}

export function preloadGameChunk(gameId) {
  const Component = GAME_MAP[gameId];
  if (Component) {
    Component._payload?._result || Component._init?.(Component._payload);
  }
}
