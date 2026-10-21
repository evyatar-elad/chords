// Run with: deno test supabase/functions/scrape-song/parser.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseSongFromHtml, tokenizeChordLabel } from "./parser.ts";

const chord = (c: string) => `<span onmouseover="sCI('${c}')" class="c_C">${c}</span>`;
const page = (content: string, extra = "") => `<html><head><title>x</title></head><body>
<h1><font>אקורדים לשיר שיר של בדיקה של <a class="artistTitle" href="#">אמן אחד</a> ו<a class="artistTitle" href="#">אמנית</a></font></h1>
${extra}
<div id="songContentTPL" align="right">${content}</div><div id="after"></div></body></html>`;

Deno.test("RTL chord columns are mirrored against the right-aligned chord row", () => {
  // chord row " Am  G   " (9 cols, LTR, right aligned): Am at k=1, G at k=5
  const html = page(`<table><tr><td class="chords">
    &nbsp;${chord("Am")}&nbsp;&nbsp;${chord("G")}&nbsp;&nbsp;&nbsp;
  </td></tr><tr><td class="song">
    אבגד&nbsp;הוזח&nbsp;&nbsp;&nbsp;
  </td></tr></table>`);
  const song = parseSongFromHtml(html, "");
  assertEquals(song.direction, "rtl");
  assertEquals(song.lines, [
    { type: "lyrics", lyrics: "אבגד הוזח", chords: [{ chord: "G", at: 3 }, { chord: "Am", at: 6 }] },
  ]);
});

Deno.test("English songs (chords_en) keep left-to-right columns", () => {
  const html = page(`<table><tr><td class="chords_en">&nbsp;${chord("Am")}&nbsp;&nbsp;${chord("G")}</td></tr>
    <tr><td class="song">Hello&nbsp;world</td></tr></table>`);
  const song = parseSongFromHtml(html, "");
  assertEquals(song.direction, "ltr");
  assertEquals(song.lines[0], { type: "lyrics", lyrics: "Hello world", chords: [{ chord: "Am", at: 1 }, { chord: "G", at: 5 }] });
});

Deno.test("title, artist, entities and easy version", () => {
  const html = page(
    `<table><tr><td class="song">it&#039;s &quot;ok&quot;</td></tr></table>`,
    `<a class="linkInTopSongMenu h" id='eLinkZ' href="?ton=1.5#song"><img src="x.svg" />גרסה קלה</a>`
  );
  const song = parseSongFromHtml(html, "");
  assertEquals(song.title, "שיר של בדיקה");
  assertEquals(song.artist, "אמן אחד ואמנית");
  assertEquals(song.hasEasyVersion, true);
  assertEquals(song.transposition, 1.5);
  assertEquals(song.lines, [{ type: "lyrics", lyrics: `it's "ok"`, chords: [] }]);
});

Deno.test("sections, chord-only rows with bars, empty lines between blocks", () => {
  const html = page(`<table><tr><td class="song">פתיחה:</td></tr>
    <tr><td class="chords">|&nbsp;${chord("D")}&nbsp;|&nbsp;${chord("Bm")}&nbsp;|&nbsp;x2</td></tr></table>
    <br /><table><tr><td class="song"><span class="titLine">פזמון:</span></td></tr></table>`);
  const song = parseSongFromHtml(html, "");
  assertEquals(song.lines, [
    { type: "section", text: "פתיחה:" },
    {
      type: "chords-only",
      chords: ["D", "Bm"],
      segments: [
        { text: "| " },
        { text: "D", chord: true },
        { text: " | " },
        { text: "Bm", chord: true },
        { text: " | x2" },
      ],
    },
    { type: "empty" },
    { type: "section", text: "פזמון:" },
  ]);
});

Deno.test("a chord row table directly above a tab table becomes the tab's chord row", () => {
  const html = page(`<table align="center"><tr><td class="chords">${chord("C")}&nbsp;&nbsp;&nbsp;${chord("G")}</td></tr></table>
    <table align="center"><tr><td class="tabs">e|-0---3-|</td></tr><tr><td class="tabs">B|-1---0-|</td></tr></table>`);
  const song = parseSongFromHtml(html, "");
  assertEquals(song.lines, [
    {
      type: "tab",
      rows: ["e|-0---3-|", "B|-1---0-|"],
      // "C   G" (5 columns) centered over the 10-column tab
      chords: [{ text: "   " }, { text: "C", chord: true }, { text: "   " }, { text: "G", chord: true }],
    },
  ]);
});

Deno.test("glued chord labels keep their own columns", () => {
  assertEquals(tokenizeChordLabel("E7Am"), [
    { chord: "E7", offset: 0, width: 2 },
    { chord: "Am", offset: 2, width: 2 },
  ]);
  assertEquals(tokenizeChordLabel("Bm7b5").map((t) => t.chord), ["Bm7b5"]);
  assertEquals(tokenizeChordLabel("C/Bb").map((t) => t.chord), ["C/Bb"]);
});
