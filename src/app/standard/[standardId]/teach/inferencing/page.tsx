'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import {
  TeachNav, GogiAvatar, GogiBubble, TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';
import { useTriggerQuestion, type TriggerQuestion } from '@/hooks/useTriggerQuestion';

// ─── Types ────────────────────────────────────────────────────────────────────

type Branch = 'inferencing_literal' | 'inferencing_schema' | 'inferencing_wm';
type Slot   = 'A' | 'B' | 'C';

// Card 2 (Watch Me Do It) slot data — teaching anchors, always hardcoded
interface LiteralSlotData {
  passageTitle:    string;
  modelPassage:    string;
  modelThinkAloud: string;
  modelDiagram:    { left: string; right: string };
}

interface SchemaSlotData {
  passageTitle:     string;
  modelPassage:     string;
  modelThinkAloud:  string;
  modelPredictions: { text: string; verified: boolean }[];
}

interface WMSlotData {
  passageTitle:    string;
  modelPassage:    string;
  modelThinkAloud: string;
  modelPair:       { a: string; aSub: string; b: string; bSub: string; label: string };
}

// ─── Branch concept copy (Card 1) ─────────────────────────────────────────────

const LITERAL_CONCEPT = {
  moveName:     'The Says → Means move',
  moveShort:    'Says → Means',
  partOneBody:  `Sometimes the author tells you something flat-out. Sometimes they don't — they leave clues and make you figure it out. That second part has a name: <em>inference</em>. You use what the text <em>says</em> to decide what it <em>means</em>.`,
  partOneBottom:`Every inferencing question you hit is this same move. Find what the text <em>says</em>. Decide what it <em>means</em>. Your brain fills the arrow between them — that's the reading work.`,
};

const SCHEMA_CONCEPT = {
  moveName:     'The Predict → Verify move',
  moveShort:    'Predict → Verify',
  partOneBody:  `Your brain already knows things. Before you read, you can use what you know about the world to predict what might happen. Then you read and verify — did your prediction match?`,
  partOneBottom:`The predicting is the real work. Good readers are guessing the whole time they read — then checking. You're not cheating; you're thinking.`,
};

const WM_CONCEPT = {
  moveName:     'The Track the Pair move',
  moveShort:    'Track the Pair',
  partOneBody:  `When a story has two people who matter, your brain can lose one while focusing on the other. Don't try to hold both in your head. Track the pair on paper: two characters, one label for the relationship. That way when the story moves, you don't drop anyone.`,
  partOneBottom:`The label you pick is an inference. What does what they <em>do</em> tell you about how they <em>feel</em> about each other?`,
};

// ─── Card 2 model passage data (hardcoded teaching anchors) ───────────────────

const LITERAL: Record<Slot, LiteralSlotData> = {
  A: {
    passageTitle:    'After Twenty Years — O. Henry',
    modelPassage:    `<p>Bob read the note under the streetlamp. His hand began to tremble.</p>
<p><em>"Bob: I was at the appointed place on time. When you struck the match, I saw it was the face of the man wanted in Chicago. Somehow I couldn't do it myself, so I went around and got a plain-clothes man to do the job. — JIMMY."</em></p>`,
    modelThinkAloud: `Watch me work this one. The text says Jimmy walked away and sent another officer to do the arrest — straight out. Here's where my brain starts working. A cop walking away from an arrest is strange. His job is to make the arrest. But he didn't. If they'd been best friends for twenty years, walking away starts to mean something. He still cared about Bob — enough that he couldn't be the one to do it. The text never wrote that last part. I did. That's inferencing.`,
    modelDiagram:    { left: 'walked away and sent another officer', right: 'still cared about his old friend' },
  },
  B: {
    passageTitle:    'Mammon and the Archer — O. Henry',
    modelPassage:    `<p>Anthony Rockwall counted ten new fifty-dollar bills. He handed them to a stranger he had called to his library window.</p>
<p>"I want this street blocked," he said quietly. "Both ends. Cabs, wagons, whatever you need. For twelve minutes, starting at eight o'clock. Nothing gets through."</p>
<p>The man pocketed the bills without a word. Anthony watched him go, then picked up his detective novel and went on reading.</p>`,
    modelThinkAloud: `Watch me work. The text says Anthony blocked a city street — paid for it, planned it, then went back to his book like he'd ordered a cup of coffee. That's unusual. Blocking traffic is a strange thing to arrange. His son Richard was on that street, trying to get to the woman he loved before she sailed for Europe. So here's the inference: Anthony went through enormous effort for Richard and then acted like it cost him nothing. That cool attitude — back to the detective novel — tells me he loves his son enough to move city traffic. The text never says love. I said it. That's the move.`,
    modelDiagram:    { left: 'handed money, then went back to reading', right: 'loves his son but refuses to make a fuss about it' },
  },
  C: {
    passageTitle:    'Mammon and the Archer — O. Henry',
    modelPassage:    `<p>Anthony Rockwall, retired soap manufacturer, had a system. When his son Richard came to him looking miserable, Anthony already had an opinion.</p>
<p>"Love!" said Anthony. "I tell you, love is a business proposition. You've got to spend money on it. When you want a thing, you buy it."</p>
<p>"Dad," said Richard quietly, "you can't buy Miss Lantry."</p>
<p>Anthony turned back to his window. He said nothing. But his jaw was set in a way his cook Mike had learned, over thirty years, to recognize.</p>`,
    modelThinkAloud: `Watch me work. The text says Anthony announces that love is a business proposition. Richard pushes back: you can't buy Miss Lantry. And then Anthony goes silent. His jaw sets. Here's where the inference is. A man who believed what he just said would argue back. He doesn't. He turns to the window. That jaw — tight, quiet — tells me he heard Richard's pushback and isn't sure he's right anymore. The text says he went silent. That means the certainty he just performed might not be as solid as it sounded. I inferred doubt. The text never said doubt. That's the move.`,
    modelDiagram:    { left: 'said nothing; jaw set tight', right: "his certainty about money cracked — he isn't sure anymore" },
  },
};

