Gameplay sound effects generated with ElevenLabs Sound Effects v2 (`eleven_text_to_sound_v2`)
on 2026-09-17, flow "Goat Gold SFX": https://elevenlabs.io/app/flows/quMkLZruiqbHHQUkIr5X

Several takes per sound (`_0`, `_1`, …; counts in `LocalFeedback.GOAT_SFX`); one is picked at random with ±6% pitch.
Post-processing: MP3 → 44.1 kHz mono 16-bit WAV (afconvert), leading/trailing silence
trimmed at −40 dB, 4 ms fade-in, 60 ms fade-out, peak normalized to −1 dBFS, length capped.

No goat voice is used anywhere in the game. Panel/UI sounds (tap, toggle, refill, HUD coins, win sting) are not here; they come from the UI kit.

| Event | Trigger (scripts/game/gold_stage.gd) | Prompt |
|---|---|---|
| sack_creak | while fill > 0.25, every 3.2 → 1.1 s as the sack fills | Burlap sack stretching under heavy load, short rope creak and coarse fabric strain, close-mic, dry |
| sack_rip | sack tears (crash); no goat voice on crash | Thick burlap sack ripping open, loud fast fabric tear with a seam popping, close-mic, dry |
| gem_chime | diamond/ruby/emerald lands, Treasure only, ≥0.45 s apart | Small crystal gem dropping onto a pile of coins, bright sparkling twinkle chime, short, close-mic |
| ingot_clunk | gold ingot lands, Treasure only, shares the gem cooldown | Heavy gold bar dropping onto a pile of coins inside a cloth sack, dense metallic clunk with coin jingle, short, close-mic |
| sack_coins (4) | Treasure items land in the sack, one sound per 0.2–0.3 s beat | Handful of small gold coins dropping into a soft cloth sack, muffled metallic jingle with a soft fabric thump, short, close-mic, dry |
| sack_produce (4) | Market vegetables land in the sack, one sound per 0.2–0.3 s beat; single hit per take, 0.4 s | Single fresh vegetable landing on a pile of vegetables in a sack, one short crisp juicy thump, very short, close-mic, dry, no rustle |
| cashout_sparkle (3) | round cashed out; no goat voice on win | Light gentle win sparkle, soft rising glockenspiel shimmer with a delicate coin twinkle, airy and pleasant, short, no voice |

Volumes, pitch spread and enabled takes now live in `assets/audio/sounds.json` (edit them in Crash Composer → Sound Studio); the table below records how each take was generated.
