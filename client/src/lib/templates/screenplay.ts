export const screenplayTemplate = {
  name: "Screenplay",
  description: "Create properly formatted scripts for film and television productions.",
  promptTemplate: `Your task is to write or edit screenplay content with these characteristics:

1. PROPER FORMATTING:
   - Use standard screenplay format (Courier 12pt or equivalent)
   - Include correct scene headings (INT./EXT., location, time of day)
   - Format character names, dialogue, and action correctly
   - Use proper transitions and parentheticals
   
2. VISUAL STORYTELLING:
   - Write in present tense, active voice
   - Show, don't tell—focus on what can be seen and heard
   - Avoid camera directions unless absolutely necessary
   - Describe only what's visible to the audience
   
3. DIALOGUE:
   - Create distinctive voices for each character
   - Keep dialogue concise and purposeful
   - Use subtext rather than on-the-nose exposition
   - Incorporate natural interruptions and speech patterns
   
4. SCENE STRUCTURE:
   - Enter scenes late, leave early
   - Establish clear dramatic purpose for each scene
   - Include conflict or tension in most scenes
   - Maintain proper pacing and rhythm
   
5. CHARACTER DEVELOPMENT:
   - Reveal character through action and dialogue
   - Create complex, three-dimensional characters
   - Establish clear wants, needs, and obstacles
   - Show character arcs through changing behaviors
   
6. ECONOMY:
   - Keep action descriptions brief (3-4 lines max per paragraph)
   - Avoid unnecessary description or details
   - Write tight dialogue without filler
   - Aim for 90-120 pages for feature films
   
7. INDUSTRY STANDARDS:
   - Follow proper naming conventions for characters
   - Use correct formatting for montages, dream sequences, etc.
   - Include proper pagination
   - Use standard abbreviations when appropriate
   
When editing, ensure proper screenplay format while preserving the writer's creative vision.`,
  exampleText: `EXT. CITY STREET - NIGHT

Rain pounds the empty street. A lone TAXI crawls through the darkness, its headlights cutting through sheets of water.

INT. TAXI - CONTINUOUS

DAVID (30s, disheveled in a once-expensive suit) stares out the window, eyes hollow. The DRIVER glances in the rearview mirror.

DRIVER
Bad night to be out.

David doesn't respond. The driver shrugs, returns to watching the road.

The taxi stops at a red light. On the corner, a WOMAN under an umbrella catches David's eye. For a moment, she looks exactly like—

DAVID
Stop the car.

DRIVER
What?

David's already pulling cash from his wallet.`
};