const SCHEMA: Record<Slot, SchemaSlotData> = {
  A: {
    passageTitle:    'The Gift of the Magi — O. Henry',
    modelPassage:    `<p>One dollar and eighty-seven cents. That was all Della had. Three times she counted it... Della had two possessions in which she took a mighty pride — one was Jim's gold watch that had been his father's, and the other was Della's beautiful long hair.</p>`,
    modelThinkAloud: `Before I even finish reading, my brain starts predicting. She has two prized possessions — a watch that's Jim's, and her own hair. One of those is sellable. So I predict: Della will sell her hair to buy Jim a Christmas gift. Now when I read the next paragraph — boom, there it is. My prediction was close, and because I predicted it, I understand why she does it.`,
    modelPredictions: [
      { text: "Della will sell her hair to buy Jim a gift", verified: true  },
      { text: "Jim will get angry about the hair",         verified: false },
      { text: "Someone will get hurt",                     verified: false },
      { text: "Jim will also make a sacrifice",            verified: true  },
    ],
  },
  B: {
    passageTitle:    'The Cop and the Anthem — O. Henry',
    modelPassage:    `<p>Soapy moved off the bench and began his plan. He went into a restaurant on Broadway and ordered the most expensive steak on the menu. After he ate it, he would tell the waiter he had no money. That would bring the police, and then the island — warm meals, a bed, no wind.</p>
<p>The head waiter studied Soapy's frayed trousers and his broken shoes. Without a word, he called two waiters, who removed Soapy, quietly and with speed, to the sidewalk.</p>`,
    modelThinkAloud: `Before I read what happens, my brain predicts: Soapy eats the steak, tells them he can't pay, the restaurant calls the cops, he gets arrested. That's the natural outcome. Now I read... and the waiter doesn't even call the cops. He just throws him out. My prediction was wrong — and because I predicted it, I understand the joke. Soapy can't even get arrested. When my prediction fails, that's a signal the author is doing something on purpose.`,
    modelPredictions: [
      { text: "The restaurant calls the police on Soapy",   verified: false },
      { text: "Soapy is thrown out without being arrested", verified: true  },
      { text: "The waiter is fooled by Soapy's plan",      verified: false },
      { text: "Soapy does not reach the island this way",  verified: true  },
    ],
  },
  C: {
    passageTitle:    'Mammon and the Archer — O. Henry',
    modelPassage:    `<p>Richard Rockwall left the house at seven in a cab. He had twenty minutes to reach Miss Lantry's home, make his declaration, and return her answer — or she would sail tomorrow and the chance would be gone.</p>
<p>The cab moved one block in fifteen minutes. Broadway was blocked solid — wagons, streetcars, the whole city jammed. Richard looked at his watch.</p>`,
    modelThinkAloud: `My brain starts predicting the moment I read the deadline. Twenty minutes, one block in fifteen — I predict Richard is going to miss his chance. The traffic is too bad. Now I read on... and something is too convenient about this jam. I start revising my prediction: someone arranged this. If the traffic isn't random, then Richard might get his chance anyway — just not the way he planned. When a detail is too convenient, good readers adjust their predictions.`,
    modelPredictions: [
      { text: "Richard reaches Miss Lantry's house on time",  verified: false },
      { text: "Richard speaks to her inside the traffic jam", verified: true  },
      { text: "The traffic was a coincidence",                verified: false },
      { text: "Richard misses his chance entirely",          verified: false },
    ],
  },
};

