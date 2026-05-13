#!/usr/bin/env python3
import json
import re
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

ET.register_namespace("a", NS["a"])
ET.register_namespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
ET.register_namespace("p", "http://schemas.openxmlformats.org/presentationml/2006/main")


def clean(value, max_len=None):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip() + "..."
    return text


def bullets(values, max_items=5, max_len=135):
    out = []
    for value in values or []:
        text = clean(value, max_len)
        if text:
            out.append(text)
        if len(out) >= max_items:
            break
    return out


def replace_text_nodes(root, replacements):
    for node in root.findall(".//a:t", NS):
        old = node.text or ""
        if old in replacements:
            node.text = replacements[old]


def set_first_matching(root, old_values, new_value):
    old_set = set(old_values)
    for node in root.findall(".//a:t", NS):
        if (node.text or "") in old_set:
            node.text = new_value
            return


def set_slide_text(template_xml, replacements, first_matches=None):
    root = ET.fromstring(template_xml)
    replace_text_nodes(root, replacements)
    for old_values, new_value in first_matches or []:
        set_first_matching(root, old_values, new_value)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def lesson_replacements(lesson):
    standard = clean(lesson.get("standard_code"))
    title = clean(lesson.get("title"))
    standard_text = clean(lesson.get("standard_text"), 180)
    anchor = clean(lesson.get("anchor_text"))
    objective = clean(lesson.get("objective"), 180)
    plain = clean(lesson.get("plain_english_standard"), 220)
    overview = clean(lesson.get("skill_overview"), 220)
    identify = bullets(lesson.get("how_to_identify"), 5)
    solve = bullets(lesson.get("how_to_solve"), 5)
    guided = bullets(lesson.get("guided_practice"), 4)
    independent = bullets(lesson.get("independent_practice"), 4)
    cues = bullets(lesson.get("cue_questions"), 5)
    key = bullets(lesson.get("teacher_key"), 4)
    worked = lesson.get("worked_example") or {}
    evidence = clean(worked.get("evidence"), 650)
    element = clean(worked.get("element"), 90)
    effect = clean(worked.get("effect"), 180)
    summary = clean(lesson.get("summary_frame"), 220)
    exit_ticket = clean(lesson.get("exit_ticket"), 220)

    return {
        1: {
            "ELA.9.R.1.1": standard,
            "Literary Elements": title,
            "Lesson 1 of 5  ·  Today's focus: Setting & Plot": f"Lesson 1 · Today's focus: {clean(title, 70)}",
            'Anchor text: "The Most Dangerous Game" by Richard Connell': f"Anchor text: {anchor}",
        },
        3: {
            "ELA.9.R.1.1": standard,
            "Standard code top right: ELA.9.R.1.1": f"Standard code top right: {standard}",
        },
        4: {
            "ELA.9.R.1.1": standard,
            '"Explain how key elements enhance or add layers of meaning and/or style in a literary text."': f'"{standard_text}"',
            "Figure out how the building blocks of a story (setting, characters, plot, etc.) make the story mean what it means and feel the way it feels.": plain,
            "setting  ·  plot  ·  characterization  ·  conflict  ·  point of view  ·  theme  ·  tone": "evidence  ·  effect  ·  meaning  ·  style  ·  author choice  ·  precise language",
            "Today we're working on the first two: SETTING and PLOT.": f"Today we are working on: {clean(title, 90)}.",
        },
        5: {
            "ELA.9.R.1.1": standard,
            "Key definition: Literary elements": "Key definition",
            "Literary elements": "The skill",
            "building blocks": "author choices",
            "meaning": "meaning",
            "style": "effect",
            "in a literary text.": clean(overview, 110),
            "What the story is ABOUT.": "What the evidence makes the reader understand.",
            "Plot, theme, conflict, characters drive what happens and what it teaches.": plain,
            "How the story FEELS.": "How the author shapes the reader's thinking.",
            "Setting, POV, tone, and figurative language shape the mood and voice.": objective,
        },
        6: {
            "ELA.9.R.1.1": standard,
            "The 7 key elements": "The skill pieces",
            "SETTING": "EVIDENCE",
            "where + when the story happens": "exact words from the text",
            "PLOT": "MEANING",
            "the sequence of events": "what the evidence suggests",
            "CHARACTERS": "EFFECT",
            "who is in the story + how they're built": "what it does to the reader",
            "CONFLICT": "CONTEXT",
            "the central problem or struggle": "where it appears in the passage",
            "POINT OF VIEW": "DISTRACTOR",
            "who is telling the story (1st, 3rd, etc.)": "answer that sounds right but misses the effect",
            "THEME": "PROOF",
            "the big idea the story teaches": "why your answer is text-based",
            "TONE": "REVISION",
            "the author's attitude toward the subject": "make the answer sharper",
            "Lessons 2–4 will hit the rest.": "Every rep uses the same GOGI move: evidence, meaning, effect.",
        },
        7: {
            "ELA.9.R.1.1": standard,
            "What is SETTING?": "How to identify it",
            "Setting = WHERE + WHEN + the FEELING those create.": identify[0] if len(identify) > 0 else "Find the exact evidence the question points to.",
            "PLACE": "STEP 1",
            "WHERE": "SPOT",
            "Country, city, building": identify[0] if len(identify) > 0 else "Find the exact phrase.",
            "Indoor or outdoor": identify[1] if len(identify) > 1 else "Look near the quoted detail.",
            "Specific room or environment": identify[2] if len(identify) > 2 else "Ignore answer choices at first.",
            "TIME": "STEP 2",
            "WHEN": "NAME",
            "Era / year / decade": solve[0] if len(solve) > 0 else "Name what the evidence is doing.",
            "Season + time of day": solve[1] if len(solve) > 1 else "Say what it suggests.",
            "How long events take": solve[2] if len(solve) > 2 else "Keep it tied to the text.",
            "MOOD": "STEP 3",
            "the FEELING": "EXPLAIN",
            "Sinister, peaceful, tense": "Explain the effect.",
            "Created by description": "Use exact evidence.",
            "Often the AUTHOR'S CHOICE": "Go beyond summary.",
        },
        8: {
            "ELA.9.R.1.1": standard,
            "What is PLOT?": "How to solve it",
            "Plot = the SEQUENCE of events. Every story moves through 5 stages.": "Use the same process every time you see this kind of FAST-style question.",
            "EXPOSITION": "SPOT",
            "setup": solve[0] if len(solve) > 0 else "Find exact evidence.",
            "RISING ACTION": "NAME",
            "tension builds": solve[1] if len(solve) > 1 else "Name what it suggests.",
            "CLIMAX": "EXPLAIN",
            "peak / turning point": solve[2] if len(solve) > 2 else "Explain the effect.",
            "FALLING ACTION": "ELIMINATE",
            "consequences": solve[3] if len(solve) > 3 else "Remove summary-only choices.",
            "RESOLUTION": "PROVE",
            "ending": solve[4] if len(solve) > 4 else "Check that the answer matches the evidence.",
            'WHAT IT LOOKS LIKE IN "THE MOST DANGEROUS GAME":': f"WHAT IT LOOKS LIKE IN {anchor}:",
        },
        9: {
            "ELA.9.R.1.1": standard,
            "Vocabulary Anchor — TMDG": "Academic Language Anchor",
            "EXAMPLE FROM TMDG": "CLASSROOM EXAMPLE",
            "palpable": "evidence",
            "able to be felt or noticed": "exact words from the text",
            '"...the dank tropical night that was palpable..."': clean(evidence, 90),
            "indolently": "effect",
            "lazily; without much effort": "what the evidence does",
            '"Whitney swung indolently in the hammock."': clean(effect, 90),
            "tangible": "context",
            "real, solid, able to be touched": "where the evidence appears",
            '"There was no tangible reason for fear."': "Look before and after the quoted detail.",
            "bizarre": "distractor",
            "very strange or unusual": "answer that sounds possible",
            '"Its massiveness itself was bizarre."': "Reject it if it does not explain the evidence.",
            "quarry": "revision",
            "an animal being hunted": "make the answer sharper",
            '"Rainsford realized he was the quarry."': "Add the effect, not just the topic.",
        },
        10: {
            "Passage 1 — TMDG opening": "Passage 1 — Active reading",
            "ELA.9.R.1.1": standard,
            'From "The Most Dangerous Game" by Richard Connell (1924, public domain)': f"From {anchor}",
            "READ TWICE. First read: get the story. Second read with pen: BOX setting clues. UNDERLINE plot starters.": "READ TWICE. First read: get the meaning. Second read with pen: BOX the evidence. UNDERLINE the effect clues.",
            "✎ NOTES — Read passage 1 twice. Box setting clues. Underline plot starters. (Active reading = pen moving.)": "✎ NOTES — Read twice. Box evidence. Underline effect clues. Pen moving the entire time.",
        },
        11: {
            "ELA.9.R.1.1": standard,
            "Worked example — Passage 1": "Worked example — Passage 1",
            "ELEMENT": "SKILL",
            "EVIDENCE (quote from passage)": "EVIDENCE",
            "EFFECT on reader": "EFFECT",
            "Setting": element or "Key detail",
            '"the dank tropical night that was palpable"': clean(evidence, 90),
            "Creates suspense; reader feels the heaviness and isolation.": effect,
            '"Ship-Trap Island" / "a curious dread"': "Your evidence row",
            "Foreshadows danger; the place itself feels threatening.": "Your effect explanation",
            '"Sailors have a curious dread of the place."': "Stretch row",
            "Plants the central conflict — something is wrong with this island.": "Explain the effect without summarizing.",
        },
        12: {
            "ELA.9.R.1.1": standard,
            "TURN & TALK": "SILENT WRITTEN REP",
            "Which setting clue creates the strongest mood — and why?": "Which evidence point creates the strongest effect — and why?",
            "STRUCTURE:": "STRUCTURE:",
            "· 90 sec — Partner A explains. Partner B listens.": "· Write one sentence naming what the evidence shows.",
            "· 90 sec — Switch. Partner B explains. Partner A listens.": "· Write one sentence explaining the effect on the reader.",
            "· Use a vocab word from the anchor in your answer.": "· Use one precise academic word from today’s notes.",
            "✎ No notes required — but listen for ideas you'll use later.": "✎ NOTES — Silent writing. Pen moving the entire time.",
        },
        13: {
            "Passage 2 — Overboard": "Passage 2 — Guided practice",
            "ELA.9.R.1.1": standard,
            'From "The Most Dangerous Game" by Richard Connell (1924, public domain)': f"From {anchor}",
            "GUIDED PRACTICE: Build the same 3-column table (Element / Evidence / Effect). Fill 3 rows. We check together.": "GUIDED PRACTICE: Build the same 3-column table. Fill 3 rows. We check together.",
            "✎ NOTES — 3 rows minimum. Element + direct quote + effect. (You have 8 min — start now.)": "✎ NOTES — 3 rows minimum. Skill + exact evidence + effect. Start now.",
        },
        14: {
            "ELA.9.R.1.1": standard,
            "Check your Passage 2 annotations": "Check your guided practice",
            "Plot": "Skill",
            '"he was thrown into the sea"': "Exact evidence",
            "Inciting incident — Rainsford is now isolated from civilization.": "Effect is explained beyond summary.",
            "Setting": "Skill",
            '"bloodwarm waters of the Caribbean Sea"': "Exact evidence",
            '"Bloodwarm" foreshadows violence; setting echoes danger.': "Effect is tied to author choice.",
            "✓ MARK YOUR WORK: Anything you missed, add in a different color pen so you can see what to study.": "✓ MARK YOUR WORK: Anything you missed, add in a different color pen.",
        },
        15: {
            "Passage 3 — INDEPENDENT": "Passage 3 — Independent rep",
            "ELA.9.R.1.1": standard,
            'From "The Most Dangerous Game" by Richard Connell (1924, public domain)': f"From {anchor}",
            "INDEPENDENT — Build the 3-column table on your own. 4 ROWS MINIMUM. No partner, no looking at slide 10/13 keys.": "INDEPENDENT — Build the 3-column table on your own. 4 ROWS MINIMUM. No partner talk.",
            "✎ NOTES — Independent work. 4 rows. Element + direct quote (with quote marks) + effect. Begin.": "✎ NOTES — Independent work. 4 rows. Skill + exact evidence + effect. Begin.",
        },
        16: {
            "ELA.9.R.1.1": standard,
            "STOP & SHARE": "TEACHER CHECKPOINT",
            "Trade journals with your shoulder partner.": "Keep journals open to your independent response.",
            "CHECKLIST — use this on your partner's page:": "CHECKLIST — teacher scans for:",
            "☐  4 rows minimum?": "☐  4 rows minimum?",
            "☐  Direct quotes (with quote marks)?": "☐  Exact evidence?",
            "☐  Effect explained — not just element identified?": "☐  Effect explained — not summary?",
            "☐  At least 1 vocab word from slide 8 used?": "☐  Precise academic language?",
            "✎ On your partner's page, add ONE row you'd add. Then trade back.": "✎ If marked, revise immediately in a different color. No partner talk.",
        },
        17: {
            "ELA.9.R.1.1": standard,
        },
        18: {
            "ELA.9.R.1.1": standard,
            '"What is setting?"': '"What is the skill?"',
            '"Where does TMDG take place?"': '"What happened in the passage?"',
            '"Who wrote TMDG?"': '"What is the title?"',
            '"How does Connell use setting to create dread?"': cues[0] if len(cues) > 0 else '"How does the evidence create meaning?"',
            '"Why is the chateau described as \'leering\'?"': cues[1] if len(cues) > 1 else '"Why did the author choose this detail?"',
            '"What\'s the inciting incident in TMDG?"': cues[2] if len(cues) > 2 else '"What evidence proves the effect?"',
        },
        19: {
            "ELA.9.R.1.1": standard,
            "How does Connell create a sense of dread in the opening?": cues[0] if len(cues) > 0 else "How does this evidence add meaning?",
            'Setting: "dank tropical night... palpable" → suspense; isolation.': f"{element or 'Skill'}: {clean(evidence, 70)} → {clean(effect, 75)}",
            "What's the inciting incident in TMDG?": cues[1] if len(cues) > 1 else "What effect does the evidence create?",
            'Plot: "he was thrown into the sea" → Rainsford is isolated from civilization.': "Evidence → effect, not just summary.",
            "Why does the chateau feel ominous?": cues[2] if len(cues) > 2 else "How does the answer choice prove the standard?",
        },
        20: {
            "ELA.9.R.1.1": standard,
        },
        21: {
            "ELA.9.R.1.1": standard,
            "In the opening of “The Most Dangerous Game,” Connell uses": summary,
            "Must use at least 1 vocab word from slide 8 (palpable, indolently, tangible, bizarre, quarry).": "Must use at least 1 academic word from today’s notes.",
            "Reference at least 1 element (setting OR plot).": f"Reference the skill for {standard}.",
        },
        22: {
            "ELA.9.R.1.1": standard,
            "Standard code at top right: ELA.9.R.1.1": f"Standard code at top right: {standard}",
            "Vocabulary Anchor: 5 words with definitions (slide 8)": "Academic language anchor copied",
        },
        23: {
            "ELA.9.R.1.1": standard,
            "Choose ONE element of SETTING from TMDG (any passage). In 4–5 sentences, explain HOW Connell uses it to build mood or plot.": exit_ticket,
            "Name the element": "Name the skill",
            "(e.g., \"The setting of Ship-Trap Island...\")": f"(e.g., {standard})",
            "Use 1 vocab word in context": "Use 1 academic word in context",
            "(palpable, indolently, tangible, bizarre, quarry)": "(evidence, effect, context, meaning, style)",
        },
        24: {
            "ELA.9.R.1.1": standard,
            "Identify SETTING and PLOT in a literary text": f"Apply {standard} to a literary text",
            "Use 5 new TMDG vocab words: palpable, indolently, tangible, bizarre, quarry": "Use precise academic reading language",
            "TOMORROW (Lesson 2 of 5):": "NEXT LESSON:",
            "Characterization & Conflict in TMDG.": "New text evidence, same GOGI move.",
        },
        25: {
            "Tomorrow: Lesson 2 — Characterization & Conflict in TMDG.": "Next lesson: new text evidence, same GOGI move.",
        },
    }


