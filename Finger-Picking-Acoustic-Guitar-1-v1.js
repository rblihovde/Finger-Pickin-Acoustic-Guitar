//-----------------------------------------------------------------------------
// Guitar Fingerpicking Arpeggiator & Voicing Scripter
// Description: Logic Scripter MIDI FX adapted for acoustic guitar fingerpicking.
// Emulates common fingerpicking patterns, guitar voicings, accents, swing, humanization,
// omission/ghost notes, and voicing inversions.
// - Use "Guitar Mode" to enable guitar behavior (patterns, voicings).
// - Voicing maps to standard 6-string tuning (E2 A2 D3 G3 B3 E4).
// - Accent patterns, swing, timing/velocity jitter, omit replacement (silent/ghost), and inversion are supported.
// Author: Ryan Blihovde (modified for guitar)
//-----------------------------------------------------------------------------
/*	
		Held notes are tracked in a global array in the HandleMIDI() callback.
		Notes are chosen and played back during the ProcessMIDI() callback.
*/

var NeedsTimingInfo = true;
var activeNotes = [];
// Omit/rotation state
var omitIndex = 0;
var lastCycleNumber = -1;
// Track scheduled notes for cleanup
var scheduledNotes = [];

function HandleMIDI(event) {
	if (event instanceof NoteOn) {
		// add note to array
		activeNotes.push(event);
	} 	
	else if (event instanceof NoteOff) {
		// remove note from array
		for (i=0; i < activeNotes.length; i++) {
			if (activeNotes[i].pitch == event.pitch) {
				activeNotes.splice(i, 1);
				break;
			}
		}
		// If no more active notes, send note offs for any remaining scheduled notes
		if (activeNotes.length === 0) {
			for(i=0;i<scheduledNotes.length;i++) {
				var off = new NoteOff(scheduledNotes[i]);
				off.send();
			}
			scheduledNotes = []; // Clear scheduled notes array
		}
	}
	// pass non-note events through
	else event.send();
	
	// sort array of active notes
	activeNotes.sort(sortByPitchAscending);
}

//-----------------------------------------------------------------------------
function sortByPitchAscending(a,b) {
	if (a.pitch < b.pitch) return -1;
	if (a.pitch > b.pitch) return 1;
	return 0;
}

//-----------------------------------------------------------------------------
var wasPlaying = false;