const WM: Record<Slot, WMSlotData> = {
  A: {
    passageTitle:    'The Gift of the Magi — O. Henry',
    modelPassage:    `<p>Jim drew a package from his overcoat pocket and threw it upon the table. "Don't make any mistake, Dell," he said, "about me. I don't think there's anything in the way of a haircut or a shave or a shampoo that could make me like my girl any less. But if you'll unwrap that package you may see why you had me going for a while."</p>
<p>White fingers and nimble tore at the string and paper. And then an ecstatic scream of joy; and then, alas! a quick feminine change to hysterical tears and wails — for there lay The Combs...</p>`,
    modelThinkAloud: `Track these two. Della is the wife — the one I just watched cut off her hair. Jim is the husband — he just walked in and gave her the combs she'd always wanted. What's the relationship line between them? Della sold her hair for Jim's gift. Jim sold his watch for Della's gift. They each gave up what they treasured most for the other one. That's the label: love each other enough to sacrifice. I'll hold that label as I read the rest.`,
    modelPair: { a: 'Della', aSub: 'the wife', b: 'Jim', bSub: 'the husband', label: 'love each other enough to sacrifice' },
  },
  B: {
    passageTitle:    'After Twenty Years — O. Henry',
    modelPassage:    `<p>The policeman walked his beat slowly. At the doorway, a man stood with an unlighted cigar in his mouth.</p>
<p>"It's all right, officer," he said. "I'm just waiting for a friend. Twenty years ago tonight we agreed to meet at this exact spot. Jimmy Wells was my best friend in the world."</p>
<p>"That's a good while," said the policeman thoughtfully. "Sometimes things change a man."</p>`,
    modelThinkAloud: `Two characters, one scene. Track them. The waiting man — call him Bob — is loyal to a twenty-year-old promise. The policeman is careful, almost warning him: "sometimes things change a man." I need a label for their relationship. They're strangers on the surface. But Bob trusted this spot enough to travel a thousand miles for it. The policeman knows something — the way he says that line feels deliberate. Label: old friends who have grown in opposite directions. I hold that label. Watch what it does to the ending.`,
    modelPair: { a: 'Bob', aSub: 'the man waiting', b: 'Jimmy', bSub: 'the policeman', label: 'old friends grown in opposite directions' },
  },
  C: {
    passageTitle:    'The Last Leaf — O. Henry',
    modelPassage:    `<p>Sue came to the doorway of Johnsy's room and looked in. Johnsy lay in bed, watching the window. Outside, the ivy vine clung to the old brick wall, and its leaves were almost all gone.</p>
<p>"The last one will fall today," said Johnsy quietly. "Then I'll go, too."</p>
<p>Sue stepped back into the hallway. She stood there for a moment, her hand flat against the wall. Then she went to find her paintbrushes and began to hum a tune — loudly, so Johnsy could hear through the door.</p>`,
    modelThinkAloud: `Two people, one moment. Track them. Johnsy is in bed, watching the ivy, speaking as if she has decided something. Sue hears that. Now watch Sue: she steps back, stands in the hall, hand flat on the wall. That pause is not nothing. Then she picks up her brushes and hums — loudly, on purpose. She's performing calm she doesn't feel. The label I need: Sue is protecting Johnsy by hiding how frightened she is. The text says she hummed loudly. That means the fear she's covering is just as loud. I hold that label as I read the rest.`,
    modelPair: { a: 'Sue', aSub: 'hiding her fear', b: 'Johnsy', bSub: 'who cannot see it', label: 'Sue is protecting Johnsy by hiding how frightened she is' },
  },
};

// ─── Shared validation ────────────────────────────────────────────────────────

function minWords(s: string, n: number): boolean {
  return s.trim().split(/\s+/).filter(Boolean).length >= n;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function MovePill({ name }: { name: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: C.navy, color: C.white,
      borderRadius: 20, padding: '5px 14px',
      fontSize: 12, fontWeight: 700, fontFamily: FONTS.ui,
      letterSpacing: 0.3, marginBottom: 14,
    }}>
      <span style={{ fontSize: 10, color: C.blueMid, textTransform: 'uppercase', letterSpacing: 1.5 }}>MOVE</span>
      {name}
    </div>
  );
}

function ModelPassageHTML({ html }: { html: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8, color: C.dark,
        background: C.light, borderLeft: `3px solid ${C.blueMid}`,
        borderRadius: '0 6px 6px 0', padding: '10px 14px', margin: '10px 0',
      }}
    />
  );
}

