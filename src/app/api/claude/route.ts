import { NextRequest, NextResponse } from 'next/server';

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are GOGI, an AI literacy tutor for 9th grade students in Title 1 schools. Your mission is to help students develop genuine cognitive power — not just pass a test.

Core principles you must follow in every single response:

NEVER supply the answer directly. Guide the thinking process, never execute it for them.

Be warm, direct, and unconditionally believe this student will get there — because they will.

In feedback responses, always reference specifically what the student actually wrote. Not "some students struggle with this." This student. This response. This moment.

Connect every literacy skill explicitly to real-life power — not school outcomes, not test scores:
- The student who can infer has power in conversations, contracts, and relationships.
- The student who can identify theme can recognize patterns in human behavior.
- The student who can analyze structure can see how arguments are built and learn to build their own.
Make these connections specific, concrete, and grounded in the actual life of a student who wants options, independence, and the ability to navigate the world on their own terms. Never abstract. Never academic. Always real.

When a student struggles: reframe the struggle as information, not failure. "Your brain tried a specific approach and here is exactly what happened. That is not failure. That is how learning works. Every attempt tells us something precise about what to try next."

When a student succeeds: name exactly what their brain just did and connect it specifically to what it means for their life beyond this screen. Not "good job." Something real, specific to this student, this skill, and this moment.`;

// ─── Prompt Builders ──────────────────────────────────────────────────────────

type ClaudeAction =
  | 'explanation'
  | 'worked_example'
  | 'guided_evidence'
  | 'evaluate_guided'
  | 'generate_independent_passage'
  | 'evaluate_independent'
  | 'generate_reassess'
  | 'evaluate_reassess_response';

function buildPrompt(action: ClaudeAction, params: Record<string, string>): string {
  const { standardCode = '', standardTitle = '' } = params;

  switch (action) {
    case 'explanation': {
      const { diagnosticClassification = '', studentResponse = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

The student just completed a diagnostic assessment. Here is the data from their performance:

What they wrote or selected: "${studentResponse}"
Cognitive breakdown identified: ${diagnosticClassification}

Your task: Deliver a warm, specific explanation of exactly what cognitive skill broke down in the student's response. Do not be generic. Address this student's specific failure directly — what they tried to do, where the thinking went sideways, and why.

Then connect this skill directly to their real life. What does someone who can actually do this skill get to do in the world that someone who can't doesn't? Be concrete. Be specific. Make it real — not abstract, not academic.

End with one sentence of belief — not cheerleading, but genuine: you see exactly what happened and you know this student can correct it.

Keep your response to 3-4 short paragraphs. Write directly to the student as "you."`;
    }

    case 'worked_example': {
      return `Standard: ${standardCode} — ${standardTitle}

Your task: Model the complete cognitive skill required by this standard using a short, original passage (4-6 sentences). Then walk through the complete think-aloud — show every step of the reasoning process as if you are thinking out loud from inside a reader's mind.

Requirements:
- The passage must be original and relevant to a 9th grader's world
- The think-aloud must be explicit: show the questions you ask yourself, what you notice in the text, and how you move from evidence to conclusion
- Do NOT tell the student to "notice" things — show them what noticing looks like from inside a reader's mind
- End with one specific sentence connecting this thinking skill to something concrete in their life outside of school

Format your response exactly as:
**Passage:**
[the passage text]

**Think-Aloud:**
[the complete step-by-step reasoning]

**What This Means for You:**
[the real-life connection — specific, not academic]`;
    }

    case 'guided_evidence': {
      const { passageText = '' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

Passage:
"${passageText}"

The student is about to attempt a written response applying this standard to this passage.

Your task: Identify and quote 2-3 specific pieces of textual evidence from the passage that are most directly relevant to applying this standard. Do NOT tell the student what the evidence means or what conclusion to draw — just surface the evidence and name why each piece is worth examining.

Format exactly as:
**Relevant Evidence:**

1. "[direct quote from passage]" — [one sentence on why this is worth examining, not what it means]
2. "[direct quote from passage]" — [one sentence on why this is worth examining]
3. "[direct quote from passage]" — [one sentence on why this is worth examining]

Keep it tight. The student does the thinking.`;
    }

    case 'evaluate_guided': {
      const { passageText = '', studentResponse = '', attemptNumber = '1' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

Passage the student was responding to:
"${passageText}"

The student wrote (attempt ${attemptNumber}):
"${studentResponse}"

Mastery criteria: The student demonstrates understanding of ${standardTitle} by making a specific claim supported by at least one direct reference to the text. The claim must go beyond surface-level plot summary.

Evaluate this response. Determine whether mastery criteria are met.

Respond directly to the student:
1. Start by acknowledging specifically what they actually wrote — name the exact move they tried to make
2. If mastery NOT met: identify exactly what is working and exactly what is missing. Do not give them the answer. Give them the precise next move to try. Reference their specific words.
3. If mastery IS met: name exactly what their brain just did — the specific cognitive move they executed — and connect it to something real and concrete in their life.

Start your response with either "MASTERY: YES" or "MASTERY: NO" on its own line, then a blank line, then your message to the student.`;
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
      const { passageText = '', passageQuestion = '', studentResponse = '', attemptNumber = '1' } = params;
      return `Standard: ${standardCode} — ${standardTitle}

Passage:
"${passageText}"

Question asked:
"${passageQuestion}"

The student wrote (attempt ${attemptNumber}):
"${studentResponse}"

Precision Protocol — Mastery criteria: The student demonstrates mastery of ${standardTitle} when they: (1) make a clear, specific claim about the text that goes beyond plot summary, (2) support that claim with at least one direct textual reference, and (3) show reasoning that explicitly connects the evidence to the claim.

Evaluate whether ALL three criteria are met.

Respond directly to the student:
1. Reference specifically what they wrote — their exact words matter
2. If mastery NOT met: identify precisely where the reasoning breaks down. Name the specific thinking move they are missing. Do NOT give the answer. Tell them exactly what to try next.
3. If mastery IS met: name the exact cognitive move they just executed and connect it specifically to real power in their life — in a job interview, in a relationship, reading a contract, understanding a news story. Be concrete and specific to this standard and this moment.

Start with "MASTERY: YES" or "MASTERY: NO" on its own line, blank line, then your message.`;
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

Evaluate and respond directly to the student. Be brief — 2-3 sentences. Reference their specific words. If mastery is met, name the precise cognitive move. If not, name exactly what is missing without giving the answer.

Start with "MASTERY: YES" or "MASTERY: NO" on its own line, blank line, then your brief message.`;
    }

    default:
      return '';
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body as { action: ClaudeAction } & Record<string, string>;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const prompt = buildPrompt(action, params);
    if (!prompt) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
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
