Swing 8th Notes - Logic Pro Scripter Plugin
============================================

A simple Logic Pro (Scripter) MIDI FX plugin that adds swing to 8th notes.

This plugin delays every other 8th note to create a swing or shuffle feel.
Perfect for adding groove to straight MIDI performances.

Features
--------
- Single parameter for swing amount (0-100%)
- 0% = straight 8th notes
- 60% = moderate swing (recommended starting point)
- 100% = extreme swing (approaching triplet feel)
- Works with any incoming MIDI notes
- Automatically handles note cleanup to prevent hanging notes

Quick Install (Logic Pro X Scripter)
------------------------------------
1. In Logic Pro, add a MIDI FX slot on a Software Instrument track and choose "Scripter"
2. Open the Scripter editor and paste the contents of `swing-8th-notes.js` into the script editor
3. Adjust the "Swing Amount" parameter to taste (try 60% for a classic swing feel)

How to Use
----------
1. Add the Scripter plugin before your instrument on any MIDI track
2. Play or record MIDI notes as normal
3. Adjust the "Swing Amount" slider to control how much swing is applied
4. Start with 60% for a moderate swing feel, or try different values for more or less swing

Technical Details
-----------------
The plugin works by detecting odd 8th notes (off-beats) and delaying them by a calculated amount.
At 60% swing, the timing approaches a triplet subdivision (2:1 ratio instead of 1:1).
The plugin processes all incoming MIDI notes in real-time and applies the timing adjustment.

Additional Plugins in this Repository
--------------------------------------
This repository also includes `Finger-Picking-Acoustic-Guitar-1-v1.js`, a more complex
fingerpicking arpeggiator with multiple patterns and voicing modes. See that file for details.


License
-------
This repository is released under the MIT License — see `LICENSE`.

Credits
-------
Author: Ryan Blihovde

If you'd like more patterns, alternate tunings, or a small GUI-style parameter guide added
to the README, tell me which items to include and I will add them.