function ProcessMIDI() {
	// Get timing information from the host application
	var musicInfo = GetTimingInfo();
	
	// clear activeNotes[] when the transport stops and send any remaining note off events
	if (wasPlaying && !musicInfo.playing){
		for(i=0;i<activeNotes.length;i++) {
			var off = new NoteOff(activeNotes[i]);
			off.send();
		}
		// Send note offs for any scheduled notes to prevent hanging notes
		for(i=0;i<scheduledNotes.length;i++) {
			var off = new NoteOff(scheduledNotes[i]);
			off.send();
		}
		scheduledNotes = []; // Clear scheduled notes array
	}
	
	wasPlaying = musicInfo.playing;
	
	if (activeNotes.length != 0) {	
		
		// get parameters
		var division = GetParameter("Beat Division");
		var noteOrder = GetParameter("Note Order");
		var noteLength = (GetParameter("Note Length") / 100) * (1 / division);
		var randomLength = Math.random() * ((GetParameter("Random Length") / 100) * (1 / division));
		var randomDelay = Math.random() * ((GetParameter("Random Delay") / 100) * (1 / division));
		var randomOctave = Math.floor(Math.random() * GetParameter("Random Octave")) * 12;
		
		// calculate beat to schedule
		var lookAheadEnd = musicInfo.blockEndBeat;
		var nextBeat = Math.ceil(musicInfo.blockStartBeat * division) / division;
			
		// when cycling, find the beats that wrap around the last buffer
		if (musicInfo.cycling && lookAheadEnd >= musicInfo.rightCycleBeat) {
			if (lookAheadEnd >= musicInfo.rightCycleBeat) {
				var cycleBeats = musicInfo.rightCycleBeat - musicInfo.leftCycleBeat;
				var cycleEnd = lookAheadEnd - cycleBeats;
			}
		}

		// loop through the beats that fall within this buffer
		while ((nextBeat >= musicInfo.blockStartBeat && nextBeat < lookAheadEnd)
		// including beats that wrap around the cycle point
		|| (musicInfo.cycling && nextBeat < cycleEnd)) {
			// adjust for cycle
			if (musicInfo.cycling && nextBeat >= musicInfo.rightCycleBeat)
				nextBeat -= cycleBeats;
					
			// calculate step
			var step = Math.floor(nextBeat / (1 / division) - division);
			var chosen = chooseNote(noteOrder, step);

			// humanize / swing / accent
			var swingPct = GetParameter("Swing (%)") / 100.0;
			var timingJitterMs = GetParameter("Timing Jitter (ms)");
			var velJitterPct = GetParameter("Velocity Jitter (%)");
			var accentTarget = Math.round(GetParameter("Accent Target")); // 0=Off,1=Pattern,2=Bar
			var accentAmount = GetParameter("Accent Amount (%)");

			// compute swing offset in beats (apply to odd steps)
			var swingOffset = 0;
			if (swingPct > 0 && (step % 2) === 1) {
				// shift odd subdivision by up to half the subdivision * swingPct
				swingOffset = (1 / division) * 0.5 * swingPct;
			}

			// compute timing jitter in beats from ms
			var musicInfoForJitter = musicInfo; // local alias
			var tempo = musicInfoForJitter.tempo || 120;
			var jitterBeats = (timingJitterMs * (tempo / 60000.0)) * (Math.random() * 2 - 1);

			// determine accent
			var isAccent = false;
			if (accentTarget === 1) {
				// pattern: accent the first step of the guitar pattern
				if (Math.round(GetParameter("Guitar Mode")) === 1) {
					var patIdx = Math.round(GetParameter("Guitar Pattern"));
					var seq = guitarPatterns[patIdx] || guitarPatterns[0];
					var accentPatIdx = Math.round(GetParameter("Accent Pattern"));
					var accents = accentPatterns[accentPatIdx] || accentPatterns[0];
					var posInCycle = step % seq.length;
					// Determine omit behavior
					var omitMode = Math.round(GetParameter("Omit Mode"));
					var omitIdx = Math.round(GetParameter("Omit Index"));
					// rotate omit per cycle if requested
					var cycleNumber = Math.floor(nextBeat / (seq.length / division));
					if (omitMode === 2) {
						if (cycleNumber !== lastCycleNumber) { omitIndex = (omitIndex + 1) % seq.length; lastCycleNumber = cycleNumber; }
						omitIdx = omitIndex;
					}
					// check accent pattern and ensure omitted index isn't accented
					if (accents.indexOf(posInCycle) !== -1 && posInCycle !== omitIdx) isAccent = true;
				}
			} else if (accentTarget === 2) {
				// bar: accent when beat aligns with bar start
				var beatsPerBar = musicInfo.timeSigNumerator || 4;
				// If nextBeat is effectively on a bar boundary
				var mod = Math.abs((nextBeat % beatsPerBar));
				if (mod < 1e-6 || Math.abs(mod - beatsPerBar) < 1e-6) isAccent = true;
			}

			// handle omission: if this posInCycle equals omit index, skip sending this note
			var patIdxGlobal = Math.round(GetParameter("Guitar Pattern"));
			var seqGlobal = guitarPatterns[patIdxGlobal] || guitarPatterns[0];
			var posInCycleGlobal = step % seqGlobal.length;

			// base pitch/velocity
			var pitch = chosen.pitch;
			var baseVel = chosen.velocity || 100;

			// apply velocity jitter
			var velJitter = Math.round(baseVel * (velJitterPct / 100.0) * (Math.random() * 2 - 1));
			var vel = Math.max(1, Math.min(127, baseVel + velJitter));

			// apply accent
			if (isAccent && accentAmount > 0) {
				vel = Math.max(1, Math.min(127, Math.round(vel * (1 + accentAmount / 100.0))));
			}

			// handle omission replacement (silent or ghost)
			var omitModeCheck = Math.round(GetParameter("Omit Mode"));
			var omitIdxCheck = Math.round(GetParameter("Omit Index"));
			if (omitModeCheck === 2) omitIdxCheck = omitIndex; // rotated value
			var omitReplacement = Math.round(GetParameter("Omit Replacement")); // 0=Silent,1=Ghost
			var ghostVelPct = GetParameter("Ghost Velocity (%)") / 100.0;
			if (Math.round(GetParameter("Guitar Mode")) === 1 && omitModeCheck !== 0 && posInCycleGlobal === omitIdxCheck) {
				if (omitReplacement === 0) {
					// silent: skip scheduling
					nextBeat += 0.001;
					nextBeat = Math.ceil(nextBeat * division) / division;
					continue;
				} else {
					// ghost: reduce velocity
					vel = Math.max(1, Math.round(vel * ghostVelPct));
				}
			}

			// final delay (beat units)
			var totalDelayBeats = randomDelay + swingOffset + jitterBeats;

			// send events
			var noteOn = new NoteOn();
			noteOn.pitch = MIDI.normalizeData(pitch + randomOctave);
			noteOn.velocity = vel;
			noteOn.sendAtBeat(nextBeat + totalDelayBeats);
			var noteOff = new NoteOff(noteOn);
			noteOff.sendAtBeat(nextBeat + totalDelayBeats + noteLength + randomLength);
			
			// Track scheduled note for cleanup
			scheduledNotes.push(noteOn);

			// advance to next beat
			nextBeat += 0.001;
			nextBeat = Math.ceil(nextBeat * division) / division;
		}
	}
}

