import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Sliding-window in-memory store: userId → array of call timestamps (ms).
// Resets on server restart — acceptable for pilot scale.

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_CALLS = 100;

// ─── System Prompts ───────────────────────────────────────────────────────────

const GENERATE_DIAGNOSTIC_QUESTIONS_SYSTEM_PROMPT = `You are a diagnostic assessment designer for a 9th grade ELA literacy intervention platform serving Title I students in Miami-Dade County Florida. You generate GOGI Ordered Multiple Choice diagnostic questions — not comprehension questions. These are precision diagnostic instruments designed to identify which specific cognitive layer caused a student's failure.

Each question must have exactly 4 options: one correct answer called the Key and three diagnostic distractors. Each distractor represents a specific cognitive breakdown at a specific layer.

Distractor Layer 1 — schema deficit or no metacognitive strategy: the student selects this when they have no prior knowledge framework to connect to the text or no strategy for approaching it.
Distractor Layer 2 — vocabulary gap, morphology gap, syntax barrier, or connotative language blindness: the student selects this when linguistic features are blocking meaning construction during reading.
Distractor Layer 3 — inferencing deficit, abstract reasoning deficit, evidence retrieval failure, or comprehension integration failure: the student selects this when meaning-making breaks down after reading is complete.
The Key is the correct answer — selected only by a student who has mastered the targeted cognitive skill.

Use these diagnostic classification codes exactly: schema_deficit, no_metacognitive_strategy, vocabulary_gap, vocabulary_gap_connotative, morphology_gap, syntax_barrier, inferencing_deficit, abstract_reasoning_deficit, evidence_retrieval_failure, comprehension_integration_failure

Return ONLY a valid JSON array of 5 question objects. No preamble. No markdown. No explanation. Just raw JSON.

Each object in the array must have exactly these fields:
- content: a multi-line string formatted exactly as shown:
PASSAGE: [full passage text]
QUESTION: [question stem]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]
LAYER1_DISTRACTOR: [which letter is the Layer 1 distractor]
LAYER2_DISTRACTOR: [which letter is the Layer 2 distractor]
LAYER3_DISTRACTOR: [which letter is the Layer 3 distractor]
DIAGNOSTIC_CLASSIFICATION_A: [classification code for option A]
DIAGNOSTIC_CLASSIFICATION_B: [classification code for option B]
DIAGNOSTIC_CLASSIFICATION_C: [classification code for option C]
DIAGNOSTIC_CLASSIFICATION_D: [classification code for option D]
COGNITIVE_SKILL: [the primary cognitive skill this question targets]
- cognitive_skill_targeted: the same value as COGNITIVE_SKILL above`;

const EXTRACT_PASSAGES_SYSTEM_PROMPT = `You are extracting passages from a literary text for use in a 9th grade ELA literacy intervention platform serving Title I students in Miami-Dade County Florida. Extract exactly 4 passages following these requirements exactly.

Two intervention passages at difficulty level 1. Each passage must be 150 to 200 words. Must contain a clear opportunity for one of these cognitive skills: inferencing, theme identification, or structural analysis depending on the standard. Must be emotionally accessible — avoid passages involving graphic violence, abuse, trauma, death of a child, or content that could be activating for students experiencing hardship. Must stand alone without requiring knowledge of surrounding chapters. Must feature a character facing a recognizable human challenge — ambition, friendship, identity, belonging, loss, or perseverance.

Two reassessment passages at difficulty level 2. Each passage must be 250 to 300 words. Must be more linguistically complex than the intervention passages. Must contain multiple cognitive skill opportunities. Must be appropriate for grade-level independent reading.

Return ONLY a valid JSON array. No preamble. No explanation. No markdown. Just the raw JSON array. Each object in the array must have exactly these fields: content as a string, phase as either intervention or reassessment, cognitive_skill_targeted as a string matching one of the diagnostic classifications, difficulty_level as an integer 1 or 2, source_title as a string, source_author as a string.`;

const PROTOCOL_SYSTEM_PROMPT = `You are a clinical intervention designer for GOGI, an ELA literacy platform for 9th grade Title I students in Miami-Dade County, Florida. You generate precise, protocol-specific intervention content.

Voice (when writing to students): direct, warm, peer-to-peer. Speak like a peer who believes in this student completely. No academic language. No walls of text. Every word earns its place. Speak directly to the student as "you."

When returning JSON: return ONLY valid JSON. No preamble. No markdown. No explanation. Raw JSON only.`;

// Used for generate_protocol_step_content — no word cap, length scales to step type.
const PROTOCOL_CONTENT_SYSTEM_PROMPT = `You are Gogi, a peer tutor for 9th grade ELA students in Title I schools in Miami-Dade County, Florida.

Voice: casual, direct, warm, teen peer energy. You believe in this student completely. No academic language. Every word earns its place. Speak directly to the student as "you."

Rules that never break:
- Never return JSON. Never use code blocks. Never use markdown headers.
- Never give away the answer. Guide the thinking, never do it.
- Connect every skill to real power in the student's actual life.

Length: Match your length to the instructional demand of the step. Orientation and ReassessTrigger: 3-5 sentences maximum. MicroModel: use as many words as needed to fully demonstrate the skill with examples — never compress a demonstration into a summary. All other steps: match length to what the student needs to successfully complete the interaction.`;

