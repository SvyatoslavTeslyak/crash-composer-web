Gameplay sound effects generated with ElevenLabs Sound Effects v2 (`eleven_text_to_sound_v2`)
on 2026-09-17, flow "Explosive Fruits SFX": https://elevenlabs.io/app/flows/8jJMsIPHCDxUckRh81xf

They replace the synthesized clips from `tools/make_fruit_audio.py` at runtime (those files stay
as the procedural source). `LocalFeedback.FRUIT_SFX` lists the take count per event; one take is
picked at random with ±5% pitch. Panel sounds (tap, toggle, coins, win) come from the UI kit.

Post-processing: MP3 → 44.1 kHz mono 16-bit WAV (afconvert), silence trimmed at −40 dB,
short fades, peak normalized to −1 dBFS, length capped per event; per-event volume in `EVENT_DB`
is set from measured RMS.

| Event | Takes | Trigger (scripts/game/fruit_stage.gd) | Prompt |
|---|---|---|---|
| slice | 4 | any slice reveal (replaces slice + splat) | Sharp blade swipe slicing cleanly through a juicy watermelon, fast whoosh into a wet crisp chop with a small juice splash, short, close-mic, dry |
| launch | 3 | fruit wave thrown | Soft short air whoosh of a round fruit tossed upward, light and airy, very short, dry |
| golden | 2 | golden core | Magical treasure reveal, bright sparkling chime burst with shimmering gold glitter, rewarding, short, no voice |
| boom | 2 | explosive core | Big punchy cartoon bomb explosion with wet juicy fruit splatter and scattering debris, deep boom, short tail |
| rotten | 2 | rotten core | Squishy rotten fruit squelch, wet mushy splat followed by a sad deflating slime gurgle, short, close-mic, no voice |
| freeze | 2 | freeze fruit starts SLOW-MO | Icy crystal freeze whoosh with a descending slow-motion time warp, glassy shimmer, short, no voice |

Volumes, pitch spread and enabled takes now live in `assets/audio/sounds.json` (edit them in Crash Composer → Sound Studio); the table below records how each take was generated.
