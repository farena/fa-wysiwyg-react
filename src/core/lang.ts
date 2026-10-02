/**
 * Interface translations.
 *
 * Only what the user reads is here: toolbar tooltips, panel options, color
 * names and the link form. Nothing in this file affects the HTML contract —
 * the values written to the document (`p`, `h2`, `left`, `hsl(...)`, the class
 * names) live in `constants.js` and are the same in every language.
 *
 * Adding a language means adding a dictionary here, or calling `registerLang`
 * from outside the package. Missing keys fall back to English, so a partial
 * dictionary is still usable.
 */

const en: Record<string, string> = {
  // Toolbar
  undo: "Undo (Ctrl+Z)",
  redo: "Redo (Ctrl+Y)",
  alignment: "Text alignment",
  heading: "Heading",
  bold: "Bold (Ctrl+B)",
  italic: "Italic (Ctrl+I)",
  underline: "Underline (Ctrl+U)",
  fontFamily: "Font family",
  fontSize: "Font size",
  fontColor: "Font color",
  insertTable: "Insert table",
  link: "Link (Ctrl+K)",
  numberedList: "Numbered list",
  bulletedList: "Bulleted list",
  indent: "Increase indent",
  outdent: "Decrease indent",

  // Shared
  defaultOption: "Default",
  accept: "Accept",
  cancel: "Cancel",

  // Alignment
  alignLeft: "Align left",
  alignRight: "Align right",
  alignCenter: "Center",
  alignJustify: "Justify",

  // Headings
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",

  // Font sizes
  sizeTiny: "Tiny",
  sizeSmall: "Small",
  sizeBig: "Big",
  sizeHuge: "Huge",

  // Color palette
  removeColor: "Remove color",
  colorPicker: "Color picker",
  hex: "HEX",
  colorBlack: "Black",
  colorDimGrey: "Dim grey",
  colorGrey: "Grey",
  colorLightGrey: "Light grey",
  colorWhite: "White",
  colorRed: "Red",
  colorOrange: "Orange",
  colorYellow: "Yellow",
  colorLightGreen: "Light green",
  colorGreen: "Green",
  colorAquamarine: "Aquamarine",
  colorTurquoise: "Turquoise",
  colorLightBlue: "Light blue",
  colorBlue: "Blue",
  colorPurple: "Purple",

  // Links
  linkPlaceholder: "https://example.com",
  save: "Save",
  editLink: "Edit link",
  unlink: "Unlink",

  // Tables
  column: "Column",
  headerColumn: "Header column",
  insertColumnLeft: "Insert column left",
  insertColumnRight: "Insert column right",
  deleteColumn: "Delete column",
  row: "Row",
  headerRow: "Header row",
  insertRowAbove: "Insert row above",
  insertRowBelow: "Insert row below",
  deleteRow: "Delete row",
  mergeCells: "Merge cells",
  mergeUp: "Merge cell up",
  mergeRight: "Merge cell right",
  mergeDown: "Merge cell down",
  mergeLeft: "Merge cell left",
  splitVertically: "Split cell vertically",
  splitHorizontally: "Split cell horizontally",
  table: "Table",
  deleteTable: "Delete table",
};

const es: Record<string, string> = {
  undo: "Deshacer (Ctrl+Z)",
  redo: "Rehacer (Ctrl+Y)",
  alignment: "Alineación del texto",
  heading: "Encabezado",
  bold: "Negrita (Ctrl+B)",
  italic: "Cursiva (Ctrl+I)",
  underline: "Subrayado (Ctrl+U)",
  fontFamily: "Fuente",
  fontSize: "Tamaño de fuente",
  fontColor: "Color de fuente",
  insertTable: "Insertar tabla",
  link: "Enlace (Ctrl+K)",
  numberedList: "Lista numerada",
  bulletedList: "Lista con viñetas",
  indent: "Aumentar sangría",
  outdent: "Reducir sangría",

  defaultOption: "Predeterminado",
  accept: "Aceptar",
  cancel: "Cancelar",

  alignLeft: "Alinear a la izquierda",
  alignRight: "Alinear a la derecha",
  alignCenter: "Centrar",
  alignJustify: "Justificar",

  paragraph: "Párrafo",
  heading1: "Encabezado 1",
  heading2: "Encabezado 2",
  heading3: "Encabezado 3",

  sizeTiny: "Diminuto",
  sizeSmall: "Pequeño",
  sizeBig: "Grande",
  sizeHuge: "Enorme",

  removeColor: "Quitar color",
  colorPicker: "Selector de color",
  hex: "HEX",
  colorBlack: "Negro",
  colorDimGrey: "Gris oscuro",
  colorGrey: "Gris",
  colorLightGrey: "Gris claro",
  colorWhite: "Blanco",
  colorRed: "Rojo",
  colorOrange: "Naranja",
  colorYellow: "Amarillo",
  colorLightGreen: "Verde claro",
  colorGreen: "Verde",
  colorAquamarine: "Aguamarina",
  colorTurquoise: "Turquesa",
  colorLightBlue: "Celeste",
  colorBlue: "Azul",
  colorPurple: "Violeta",

  linkPlaceholder: "https://ejemplo.com",
  save: "Guardar",
  editLink: "Editar enlace",
  unlink: "Quitar enlace",

  column: "Columna",
  headerColumn: "Columna de encabezado",
  insertColumnLeft: "Insertar columna a la izquierda",
  insertColumnRight: "Insertar columna a la derecha",
  deleteColumn: "Eliminar columna",
  row: "Fila",
  headerRow: "Fila de encabezado",
  insertRowAbove: "Insertar fila arriba",
  insertRowBelow: "Insertar fila abajo",
  deleteRow: "Eliminar fila",
  mergeCells: "Unir celdas",
  mergeUp: "Unir celda de arriba",
  mergeRight: "Unir celda de la derecha",
  mergeDown: "Unir celda de abajo",
  mergeLeft: "Unir celda de la izquierda",
  splitVertically: "Dividir celda verticalmente",
  splitHorizontally: "Dividir celda horizontalmente",
  table: "Tabla",
  deleteTable: "Eliminar tabla",
};