//-----------------------------------------------------------------------------
var noteOrders = ["up", "down", "random"];

function chooseNote(noteOrder, step) {
	// If Guitar Mode is enabled, use guitar voicing + fingerpicking patterns
	var guitarMode = Math.round(GetParameter("Guitar Mode"));
	if (guitarMode === 1 && activeNotes.length > 0) {
		var voicing = buildGuitarVoicing();
		var patternIdx = Math.round(GetParameter("Guitar Pattern"));
		var seq = guitarPatterns[patternIdx] || guitarPatterns[0];
		var idx = seq[step % seq.length];
		var pitch = voicing[idx % voicing.length];
		var vel = activeNotes[0].velocity || 100;
		return { pitch: pitch, velocity: vel };
	}

	// Fallback to original chooser
	var order = noteOrders[noteOrder];
	var length = activeNotes.length;
	if (order == "up") return { pitch: activeNotes[step % length].pitch, velocity: activeNotes[step % length].velocity };
	if (order == "down") return { pitch: activeNotes[Math.abs(step % length - (length - 1))].pitch, velocity: activeNotes[Math.abs(step % length - (length - 1))].velocity };
	if (order == "random") { var idx = Math.floor(Math.random() * length); return { pitch: activeNotes[idx].pitch, velocity: activeNotes[idx].velocity }; }
	else return { pitch: activeNotes[0].pitch, velocity: activeNotes[0].velocity };
}

//-----------------------------------------------------------------------------
// Guitar patterns and voicing helpers
//-----------------------------------------------------------------------------
// Guitar fingerpicking patterns: arrays of indices into the voicing array (6 strings).
// Indices: 0 = low E (6th string), 1 = A, 2 = D, 3 = G, 4 = B, 5 = high E (1st string)
var guitarPatterns = [
	// Travis-style alternating thumb with inner-string plucks
	[0,4,1,3,0,4,1,2],
	// Alternating bass with inner finger fills
	[0,2,1,2,0,2,1,2],
	// Classic ascending/descending arpeggio
	[0,3,4,5,4,3,2,1],
	// PIMA-like pattern (thumb, index, middle, ring)
	[0,4,3,5,0,4,3,5],
	// Folk/ballad pattern with thumb melody interplay
	[1,3,2,4,1,3,2,5],
	// Jack Johnson style 1: Alternating bass with treble fills
	[0,4,0,4,1,3,1,3],
	// Jack Johnson style 2: Thumb bass with finger melody
	[0,5,1,4,0,5,1,4],
	// Jack Johnson style 3: Simple alternating thumb
	[0,1,0,1,0,1,0,1],
	// Jack Johnson Triplet 1: 12-note cycle with bass emphasis (4 bars of triplets)
	[0,4,5,1,3,4,0,4,5,1,3,4],
	// Jack Johnson Triplet 2: Alternating bass triplets with melody
	[0,3,4,1,4,5,0,3,4,1,4,5],
	// Jack Johnson Triplet 3: Cascading triplet pattern
	[0,4,3,1,5,3,0,4,3,1,5,3]
];

