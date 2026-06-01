export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

export const PAYMENT_CONFIG = {
  minWithdrawal: 10,
  minDeposit: 1,
  supportedTokens: ['USDT', 'TON'],
};

// Default in-game currency. Mirrors economy_settings.currency_symbol.
export const CURRENCY = 'SKZ';

function feeFor(difficulty) {
  const T = { Easy: 5, Medium: 10, Hard: 15 };
  return T[difficulty] ?? 10;
}

function priced(raw) {
  return raw.map((g) => {
    const entryFee = feeFor(g.difficulty);
    const prize    = Math.round(entryFee * 3);
    return { ...g, entryFee, prize, reward: `${prize} ${CURRENCY}` };
  });
}

export const GAMES = priced([
  { id: 1, name: 'Precision Split',  difficulty: 'Hard',   reward: '$50',  color: 'from-red-500 to-orange-500',     desc: 'Stop the needle at center' },
  { id: 2, name: 'Gravity Thief',    difficulty: 'Hard',   reward: '$60',  color: 'from-cyan-600 to-orange-500',    desc: 'Flip gravity, dodge obstacles' },
  { id: 3, name: 'Volt Dodge',        difficulty: 'Hard',   reward: '$55',  color: 'from-yellow-500 to-orange-500',  desc: 'Dodge lightning, collect crystals' },
  { id: 4, name: 'Neon Break',       difficulty: 'Medium', reward: '$40',  color: 'from-cyan-500 to-blue-500',      desc: 'Break all the glowing bricks' },
  { id: 5, name: 'Stack Tower',      difficulty: 'Medium', reward: '$35',  color: 'from-teal-500 to-emerald-500',   desc: 'Stack 12 layers perfectly' },
  { id: 6, name: 'Code Breaker',     difficulty: 'Medium', reward: '$35',  color: 'from-sky-500 to-blue-500',       desc: 'Solve math puzzles in 90 seconds' },
  { id: 7, name: 'Star Forge',       difficulty: 'Medium', reward: '$40',  color: 'from-amber-400 to-yellow-300',   desc: 'Hold and release to forge stars' },
  { id: 8, name: 'Pattern Recall',   difficulty: 'Hard',   reward: '$45',  color: 'from-teal-500 to-cyan-500',      desc: 'Redraw from memory' },
  { id: 9, name: 'Gravity Drop',     difficulty: 'Easy',   reward: '$20',  color: 'from-amber-500 to-yellow-500',   desc: 'Catch coins in the bucket' },
  { id: 10, name: 'Shadow Match',    difficulty: 'Hard',   reward: '$50',  color: 'from-slate-500 to-gray-500',     desc: 'Match 3D silhouette to 2D' },

  /* ── NEW SOLO (56-60) ── */
  { id: 56, name: 'Quantum Reflex', difficulty: 'Hard',   reward: '$65',  color: 'from-cyan-500 to-blue-600',      desc: 'Tap the matching quantum symbol — 3 lives, 60s' },
  { id: 57, name: 'Pulse Wave',     difficulty: 'Medium', reward: '$50',  color: 'from-emerald-500 to-teal-500',   desc: 'Tap when the pulse enters the hit zone' },
  { id: 58, name: 'Orbital Strike', difficulty: 'Hard',   reward: '$70',  color: 'from-amber-500 to-orange-500',   desc: 'Aim, charge, release — gravity does the rest' },
  { id: 59, name: 'Sky Slasher',    difficulty: 'Hard',   reward: '$60',  color: 'from-rose-500 to-red-600',       desc: 'Swipe to slice incoming drones — chain for combos' },
  { id: 60, name: 'Cube Rush',      difficulty: 'Medium', reward: '$45',  color: 'from-cyan-600 to-blue-500',      desc: '3-lane runner — dodge red, collect blue' },

/* ── PREMIUM SOLO (76-85) ── */
  { id: 76, name: 'Neon Pinball',     difficulty: 'Medium', reward: '$55',  color: 'from-pink-500 to-orange-500',    desc: 'Flick the neon ball — rack up bumper combos' },
  { id: 77, name: 'Maze Runner',      difficulty: 'Medium', reward: '$50',  color: 'from-cyan-500 to-emerald-500',   desc: 'Swipe through procedural mazes — beat the timer' },
  { id: 78, name: 'Rune Forge',       difficulty: 'Hard',   reward: '$65',  color: 'from-amber-500 to-rose-500',     desc: 'Trace rune patterns — perfect lines forge stars' },
  { id: 79, name: 'Beat Drop',        difficulty: 'Medium', reward: '$55',  color: 'from-fuchsia-500 to-cyan-500',   desc: 'Tap falling beats on the hit line — perfect timing' },
  { id: 80, name: 'Star Bridge',      difficulty: 'Medium', reward: '$50',  color: 'from-amber-400 to-cyan-400',     desc: 'Connect constellations in correct order — fast' },
  { id: 81, name: 'Gravity Well',     difficulty: 'Hard',   reward: '$60',  color: 'from-blue-600 to-cyan-500',      desc: 'Aim with gravity — drop probes into singularity' },
  { id: 82, name: 'Light Trace',      difficulty: 'Medium', reward: '$50',  color: 'from-yellow-400 to-amber-500',   desc: 'Follow the moving light orb with your finger' },
  { id: 83, name: 'Cipher Crack',     difficulty: 'Hard',   reward: '$65',  color: 'from-teal-500 to-cyan-600',      desc: 'Decode symbols to letters — beat the cipher' },
  { id: 84, name: 'Comet Trail',      difficulty: 'Hard',   reward: '$60',  color: 'from-blue-500 to-orange-500',    desc: 'Drag the comet — collect orbs, dodge asteroids' },
  { id: 85, name: 'Echo Chamber',     difficulty: 'Hard',   reward: '$55',  color: 'from-fuchsia-500 to-rose-500',   desc: 'Listen — repeat the sound sequence by ear' },

  /* ── AAA PREMIUM SOLO (116-125) — themed flagship games ── */
  { id: 116, name: 'Forge Master',     difficulty: 'Hard',   reward: '$70',  color: 'from-amber-600 to-orange-500',   desc: 'Heat, strike, cool — forge legendary blades' },
  { id: 117, name: 'Orbit Slingshot', difficulty: 'Hard',   reward: '$75',  color: 'from-blue-600 to-cyan-500',      desc: 'Aim through gravity wells — collect stardust' },
  { id: 118, name: 'Sushi Slice Pro', difficulty: 'Hard',   reward: '$70',  color: 'from-pink-500 to-rose-500',      desc: 'Cut precise 5mm slices — pixel-perfect blade' },
  { id: 119, name: 'Quake Tycoon',     difficulty: 'Hard',   reward: '$75',  color: 'from-cyan-600 to-orange-500',    desc: 'Demolish the city with the least power' },
  { id: 120, name: 'Echo Painter',     difficulty: 'Hard',   reward: '$65',  color: 'from-amber-400 to-yellow-300',   desc: 'Reveal the hidden masterpiece in 10 touches' },
  { id: 121, name: 'Time Heist',       difficulty: 'Hard',   reward: '$80',  color: 'from-rose-500 to-red-600',       desc: 'Sneak past lasers — rewind time 3 times' },
  { id: 122, name: 'Tug of War Rune', difficulty: 'Medium', reward: '$55',  color: 'from-amber-500 to-yellow-400',   desc: 'Rapid-tap the rune — pull the rope to victory' },
  { id: 123, name: 'Mirror Duel',      difficulty: 'Hard',   reward: '$65',  color: 'from-cyan-500 to-blue-500',      desc: 'Do the OPPOSITE of the command — 5 rounds' },
  { id: 124, name: 'Ink Trap Arena',   difficulty: 'Hard',   reward: '$70',  color: 'from-teal-500 to-cyan-500',      desc: 'Trap the enemy with ink — tactical grid combat' },
  { id: 125, name: 'Rhythm Katana',    difficulty: 'Hard',   reward: '$70',  color: 'from-pink-500 to-rose-400',      desc: 'Slash neon notes on the beat — Tokyo nights' },

  /* ── 25 NEW SOLO GAMES ── */
  { id: 11,  name: 'Flash Tap',      difficulty: 'Hard',   color: 'from-yellow-400 to-orange-500',  desc: 'Tap circles before they vanish — speed is everything', targetScore: 40 },
  { id: 22,  name: 'Pulse Strike',   difficulty: 'Medium', color: 'from-cyan-500 to-blue-600',     desc: 'Tap exactly when the ring matches the target line', targetScore: 30 },
  { id: 47,  name: 'Tap Storm',      difficulty: 'Hard',   color: 'from-amber-400 to-red-500',    desc: 'Five zones — tap the lit one before time runs out', targetScore: 50 },
  { id: 42,  name: 'Charge Shot',    difficulty: 'Medium', color: 'from-emerald-500 to-teal-400',  desc: 'Hold to charge, release in the green zone to score', targetScore: 20 },
  { id: 48,  name: 'Pressure Lock',  difficulty: 'Hard',   color: 'from-rose-500 to-pink-500',    desc: 'Hold to slow the spinning needle, release to lock', targetScore: 80 },
  { id: 43,  name: 'Slash Blitz',    difficulty: 'Hard',   color: 'from-red-500 to-orange-400',   desc: 'Swipe through glowing orbs — avoid the red bombs', targetScore: 60 },
  { id: 49,  name: 'Drift Racer',    difficulty: 'Easy',   color: 'from-cyan-500 to-emerald-400', desc: 'Swipe left/right to switch lanes — dodge and collect', targetScore: 25 },
  { id: 45,  name: 'Signal Snap',    difficulty: 'Easy',   color: 'from-green-500 to-emerald-400', desc: 'Green tap, red stop, yellow double-tap — fastest reflex', targetScore: 25 },
  { id: 52,  name: 'Ring Dodge',     difficulty: 'Hard',   color: 'from-rose-500 to-red-600',     desc: 'Tap the gap as the ring closes inward — survive', targetScore: 30 },
  { id: 73,  name: 'Grid Snipe',     difficulty: 'Medium', color: 'from-amber-500 to-orange-500', desc: 'Tap gold for 3pts, cyan for 1pt, avoid red penalty targets', targetScore: 40 },
  { id: 71,  name: 'Rhythm Hold',    difficulty: 'Medium', color: 'from-fuchsia-500 to-rose-400', desc: 'Hold on the beat markers, release between them — stay on tempo', targetScore: 25 },
  { id: 72,  name: 'Bounce Shot',    difficulty: 'Medium', color: 'from-blue-600 to-cyan-500',    desc: 'Swipe to launch the ball — bounce it into the targets', targetScore: 10 },
  { id: 54,  name: 'Beat Forge',     difficulty: 'Hard',   color: 'from-amber-600 to-orange-500', desc: 'Tap the falling drums as they hit the line — perfect timing', targetScore: 40 },
  { id: 75,  name: 'Pulse Match',    difficulty: 'Medium', color: 'from-cyan-400 to-blue-500',    desc: 'Tap in sync with every 4th pulse — precision timing game', targetScore: 20 },
  { id: 107, name: 'Lane Notes',     difficulty: 'Easy',   color: 'from-pink-500 to-fuchsia-400', desc: 'Three lanes — tap the correct lane as notes cross the line', targetScore: 30 },
  { id: 51,  name: 'Color Code',     difficulty: 'Medium', color: 'from-pink-500 to-rose-400',   desc: 'Watch the color sequence, then repeat it exactly', targetScore: 12 },
  { id: 74,  name: 'Glyph Memory',   difficulty: 'Hard',   color: 'from-violet-600 to-blue-500', desc: 'Memorize the flashing grid, then tap symbols in order', targetScore: 8 },
  { id: 106, name: 'Path Trace',     difficulty: 'Hard',   color: 'from-amber-400 to-orange-500', desc: 'Watch the path light up, then trace it by swiping', targetScore: 10 },
  { id: 110, name: 'Tile Flash',     difficulty: 'Easy',   color: 'from-cyan-500 to-teal-400',   desc: 'Memorize the lit tiles then recreate the pattern', targetScore: 8 },
  { id: 113, name: 'Shadow Snap',    difficulty: 'Medium', color: 'from-slate-500 to-cyan-400',  desc: 'Match the silhouette from 4 options — look carefully', targetScore: 20 },
  { id: 55,  name: 'Calc Blitz',     difficulty: 'Medium', color: 'from-emerald-500 to-teal-500', desc: 'Solve math fast — tap the correct answer — no wrong guesses', targetScore: 20 },
  { id: 108, name: 'Count Burst',    difficulty: 'Hard',   color: 'from-blue-600 to-cyan-500',   desc: 'Count colored dots and tap the matching number — fast', targetScore: 25 },
  { id: 109, name: 'Number Snipe',   difficulty: 'Easy',   color: 'from-sky-500 to-blue-400',   desc: 'Tap numbers 1 through 9 in order as fast as possible', targetScore: 15 },
  { id: 112, name: 'Color Rush',     difficulty: 'Hard',   color: 'from-rose-500 to-pink-400',   desc: 'Tap the color of the ink — not the word written', targetScore: 30 },
  { id: 114, name: 'Chain Tap',      difficulty: 'Medium', color: 'from-amber-500 to-orange-400', desc: 'Tap all circles in order without lifting your finger', targetScore: 25 },

  /* ── 50 NEW TARGET-SCORE GAMES (IDs 146-195) ── */
  { id: 146, name: 'Perfect Cut',       difficulty: 'Medium', color: 'from-emerald-500 to-teal-400',   desc: 'Stop the bar in the green zone — it speeds up as you score', targetScore: 1000 },
  { id: 147, name: 'Color Match Drop', difficulty: 'Medium', color: 'from-pink-500 to-fuchsia-400',   desc: 'Match falling ball color to the floor — speed and accuracy win', targetScore: 1200 },
  { id: 148, name: 'Ring Hop',          difficulty: 'Hard',   color: 'from-cyan-500 to-blue-500',      desc: 'Jump into the ring — combo 5 in a row for 500 bonus points', targetScore: 1000 },
  { id: 149, name: 'Stop The Bar',      difficulty: 'Medium', color: 'from-amber-500 to-orange-500',   desc: 'Stop the bar in the golden zone — zone shrinks every 200 pts', targetScore: 800 },
  { id: 150, name: 'Pendulum Strike',   difficulty: 'Hard',   color: 'from-red-500 to-orange-400',     desc: 'Strike at maximum swing — target moves every 300 pts', targetScore: 1500 },
  { id: 151, name: 'Sequence Blink',    difficulty: 'Hard',   color: 'from-blue-500 to-cyan-400',      desc: 'Memorize and repeat the blinking sequence — grows every 200 pts', targetScore: 1000 },
  { id: 152, name: 'Card Flip Pro',     difficulty: 'Medium', color: 'from-violet-500 to-blue-500',    desc: 'Match pairs fast — 12 cards grows to 20 after 600 pts', targetScore: 1200 },
  { id: 153, name: 'Sound Memory',      difficulty: 'Hard',   color: 'from-fuchsia-500 to-pink-400',   desc: 'Echo the tone sequence — gains a note every 200 pts', targetScore: 1000 },
  { id: 154, name: 'Grid Trace',        difficulty: 'Medium', color: 'from-teal-500 to-emerald-400',   desc: 'Trace the lit path on the grid — accuracy beats speed', targetScore: 1000 },
  { id: 155, name: 'Symbol Shift',      difficulty: 'Hard',   color: 'from-rose-500 to-red-400',       desc: 'Tap the changed symbol — window shrinks from 3s to 1.5s', targetScore: 1200 },
  { id: 156, name: 'Flick Shot',        difficulty: 'Medium', color: 'from-orange-500 to-amber-400',   desc: '10 balls only — swish for 150 pts, miss costs 150', targetScore: 1000 },
  { id: 157, name: 'Cannon Merge',      difficulty: 'Hard',   color: 'from-yellow-500 to-orange-500',  desc: 'Merge falling balls — 2048 points target, gravity grows', targetScore: 2048 },
  { id: 158, name: 'Rope Slice',        difficulty: 'Medium', color: 'from-lime-500 to-emerald-400',   desc: 'Cut the rope to drop the ball in the basket — more ropes each round', targetScore: 1000 },
  { id: 159, name: 'Laser Bounce',      difficulty: 'Hard',   color: 'from-red-600 to-rose-500',       desc: 'Aim mirrors to guide the laser to the target — fewer mirrors available', targetScore: 800 },
  { id: 160, name: 'Tower Balance',     difficulty: 'Hard',   color: 'from-slate-500 to-cyan-400',     desc: 'Stack 15 blocks without toppling — earthquakes grow stronger', targetScore: 1500 },
  { id: 161, name: 'Tap Color Rush',    difficulty: 'Hard',   color: 'from-pink-500 to-rose-400',      desc: 'Tap the correct color fast — wrong tap costs 150 pts and 1 second', targetScore: 1500 },
  { id: 162, name: 'Math Dash',         difficulty: 'Hard',   color: 'from-blue-500 to-cyan-400',      desc: 'Solve math in 2s then 0.8s — streak x10 gives bonus per answer', targetScore: 2000 },
  { id: 163, name: 'Word Swipe',        difficulty: 'Medium', color: 'from-amber-400 to-orange-400',   desc: 'Swipe letters to form words — longer words score more', targetScore: 1500 },
  { id: 164, name: 'Shape Sort',        difficulty: 'Medium', color: 'from-sky-500 to-blue-400',       desc: 'Sort falling shapes to the right slots — speed doubles after 600 pts', targetScore: 1200 },
  { id: 165, name: 'Pattern Break',     difficulty: 'Hard',   color: 'from-violet-500 to-fuchsia-400', desc: 'Tap when the pattern breaks — speed increases 5% every 5 correct', targetScore: 1000 },
  { id: 166, name: 'Flow Connect',      difficulty: 'Medium', color: 'from-emerald-500 to-teal-500',   desc: 'Draw lines to connect matching colors — no crossings allowed', targetScore: 1000 },
  { id: 167, name: 'Block Escape',      difficulty: 'Medium', color: 'from-orange-500 to-red-400',     desc: 'Slide blocks to clear the exit — optimal moves required', targetScore: 800 },
  { id: 168, name: 'Pipe Master',       difficulty: 'Medium', color: 'from-cyan-500 to-teal-400',      desc: 'Rotate pipes to connect water flow — leaks cost 150 pts', targetScore: 1000 },
  { id: 169, name: 'Hex Fill',          difficulty: 'Hard',   color: 'from-amber-500 to-yellow-400',   desc: 'Place hex pieces to fill the board — pieces shrink after 500 pts', targetScore: 1000 },
  { id: 170, name: 'Maze Run Pro',      difficulty: 'Hard',   color: 'from-slate-600 to-blue-500',     desc: 'Navigate the maze — wrong path sends you back to start', targetScore: 1000 },
  { id: 171, name: 'Beat Tap',          difficulty: 'Hard',   color: 'from-rose-500 to-orange-400',    desc: 'Tap on the beat — BPM rises from 120 to 180, one miss = 3 perfects', targetScore: 1500 },
  { id: 172, name: 'Lane Switcher',     difficulty: 'Medium', color: 'from-sky-500 to-cyan-400',       desc: 'Switch lanes to dodge obstacles synced to the music', targetScore: 1200 },
  { id: 173, name: 'Dot Rhythm',        difficulty: 'Hard',   color: 'from-fuchsia-500 to-violet-400', desc: 'Tap dots exactly on beat — more dots and faster BPM over time', targetScore: 1000 },
  { id: 174, name: 'Drum Loop',         difficulty: 'Hard',   color: 'from-amber-600 to-orange-500',   desc: 'Reproduce drum patterns — 4/4 grows to 7/8 time signature', targetScore: 1200 },
  { id: 175, name: 'Line Rider Pro',    difficulty: 'Hard',   color: 'from-teal-500 to-emerald-400',   desc: 'Draw a line — rider must reach the flag without falling', targetScore: 1000 },
  { id: 176, name: 'Maze Balance',      difficulty: 'Hard',   color: 'from-slate-500 to-teal-400',     desc: 'Tilt to guide the ball through the maze — gyroscope sensitivity', targetScore: 1000 },
  { id: 177, name: 'Thread Needle',     difficulty: 'Hard',   color: 'from-pink-500 to-rose-400',      desc: 'Guide the thread through the shrinking needle — 5px to 1px gap', targetScore: 1000 },
  { id: 178, name: 'Curve Draw',        difficulty: 'Hard',   color: 'from-blue-500 to-sky-400',       desc: 'Draw the curve with 90%+ accuracy — time shrinks from 5s to 2s', targetScore: 1000 },
  { id: 179, name: 'Dodge Spikes',      difficulty: 'Hard',   color: 'from-yellow-500 to-red-500',     desc: 'Survive every second for 100 pts — spikes speed up 5% each second', targetScore: 2000 },
  { id: 180, name: 'Stack Master',      difficulty: 'Hard',   color: 'from-cyan-500 to-blue-400',      desc: 'Drop blocks perfectly — combo builds to 1000 pts in one shot', targetScore: 2000 },
  { id: 181, name: 'Rope Swing',        difficulty: 'Medium', color: 'from-emerald-500 to-cyan-400',   desc: 'Swing and fly 15 meters for the win — wind shifts direction', targetScore: 1500 },
  { id: 182, name: 'Gravity Flip',      difficulty: 'Hard',   color: 'from-violet-500 to-blue-400',    desc: 'Flip gravity to dodge lasers — more lasers and faster speed', targetScore: 1500 },
  { id: 183, name: 'Wall Jump',         difficulty: 'Hard',   color: 'from-orange-500 to-red-400',     desc: 'Jump between walls — path narrows and spikes multiply', targetScore: 1500 },
  { id: 184, name: 'Quick Sort',        difficulty: 'Medium', color: 'from-sky-500 to-teal-400',       desc: 'Sort numbers in order — 5 numbers grows to 9, time 5s to 2s', targetScore: 1200 },
  { id: 185, name: 'Odd One Out',       difficulty: 'Medium', color: 'from-amber-400 to-orange-400',   desc: 'Find the different shape — grid grows and differences shrink', targetScore: 1000 },
  { id: 186, name: 'Equation Build',    difficulty: 'Hard',   color: 'from-blue-600 to-cyan-500',      desc: 'Build equations from given numbers — larger results score more', targetScore: 1500 },
  { id: 187, name: 'Traffic Control',   difficulty: 'Hard',   color: 'from-green-500 to-emerald-400',  desc: 'Tap lights to let cars pass — one crash costs 3 safe passes', targetScore: 2000 },
  { id: 188, name: 'Sniper Focus',      difficulty: 'Hard',   color: 'from-slate-600 to-red-500',      desc: 'Hit the target that appears for 0.1s — target shrinks with score', targetScore: 1000 },
  { id: 189, name: 'Type Speed Pro',    difficulty: 'Hard',   color: 'from-teal-500 to-blue-400',      desc: 'Type words correctly — no backspace, wrong letter costs 150 pts', targetScore: 1500 },
  { id: 190, name: 'Micro Drag',        difficulty: 'Hard',   color: 'from-rose-500 to-pink-400',      desc: 'Drag through the shrinking corridor — corridor goes 10px to 2px', targetScore: 1000 },
  { id: 191, name: 'Bounce Count',      difficulty: 'Medium', color: 'from-orange-400 to-amber-400',   desc: 'Predict exact bounce count — more obstacles and complex physics', targetScore: 1000 },
  { id: 192, name: 'Zen Balance',       difficulty: 'Hard',   color: 'from-cyan-400 to-teal-400',      desc: 'Balance the platform — every second standing scores 100 pts', targetScore: 2000 },
  { id: 193, name: 'Color Grid Logic', difficulty: 'Hard',   color: 'from-emerald-500 to-blue-500',   desc: 'Fill the grid by color rules — 4x4 grows to 8x8', targetScore: 1000 },
  { id: 194, name: 'Pixel Paint Pro',   difficulty: 'Medium', color: 'from-pink-400 to-fuchsia-400',   desc: 'Paint pixels within the lines — canvas grows from 16x16 to 32x32', targetScore: 1500 },
  { id: 195, name: 'Vocal Pitch',       difficulty: 'Hard',   color: 'from-fuchsia-500 to-rose-400',   desc: 'Match the pitch within ±10Hz — notes get closer and faster', targetScore: 1000 },

  /* ── 5 ELITE ADDICTIVE SOLO (196-200) ── */
  { id: 196, name: 'Vortex Lock',     difficulty: 'Hard', color: 'from-cyan-500 to-fuchsia-500',  desc: 'Two rings spin opposite — tap when BOTH gaps lock on target. Speed climbs each hit', targetScore: 1500 },
  { id: 197, name: 'Mirror Sync',     difficulty: 'Hard', color: 'from-emerald-500 to-amber-400', desc: 'Two-finger sync — tap LEFT and RIGHT targets within 250ms. Window shrinks',          targetScore: 1200 },
  { id: 198, name: 'Reverse Reflex',  difficulty: 'Hard', color: 'from-fuchsia-500 to-rose-500',  desc: 'Swipe the OPPOSITE direction of the arrow — your brain fights you. Window shrinks',  targetScore: 1500 },
  { id: 199, name: 'Chrono Stack',    difficulty: 'Hard', color: 'from-emerald-500 to-cyan-400',  desc: 'Stack perfectly — every 8s TIME REWINDS and only PERFECT blocks survive',            targetScore: 1500 },
  { id: 200, name: 'Pulse Sniper',    difficulty: 'Hard', color: 'from-cyan-500 to-blue-600',     desc: 'Predict where the dot will be in 0.5s — tap the FUTURE, not the present',            targetScore: 1500 },
]);

export const LANGUAGES = {
  en: 'English',
  ar: 'العربية',
  fa: 'فارسی',
  ru: 'Русский',
  tr: 'Türkçe',
  id: 'Bahasa Indonesia',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
};

export const ANTI_CHEAT = { minReactionTime: 200, maxReactionTime: 30000 };
