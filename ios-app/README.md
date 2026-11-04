# Station for iPhone

A native iPhone app around the Station web app (`../world`), built with
Capacitor. Adds what Safari can't do:

- **Live Photo wallpapers**: the camera's two clips are saved to Photos as
  real Live Photos (`plugins/live-photo`, Swift).
- **Notifications**: when the app goes to the background it schedules a nudge
  for when the boys get hungry or a need runs low.

Built by GitHub Actions on a cloud Mac (`.github/workflows/ios.yml`): every
push compiles it; with the App Store Connect secrets set, it also uploads to
TestFlight. `npm run sync` copies `../world` into the shell.
