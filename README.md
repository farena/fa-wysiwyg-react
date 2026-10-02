# @farena/fa-wysiwyg-react

A rich-text editor for React with a strict, stable HTML contract and output sanitized with
[DOMPurify](https://github.com/cure53/DOMPurify).

It is built for HTML that lives in a database and has to survive being opened and saved again,
unchanged, for years. The whole design is organized around one property:
`getData(setData(x)) === x`. If it ever breaks, opening a form and saving it without touching
anything silently rewrites stored content.

- **One runtime dependency: [DOMPurify](https://github.com/cure53/DOMPurify).** Every HTML
  string the editor returns has already been purified, so you can store it and render it as it
  comes. React and React DOM are peer dependencies.
- **`contenteditable` plus the Selection/Range API.** `document.execCommand` is never used. It
  produces `<b>`, `<font>` and `rgb()` where the contract calls for `<strong>`, `<span>` and
  `hsl()`, and it cannot see mutations made through the Range API.
- **Real WYSIWYG.** The editable area applies no content styles of its own, so what you see while
  typing is what the page renders afterwards with `dangerouslySetInnerHTML`.
- **About 33 kB gzipped**, CSS and icons included, plus DOMPurify (about 9 kB gzipped). DOMPurify
  is not bundled, so an app that already uses it only loads one copy.

**[Try it in the lab →](https://farena.github.io/fa-wysiwyg-react/)** The lab shows every feature
of the contract on one page, with the serialized HTML and a rendered preview side by side, so you
can check that what you edit is what your app renders.

This is the React port of [`@farena/fa-editor`](https://github.com/farena/fa-editor) for Vue 3.
Both packages produce and accept exactly the same HTML, so documents can move between a Vue app
and a React app.

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API](#api)
- [Mentions](#mentions)
- [Languages](#languages)
- [Keyboard](#keyboard)
- [The HTML contract](#the-html-contract)
- [Styling](#styling)
- [Rendering content outside the editor](#rendering-content-outside-the-editor)
- [Icons](#icons)
- [Known limitations](#known-limitations)
- [License](#license)

## Requirements

- **React 19 or newer.** The component takes `ref` as a regular prop, which requires React 19.
- **DOMPurify 3**, installed automatically as a dependency.
- **Nothing else.** There is no icon font and no CDN. The toolbar icons are inline `<svg>` drawn
  by the package itself; see [Icons](#icons).
- A browser that supports `beforeinput` and `InputEvent.inputType`: Chrome, Edge, Firefox 87+ or
  Safari 13+.

The editor relies on browser APIs (Selection, Range, `contenteditable`). In frameworks with
server components, such as the Next.js App Router, render it from a Client Component (a file
marked `"use client"`).

## Installation

```bash
npm i @farena/fa-wysiwyg-react
```

## Quick start

```tsx
import { useState } from "react";
import { FaWysiwyg } from "@farena/fa-wysiwyg-react";
import "@farena/fa-wysiwyg-react/style.css";

export function ArticleForm() {
  const [html, setHtml] = useState("<p>Hello</p>");

  return (
    <FaWysiwyg
      value={html}
      onChange={setHtml}
      placeholder="Type something…"
      autocompleteOpts={["#name", "#email"]}
    />
  );
}
```

The component is the default export too, so `import FaWysiwyg from "@farena/fa-wysiwyg-react"` works the
same way.

You must import the stylesheet, because the editor ships no styles of its own. If you want to
compile it yourself so you can override variables before they are resolved, import the Sass
source instead:

```scss
@use "@farena/fa-wysiwyg-react/scss";
```

Sass requires `@use` rules to come before any other rule, so this has to be the first line of the
file.

## API

### Props

| Prop               | Type                           | Default | Description                                                            |
| ------------------ | ------------------------------ | ------- | ---------------------------------------------------------------------- |
| `value`            | `string`                       | `''`    | The document's HTML. See [The `value` cycle](#the-value-cycle).        |
| `onChange`         | `(html: string) => void`       | —       | Called when the content changes. Debounced 300 ms, leading edge included. |
| `placeholder`      | `string`                       | —       | Shown while the document is empty.                                     |
| `disabled`         | `boolean`                      | `false` | Read-only: turns off `contenteditable` and the whole toolbar.          |
| `autocompleteOpts` | `string[] \| null`             | `null`  | Mention options. Only entries that start with `#` are used.            |
| `lang`             | `string`                       | `'en'`  | Interface language: `'en'`, `'es'`, `'pt'`, or a `registerLang` code.  |
| `className`        | `string`                       | —       | Added to the root `.fa-wysiwyg` element.                               |
| `onFocus`          | `(event: FocusEvent) => void`  | —       | The editable area gained focus. Receives the native event.             |
| `onBlur`           | `(event: FocusEvent) => void`  | —       | The editable area lost focus. Receives the native event.               |
| `ref`              | `Ref<FaWysiwygHandle>`         | —       | Gives access to the [methods](#methods).                               |

### Methods

These are available through a `ref`:

```tsx
import { useRef } from "react";
import { FaWysiwyg, type FaWysiwygHandle } from "@farena/fa-wysiwyg-react";

const editor = useRef<FaWysiwygHandle>(null);

<FaWysiwyg ref={editor} value={html} onChange={setHtml} />;

editor.current?.focus();
const latest = editor.current?.getData();
```

| Method      | What it does                                                               |
| ----------- | -------------------------------------------------------------------------- |
| `focus()`   | Focuses the editor and puts the caret at the end of the document.          |
| `getData()` | Returns the serialized HTML immediately, without waiting for the debounce. |

`getData()` is the method to call in a submit handler. It does not lag behind the last keystroke
the way the debounced `onChange` can.

### Exports

| Export                     | What it does                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `FaWysiwyg`                | The component. It is also the default export.                                          |
| `registerLang(code, dict)` | Adds a dictionary, or merges keys over an existing one. See [Languages](#languages).   |
| `getLang(code)`            | Returns a copy of a dictionary to build a new language on. Unknown codes return English. |
| `LANGS`                    | Every code `lang` currently accepts, registrations included.                           |
| `DEFAULT_LANG`             | `'en'`, the fallback for an unknown code or a missing key.                             |
| `FaWysiwygProps`           | Type of the props.                                                                     |
| `FaWysiwygHandle`          | Type of what the `ref` exposes.                                                        |

### The `value` cycle

This section explains the one behaviour that may surprise you.

The editor owns its DOM. `value` is not re-applied on every render. It is read when it
**changes**:

- If the new `value` is the HTML the editor itself last emitted through `onChange`, nothing
  happens. The common `value={html} onChange={setHtml}` loop therefore never reloads the
  document or makes the caret jump while the user types.
- Any other value is treated as coming **from outside**. The document is reloaded and the undo
  history starts over.

On an external load, if the HTML it received is not canonical, the editor **immediately calls
`onChange` with the normalized version**. For example, this value:

```tsx
setHtml('<p><a href="http://a.com">Go</a></p>');
```

is reported back right away as:

```tsx
'<p><a target="_blank" rel="noopener noreferrer" href="http://a.com">Go</a></p>';
```

This is deliberate. Without it, the parent and the editor would hold two different
representations of the same content, and the user's first keystroke would produce a diff that
has nothing to do with what they typed.

The debounce fires on the **leading edge**, so the first character typed is reported right away
and does not wait 300 ms.

You can also leave out `onChange` and only read the content through `ref.getData()`. In that
case, `value` acts as the initial content, plus any later replacement you pass in.

## Mentions

Pass `autocompleteOpts`, and typing `#` opens the dropdown:

```tsx
<FaWysiwyg
  value={html}
  onChange={setHtml}
  autocompleteOpts={["#name", "#surname", "#email"]}
/>
```

Entries that do not start with `#` are ignored. The dropdown only opens when the marker starts a
block or follows a space, so `abc#def` is typed as plain text. Arrow keys move the highlight,
Enter or Tab picks the highlighted entry, and Escape closes the dropdown.

A mention serializes as:

```html
<span class="mention" data-mention="#name">#name</span>
```

The span stays editable. If its text stops matching `data-mention`, it is no longer a mention and
the span is removed, leaving plain text. A mention whose text differs from what it stands for
would be worse than no mention at all.

## Languages

The interface ships in English, Spanish and Portuguese:

```tsx
<FaWysiwyg value={html} onChange={setHtml} lang="es" />
```

`lang` can change at any time, for example when it is bound to a user setting. Every label is
re-rendered, including the panels and balloons portaled to `<body>`:

```tsx
<FaWysiwyg value={html} onChange={setHtml} lang={user.locale} />
```

An unrecognized code falls back to English instead of throwing, so a bad value never breaks the
toolbar.

**The language never affects the document.** Tag names, class names, alignment values and colors
are fixed by the contract and are the same in every language. A document written with
`lang="pt"` is byte-for-byte what the same document would be with `lang="en"`. Only the text the
user reads changes.

### Adding a language

`registerLang(code, dict)` adds a dictionary from outside the package. Call it once, at module
level or before the app renders, and the code becomes valid wherever `lang` is accepted:

```tsx
// main.tsx
import { createRoot } from "react-dom/client";
import { registerLang } from "@farena/fa-wysiwyg-react";
import "@farena/fa-wysiwyg-react/style.css";
import App from "./App";

registerLang("fr", {
  undo: "Annuler (Ctrl+Z)",
  bold: "Gras (Ctrl+B)",
  // …
});

createRoot(document.getElementById("root")!).render(<App />);
```

```tsx
<FaWysiwyg value={html} onChange={setHtml} lang="fr" />
```

Missing keys fall back to English, so a partial dictionary works from the first entry. You can
translate the toolbar labels first and the table balloon later.

The registry is global to the module, not per instance, so every `<FaWysiwyg>` in the app sees
the same languages. This is intentional: you register once at startup and never have to pass a
dictionary through every component that renders an editor.

### Starting from a shipped dictionary

`getLang(code)` returns a **copy** of a dictionary, so you can start from an existing one without
hunting for the source file. Spread it and override what you need:

```ts
import { registerLang, getLang } from "@farena/fa-wysiwyg-react";

registerLang("fr", {
  ...getLang("en"),
  undo: "Annuler (Ctrl+Z)",
  redo: "Rétablir (Ctrl+Y)",
  bold: "Gras (Ctrl+B)",
  italic: "Italique (Ctrl+I)",
});
```

To translate a whole language, it is easier to work from the full key list than to write
overrides inline. Print it once from a console or a scratch script:

```ts
import { getLang } from "@farena/fa-wysiwyg-react";

console.log(JSON.stringify(getLang("en"), null, 2));
```

Paste the result into a file of your own, translate the values and register it:

```ts
// src/i18n/fa-wysiwyg-fr.ts
export default {
  undo: "Annuler (Ctrl+Z)",
  redo: "Rétablir (Ctrl+Y)",
  alignment: "Alignement du texte",
  // … the rest of the keys from the printed list
};
```

```ts
import { registerLang } from "@farena/fa-wysiwyg-react";
import fr from "./i18n/fa-wysiwyg-fr";

registerLang("fr", fr);
```

The printed list is better than copying keys from documentation, because it always matches the
version you have installed. Start from `'en'` to translate from scratch, or from the closest
language you already have: `getLang('es')` is a better starting point for Catalan than English.

### Correcting a label

`registerLang` merges into the existing dictionary, so the same call can change a single label of
a shipped language without repeating the other keys:

```ts
registerLang("es", {
  bold: "Negrita",
  linkPlaceholder: "https://miempresa.com",
});
```

## Keyboard

| Keys                                | Action                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U`      | Bold / italic / underline                                                                |
| `Ctrl+K`                            | Link                                                                                     |
| `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z` | Undo / redo                                                                              |
| `Enter`                             | New block with the same tag, alignment and indentation. At the end of a heading, creates a paragraph. |
| `Shift+Enter`, `Ctrl+Enter`         | Soft line break (`<br>`)                                                                 |
| `Enter` on an empty list item       | Moves the item out one nesting level; at the top level, moves it out of the list         |
| `Tab` / `Shift+Tab` inside a table  | Next / previous cell; on the last cell, `Tab` adds a row                                 |
| `Backspace` at the start of a block | Merges the block into the previous one                                                   |

On macOS, `Cmd` works wherever `Ctrl` is listed.

Browsers have built-in formatting shortcuts that the editor does not implement, such as
`Ctrl+Shift+X` for strikethrough. These are blocked, because they would insert tags that are not
in the contract.

## The HTML contract

This is the most important part. Everything `getData()` produces and everything the editor
accepts follows this table:

| Feature        | Output                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| bold / italic  | `<strong>` / `<i>`                                                                                    |
| underline      | `<u>`                                                                                                 |
| headings       | `<h2>` `<h3>` `<h4>`; there is no `h1`                                                                |
| alignment      | `style="text-align:center;"` on the block                                                             |
| indentation    | `style="margin-left:40px;"` on the block: 40 px per level, up to 10. A list item nests instead.       |
| font family    | `<span style="font-family:'Courier New', Courier, monospace;">`: 8 families plus the default          |
| font size      | **classes**: `text-tiny` `text-small` `text-big` `text-huge`                                          |
| font color     | `<span style="color:hsl(0,75%,60%);">`: a palette of 15, plus any color already in the data           |
| link           | `<a target="_blank" rel="noopener noreferrer" href="...">`, in that order; default protocol `http://` |
| lists          | `<ul><li>` / `<ol><li>`; an item with more than one block keeps them (`<li><p>a</p><p>b</p></li>`)    |
| nested lists   | the sublist goes inside the item above it, up to 10 levels: `<ul><li>One<ul><li>Nested</li></ul></li></ul>` |
| table          | `<figure class="table"><table><tbody><tr><td>`; a header row goes in `<thead>` with `<th>`            |
| mention        | `<span class="mention" data-mention="#foo">#foo</span>`                                               |
| soft break     | `<br>`                                                                                                |
| empty document | `''`: an empty string, not `<p></p>`                                                                  |

These normalization rules are as much part of the contract as the tags:

- Inline formats always serialize in the same nesting order, `a` > `span` > `u` > `i` > `strong`,
  whatever order they were applied in. Inside the span, `color` comes before `font-family`.
- All font attributes are combined in one `<span>`, never in nested ones.
- Runs of spaces collapse to one. A space next to a `<br>` becomes `&nbsp;`, and a space at the
  end of a block is dropped.
- An empty block is stored with `&nbsp;` (`<p>&nbsp;</p>`, or `<p>text<br>&nbsp;</p>` when it
  ends in a break), so the empty line survives outside the editor. An empty **list item** is the
  exception: it is stored as `<li></li>`, because its marker already gives the line its height.
- Inline `font-size` and `background-color` are discarded. `font-family` is kept only when it
  exactly matches one of the configured families.
- Color values are compacted: `hsl(0, 75%, 60%)` is stored as `hsl(0,75%,60%)`.
- A block's `style` keeps only `text-align` and `margin-left`, in that order. Anything else, such
  as a stray `padding` from older content, is dropped.
- `margin-left` is rounded to the nearest indentation level. A value that is not a positive
  length in `px` is dropped. This includes `margin-left:0px`, which other editors write to mean
  "not indented".
- Indenting a paragraph or a heading writes that margin. Indenting a **list item** nests it
  instead: the item moves into a sublist of the same type inside the item above it. The indent
  button only ever produces that structure. A `margin-left` on an `<li>` is still read and kept, so
  documents written by older editors survive unchanged; outdenting the item removes it. The first
  item of a list cannot be indented, because there is no item above it to nest into.

When the [lab](https://farena.github.io/fa-wysiwyg-react/) loads, it runs a round-trip over this
whole table, so you can see the contract hold instead of taking it on trust. You can also paste
your own stored documents into it to check that they survive unchanged.

Anything outside the contract is removed on load and on paste. Content pasted from Word or Google
Docs goes through the same filter, so `<o:p>`, `mso-*` classes, wrapper `<div>`s and inline
styles that are not on the list are removed.

### Security

All HTML goes through [DOMPurify](https://github.com/cure53/DOMPurify) twice:

- **On the way in** (the `value` prop and paste), DOMPurify removes anything dangerous before the
  contract filter runs. This covers `<script>`, event handlers such as `onerror`, `javascript:`
  URLs, SVG and MathML, and the mutation-XSS tricks DOMPurify is maintained against.
- **On the way out** (`onChange` and `getData()`), the serialized HTML is purified again against
  an allow-list of exactly the tags and attributes in the contract. Even if a bug let something
  else through the editor, it cannot reach your application.

The HTML you receive is therefore already purified. Parsing uses inert documents, so no script
runs and no `<img src>` is fetched while sanitizing.

## Styling

Every variable the editor reads has a fallback, so it is fully styled with no configuration.
Set the variables to match your theme.

| Variable                                                                        | Default                                  | Controls                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `--font-family`                                                                 | system stack                             | Content typeface                          |
| `--font-size`                                                                   | `14px`                                   | Content size                              |
| `--body-text`                                                                   | `hsl(0, 0%, 37%)`                        | Content color                             |
| `--color-primary`                                                               | `hsl(218.1, 100%, 58%)`                  | Focus ring and link preview               |
| `--radius`                                                                      | `2px`                                    | Corner radius                             |
| `--fa-wysiwyg-mention-background`                                               | `hsla(341, 100%, 30%, 0.1)`              | Mention background                        |
| `--fa-wysiwyg-mention-text`                                                     | `hsl(341, 100%, 30%)`                    | Mention text                              |
| `--fa-wysiwyg-padding`                                                          | `0.5em 1em`                              | Editable area padding                     |
| `--fa-wysiwyg-min-height`                                                       | `100px`                                  | Minimum height                            |
| `--fa-wysiwyg-height`                                                           | `auto`                                   | Fixed height, to force internal scrolling |
| `--fa-wysiwyg-font-size`                                                        | `10px`                                   | Base size the toolbar is sized from       |
| `--fa-wysiwyg-btn-size`                                                         | `2.3em`                                  | Toolbar button size                       |
| `--fa-wysiwyg-border`                                                           | `hsl(220, 6%, 81%)`                      | Container, toolbar and panel borders      |
| `--fa-wysiwyg-bg`                                                               | `#fff`                                   | Editor background                         |
| `--fa-wysiwyg-toolbar-bg`                                                       | `hsl(0, 0%, 98%)`                        | Toolbar background                        |
| `--fa-wysiwyg-text`                                                             | `hsl(0, 0%, 20%)`                        | Toolbar and panel text                    |
| `--fa-wysiwyg-btn-hover-bg`                                                     | `hsl(0, 0%, 94.1%)`                      | Button hover                              |
| `--fa-wysiwyg-btn-on-bg`                                                        | `hsl(212, 100%, 97.1%)`                  | Active button background                  |
| `--fa-wysiwyg-btn-on-text`                                                      | `hsl(218.1, 100%, 58%)`                  | Active button text                        |
| `--fa-wysiwyg-focus-ring`                                                       | `1px solid var(--color-primary)`         | Focus ring                                |
| `--fa-wysiwyg-radius`                                                           | `var(--radius)`                          | Editor and panel radius                   |
| `--fa-wysiwyg-shadow`                                                           | `0 1px 2px 1px hsla(220, 6%, 10%, 0.15)` | Panel shadow                              |
| `--fa-wysiwyg-spacing`, `--fa-wysiwyg-spacing-small`, `--fa-wysiwyg-spacing-tiny` | `0.6em`, `0.3em`, `0.18em`               | Toolbar spacing                           |
| `--fa-wysiwyg-scrollbar`                                                        | `hsl(220, 6%, 70%)`                      | Toolbar scrollbar thumb                   |
| `--fa-wysiwyg-scrollbar-size`                                                   | `0.5em`                                  | Toolbar scrollbar thickness               |

Set them wherever suits you. `:root` is the only place that reaches everything, including the
panels and balloons: those are portaled to `<body>`, so they inherit nothing from the editor.

```css
:root {
  --color-primary: #6b46c1;
  --radius: 6px;
  --fa-wysiwyg-toolbar-bg: #faf5ff;
}
```

To style a single instance, pass a `className` and set the variables on it. The panels portaled
to `<body>` keep the global values:

```tsx
<FaWysiwyg className="bio-editor" value={html} onChange={setHtml} />
```

```css
.bio-editor {
  --fa-wysiwyg-min-height: 300px;
}
```

A fixed height with internal scrolling:

```css
.bio-editor {
  --fa-wysiwyg-height: 240px;
}
```

Class names use the prefix `.fa-wysiwyg__*` for elements inside the component and
`.fa-wysiwyg-*` for elements portaled to `<body>`.

## Rendering content outside the editor

The stylesheet also contains the styles for the **generated content**. They are deliberately not
scoped to the editor:

- `.text-tiny`, `.text-small`, `.text-big`, `.text-huge`
- `.mention`
- `figure.table` and everything inside it

Wherever you render a stored document, import the stylesheet as well and the document looks the
same as it did in the editor:

```tsx
import "@farena/fa-wysiwyg-react/style.css";

<div dangerouslySetInnerHTML={{ __html: article.body }} />;
```

If these styles were scoped to the editor, a document would change appearance as soon as it was
rendered anywhere else.

Everything the editor returns is already purified (see [Security](#security)). However,
`dangerouslySetInnerHTML` renders whatever it is given. If HTML can reach your database by any
path other than this editor, such as an import or a direct API write, purify it before rendering
it, for example with `DOMPurify.sanitize()`.

There is one known class collision. The contract stores tables as `<figure class="table">`, and
`.table` is also a Bootstrap class. The rules here target `figure.table` so they win on
specificity. If you use another framework that styles a bare `.table`, check that its rules do
not take precedence.

## Icons

The toolbar draws its own icons. There is no icon font to load and no CDN involved. Every icon is
an inline `<svg>` with a `viewBox` and a single `path`, both included in the bundle:

```html
<svg class="fa-wysiwyg__icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
  <path d="M0 64C0 46.3 …" />
</svg>
```

What this means in practice:

- **Icons follow the text.** `fill: currentColor` and `height: 1em` give each icon the color and
  size of its button, the same as a font glyph. `--fa-wysiwyg-font-size` scales the whole
  toolbar, icons included.
- **All 27 icons are inside the JS bundle.** There is no extra request, and nothing breaks when a
  CDN is down or a Content-Security-Policy blocks external resources.
- **Icons are decorative.** Every button already has a `title` and an `aria-label`, so the
  `<svg>` is `aria-hidden`.

## Known limitations

Here is what the editor does not do:

- **Three built-in languages** (English, Spanish and Portuguese). For any other language, write a
  dictionary and pass it to `registerLang`; see [Adding a language](#adding-a-language).
- **No rectangular cell selection.** You cannot drag across several cells to format them
  together. Cells are merged one at a time from the table balloon.
- **Undo is grouped by typing burst**, not by operation, so one `Ctrl+Z` can undo a whole
  sentence.
- **No keyboard navigation of the toolbar.** Buttons have `title` and `aria-label`, but there is
  no roving tabindex.
- **No image upload.** A `<figure class="image">` already present in a document is kept on load,
  but there is no way to insert one.
- **Drag and drop from outside the editor is blocked.** A drop is cancelled, not sanitized.

## License

MIT.

The icon artwork is [Font Awesome Free 6](https://fontawesome.com) (solid), used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Only the 27 paths the toolbar uses
are included; see [Icons](#icons).
