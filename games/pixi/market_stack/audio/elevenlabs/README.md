# Market Stack effects

Generated using ElevenLabs Sound Effects v2. See sources.json for prompts and generation IDs.

- crate_land.ogg: one dry wooden landing, reused with mild pitch variation.
- collapse.wav: one short wood tumble (0.75 s, silent by 0.6 s) that ends with the debris animation; replaces the earlier 1.64 s collapse.ogg whose late impacts outlasted the animation.
- payout.ogg: coin tray jingle for the win event; shared with UI coin feedback at lower volume.

Mono 24 kHz Vorbis, quality 2. Trimmed silence and short fades prevent delayed feedback and edge clicks. Combined files: 25738 bytes. Original takes remain in ElevenLabs and temporary working storage, outside exported resources.

The existing synthesized bazaar loop is now mono 32 kHz Vorbis (174,914 bytes). Export presets exclude the retained old WAV effects and loop, and unused wood impact assets.

Landing revised to a softer 0.42-second wooden knock, low-pass filtered at 3.8 kHz and played at -10 dB. Collapse high frequencies softened at 4.5 kHz. Betting panel feedback lives in the shared browser UI assets, separate from these game sounds.
