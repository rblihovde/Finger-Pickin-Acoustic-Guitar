//-----------------------------------------------------------------------------
// Swing 8th Notes - Logic Pro Scripter Plugin
// Description: A simple MIDI FX plugin that adds swing to 8th notes
// Author: Ryan Blihovde
//-----------------------------------------------------------------------------
// This plugin delays every other 8th note to create a swing/shuffle feel.
// The swing percentage determines how much the odd 8th notes are delayed.
// At 0%, notes play straight. At 100%, notes play in a triplet feel.

var NeedsTimingInfo = true;

// Track scheduled notes for proper cleanup
var scheduledNotes = [];
var wasPlaying = false;

function HandleMIDI(event) {
	// Don't send events immediately - let ProcessMIDI handle timing
	// Store non-note events to pass through
	if (!(event instanceof NoteOn) && !(event instanceof NoteOff)) {
		event.send();
	}
}

function ProcessMIDI() {
	var musicInfo = GetTimingInfo();
	
	// Clear scheduled notes when transport stops
	if (wasPlaying && !musicInfo.playing) {
		for (var i = 0; i < scheduledNotes.length; i++) {
			var off = new NoteOff(scheduledNotes[i]);
			off.send();
		}
		scheduledNotes = [];
	}
	
	wasPlaying = musicInfo.playing;
	
	// Process incoming MIDI events
	var event;
	while (event = MIDI.nextEvent) {
		if (event instanceof NoteOn || event instanceof NoteOff) {
			var swingAmount = GetParameter("Swing Amount") / 100.0;
			var division = 8; // 8th notes
			
			// Calculate the current position in 8th notes
			var currentBeat = event.beatPos;
			var eighthPosition = (currentBeat * division) % 2;
			
			// Apply swing to odd 8th notes (off-beats)
			var delay = 0;
			if (eighthPosition >= 1.0 && eighthPosition < 2.0) {
				// This is an odd 8th note - apply swing
				// Swing shifts the note later by up to 1/3 of an 8th note (triplet feel)
				delay = (1 / division) * swingAmount * 0.5;
			}
			
			// Send the event with calculated delay
			event.sendAtBeat(currentBeat + delay);
			
			// Track note on events for cleanup
			if (event instanceof NoteOn) {
				scheduledNotes.push(event);
			}
		} else {
			event.send();
		}
	}
}

// Plugin Parameters
var PluginParameters = [
	{
		name: "Swing Amount",
		type: "linear",
		unit: "%",
		minValue: 0,
		maxValue: 100,
		numberOfSteps: 100,
		defaultValue: 60
	}
];
