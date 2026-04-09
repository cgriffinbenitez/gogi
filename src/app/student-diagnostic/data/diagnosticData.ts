export interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface Passage {
  id: number;
  title: string;
  author: string;
  genre: string;
  text: string;
  questions: Question[];
}

export const diagnosticPassages: Passage[] = [
  {
    id: 1,
    title: "The Old Man and the River",
    author: "Original Passage",
    genre: "Literary Fiction",
    text: `Every morning before the sun had fully risen, Elias walked to the river. He had done this for sixty years—since the day his father first placed a fishing rod in his small hands and said, "The river teaches what no school can." Now his father was gone, and the school had long since closed, but the river remained.

The water moved differently in autumn. It slowed, as if reluctant to leave the hills behind. Elias understood that reluctance. He had felt it himself when his children left for the city, when his wife's chair sat empty by the window, when the neighbors' houses one by one went dark. Staying was its own kind of courage.

He cast his line and watched the ripples spread outward, touching the far bank before disappearing. His grandson, Tomás, sat beside him now—twelve years old and full of questions that had no easy answers.

"Grandpa, why do you come here every day if you never catch anything?"

Elias smiled. "I catch something every day." "What?"

The old man was quiet for a long moment. A heron landed on a stone midstream, perfectly still, waiting with a patience that seemed ancient.

"Myself," Elias finally said. "I come here and I find myself again."

Tomás frowned, not understanding. But he stayed, and he watched the heron, and something in the stillness settled into him like a stone dropping to the riverbed—slow, certain, permanent.

Years later, when Tomás was old and his own grandchildren asked why he rose before dawn, he would think of that morning and the heron and his grandfather's quiet voice. He would say: "The river teaches what no school can." And he would mean it in a way that had nothing to do with fish.`,
    questions: [
      {
        id: 1,
        text: "Which universal theme is most clearly developed throughout this passage?",
        options: [
          "The destructive power of ambition",
          "The importance of family traditions and the wisdom passed between generations",
          "The conflict between nature and technology",
          "The dangers of isolation from society"
        ],
        correctIndex: 1
      },
      {
        id: 2,
        text: "How does the river function as a symbol in developing the passage's theme?",
        options: [
          "It represents the danger of clinging to the past",
          "It symbolizes the constant change that destroys relationships",
          "It serves as a space where wisdom and identity are preserved and passed on",
          "It represents the boundary between childhood and adulthood"
        ],
        correctIndex: 2
      },
      {
        id: 3,
        text: "What does Elias mean when he says he catches 'myself' at the river each day?",
        options: [
          "He literally catches fish that remind him of his identity",
          "He finds a sense of self, purpose, and connection to his past",
          "He practices catching fish to improve his skill",
          "He escapes from his family responsibilities"
        ],
        correctIndex: 1
      },
      {
        id: 4,
        text: "How does the author develop the theme of continuity across generations?",
        options: [
          "By showing that Tomás rejects his grandfather's way of life",
          "By describing the river as unchanging and eternal",
          "By having Tomás repeat his grandfather's words to his own grandchildren years later",
          "By contrasting the city life of Elias's children with rural life"
        ],
        correctIndex: 2
      },
      {
        id: 5,
        text: "The phrase 'Staying was its own kind of courage' most directly supports which theme?",
        options: [
          "Loyalty and perseverance in the face of loss and change",
          "The fear of death and aging",
          "The importance of physical strength",
          "The value of adventure and exploration"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: 2,
    title: "The Weight of Wings",
    author: "Original Passage",
    genre: "Coming-of-Age Fiction",
    text: `Mara had always believed that leaving was the bravest thing a person could do. She had watched her mother stay—stay in the same house, the same job, the same grief—for fifteen years after her father walked out. Staying, Mara decided at age nine, was surrender.

So when the acceptance letter arrived from the conservatory three states away, she packed her violin case and her certainty and left without looking back.

The first winter was brutal. Not the cold—she had expected the cold—but the silence of her apartment, the way her own footsteps sounded too loud on the hardwood floors. She practiced eight hours a day and told herself this was freedom.

Her teacher, Professor Adeyemi, was a small woman with enormous hands and a voice like a cello. She listened to Mara play for three weeks before she said anything beyond technical corrections.

"You play like someone running away," she said one afternoon. Mara lowered her bow. "I play with passion." "Passion and desperation sound alike at first," the professor said. "But one builds something. The other only burns."

Mara didn't understand until the spring recital, when she stood backstage and heard the student before her play a simple folk melody—the kind her mother used to hum while washing dishes. Something cracked open in her chest. She walked onstage and played differently than she ever had: not away from something, but toward it.

The audience was still for a long moment after she finished. Then the applause came, and it felt like rain after a drought.

She called her mother that night for the first time in eight months. They talked for two hours about nothing important—recipes, a neighbor's new dog, the way the light looked in October. When she hung up, Mara sat in the silence of her apartment and found that it no longer felt empty. It felt like space. Space she had made for herself, and space she could now choose to fill.`,
    questions: [
      {
        id: 6,
        text: "Which universal theme is most central to this passage?",
        options: [
          "The pursuit of fame and recognition",
          "The journey from running away from one's past to finding genuine freedom and identity",
          "The conflict between art and commerce",
          "The dangers of ambition in young people"
        ],
        correctIndex: 1
      },
      {
        id: 7,
        text: "How does Professor Adeyemi's comment 'You play like someone running away' develop the theme?",
        options: [
          "It shows that Mara lacks technical skill",
          "It reveals that Mara's escape has not yet become true freedom",
          "It suggests that the professor dislikes Mara's style",
          "It foreshadows Mara's failure at the recital"
        ],
        correctIndex: 1
      },
      {
        id: 8,
        text: "What shift in Mara's understanding of freedom occurs during the spring recital?",
        options: [
          "She realizes that technical perfection is more important than emotion",
          "She understands that true freedom involves moving toward connection, not just away from pain",
          "She decides to return home and abandon her music career",
          "She recognizes that her mother was right to stay"
        ],
        correctIndex: 1
      },
      {
        id: 9,
        text: "How does Mara's nine-year-old belief that 'staying was surrender' contrast with her understanding at the end of the passage?",
        options: [
          "She now believes staying is always the right choice",
          "She realizes that her childhood belief was completely wrong",
          "She understands that freedom is about conscious choice, not simply distance from the past",
          "She decides that leaving was a mistake and plans to return home"
        ],
        correctIndex: 2
      },
      {
        id: 10,
        text: "What does the silence of Mara's apartment symbolize at the beginning versus the end of the passage?",
        options: [
          "At the beginning it represents freedom; at the end it represents loneliness",
          "At the beginning it represents loneliness and emptiness; at the end it represents space she has claimed for herself",
          "Both times it represents the same thing: isolation",
          "At the beginning it represents peace; at the end it represents regret"
        ],
        correctIndex: 1
      }
    ]
  },
  {
    id: 3,
    title: "The Last Garden",
    author: "Original Passage",
    genre: "Literary Fiction",
    text: `The garden had been her grandmother's before it was hers, and her great-grandmother's before that. Three generations of women had knelt in this same soil, coaxing the same stubborn roses to bloom, arguing with the same clay earth that refused to drain properly after rain.

Yolanda had not wanted the garden. She was a software engineer who lived in a high-rise and kept succulents on her windowsill because they required almost nothing of her. When her grandmother died and left her the house, she had planned to sell it within the month.

That was two years ago.

She wasn't sure when the shift happened. Perhaps it was the morning she found the journal—her grandmother's careful handwriting recording decades of plantings, failures, and small victories. "The roses bloomed again today. I thought of Mama." Or perhaps it was the afternoon she pulled her first weed and felt something loosen in her shoulders that she hadn't known was tight.

The garden was not efficient. It demanded her presence in a way that her work did not—her work could be done at midnight in pajamas; the garden required her body, her hands, her attention at specific hours, in specific weather. She resented this at first. Then she began to understand it as a gift.

Her neighbor, an elderly man named Mr. Osei, leaned over the fence one evening and watched her work.

"Your grandmother used to say the garden was a conversation," he said. "With who?" He smiled. "With everyone who came before. With everyone who'll come after."

Yolanda pressed a bulb into the earth—tulips, which her grandmother had never planted. Something new, she thought. Something that would bloom after her.

She understood then that she was not maintaining a garden. She was continuing a conversation that had begun before she was born and would outlast her. The roses were not just roses. They were a language, and she was learning to speak it.`,
    questions: [
      {
        id: 11,
        text: "Which universal theme is most fully developed in this passage?",
        options: [
          "The conflict between modern technology and traditional ways of life",
          "The connection between individuals and the generations that came before and after them",
          "The importance of property ownership",
          "The difficulty of maintaining a home after a loved one's death"
        ],
        correctIndex: 1
      },
      {
        id: 12,
        text: "How does the garden function as a symbol throughout the passage?",
        options: [
          "It represents the burden of family obligation",
          "It symbolizes the living connection between generations and the continuation of identity",
          "It represents Yolanda's escape from her stressful career",
          "It symbolizes the decay that comes with aging"
        ],
        correctIndex: 1
      },
      {
        id: 13,
        text: "What does Mr. Osei mean when he says the garden is 'a conversation'?",
        options: [
          "That gardeners must talk to their plants to help them grow",
          "That neighbors discuss gardening techniques over the fence",
          "That the garden is a living dialogue between past, present, and future generations",
          "That Yolanda should speak with her grandmother's spirit"
        ],
        correctIndex: 2
      },
      {
        id: 14,
        text: "Why is it significant that Yolanda plants tulips—something her grandmother never planted?",
        options: [
          "It shows that she is rejecting her grandmother's legacy",
          "It demonstrates that she is adding her own voice to the generational conversation while honoring the tradition",
          "It proves that she is a better gardener than her grandmother",
          "It shows that she prefers tulips to roses"
        ],
        correctIndex: 1
      },
      {
        id: 15,
        text: "How does the author develop the theme through Yolanda's changing relationship with the garden?",
        options: [
          "By showing her gradual mastery of gardening techniques",
          "By contrasting her initial resistance with her eventual understanding of the garden as inherited meaning",
          "By describing the financial value of the property",
          "By showing her competition with her neighbor Mr. Osei"
        ],
        correctIndex: 1
      }
    ]
  }
];