const pt: Record<string, string> = {
  undo: "Desfazer (Ctrl+Z)",
  redo: "Refazer (Ctrl+Y)",
  alignment: "Alinhamento do texto",
  heading: "Título",
  bold: "Negrito (Ctrl+B)",
  italic: "Itálico (Ctrl+I)",
  underline: "Sublinhado (Ctrl+U)",
  fontFamily: "Fonte",
  fontSize: "Tamanho da fonte",
  fontColor: "Cor da fonte",
  insertTable: "Inserir tabela",
  link: "Link (Ctrl+K)",
  numberedList: "Lista numerada",
  bulletedList: "Lista com marcadores",
  indent: "Aumentar recuo",
  outdent: "Diminuir recuo",

  defaultOption: "Padrão",
  accept: "Aceitar",
  cancel: "Cancelar",

  alignLeft: "Alinhar à esquerda",
  alignRight: "Alinhar à direita",
  alignCenter: "Centralizar",
  alignJustify: "Justificar",

  paragraph: "Parágrafo",
  heading1: "Título 1",
  heading2: "Título 2",
  heading3: "Título 3",

  sizeTiny: "Minúsculo",
  sizeSmall: "Pequeno",
  sizeBig: "Grande",
  sizeHuge: "Enorme",

  removeColor: "Remover cor",
  colorPicker: "Seletor de cores",
  hex: "HEX",
  colorBlack: "Preto",
  colorDimGrey: "Cinza escuro",
  colorGrey: "Cinza",
  colorLightGrey: "Cinza claro",
  colorWhite: "Branco",
  colorRed: "Vermelho",
  colorOrange: "Laranja",
  colorYellow: "Amarelo",
  colorLightGreen: "Verde claro",
  colorGreen: "Verde",
  colorAquamarine: "Água-marinha",
  colorTurquoise: "Turquesa",
  colorLightBlue: "Azul claro",
  colorBlue: "Azul",
  colorPurple: "Roxo",

  linkPlaceholder: "https://exemplo.com",
  save: "Salvar",
  editLink: "Editar link",
  unlink: "Remover link",

  column: "Coluna",
  headerColumn: "Coluna de cabeçalho",
  insertColumnLeft: "Inserir coluna à esquerda",
  insertColumnRight: "Inserir coluna à direita",
  deleteColumn: "Excluir coluna",
  row: "Linha",
  headerRow: "Linha de cabeçalho",
  insertRowAbove: "Inserir linha acima",
  insertRowBelow: "Inserir linha abaixo",
  deleteRow: "Excluir linha",
  mergeCells: "Mesclar células",
  mergeUp: "Mesclar célula acima",
  mergeRight: "Mesclar célula à direita",
  mergeDown: "Mesclar célula abaixo",
  mergeLeft: "Mesclar célula à esquerda",
  splitVertically: "Dividir célula verticalmente",
  splitHorizontally: "Dividir célula horizontalmente",
  table: "Tabela",
  deleteTable: "Excluir tabela",
};

const DICTIONARIES: Record<string, Record<string, string>> = { en, es, pt };

/** Lookup function handed down to the panels: a key in, a user-visible string out. */
export type Translator = (key: string) => string;

/**
 * Language codes the editor knows about: the three it ships with plus whatever
 * `registerLang` has added. The array is mutated in place rather than replaced,
 * so the `lang` prop validator — which imported it once — keeps seeing every
 * code registered later.
 */
export const LANGS: string[] = Object.keys(DICTIONARIES);

export const DEFAULT_LANG = "en";

/**
 * Registers a dictionary from outside the package, or extends one that already
 * exists. Keys are merged over the current dictionary, so correcting a single
 * label is as valid a use as adding a whole language:
 *
 *   registerLang('fr', { undo: 'Annuler (Ctrl+Z)' })   // new language
 *   registerLang('es', { bold: 'Negrita' })            // one label changed
 *
 * Whatever is left out keeps falling back to English.
 */
export function registerLang(code: string, dict: Record<string, string>): string {
  DICTIONARIES[code] = { ...DICTIONARIES[code], ...dict };
  if (!LANGS.includes(code)) LANGS.push(code);
  return code;
}

/**
 * A copy of a dictionary, for building a new language on top of an existing
 * one. It is a copy and not the dictionary itself: writing to the result
 * changes nothing until it goes back through `registerLang`.
 *
 *   registerLang('fr', { ...getLang('en'), undo: 'Annuler (Ctrl+Z)' })
 *
 * An unknown code returns English, the same fallback `translator` uses.
 */
export function getLang(code: string): Record<string, string> {
  return { ...(DICTIONARIES[code] || DICTIONARIES[DEFAULT_LANG]) };
}

/**
 * Builds the lookup function handed down to the panels.
 * An unknown code falls back to English rather than throwing: a wrong `lang`
 * should not take the toolbar down.
 */
export function translator(lang: string): Translator {
  const dict = DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANG];
  return (key) => dict[key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
}

/** The default lookup, for a panel rendered outside an editor. */
export const defaultTranslator: Translator = translator(DEFAULT_LANG);
