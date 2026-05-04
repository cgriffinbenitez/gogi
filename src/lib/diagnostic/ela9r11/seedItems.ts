import { describeMisconception } from './misconceptions';
import { ELA9R11_STANDARD_CODE, type Ela9R11DiagnosticItem, type Ela9R11Subskill } from './types';

const BASE_ELA9R11_SEED_ITEMS: Ela9R11DiagnosticItem[] = [
  {
    id: 'ela9r11-mood-001',
    itemType: 'layer_of_meaning',
    subskill: 'layer_of_meaning',
    keyElement: 'mood',
    layerOrEffect: 'mood',
    passageTitle: 'Nathan in the Old House',
    passage:
      'Nathan had been in the old house before, but this was the first time he was left alone for the evening. A scratching sound against the house made him start. He realized it was only the telephone wire slapping in the wind. A low moan came from the basement. But what was that sound upstairs? Footsteps? Suddenly, three loud knocks sounded at the front door.',
    stem: 'Which mood is created by the words and details in the passage?',
    options: [
      {
        letter: 'A',
        text: 'Tense',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Joyful',
        correct: false,
        misconceptions: ['tone_mood_confusion', 'evidence_misread'],
      },
      {
        letter: 'C',
        text: 'Peaceful',
        correct: false,
        misconceptions: ['evidence_irrelevant', 'literal_reading_only'],
      },
      {
        letter: 'D',
        text: 'Curious',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
    ],
    evidenceTargets: ['scratching', 'slapping', 'low moan', 'Footsteps', 'loud knocks'],
    teacherNote: 'Checks whether the student can use sound and pacing details to identify mood.',
  },
  {
    id: 'ela9r11-evidence-001',
    itemType: 'evidence_selection',
    subskill: 'evidence_precision',
    keyElement: 'mood',
    layerOrEffect: 'mood',
    passageTitle: 'At the Beach',
    passage:
      'Our whole family spent the day at the beach. It was a bright and breezy day, perfect for flying kites. I started running across the sparkling sand. The kite rose easily on the wind. My parents cheered. Once aloft, the kite leaped in the air like a trout in blue water. As my sister felt the tugging of the kite, she laughed out loud.',
    stem: 'Which evidence best supports that the mood is joyful?',
    options: [
      {
        letter: 'A',
        text: 'bright and breezy; sparkling sand; cheered; laughed',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Our whole family spent the day at the beach.',
        correct: false,
        misconceptions: ['evidence_too_general'],
      },
      {
        letter: 'C',
        text: 'The kite rose on the wind.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'My father held the kite high.',
        correct: false,
        misconceptions: ['quote_without_function'],
      },
    ],
    evidenceTargets: ['bright', 'breezy', 'sparkling', 'cheered', 'laughed'],
    teacherNote: 'Checks whether the student can select precise evidence for a mood claim.',
  },
  {
    id: 'ela9r11-theme-001',
    itemType: 'element_function',
    subskill: 'element_function',
    keyElement: 'setting',
    layerOrEffect: 'theme',
    passageTitle: 'The Empty Garden',
    passage:
      'Maya stepped into the garden after the storm. The tomato vines were bent, and petals stuck to the path like scraps of wet paper. Then she saw one yellow flower still standing, its thin stem shaking but unbroken. Maya knelt beside it and began clearing mud away from the roots.',
    stem: 'How does the setting help develop a theme in the passage?',
    options: [
      {
        letter: 'A',
        text: 'The damaged garden and surviving flower suggest that hope can remain after hardship.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The passage mostly explains how storms damage gardens.',
        correct: false,
        misconceptions: ['effect_confused_with_summary', 'literal_reading_only'],
      },
      {
        letter: 'C',
        text: 'The yellow flower is the theme of the passage.',
        correct: false,
        misconceptions: ['theme_element_confusion'],
      },
      {
        letter: 'D',
        text: 'Maya is careful because she kneels beside the flower.',
        correct: false,
        misconceptions: ['meaning_connection_missing'],
      },
    ],
    evidenceTargets: ['storm', 'bent', 'wet paper', 'still standing', 'unbroken'],
    teacherNote: 'Checks whether the student can explain how setting details build theme.',
  },
  {
    id: 'ela9r11-figurative-001',
    itemType: 'explanation_evaluation',
    subskill: 'analytical_explanation',
    keyElement: 'figurative_language',
    layerOrEffect: 'emotional_effect',
    passageTitle: 'The Hallway',
    passage:
      'The hallway stretched before Andre like a tunnel with no end. Lockers clicked shut one after another. He held the folded schedule in both hands and tried to find a room number that would stay still.',
    stem: 'Which explanation best shows how the figurative language affects the reader?',
    options: [
      {
        letter: 'A',
        text: 'The comparison to a tunnel makes the hallway feel long and overwhelming, showing Andre feels anxious.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The hallway is probably very long.',
        correct: false,
        misconceptions: ['literal_reading_only', 'analysis_too_vague'],
      },
      {
        letter: 'C',
        text: 'Andre is looking for a classroom.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'D',
        text: 'The author uses figurative language.',
        correct: false,
        misconceptions: ['function_not_explained'],
      },
    ],
    evidenceTargets: ['like a tunnel with no end', 'clicked shut', 'would stay still'],
    teacherNote: 'Checks whether the student can explain the effect of figurative language.',
  },
  {
    id: 'ela9r11-element-001',
    itemType: 'element_identification',
    subskill: 'element_recognition',
    keyElement: 'conflict',
    layerOrEffect: 'character_development',
    passageTitle: 'The Tryout List',
    passage:
      'Jalen stood in front of the tryout list and read every name twice. His was not there. Behind him, his friends slapped each other on the back and shouted about practice. Jalen folded his hands into his pockets and walked home without saying anything.',
    stem: 'Which literary element is most important in this passage?',
    options: [
      {
        letter: 'A',
        text: 'Conflict',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Theme',
        correct: false,
        misconceptions: ['element_misidentified', 'theme_element_confusion'],
      },
      {
        letter: 'C',
        text: 'Point of view',
        correct: false,
        misconceptions: ['element_misidentified'],
      },
      {
        letter: 'D',
        text: 'Figurative language',
        correct: false,
        misconceptions: ['element_misidentified'],
      },
    ],
    evidenceTargets: ['not there', 'shouted', 'walked home without saying anything'],
    teacherNote: 'Checks whether the student can identify conflict as the central element.',
  },
  {
    id: 'ela9r11-function-001',
    itemType: 'element_function',
    subskill: 'element_function',
    keyElement: 'characterization',
    layerOrEffect: 'implied_meaning',
    passageTitle: 'The Borrowed Pencil',
    passage:
      'Nora saw the new student checking every pocket of his backpack. The bell had already rung. She slid a sharpened pencil across the desk without looking at him, then opened her notebook as if nothing had happened.',
    stem: 'What does Nora’s action mainly show about her?',
    options: [
      {
        letter: 'A',
        text: 'She notices someone needs help and helps quietly.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'She wants the teacher to praise her.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'C',
        text: 'She dislikes the new student.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'She owns many school supplies.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
    ],
    evidenceTargets: ['slid a sharpened pencil', 'without looking at him', 'as if nothing had happened'],
    teacherNote: 'Checks whether the student explains character through action instead of summary.',
  },
  {
    id: 'ela9r11-meaning-001',
    itemType: 'layer_of_meaning',
    subskill: 'layer_of_meaning',
    keyElement: 'symbolism',
    layerOrEffect: 'implied_meaning',
    passageTitle: 'The Cracked Cup',
    passage:
      'Every morning, Abuela drank from the same cracked blue cup. The handle had been glued twice, and a thin line ran down one side. When Mateo offered to buy her a new one, she smiled and said, “Some things hold more because they have been broken.”',
    stem: 'What deeper meaning does the cracked cup suggest?',
    options: [
      {
        letter: 'A',
        text: 'Objects can carry memory and strength even after damage.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Abuela needs a safer cup for hot drinks.',
        correct: false,
        misconceptions: ['literal_reading_only'],
      },
      {
        letter: 'C',
        text: 'Mateo does not care about Abuela.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'D',
        text: 'The story is mainly about shopping.',
        correct: false,
        misconceptions: ['meaning_connection_missing'],
      },
    ],
    evidenceTargets: ['cracked blue cup', 'glued twice', 'hold more', 'broken'],
    teacherNote: 'Checks whether the student moves from literal object to symbolic meaning.',
  },
  {
    id: 'ela9r11-style-001',
    itemType: 'explanation_evaluation',
    subskill: 'style_connection',
    keyElement: 'structure',
    layerOrEffect: 'style',
    passageTitle: 'The Storm Line',
    passage:
      'The clouds lowered. The wind stopped. One leaf lifted, spun, and dropped. Then the rain came all at once, hard against the roof, hard against the glass, hard against everything.',
    stem: 'How does the author’s style create the effect of the storm arriving?',
    options: [
      {
        letter: 'A',
        text: 'Short sentences slow the moment before repeated words make the storm feel sudden and forceful.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The author says rain came.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'C',
        text: 'The passage uses weather words.',
        correct: false,
        misconceptions: ['style_connection_missing'],
      },
      {
        letter: 'D',
        text: 'The storm is dangerous because storms are always dangerous.',
        correct: false,
        misconceptions: ['analysis_too_vague'],
      },
    ],
    evidenceTargets: ['lowered', 'stopped', 'hard against', 'all at once'],
    teacherNote: 'Checks whether the student links sentence style and repetition to effect.',
  },
  {
    id: 'ela9r11-evidence-002',
    itemType: 'evidence_selection',
    subskill: 'evidence_precision',
    keyElement: 'characterization',
    layerOrEffect: 'character_development',
    passageTitle: 'The Last Seat',
    passage:
      'The bus was full when Mr. Ibarra climbed aboard. Denise looked at his cane, then at the empty seat beside her backpack. She moved the backpack onto her lap before he reached the row.',
    stem: 'Which evidence best supports that Denise is considerate?',
    options: [
      {
        letter: 'A',
        text: 'She moved the backpack onto her lap before he reached the row.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The bus was full.',
        correct: false,
        misconceptions: ['evidence_too_general'],
      },
      {
        letter: 'C',
        text: 'Mr. Ibarra climbed aboard.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'There was a seat beside her backpack.',
        correct: false,
        misconceptions: ['quote_without_function'],
      },
    ],
    evidenceTargets: ['looked at his cane', 'moved the backpack', 'before he reached the row'],
    teacherNote: 'Checks precise evidence for character trait.',
  },
  {
    id: 'ela9r11-tone-001',
    itemType: 'layer_of_meaning',
    subskill: 'distractor_resistance',
    keyElement: 'tone',
    layerOrEffect: 'tone',
    passageTitle: 'The Broken Promise',
    passage:
      'The mayor smiled at the cameras and promised the park would reopen by summer. Behind him, weeds pushed through the cracked basketball court for the third year in a row.',
    stem: 'What is the author’s tone toward the mayor’s promise?',
    options: [
      {
        letter: 'A',
        text: 'Skeptical',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Joyful',
        correct: false,
        misconceptions: ['tone_mood_confusion'],
      },
      {
        letter: 'C',
        text: 'Confused',
        correct: false,
        misconceptions: ['analysis_too_vague'],
      },
      {
        letter: 'D',
        text: 'Peaceful',
        correct: false,
        misconceptions: ['tone_mood_confusion', 'evidence_irrelevant'],
      },
    ],
    evidenceTargets: ['smiled at the cameras', 'promised', 'third year in a row'],
    teacherNote: 'Checks author attitude versus reader mood.',
  },
  {
    id: 'ela9r11-pov-001',
    itemType: 'element_function',
    subskill: 'element_function',
    keyElement: 'point_of_view',
    layerOrEffect: 'point_of_view',
    passageTitle: 'From the Window',
    passage:
      'I watched my brother walk to the mound with the game tied. From the stands, I could not hear what the coach said. I only saw my brother nod once and pull his cap lower over his eyes.',
    stem: 'How does the point of view affect what the reader knows?',
    options: [
      {
        letter: 'A',
        text: 'The reader sees the brother from outside, so his exact thoughts stay unknown.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The reader knows everything the brother is thinking.',
        correct: false,
        misconceptions: ['point_of_view_effect_missing', 'evidence_misread'],
      },
      {
        letter: 'C',
        text: 'The passage is about baseball.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'D',
        text: 'The coach is the narrator.',
        correct: false,
        misconceptions: ['element_misidentified'],
      },
    ],
    evidenceTargets: ['I watched', 'could not hear', 'only saw'],
    teacherNote: 'Checks point-of-view effect on knowledge and uncertainty.',
  },
  {
    id: 'ela9r11-structure-001',
    itemType: 'element_function',
    subskill: 'style_connection',
    keyElement: 'structure',
    layerOrEffect: 'emotional_effect',
    passageTitle: 'Before the Call',
    passage:
      'The phone sat in the center of the table. Mina cleaned the counter. She checked the clock. She wiped one clean spot again. The phone did not ring.',
    stem: 'How does the structure of the passage create tension?',
    options: [
      {
        letter: 'A',
        text: 'Repeated small actions delay the call and make the waiting feel tense.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Mina is cleaning the kitchen.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'C',
        text: 'The phone is in the center of the table.',
        correct: false,
        misconceptions: ['quote_without_function'],
      },
      {
        letter: 'D',
        text: 'The author uses structure because sentences are in order.',
        correct: false,
        misconceptions: ['structure_effect_missing'],
      },
    ],
    evidenceTargets: ['cleaned', 'checked', 'wiped', 'did not ring'],
    teacherNote: 'Checks structure and pacing as an effect, not a plot summary.',
  },
  {
    id: 'ela9r11-conflict-001',
    itemType: 'element_function',
    subskill: 'element_function',
    keyElement: 'conflict',
    layerOrEffect: 'theme',
    passageTitle: 'The Group Project',
    passage:
      'Everyone agreed that Tasha should present because she spoke the clearest. Tasha stared at the note cards and felt her throat tighten. She wanted the grade, but she wanted even more to disappear behind the poster board.',
    stem: 'What is the main conflict in this passage?',
    options: [
      {
        letter: 'A',
        text: 'Tasha wants to help the group but is afraid to speak in front of others.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The group does not like Tasha.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'C',
        text: 'The note cards are hard to read.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'The passage teaches that grades are important.',
        correct: false,
        misconceptions: ['theme_element_confusion'],
      },
    ],
    evidenceTargets: ['spoke the clearest', 'throat tighten', 'wanted the grade', 'disappear'],
    teacherNote: 'Checks whether the student identifies internal conflict.',
  },
  {
    id: 'ela9r11-mood-002',
    itemType: 'layer_of_meaning',
    subskill: 'layer_of_meaning',
    keyElement: 'mood',
    layerOrEffect: 'mood',
    passageTitle: 'Morning Dock',
    passage:
      'Mist lifted from the lake in pale ribbons. The dock rocked softly under Luis’s feet. Somewhere across the water, a bird called once, and the sound faded into the quiet.',
    stem: 'Which mood is created by the details in the passage?',
    options: [
      {
        letter: 'A',
        text: 'Peaceful',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Angry',
        correct: false,
        misconceptions: ['tone_mood_confusion'],
      },
      {
        letter: 'C',
        text: 'Chaotic',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'D',
        text: 'Humorous',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
    ],
    evidenceTargets: ['Mist lifted', 'softly', 'faded into the quiet'],
    teacherNote: 'Checks mood identification with calm imagery and sound.',
  },
  {
    id: 'ela9r11-theme-002',
    itemType: 'layer_of_meaning',
    subskill: 'layer_of_meaning',
    keyElement: 'plot',
    layerOrEffect: 'theme',
    passageTitle: 'The Second Race',
    passage:
      'Rafi finished last in the first race and laughed before anyone else could. The next morning, he returned to the track alone. He ran one lap, then another, until the sun cleared the bleachers.',
    stem: 'Which theme is best developed by Rafi’s actions?',
    options: [
      {
        letter: 'A',
        text: 'Growth often begins when a person keeps working after embarrassment.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Rafi finished last in a race.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'C',
        text: 'The track is empty in the morning.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'The theme is running.',
        correct: false,
        misconceptions: ['theme_element_confusion'],
      },
    ],
    evidenceTargets: ['finished last', 'returned', 'alone', 'one lap, then another'],
    teacherNote: 'Checks theme as a message, not a topic or event.',
  },
  {
    id: 'ela9r11-figurative-002',
    itemType: 'explanation_evaluation',
    subskill: 'analytical_explanation',
    keyElement: 'figurative_language',
    layerOrEffect: 'emotional_effect',
    passageTitle: 'The News',
    passage:
      'When the principal announced the canceled trip, the room deflated like a punctured basketball. Backpacks slumped to the floor. Even the clock seemed to tick slower.',
    stem: 'What effect does the comparison to a punctured basketball create?',
    options: [
      {
        letter: 'A',
        text: 'It makes the class’s disappointment feel sudden and complete.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'It means the room had a basketball in it.',
        correct: false,
        misconceptions: ['literal_reading_only'],
      },
      {
        letter: 'C',
        text: 'It shows the principal likes sports.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'D',
        text: 'It is a quote from the passage.',
        correct: false,
        misconceptions: ['function_not_explained'],
      },
    ],
    evidenceTargets: ['deflated', 'punctured basketball', 'slumped', 'tick slower'],
    teacherNote: 'Checks figurative language effect.',
  },
  {
    id: 'ela9r11-evidence-003',
    itemType: 'evidence_selection',
    subskill: 'evidence_precision',
    keyElement: 'setting',
    layerOrEffect: 'mood',
    passageTitle: 'Closed Store',
    passage:
      'The store window was dark except for one flickering sign. Old flyers curled at the corners. A shopping cart rolled slowly across the empty parking lot, pushed by the wind.',
    stem: 'Which evidence best supports a lonely mood?',
    options: [
      {
        letter: 'A',
        text: 'dark; old flyers curled; empty parking lot',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The store window was a window.',
        correct: false,
        misconceptions: ['quote_without_function'],
      },
      {
        letter: 'C',
        text: 'A shopping cart rolled.',
        correct: false,
        misconceptions: ['evidence_too_general'],
      },
      {
        letter: 'D',
        text: 'The store sells groceries.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
    ],
    evidenceTargets: ['dark', 'flickering', 'Old flyers curled', 'empty parking lot'],
    teacherNote: 'Checks evidence precision for setting-driven mood.',
  },
  {
    id: 'ela9r11-summary-001',
    itemType: 'explanation_evaluation',
    subskill: 'distractor_resistance',
    keyElement: 'plot',
    layerOrEffect: 'implied_meaning',
    passageTitle: 'The Locked Gate',
    passage:
      'The team reached the field and found the gate chained shut. Coach Ramirez looked at the players, then at the narrow alley beside the fence. “Warm up starts now,” she said, pointing down the alley.',
    stem: 'Which answer explains the effect of Coach Ramirez’s response?',
    options: [
      {
        letter: 'A',
        text: 'It shows she adapts quickly instead of letting an obstacle stop the team.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The gate is chained shut.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'C',
        text: 'The players are standing near a fence.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'Coach Ramirez is angry.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
    ],
    evidenceTargets: ['looked at the players', 'narrow alley', 'Warm up starts now'],
    teacherNote: 'Checks ability to explain effect rather than summarize event.',
  },
  {
    id: 'ela9r11-character-002',
    itemType: 'element_function',
    subskill: 'element_function',
    keyElement: 'characterization',
    layerOrEffect: 'theme',
    passageTitle: 'The Apology',
    passage:
      'After the argument, Brianna typed three different messages and deleted each one. Finally, she walked across the cafeteria, stood beside Ana’s table, and said the words without checking who was watching.',
    stem: 'How does Brianna’s action develop the passage?',
    options: [
      {
        letter: 'A',
        text: 'It shows she chooses honesty even when it may feel uncomfortable.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'It shows she likes texting better than talking.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'C',
        text: 'It proves the cafeteria is crowded.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'It says there was an argument.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
    ],
    evidenceTargets: ['deleted each one', 'walked across', 'without checking who was watching'],
    teacherNote: 'Checks characterization as a meaningful action.',
  },
  {
    id: 'ela9r11-setting-001',
    itemType: 'element_function',
    subskill: 'element_function',
    keyElement: 'setting',
    layerOrEffect: 'emotional_effect',
    passageTitle: 'The Empty Stadium',
    passage:
      'After the crowd left, paper cups rolled between the rows. The scoreboard still glowed, but no one cheered when the final numbers blinked. Malik sat alone on the bench tying and untying his shoes.',
    stem: 'How does the setting affect the scene?',
    options: [
      {
        letter: 'A',
        text: 'The empty stadium makes Malik’s disappointment feel more isolated.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'The stadium has paper cups.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'C',
        text: 'Malik is good at tying shoes.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'The score is the theme.',
        correct: false,
        misconceptions: ['theme_element_confusion'],
      },
    ],
    evidenceTargets: ['After the crowd left', 'no one cheered', 'sat alone'],
    teacherNote: 'Checks setting effect on emotional meaning.',
  },
  {
    id: 'ela9r11-irony-001',
    itemType: 'layer_of_meaning',
    subskill: 'layer_of_meaning',
    keyElement: 'structure',
    layerOrEffect: 'irony',
    passageTitle: 'The Quiet Award',
    passage:
      'The school gave Leo a certificate for “Most School Spirit.” He accepted it in the same gray hoodie he wore every day, mumbled thanks, and slipped out before the applause ended.',
    stem: 'What effect is created by the contrast in the passage?',
    options: [
      {
        letter: 'A',
        text: 'It creates irony because the award does not match Leo’s quiet behavior.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'It shows Leo loves school spirit.',
        correct: false,
        misconceptions: ['evidence_misread'],
      },
      {
        letter: 'C',
        text: 'It tells what Leo wore.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'D',
        text: 'It proves certificates are important.',
        correct: false,
        misconceptions: ['analysis_too_vague'],
      },
    ],
    evidenceTargets: ['Most School Spirit', 'mumbled thanks', 'slipped out'],
    teacherNote: 'Checks contrast and irony as layer of meaning.',
  },
  {
    id: 'ela9r11-synthesis-001',
    itemType: 'constructed_response',
    subskill: 'analytical_explanation',
    keyElement: 'characterization',
    layerOrEffect: 'theme',
    passageTitle: 'The Spare Key',
    passage:
      'Mina found the spare key under the mat, exactly where her father said it would be. She could have gone inside and avoided the rain. Instead, she waited on the porch until he came home, holding the key in her open palm.',
    stem: 'Explain how one literary element in the passage adds meaning or style. Use evidence from the text.',
    options: [
      {
        letter: 'A',
        text: 'Mina’s choice to wait shows that trust matters more to her than convenience.',
        correct: true,
        misconceptions: [],
      },
      {
        letter: 'B',
        text: 'Mina found a spare key under the mat.',
        correct: false,
        misconceptions: ['effect_confused_with_summary'],
      },
      {
        letter: 'C',
        text: 'The porch was wet because it rained.',
        correct: false,
        misconceptions: ['evidence_irrelevant'],
      },
      {
        letter: 'D',
        text: 'The key symbolizes a key.',
        correct: false,
        misconceptions: ['analysis_too_vague', 'literal_reading_only'],
      },
    ],
    evidenceTargets: ['could have gone inside', 'Instead', 'waited', 'open palm'],
    teacherNote: 'Checks full analytical bridge from action to meaning.',
  },
];

const CONSTRUCTED_SUBSKILLS: Ela9R11Subskill[] = [
  'element_recognition',
  'element_function',
  'layer_of_meaning',
  'style_connection',
  'evidence_precision',
  'analytical_explanation',
];

const PILOT_ITEM_SET = [
  ...BASE_ELA9R11_SEED_ITEMS.slice(0, 19),
  BASE_ELA9R11_SEED_ITEMS.find((item) => item.id === 'ela9r11-synthesis-001')!,
];

export const ELA9R11_SEED_ITEMS: Ela9R11DiagnosticItem[] = PILOT_ITEM_SET.map((item, index) => {
  const correctOption = item.options.find((option) => option.correct);
  const correctAnswerRationale = item.correctAnswerRationale
    ?? (item.itemType === 'constructed_response'
      ? 'A strong response names a literary element, uses precise evidence, and explains what the element adds to meaning or style.'
      : `The correct answer connects ${item.keyElement.replace(/_/g, ' ')} to ${item.layerOrEffect.replace(/_/g, ' ')} using the passage evidence.`);

  return {
    ...item,
    standardCode: ELA9R11_STANDARD_CODE,
    passageId: item.passageId ?? `ela9r11-passage-${String(index + 1).padStart(2, '0')}`,
    subSkillsMeasured: item.subSkillsMeasured
      ?? (item.itemType === 'constructed_response' ? CONSTRUCTED_SUBSKILLS : [item.subskill]),
    questionText: item.questionText ?? item.stem,
    teacherRationale: item.teacherRationale ?? item.teacherNote,
    correctAnswerRationale,
    studentFriendlyFeedback: item.studentFriendlyFeedback
      ?? 'Look for the text detail first. Then connect that detail to what the author makes the reader feel or understand.',
    options: item.options.map((option) => ({
      ...option,
      rationale: option.rationale ?? (option.correct
        ? correctAnswerRationale
        : buildDistractorRationale(option.misconceptions)),
    })),
  };
});

function buildDistractorRationale(flags: Ela9R11DiagnosticItem['options'][number]['misconceptions']) {
  const primary = flags[0] ? describeMisconception(flags[0]) : null;
  if (!primary) return 'This answer is not supported by the strongest text evidence.';
  return `${primary.label}: ${primary.teacherDescription}`;
}
