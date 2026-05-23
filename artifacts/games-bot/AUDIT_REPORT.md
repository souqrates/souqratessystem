# تقرير الفحص الشامل لكودات المشروع
**التاريخ**: 2026-05-11
**الملفات المفحوصة**: 61 لعبة + ملفات النظام الأساسية

---

## 1. ملخص تنفيذي

| الفئة | العدد | الأولوية |
|---|---|---|
| CRITICAL (تكسر اللعب أو ذاكرة) | 22 ملف لعبة + 3 ملفات نظام | فورية |
| HIGH (تجربة لعب سيئة) | 17 ملف لعبة | عاجلة |
| MEDIUM (جودة كود) | 5 مشاكل عامة | متوسطة |
| LOW (تجميل) | 5 ملاحظات | لاحقة |
| **ملفات نظيفة تماماً** | **24 لعبة** | — |

---

## 2. المشكلة الأهم — تحرك الصفحة عند اللمس

السبب الرئيسي ليس في الألعاب نفسها بل في:

### CRITICAL #1: `src/lib/telegram.js`
- لم يُستدعَ `wa.disableVerticalSwipes()`
- لم يُستدعَ `wa.requestFullscreen()` (متاح من Bot API 8.0)
- `wa.expand()` مستدعى مرتين لكن غير كافٍ

### CRITICAL #2: `src/components/games/GameModal.jsx:179`
- body overflow غير محكم أثناء phase = 'playing'
- المنطقة خلف المودال يمكن تمريرها

### CRITICAL #3: `index.html`
- viewport meta لا يحتوي `interactive-widget=resizes-content`
- لا توجد قواعد CSS `overscroll-behavior: none`

---

## 3. الألعاب — تسريبات setInterval حرجة

| اللعبة | السطر | الوصف |
|---|---|---|
| BlitzTap.jsx | L153, L161, L210 | power-up countdowns بدون refs |
| SpeedMath.jsx | L99, L103 | glitch interval في nextQ |
| StarCatcher.jsx | L122-123 | moveIntervalRef غير منظَّف |
| TapBlitz.jsx | L56, L75 | return statement ناقص |
| ArrowStorm.jsx | L145, L151 | spawnRef يُستبدل بدون clear |
| AsteroidField.jsx | L552 | thrustIntervalRef يُستبدل |
| CodeBreaker.jsx | L100 | glitchRef في nextRound |
| ColorWar.jsx | L306 | timerRef يُستبدل |
| DualTap.jsx | L175, L183 | wt/ci غير متتبعة |
| DuelOfDots.jsx | L110 | botIntRef بدون فحص |
| GhostHunter.jsx | L135 | عند تغيير speedLevel |
| GravityDrop.jsx | L483 | CtrlBtn لا يُنظَّف أبداً |
| MemoryFlash.jsx | L336 | داخل gameLoop |

---

## 4. الألعاب — تسريبات setTimeout

| اللعبة | السطر | الوصف |
|---|---|---|
| BalloonPop.jsx | L156 | setParticles بعد unmount |
| BombDrop.jsx | L154 | bombTimers جزئياً |
| Decryptor.jsx | L26 | غير متتبَّع |
| MemoryDuel.jsx | L81 | peek phase |
| MemoryFlash.jsx | L125-130 | flash phase |
| ReflexKing.jsx | L111 | يكتب فوق نفس ref |
| WordStorm.jsx | L225, L337 | reshuffleRef خارج cleanup |

---

## 5. الألعاب — حلقات RAF غير مُلغاة

| اللعبة | السطر | الوصف |
|---|---|---|
| BalloonPop.jsx | L200 | rafLoop لا يُلغى |
| GravityDrop.jsx | L250 | غير مُلغى صراحة |
| GravityThief.jsx | L148 | لا cleanup |
| NeonBreak.jsx | L279, L297 | reference يضيع |
| BlockSmash.jsx | L480 | s.rafId يُكتب مرات |

---

## 6. الألعاب — preventDefault / touch-action ناقصة

