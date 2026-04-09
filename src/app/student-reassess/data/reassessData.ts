export interface ReassessQuestion {
  id: number;
  passageTitle: string;
  passageText: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export const reassessQuestions: ReassessQuestion[] = [
  {
    id: 1,
    passageTitle: 'The Cartographer\'s Daughter',
    passageText: `My father mapped rivers for a living. Not the kind of maps you find in atlases — those were made by governments and satellites. His maps were different. He mapped where the river had been, where it used to run before it was dammed or diverted, where it wanted to go if left alone. "Rivers have memory," he told me once. "They remember every path they've ever taken." I didn't understand that until I was grown and moved back to the town I had left at eighteen, certain I would never return. The town had changed. The people had changed. But I found myself walking the same paths I had walked as a child, my feet remembering what my mind had tried to forget. I understood then what my father meant. People have memory too. Not just in our minds, but in our bodies, our habits, our instincts. We remember every path we've ever taken. And sometimes, without meaning to, we return to them.`,
    question: 'Which universal theme is most clearly developed in this passage?',
    options: [
      'The importance of cartography and scientific observation',
      'People, like rivers, carry the memory of their past paths and are shaped by where they have been',
      'Returning home is always a mistake',
      'Nature is more reliable than human memory'
    ],
    correctIndex: 1
  },
  {
    id: 2,
    passageTitle: 'The Cartographer\'s Daughter',
    passageText: `My father mapped rivers for a living. Not the kind of maps you find in atlases — those were made by governments and satellites. His maps were different. He mapped where the river had been, where it used to run before it was dammed or diverted, where it wanted to go if left alone. "Rivers have memory," he told me once. "They remember every path they've ever taken." I didn't understand that until I was grown and moved back to the town I had left at eighteen, certain I would never return. The town had changed. The people had changed. But I found myself walking the same paths I had walked as a child, my feet remembering what my mind had tried to forget. I understood then what my father meant. People have memory too. Not just in our minds, but in our bodies, our habits, our instincts. We remember every path we've ever taken. And sometimes, without meaning to, we return to them.`,
    question: 'How does the river function as an extended metaphor to develop the theme?',
    options: [
      'The river represents the danger of returning to the past',
      'The river\'s memory of its former paths mirrors the narrator\'s embodied memory of her childhood, showing that identity is shaped by all the paths we have taken',
      'The river represents the father\'s career and professional legacy',
      'The river symbolizes the passage of time and the inevitability of change'
    ],
    correctIndex: 1
  },
  {
    id: 3,
    passageTitle: 'The Understudy',
    passageText: `For eleven years, Delia had played second violin. Not because she lacked talent — her teacher had told her privately that she was the most gifted player in the orchestra — but because she had never wanted the spotlight. She was content to support, to fill in the harmonies, to be the foundation that made the melody possible. Then the first chair player broke her wrist three days before the concert. The conductor looked at Delia. Delia looked at her music. She had memorized every note of the first chair part years ago, the way you memorize the face of someone you love — not deliberately, but because you cannot help it. She played the concert alone at the front of the stage. Afterward, a young girl came backstage and said, "I want to play like you someday." Delia thought of eleven years of second chair. She thought: I was never hiding. I was preparing.`,
    question: 'What universal theme does this passage most fully develop?',
    options: [
      'Talent is wasted unless it is publicly recognized',
      'Quiet dedication and preparation have their own form of greatness, even when unrecognized',
      'Competition in the arts is destructive and unfair',
      'Women are undervalued in professional settings'
    ],
    correctIndex: 1
  },
  {
    id: 4,
    passageTitle: 'The Understudy',
    passageText: `For eleven years, Delia had played second violin. Not because she lacked talent — her teacher had told her privately that she was the most gifted player in the orchestra — but because she had never wanted the spotlight. She was content to support, to fill in the harmonies, to be the foundation that made the melody possible. Then the first chair player broke her wrist three days before the concert. The conductor looked at Delia. Delia looked at her music. She had memorized every note of the first chair part years ago, the way you memorize the face of someone you love — not deliberately, but because you cannot help it. She played the concert alone at the front of the stage. Afterward, a young girl came backstage and said, "I want to play like you someday." Delia thought of eleven years of second chair. She thought: I was never hiding. I was preparing.`,
    question: 'Delia\'s final thought — "I was never hiding. I was preparing." — most directly develops the theme by showing that:',
    options: [
      'She regrets not pursuing first chair sooner',
      'Her years of quiet work were not absence of ambition but a different, deeper form of it',
      'She plans to take first chair permanently after the concert',
      'She is relieved that the first chair player was injured'
    ],
    correctIndex: 1
  },
  {
    id: 5,
    passageTitle: 'What the Fire Left',
    passageText: `The wildfire took everything except the stone foundation. My grandmother stood in front of it for a long time without speaking. I was twelve and I wanted her to cry so I would know what to do. She didn't cry. She bent down and picked up a handful of ash and let it fall through her fingers. "This is what's left," she said. "Now we know what was real." I didn't understand her then. I thought she meant the foundation — the stone that survived. Now I think she meant something else. She meant that the fire had burned away everything temporary and left only what was permanent: the land, the family standing on it, and the knowledge of what we were capable of rebuilding. Some losses clarify. They burn away the unnecessary and show you what actually matters.`,
    question: 'Which universal theme is most fully developed in this passage?',
    options: [
      'Natural disasters are unpredictable and devastating',
      'Grandparents are always wiser than their grandchildren',
      'Profound loss can strip away what is temporary and reveal what is truly permanent and essential',
      'Material possessions are the most important things in life'
    ],
    correctIndex: 2
  },
  {
    id: 6,
    passageTitle: 'What the Fire Left',
    passageText: `The wildfire took everything except the stone foundation. My grandmother stood in front of it for a long time without speaking. I was twelve and I wanted her to cry so I would know what to do. She didn't cry. She bent down and picked up a handful of ash and let it fall through her fingers. "This is what's left," she said. "Now we know what was real." I didn't understand her then. I thought she meant the foundation — the stone that survived. Now I think she meant something else. She meant that the fire had burned away everything temporary and left only what was permanent: the land, the family standing on it, and the knowledge of what we were capable of rebuilding. Some losses clarify. They burn away the unnecessary and show you what actually matters.`,
    question: 'How does the narrator\'s reinterpretation of the grandmother\'s words develop the theme?',
    options: [
      'It shows that the narrator now disagrees with the grandmother\'s response to loss',
      'It reveals that the narrator has matured enough to understand that "what\'s real" means permanent values and relationships, not physical objects',
      'It suggests that the narrator has forgotten the details of the fire',
      'It shows that the grandmother was in denial about the loss'
    ],
    correctIndex: 1
  },
  {
    id: 7,
    passageTitle: 'The Long Way Home',
    passageText: `Every summer, my father drove the long way home from his parents' house — three hours instead of one. As a child I complained. As a teenager I put in headphones. As an adult driving the route myself for the first time after his death, I finally looked out the window. The long way passed through the town where he grew up, the school where he learned to read, the diner where he had his first job, the road where he learned to drive. He had never explained why he took it. He didn't need to. The long way wasn't inefficient. It was a ritual — a way of touching the places that had made him, of saying: I remember. I came from somewhere. I am still connected to it. I drove the long way home. I will drive it every summer now. Some routes are not about the destination.`,
    question: 'What universal theme does the passage most clearly develop?',
    options: [
      'Efficiency is less important than nostalgia',
      'Rituals connect us to our origins and remind us of who we are and where we came from',
      'Children should always listen to their parents\' choices',
      'Grief makes people repeat the behaviors of those they have lost'
    ],
    correctIndex: 1
  },
  {
    id: 8,
    passageTitle: 'The Long Way Home',
    passageText: `Every summer, my father drove the long way home from his parents' house — three hours instead of one. As a child I complained. As a teenager I put in headphones. As an adult driving the route myself for the first time after his death, I finally looked out the window. The long way passed through the town where he grew up, the school where he learned to read, the diner where he had his first job, the road where he learned to drive. He had never explained why he took it. He didn't need to. The long way wasn't inefficient. It was a ritual — a way of touching the places that had made him, of saying: I remember. I came from somewhere. I am still connected to it. I drove the long way home. I will drive it every summer now. Some routes are not about the destination.`,
    question: 'How does the narrator\'s changing response to the long way — from complaint to understanding — develop the theme?',
    options: [
      'It shows that the narrator eventually becomes as stubborn as the father',
      'It traces the narrator\'s growth from impatience to the mature understanding that meaningful rituals connect us to identity and origin',
      'It suggests that the narrator is trying to forget the father by repeating his habits',
      'It shows that the narrator prefers rural roads to highways'
    ],
    correctIndex: 1
  },
  {
    id: 9,
    passageTitle: 'The Beekeeper',
    passageText: `My aunt kept bees for thirty years. She said they taught her everything she needed to know about community. "Every bee has a role," she told me. "The queen doesn't think she's better than the workers. The workers don't resent the queen. Everyone does what they're built to do, and the whole thing survives." I asked her once what happened when a bee didn't do its job. She was quiet for a moment. "The hive adjusts," she said. "It always adjusts. That's the point." She died in the spring, and the family gathered from four states to bury her. We had not all been in the same room in years. Standing at the graveside, I looked at my cousins and aunts and uncles — people I barely knew anymore — and I thought of the hive. We were adjusting. That's what families do. That's what communities do. They lose someone essential and they find a way to go on, because the alternative is not going on.`,
    question: 'Which universal theme is most fully developed in this passage?',
    options: [
      'Beekeeping is a valuable and underappreciated skill',
      'Communities and families survive loss by adapting — each member fulfilling their role in the larger whole',
      'Death is always unexpected and devastating',
      'Rural life teaches lessons that city life cannot'
    ],
    correctIndex: 1
  },
  {
    id: 10,
    passageTitle: 'The Beekeeper',
    passageText: `My aunt kept bees for thirty years. She said they taught her everything she needed to know about community. "Every bee has a role," she told me. "The queen doesn't think she's better than the workers. The workers don't resent the queen. Everyone does what they're built to do, and the whole thing survives." I asked her once what happened when a bee didn't do its job. She was quiet for a moment. "The hive adjusts," she said. "It always adjusts. That's the point." She died in the spring, and the family gathered from four states to bury her. We had not all been in the same room in years. Standing at the graveside, I looked at my cousins and aunts and uncles — people I barely knew anymore — and I thought of the hive. We were adjusting. That's what families do. That's what communities do. They lose someone essential and they find a way to go on, because the alternative is not going on.`,
    question: 'How does the extended metaphor of the hive develop the theme throughout the passage?',
    options: [
      'It suggests that human beings are no different from insects and have no free will',
      'It provides a framework for understanding how communities function and survive loss — through interdependence and adaptation',
      'It shows that the aunt valued animals more than people',
      'It contrasts the simplicity of nature with the complexity of human relationships'
    ],
    correctIndex: 1
  }
];