// Used for generate_protocol_feedback — short feedback only, 150-word cap enforced.
const PROTOCOL_FEEDBACK_SYSTEM_PROMPT = `You are Gogi, a peer tutor for 9th grade ELA students in Title I schools in Miami-Dade County, Florida.

Voice: casual, direct, warm, teen peer energy. You believe in this student completely. No academic language. No walls of text. Every word earns its place. Speak directly to the student as "you."

Rules that never break:
- Never return JSON. Never use code blocks. Never use markdown headers.
- Never give away the answer. Guide the thinking, never do it.
- Speak in plain conversational sentences only.
- Maximum 150 words per response.
- Connect every skill to real power in the student's actual life.`;

// Sprint 5 — practice loop answer feedback
const PRACTICE_FEEDBACK_SYSTEM_PROMPT = `You are Gogi, a supportive peer tutor for 9th grade students. You are 15-16 years old in tone — not a teacher, not a bot. Keep responses to 2-3 sentences maximum. If the answer is correct: name the EXACT cognitive move the student used. Start with "That's the move." or "Exactly." Never just "Correct!" If the answer is wrong: name the error type, point to a specific detail in the passage, end with "Try again." Never say "incorrect" or "wrong." Never reveal the correct answer directly. Never use exclamation points more than once per response.`;

const SYSTEM_PROMPT = `You are GOGI, an AI literacy tutor for 9th grade students in Title 1 schools.

Voice: sharp, warm, direct. Speak like a peer who believes in this student completely. No academic language. No walls of text. Every word earns its place.

Rules that never break:
- Never give away the answer. Guide the thinking, never do it.
- Always speak directly to the student as "you."
- Reference what this specific student actually wrote, not a generic example.
- When wrong: name one thing they got right, then name one specific thing to look at differently. Never say "however" or "unfortunately." Always point forward.
- When right: name exactly what their brain just did — specific, not generic. Connect it to one real situation outside school where it gives them power. Never say "great job," "excellent work," or "well done."
- Connect every skill to real power in the student's actual life — jobs, relationships, contracts, choices. Never abstract. Never "for school."`;

// ─── Prompt Builders ──────────────────────────────────────────────────────────

type ClaudeAction =
  | 'explanation'
  | 'worked_example'
  | 'guided_evidence'
  | 'evaluate_guided'
  | 'generate_guided_passage'
  | 'generate_independent_passage'
  | 'evaluate_independent'
  | 'generate_reassess'
  | 'evaluate_reassess_response'
  | 'mastery_celebration'
  | 'generate_orientation'
  | 'generate_conversation_turn'
  | 'evaluate_conversation_mastery'
  | 'extract_passages'
  | 'generate_diagnostic_questions'
  // ─── Canonical Protocol Engine (ProtocolEngine.tsx) ───────────────────────
  | 'generate_protocol_step_content'
  | 'generate_protocol_feedback'
  | 'evaluate_mastery_structured'
  // ─── Practice Phase (PracticeSession.tsx) ─────────────────────────────────
  | 'generate_practice_questions'
  | 'evaluate_practice_response'
  // ─── Sprint 5 practice loop feedback ──────────────────────────────────────
  | 'practice_feedback'
  // ─── Sprint K reading profile ─────────────────────────────────────────────
  | 'score_syntax_response';

function buildMockClaudeResponse(action: ClaudeAction) {
  switch (action) {
    case 'score_syntax_response':
      return { text: '1', mocked: true };

    case 'evaluate_mastery_structured':
      return {
        text: JSON.stringify({
          mastery: false,
          score: 1,
          feedback: 'Mock feedback: this response is partially on track.',
        }),
        mocked: true,
      };

    case 'evaluate_practice_response':
      return {
        text: JSON.stringify({
          correct: false,
          feedback: 'Mock feedback: look back at the passage detail and try again.',
        }),
        mocked: true,
      };

    default:
      return {
        text: 'Mock GOGI response for local development. This avoided a real Anthropic API call.',
        mocked: true,
      };
  }
}

