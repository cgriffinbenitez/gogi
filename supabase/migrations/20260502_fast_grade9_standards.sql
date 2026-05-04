insert into public.standards (code, title, description)
values
  (
    'ELA.9.R.1.1',
    'Key Details & Layers of Meaning',
    'Explain how key elements enhance or add layers of meaning and/or style in a literary text.'
  ),
  (
    'ELA.9.R.1.2',
    'Universal Themes in Literary Texts',
    'Analyze universal themes and their development throughout a literary text.'
  ),
  (
    'ELA.9.R.1.3',
    'Narrator Perspective, Irony & Satire',
    'Analyze the influence of narrator perspective on a text, explaining how the author creates irony or satire.'
  ),
  (
    'ELA.9.R.2.1',
    'Text Structure & Purpose',
    'Analyze how multiple text structures and/or features convey a purpose and/or meaning in texts.'
  ),
  (
    'ELA.9.R.2.2',
    'Central Idea & Support',
    'Evaluate the support an author uses to develop the central idea(s) throughout a text.'
  ),
  (
    'ELA.9.R.2.3',
    'Rhetorical Appeals & Purpose',
    'Analyze how an author establishes and achieves purpose(s) through rhetorical appeals and/or figurative language.'
  ),
  (
    'ELA.9.R.2.4',
    'Compare Opposing Arguments',
    'Compare the development of two opposing arguments on the same topic, evaluating the effectiveness and validity of the claims.'
  ),
  (
    'ELA.9.R.3.1',
    'Figurative Language & Mood',
    'Explain how figurative language creates mood in text(s).'
  ),
  (
    'ELA.9.R.3.3',
    'Adaptations Across Texts',
    'Compare and contrast the ways authors have adapted mythical, classical, or religious texts.'
  ),
  (
    'ELA.9.R.3.4',
    'Rhetoric & Reader Effect',
    'Explain an author’s use of rhetoric in a text.'
  ),
  (
    'ELA.9.V.1.2',
    'Word Parts & Etymology',
    'Apply knowledge of etymology and derivations to determine meanings of words and phrases in grade-level content.'
  ),
  (
    'ELA.9.V.1.3',
    'Vocabulary in Context',
    'Use context clues, figurative language, word relationships, reference materials, and background knowledge to determine connotative and denotative meaning.'
  )
on conflict (code) do update
set title = excluded.title,
    description = excluded.description;
