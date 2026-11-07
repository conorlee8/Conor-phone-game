# Station: the plan

A cozy space-station game for iPhone (built for the iPhone Duo's two screens).
You look after a living, painted station, build it out pod by pod, and turn
any moment into a Live Photo wallpaper. Public App Store release.

Decided with Conor:
- **Audience:** public App Store.
- **Building:** a mix. A catalog of ready-made pods (instant, free to place)
  plus custom pods the player describes, painted and animated by AI (takes
  about two minutes, costs credits).
- **Feel:** cozy first. Caring for the station earns credits; credits fund
  building; growing the station ring by ring is the long-term goal.
- **Wallpaper:** both. Snap any moment yourself, plus an automatic daily
  "station today" pair for the closed and open screens.

## The three modes

1. **Live:** the station plays as a looping video. Needs (power, food, air,
   fun, pets) drain in real time; tap pods to care for them. Neglect shows:
   dim lights, flicker, and later a neglected video version of each pod.
2. **Build:** empty slots on the station. Place a catalog pod, or describe a
   custom one plus who lives there. The AI paints the pod into its slot and
   animates it; the generation time is the in-game build timer.
3. **Wallpaper:** capture the same moment for both screens and save it as a
   pair of Live Photos (native app plugin already written).

## What has to change technically

- **Modular station.** Today the station is one painting and one stitched
  video. A builder needs slots: an empty station shell with numbered slots,
  and per-pod assets (still + seamless loop clip) composited into it. The
  per-room repaint (`wallpaper/tools/pod.py`) and the first-and-last-frame
  loop animation (`wallpaper/tools/omni.py`) already work at pod size.
- **A server.** The Gemini key cannot ship inside the app. A small backend
  holds it, runs custom builds, stores each player's station, and charges
  credits. Default choice: Firebase (Sign in with Apple, Firestore, Storage,
  Cloud Functions calling the Gemini API).
- **Shared catalog assets.** Catalog pods are generated once by us and
  shared by every player, so starting a station costs nothing per player.
- **Payments.** Credits for custom pods through Apple in-app purchase.
- **App Store rules.** Moderation of custom pod prompts and uploaded photos
  (Guideline 1.2), a privacy policy, account deletion, age rating. Real-brand
  nods (Rust, N64, DBZ) and nicotine (the snus shop) stay out of catalog
  content; players' own custom pods go through moderation.

## Phases

1. **Foundation:** accounts, cloud save, station as data (slots + pods).
2. **Modular station:** empty shell art with slots; convert the current pods
   into the first catalog pods; per-pod looping video.
3. **Build mode:** catalog placement, then custom AI pods on the server
   with build timers.
4. **Economy:** credits from caring, costs, ring expansions, unlocks.
5. **Residents:** player photo to character (approved drawing), friends as
   residents, pets.
6. **Wallpaper:** daily auto pair, Live Photo save (native).
7. **Launch:** TestFlight beta, moderation, privacy policy, App Store review.

## Where things are now

- `world/`: the Station app (Safari, home screen) with the living video,
  needs, care and wallpaper capture.
- `ios-app/`: the native iPhone shell (Capacitor) with the Live Photo
  plugin; builds on GitHub Actions; TestFlight waits on Apple Developer
  enrollment.
- `wallpaper/`: the art and video pipeline (see `wallpaper/BRIEF.md`,
  `wallpaper/VIDEO_PLAN.md`, `wallpaper/pods/RUNBOOK.md`).