function buildPrompt(action: ClaudeAction, params: Record<string, string>): string {
  const { standardCode = '', standardTitle = '' } = params;

  switch (action) {
    case 'explanation': {
      const { diagnosticClassification = '', studentResponse = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

Student diagnostic result:
- What they wrote: "${studentResponse}"
- Cognitive breakdown identified: ${diagnosticClassification}

Write exactly 3 sentences directly to the student. No more.
Sentence 1: Name exactly what broke down in plain language a 14-year-old understands. Be specific to what they actually wrote. No academic terms.
Sentence 2: Tell them why this skill matters in their real life — not school, not tests. One concrete situation where a person with this skill has real power.
Sentence 3: Tell them exactly what they are about to learn right now to fix it.

3 sentences. Nothing else. Write directly to the student as "you."`;
    }

    case 'worked_example': {
      return `Standard: ${standardCode} — ${standardTitle}

Write a worked example that makes expert thinking visible.

First, write a short original passage (3-4 sentences) grounded in a 9th grader's real world.

Then write the think-aloud: exactly 4 to 6 short sentences. Each sentence is one step in the thinking process happening in real time — write it like a thought, not an explanation of a thought. No meta-commentary. Just the thinking itself, step by step, as it moves through the text.

Then write one sentence connecting this exact thinking move to a specific moment outside school where it gives someone real power.

Format exactly as:
**Passage:**
[passage text]

**Think-Aloud:**
[4-6 sentences, each one step — real-time thinking only]

**Real Life:**
[one sentence — concrete, specific, outside school]`;
    }

    case 'guided_evidence': {
      const { passageText = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

Passage:
"${passageText}"

The student is about to attempt a written response applying this standard to this passage.

Identify and quote 2-3 specific pieces of textual evidence most directly relevant to applying this standard. Do NOT tell the student what the evidence means or what conclusion to draw — surface the evidence and name why each piece is worth examining.

Format exactly as:
**Relevant Evidence:**

1. "[direct quote from passage]" — [one sentence on why this is worth examining, not what it means]
2. "[direct quote from passage]" — [one sentence on why this is worth examining]
3. "[direct quote from passage]" — [one sentence on why this is worth examining]

Keep it tight. The student does the thinking.`;
    }

    case 'evaluate_guided': {
      const { passageText = '', studentResponse = '', attemptNumber = '1', diagnosticClassification = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}
Diagnostic classification: ${diagnosticClassification}

Passage the student was responding to:
"${passageText}"

The student wrote (attempt ${attemptNumber}):
"${studentResponse}"

Evaluate against these three criteria — all three must be met for mastery:
1. INFERENCE OR CLAIM: Did the student make a specific inference, claim, or central idea that goes beyond surface summary?
2. EVIDENCE CITED: Did the student reference or quote at least one specific detail from the text?
3. CONNECTION EXPLAINED: Did the student explain how the evidence supports or leads to their claim or inference?

Start with "MASTERY: YES" or "MASTERY: NO" on its own line. Then a blank line. Then your message.

If MASTERY: NO — write exactly 2 sentences. No more.
Sentence 1: Name one criterion they met — reference their actual words to show exactly what they got right.
Sentence 2: Name the one criterion they did not meet and tell them specifically what to look at. Do not give the answer. Do not say "however" or "unfortunately." Point forward.

If MASTERY: YES — write exactly 2 sentences. No more.
Sentence 1: Name exactly what their brain just did across all three criteria — specific, not generic praise. Reference their actual words.
Sentence 2: Connect that exact skill to one real situation outside school where it gives them power.`;
    }

    case 'generate_guided_passage': {
      return `Standard: ${standardCode} — ${standardTitle}

Generate a short original passage (3-5 sentences) appropriate for a 9th grade reading level that provides material for applying this standard. The passage should be engaging and grounded in real life — not a generic classroom example.

Output only the passage text. No title. No question. No labels. No formatting. Just the passage.`;
    }

    case 'generate_independent_passage': {
      return `Standard: ${standardCode} — ${standardTitle}

Generate a short original literary passage (5-8 sentences) appropriate for a 9th grade reading level that provides rich material for applying this standard. The passage should be engaging and grounded in a teenager's real experience or world — not a generic classroom example.

Then generate one open-ended question that asks the student to apply this standard to the passage. The question requires a written response that demonstrates the specific cognitive skill — not just identification or summary.

Format exactly as:
**Passage:**
[passage title on one line]
[passage text]

**Question:**
[the question]`;
    }

    case 'evaluate_independent': {
      const { passageText = '', passageQuestion = '', studentResponse = '', attemptNumber = '1', diagnosticClassification = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}
Diagnostic classification: ${diagnosticClassification}

Passage:
"${passageText}"

Question asked:
"${passageQuestion}"

The student wrote (attempt ${attemptNumber}):
"${studentResponse}"

Evaluate against these three criteria — all three must be met for mastery:
1. INFERENCE OR CLAIM: Did the student make a specific inference, claim, or central idea that goes beyond surface summary?
2. EVIDENCE CITED: Did the student reference or quote at least one specific detail from the text?
3. CONNECTION EXPLAINED: Did the student explain how the evidence supports or leads to their claim or inference?

Evaluate whether ALL three criteria are met.

Start with "MASTERY: YES" or "MASTERY: NO" on its own line. Then a blank line. Then your message.

If MASTERY: NO — write exactly 2 sentences. No more.
Sentence 1: Name one criterion they met — reference their actual words to show exactly what they got right.
Sentence 2: Name the one criterion they did not meet and tell them specifically what to look at. Do not give the answer. Do not say "however" or "unfortunately." Point forward.

If MASTERY: YES — write exactly 2 sentences. No more.
Sentence 1: Name exactly what their brain just did across all three criteria — specific, not generic praise. Reference their actual words.
Sentence 2: Connect that exact skill to one real situation outside school where it gives them power.`;
    }

    case 'generate_reassess': {
      return `Standard: ${standardCode} — ${standardTitle}

Generate a brand new, unseen literary passage (6-8 sentences) appropriate for 9th grade that provides rich material for applying this standard. The passage should be completely original — engaging, contemporary, grounded in real experience. Make it feel alive.

Then generate exactly 5 open-ended questions that require written responses demonstrating mastery of this standard. Questions should require increasingly sophisticated application of the skill — from identification to analysis to synthesis. No scaffolds. No hints. No sentence stems.

Format exactly as follows using these exact markers:
---PASSAGE---
[passage title]
[passage text]

---QUESTION 1---
[question text]

---QUESTION 2---
[question text]

---QUESTION 3---
[question text]

---QUESTION 4---
[question text]

---QUESTION 5---
[question text]`;
    }

    case 'evaluate_reassess_response': {
      const { passageText = '', questionText = '', studentResponse = '', questionNumber = '1' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

Passage:
"${passageText}"

Question ${questionNumber}:
"${questionText}"

Student response:
"${studentResponse}"

Mastery criteria: The student demonstrates mastery when they make a specific, evidence-supported claim that requires genuine application of ${standardTitle}. The response must go beyond identifying or summarizing.

Start with "MASTERY: YES" or "MASTERY: NO" on its own line. Then a blank line. Then your message.

If MASTERY: NO — write exactly 2 sentences. No more.
Sentence 1: Name one specific thing they got right. Reference their actual words.
Sentence 2: Name the one specific thing to look at differently. Do not give the answer. Do not say "however" or "unfortunately." Point forward.

If MASTERY: YES — write exactly 2 sentences. No more.
Sentence 1: Name exactly what their brain just did — the specific cognitive move, not generic praise.
Sentence 2: Connect that exact skill to one real situation outside school where it gives them power.`;
    }

    case 'mastery_celebration': {
      return `Standard: ${standardCode} — ${standardTitle}

The student just completed the full Teach phase and demonstrated mastery of this standard.

Write exactly 3 sentences directly to the student. No more.
Sentence 1: Name the specific skill they just proved they own — precise and concrete, not generic.
Sentence 2: Name one real situation outside school where that skill gives them actual power.
Sentence 3: One short, punchy affirmation that sounds like a real person, not a system. Never say "great job," "excellent work," or "well done."

3 sentences. Nothing else.`;
    }

    case 'generate_orientation': {
      const { passageText = '', diagnosticClassification: dc = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}
Diagnostic classification: ${dc}

Passage the student is about to work with:
"${passageText}"

Generate exactly 3 sentences as a Gogi orienting message. No labels. No headers. No extra text.

Sentence 1: Name the destination in plain language specific to THIS passage and THIS classification. Name the specific character and what they are feeling or thinking — something the author never directly states. Never use the word "inferencing" in this sentence. Make it about the actual character and the actual passage. Example structure: "We are going to figure out what [character name] is actually feeling — something the author never directly says out loud."

Sentence 2: Name the skill explicitly in these exact words: "That skill is called inferencing — reading what an author implies but never directly states. It is one of the most powerful reading skills there is."

Sentence 3: Frame what is about to happen in these exact words: "I am going to ask you three questions. Each one is a clue. By the end you are going to have the answer and the proof. Let's find it."

3 sentences only. Output only the message.`;
    }

    case 'generate_conversation_turn': {
      const {
        passageText = '',
        conversationHistory = '',
        turnNumber = '1',
        isIndependent = 'false',
        diagnosticClassification: dc = '',
      } = params;
      const turn = parseInt(turnNumber, 10);
      const isInd = isIndependent === 'true';

      let instruction = '';
      if (turn === 1) {
        instruction = isInd
          ? `Open the conversation with a direct challenge. Do not point to any specific detail in the passage. Say something like: "New passage. No hints this time. Read it and tell me what you think is really going on underneath the surface." Keep it direct, 1-2 sentences max. Then end with a response anchor on a new line wrapped in underscores: _Write one or two sentences about what you think is really going on beneath the surface._`
          : `Turn 1 — Attention. Direct the student to one specific detail in this passage that carries implied meaning — a character action, word choice, or moment that suggests something the author never directly states. Ask a direct, human question any student who read the passage can engage with — no prior knowledge required. Example style: "Read this line — [exact quote]. Why do you think [character] did that instead of [alternative]?" Maximum 2 sentences for your question. Then end with a response anchor on a new line wrapped in underscores — adapt the character name to match the passage: _Write one or two sentences about why you think [character] did that._`;
      } else if (turn === 2) {
        instruction = isInd
          ? `Turn 2 — Interpretation. Acknowledge one specific thing the student got right in their previous response — reference their actual words in one sentence. Then ask them to go one level deeper on what they already found. Do not name specific details from the passage — only ask the student to go deeper on what they themselves identified. Maximum 2 sentences for the question. Then end with a response anchor on a new line wrapped in underscores: _Write one sentence about what that detail adds to what you already figured out._`
          : `Turn 2 — Interpretation. Acknowledge one specific thing the student got right in their previous response — reference their actual words in one sentence. Then ask the student to connect a second detail from the passage to the feeling or meaning they just identified. Maximum 2 sentences for the question. Then end with a response anchor on a new line wrapped in underscores: _Write one sentence about what that detail adds to what you already figured out._`;
      } else if (turn === 3) {
        instruction = isInd
          ? `Turn 3 — Synthesis. Acknowledge the student's Turn 2 observation specifically in one sentence — reference their actual words. Then ask them to put both observations together into one complete statement that is the inference. Do not name specific details — only ask the student to synthesize what they found. Maximum 2 sentences for the question. Then end with a response anchor on a new line wrapped in underscores: _Write one sentence naming the feeling and one sentence naming the proof from the text._`
          : `Turn 3 — Synthesis. REQUIRED BRIDGE: First write one sentence that explicitly names BOTH pieces of evidence the student has identified so far, using their actual words. Example: "So you have two things — [evidence 1 from student's words] and [evidence 2 from student's words]." Then ask the student to put both observations together into one complete statement — the inference — naming what the text implies and what in the text makes them say so. Maximum 2 sentences for the bridge + question combined. Then end with a response anchor on a new line wrapped in underscores: _Write one sentence naming the feeling and one sentence naming the proof from the text._`;
      } else {
        instruction = `The student has not yet fully demonstrated mastery. Acknowledge one specific thing they got right — reference their actual words in one sentence. Then ask one targeted follow-up question to close the gap on what is missing — do not give the answer, point them toward it. Maximum 2 sentences. Then end with a response anchor on a new line wrapped in underscores: _Write one sentence that completes what you started in your last response._`;
      }

      return `Standard: ${standardCode} — ${standardTitle}
Diagnostic classification: ${dc}

Passage the student is working with:
"${passageText}"

Conversation so far:
${conversationHistory || '(conversation has not started yet)'}

${instruction}

Voice rules: direct and warm, reference the student's actual words when responding to them, never give the answer, one cognitive move only. Always include the response anchor on its own line at the end, wrapped in underscores.
Output only your message. No labels. No headers. Just the message.`;
    }

    case 'evaluate_conversation_mastery': {
      const {
        passageText = '',
        conversationHistory = '',
        diagnosticClassification: dc = '',
      } = params;
      return `Standard: ${standardCode} — ${standardTitle}
Diagnostic classification: ${dc}

Passage:
"${passageText}"

Full conversation:
${conversationHistory}

Evaluate the student's most recent response (their last message) against these three mastery criteria:
1. INFERENCE PRESENT: Did the student make a specific inference that goes beyond surface summary?
2. EVIDENCE CITED: Did the student reference or quote at least one specific detail from the text?
3. CONNECTION EXPLAINED: Did the student explain how the evidence leads to or supports the inference?

Start with "MASTERY: YES" or "MASTERY: NO" on its own line. Then a blank line. Then your message.

If MASTERY: YES — write exactly 3 sentences.
Sentence 1: Name the specific inference the student just made — state exactly what they figured out, using their actual words to show which evidence led them there.
Sentence 2: Name the skill explicitly using these exact words: "That is inferencing. You just read what the author implied without being told."
Sentence 3: Connect that exact skill to one specific, concrete real-life situation outside school — a job, a relationship, a contract, a decision — where this gives them actual power. Never say "great job," "well done," or "excellent work."

If MASTERY: NO — write exactly 2 sentences. Sentence 1: name which criteria were met — reference their actual words to show what they got right. Sentence 2: ask one targeted follow-up question to close the gap on the missing criterion — do not give the answer, point them toward it. Never say "however" or "unfortunately." Always point forward.`;
    }

    case 'extract_passages': {
      const { bookText = '', sourceTitle = '', sourceAuthor = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}
Source: "${sourceTitle}" by ${sourceAuthor}

Text excerpt:
${bookText}

Extract exactly 4 passages from this text following the system prompt requirements. Return ONLY the JSON array.`;
    }

    case 'generate_diagnostic_questions': {
      const { cognitiveDomain = '', passage1Text = '', passage2Text = '' } = params;

      const skillsByStandard: Record<string, string[]> = {
        'ELA.9.R.1.1': ['inferencing', 'textual evidence', 'vocabulary', 'syntax', 'schema'],
        'ELA.9.R.1.2': [
          'abstract reasoning',
          'theme identification',
          'vocabulary connotative',
          'schema',
          'inferencing',
        ],
        'ELA.9.R.2.1': [
          'structural analysis',
          'purpose analysis',
          'vocabulary',
          'metacognitive strategy',
          'inferencing',
        ],
      };

      const skills = skillsByStandard[standardCode] ?? [
        'inferencing',
        'vocabulary',
        'schema',
        'syntax',
        'abstract reasoning',
      ];

      return `Standard: ${standardCode} — ${standardTitle}
Cognitive Domain: ${cognitiveDomain}

You have two passages from the Gutenberg library to build diagnostic questions on.

PASSAGE 1 (difficulty level 1 — intervention level):
${passage1Text}

PASSAGE 2 (difficulty level 2 — reassessment level):
${passage2Text}

Generate exactly 5 diagnostic multiple choice questions. Distribute them across these 5 cognitive skills in this exact order:
Question 1 — target: ${skills[0]}
Question 2 — target: ${skills[1]}
Question 3 — target: ${skills[2]}
Question 4 — target: ${skills[3]}
Question 5 — target: ${skills[4]}

Use PASSAGE 1 for questions 1, 2, and 3. Use PASSAGE 2 for questions 4 and 5.

Each question must have exactly 4 options arranged so that:
- One option is the Key (correct answer, demonstrates mastery)
- One option is the Layer 1 distractor (schema_deficit or no_metacognitive_strategy)
- One option is the Layer 2 distractor (vocabulary_gap, vocabulary_gap_connotative, morphology_gap, or syntax_barrier)
- One option is the Layer 3 distractor (inferencing_deficit, abstract_reasoning_deficit, evidence_retrieval_failure, or comprehension_integration_failure)

Randomize which letter (A, B, C, D) is the Key across the 5 questions — do not always put the Key in the same position.

Return ONLY the JSON array. No markdown. No preamble. No explanation.`;
    }

    // ─── Canonical Protocol Engine ──────────────────────────────────────────

    case 'generate_protocol_step_content': {
      const {
        stepNumber = '',
        stepName = '',
        protocolLabel = '',
        stepPurpose = '',
        claudeGenerates = '',
        interactionType = '',
        scaffoldsActive = 'true',
        passage = '',
        diagnosticClassification = '',
      } = params;

      // read_only format spec is step-name-aware:
      // Orientation → brief framing (3-5 sentences, no lists)
      // MicroModel  → structured demonstration required (lists, numbered steps allowed)
      // ReassessTrigger → emotional closure (2-3 sentences, no lists)
      // All other read_only → default brief format
      const readOnlyFormatSpec =
        stepName === 'MicroModel'
          ? `Structure your response as numbered demonstration points. Each point must follow this exact format:
POINT [N] | HIGHLIGHT: "[exact quote from passage — copy verbatim]" | [Gogi instruction text for this point]

Example:
POINT 1 | HIGHLIGHT: "Buck lived at a big house in the sun-kissed Santa Clara Valley" | See how London stacks comfort words right here — sun-kissed, big house, Santa Clara Valley. He is building up how good Buck has it before taking it all away. That is the setup.
POINT 2 | HIGHLIGHT: "trouble was brewing, not alone for himself" | Now look at this line — trouble is brewing. London puts this in the very first sentence. He wants you to feel the contrast immediately. Comfort on one side, danger on the other.

Generate between 2 and 4 points depending on how many moves the skill demonstration requires. Never more than 4. Each HIGHLIGHT quote must appear verbatim in the passage text provided. Never fabricate quotes.`
          : stepName === 'ReassessTrigger'
            ? 'Speak directly to the student in 2-3 sentences. No lists. No headers. Emotional closure only.'
            : 'Speak directly to the student in 3-5 sentences. No lists. No headers. Just Gogi talking.';

      return `You are Gogi, an AI peer tutor for 9th grade ELA students. Speak directly to the student in casual, energetic teen voice. Never return JSON. Never use code blocks. Speak in plain conversational paragraphs.

You are delivering Step ${stepNumber} (${stepName}) of the ${protocolLabel} intervention for standard ${standardCode}.

The student failed due to: ${diagnosticClassification}
Scaffolds active: ${scaffoldsActive}
The passage: ${passage}

Your job for this step: ${stepPurpose}

Specifically generate: ${claudeGenerates}

Interaction type: ${interactionType}
${interactionType === 'multiple_choice' ? 'Format your response as: question text, then exactly 4 options labeled A) B) C) D) on separate lines. Nothing else.' : ''}
${interactionType === 'fill_in' ? 'Format your response as instructions followed by fill-in sentences using ___ for blanks.' : ''}
${interactionType === 'read_only' ? readOnlyFormatSpec : ''}
${interactionType === 'short_response' ? 'Ask one clear question. End with an italicized response anchor on a new line telling the student what shape their answer should take.' : ''}

Never supply the answer. Coach voice only.`;
    }

    case 'generate_protocol_feedback': {
      const {
        studentResponse = '',
        passageContext = '',
        masteryAchieved = 'false',
        feedbackContext = '',
      } = params;

      const passed = masteryAchieved === 'true';

      return `You are Gogi, a peer tutor for 9th grade ELA students in Title I schools in Miami-Dade County.

Standard: ${standardCode} — ${standardTitle}
${passageContext ? `Passage context: "${passageContext.substring(0, 200)}"` : ''}
${feedbackContext ? `Note: ${feedbackContext}` : ''}
Student wrote: "${studentResponse.substring(0, 400)}"

Write exactly 2 sentences in Gogi voice.
${
  passed
    ? 'Sentence 1: Name exactly what cognitive move the student\'s brain just made — specific, reference their actual words, no generic praise. Sentence 2: Connect that exact skill to one concrete real-life situation outside school where it gives them actual power.'
    : 'Sentence 1: Name one specific thing they got right — reference their actual words. Sentence 2: Name the one thing to look at differently — do not give the answer, point toward it. Never say "however" or "unfortunately." Always point forward.'
}

2 sentences only. Direct, warm, peer energy. Output only the 2 sentences.`;
    }

    case 'evaluate_mastery_structured': {
      const {
        studentResponse = '',
        passage = '',
        protocolName = '',
        stepName = '',
        advancementCondition = '',
        scaffoldsActive = 'false',
      } = params;

      return `You are evaluating a 9th grade student's literary analysis response for standard ${standardCode} — ${standardTitle}.

Protocol: ${protocolName}
Step: ${stepName}
Scaffolds active: ${scaffoldsActive}

Advancement condition:
"${advancementCondition}"

Full passage:
${passage}

Student response:
"${studentResponse}"

Note: responses formatted as Theme:/Evidence:/Reasoning: are structured student answers — evaluate each labeled section against its corresponding mastery condition independently.

FIRST — Check for these 8 fake-out patterns that look like answers but are NOT mastery. Any one of these = passed: false:
1. COPY-PASTE: Response is copied verbatim or near-verbatim from the passage without interpretation.
2. NON-RESPONSE: Single word, phrase, or off-topic response with no attempt at the skill (e.g. "idk", "I don't know", "nothing").
3. RESTATEMENT WITHOUT REASONING: Student restates what happened but never explains what it means or implies.
4. DISCONNECTED: Student makes a claim but the evidence or annotation has no logical connection to the claim.
5. INCOHERENT: Response does not form a coherent thought about the text.
6. SOPHISTICATED RESTATEMENT: Response sounds analytical but on close reading only retells the passage in different words.
7. EVIDENCE DROPPING: Student identifies evidence but never uses it to build the inference or theme — the connection is missing.
8. UNIVERSAL THEME FAKER: Theme statement sounds universal but actually names something specific to this character or story only (e.g. "Marcus wanted to fit in" instead of "People change themselves to belong").

If ANY of the above apply, all four evaluation fields must reflect the failure — do not pass individual fields while the overall response is a fake-out.

Return ONLY valid JSON:
{
  "theme_universal": <true ONLY if Theme section states a universal claim about human nature — not a topic, not character-specific>,
  "evidence_relevant": <true ONLY if Evidence section cites specific text that genuinely supports the stated theme>,
  "reasoning_explicit": <true ONLY if Reasoning section explains HOW the evidence proves the theme — not just restates it>,
  "scaffolds_used": <true if response contains sentence stems, fill-in-the-blank patterns, or copied scaffold language>,
  "passed": <true ONLY if all three conditions above are true AND scaffolds_used is false AND none of the 8 fake-out patterns apply>,
  "feedback": "<2 sentences Gogi voice — if passed: name exactly what cognitive move the student's brain just made using their actual words, no generic praise; if not passed: name the specific fake-out or gap using their actual words, point forward without giving the answer>"
}`;
    }

    // ─── Practice Phase ──────────────────────────────────────────────────────

    case 'generate_practice_questions': {
      const { protocolName = '', cognitiveSkillTargeted = '', passageText = '' } = params;

      let formatSpec = '';

      if (standardCode === 'ELA.9.R.1.2') {
        formatSpec = `
Return this exact JSON shape:
{
  "q1": {
    "instruction": "<one sentence question stem asking student to identify the universal theme>",
    "choices": [
      "<a valid universal theme — full sentence, true for all people>",
      "<a topic restated as a phrase, not a sentence>",
      "<a plot summary tied to this specific story>",
      "<a moral directive starting with 'You should' or 'Always'>'"
    ]
  },
  "q2": {
    "instruction": "The topic of this passage is ___. The universal theme is: ___. This theme applies to all people, not just the character, because ___."
  },
  "q3": {
    "instruction": "State the universal theme of this passage in one complete sentence. Make it true for all people, not only the character in this story."
  }
}
Note for q1: randomize which choice index (0-3) holds the correct universal theme.`;
      } else if (standardCode === 'ELA.9.R.1.1') {
        formatSpec = `
Return this exact JSON shape:
{
  "q1": {
    "instruction": "Highlight TWO details in the passage that hint at something the author never directly says. Tag each as 'Textual Evidence.' Then explain in the box below: what does the author want you to infer from these two details together?"
  },
  "q2": {
    "instruction": "Find the strongest piece of evidence in the passage. Highlight it and tag it. Then explain your inference — what does this detail allow you to conclude that the author never directly states?"
  },
  "q3": {
    "instruction": "Make your inference. Highlight and tag the evidence that proves it. Explain exactly how the evidence leads to your inference — what is the author implying without saying it directly?"
  }
}`;
      } else if (standardCode === 'ELA.9.R.2.1') {
        formatSpec = `
Return this exact JSON shape:
{
  "q1": {
    "instruction": "Sort these text elements into the correct categories based on how this passage is organized.",
    "items": ["<extract 6-8 short phrases or concepts directly from the passage>"],
    "categories": ["<Category 1 matching the text structure, e.g. Main Idea>", "<Category 2, e.g. Supporting Detail>"]
  },
  "q2": {
    "instruction": "Highlight the signal words and structural markers in the passage that show how the author organized this text. Tag each as a 'Signal Word.' Then explain: what text structure is this, and how do the signal words prove it?"
  },
  "q3": {
    "instruction": "State the main idea of this passage. Find the strongest evidence that supports it. Explain how the text structure helps the author make this point."
  }
}
For q1 categories: choose TWO categories that match the dominant text structure (e.g. 'Main Idea' + 'Supporting Detail', or 'Cause' + 'Effect', or 'Problem' + 'Solution', or 'Compare' + 'Contrast'). Generate items that genuinely represent both categories so the sort is meaningful.`;
      } else {
        formatSpec = `
Return this exact JSON shape:
{
  "q1": { "instruction": "<scaffolded question about the cognitive skill>" },
  "q2": { "instruction": "<reduced scaffold question>" },
  "q3": { "instruction": "<independent question>" }
}`;
      }

      return `You are generating 3 progressive practice questions for a 9th grade ELA student.

Standard: ${standardCode} — ${standardTitle}
Protocol completed: ${protocolName}
Cognitive skill: ${cognitiveSkillTargeted}

The student worked with this passage:
${passageText}

Generate 3 questions at 3 progressive scaffold levels:
- Q1 (scaffold_level: full): Student applies skill with one support structure visible.
- Q2 (scaffold_level: reduced): Student gets a direction but no frame or stem.
- Q3 (scaffold_level: none): Student applies skill fully independently.

All questions must work directly with the passage above. All questions must target the exact cognitive skill listed. Do NOT ask questions that are off-topic or require knowledge beyond what is in the passage.

${formatSpec}

Return ONLY the valid JSON. No preamble. No markdown. No explanation.`;
    }

    case 'evaluate_practice_response': {
      const {
        question = '',
        studentResponse = '',
        scaffoldLevel = 'full',
        cognitiveSkillTargeted = '',
      } = params;

      return `You are evaluating a 9th grade student's practice response for standard ${standardCode} — ${standardTitle}.

Cognitive skill targeted: ${cognitiveSkillTargeted}
Scaffold level: ${scaffoldLevel}

Question asked:
"${question}"

Student response:
"${studentResponse}"

FIRST — Check for these 8 fake-out patterns that look like answers but are NOT mastery. Any one of these = mastery_achieved: false:
1. COPY-PASTE: Response is copied verbatim or near-verbatim from the passage without interpretation.
2. NON-RESPONSE: Single word, phrase, or off-topic response with no attempt at the skill.
3. RESTATEMENT WITHOUT REASONING: Student restates what happened but never explains what it means or implies.
4. DISCONNECTED: Student makes a claim but the evidence or annotation has no logical connection to the claim.
5. INCOHERENT: Response does not form a coherent thought about the text.
6. SOPHISTICATED RESTATEMENT: Response sounds analytical but on close reading only retells the passage in different words.
7. EVIDENCE DROPPING: Student identifies evidence but never uses it to build the inference or theme — the connection is missing.
8. UNIVERSAL THEME FAKER: Theme statement sounds universal but actually names something specific to this character or story only.

If NONE of the above apply AND the response genuinely demonstrates the targeted cognitive skill: mastery_achieved: true.

For scaffold_level 'full': the bar is meeting the skill at a basic level with support.
For scaffold_level 'reduced': the bar is meeting the skill without a pre-built frame.
For scaffold_level 'none': the bar is independent, complete demonstration of the skill.

Return ONLY valid JSON:
{
  "mastery_achieved": <true or false>,
  "feedback": "<1-2 sentences in Gogi peer voice — if mastery: name exactly what the student's brain just did, no praise words like great or excellent; if not mastery: name the specific fake-out or gap, point forward without giving the answer>",
  "scaffold_level_cleared": <true if student met the skill at this scaffold level, same as mastery_achieved>
}`;
    }

    // ─── Sprint 5 practice loop feedback ────────────────────────────────────

    case 'practice_feedback': {
      const {
        passageText = '',
        questionStem = '',
        selectedOption = '',
        selectedOptionText = '',
        correctOption = '',
        isCorrect = 'false',
        attemptNumber = '1',
      } = params;

      const correct = isCorrect === 'true';
      const attempt = parseInt(attemptNumber, 10);

      const instruction = correct
        ? `The student got it right. Start your response with "That's the move." or "Exactly." — never just "Correct!". Name the EXACT cognitive move the student used to arrive at the right answer. 2-3 sentences max.`
        : attempt >= 3
          ? `The student has missed this three times. NOW model the answer explicitly in 2 sentences. Name what the passage detail actually shows and state the correct inference directly. Point to an exact phrase or line from the passage.`
          : `The student chose wrong. Name the specific error type (never use the words "incorrect" or "wrong"). Point to one specific detail in the passage they should look at differently. End your response with "Try again." 2-3 sentences max.`;

      return `Standard: ${standardCode}

Passage:
"${passageText.slice(0, 600)}"

Question: ${questionStem}
Student selected: Option ${selectedOption} — "${selectedOptionText}"
Correct answer: Option ${correctOption}
Result: ${correct ? 'CORRECT' : 'WRONG'}
Attempt: ${attemptNumber}

${instruction}

Output only your Gogi response. No labels. No headers. Never use more than one exclamation point total.`;
    }

    case 'score_syntax_response': {
      const { studentResponse = '', originalSentence = '' } = params;
      return `Original sentence: "${originalSentence}"
Student response: "${studentResponse}"

Score 0, 1, or 2:
0 = blank, irrelevant, or completely off topic
1 = partially captures the main idea — gets the gist but misses key elements
2 = accurately captures the main idea

Respond with ONLY a single digit: 0, 1, or 2. Nothing else.`;
    }

    default:
      return '';
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            // Read-only in API routes — session refresh handled by middleware
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Rate limiting (100 calls / user / hour, sliding window) ─────────────
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (rateLimitMap.get(user.id) ?? []).filter(t => t > windowStart);

    if (timestamps.length >= RATE_LIMIT_MAX_CALLS) {
      return NextResponse.json(
        { error: "You've been working hard. Take a short break and come back in a few minutes." },
        { status: 429 },
      );
    }

    rateLimitMap.set(user.id, [...timestamps, now]);

    // ── Request ─────────────────────────────────────────────────────────────
    const body = await req.json();
    const { action, ...params } = body as { action: ClaudeAction } & Record<string, string>;

    const prompt = buildPrompt(action, params);
    if (!prompt) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (process.env.ANTHROPIC_MOCK === 'true') {
      return NextResponse.json(buildMockClaudeResponse(action));
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const isExtractPassages = action === 'extract_passages';
    const isGenerateDiagnostic = action === 'generate_diagnostic_questions';
    const isProtocolJson = action === 'evaluate_mastery_structured';
    const isProtocolAction = action === 'evaluate_mastery_structured';
    const isShortScoreAction = action === 'score_syntax_response';

    const isJsonAction =
      isExtractPassages ||
      isGenerateDiagnostic ||
      isProtocolJson ||
      action === 'generate_reassess' ||
      action === 'generate_practice_questions' ||
      action === 'evaluate_practice_response';

    const isProtocolContentAction =
      action === 'generate_protocol_step_content' || action === 'generate_protocol_feedback';
    const isStreamingAction = isProtocolContentAction;

    const systemPrompt = isExtractPassages
      ? EXTRACT_PASSAGES_SYSTEM_PROMPT
      : isGenerateDiagnostic
        ? GENERATE_DIAGNOSTIC_QUESTIONS_SYSTEM_PROMPT
        : action === 'generate_protocol_step_content'
          ? PROTOCOL_CONTENT_SYSTEM_PROMPT
          : action === 'generate_protocol_feedback'
            ? PROTOCOL_FEEDBACK_SYSTEM_PROMPT
            : action === 'practice_feedback'
              ? PRACTICE_FEEDBACK_SYSTEM_PROMPT
              : isProtocolAction
                ? PROTOCOL_SYSTEM_PROMPT
                : SYSTEM_PROMPT;

    // ── Streaming path ───────────────────────────────────────────────────────
    // For generate_protocol_step_content and generate_protocol_feedback, pipe
    // the Anthropic SSE stream directly to the client so the UI can render
    // content progressively rather than waiting for the full response.
    if (isStreamingAction) {
      const streamRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          // MicroModel steps require 300-500 words; give step content room to breathe.
          // Feedback stays at 1024 — it is always 2 sentences.
          max_tokens: action === 'generate_protocol_step_content' ? 2048 : 1024,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!streamRes.ok || !streamRes.body) {
        const errText = await streamRes.text();
        console.error('[Claude API] Stream error:', streamRes.status, errText);
        return NextResponse.json({ error: 'Claude API error' }, { status: 502 });
      }

      return new Response(streamRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ── Non-streaming path (all other actions) ───────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: isJsonAction ? 8192 : isShortScoreAction ? 10 : 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Claude API] Error:', response.status, errText);
      return NextResponse.json({ error: 'Claude API error' }, { status: 502 });
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? '';
    return NextResponse.json({ text });
  } catch (err) {
    console.error('[Claude API] Exception:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