// Accent patterns (indices relative to pattern length). These represent common guitar groove accents.
// Each entry is an array of positions (0-based) to accent within the roll cycle.
var accentPatterns = [
	[],                 // 0: None
	[0],                // 1: Downbeat - accent first note (thumb emphasis)
	[0,4],              // 2: Strong Beat - accents on beats 1 and 3 in 8-note patterns
	[1,5],              // 3: Syncopated - off-beat emphasis (finger plucks)
	[0,2,4,6],          // 4: Alternating - every other note (thumb-finger pattern)
	[0,3,6],            // 5: Triplet Feel - accent every 3rd note
	[2,6],              // 6: Weak Beat - accent on beats 2 and 4 (backbeat feel)
	[0,2,5]             // 7: Folk Style - typical fingerpicking accent pattern
];

function buildGuitarVoicing() {
	// Build voicing mapped to standard 6-string guitar tuning (E2 A2 D3 G3 B3 E4)
	// Strings (lowest-to-highest in pitch): E2(40), A2(45), D3(50), G3(55), B3(59), E4(64)
	var mode = Math.round(GetParameter("Voicing Mode"));
	var droneOn = Math.round(GetParameter("Thumb Drone")) === 1;
	if (activeNotes.length === 0) return [];

	// Standard 6-string tuning MIDI numbers
	var stringPitches = [40, 45, 50, 55, 59, 64]; // E2, A2, D3, G3, B3, E4

	// Barre chord mode - use guitar barre chord shapes
	if (mode === 3) {
		return buildBarreChordVoicing(stringPitches, droneOn);
	}

	// collect pitch classes of held notes
	var heldPCs = [];
	for (var i=0;i<activeNotes.length;i++) {
		var pc = ((activeNotes[i].pitch % 12) + 12) % 12;
		if (heldPCs.indexOf(pc) === -1) heldPCs.push(pc);
	}
	if (heldPCs.length === 0) return [];

	// try to detect major/minor triad from held pitch classes
	var detected = false;
	var rootPc = heldPCs[0], thirdPc = null, fifthPc = null;
	for (var r=0; r<heldPCs.length; r++) {
		var candRoot = heldPCs[r];
		var majThird = (candRoot + 4) % 12;
		var minThird = (candRoot + 3) % 12;
		var p5 = (candRoot + 7) % 12;
		if (heldPCs.indexOf(p5) !== -1 && heldPCs.indexOf(majThird) !== -1) {
			rootPc = candRoot; thirdPc = majThird; fifthPc = p5; detected = true; break;
		}
		if (heldPCs.indexOf(p5) !== -1 && heldPCs.indexOf(minThird) !== -1) {
			rootPc = candRoot; thirdPc = minThird; fifthPc = p5; detected = true; break;
		}
	}

	var chordPCs = [];
	if (detected) {
		chordPCs = [rootPc, thirdPc, fifthPc];
	} else {
		// fallback: root = lowest held note pitch class; use root, major-2, perfect 5th (omit 3rd)
		rootPc = ((activeNotes[0].pitch % 12) + 12) % 12;
		chordPCs = [rootPc, (rootPc + 2) % 12, (rootPc + 7) % 12];
	}

	// Build candidate pitches for each chord PC across MIDI range (E2 = 40 minimum)
	var candidates = [];
	for (var oct = 0; oct <= 10; oct++) {
		for (var c=0;c<chordPCs.length;c++) {
			var p = chordPCs[c] + oct*12;
			if (p >= 40 && p <= 127) candidates.push(p); // E2 (40) is lowest guitar note
		}
	}
	candidates.sort(function(a,b){return a-b;});
	var uniqCandidates = [];
	for (var u=0; u<candidates.length; u++) if (uniqCandidates.indexOf(candidates[u]) === -1) uniqCandidates.push(candidates[u]);

	// For each string choose nearest candidate; for high E string, use drone only if droneOn
	var voicing = [];
	for (var s=0; s<stringPitches.length; s++) {
		var sp = stringPitches[s];
		if (s === 5 && droneOn) { voicing.push(64); continue; }

		// find nearest candidate
		var best = uniqCandidates[0];
		var bestDist = Math.abs(best - sp);
		for (var ci=1; ci<uniqCandidates.length; ci++) {
			var d = Math.abs(uniqCandidates[ci] - sp);
			if (d < bestDist) { bestDist = d; best = uniqCandidates[ci]; }
		}
		// if best is far, try shifting octave to be closer but still with allowed PC
		if (bestDist > 12) {
			// try to place rootPc near string
			var targetPc = chordPCs[0];
			var candidate = sp + ((targetPc - (sp % 12) + 12) % 12);
			if (Math.abs(candidate - sp) > 6) candidate -= 12 * Math.sign(candidate - sp);
			// Ensure candidate is not below E2 (40)
			while (candidate < 40) candidate += 12;
			best = MIDI.normalizeData(candidate);
		}
		voicing.push(best);
	}

	// Apply voicing inversion (shift lowest notes up an octave per inversion step)
	var inversion = Math.round(GetParameter("Voicing Inversion")); // 0=off,1=up1,2=up2
	if (inversion > 0 && voicing.length > 0) {
		// make a copy to mutate
		var inv = voicing.slice();
		for (var step=0; step<inversion; step++) {
			// take lowest pitch, raise an octave and push to end
			inv.sort(function(a,b){return a-b;});
			var lowest = inv.shift();
			var moved = lowest + 12;
			if (moved > 127) moved = lowest; // clamp if out of range
			inv.push(moved);
		}
		// normalize and return
		var finalInv = [];
		for (var vi=0; vi<inv.length; vi++) if (finalInv.indexOf(inv[vi])===-1) finalInv.push(inv[vi]);
		return finalInv;
	}

	// ensure only chord tone pitch classes are present when drone is off
	if (!droneOn) {
		var filtered = [];
		for (var i2=0;i2<voicing.length;i2++) {
			var p = voicing[i2];
			var pc = ((p % 12) + 12) % 12;
			if (chordPCs.indexOf(pc) !== -1) filtered.push(p);
		}
		// If filtering removed all notes (unlikely), fall back to using root pitches
		if (filtered.length === 0) {
			for (var s2=0;s2<stringPitches.length;s2++) {
				var rp = chordPCs[0] + Math.floor(stringPitches[s2]/12)*12;
				// Ensure root pitch is not below E2 (40)
				while (rp < 40) rp += 12;
				filtered.push(MIDI.normalizeData(rp));
			}
		}
		// remove duplicates and return
		var final = [];
		for (var ii=0; ii<filtered.length; ii++) if (final.indexOf(filtered[ii])===-1) final.push(filtered[ii]);
		return final;
	}

	// drone is on: return voicing unique
	var finalv = [];
	for (var vi=0; vi<voicing.length; vi++) if (finalv.indexOf(voicing[vi])===-1) finalv.push(voicing[vi]);
	return finalv;
}

