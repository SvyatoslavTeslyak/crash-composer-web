# Background theme

`theme.wav` is this game's own loop: warm banjo and soft accordion with light woodblock percussion.

Generated 2026-09-17 with ElevenLabs `eleven_music_v2` (30 s, 900 credits):
<https://elevenlabs.io/app/flows/i446mwkloS8Tn0TPKeF5>

Processing: decoded to mono 44.1 kHz, the last 2 s cross-faded back over the
opening so the seam is inaudible (28.0 s), levelled to -18 dB RMS. Godot imports
it with QOA compression; the game sets `LOOP_FORWARD` at load.

It plays on its own `AudioStreamPlayer`, so it never steals a voice from an
effect, and starts and stops with the Sound setting. the `music` event in `assets/audio/sounds.json` sets the level; retune it in Crash Composer → Sound Studio.
