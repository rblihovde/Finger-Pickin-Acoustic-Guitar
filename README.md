Finger-Picking-Acoustic-Guitar
================================

Logic Pro (Scripter) MIDI FX script that generates realistic acoustic guitar
fingerpicking patterns and voicings from held MIDI notes. Includes:

- Multiple fingerpicking patterns (Travis, alternating bass, PIMA, folk, Jack Johnson
	inspired patterns, plus 12-step triplet patterns for a triplet-in-4/4 feel).
- Voicing modes: Open-String, Use Held Notes, Triad, and Barre Chords (realistic
	E-form barre shapes).
- Humanization: swing, timing jitter, velocity jitter, accents, omit/ghost notes.
- Safeguards to avoid hanging notes: scheduled notes are tracked and NoteOffs are
	sent when you release keys or stop the transport.

Quick install (Logic Pro X Scripter)
----------------------------------
1. In Logic Pro, add a MIDI FX slot on a Software Instrument track and choose
	 "Scripter".
2. Open the Scripter editor, paste the contents of `Finger-Picking-Acoustic-Guitar-1-v1.js`
	 into the script editor, or load the file if you saved it to disk.
3. Enable the Scripter plugin and set `Guitar Mode` = On.

How to use — recommended starting settings
-----------------------------------------
- Guitar Mode: On
- Guitar Pattern: choose one of the patterns (Travis, Alternating Bass, Classic Arpeggio, PIMA, Folk, Jack Johnson 1/2/3, JJ Triplet 1/2/3)
- Beat Division: default 4 for normal 8-step patterns. For the triplet (12-step) patterns
	set `Beat Division` to 12 to get 4/4 triplet subdivisions (each beat split into three).
- Note Length / Random Length / Random Delay: adjust to taste for more or less overlapping
	sustain and human feel.
- Voicing Mode:
	- Open-String: favors open-string voicings when possible.
	- Use Held Notes: uses the exact held notes as the chord basis.
	- Triad: builds a triad from held notes.
	- Barre Chords: uses realistic barre chord voicings (E-form shapes) — hold a chord and
		set this mode to get true barre voicings placed on the fretboard.
- Thumb Drone: toggles optional high-string (thumb) drone behavior.
- Voicing Inversion: raise lowest notes by octave (Off / Up 1 / Up 2) to change texture.

Triplet patterns
-----------------
The JJ Triplet patterns are 12-note cycles designed to be used with `Beat Division` = 12.
Each cycle equals four beats of triplets (3 per beat). If you leave division at 4 the pattern
will still run but it will be indexed modulo 8/16 (so set 12 for intended behavior).

Barre Chords
------------
When `Voicing Mode` = Barre Chords the script will:

1. Detect the chord from held notes, attempting to identify major / minor / 7th variants.
2. Choose a playable barre fret (prefers frets 1–7 where possible) and apply a standard
	 E-form barre shape so the voicing reflects how a real guitarist would fret the chord.
3. Ensure resulting notes are chord tones and within standard guitar range (low E = MIDI 40 and up).

Accent and humanization
-----------------------
Accent patterns are designed for guitar-style phrasing (downbeat/strong beat, syncopation,
triplet emphasis, alternating thumb/finger accents). Use `Accent Amount (%)` to scale the
accented note's velocity. Use `Swing (%)` and `Timing Jitter (ms)` to taste.

Avoiding hanging notes
----------------------
The script tracks scheduled NoteOns and automatically sends NoteOffs when:
- you release all held notes on the keyboard (so held chord releases stop future scheduled notes),
- or when the host transport stops.

Troubleshooting
---------------
- If notes hang in Logic, make sure the Scripter plugin is enabled and that `Guitar Mode` is set
	appropriately. Releasing all held notes forces scheduled note-offs.
- If a barre voicing doesn't match the expected chord, try holding a clearer triad (root+3rd+5th)
	or switch `Voicing Mode` to Triad and use Barre mode once detected notes are correct.

License
-------
This repository is released under the MIT License — see `LICENSE`.

Credits
-------
Author: Ryan Blihovde (modified for guitar)

If you'd like more patterns, alternate tunings, or a small GUI-style parameter guide added
to the README, tell me which items to include and I will add them.
