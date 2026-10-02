import { useEffect, useState } from "react";
import { FaWysiwyg } from "./index";
import { LANGS } from "./core/lang";
import { getData, setData } from "./core/serialize";
import { CONTRACT_FIXTURES } from "./lab/fixtures";
import { prettyHtml } from "./lab/pretty";

// Corpus samples worth reaching in one click.
const INTERESTING = [
  "combined document",
  "table with a header row",
  "table with colspan",
  "table with rowspan",
  "multiple mentions",
  "link with text around it",
  "list with formatting",
  "nested list, three levels",
  "list item with several paragraphs",
];

const SAMPLES = INTERESTING.map((name) =>
  CONTRACT_FIXTURES.find((f) => f.name === name),
).filter((sample) => !!sample);

const AUTOCOMPLETES = ["#name", "#surname", "#email", "#company", "no-marker"];

interface RoundTrip {
  pass: number;
  total: number;
  failed: number;
  diffs: { name: string; expected: string; actual: string }[];
}

/**
 * Loads every sample into an off-screen editable and compares what comes
 * back: the same `setData` + `getData` the editor runs when a value arrives.
 * This is the check that matters: if it fails, opening a form and saving it
 * without touching anything rewrites the HTML already in the database.
 */
function runRoundTrip(): RoundTrip {
  const probe = document.createElement("div");
  probe.className = "fa-wysiwyg__content lab__probe";
  document.body.appendChild(probe);

  const diffs: RoundTrip["diffs"] = [];
  let pass = 0;

  for (const fixture of CONTRACT_FIXTURES) {
    if (!fixture.html) continue;

    setData(probe, fixture.html);
    const expected = fixture.out ?? fixture.html;
    const actual = getData(probe);

    if (actual === expected) pass++;
    else diffs.push({ name: fixture.name, expected, actual });
  }

  probe.remove();
  const total = pass + diffs.length;
  return { pass, total, failed: diffs.length, diffs };
}

export default function App() {
  const [html, setHtml] = useState(
    "<h2>Title</h2><p>Type here, or load a sample.</p>",
  );
  const [stateHtml, setStateHtml] = useState(
    "<p>Long content, so the internal scrolling shows.</p><p>Second paragraph.</p><p>Third paragraph.</p><p>Fourth paragraph.</p>",
  );
  const [disabledHtml, setDisabledHtml] = useState(
    "<p>This editor is disabled.</p>",
  );
  const [scrollHtml, setScrollHtml] = useState(
    '<p>A <a target="_blank" rel="noopener noreferrer" href="http://a.com">link</a> to try the balloon on.</p>',
  );
  const [lang, setLang] = useState("en");
  const [roundTrip, setRoundTrip] = useState<RoundTrip>({
    pass: 0,
    total: 0,
    failed: 0,
    diffs: [],
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoundTrip(runRoundTrip());
  }, []);

  return (
    <div className="lab">
      <header className="lab__header">
        <h1>FaWysiwyg</h1>
        <p>
          Zero-dependency rich-text editor for React, with a strict HTML
          contract.
        </p>

        <label className="lab__lang">
          Interface language
          <select
            value={lang}
            data-testid="lang"
            onChange={(event) => setLang(event.target.value)}
          >
            {LANGS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="lab__grid">
        <section className="lab__col">
          <div className="lab__card">
            <h2>Editor</h2>
            <p className="lab__hint">
              Use ctrl+enter or shift+enter for a soft line break.
            </p>

            <FaWysiwyg
              value={html}
              onChange={setHtml}
              lang={lang}
              placeholder="Type something, or load a sample…"
              autocompleteOpts={AUTOCOMPLETES}
            />

            <div className="lab__samples">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  className="lab__btn"
                  onClick={() => setHtml(sample.html)}
                >
                  {sample.name}
                </button>
              ))}
              <button
                type="button"
                className="lab__btn lab__btn--danger"
                onClick={() => setHtml("")}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="lab__card">
            <h2>States</h2>
            <p className="lab__hint">
              Fixed height with internal scrolling, and disabled.
            </p>

            <label className="lab__label">Fixed height (100px)</label>
            <FaWysiwyg
              value={stateHtml}
              onChange={setStateHtml}
              lang={lang}
              className="lab__fixed"
            />

            <label className="lab__label">Disabled</label>
            <FaWysiwyg
              value={disabledHtml}
              onChange={setDisabledHtml}
              lang={lang}
              disabled
            />
          </div>

          <div className="lab__card">
            <h2>Inside a scrolling container</h2>
            <p className="lab__hint">
              The critical case: link and table balloons are portaled to{" "}
              <code>&lt;body&gt;</code> and have to follow the content as it
              scrolls. Open one and spin the wheel.
            </p>

            <div className="lab__scroller">
              <div className="lab__filler">
                Filler, so there is something to scroll.
              </div>
              <FaWysiwyg
                value={scrollHtml}
                onChange={setScrollHtml}
                lang={lang}
                autocompleteOpts={AUTOCOMPLETES}
              />
              <div className="lab__filler">More filler.</div>
            </div>
          </div>
        </section>

        <section className="lab__col">
          <div className="lab__card">
            <h2>Output HTML</h2>
            <p className="lab__hint">
              Exactly what would be written to the database. The line breaks
              and the indentation are added here, for reading: they are not
              part of the value.
            </p>
            <pre className="lab__output">{prettyHtml(html) || "(empty)"}</pre>
          </div>

          <div className="lab__card">
            <h2>Preview</h2>
            <p className="lab__hint">
              How the application renders it with{" "}
              <code>dangerouslySetInnerHTML</code>, outside the editor. It has
              to look the same as above.
            </p>
            <div
              className="lab__preview"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>

          <div className="lab__card">
            <h2>Round-trip</h2>
            <p className="lab__hint">
              <code>getData(setData(x)) === x</code> across the contract
              corpus. Each sample is loaded into an off-screen editable and its
              output compared with the input.
            </p>

            <p
              className={`lab__verdict ${roundTrip.failed ? "lab__verdict--bad" : "lab__verdict--ok"}`}
            >
              {roundTrip.pass} / {roundTrip.total}
            </p>

            <ul className="lab__diffs">
              {roundTrip.diffs.map((row) => (
                <li key={row.name}>
                  <strong>{row.name}</strong>
                  <pre>{`in:  ${row.expected}\nout: ${row.actual}`}</pre>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