function buildBarreChordVoicing(stringPitches, droneOn) {
	// Build barre chord voicing based on detected chord and optimal fret position
	var heldPCs = [];
	for (var i=0;i<activeNotes.length;i++) {
		var pc = ((activeNotes[i].pitch % 12) + 12) % 12;
		if (heldPCs.indexOf(pc) === -1) heldPCs.push(pc);
	}
	
	// Detect chord type and root
	var chordInfo = detectChordType(heldPCs);
	var rootPc = chordInfo.root;
	var chordType = chordInfo.type; // 'major', 'minor', 'dominant7', etc.
	
	// Find optimal barre position (fret) for this chord
	var optimalFret = findOptimalBarreFret(rootPc, chordType);
	
	// Build voicing using barre chord shape at optimal fret
	var voicing = [];
	var shape = getBarreChordShape(chordType);
	
	for (var s=0; s<stringPitches.length; s++) {
		var fret = shape[s];
		if (fret === -1) {
			// Muted string - use a chord tone that fits the detected chord
			var chordTone = getClosestChordTone(stringPitches[s] + 12, chordInfo.pitches);
			voicing.push(chordTone);
		} else {
			var pitch = stringPitches[s] + optimalFret + fret;
			// Ensure pitch is in guitar range and matches chord
			if (pitch >= 40 && pitch <= 127) {
				var pitchClass = pitch % 12;
				// Verify this pitch belongs to our detected chord
				if (chordInfo.pitches.indexOf(pitchClass) !== -1) {
					voicing.push(pitch);
				} else {
					// If barre shape doesn't match chord, find closest chord tone
					var correctTone = getClosestChordTone(pitch, chordInfo.pitches);
					voicing.push(correctTone);
				}
			} else {
				// fallback to closest chord tone in range
				var fallbackTone = getClosestChordTone(stringPitches[s], chordInfo.pitches);
				voicing.push(fallbackTone);
			}
		}
	}
	
	return voicing;
}

