import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content");
const kjv = JSON.parse(fs.readFileSync(path.join(root, "data", "isaiah-kjv.json"), "utf8"));
const articleSource = fs.readFileSync(path.join(contentDir, "isaiah-article-series.md"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "scripts", "generate-site.mjs"), "utf8");
const reportOnly = process.argv.includes("--report-only");
const errors = [];

const files = fs.readdirSync(contentDir)
  .filter((name) => /^isaiah-\d+-\d+-commentary\.md$/.test(name))
  .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]));

const stockPatterns = [
  { label: "This verse", pattern: /\bthis verse\b/giu, max: 35 },
  { label: "The verse", pattern: /\bthe verse\b/giu, max: 80 },
  { label: "At the same time", pattern: /\bat the same time\b/giu, max: 30 },
  { label: "not merely", pattern: /\bnot merely\b/giu, max: 20 },
  { label: "not simply", pattern: /\bnot simply\b/giu, max: 15 },
  { label: "For us", pattern: /\bfor us,?\b/giu, max: 20 },
  { label: "For Adventist", pattern: /\bfor Adventist\b/giu, max: 0 },
];

const boilerplatePatterns = [
  /the verse belongs to a carefully built movement/iu,
  /the verse joins the chapter['’]s warning to its invitation/iu,
  /Isaiah makes the reader stand where God['’]s verdict, mercy, and summons/iu,
  /Here Isaiah refuses vagueness and makes the spiritual issue concrete/iu,
  /the line matters because it keeps God['’]s claim from becoming abstract/iu,
  /Isaiah places this detail where doctrine and discipleship meet/iu,
  /Isaiah is shaping perception here, training the reader/iu,
  /Isaiah is teaching the reader how to interpret reality under the Lord['’]s rule/iu,
  /the line keeps the reader from treating the chapter as ancient scenery/iu,
  /the sentence has the feel of a verdict, but also of an invitation/iu,
  /the verse presses faith into practice, where trust can no longer remain theoretical/iu,
  /the verse calls for worship that survives contact with ordinary life/iu,
  /the text keeps pressing toward allegiance, not mere religious interest/iu,
];

const genericEndingPattern = /\b(?:(?:this|the) verse (?:calls|invites|asks|reminds|teaches|warns|presses)|for (?:us|believers|the church),?|we (?:must|should|need to)|the reader is invited)\b/iu;
const disclaimerPattern = /\b(?:does not mean|does not say|must not|should not|cannot be used|never be used|is not permission|does not authorize)\b/giu;
const contrastPattern = /\bnot\b[^.!?]{0,110}\bbut\b/giu;

function words(value) {
  return value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? [];
}

function normalize(value) {
  return words(value).join(" ").toLocaleLowerCase();
}

function countMatches(value, pattern) {
  pattern.lastIndex = 0;
  return [...value.matchAll(pattern)].length;
}

function splitSentences(value) {
  return value
    .replace(/\s+/gu, " ")
    .split(/(?<=[.!?])\s+(?=[“"']?[A-Z0-9])/gu)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function ngrams(value, size = 4) {
  const tokens = words(value).map((word) => word.toLocaleLowerCase());
  const result = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join(" "));
  }
  return result;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  for (const value of smaller) if (larger.has(value)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function coefficientOfVariation(values) {
  const average = mean(values);
  if (!average) return 0;
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) / average;
}

function parseNotes(markdown, file) {
  const matches = [...markdown.matchAll(/^## Isaiah (\d+):(\d+)\s*$/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end).trim();
    const paragraphs = body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    return {
      key: `Isaiah ${match[1]}:${match[2]}`,
      chapter: Number(match[1]),
      verse: Number(match[2]),
      file,
      body,
      paragraphs,
      sentences: splitSentences(body),
      wordCount: words(body).length,
      disclaimerCount: countMatches(body, disclaimerPattern),
      genericEnding: genericEndingPattern.test(paragraphs.at(-1) ?? ""),
      grams: ngrams(body),
    };
  });
}

const notes = files.flatMap((file) => parseNotes(fs.readFileSync(path.join(contentDir, file), "utf8"), file));
const expectedKeys = new Set(kjv.chapters.flatMap((chapter) =>
  chapter.verses.map((verse) => `Isaiah ${chapter.chapter}:${verse.verse}`),
));
const actualKeys = notes.map((note) => note.key);
const actualKeySet = new Set(actualKeys);

const articleCount = (articleSource.match(/^## (?!#)/gmu) ?? []).length;
const visibleApplicationHeadings = articleSource.match(
  /^###\s+(?:Application|Practical Application|What This Means for Us Today)\s*$/gmu,
) ?? [];
const introSectionIds = [...generatorSource.matchAll(/<section class="intro-section" id="([^"]+)"/gu)]
  .map((match) => match[1]);
const expectedIntroSectionIds = [
  "purpose",
  "prophet",
  "setting",
  "crisis",
  "unity",
  "shape",
  "themes",
  "reading",
  "begin",
];
const phraseLibraryBlock = generatorSource.match(
  /const phraseNoteLibrary = \[([\s\S]*?)\n\];\n\nconst phraseNoteAnchors/,
)?.[1] ?? "";
const phraseAnchorBlock = generatorSource.match(
  /const phraseNoteAnchors = \{([\s\S]*?)\n\};\n\nconst phraseNotesForVerse/,
)?.[1] ?? "";
const phraseTemplateNames = [...phraseLibraryBlock.matchAll(/\n\s*\{\n\s*phrase:\s*"([^"]+)"/gu)]
  .map((match) => match[1]);
const phraseAnchorNames = [...phraseAnchorBlock.matchAll(/^\s{2}(?:"([^"]+)"|([A-Za-z][A-Za-z0-9]*)):\s*\[/gmu)]
  .map((match) => match[1] || match[2]);
const phraseAnchorReferences = [...phraseAnchorBlock.matchAll(/Isaiah \d+:\d+/gu)]
  .map((match) => match[0]);
const unanchoredPhraseTemplates = phraseTemplateNames.filter((name) => !phraseAnchorNames.includes(name));
const orphanedPhraseAnchors = phraseAnchorNames.filter((name) => !phraseTemplateNames.includes(name));

if (notes.length !== 1292) errors.push(`Expected 1,292 verse notes; found ${notes.length}.`);
if (actualKeySet.size !== actualKeys.length) errors.push("Duplicate Isaiah verse headings were found.");
const missing = [...expectedKeys].filter((key) => !actualKeySet.has(key));
const extra = [...actualKeySet].filter((key) => !expectedKeys.has(key));
if (missing.length || extra.length) errors.push(`Heading mismatch: missing=${missing.slice(0, 10)}, extra=${extra.slice(0, 10)}.`);
if (articleCount !== 15) errors.push(`Expected 15 Isaiah articles; found ${articleCount}.`);
if (visibleApplicationHeadings.length) {
  errors.push(`${visibleApplicationHeadings.length} visible application heading(s) remain in the article series.`);
}
if (introSectionIds.join("|") !== expectedIntroSectionIds.join("|")) {
  errors.push(`Introduction section mismatch: found ${introSectionIds.join(", ")}.`);
}
if (phraseTemplateNames.length !== 36) {
  errors.push(`Expected 36 word/phrase templates; found ${phraseTemplateNames.length}.`);
}
if (phraseAnchorNames.length !== 36) {
  errors.push(`Expected 36 explicit word/phrase anchor groups; found ${phraseAnchorNames.length}.`);
}
if (unanchoredPhraseTemplates.length || orphanedPhraseAnchors.length) {
  errors.push(
    `Word/phrase anchor mismatch: unanchored=${unanchoredPhraseTemplates.join(", ")}; orphaned=${orphanedPhraseAnchors.join(", ")}.`,
  );
}
const invalidPhraseAnchorReferences = phraseAnchorReferences.filter((reference) => !expectedKeys.has(reference));
if (invalidPhraseAnchorReferences.length) {
  errors.push(`Invalid word/phrase anchor references: ${[...new Set(invalidPhraseAnchorReferences)].join(", ")}.`);
}

for (const note of notes) {
  if (!note.paragraphs.length) errors.push(`${note.key} has no commentary.`);
  if (note.wordCount < 35) errors.push(`${note.key} is unexpectedly short (${note.wordCount} words).`);
  if (note.wordCount > 450) errors.push(`${note.key} is unexpectedly long (${note.wordCount} words).`);
  if (/ {2,}/u.test(note.body)) errors.push(`${note.key} contains repeated spaces.`);
  for (const pattern of boilerplatePatterns) {
    if (pattern.test(note.body)) errors.push(`${note.key} retains a stock filler paragraph.`);
  }
}

const allText = notes.map((note) => note.body).join("\n");
for (const item of stockPatterns) {
  item.count = countMatches(allText, item.pattern);
  if (item.label === "For Adventist" && item.count > item.max) {
    errors.push(`${item.label} occurs ${item.count} times; denominational address must remain absent.`);
  }
}

const chapterReports = [];
for (const chapter of kjv.chapters) {
  const chapterNotes = notes.filter((note) => note.chapter === chapter.chapter);
  const lengths = chapterNotes.map((note) => note.wordCount);
  const cv = coefficientOfVariation(lengths);
  const paragraphFrequency = new Map();
  for (const note of chapterNotes) {
    paragraphFrequency.set(note.paragraphs.length, (paragraphFrequency.get(note.paragraphs.length) ?? 0) + 1);
  }
  const dominant = [...paragraphFrequency.entries()].sort((left, right) => right[1] - left[1])[0] ?? [0, 0];
  chapterReports.push({ chapter: chapter.chapter, cv, dominantParagraphCount: dominant[0], dominantNotes: dominant[1] });
}

const duplicateSentences = new Map();
const duplicateParagraphs = new Map();
for (const note of notes) {
  for (const sentence of note.sentences) {
    if (words(sentence).length < 16) continue;
    const key = normalize(sentence);
    const entry = duplicateSentences.get(key) ?? { count: 0, refs: new Set() };
    entry.count += 1;
    entry.refs.add(note.key);
    duplicateSentences.set(key, entry);
  }
  for (const paragraph of note.paragraphs) {
    if (words(paragraph).length < 30) continue;
    const key = normalize(paragraph);
    const entry = duplicateParagraphs.get(key) ?? { count: 0, refs: new Set() };
    entry.count += 1;
    entry.refs.add(note.key);
    duplicateParagraphs.set(key, entry);
  }
}
const repeatedSentences = [...duplicateSentences.values()].filter((entry) => entry.count > 1);
const repeatedParagraphs = [...duplicateParagraphs.values()].filter((entry) => entry.count > 1);
if (repeatedSentences.length) errors.push(`${repeatedSentences.length} substantial sentence(s) are repeated.`);
if (repeatedParagraphs.length) errors.push(`${repeatedParagraphs.length} substantial paragraph(s) are repeated.`);

const adjacentSimilarity = [];
for (let index = 1; index < notes.length; index += 1) {
  const previous = notes[index - 1];
  const current = notes[index];
  if (previous.chapter !== current.chapter || Math.min(previous.wordCount, current.wordCount) < 70) continue;
  const score = jaccard(previous.grams, current.grams);
  if (score >= 0.42) adjacentSimilarity.push({ left: previous.key, right: current.key, score });
}
const severeAdjacent = adjacentSimilarity.filter((item) => item.score >= 0.62);
if (severeAdjacent.length) errors.push(`${severeAdjacent.length} adjacent note pair(s) retain severe phrase-level similarity.`);

const bands = new Map();
for (const note of notes) {
  const start = Math.floor(note.wordCount / 25) * 25;
  bands.set(start, (bands.get(start) ?? 0) + 1);
}
const densestBand = [...bands.entries()].sort((left, right) => right[1] - left[1])[0] ?? [0, 0];
const genericEndingCount = notes.filter((note) => note.genericEnding).length;
const denseDisclaimerNotes = notes.filter((note) => note.disclaimerCount >= 4);

const report = {
  notes: notes.length,
  teachingSurfaces: {
    articles: articleCount,
    visibleApplicationHeadings: visibleApplicationHeadings.length,
    introductionSections: introSectionIds.length,
    phraseNoteTemplates: phraseTemplateNames.length,
    phraseNoteAnchorGroups: phraseAnchorNames.length,
    phraseNoteAnchorReferences: phraseAnchorReferences.length,
  },
  totalWords: notes.reduce((sum, note) => sum + note.wordCount, 0),
  averageWords: Number(mean(notes.map((note) => note.wordCount)).toFixed(1)),
  averageParagraphs: Number(mean(notes.map((note) => note.paragraphs.length)).toFixed(2)),
  paragraphDistribution: Object.fromEntries([...new Set(notes.map((note) => note.paragraphs.length))]
    .sort((a, b) => a - b)
    .map((count) => [count, notes.filter((note) => note.paragraphs.length === count).length])),
  densestWordBand: { start: densestBand[0], end: densestBand[0] + 24, notes: densestBand[1] },
  stockCounts: Object.fromEntries(stockPatterns.map((item) => [item.label, item.count])),
  contrastCount: countMatches(allText, contrastPattern),
  genericEndingCount,
  denseDisclaimerNotes: denseDisclaimerNotes.length,
  repeatedSentences: repeatedSentences.length,
  repeatedParagraphs: repeatedParagraphs.length,
  repeatedSentenceSamples: [...duplicateSentences.entries()]
    .filter(([, entry]) => entry.count > 1)
    .slice(0, 10)
    .map(([text, entry]) => ({ text, refs: [...entry.refs] })),
  repeatedParagraphSamples: [...duplicateParagraphs.entries()]
    .filter(([, entry]) => entry.count > 1)
    .slice(0, 10)
    .map(([text, entry]) => ({ text, refs: [...entry.refs] })),
  adjacentSimilarityFlags: adjacentSimilarity.length,
  severeAdjacentSimilarity: severeAdjacent.length,
  mostUniformChapters: chapterReports.sort((left, right) => left.cv - right.cv).slice(0, 10)
    .map((item) => ({ ...item, cv: Number(item.cv.toFixed(3)) })),
  shortest: [...notes].sort((left, right) => left.wordCount - right.wordCount).slice(0, 10)
    .map(({ key, wordCount }) => ({ key, words: wordCount })),
  longest: [...notes].sort((left, right) => right.wordCount - left.wordCount).slice(0, 10)
    .map(({ key, wordCount }) => ({ key, words: wordCount })),
};

console.log(JSON.stringify(report, null, 2));

if (errors.length && !reportOnly) {
  console.error(`Humanization audit failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
  errors.slice(0, 80).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 80) console.error(`- ...and ${errors.length - 80} more.`);
  process.exit(1);
}

if (!errors.length) console.error("Isaiah natural-flow commentary audit passed.");