| اللعبة | السطر | المشكلة |
|---|---|---|
| BlitzTap.jsx | L272, L442 | لا touchAction |
| GravityBall.jsx | L424 | لا preventDefault |
| LaserMaze.jsx | L435 | لا touchAction |
| MemoryDuel.jsx | L154 | card flips |
| MemoryFlash.jsx | L326 | card clicks |
| MeteorBlitz.jsx | L417-418 | canvas بدون touchAction |
| NeonBreak.jsx | L563 | padBarRef |
| SkyRace.jsx | L449 | onPointerDown |
| SnakeDuel.jsx | L293 | onTouchEnd |
| SpeedMath.jsx | L268 | onPointerDown |
| TimingKing.jsx | L354 | Space/Enter |
| TypeRacer.jsx | L354 | Space/Enter |
| WordStorm.jsx | L461 | بطاقات الكلمات |

---

## 7. الألعاب — Race Conditions & Stale Closures

| اللعبة | السطر | الوصف |
|---|---|---|
| SnakeDuel.jsx | L185-192 | mutations في tick callback |
| TypeRacer.jsx | L151-152, L209 | timerRef._t غير مستقر |
| HexBlast.jsx | L140 | dependency array ناقص |
| MeteorBlitz.jsx | L52 | global meteId ينمو بلا حد |

---

## 8. ملفات نظيفة (لا تحتاج إصلاحاً)

ChainReaction, ColorFlood, GridMaster, HexClaim, MathKing, PatternRecall, PixelArt, PrecisionSplit, PuzzleRush, QuadArena, ReflexRace, RhythmBattle, RhythmDuel, RhythmPulse, ShadowMatch, NinjaSlice, SpinMaster, StackTower, StarForge, SyncTap, TargetMaster, TowerBuild, VoltDodge, WordWar.

**24 لعبة جاهزة بدون تعديل.**

---

## 9. مشاكل MEDIUM (جودة كود)

1. **GameEngine.jsx** — لا يوجد Error Boundary. لو رمت لعبة استثناءً ينهار التطبيق كله.
2. **PongClash.jsx:150** — يزيد rally النقطة كل frame (60/ثانية) بينما باقي الألعاب per-event. يكسر مقارنات multiplayer.
3. **Telegram theme** — كل الألوان مثبتة، لا تتكيف مع dark/light theme.
4. **مكتبة matchmaking.js** — لا يوجد exponential backoff على retry.
5. **GroupLobby.jsx** — اشتراك Realtime قد لا يُلغى عند تبديل الغرف بسرعة.

---

## 10. مشاكل LOW (تجميل)

1. Haptic feedback غير متناسق (بعض الألعاب تستدعيها كل لمسة، أخرى لا تستدعيها أبداً)
2. حالات تحميل (loading skeletons) ناقصة في MultiplayerLobby/QuadLobby/GroupLobby
3. تباين ضعيف لبعض النصوص على glass cards (يفشل WCAG AA)
4. WordWar timer يحدّث كل 80ms → اهتزاز بصري
5. لا توجد رسوم سكلتون أثناء انتقال الصفحات

---

## 11. خطة الإصلاح المقترحة

### المرحلة 1 — فورية (تحل مشكلة التمرير)
- `src/lib/telegram.js`: إضافة `disableVerticalSwipes()` + `requestFullscreen()`
- `src/components/games/GameModal.jsx`: قفل body overflow أثناء اللعب
- `index.html`: تحديث viewport + إضافة `overscroll-behavior: none`

### المرحلة 2 — تسريبات الذاكرة (22 لعبة)
إصلاح كل setInterval/setTimeout/RAF غير منظَّف.

### المرحلة 3 — preventDefault & touch-action (13 لعبة)
إضافة `touchAction: 'none'` على كل canvas/game-area.
إضافة `e.preventDefault()` على كل touch handler.

### المرحلة 4 — Race conditions (4 ألعاب)
إصلاح stale closures في SnakeDuel و TypeRacer.

### المرحلة 5 — تحسينات
- Error Boundary حول GameEngine
- توحيد haptics
- Telegram theme integration
- Loading skeletons

---

## 12. الإحصاء النهائي

```
ملفات بها مشاكل CRITICAL: 22 + 3 ملفات نظام
ملفات بها مشاكل HIGH:     17
ملفات نظيفة:              24
المجموع المفحوص:          61 لعبة
أسطر الكود المراجعة:       ~28,000 سطر تقريباً
```
