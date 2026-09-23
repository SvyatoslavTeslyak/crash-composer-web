# Background theme

`theme.wav` is this game's own loop: gentle warm marimba and soft acoustic guitar plucks over a light shaker groove.

Generated 2026-09-17 with ElevenLabs `eleven_music_v2` (30 s, 900 credits):
<https://elevenlabs.io/app/flows/IBTIyyCS8vkbu5rQQVVU>

Processing: decoded to mono 44.1 kHz, the last 2 s cross-faded back over the
opening so the seam is inaudible (28.0 s), levelled to -18 dB RMS. Godot imports
it with QOA compression; the game sets `LOOP_FORWARD` at load.

It plays on its own `AudioStreamPlayer`, so it never steals a voice from an
effect, and starts and stops with the Sound setting. `LocalFeedback.music_db()` keeps it at -20 dB (no manifest in this game).
