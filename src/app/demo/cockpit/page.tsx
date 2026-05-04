const PRESENTATION_STOPS = [
  {
    title: 'Noah welcome',
    detail: 'Replay the student opening moment without marking it complete.',
    href: '/welcome?preview=1&demoNav=1',
    tag: 'Student story',
  },
  {
    title: 'First Win',
    detail: 'Show the quick confidence-building loop that sold the experience.',
    href: '/first-win?preview=1&demoNav=1',
    tag: 'Preview',
  },
  {
    title: 'Reading Win: R.3.1',
    detail: 'Jump into the FAST-style figurative language remediation loop.',
    href: '/standard/ELA-9-R-3-1/intervention?preview=1&demoNav=1',
    tag: 'Preview',
  },
  {
    title: 'Student dashboard',
    detail: 'Show where Noah lands and what GOGI recommends next.',
    href: '/dashboard/student?demoNav=1',
    tag: 'Live account',
  },
  {
    title: 'Layer 0 quick run',
    detail: 'Start the short cognitive availability demo path.',
    href: '/layer0?demo=1&mode=demo&demoNav=1',
    tag: '2-3 min',
  },
  {
    title: 'Layer 0 data',
    detail: 'Review tester results and cognitive-load insights.',
    href: '/demo/results?demoNav=1',
    tag: 'Data',
  },
  {
    title: 'Teacher FAST upload',
    detail: 'Teacher-side upload tool. Works best when signed in as a teacher.',
    href: '/teacher-dashboard/fast-upload?demoNav=1',
    tag: 'Teacher tool',
  },
  {
    title: 'Library Readiness',
    detail: 'Show which standards have enough FAST-aligned Reading Win content.',
    href: '/admin/reading-win-coverage?demoNav=1',
    tag: 'Internal',
  },
  {
    title: 'Item Builder',
    detail: 'Inspect generated passages and questions by standard.',
    href: '/admin/original-items?demoNav=1',
    tag: 'Internal',
  },
  {
    title: 'Teacher roster',
    detail: 'Live teacher home. Requires a teacher login; student sessions redirect.',
    href: '/dashboard/teacher?demoNav=1',
    tag: 'Teacher login',
  },
];

const STORYLINE = [
  'Start with Noah: GOGI knows where I am and where I can go.',
  'Show First Win: GOGI gives me something I can win today.',
  'Show Reading Win: GOGI routes practice to the exact FAST-aligned gap.',
  'Show teacher FAST upload/profile: GOGI turns records into an instructional plan.',
  'Show Layer 0/demo data: GOGI can also measure load so the support level is right.',
];

export default function DemoCockpitPage() {
  return (
    <main className="root">
      <section className="hero">
        <div>
          <p className="eyebrow">Presenter cockpit</p>
          <h1>Jump anywhere in the GOGI demo.</h1>
          <p className="lede">
            Use this page when you do not have time to sit through the whole student journey. The
            real student flow stays intact; this just gives you clean demo doors.
          </p>
        </div>
        <div className="heroActions">
          <a className="primary" href="/login">
            Login
          </a>
          <a className="secondary" href="/welcome?preview=1&demoNav=1">
            Start story
          </a>
        </div>
      </section>

      <section className="story">
        <div className="sectionTitle">
          <h2>Recommended cofounder walkthrough</h2>
        </div>
        <ol>
          {STORYLINE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <section className="grid">
        {PRESENTATION_STOPS.map((stop) => (
          <a key={stop.href} className="card" href={stop.href}>
            <div className="cardTop">
              <span className="icon" aria-hidden="true" />
              <span className="tag">{stop.tag}</span>
            </div>
            <h2>{stop.title}</h2>
            <p>{stop.detail}</p>
          </a>
        ))}
      </section>

      <style>{`
        .root {
          min-height: 100vh;
          background: #f6f7fb;
          color: #101828;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          padding: 42px clamp(18px, 4vw, 56px) 104px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 28px;
          align-items: end;
          max-width: 1180px;
          margin: 0 auto 22px;
        }

        .eyebrow {
          color: #2e75b6;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.1em;
          margin: 0 0 12px;
          text-transform: uppercase;
        }

        h1 {
          font-size: clamp(36px, 5vw, 68px);
          line-height: 0.98;
          letter-spacing: 0;
          margin: 0;
          max-width: 780px;
        }

        .lede {
          color: #667085;
          font-size: 18px;
          line-height: 1.55;
          max-width: 760px;
          margin: 18px 0 0;
        }

        .heroActions {
          display: flex;
          gap: 10px;
        }

        .primary,
        .secondary {
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 850;
          text-decoration: none;
          white-space: nowrap;
        }

        .primary {
          background: #101828;
          color: white;
        }

        .secondary {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .story,
        .grid {
          max-width: 1180px;
          margin: 0 auto;
        }

        .story {
          background: white;
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          padding: 22px;
          box-shadow: 0 12px 30px rgba(16, 24, 40, 0.06);
        }

        .sectionTitle h2 {
          color: #101828;
          font-size: 17px;
          margin: 0 0 14px;
        }

        ol {
          display: grid;
          gap: 8px;
          margin: 0;
          padding-left: 22px;
          color: #475467;
          font-size: 15px;
          line-height: 1.45;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 16px;
        }

        .card {
          min-height: 210px;
          background: white;
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          color: inherit;
          padding: 18px;
          text-align: left;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            border-color 0.16s ease;
        }

        .card:hover {
          border-color: #2563eb;
          box-shadow: 0 18px 42px rgba(16, 24, 40, 0.1);
          transform: translateY(-2px);
        }

        .cardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          display: block;
        }

        .tag {
          border-radius: 999px;
          background: #f2f4f7;
          color: #667085;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 850;
        }

        .card h2 {
          color: #101828;
          font-size: 21px;
          line-height: 1.12;
          margin: auto 0 0;
        }

        .card p {
          color: #667085;
          font-size: 14px;
          line-height: 1.42;
          margin: 0;
        }

        @media (max-width: 980px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .heroActions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  );
}
