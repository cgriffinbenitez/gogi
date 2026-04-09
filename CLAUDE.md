# GOGI — AI-Powered ELA Literacy Platform

## What is GOGI
GOGI is a Florida B.E.S.T. standards-aligned ELA literacy platform for Title 1 students. It uses a 4-step personalized learning loop (Diagnose → Teach → Practice → Reassess) to improve student reading comprehension and give teachers real-time visibility into student progress — standard by standard.

## The Problem We're Solving
Title 1 ELA teachers have no single system that:
- Establishes a baseline per student (not whole-class)
- Builds a personalized learning path from that baseline
- Tracks whether the work is actually moving the needle
- Frees the teacher from whole-group remediation
- Documents differentiated instruction (DI) automatically
- Ingests external assessment data (PM1, PM2) and recalibrates

## Pilot Plan
- 10 students total: 5 on GOGI (treatment), 5 traditional intervention (control)
- 3 Florida BEST ELA standards targeted
- 6-8 weeks, Fall 2026-27 school year
- Success = demonstrable growth comparison between both groups

## Tech Stack
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: Supabase (auth, database, real-time)
- AI: Anthropic Claude API (NOT OpenAI)
- Repo: https://github.com/cgriffinbenitez/gogi

## Database Tables
- users (id, email, role, full_name, created_at)
- students (id, user_id, teacher_id, grade_level, created_at)
- standards (id, code, description, grade_level, domain)
- sessions (id, student_id, standard_id, session_type, score, status, completed_at)
- questions (id, standard_id, session_type, question_text, answer_choices jsonb, correct_answer)
- responses (id, session_id, question_id, student_answer, is_correct, answered_at)

## Target Florida BEST Standards (Pilot)
- ELA.9.R.1.1 — Inferencing and textual evidence
- ELA.9.R.1.2 — Universal themes in literary texts
- ELA.9.R.2.1 — Analyzing text structure and purpose

## Learning Loop Logic
- Diagnostic score 80%+ → skip to Reassess
- Diagnostic score below 80% → Teach → Practice → Reassess
- Reassess score 80%+ → mastery achieved
- session_type values: diagnostic, teach, practice, reassess

## User Roles
- student → redirected to /student-home on login
- teacher → redirected to /teacher-dashboard on login

## Key Product Decisions
- AI Tutor uses Anthropic Claude API (AiTutorDrawer.tsx needs to be rewired from OpenAI)
- All data currently hardcoded — everything needs to connect to Supabase
- Student data privacy is critical — FERPA and COPPA compliant design required
- Row Level Security (RLS) must be enabled — students see only their own data

## Development Process
- Kanban board: GitHub Projects (github.com/cgriffinbenitez/gogi)
- No feature gets built without a user story and acceptance criteria
- Every card goes through: Backlog → Ready → In Progress → In Review → Done
- Current card in progress: #3 Database schema set up in Supabase

## What Good Looks Like
- Clean, accessible UI appropriate for 9th grade reading level
- Mobile friendly — students may access on phones
- Fast load times — Title 1 schools may have limited bandwidth
- Every interaction that matters is saved to Supabase
- Teacher dashboard shows real data, not mocked data