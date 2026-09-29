# Sound sources

Generated with ElevenLabs sound effects (`eleven_text_to_sound_v2`) on 2026-09-29, flow
`BEKSmlrVxcdSCCiqeyp2` ("Mòpyon Cascades — game sounds"), converted to AAC with `afconvert`.

| File | Prompt |
|---|---|
| strike_0/1 | Quick ballpoint pen stroke drawn fast across paper, crisp scratchy swipe, close-mic |
| erase_0/1 | Rubber eraser rubbing fast on paper, short brisk back-and-forth scrubbing, close-mic |
| land_0/1 | Small cardboard tile tapped down onto a wooden desk, soft dry click, very short |
| fall_0/1 | Handful of small paper cards dropped and cascading onto a wooden table, light fluttering patter |
| step_0/1 | Single bright steel drum note, clean Caribbean steel pan hit, short ringing tail |
| reward_0 | Short cheerful reward jingle for a casual game: three quick rising warm marimba notes with a soft bell ping on the last note, under one second, crisp clean ending, no long reverb tail, no harsh highs |
| dead_0 | Pencil tapping twice on paper, soft dull taps, quiet |
| click_0 | Retractable ballpoint pen click, single crisp plastic click, close-mic |

## Music

`public/audio/music.m4a` (and the other take, kept out of the build as `assets/music/music_alt.m4a`)
was generated with ElevenLabs Music (`eleven_music_v2_5`), 60 s, from: "Light, relaxed Haitian
kompa-flavoured instrumental loop for a casual game: gentle nylon acoustic guitar riff, soft steel
pan melody, marimba accents, light shaker and brushed hand percussion, warm and sunny,
medium-slow tempo around 96 BPM, steady even energy with no big build or drop so it loops
smoothly as background music, no vocals, about 60 seconds." It plays only when the player turns
music on in the menu.

## Standard sounds

A win is heard from the kit's win toast, the studio's standard win sound in every game. The only
extra is `public/audio/standard/win.m4a` (Candy Cascade's `scene-v2/win_0`), played once as the
free-games summary counts its total up.

The free-games sound is a single take on purpose: every tier (5, 10, 15) and the award play the
same chime, so the moment is always recognised. reward_0 is the second of four takes (three
rising notes, about 590, 790 and 1000 Hz, in the first 0.2 s), cut to 0.75 s with a 0.25 s fade.
It replaced a two-second marimba arpeggio the user found too long; that take and two others (a
marimba, a kalimba glissando) were removed on 2026-09-29.
