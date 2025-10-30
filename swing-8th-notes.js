//-----------------------------------------------------------------------------
// Swing 8th Notes - Logic Pro Scripter Plugin
// Description: A simple MIDI FX plugin that adds swing to 8th notes
// Author: Ryan Blihovde
//-----------------------------------------------------------------------------
// This plugin delays every other 8th note to create a swing/shuffle feel.
// The swing percentage determines how much the odd 8th notes are delayed.
// At 0%, notes play straight (1:1 ratio). At 100%, notes play in triplet feel (2:1 ratio).

var NeedsTimingInfo = true;

function HandleMIDI(event) {
	if (event instanceof NoteOn || event instanceof NoteOff) {
		var musicInfo = GetTimingInfo();
		var swingAmount = GetParameter("Swing Amount") / 100.0;
		
		// Calculate the current position in 8th notes
		var currentBeat = event.beatPos;
		var eighthNotePosition = Math.floor(currentBeat * 2) % 2;
		
		// Apply swing to odd 8th notes (off-beats)
		var delayInBeats = 0;
		if (eighthNotePosition === 1) {
			// This is an odd 8th note (off-beat) - apply swing
			// Maximum swing (100%) delays by 1/6 of a beat (to create 2:1 triplet ratio)
			// At 0% swing, no delay (straight 8ths)
			// At 100% swing, delay by 1/6 beat (first 8th is 2/3, second is 1/3)
			delayInBeats = (1 / 6) * swingAmount;
		}
		
		// Convert delay from beats to milliseconds
		var beatsPerSecond = musicInfo.tempo / 60.0;
		var delayInMs = (delayInBeats / beatsPerSecond) * 1000;
		
		// Send the event with calculated delay
		event.sendAfterMilliseconds(delayInMs);
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
