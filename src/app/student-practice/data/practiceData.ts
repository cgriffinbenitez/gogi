export interface PracticeQuestion {
  id: number;
  passageTitle: string;
  passageText: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const practiceQuestions: PracticeQuestion[] = [
  {
    id: 1,
    passageTitle: 'The Lighthouse Keeper',
    passageText: `For forty years, Samuel had kept the light burning. Ships came and went, storms rose and fell, and the world beyond the harbor changed in ways he could barely track. But the light stayed on. His daughter, now grown and living in the city, called every Sunday. "Don't you get lonely?" she always asked. "The light keeps me company," he always answered. She thought he was being poetic. He was being precise. The light was not just a beacon for ships — it was proof that someone was still here, still watching, still caring. When Samuel finally retired, his daughter drove up to help him pack. She found him standing at the lamp room window, watching the automated light blink on for the first time without him. "Are you sad?" she asked. "A little," he said. "But the light doesn't need me anymore. That means I did my job."`,
    question: 'Which universal theme is most clearly developed in this passage?',
    options: [
      'The loneliness of isolated work',
      'Fulfilling one\'s duty gives life meaning, even when that duty eventually ends',
      'Technology replaces human connection',
      'Parents and children never truly understand each other'
    ],
    correctIndex: 1,
    explanation: 'Samuel\'s forty years of keeping the light, his answer about the light "keeping him company," and his final acceptance that the automated light means he succeeded all develop the theme that purposeful duty gives life meaning — even when that purpose is complete.'
  },
  {
    id: 2,
    passageTitle: 'The Lighthouse Keeper',
    passageText: `For forty years, Samuel had kept the light burning. Ships came and went, storms rose and fell, and the world beyond the harbor changed in ways he could barely track. But the light stayed on. His daughter, now grown and living in the city, called every Sunday. "Don't you get lonely?" she always asked. "The light keeps me company," he always answered. She thought he was being poetic. He was being precise. The light was not just a beacon for ships — it was proof that someone was still here, still watching, still caring. When Samuel finally retired, his daughter drove up to help him pack. She found him standing at the lamp room window, watching the automated light blink on for the first time without him. "Are you sad?" she asked. "A little," he said. "But the light doesn't need me anymore. That means I did my job."`,
    question: 'What does the lighthouse light symbolize in developing the passage\'s theme?',
    options: [
      'The danger of the sea and the need for safety',
      'Samuel\'s refusal to accept change',
      'A living purpose — proof that someone cares and watches over others',
      'The superiority of technology over human effort'
    ],
    correctIndex: 2,
    explanation: 'Samuel explicitly says the light is "proof that someone was still here, still watching, still caring." The light symbolizes purposeful presence — his reason for being — which is central to the theme of duty giving life meaning.'
  },
  {
    id: 3,
    passageTitle: 'Crossing',
    passageText: `My grandmother crossed an ocean with nothing but a suitcase and a name written on a piece of paper — the name of a cousin she had never met. She was seventeen. I am seventeen now, and I cannot imagine it. I cannot imagine leaving everything I know for a place where I don't speak the language, where the food is wrong, where the sky looks different. But she did it. And because she did it, I exist. I go to school in a building with heat. I have never been hungry. I have never had to be that brave. Sometimes I feel guilty about that — like I owe her something I can never repay. My mother says I'm wrong. "She didn't cross that ocean so you could feel guilty," she told me. "She crossed it so you wouldn't have to." I think about that a lot. I think about how courage can be a gift you give to people you'll never meet.`,
    question: 'Which statement best expresses the universal theme of this passage?',
    options: [
      'Immigration is always a traumatic experience',
      'Young people today are less brave than previous generations',
      'The sacrifices of one generation become the foundation of freedom for the next',
      'Family members should always repay their debts to one another'
    ],
    correctIndex: 2,
    explanation: 'The narrator\'s grandmother crossed an ocean so her descendants wouldn\'t have to. The mother\'s line — "She crossed it so you wouldn\'t have to" — and the narrator\'s insight that "courage can be a gift you give to people you\'ll never meet" both develop the theme that one generation\'s sacrifice creates the next generation\'s freedom.'
  },
  {
    id: 4,
    passageTitle: 'Crossing',
    passageText: `My grandmother crossed an ocean with nothing but a suitcase and a name written on a piece of paper — the name of a cousin she had never met. She was seventeen. I am seventeen now, and I cannot imagine it. I cannot imagine leaving everything I know for a place where I don't speak the language, where the food is wrong, where the sky looks different. But she did it. And because she did it, I exist. I go to school in a building with heat. I have never been hungry. I have never had to be that brave. Sometimes I feel guilty about that — like I owe her something I can never repay. My mother says I'm wrong. "She didn't cross that ocean so you could feel guilty," she told me. "She crossed it so you wouldn't have to." I think about that a lot. I think about how courage can be a gift you give to people you'll never meet.`,
    question: 'How does the author develop the theme through the narrator\'s shift in perspective?',
    options: [
      'The narrator moves from admiration to resentment toward her grandmother',
      'The narrator moves from guilt about her privilege to understanding sacrifice as a gift across generations',
      'The narrator decides to make the same journey her grandmother made',
      'The narrator realizes her grandmother made a mistake by leaving'
    ],
    correctIndex: 1,
    explanation: 'The narrator begins feeling guilty ("like I owe her something I can never repay") and ends with a new understanding: her grandmother\'s courage was a gift, not a debt. This shift in perspective is how the author develops the theme of generational sacrifice.'
  },
  {
    id: 5,
    passageTitle: 'The Unfinished Map',
    passageText: `The map on the wall of my father's study was never finished. He had been drawing it since before I was born — a map of our town, but not the official kind. His map showed where his father had worked, where his mother had prayed, where he had fallen in love, where his friends had died. It was a map of meaning, not geography. When I was small, I thought it was just a drawing. When I was a teenager, I thought it was obsessive. Now I am older than my father was when he started it, and I understand: he was trying to make the invisible visible. He was trying to say, This place mattered. These people mattered. I was here. I have started my own map. It looks nothing like his. But it is the same conversation.`,
    question: 'What universal theme does the unfinished map most directly represent?',
    options: [
      'The importance of accurate historical records',
      'The human need to make meaning and leave a record of what mattered',
      'The conflict between fathers and sons',
      'The way cities change over time and erase the past'
    ],
    correctIndex: 1,
    explanation: 'The father\'s map records "meaning, not geography" — where people worked, prayed, loved, and died. The narrator\'s insight that his father was "trying to make the invisible visible" and say "I was here" directly expresses the universal theme of the human need to create meaning and leave a record of what mattered.'
  },
  {
    id: 6,
    passageTitle: 'The Unfinished Map',
    passageText: `The map on the wall of my father's study was never finished. He had been drawing it since before I was born — a map of our town, but not the official kind. His map showed where his father had worked, where his mother had prayed, where he had fallen in love, where his friends had died. It was a map of meaning, not geography. When I was small, I thought it was just a drawing. When I was a teenager, I thought it was obsessive. Now I am older than my father was when he started it, and I understand: he was trying to make the invisible visible. He was trying to say, This place mattered. These people mattered. I was here. I have started my own map. It looks nothing like his. But it is the same conversation.`,
    question: 'The narrator says his own map "looks nothing like his. But it is the same conversation." What does this reveal about the theme?',
    options: [
      'That the narrator is copying his father\'s work without understanding it',
      'That each generation must express meaning in its own way while continuing the same fundamental human impulse',
      'That the narrator disagrees with his father\'s values',
      'That maps are more important than words for preserving history'
    ],
    correctIndex: 1,
    explanation: 'The narrator\'s map looks different but carries the same purpose — making meaning visible. This shows that the universal human impulse to record what matters continues across generations, even as the form changes. Each generation speaks the same language in a different voice.'
  },
  {
    id: 7,
    passageTitle: 'Still Water',
    passageText: `After the accident, Priya stopped swimming. For three years she lived near the ocean and never went in. She told herself she was busy, then that she was tired, then that she simply didn't want to. None of it was true. The truth was that the water had been there when everything went wrong, and she had decided — without quite deciding — that it was the water's fault. Her therapist called this displacement. Priya called it common sense. Then her niece, six years old and fearless, grabbed her hand one afternoon and pulled her toward the waves. "Come on, Auntie P. It's just water." It was just water. Priya stood at the edge for a long time. The ocean did not care about her grief. It moved the same way it always had — indifferent, enormous, beautiful. She walked in up to her knees. The cold was a shock. Then it wasn't. She thought: the water didn't take anything from me. Time did. And time moves whether I stand at the edge or swim.`,
    question: 'Which universal theme is most fully developed in this passage?',
    options: [
      'Children are wiser than adults',
      'The ocean is a dangerous and unpredictable force',
      'Grief can trap us in avoidance, but healing requires re-engaging with life',
      'Therapy is the only way to overcome trauma'
    ],
    correctIndex: 2,
    explanation: 'Priya\'s three years of avoidance, her niece\'s simple invitation, and her final realization that "time moves whether I stand at the edge or swim" all develop the theme that grief can cause us to withdraw from life, but healing comes from choosing to re-engage — even when it\'s hard.'
  },
  {
    id: 8,
    passageTitle: 'Still Water',
    passageText: `After the accident, Priya stopped swimming. For three years she lived near the ocean and never went in. She told herself she was busy, then that she was tired, then that she simply didn't want to. None of it was true. The truth was that the water had been there when everything went wrong, and she had decided — without quite deciding — that it was the water's fault. Her therapist called this displacement. Priya called it common sense. Then her niece, six years old and fearless, grabbed her hand one afternoon and pulled her toward the waves. "Come on, Auntie P. It's just water." It was just water. Priya stood at the edge for a long time. The ocean did not care about her grief. It moved the same way it always had — indifferent, enormous, beautiful. She walked in up to her knees. The cold was a shock. Then it wasn't. She thought: the water didn't take anything from me. Time did. And time moves whether I stand at the edge or swim.`,
    question: 'How does the author use the ocean\'s indifference to develop the theme?',
    options: [
      'To show that nature is cruel and uncaring toward human suffering',
      'To contrast the ocean\'s unchanging nature with Priya\'s self-imposed stasis, revealing that her avoidance was a choice',
      'To suggest that Priya should have moved away from the ocean',
      'To show that the ocean is more powerful than human emotion'
    ],
    correctIndex: 1,
    explanation: 'The ocean "did not care about her grief" and "moved the same way it always had." This indifference highlights that the ocean didn\'t change — Priya did. Her avoidance was her own choice, not the water\'s fault. This contrast develops the theme that healing requires recognizing and releasing self-imposed barriers.'
  },
  {
    id: 9,
    passageTitle: 'The Inheritance',
    passageText: `My uncle left me his tools. Not money, not property — tools. A rusted set of wrenches, a level worn smooth on one side, a hammer with a cracked handle wrapped in electrical tape. My cousins thought it was an insult. I knew it was the opposite. My uncle had built things with those tools — furniture, a deck, a fence that still stands twenty years later. He had taught me to use them when I was ten, standing in his garage on Saturday mornings while my cousins slept in. "Measure twice, cut once," he always said. "And never let anyone tell you something can't be fixed." I keep the tools in my own garage now. I haven't used them yet. But every time I walk past them, I hear his voice. Some inheritances aren't about money. They're about what someone believed you were capable of.`,
    question: 'What universal theme does this passage most clearly develop?',
    options: [
      'Material wealth is less valuable than practical skills',
      'Family members are often unfair in distributing inheritances',
      'The most meaningful legacies are the beliefs and values one person passes to another',
      'Old tools are more valuable than new ones'
    ],
    correctIndex: 2,
    explanation: 'The narrator understands that the tools represent his uncle\'s belief in him — "what someone believed you were capable of." The tools carry his uncle\'s voice and values ("Measure twice, cut once"). The theme is that the most meaningful inheritances are not material but are the beliefs, values, and confidence one person passes to another.'
  },
  {
    id: 10,
    passageTitle: 'The Inheritance',
    passageText: `My uncle left me his tools. Not money, not property — tools. A rusted set of wrenches, a level worn smooth on one side, a hammer with a cracked handle wrapped in electrical tape. My cousins thought it was an insult. I knew it was the opposite. My uncle had built things with those tools — furniture, a deck, a fence that still stands twenty years later. He had taught me to use them when I was ten, standing in his garage on Saturday mornings while my cousins slept in. "Measure twice, cut once," he always said. "And never let anyone tell you something can't be fixed." I keep the tools in my own garage now. I haven't used them yet. But every time I walk past them, I hear his voice. Some inheritances aren't about money. They're about what someone believed you were capable of.`,
    question: 'How does the contrast between the cousins\' reaction and the narrator\'s reaction develop the theme?',
    options: [
      'It shows that the cousins were greedy and the narrator was not',
      'It reveals that different people assign different kinds of value to the same object, and that meaning is personal',
      'It suggests that the uncle made a mistake in his will',
      'It shows that the narrator was the uncle\'s favorite'
    ],
    correctIndex: 1,
    explanation: 'The cousins see the tools as an insult (low monetary value); the narrator sees them as the opposite (high personal meaning). This contrast develops the theme by showing that the most meaningful legacies are invisible to those who only look for material value — meaning is personal and relational, not monetary.'
  }
];