function detectChordType(heldPCs) {
	// Enhanced chord detection for barre chords
	for (var r=0; r<heldPCs.length; r++) {
		var root = heldPCs[r];
		var maj3 = (root + 4) % 12;
		var min3 = (root + 3) % 12;
		var p5 = (root + 7) % 12;
		var min7 = (root + 10) % 12;
		var maj7 = (root + 11) % 12;
		
		// Check for dominant 7th
		if (heldPCs.indexOf(maj3) !== -1 && heldPCs.indexOf(p5) !== -1 && heldPCs.indexOf(min7) !== -1) {
			return { root: root, type: 'dominant7', pitches: [root, maj3, p5, min7] };
		}
		// Check for major 7th
		if (heldPCs.indexOf(maj3) !== -1 && heldPCs.indexOf(p5) !== -1 && heldPCs.indexOf(maj7) !== -1) {
			return { root: root, type: 'major7', pitches: [root, maj3, p5, maj7] };
		}
		// Check for minor 7th
		if (heldPCs.indexOf(min3) !== -1 && heldPCs.indexOf(p5) !== -1 && heldPCs.indexOf(min7) !== -1) {
			return { root: root, type: 'minor7', pitches: [root, min3, p5, min7] };
		}
		// Check for major triad
		if (heldPCs.indexOf(maj3) !== -1 && heldPCs.indexOf(p5) !== -1) {
			return { root: root, type: 'major', pitches: [root, maj3, p5] };
		}
		// Check for minor triad
		if (heldPCs.indexOf(min3) !== -1 && heldPCs.indexOf(p5) !== -1) {
			return { root: root, type: 'minor', pitches: [root, min3, p5] };
		}
	}
	
	// Fallback to major triad on lowest note
	var fallbackRoot = heldPCs[0];
	return { root: fallbackRoot, type: 'major', pitches: [fallbackRoot, (fallbackRoot + 4) % 12, (fallbackRoot + 7) % 12] };
}

function findOptimalBarreFret(rootPc, chordType) {
	// Find the fret position that places the chord in a comfortable range
	// Try to place root on 6th string (low E) when possible
	var lowEString = 40; // E2
	var targetPitch = rootPc;
	
	// Find which fret puts root on low E string
	var fret = 0;
	while (fret < 12) {
		if ((lowEString + fret) % 12 === targetPitch) break;
		fret++;
	}
	
	// Prefer frets 1-7 for playability, adjust if needed
	if (fret > 7) fret -= 12;
	if (fret < 0) fret += 12;
	
	return Math.max(0, Math.min(12, fret));
}

function getBarreChordShape(chordType) {
	// Return fret offsets for each string (0-5, low to high E)
	// -1 means muted, 0+ means fret offset from barre position
	switch (chordType) {
		case 'major':
			return [0, 0, 2, 2, 2, 0]; // E-form barre major
		case 'minor':
			return [0, 0, 2, 2, 1, 0]; // E-form barre minor
		case 'dominant7':
			return [0, 0, 2, 0, 2, 0]; // E-form dominant 7
		case 'major7':
			return [0, 0, 2, 1, 2, 0]; // E-form major 7
		case 'minor7':
			return [0, 0, 2, 0, 1, 0]; // E-form minor 7
		default:
			return [0, 0, 2, 2, 2, 0]; // Default to major
	}
}

