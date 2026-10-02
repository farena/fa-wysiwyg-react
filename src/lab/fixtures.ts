export interface Fixture {
  name: string;
  html: string;
  out?: string;
}

/**
 * Round-trip corpus.
 *
 * Every sample is HTML in the exact shape the editor's contract defines. The
 * guarantee they all have to meet is `getData(setData(html)) === html`: when it
 * fails, opening a form and saving it without touching anything silently
 * rewrites what is stored in the database.
 *
 * A sample with an `out` is one where the input is not canonical: it documents
 * what the editor normalizes it to.
 */
export const CONTRACT_FIXTURES: Fixture[] = [
  { name: "empty", html: "" },
  { name: "simple paragraph", html: "<p>Hello world</p>" },
  { name: "multiple paragraphs", html: "<p>One</p><p>Two</p><p>Three</p>" },
  {
    name: "empty paragraph between content",
    html: "<p>One</p><p>&nbsp;</p><p>Two</p>",
  },
  { name: "bold", html: "<p>Text <strong>in bold</strong> plain</p>" },
  { name: "italic", html: "<p>Text <i>in italic</i> plain</p>" },
  { name: "underline", html: "<p>Text <u>underlined</u> plain</p>" },
  {
    name: "underlined link",
    html: '<p><a target="_blank" rel="noopener noreferrer" href="http://a.com"><u>Ticket</u></a> and <u>more</u></p>',
  },
  { name: "headings", html: "<h2>One</h2><h3>Two</h3><h4>Three</h4>" },
  { name: "alignment", html: '<p style="text-align:center;">Centered</p>' },
  {
    name: "alignment on a heading",
    html: '<h2 style="text-align:right;">To the right</h2>',
  },
  {
    name: "font family",
    html: "<p><span style=\"font-family:'Courier New', Courier, monospace;\">Monospaced</span></p>",
  },
  {
    name: "font family without quotes",
    html: '<p><span style="font-family:Georgia, serif;">Serif</span></p>',
  },
  { name: "font size", html: '<p><span class="text-big">Big</span></p>' },
  {
    name: "font size tiny",
    html: '<p><span class="text-tiny">Tiny</span></p>',
  },
  {
    name: "font color",
    html: '<p><span style="color:hsl(0,75%,60%);">Red</span></p>',
  },
  // Color values are compacted on serialization; font-family values are not.
  {
    name: "spaced color is compacted",
    html: '<p><span style="color:hsl(0, 75%, 60%);">Red</span></p>',
    out: '<p><span style="color:hsl(0,75%,60%);">Red</span></p>',
  },
  {
    // Font attributes collapse into a single span, with the color always before
    // the family, regardless of the order they were applied in.
    name: "color and family in one span",
    html: '<p><span style="color:hsl(240,75%,60%);font-family:Verdana, Geneva, sans-serif;">Blue Verdana</span></p>',
  },
  {
    name: "nested color and family collapse",
    html: '<p><span style="font-family:Verdana, Geneva, sans-serif;"><span style="color:hsl(240,75%,60%);">Blue Verdana</span></span></p>',
    out: '<p><span style="color:hsl(240,75%,60%);font-family:Verdana, Geneva, sans-serif;">Blue Verdana</span></p>',
  },
  {
    name: "canonical inline nesting order",
    html: "<p><strong>Both <i>at once</i></strong></p>",
    out: "<p><strong>Both </strong><i><strong>at once</strong></i></p>",
  },
  {
    name: "underline outside italic and bold",
    html: "<p><u>All <i><strong>three</strong></i></u></p>",
  },
  {
    name: "underline inside bold is reordered",
    html: "<p><strong><u>Both</u></strong></p>",
    out: "<p><u><strong>Both</strong></u></p>",
  },
  {
    name: "indented paragraph",
    html: '<p style="margin-left:40px;">One step in</p>',
  },
  {
    name: "deeper indentation",
    html: '<p style="margin-left:120px;">Three steps in</p>',
  },
  {
    name: "indented heading",
    html: '<h3 style="margin-left:40px;">Title</h3>',
  },
  {
    name: "indented list item",
    html: '<ul><li>Flush</li><li style="margin-left:40px;">In</li></ul>',
  },
  {
    // Alignment before indentation, whichever order they were applied in.
    name: "aligned and indented",
    html: '<p style="text-align:center;margin-left:80px;">Both</p>',
  },
  {
    name: "indentation before alignment is reordered",
    html: '<p style="margin-left:80px;text-align:center;">Both</p>',
    out: '<p style="text-align:center;margin-left:80px;">Both</p>',
  },
  {
    // The noise every CKEditor document carries: it stands for no indentation.
    name: "zero margin is dropped",
    html: '<p style="margin-left:0px;">Flush</p>',
    out: "<p>Flush</p>",
  },
  {
    name: "margin between levels is quantized",
    html: '<p style="margin-left:37px;">Almost one step</p>',
    out: '<p style="margin-left:40px;">Almost one step</p>',
  },
  {
    name: "margin in another unit is dropped",
    html: '<p style="margin-left:2em;">Flush</p>',
    out: "<p>Flush</p>",
  },
  {
    name: "external link",
    html: '<p><a target="_blank" rel="noopener noreferrer" href="http://example.com">Go</a></p>',
  },
  {
    name: "link with text around it",
    html: '<p>See <a target="_blank" rel="noopener noreferrer" href="https://a.com/b?c=1&amp;d=2">this</a> now</p>',
  },
  { name: "bulleted list", html: "<ul><li>One</li><li>Two</li></ul>" },
  { name: "numbered list", html: "<ol><li>First</li><li>Second</li></ol>" },
  {
    name: "list with formatting",
    html: "<ul><li><strong>One</strong></li><li>Two <i>in italic</i></li></ul>",
  },
  {
    name: "empty list item",
    html: "<ul><li>One</li><li></li><li>Two</li></ul>",
  },
  {
    name: "empty list item written with a hard space",
    html: "<ul><li>One</li><li>&nbsp;</li></ul>",
    out: "<ul><li>One</li><li></li></ul>",
  },
  {
    name: "nested list",
    html: "<ul><li>One<ul><li>Nested</li></ul></li><li>Two</li></ul>",
  },
  {
    name: "nested list, three levels",
    html: "<ul><li>One<ul><li>Two<ul><li>Three</li></ul></li></ul></li></ul>",
  },
  {
    name: "numbered list nested in a bulleted one",
    html: "<ul><li>One<ol><li>First</li><li>Second</li></ol></li></ul>",
  },
  {
    name: "item with content, a sublist and siblings",
    html: "<ol><li>One<ol><li>Inner</li></ol></li><li>Two</li></ol>",
  },
  {
    name: "simple table",
    html: '<figure class="table"><table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table></figure>',
  },
  {
    name: "table with a header row",
    html: '<figure class="table"><table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table></figure>',
  },
  {
    name: "table with colspan",
    html: '<figure class="table"><table><tbody><tr><td colspan="2">Wide</td></tr><tr><td>A</td><td>B</td></tr></tbody></table></figure>',
  },
  {
    name: "table with rowspan",
    html: '<figure class="table"><table><tbody><tr><td rowspan="2">Tall</td><td>B</td></tr><tr><td>D</td></tr></tbody></table></figure>',
  },
  {
    name: "mention",
    html: '<p>Hello <span class="mention" data-mention="#name">#name</span>, welcome</p>',
  },
  {
    name: "multiple mentions",
    html: '<p><span class="mention" data-mention="#a">#a</span> and <span class="mention" data-mention="#b">#b</span></p>',
  },
  { name: "line break", html: "<p>First<br>second</p>" },
  { name: "consecutive breaks", html: "<p>One<br><br>two</p>" },
  // The browser's serializer does not escape quotes in text, and neither does
  // the editor: it uses the same innerHTML underneath.
  {
    name: "entities",
    html: "<p>&lt;script&gt; &amp; &quot;quotes&quot;</p>",
    out: '<p>&lt;script&gt; &amp; "quotes"</p>',
  },
  { name: "hard space", html: "<p>Two&nbsp;&nbsp;spaces</p>" },
  { name: "non-ascii text", html: "<p>Grüße, café, naïve, 日本語</p>" },
  {
    name: "legacy pasted image",
    html: '<figure class="image"><img src="https://example.com/a.png"></figure>',
  },
  {
    name: "combined document",
    html:
      "<h2>Title</h2>" +
      '<p style="margin-left:40px;">Indented <u>underlined</u> aside.</p>' +
      '<p style="text-align:justify;">Text <strong>strong</strong> and <i>weak</i>.</p>' +
      '<ul><li>Item with a <span class="text-small">size</span></li></ul>' +
      '<figure class="table"><table><tbody><tr><td>X</td></tr></tbody></table></figure>' +
      '<p><a target="_blank" rel="noopener noreferrer" href="http://end.com">End</a></p>',
  },

  // Structures that come out of editing rather than out of writing HTML by
  // hand. They are the ones most likely to be lost by a careless normalizer.
  {
    name: "list item with several paragraphs",
    html: "<ul><li><p>One</p><p>Two</p></li><li>Three</li></ul>",
  },
  {
    name: "cell with several paragraphs",
    html: '<figure class="table"><table><tbody><tr><td><p>One</p><p>Two</p></td><td>b</td></tr></tbody></table></figure>',
  },
  {
    name: "list item with a heading",
    html: '<ul><li><h4 style="text-align:center;">First</h4></li><li>Second</li></ul>',
  },
  {
    name: "list item with an aligned paragraph",
    html: '<ol><li><p style="text-align:justify;">One</p></li><li><p style="text-align:justify;">Two</p></li></ol>',
  },
  {
    name: "list item with a table",
    html:
      "<ul><li><h4>Title</h4>" +
      '<figure class="table"><table><tbody><tr><td>cell</td></tr></tbody></table></figure>' +
      "<p>Closing</p></li></ul>",
  },
  {
    name: "table with thead",
    html: '<figure class="table"><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>c</td><td>d</td></tr></tbody></table></figure>',
  },
  {
    name: "table with colspan from a split",
    html: '<figure class="table"><table><tbody><tr><td>a</td><td>&nbsp;</td><td>b</td></tr><tr><td colspan="2">c</td><td>d</td></tr></tbody></table></figure>',
  },
  {
    name: "color outside the palette",
    html: '<p><span style="color:#123456;">Text</span></p>',
  },
  {
    // A color picked freehand can arrive with spaces against the parentheses.
    // Reading it back compacts the whole value.
    name: "freehand color with loose spacing",
    html: '<p><span style="color:hsl( 210, 65%, 20% );">Text</span></p>',
    out: '<p><span style="color:hsl(210,65%,20%);">Text</span></p>',
  },
  {
    name: "link without target gets completed",
    html: '<p><a href="http://a.com">Go</a></p>',
    out: '<p><a target="_blank" rel="noopener noreferrer" href="http://a.com">Go</a></p>',
  },
  {
    name: "internal link keeps no target",
    html: '<p><a href="/internal">Go</a></p>',
  },
];

// Real samples from a production database. Fill this in to check the corpus
// against content that actually exists.
export const DATABASE_FIXTURES: Fixture[] = [];

export default [...CONTRACT_FIXTURES, ...DATABASE_FIXTURES];
