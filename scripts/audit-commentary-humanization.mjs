import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content');
const files = fs.readdirSync(contentDir)
  .filter((name) => /^isaiah-\d+-\d+-commentary\.md$/.test(name))
  .sort((a, b) => {
    const an = Number(a.match(/^isaiah-(\d+)/)?.[1] || 0);
    const bn = Number(b.match(/^isaiah-(\d+)/)?.[1] || 0);
    return an - bn;
  });

const stockPatterns = [
  'This verse',
  'The verse',
  'The line contributes',
  'The question form matters',
  'The opening line frames',
  'The chapter holds',
  'The sentence keeps',
  'The prophet lets',
  'The verse advances',
  'The verse is part',
  'At the same time',
  'not merely',
  'not simply',
  'not only',
  'This does not mean',
  'does not mean',
  'For us,',
  'For Adventist',
];

function parseNotes(markdown, file) {
  const matches = [...markdown.matchAll(/^## Isaiah (\d+):(\d+)\s*$/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end).trim();
    const paragraphs = body.split(/\n{2,}/).filter(Boolean);
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      key: `Isaiah ${match[1]}:${match[2]}`,
      file,
      words,
      paragraphs: paragraphs.length,
      body,
    };
  });
}

const notes = files.flatMap((file) => parseNotes(fs.readFileSync(path.join(contentDir, file), 'utf8'), file));
const wordCounts = notes.map((note) => note.words).sort((a, b) => a - b);
const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
const median = wordCounts[Math.floor(wordCounts.length / 2)] || 0;
const avg = Math.round(totalWords / Math.max(notes.length, 1));

const stockCounts = stockPatterns.map((pattern) => {
  const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const count = notes.reduce((sum, note) => sum + (note.body.match(regex) || []).length, 0);
  return { pattern, count };
}).filter((item) => item.count > 0);

const lengthBands = {
  under150: notes.filter((note) => note.words < 150).length,
  from150to249: notes.filter((note) => note.words >= 150 && note.words <= 249).length,
  from250to449: notes.filter((note) => note.words >= 250 && note.words <= 449).length,
  from450to699: notes.filter((note) => note.words >= 450 && note.words <= 699).length,
  over700: notes.filter((note) => note.words > 700).length,
};

const paragraphs = new Map();
for (const note of notes) {
  for (const paragraph of note.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (paragraph.length < 80) continue;
    const normalized = paragraph.replace(/\s+/g, ' ').toLowerCase();
    paragraphs.set(normalized, (paragraphs.get(normalized) || 0) + 1);
  }
}
const repeatedParagraphs = [...paragraphs.entries()]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([paragraph, count]) => ({ count, paragraph: `${paragraph.slice(0, 180)}${paragraph.length > 180 ? '...' : ''}` }));

const shortest = [...notes].sort((a, b) => a.words - b.words).slice(0, 15)
  .map((note) => ({ key: note.key, words: note.words, file: note.file }));
const longest = [...notes].sort((a, b) => b.words - a.words).slice(0, 15)
  .map((note) => ({ key: note.key, words: note.words, file: note.file }));

const report = {
  notes: notes.length,
  totalWords,
  averageWords: avg,
  medianWords: median,
  lengthBands,
  stockCounts,
  repeatedParagraphs,
  shortest,
  longest,
};

console.log(JSON.stringify(report, null, 2));