function getClosestChordTone(targetPitch, chordPitches) {
	// Find closest chord tone to target pitch across octaves
	var best = targetPitch;
	var bestDist = 999;
	
	for (var oct = 0; oct <= 10; oct++) {
		for (var c=0; c<chordPitches.length; c++) {
			var candidate = chordPitches[c] + oct*12;
			if (candidate >= 40 && candidate <= 127) {
				var dist = Math.abs(candidate - targetPitch);
				if (dist < bestDist) {
					bestDist = dist;
					best = candidate;
				}
			}
		}
	}
	
	return best;
}

//-----------------------------------------------------------------------------
var PluginParameters = 
[
		{name:"Beat Division", type:"linear",
		minValue:1, maxValue:16, numberOfSteps:15, defaultValue:4},
	
		{name:"Note Order", type:"menu", valueStrings:noteOrders,
		minValue:0, maxValue:2, numberOfSteps: 3, defaultValue:0},
 
		{name:"Note Length", unit:"%", type:"linear",
		minValue:1, maxValue:200, defaultValue:100.0, numberOfSteps:199},

		{name:"Random Length", unit:"%", type:"linear",
		minValue:0, maxValue:200, numberOfSteps: 200, defaultValue:0},

		{name:"Random Delay", unit:"%", type:"linear",
		minValue:0, maxValue:200, numberOfSteps:200, defaultValue:0},

		{name:"Random Octave", type:"linear",
		minValue:1, maxValue:4, defaultValue:1, numberOfSteps:3}
];

// Add guitar-specific controls
PluginParameters.push(
	{ name: "Guitar Mode", type: "menu", valueStrings: ["Off", "On"], defaultValue: 1 },
	{ name: "Guitar Pattern", type: "menu", valueStrings: ["Travis","Alternating Bass","Classic Arpeggio","PIMA Arpeggio","Folk","Jack Johnson 1","Jack Johnson 2","Jack Johnson 3","JJ Triplet 1","JJ Triplet 2","JJ Triplet 3"], defaultValue: 0 },
	{ name: "Voicing Mode", type: "menu", valueStrings: ["Open-String","Use Held Notes","Triad","Barre Chords"], defaultValue: 0 },
	{ name: "Thumb Drone", type: "menu", valueStrings: ["Off","On"], defaultValue: 1 }
);

// Humanization, swing and accent controls
PluginParameters.push(
	{ name: "Accent Target", type: "menu", valueStrings: ["Off","Pattern","Bar"], defaultValue: 0 },
	{ name: "Accent Amount (%)", unit: "%", type: "lin", minValue: 0, maxValue: 200, numberOfSteps: 200, defaultValue: 25 },
	{ name: "Swing (%)", unit: "%", type: "lin", minValue: 0, maxValue: 100, numberOfSteps: 100, defaultValue: 0 },
	{ name: "Timing Jitter (ms)", unit: "ms", type: "lin", minValue: 0, maxValue: 80, numberOfSteps: 80, defaultValue: 8 },
	{ name: "Velocity Jitter (%)", unit: "%", type: "lin", minValue: 0, maxValue: 50, numberOfSteps: 50, defaultValue: 6 }
);

// Accent pattern selector and omit option
PluginParameters.push(
    { name: "Accent Pattern", type: "menu", valueStrings: ["None","Downbeat","Strong Beat","Syncopated","Alternating","Triplet Feel","Weak Beat","Folk Style"], defaultValue: 1 },
    { name: "Omit Mode", type: "menu", valueStrings: ["Off","Fixed Index","Rotate Per Cycle"], defaultValue: 0 },
	{ name: "Omit Index", type: "linear", minValue:0, maxValue:7, numberOfSteps:7, defaultValue:0 }
);

// Omit replacement and voicing inversion
PluginParameters.push(
	{ name: "Omit Replacement", type: "menu", valueStrings: ["Silent","Ghost"], defaultValue: 0 },
	{ name: "Ghost Velocity (%)", unit: "%", type: "lin", minValue: 1, maxValue: 100, numberOfSteps: 99, defaultValue: 35 },
	{ name: "Voicing Inversion", type: "menu", valueStrings: ["Off","Up 1","Up 2"], defaultValue: 0 }
);
