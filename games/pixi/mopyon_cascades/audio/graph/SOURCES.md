# Graph-paper sound sources

The paper look plays these in place of the tiles' landing and pen
sounds (`GRAPH_FILES` in `src/platform/audio.ts`); every other sound is shared with the tiles.
Generated with ElevenLabs sound effects (`eleven_text_to_sound_v2`) on 2026-09-29, flow
`BEKSmlrVxcdSCCiqeyp2` ("Mòpyon Cascades — game sounds"), trimmed and converted to AAC.

| File | Replaces | Prompt |
|---|---|---|
| tick_0/1 | land | One tiny light pencil-tip tick on a sheet of paper, delicate crisp papery tick, high and soft, very quiet, extremely short, no thump, no bass, no table, close-mic |
| marker_0/1 | strike | Highlighter marker drawn in one quick straight stroke across paper, soft felt-tip swish with a faint squeak, short, close-mic |

Four takes of each were generated; one clean single tick from each of two tick takes and two of
the highlighter strokes were kept. A felt-tip dab was the first landing sound, dropped because
it was nearly all below 800 Hz and landed as a thump; a marker-dot patter was made for the
fall, then dropped: on graph paper the ticks as the marks land are the fall, and the patter
made each cascade too busy. Trims: tick_0 from 0.092 s and tick_1 from 1.703 s, 70 ms each,
low-passed at 6 kHz when played; marker_0 0.45–0.95 s and marker_1 0.40–0.88 s,
where the stroke is loudest. The marker is also low-passed at 4.5 kHz when played (`GRAPH_SHAPE`).