def main():
    template, lesson_json, output = map(Path, sys.argv[1:4])
    lesson = json.loads(lesson_json.read_text())
    replacements = lesson_replacements(lesson)
    # Long passage replacements are handled separately to preserve the large passage text boxes.
    worked = lesson.get("worked_example") or {}
    evidence = clean(worked.get("evidence"), 850)
    guided_text = " ".join(bullets(lesson.get("guided_practice"), 4, 160))
    independent_text = " ".join(bullets(lesson.get("independent_practice"), 4, 160))
    passage_first_matches = {
        10: [(
            [
                "“Off there to the right — somewhere — is a large island,” said Whitney. “It’s rather a mystery —”",
                "“What island is it?” Rainsford asked.",
            ],
            evidence or "Use the selected GOGI excerpt for active reading.",
        )],
        13: [(
            ["There was a smashing sound; he was thrown into the sea."],
            guided_text or evidence or "Use a second GOGI excerpt or evidence point for guided practice.",
        )],
        15: [(
            ["His eyes made out the shadowy outlines of a palatial chateau;"],
            independent_text or evidence or "Use a third GOGI excerpt or evidence point for independent practice.",
        )],
    }

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with ZipFile(template) as zin:
            names = zin.namelist()
            for name in names:
                data = zin.read(name)
                match = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", name)
                if match:
                    slide_no = int(match.group(1))
                    data = set_slide_text(
                        data,
                        replacements.get(slide_no, {}),
                        passage_first_matches.get(slide_no, []),
                    )
                target = tmp_path / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)

        with ZipFile(output, "w", ZIP_DEFLATED) as zout:
            for file in sorted(tmp_path.rglob("*")):
                if file.is_file():
                    zout.write(file, file.relative_to(tmp_path).as_posix())


if __name__ == "__main__":
    main()