// Renders the live passage fetched from the database
function TriggerPassagePanel({
  triggerQ,
  loading,
}: {
  triggerQ: TriggerQuestion | null;
  loading:  boolean;
}) {
  if (loading) {
    return (
      <div style={{ color: C.gray, fontSize: 12, fontStyle: 'italic' }}>
        Loading your passage…
      </div>
    );
  }
  if (!triggerQ) {
    return (
      <div style={{
        background: C.redLight, border: `1px solid ${C.red}`,
        borderRadius: 6, padding: '10px 12px', fontSize: 12, color: C.red,
      }}>
        Could not load your passage. Go back to the dashboard and try again.
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
        YOUR PASSAGE
      </div>
      <div style={{ fontSize: 11, color: C.dark, fontWeight: 600, marginBottom: 2 }}>{triggerQ.passageTitle}</div>
      <div style={{ fontSize: 10, color: C.gray, fontStyle: 'italic', marginBottom: 12 }}>{triggerQ.passageAuthor}</div>
      <div style={{
        fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8,
        color: C.dark, whiteSpace: 'pre-wrap',
      }}>
        {triggerQ.passageText}
      </div>
    </div>
  );
}

// ─── Card 1: Name the Move ────────────────────────────────────────────────────

function Card1({ moveName, partOneBody, partOneBottom, diagram, onNext }: {
  moveName:      string;
  partOneBody:   string;
  partOneBottom: string;
  diagram:       React.ReactNode;
  onNext:        () => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
        STEP 1 OF 3 — NAME THE MOVE
      </div>
      <MovePill name={moveName} />
      <p
        dangerouslySetInnerHTML={{ __html: partOneBody }}
        style={{ fontSize: 13, color: C.dark, lineHeight: 1.7, margin: '0 0 14px' }}
      />
      {diagram}
      <p
        dangerouslySetInnerHTML={{ __html: partOneBottom }}
        style={{ fontSize: 13, color: C.dark, lineHeight: 1.7, margin: '14px 0 18px' }}
      />
      <button
        onClick={onNext}
        style={{
          background: C.navy, color: C.white, border: 'none', borderRadius: 8,
          padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: FONTS.ui, width: '100%',
        }}
      >
        Watch me do it →
      </button>
    </div>
  );
}

// ─── Card 2: Watch Me Do It ───────────────────────────────────────────────────

function Card2({ modelPassage, modelThinkAloud, modelVisual, onNext }: {
  modelPassage:    string;
  modelThinkAloud: string;
  modelVisual:     React.ReactNode;
  onNext:          () => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
        STEP 2 OF 3 — WATCH ME DO IT
      </div>
      <div style={{ fontSize: 11, color: C.gray, marginBottom: 10 }}>Read the passage, then watch how I apply the move.</div>
      <ModelPassageHTML html={modelPassage} />
      {modelVisual}
      <div style={{
        background: C.blueLight, border: `1px solid ${C.blueMid}`,
        borderRadius: 8, padding: '12px 14px', margin: '14px 0',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          GOGI&rsquo;S THINK-ALOUD
        </div>
        <p style={{ fontSize: 13, color: C.dark, lineHeight: 1.7, margin: 0 }}>
          {modelThinkAloud}
        </p>
      </div>
      <button
        onClick={onNext}
        style={{
          background: C.navy, color: C.white, border: 'none', borderRadius: 8,
          padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: FONTS.ui, width: '100%',
        }}
      >
        Try it with me →
      </button>
    </div>
  );
}

// ─── Diagrams ─────────────────────────────────────────────────────────────────

function DiagramArrows({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', margin: '14px 0' }}>
      <div style={{ background: C.blueLight, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Says</div>
        <div style={{ fontSize: 12, color: C.dark }}>{left}</div>
      </div>
      <div style={{ textAlign: 'center', color: C.blue, fontSize: 18 }}>→</div>
      <div style={{ background: C.blueLight, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Means</div>
        <div style={{ fontSize: 12, color: C.dark }}>{right}</div>
      </div>
    </div>
  );
}

function DiagramPredict({ predictions }: { predictions: { text: string; verified: boolean }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '14px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1 }}>Predict</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1 }}>Verified?</div>
      </div>
      {predictions.map((p, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr auto',
          background: C.light, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: '8px 10px', gap: 8, alignItems: 'center',
        }}>
          <div style={{ fontSize: 12, color: C.dark }}>{p.text}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.verified ? C.green : C.gray }}>
            {p.verified ? '✓' : '✗'}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiagramPair({ a, aSub, b, bSub, label }: {
  a: string; aSub: string; b: string; bSub: string; label: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '14px 0' }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: `2px solid ${C.blue}`, background: C.blueLight,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{a}</div>
          <div style={{ fontSize: 9, color: C.gray }}>{aSub}</div>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', height: 2, background: C.blueMid, margin: '0 -1px' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: C.navy, color: C.white, borderRadius: 20,
          padding: '4px 10px', fontSize: 10, fontWeight: 700,
          whiteSpace: 'nowrap', maxWidth: 140, textAlign: 'center',
        }}>
          {label}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: `2px solid ${C.blue}`, background: C.blueLight,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{b}</div>
          <div style={{ fontSize: 9, color: C.gray }}>{bSub}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Card 3: passage-agnostic interactions ─────────────────────────────────────
//
// All three interactions work against whatever passage triggerQ returns.
// No correct/wrong gating — completion-gated. Feedback teaches the move,
// not the story.

// ── inferencing_literal: Says textarea + Means chip ──────────────────────────

const MEANS_CHIPS = [
  'a feeling the character hasn\'t said out loud',
  'something the character wants but won\'t admit',
  'what this character truly values',
  'a decision that has already been made',
];

function Card3Literal({ onDone }: { onDone: (response: string) => void }) {
  const [saysText,  setSaysText]  = useState('');
  const [meansChip, setMeansChip] = useState('');
  const [done,      setDone]      = useState(false);

  const canSubmit = minWords(saysText, 5) && !!meansChip;

  function handleSubmit() {
    if (!canSubmit || done) return;
    setDone(true);
    onDone(`${saysText.trim()} | ${meansChip}`);
  }

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
        STEP 3 OF 3 — TRY IT WITH ME
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
        Read the passage on the left. Apply the Says → Means move.
      </div>

      {/* Says box */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          What does the text SAY?
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>
          Find a line the text states directly. Write or paraphrase it here.
        </div>
        <textarea
          value={saysText}
          onChange={e => setSaysText(e.target.value)}
          disabled={done}
          placeholder="The text says…"
          style={{
            width: '100%', minHeight: 70, boxSizing: 'border-box',
            fontFamily: FONTS.ui, fontSize: 13, color: C.dark,
            border: `1.5px solid ${minWords(saysText, 5) ? C.green : C.border}`,
            borderRadius: 8, padding: '8px 10px', resize: 'none', outline: 'none',
            background: done ? C.light : C.white, transition: 'border-color 0.15s',
          }}
        />
      </div>

      <div style={{ textAlign: 'center', color: C.blue, fontSize: 18, marginBottom: 10 }}>↓</div>

      {/* Means chips */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          What does that MEAN? (pick one)
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginBottom: 8 }}>
          What does that line tell you that the text never states out loud?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MEANS_CHIPS.map(chip => {
            const sel = meansChip === chip;
            return (
              <button
                key={chip}
                onClick={() => !done && setMeansChip(prev => prev === chip ? '' : chip)}
                style={{
                  background: sel ? C.navy : C.white,
                  color:      sel ? C.white : C.dark,
                  border:     `1px solid ${sel ? C.navy : C.border}`,
                  borderRadius: 20, padding: '8px 14px', fontSize: 12,
                  cursor: done ? 'default' : 'pointer', fontFamily: FONTS.ui,
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {!done && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? C.blue : C.border, color: C.white,
            border: 'none', borderRadius: 8, padding: '10px 16px',
            fontSize: 13, fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: FONTS.ui, width: '100%', transition: 'background 0.15s',
          }}
        >
          Apply the move →
        </button>
      )}

      {done && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <GogiAvatar size={28} state="celebrate" />
          <GogiBubble state="celebrate">
            That&rsquo;s the move. The text told you one thing directly, and your brain did the
            work to figure out what it meant. That&rsquo;s inferencing — same move, every time.
          </GogiBubble>
        </div>
      )}
    </div>
  );
}

// ── inferencing_schema: schema chip → prediction → verify ────────────────────

const SCHEMA_CHIPS = [
  'When someone wants something badly, they\'ll take risks',
  'Small details at the start often predict what happens later',
  'When two people want different things, one usually gives in',
  'When time is running out, characters make fast decisions',
];

const VERIFY_CHIPS = [
  'My prediction matched — the passage confirmed it',
  'Part of my prediction was right',
  'The passage surprised me — something different happened',
];

function Card3Schema({ onDone }: { onDone: (response: string) => void }) {
  const [schemaChip,  setSchemaChip]  = useState('');
  const [prediction,  setPrediction]  = useState('');
  const [verifyChip,  setVerifyChip]  = useState('');
  const [done,        setDone]        = useState(false);

  const step1Done = !!schemaChip;
  const step2Done = step1Done && minWords(prediction, 5);
  const step3Done = step2Done && !!verifyChip;

  function handleSubmit() {
    if (!step3Done || done) return;
    setDone(true);
    onDone(`${schemaChip} → ${prediction.trim()} | ${verifyChip}`);
  }

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
        STEP 3 OF 3 — TRY IT WITH ME
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
        Read the passage on the left. Apply the Predict → Verify move.
      </div>

      {/* Step 1: Schema activation */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Step 1 — What do you already know?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {SCHEMA_CHIPS.map(chip => {
            const sel = schemaChip === chip;
            return (
              <button
                key={chip}
                onClick={() => !done && setSchemaChip(prev => prev === chip ? '' : chip)}
                style={{
                  background: sel ? C.navy : C.white,
                  color:      sel ? C.white : C.dark,
                  border:     `1px solid ${sel ? C.navy : C.border}`,
                  borderRadius: 20, padding: '7px 14px', fontSize: 12,
                  cursor: done ? 'default' : 'pointer', fontFamily: FONTS.ui,
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Prediction */}
      {step1Done && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Step 2 — Based on that, I predict…
          </div>
          <textarea
            value={prediction}
            onChange={e => setPrediction(e.target.value)}
            disabled={done}
            placeholder="I predict that…"
            style={{
              width: '100%', minHeight: 60, boxSizing: 'border-box',
              fontFamily: FONTS.ui, fontSize: 13, color: C.dark,
              border: `1.5px solid ${minWords(prediction, 5) ? C.green : C.border}`,
              borderRadius: 8, padding: '8px 10px', resize: 'none', outline: 'none',
              background: done ? C.light : C.white, transition: 'border-color 0.15s',
            }}
          />
        </div>
      )}

      {/* Step 3: Verify */}
      {step2Done && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Step 3 — After reading: did the passage confirm your prediction?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {VERIFY_CHIPS.map(chip => {
              const sel = verifyChip === chip;
              return (
                <button
                  key={chip}
                  onClick={() => !done && setVerifyChip(prev => prev === chip ? '' : chip)}
                  style={{
                    background: sel ? C.navy : C.white,
                    color:      sel ? C.white : C.dark,
                    border:     `1px solid ${sel ? C.navy : C.border}`,
                    borderRadius: 20, padding: '7px 14px', fontSize: 12,
                    cursor: done ? 'default' : 'pointer', fontFamily: FONTS.ui,
                    transition: 'all 0.15s', textAlign: 'left',
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step3Done && !done && (
        <button
          onClick={handleSubmit}
          style={{
            background: C.blue, color: C.white,
            border: 'none', borderRadius: 8, padding: '10px 16px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: FONTS.ui, width: '100%',
          }}
        >
          Apply the move →
        </button>
      )}

      {done && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <GogiAvatar size={28} state="celebrate" />
          <GogiBubble state="celebrate">
            That&rsquo;s the move. You used what you already knew to predict — then you checked.
            Good readers do this the whole time they read. The predicting is the real work.
          </GogiBubble>
        </div>
      )}
    </div>
  );
}

// ── inferencing_wm: character names + label chip ──────────────────────────────

const WM_LABEL_CHIPS = [
  'one is protecting the other',
  'they depend on each other',
  'they want different things from each other',
  'one knows something the other doesn\'t',
  'they\'ve each given something up for the other',
];

function Card3WM({ onDone }: { onDone: (response: string) => void }) {
  const [char1,     setChar1]     = useState('');
  const [char2,     setChar2]     = useState('');
  const [labelChip, setLabelChip] = useState('');
  const [done,      setDone]      = useState(false);

  const charsFilled = char1.trim().length > 0 && char2.trim().length > 0;
  const canSubmit   = charsFilled && !!labelChip;

  function handleSubmit() {
    if (!canSubmit || done) return;
    setDone(true);
    onDone(`${char1.trim()} + ${char2.trim()} | ${labelChip}`);
  }

  const inputStyle: React.CSSProperties = {
    border: `1.5px solid ${C.border}`, borderRadius: 8,
    padding: '7px 10px', fontSize: 13, fontFamily: FONTS.ui,
    color: C.dark, outline: 'none', background: done ? C.light : C.white,
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
        STEP 3 OF 3 — TRY IT WITH ME
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
        Read the passage on the left. Track the two main characters.
      </div>

      {/* Character pair inputs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Who are the two main characters?
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Character 1</div>
            <input
              type="text"
              value={char1}
              onChange={e => setChar1(e.target.value)}
              disabled={done}
              placeholder="Name or description"
              style={inputStyle}
            />
          </div>
          <div style={{ color: C.blueMid, fontSize: 16, flexShrink: 0, paddingTop: 16 }}>↔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Character 2</div>
            <input
              type="text"
              value={char2}
              onChange={e => setChar2(e.target.value)}
              disabled={done}
              placeholder="Name or description"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Label chips */}
      {charsFilled && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            What&rsquo;s the relationship between them?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {WM_LABEL_CHIPS.map(chip => {
              const sel = labelChip === chip;
              return (
                <button
                  key={chip}
                  onClick={() => !done && setLabelChip(prev => prev === chip ? '' : chip)}
                  style={{
                    background: sel ? C.navy : C.white,
                    color:      sel ? C.white : C.dark,
                    border:     `1px solid ${sel ? C.navy : C.border}`,
                    borderRadius: 20, padding: '7px 14px', fontSize: 12,
                    cursor: done ? 'default' : 'pointer', fontFamily: FONTS.ui,
                    transition: 'all 0.15s', textAlign: 'left',
                    opacity: done && !sel ? 0.4 : 1,
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canSubmit && !done && (
        <button
          onClick={handleSubmit}
          style={{
            background: C.blue, color: C.white,
            border: 'none', borderRadius: 8, padding: '10px 16px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: FONTS.ui, width: '100%',
          }}
        >
          Apply the move →
        </button>
      )}

      {done && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <GogiAvatar size={28} state="celebrate" />
          <GogiBubble state="celebrate">
            Pair tracked. When you know who both people are and what connects them,
            you don&rsquo;t lose either one when the story moves. Hold that label —
            it&rsquo;s your inference about the relationship.
          </GogiBubble>
        </div>
      )}
    </div>
  );
}

// ─── Branch render ────────────────────────────────────────────────────────────

function getMoveShort(branch: Branch): string {
  if (branch === 'inferencing_literal') return LITERAL_CONCEPT.moveShort;
  if (branch === 'inferencing_schema')  return SCHEMA_CONCEPT.moveShort;
  return WM_CONCEPT.moveShort;
}

function renderBranchCards(
  branch:         Branch,
  slot:           Slot,
  card:           number,
  triggerQ:       TriggerQuestion | null,
  passageLoading: boolean,
  onNext:         () => void,
  onCard3Done:    (response: string) => void,
): React.ReactNode {
  // ── inferencing_literal ──
  if (branch === 'inferencing_literal') {
    const s = LITERAL[slot];
    if (card === 1) return (
      <Card1
        moveName={LITERAL_CONCEPT.moveName}
        partOneBody={LITERAL_CONCEPT.partOneBody}
        partOneBottom={LITERAL_CONCEPT.partOneBottom}
        diagram={<DiagramArrows left="What the text literally wrote." right="What the text hints at but never comes out and says." />}
        onNext={onNext}
      />
    );
    if (card === 2) return (
      <Card2
        modelPassage={s.modelPassage}
        modelThinkAloud={s.modelThinkAloud}
        modelVisual={<DiagramArrows left={s.modelDiagram.left} right={s.modelDiagram.right} />}
        onNext={onNext}
      />
    );
    if (passageLoading) return <div style={{ color: C.gray, fontSize: 13 }}>Loading your passage…</div>;
    if (!triggerQ)      return <div style={{ color: C.red,  fontSize: 13 }}>Could not load passage. Please return to the dashboard and try again.</div>;
    return <Card3Literal onDone={onCard3Done} />;
  }

  // ── inferencing_schema ──
  if (branch === 'inferencing_schema') {
    const s = SCHEMA[slot];
    if (card === 1) return (
      <Card1
        moveName={SCHEMA_CONCEPT.moveName}
        partOneBody={SCHEMA_CONCEPT.partOneBody}
        partOneBottom={SCHEMA_CONCEPT.partOneBottom}
        diagram={
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }}>
            {(['Predict', 'Verify'] as const).map(lbl => (
              <div key={lbl} style={{ background: C.blueLight, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontSize: 11, color: C.dark }}>
                  {lbl === 'Predict' ? 'Use what you know to guess what happens next.' : 'Read — then check if your guess was right.'}
                </div>
              </div>
            ))}
          </div>
        }
        onNext={onNext}
      />
    );
    if (card === 2) return (
      <Card2
        modelPassage={s.modelPassage}
        modelThinkAloud={s.modelThinkAloud}
        modelVisual={<DiagramPredict predictions={s.modelPredictions} />}
        onNext={onNext}
      />
    );
    if (passageLoading) return <div style={{ color: C.gray, fontSize: 13 }}>Loading your passage…</div>;
    if (!triggerQ)      return <div style={{ color: C.red,  fontSize: 13 }}>Could not load passage. Please return to the dashboard and try again.</div>;
    return <Card3Schema onDone={onCard3Done} />;
  }

  // ── inferencing_wm ──
  const s = WM[slot];
  if (card === 1) return (
    <Card1
      moveName={WM_CONCEPT.moveName}
      partOneBody={WM_CONCEPT.partOneBody}
      partOneBottom={WM_CONCEPT.partOneBottom}
      diagram={
        <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0' }}>
          {[{ name: 'Character A', sub: 'first person' }, { name: 'Character B', sub: 'second person' }].map((char, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i === 1 ? 1 : '0 0 auto' }}>
              {i === 1 && (
                <div style={{ flex: 1, height: 2, background: C.blueMid, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: C.navy, color: C.white, borderRadius: 20, padding: '3px 8px', fontSize: 9, fontWeight: 700 }}>
                    relationship label
                  </div>
                </div>
              )}
              <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, border: `2px solid ${C.blue}`, background: C.blueLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{char.name}</div>
                <div style={{ fontSize: 9, color: C.gray }}>{char.sub}</div>
              </div>
            </div>
          ))}
        </div>
      }
      onNext={onNext}
    />
  );
  if (card === 2) return (
    <Card2
      modelPassage={s.modelPassage}
      modelThinkAloud={s.modelThinkAloud}
      modelVisual={<DiagramPair a={s.modelPair.a} aSub={s.modelPair.aSub} b={s.modelPair.b} bSub={s.modelPair.bSub} label={s.modelPair.label} />}
      onNext={onNext}
    />
  );
  if (passageLoading) return <div style={{ color: C.gray, fontSize: 13 }}>Loading your passage…</div>;
  if (!triggerQ)      return <div style={{ color: C.red,  fontSize: 13 }}>Could not load passage. Please return to the dashboard and try again.</div>;
  return <Card3WM onDone={onCard3Done} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeachInferencingPage() {
  const params       = useParams<{ standardId: string }>();
  const router       = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [studentId,     setStudentId]     = useState('');
  const [standardUuid,  setStandardUuid]  = useState('');
  const [sessionId,     setSessionId]     = useState('');
  const [branch,        setBranch]        = useState<Branch>('inferencing_literal');
  const [slot,          setSlot]          = useState<Slot>('A');
  const [initError,     setInitError]     = useState(false);
  const [initDone,      setInitDone]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  // Card state
  const [card,          setCard]          = useState(1);
  const [card3Done,     setCard3Done]     = useState(false);
  const [card3Response, setCard3Response] = useState('');
  const [card3Tries,    setCard3Tries]    = useState(0);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();

        const { data: student } = await supabase
          .from('students').select('id').eq('user_id', user!.id).maybeSingle();
        const sid = student?.id ?? '';
        setStudentId(sid);

        const { data: std } = await supabase
          .from('standards').select('id').eq('code', standardCode).maybeSingle();
        if (!std?.id) { setInitError(true); setInitDone(true); return; }
        setStandardUuid(std.id);

        if (!sid) { setInitDone(true); return; }

        const [sessionRes, progressRes, classRes] = await Promise.all([
          supabase.from('sessions').select('id')
            .eq('student_id', sid).eq('standard_id', std.id)
            .order('started_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('standard_progress').select('sessions_attempted')
            .eq('student_id', sid).eq('standard_id', std.id).maybeSingle(),
          supabase.from('responses').select('diagnostic_classification')
            .eq('student_id', sid).eq('standard_id', std.id)
            .not('diagnostic_classification', 'is', null)
            .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        if (!sessionRes.data?.id) { setInitError(true); setInitDone(true); return; }
        setSessionId(sessionRes.data.id);

        const attempted = (progressRes.data as { sessions_attempted?: number } | null)?.sessions_attempted ?? 0;
        setSlot(attempted === 0 ? 'A' : attempted === 1 ? 'B' : 'C');

        const rawCode    = classRes.data?.diagnostic_classification ?? '';
        const validCodes: Branch[] = ['inferencing_literal', 'inferencing_schema', 'inferencing_wm'];
        setBranch(validCodes.includes(rawCode as Branch) ? (rawCode as Branch) : 'inferencing_literal');

        setInitDone(true);
      } catch {
        setInitError(true);
        setInitDone(true);
      }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // ── Trigger question — fires only after init resolves branch + studentId ────
  // Pass null until initDone so the hook doesn't fire with the default branch value
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    initDone && studentId ? studentId : null,
    standardCode,
    branch,
  );

  // ── Card 3 completion ───────────────────────────────────────────────────────
  function handleCard3Done(responseText: string) {
    setCard3Done(true);
    setCard3Tries(prev => prev + 1);
    setCard3Response(responseText);
  }

  // ── CTA — write response + navigate ────────────────────────────────────────
  async function handleCTA() {
    if (!card3Done || submitting) return;
    setSubmitting(true);
    try {
      if (sessionId && studentId && standardUuid) {
        await fetch('/api/responses/create', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id:               sessionId,
            student_id:               studentId,
            standard_id:              standardUuid,
            question_id:              triggerQ?.questionId ?? null,
            cognitive_skill_targeted: branch,
            diagnostic_classification:branch,
            intervention_type:        'inferencing_three_part',
            intervention_content:     `${branch} / slot ${slot}`,
            student_response:         card3Response,
            mastery_achieved:         false,
            attempt_number:           card3Tries,
          }),
        });
      }
    } catch {
      // Non-blocking — navigation still proceeds
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // ── Gogi coaching lines ─────────────────────────────────────────────────────
  const coachingLines: string[] = [];
  if (!initDone) {
    coachingLines.push('Getting your session ready…');
  } else if (card === 1) {
    coachingLines.push(`Every inferencing question in the exam uses one of three moves. You're about to learn yours.`);
  } else if (card === 2) {
    coachingLines.push('Watch how I show my thinking. The move is always the same — find what the text says, then decide what it means.');
  } else if (card3Done) {
    coachingLines.push(`You applied the ${getMoveShort(branch)} move to your own passage. That's what inferencing looks like in practice.`);
    coachingLines.push('Practice is next. Same move — new passage. Let\'s lock it in.');
  } else {
    coachingLines.push(`Read the passage on the left. Apply the ${getMoveShort(branch)} move.`);
    coachingLines.push('Take your time. The text gives you everything you need.');
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} navLabel="TEACH PHASE  |  INFERENCING" layerColor={C.greenBorder} />

      {/* Session init error */}
      {initError && (
        <div style={{
          background: C.redLight, border: `1px solid ${C.red}`,
          padding: '12px 20px', fontSize: 13, color: C.red, fontWeight: 600,
        }}>
          Something went wrong loading your session. Please go back to the dashboard and try again.
        </div>
      )}

      <div className="teach-3col">

        {/* ── COL 1: PASSAGE ─────────────────────────────────────────────────── */}
        <div style={{
          flex: '0 0 30%', borderRight: `1px solid ${C.border}`,
          padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box',
        }}>
          {card < 3 ? (
            <div style={{
              background: C.amberLight, border: `1px solid ${C.amber}`,
              borderRadius: 6, padding: '8px 12px', fontSize: 11, color: C.amber,
            }}>
              Your passage will appear here when you reach Step 3.
            </div>
          ) : (
            <TriggerPassagePanel triggerQ={triggerQ} loading={passageLoading} />
          )}
        </div>

        {/* ── COL 2: GOGI COACHING ───────────────────────────────────────────── */}
        <div style={{
          flex: '0 0 28%', borderRight: `1px solid ${C.border}`,
          padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            GOGI COACHING
          </div>

          {coachingLines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <GogiAvatar size={36} state={card3Done ? 'celebrate' : 'engaged'} />
              <GogiBubble state={card3Done ? 'celebrate' : 'engaged'}>{line}</GogiBubble>
            </div>
          ))}

          {/* Progress pips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: n <= card ? C.blue : C.border,
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleCTA}
            disabled={!card3Done || submitting}
            style={{
              width: '100%', background: C.navy, color: C.white, border: 'none',
              borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700,
              cursor: card3Done && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: FONTS.ui, opacity: card3Done && !submitting ? 1 : 0.35,
              transition: 'opacity 0.2s',
            }}
          >
            {submitting ? 'Saving…' : "I've got it — Practice →"}
          </button>

          {!card3Done && (
            <p style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
              Complete all 3 steps to continue.
            </p>
          )}
        </div>

        {/* ── COL 3: CARDS ───────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, padding: 20, overflowY: 'auto', height: '100%', boxSizing: 'border-box',
        }}>
          {!initDone ? (
            <div style={{ color: C.gray, fontSize: 13 }}>Loading your session…</div>
          ) : initError ? (
            <div style={{ color: C.gray, fontSize: 13 }}>
              Unable to load intervention. Return to the dashboard and try again.
            </div>
          ) : (
            renderBranchCards(
              branch, slot, card,
              triggerQ, passageLoading,
              () => setCard(prev => Math.min(prev + 1, 3)),
              handleCard3Done,
            )
          )}
        </div>
      </div>

      <style>{TEACH_3COL_CSS(C.border)}</style>
    </div>
  );
}
