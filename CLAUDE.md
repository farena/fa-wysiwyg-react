# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`FaWysiwyg`: a rich-text editor for React 19 whose only runtime dependency is DOMPurify, ported from the Vue 3 package `@farena/fa-editor` (source at `/home/farena/workspace/fa-editor`). When behavior is unclear, the Vue version is the reference: `src/core/` is a near line-by-line TypeScript translation of its `src/core/`, and `src/components/controller.ts` mirrors the `methods` of `FaEditor.vue`.

## Commands

```bash
npm run dev        # lab (index.html → src/main.tsx → src/App.tsx)
npm run build      # tsc -b, then library build to dist/ (ES + UMD + style.css), then .d.ts via tsconfig.lib.json
npm run build:lab  # lab build to dist-lab/
npm run lint       # eslint (includes the React Compiler rules from eslint-plugin-react-hooks v7)
npx tsc --noEmit -p tsconfig.app.json   # type-check only
```

There is no test runner. The regression check is the lab's **Round-trip** card: every sample in `src/lab/fixtures.ts` must satisfy `getData(setData(html)) === (out ?? html)`. It should read N/N (65/65 at the time of writing). Check it in the browser after any change to `src/core/`.

## The HTML contract

The editor's output is stored in databases, so the serialized HTML is a contract: tag set, attribute order, style property order, color format (`hsl(0,75%,60%)` with no spaces), indent step (`margin-left:40px`), font sizes as classes (`text-tiny`…`text-huge`), tables as `<figure class="table">`. `src/core/constants.ts` defines it. Changing any of these values rewrites stored documents. Input that is not canonical is normalized on load, and the normalized value is re-emitted through `onChange`.

Data flow: `setData` (sanitize → normalize → write to DOM) and `getData` (serialize the DOM, removing editing-only artifacts) in `src/core/serialize.ts`. Editing-only artifacts are filler `<br data-fa-filler>`, zero-width spaces used for pending formats, and any class matching `/^fa-wysiwyg(-|__)/`. `guardStructure` (normalize.ts) runs after every mutation.

DOMPurify (`src/core/purify.ts`) runs twice. `purifyInput` runs at the start of `sanitizeHtml` (load and paste) with the default HTML profile plus `target`; it must stay permissive, because the contract sanitizer still has to map `<b>`, `<div>`, `<font>` and similar tags onto the contract. `purifyOutput` runs at the end of `getData` with an allow-list of exactly the contract's tags and attributes. A new tag or attribute in the contract must be added to that allow-list, or it is silently stripped from the output. DOMPurify is external in the library build (`vite.config.ts`).

## Architecture

- **`src/core/`**: framework-agnostic DOM logic. Every edit goes through the Range API, not `execCommand`. Undo is a custom stack (`history.ts`) that stores innerHTML plus selection paths. `commands/` holds inline, block, list, link and table operations. `keys.ts` handles Enter, soft break, and Backspace/Delete at block edges.
- **`src/components/controller.ts`** (`FaWysiwygController`): owns the editable. React renders an empty `<div contenteditable>` and never reconciles its children. The controller keeps DOM references and editing state, and pushes the renderable slice (`EditorView`: toolbar state, balloon flags, mention list) to React through `update(patch)` → `onView`. Reads go through `this.view`, which updates synchronously, so consecutive handlers see each other's writes, as with Vue's reactive `this`.
- **`FaWysiwyg.tsx`**: creates the controller once (`useState(() => new …)`), syncs props through `controller.setProps` in a layout effect, and calls `attach`/`detach` on mount. A `value` prop change reloads the editor only when it differs from the last emitted value (`receive`), which keeps the caret from jumping.
- **`beforeinput`** is bound natively in `attach`. React's `onBeforeInput` is a polyfill with no `inputType`, and the editor depends on `inputType`.
- **Panels and balloons** (`FaDropdown`, `FaBalloon`) are portaled to `<body>` with `position: fixed`, and their scroll listener uses the capture phase. That lets them follow content inside modals and scrolling containers. Balloon anchors are functions (`linkRect`, `tableRect`, `mentionRect`) that return `null` to hide the balloon. `FaBalloon` repositions after every render, like Vue's `updated`.
- **i18n**: `src/core/lang.ts` (`en`/`es`/`pt`, plus `registerLang`). Components read the translator from `TranslatorContext` (`components/translator.ts`), which reaches through portals. Labels in `constants.ts` are lang keys, never display strings.
- Mousedown handlers in toolbars and panels call `preventDefault` so the editable keeps its selection. Text inputs are the exception. The controller also remembers `lastRange` for commands issued after a panel input took focus.

## Conventions

- **CSS**: `.fa-wysiwyg__*` for elements inside the component, `.fa-wysiwyg-*` for portaled elements, and `--fa-wysiwyg-*` for custom properties. Every `var()` carries a fallback. Content styles (`.text-*`, `.mention`, `figure.table`) are deliberately unscoped so the HTML looks the same when rendered with `dangerouslySetInnerHTML`.
- **Code style**: double quotes and semicolons.
- **TypeScript**: TS 6 has `strict` on by default. `erasableSyntaxOnly` rules out enums and parameter properties, and `verbatimModuleSyntax` requires `import type`.
- **React Compiler lint rules**: they reject mutating objects returned by hooks, so mutate the controller through method calls (`setProps`, `attach`). Intentional exceptions carry a targeted `eslint-disable-next-line` with a reason.
- **Invisible characters**: write them as escapes (`"​"`, `" "`), never as literals. Some file-writing tools turn the escapes into literal characters, and eslint then fails with `no-irregular-whitespace`.
