//-----------------------------------------------------------------------------
// Swing 8th Notes - Logic Pro Scripter Plugin
// Description: A simple MIDI FX plugin that adds swing to 8th notes
// Author: Ryan Blihovde
//-----------------------------------------------------------------------------
// This plugin delays every other 8th note to create a swing/shuffle feel.
// The swing percentage determines how much the odd 8th notes are delayed.
// At 0%, notes play straight. At 100%, notes play in a triplet feel.

var NeedsTimingInfo = true;

function HandleMIDI(event) {
	if (event instanceof NoteOn || event instanceof NoteOff) {
		var musicInfo = GetTimingInfo();
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
		event.sendAfterMilliseconds(delay * (60000 / musicInfo.tempo) * 4);
	} else {
		// Pass through non-note events immediately
		event.send();
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
