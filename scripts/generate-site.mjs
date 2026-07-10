import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const kjvPath =
  "/Users/samuel/Documents/Codex/2026-05-15/files-mentioned-by-the-user-christ/data/kjv-ot.json";
const fullKjvTextPath =
  "/Users/samuel/Documents/Codex/2026-06-05/i-want-you-to-create-a/work/kjv-gutenberg-30.txt";
const commentaryPaths = [
  join(root, "content", "isaiah-1-5-commentary.md"),
  join(root, "content", "isaiah-6-10-commentary.md"),
  join(root, "content", "isaiah-11-15-commentary.md"),
  join(root, "content", "isaiah-16-20-commentary.md"),
  join(root, "content", "isaiah-21-25-commentary.md"),
  join(root, "content", "isaiah-26-30-commentary.md"),
  join(root, "content", "isaiah-31-35-commentary.md"),
  join(root, "content", "isaiah-36-40-commentary.md"),
  join(root, "content", "isaiah-41-45-commentary.md"),
  join(root, "content", "isaiah-46-50-commentary.md"),
  join(root, "content", "isaiah-51-55-commentary.md"),
  join(root, "content", "isaiah-56-60-commentary.md"),
  join(root, "content", "isaiah-61-66-commentary.md"),
];
const articleSourcePath = join(root, "content", "isaiah-article-series.md");
const crossReferencePath = join(
  root,
  "research",
  "isaiah-cross-references",
  "isaiah-cross-references.json",
);

const htmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const attr = htmlEscape;

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const parseCommentaryMarkdown = (markdown) => {
  const commentary = {};
  const blocks = markdown.trim().split(/\n(?=## Isaiah \d+:\d+\s*$)/m);

  blocks.forEach((block) => {
    const match = block.match(/^## Isaiah (\d+):(\d+)\s*\n([\s\S]*)$/);
    if (!match) return;

    const [, chapter, verse, body] = match;
    const paragraphs = body
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (!commentary[chapter]) commentary[chapter] = {};
    commentary[chapter][verse] = paragraphs;
  });

  return commentary;
};

const readCommentary = async () => {
  const merged = {};

  for (const path of commentaryPaths) {
    try {
      const commentary = parseCommentaryMarkdown(await readFile(path, "utf8"));
      Object.entries(commentary).forEach(([chapter, verses]) => {
        merged[chapter] = { ...(merged[chapter] || {}), ...verses };
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return merged;
};

const readCrossReferences = async () => {
  try {
    const payload = await readJson(crossReferencePath);
    return payload?.references && typeof payload.references === "object" ? payload.references : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
};

const bibleBookNames = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

const bookAliases = new Map(
  bibleBookNames.flatMap((book) => {
    const aliases = [[book.toLowerCase(), book]];
    if (book === "Psalms") aliases.push(["psalm", book]);
    if (book === "Song of Solomon") aliases.push(["song", book], ["song of songs", book], ["canticles", book]);
    return aliases;
  }),
);

const canonicalBookName = (book) => bookAliases.get(String(book).trim().toLowerCase()) || "";

const parseBibleReference = (reference) => {
  const match = String(reference)
    .trim()
    .match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const [, rawBook, rawChapter, rawStartVerse, rawEndVerse] = match;
  const book = canonicalBookName(rawBook);
  if (!book) return null;

  return {
    book,
    chapter: Number(rawChapter),
    startVerse: Number(rawStartVerse),
    endVerse: rawEndVerse ? Number(rawEndVerse) : Number(rawStartVerse),
  };
};

const readFullBibleVerseLookup = async () => {
  const lookup = new Map();
  const lines = (await readFile(fullKjvTextPath, "utf8")).split(/\r?\n/);
  let currentKey = "";

  for (const line of lines) {
    const match = line.match(/^(\d{2}):(\d{3}):(\d{3})\s+(.*)$/);
    if (match) {
      const [, rawBookNumber, rawChapter, rawVerse, text] = match;
      const book = bibleBookNames[Number(rawBookNumber) - 1];
      currentKey = book ? `${book} ${Number(rawChapter)}:${Number(rawVerse)}` : "";
      if (currentKey) lookup.set(currentKey, text.trim());
      continue;
    }

    if (currentKey && line.trim()) {
      lookup.set(currentKey, `${lookup.get(currentKey)} ${line.trim()}`.replace(/\s+/g, " "));
    }
  }

  return lookup;
};

const slugify = (value) =>
  String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const plainText = (value) =>
  String(value)
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

const truncateText = (value, maxLength = 210) => {
  const text = plainText(value);
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return `${trimmed}...`;
};

const inlineMarkdown = (value) =>
  htmlEscape(String(value).replace(/\s+/g, " ").trim()).replace(
    /\*\*([^*]+)\*\*/g,
    "<strong>$1</strong>",
  );

const parseMarkdownList = (lines, ordered = false) => {
  const items = [];
  let current = "";
  const matcher = ordered ? /^\d+\.\s+(.+)$/ : /^-\s+(.+)$/;

  lines.forEach((line) => {
    const match = line.match(matcher);
    if (match) {
      if (current) items.push(current.trim());
      current = match[1].trim();
      return;
    }

    if (current) current = `${current} ${line.trim()}`.trim();
  });

  if (current) items.push(current.trim());
  return items;
};

const markdownBlocks = (markdown) => {
  const blocks = [];
  let paragraph = [];
  let listType = null;
  let listLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({
      type: "paragraph",
      text: paragraph.join(" ").replace(/\s+/g, " ").trim(),
    });
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || !listLines.length) return;
    blocks.push({
      type: listType,
      items: parseMarkdownList(listLines, listType === "ol"),
    });
    listType = null;
    listLines = [];
  };

  markdown.split("\n").forEach((line) => {
    if (!line.trim()) {
      if (paragraph.length) flushParagraph();
      return;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listLines.push(line);
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listLines.push(line);
      return;
    }

    if (listType && /^\s+/.test(line)) {
      listLines.push(line);
      return;
    }

    flushList();
    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();

  return blocks;
};

const parseArticleBody = (markdown) => {
  const sections = markdown
    .split(/\n(?=### )/)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section) => {
    const match = section.match(/^###\s+(.+)\n([\s\S]*)$/);
    if (!match) {
      return {
        title: "Article",
        id: "article",
        blocks: markdownBlocks(section),
      };
    }

    const [, title, body] = match;
    return {
      title: title.trim(),
      id: slugify(title),
      blocks: markdownBlocks(body),
    };
  });
};

const parseArticlesMarkdown = (markdown) =>
  markdown
    .split(/\n(?=## (?!#))/)
    .map((block) => block.trim())
    .filter((block) => /^## (?!#)/.test(block))
    .map((block, index) => {
      const title = block.match(/^##\s+(.+)$/m)?.[1]?.trim() || `Article ${index + 1}`;
      const seoTitle = block.match(/\*\*SEO Title:\*\*\s*(.+)/)?.[1]?.trim() || title;
      const metaDescription =
        block.match(/\*\*Meta Description:\*\*\s*(.+)/)?.[1]?.trim() || "";
      const slug =
        block.match(/\*\*Suggested URL Slug:\*\*\s*([a-z0-9-]+)/)?.[1]?.trim() ||
        slugify(title);
      const body = block
        .replace(/^##\s+.+\n+/, "")
        .replace(/\*\*SEO Title:\*\*.*\n+/g, "")
        .replace(/\*\*Meta Description:\*\*.*\n+/g, "")
        .replace(/\*\*Suggested URL Slug:\*\*.*\n+/g, "")
        .trim();
      const sections = parseArticleBody(body);
      const shortAnswer =
        sections
          .find((section) => section.title.toLowerCase() === "short answer")
          ?.blocks.find((block) => block.type === "paragraph")?.text || metaDescription;

      return {
        order: index + 1,
        title,
        seoTitle,
        metaDescription,
        slug,
        sections,
        shortAnswer,
      };
    });

const readArticles = async () => {
  try {
    return parseArticlesMarkdown(await readFile(articleSourcePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const ensureDir = (path) => mkdir(path, { recursive: true });

const write = async (path, content) => {
  await ensureDir(dirname(path));
  await writeFile(path, content);
};

const icon = {
  book:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>',
  library:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m16 6 4 14"></path><path d="M12 6v14"></path><path d="M8 8v12"></path><path d="M4 4v16"></path></svg>',
  file:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path><path d="M14 2v6h6"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>',
  list:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>',
  search:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>',
  menu:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"></path><path d="M4 6h16"></path><path d="M4 18h16"></path></svg>',
  plus:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>',
  minus:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>',
  arrowRight:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>',
  arrowLeft:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>',
  chevronDown:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>',
  panel:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M15 3v18"></path><path d="m10 15-3-3 3-3"></path></svg>',
};

const brandMark = `
  <svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true">
    <g>
      <line x1="50" y1="30" x2="50" y2="20"></line>
      <line x1="42" y1="31.5" x2="38.5" y2="22.5"></line>
      <line x1="58" y1="31.5" x2="61.5" y2="22.5"></line>
      <line x1="35" y1="35" x2="28.5" y2="28.5"></line>
      <line x1="65" y1="35" x2="71.5" y2="28.5"></line>
    </g>
    <path d="M50 47 q-13 -6 -24 -3 v27 q11 -3 24 3"></path>
    <path d="M50 47 q13 -6 24 -3 v27 q-11 -3 -24 3"></path>
    <line x1="50" y1="47" x2="50" y2="77"></line>
    <path d="M32 55 q8 -2 15 1 M32 61 q8 -2 15 1 M53 56 q8 -3 15 0 M53 62 q8 -3 15 0"></path>
  </svg>`;

const globalRibbon = `
  <header class="mbe-global-shell" data-tool="isaiah" data-embedded="true">
    <div class="mbe-shell-wrap">
      <div class="mbe-ribbon-left">
        <a class="mbe-ribbon-brand" href="https://mybibleexplorer.com" aria-label="My Bible Explorer home">
          <img class="mbe-ribbon-logo" src="/assets/my-bible-explorer-logo.png" alt="My Bible Explorer">
        </a>
        <a class="mbe-ribbon-back" href="https://mybibleexplorer.com/#journeys">Back to Library</a>
      </div>
      <nav class="mbe-global-nav" aria-label="My Bible Explorer">
        <details class="mbe-library-menu">
          <summary class="mbe-library-toggle">Library</summary>
          <div class="mbe-library-panel">
            <div class="mbe-library-grid">
              <a class="mbe-library-item" href="https://hermeneutics.mybibleexplorer.com"><span class="mbe-library-name">Hermeneutics</span><span class="mbe-library-desc">Learn to read Scripture faithfully</span></a>
              <a class="mbe-library-item" href="https://psalms.mybibleexplorer.com"><span class="mbe-library-name">Psalms</span><span class="mbe-library-desc">Worship, lament, praise, and prayer</span></a>
              <a class="mbe-library-item" href="https://daniel.mybibleexplorer.com"><span class="mbe-library-name">Daniel</span><span class="mbe-library-desc">Prophecy and providence</span></a>
              <a class="mbe-library-item" href="https://isaiah.mybibleexplorer.com" aria-current="page"><span class="mbe-library-name">Isaiah</span><span class="mbe-library-desc">Judgment, comfort, and gospel hope</span></a>
              <a class="mbe-library-item" href="https://revelation.mybibleexplorer.com/"><span class="mbe-library-name">Revelation</span><span class="mbe-library-desc">Symbols, judgment, and final hope</span></a>
              <a class="mbe-library-item" href="https://sanctuary.mybibleexplorer.com/#structure"><span class="mbe-library-name">Sanctuary</span><span class="mbe-library-desc">A blueprint of salvation</span></a>
              <a class="mbe-library-item" href="https://lastdayevents.mybibleexplorer.com/index.html"><span class="mbe-library-name">Last Day Events</span><span class="mbe-library-desc">Earth's final chapter</span></a>
            </div>
          </div>
        </details>
        <a class="mbe-ribbon-give" href="https://mybibleexplorer.com/#donate">Support</a>
      </nav>
    </div>
  </header>`;

const footer = `
  <footer class="mbe-global-footer" data-tool="isaiah">
    <div class="mbe-shell-wrap mbe-footer-wrap">
      <a class="mbe-footer-brand" href="https://mybibleexplorer.com" aria-label="My Bible Explorer home">
        <img class="mbe-footer-logo" src="/assets/my-bible-explorer-logo.png" alt="My Bible Explorer">
      </a>
      <span>Know the Word. Live the Word.</span>
      <span>To contact, email <a class="mbe-footer-link" href="mailto:admin@mybibleexplorer.com">admin@mybibleexplorer.com</a></span>
      <a class="mbe-footer-link" href="https://mybibleexplorer.com/#donate">Support</a>
      <span>&copy; <span data-mbe-year></span> My Bible Explorer</span>
    </div>
  </footer>`;

const navItems = [
  ["home", "/", "Home", icon.book],
  ["background", "/background/", "Introduction", icon.library],
  ["chapters", "/chapters/1/", "Commentary", icon.book],
  ["articles", "/articles/", "Articles", icon.file],
  ["charts", "/charts/", "Visual Prophecy", icon.search],
];

const appHeader = (active) => `
  <header class="site-header">
    <div class="site-header-inner">
      <a class="site-brand" href="/">
        <span class="brand-icon">${brandMark}</span>
        <span>Isaiah Study</span>
      </a>
      <nav class="site-nav" aria-label="Main navigation">
        ${navItems
          .map(
            ([key, href, label]) =>
              `<a class="${key === active ? "is-active" : ""}" href="${href}">${label}</a>`,
          )
          .join("")}
      </nav>
      <button class="icon-button menu-button" data-menu-toggle aria-label="Toggle menu" title="Toggle menu">${icon.menu}</button>
    </div>
    <nav class="mobile-nav" data-mobile-nav aria-label="Mobile navigation">
      ${navItems
        .map(
          ([key, href, label, itemIcon]) =>
            `<a class="${key === active ? "is-active" : ""}" href="${href}">${itemIcon}<span>${label}</span></a>`,
        )
        .join("")}
    </nav>
  </header>`;

const shell = ({ title, description, active, bodyClass = "", content, scripts = "" }) => `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <meta name="description" content="${attr(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/global-shell.css">
  <link rel="stylesheet" href="/site.css?v=20260710-reference-cursor-1">
</head>
<body class="mbe-shell-managed ${bodyClass}">
  ${globalRibbon}
  ${appHeader(active)}
  ${content}
  ${footer}
  <script src="/site.js?v=20260710-reference-cursor-1" defer></script>
  ${scripts}
</body>
</html>`;

const compactChapterLink = (chapter, current = null) =>
  `<a class="${chapter === current ? "is-active" : ""}" href="/chapters/${chapter}/" aria-label="Open Isaiah chapter ${chapter}">${chapter}</a>`;

const chapterStrip = (current, selectedVerse = 1) => {
  const previous = current > 1 ? current - 1 : null;
  const next = current < 66 ? current + 1 : null;
  const verseJumpId = `verse-jump-${current}`;
  const pickerId = `reference-picker-${current}`;
  const links = Array.from({ length: 66 }, (_, index) => compactChapterLink(index + 1, current)).join("");

  return `
  <nav class="chapter-strip" aria-label="Isaiah chapters">
    <div class="chapter-strip-main">
      ${previous ? `<a class="chapter-step" href="/chapters/${previous}/" aria-label="Previous chapter" title="Previous chapter">${icon.arrowLeft}</a>` : `<span class="chapter-step is-disabled" aria-hidden="true">${icon.arrowLeft}</span>`}
      <form class="verse-jump" data-verse-jump-form data-current-chapter="${current}" role="search" aria-label="Open Isaiah verse">
        <label class="sr-only" for="${verseJumpId}">Open Isaiah verse</label>
        <button class="reference-picker-toggle" data-reference-picker-toggle type="button" aria-label="Choose Isaiah chapter and verse" aria-expanded="false" aria-controls="${pickerId}">
          <span class="translation-badge" aria-hidden="true">KJV</span>
          <span class="reference-chevron" aria-hidden="true">${icon.chevronDown}</span>
        </button>
        <input id="${verseJumpId}" data-verse-jump-input type="search" inputmode="numeric" autocomplete="off" value="Isaiah ${current}:${selectedVerse}" placeholder="Isaiah ${current}:${selectedVerse}" aria-label="Type a verse reference">
        <button class="verse-jump-submit sr-only" type="submit">Open verse</button>
        <span class="verse-jump-status" data-verse-jump-status aria-live="polite"></span>
        <div class="reference-picker" id="${pickerId}" data-reference-picker hidden>
          <div class="reference-picker-head">
            <button class="reference-picker-back" data-reference-picker-back type="button" aria-label="Back to chapter selection" hidden>${icon.arrowLeft}</button>
            <strong data-reference-picker-title>Isaiah</strong>
            <button class="reference-picker-go" data-reference-picker-go type="button">Go</button>
            <button class="reference-picker-close" data-reference-picker-close type="button" aria-label="Close verse picker">&times;</button>
          </div>
          <div class="reference-picker-grid" data-reference-picker-grid aria-label="Choose Isaiah chapter"></div>
        </div>
      </form>
      <div class="recent-jump" data-recent-jump>
        <button class="recent-toggle" data-recent-toggle type="button" aria-label="Show recent verses" aria-expanded="false">Recent ${icon.chevronDown}</button>
        <div class="recent-dropdown" data-recent-dropdown hidden>
          <div class="recent-list" data-recent-list></div>
        </div>
      </div>
      ${next ? `<a class="chapter-step" href="/chapters/${next}/" aria-label="Next chapter" title="Next chapter">${icon.arrowRight}</a>` : `<span class="chapter-step is-disabled" aria-hidden="true">${icon.arrowRight}</span>`}
    </div>
    <details class="chapter-menu" data-chapter-menu>
      <summary aria-label="Show all chapters">All</summary>
      <div class="chapter-menu-grid">${links}</div>
    </details>
  </nav>`;
};

const groups = [
  [1, 12],
  [13, 23],
  [24, 35],
  [36, 39],
  [40, 48],
  [49, 57],
  [58, 66],
];

const chapterMetaRanges = [
  {
    start: 1,
    end: 12,
    shortTitle: "Judah's Crisis and Immanuel's Hope",
    summary:
      "Isaiah opens with Judah's covenant crisis, exposes hollow religion, and holds before God's people the hope of cleansing, remnant mercy, and the coming King.",
    tags: ["Covenant", "Holiness", "Remnant", "Immanuel"],
  },
  {
    start: 13,
    end: 23,
    shortTitle: "The Nations Before the Holy One",
    summary:
      "Isaiah turns to the nations, showing that every proud kingdom stands under the judgment of the Holy One who governs history.",
    tags: ["Nations", "Judgment", "Pride", "Sovereignty"],
  },
  {
    start: 24,
    end: 27,
    shortTitle: "Judgment, Resurrection, and Final Song",
    summary:
      "Isaiah widens the view to earth's final reckoning, the defeat of evil, resurrection hope, and the song of a redeemed people.",
    tags: ["Final Judgment", "Resurrection", "Zion", "Hope"],
  },
  {
    start: 28,
    end: 35,
    shortTitle: "Woes, Trust, and Restoration",
    summary:
      "Isaiah rebukes false confidence and calls Judah to trust the Lord, ending with a vision of wilderness joy and restored creation.",
    tags: ["Trust", "Rebuke", "Restoration", "Worship"],
  },
  {
    start: 36,
    end: 39,
    shortTitle: "Hezekiah, Assyria, and the Test of Trust",
    summary:
      "The Assyrian crisis puts Isaiah's message into narrative form, asking whether Judah will fear human power or rest in the Lord.",
    tags: ["Assyria", "Prayer", "Deliverance", "Pride"],
  },
  {
    start: 40,
    end: 48,
    shortTitle: "Comfort and the God Who Carries",
    summary:
      "Isaiah announces comfort, unmasks idols, and reveals the Lord as Creator, Redeemer, and the One who carries His people home.",
    tags: ["Comfort", "Creator", "Idols", "New Exodus"],
  },
  {
    start: 49,
    end: 55,
    shortTitle: "The Servant and the Everlasting Covenant",
    summary:
      "Isaiah centers hope in the Servant, whose suffering, obedience, and victory bring covenant mercy to Israel and the nations.",
    tags: ["Servant", "Messiah", "Covenant", "Grace"],
  },
  {
    start: 56,
    end: 59,
    shortTitle: "True Worship and Covenant Righteousness",
    summary:
      "Isaiah joins mercy with obedience, calling God's people to Sabbath faithfulness, justice, repentance, and worship that reaches the heart.",
    tags: ["Sabbath", "Justice", "Repentance", "Worship"],
  },
  {
    start: 60,
    end: 66,
    shortTitle: "Zion's Glory and New Creation",
    summary:
      "Isaiah closes with Zion's glory, searching rebuke, final judgment, true worship, and the promise of new heavens and a new earth.",
    tags: ["Zion", "Remnant", "Judgment", "New Earth"],
  },
];

const chapterMeta = (chapter) =>
  chapterMetaRanges.find(({ start, end }) => chapter >= start && chapter <= end) ||
  chapterMetaRanges[0];

const chapterOutlines = {
  1: [
    { start: 1, end: 1, title: "The Vision Concerning Judah and Jerusalem" },
    { start: 2, end: 9, title: "Rebellious Children and a Preserved Remnant" },
    { start: 10, end: 20, title: "Cleansing Offered to a Guilty People" },
    { start: 21, end: 31, title: "Zion Purged and Redeemed" },
  ],
  2: [
    { start: 1, end: 5, title: "The Mountain of the Lord and Nations Taught" },
    { start: 6, end: 11, title: "Pride Humbled Before the Lord" },
    { start: 12, end: 22, title: "The Day of the Lord Against Human Glory" },
  ],
  3: [
    { start: 1, end: 15, title: "Judah's Leaders Removed and Exposed" },
    { start: 16, end: 26, title: "Daughters of Zion Brought Low" },
  ],
  4: [
    { start: 1, end: 1, title: "Shame After Judgment" },
    { start: 2, end: 6, title: "The Branch and a Cleansed Remnant" },
  ],
  5: [
    { start: 1, end: 7, title: "Song of the Beloved Vineyard" },
    { start: 8, end: 23, title: "Woes Against Covenant Corruption" },
    { start: 24, end: 30, title: "Judgment Comes Like a Storm" },
  ],
  6: [
    { start: 1, end: 4, title: "The Holy One in the Temple" },
    { start: 5, end: 7, title: "Isaiah Cleansed at the Altar" },
    { start: 8, end: 13, title: "Commissioned to a Hardened People" },
  ],
  7: [
    { start: 1, end: 9, title: "Fear, Conspiracy, and a Call to Faith" },
    { start: 10, end: 16, title: "The Sign of Immanuel" },
    { start: 17, end: 25, title: "Assyria and the Stripping of the Land" },
  ],
  8: [
    { start: 1, end: 4, title: "Maher-shalal-hash-baz and Coming Spoil" },
    { start: 5, end: 10, title: "The Flood of Assyria and God With Us" },
    { start: 11, end: 18, title: "Fear the Lord and Wait" },
    { start: 19, end: 22, title: "Darkness for Those Who Seek Other Voices" },
  ],
  9: [
    { start: 1, end: 7, title: "Light, Joy, and the Child-King" },
    { start: 8, end: 21, title: "Israel's Pride Under Repeated Judgment" },
  ],
  10: [
    { start: 1, end: 4, title: "Woe to Unjust Decrees" },
    { start: 5, end: 19, title: "Assyria, the Rod, Is Judged" },
    { start: 20, end: 27, title: "The Remnant Returns to the Mighty God" },
    { start: 28, end: 34, title: "The Invader Reaches Zion and Falls" },
  ],
  11: [
    { start: 1, end: 5, title: "The Righteous Branch From Jesse" },
    { start: 6, end: 9, title: "Peace in God's Holy Mountain" },
    { start: 10, end: 16, title: "The Root of Jesse and the Gathered Remnant" },
  ],
  12: [{ start: 1, end: 6, title: "Songs at the Wells of Salvation" }],
  13: [
    { start: 1, end: 5, title: "The Lord Musters His Army Against Babylon" },
    { start: 6, end: 16, title: "The Day of the Lord Shakes the World" },
    { start: 17, end: 22, title: "Babylon Falls Into Desolation" },
  ],
  14: [
    { start: 1, end: 2, title: "Israel Restored After Exile" },
    { start: 3, end: 11, title: "The Taunt Against Babylon's King" },
    { start: 12, end: 23, title: "The Proud Morning Star Cast Down" },
    { start: 24, end: 27, title: "Assyria Broken by the Lord's Purpose" },
    { start: 28, end: 32, title: "Philistia Warned and Zion Sheltered" },
  ],
  15: [{ start: 1, end: 9, title: "Moab's Night of Ruin and Tears" }],
  16: [
    { start: 1, end: 5, title: "Moab Urged Toward Zion's Mercy" },
    { start: 6, end: 12, title: "Moab's Pride and Lament" },
    { start: 13, end: 14, title: "Moab's Glory Reduced" },
  ],
  17: [
    { start: 1, end: 3, title: "Damascus and Ephraim Brought Low" },
    { start: 4, end: 11, title: "Israel Forgets the God of Salvation" },
    { start: 12, end: 14, title: "Nations Roar but God Rebukes" },
  ],
  18: [{ start: 1, end: 7, title: "Cush Watches the Lord's Harvest" }],
  19: [
    { start: 1, end: 15, title: "Egypt Shaken From Within" },
    { start: 16, end: 17, title: "Egypt Trembles Before Judah's God" },
    { start: 18, end: 25, title: "Egypt, Assyria, and Israel Blessed Together" },
  ],
  20: [{ start: 1, end: 6, title: "Isaiah's Sign Against Egypt and Cush" }],
  21: [
    { start: 1, end: 10, title: "The Watchman Sees Babylon Fall" },
    { start: 11, end: 12, title: "A Brief Oracle Concerning Dumah" },
    { start: 13, end: 17, title: "Arabia's Glory Fades" },
  ],
  22: [
    { start: 1, end: 14, title: "Jerusalem's Valley of Vision Rebuked" },
    { start: 15, end: 19, title: "Shebna Removed From Office" },
    { start: 20, end: 25, title: "Eliakim Given the Key and Burden" },
  ],
  23: [
    { start: 1, end: 14, title: "Tyre's Proud Commerce Laid Waste" },
    { start: 15, end: 18, title: "Tyre Restored and Consecrated" },
  ],
  24: [
    { start: 1, end: 13, title: "Earth Emptied by Covenant Judgment" },
    { start: 14, end: 16, title: "Songs From the Ends of the Earth" },
    { start: 17, end: 23, title: "The Powers Judged and the Lord Reigns" },
  ],
  25: [
    { start: 1, end: 5, title: "Praise for the Faithful Fortress" },
    { start: 6, end: 8, title: "The Mountain Feast and Death Swallowed Up" },
    { start: 9, end: 12, title: "Salvation Celebrated and Pride Brought Down" },
  ],
  26: [
    { start: 1, end: 6, title: "A Strong City and Perfect Peace" },
    { start: 7, end: 11, title: "The Righteous Wait for God's Judgments" },
    { start: 12, end: 19, title: "Resurrection Hope and National Travail" },
    { start: 20, end: 21, title: "Hidden Until Indignation Passes" },
  ],
  27: [
    { start: 1, end: 1, title: "Leviathan Slain by the Lord" },
    { start: 2, end: 6, title: "The Pleasant Vineyard Kept by God" },
    { start: 7, end: 11, title: "Judgment That Purges Idolatry" },
    { start: 12, end: 13, title: "The Gathered Worshipers From Exile" },
  ],
  28: [
    { start: 1, end: 6, title: "Woe to Ephraim's Fading Crown" },
    { start: 7, end: 13, title: "Priests and Prophets Stumble" },
    { start: 14, end: 22, title: "Zion's Tested Foundation Stone" },
    { start: 23, end: 29, title: "The Farmer's Wisdom From God" },
  ],
  29: [
    { start: 1, end: 8, title: "Ariel Besieged and Delivered" },
    { start: 9, end: 16, title: "Spiritual Blindness and Upside-Down Wisdom" },
    { start: 17, end: 24, title: "Transformation for the Deaf, Blind, and Humble" },
  ],
  30: [
    { start: 1, end: 7, title: "Woe to Trust in Egypt" },
    { start: 8, end: 17, title: "Rebellious Children Refuse Quiet Trust" },
    { start: 18, end: 26, title: "Grace, Guidance, and Healing" },
    { start: 27, end: 33, title: "The Lord's Burning Judgment on Assyria" },
  ],
  31: [
    { start: 1, end: 3, title: "Woe to Those Who Go Down to Egypt" },
    { start: 4, end: 9, title: "The Lord Defends Zion" },
  ],
  32: [
    { start: 1, end: 8, title: "A Righteous King and Noble People" },
    { start: 9, end: 14, title: "Complacent Women Warned" },
    { start: 15, end: 20, title: "The Spirit Poured Out and Peace Established" },
  ],
  33: [
    { start: 1, end: 6, title: "The Destroyer Destroyed and Zion's Treasure" },
    { start: 7, end: 16, title: "Crisis, Fire, and the One Who Dwells With God" },
    { start: 17, end: 24, title: "The King in Beauty and Zion Secure" },
  ],
  34: [
    { start: 1, end: 4, title: "Judgment on the Nations" },
    { start: 5, end: 15, title: "Edom Made a Wilderness" },
    { start: 16, end: 17, title: "The Lord's Book Confirms the Sentence" },
  ],
  35: [
    { start: 1, end: 2, title: "Wilderness Gladness and Glory" },
    { start: 3, end: 7, title: "Strength for the Weak and Healing for the Broken" },
    { start: 8, end: 10, title: "The Highway of Holiness and Redeemed Joy" },
  ],
  36: [
    { start: 1, end: 3, title: "Assyria Surrounds Jerusalem" },
    { start: 4, end: 10, title: "Rabshakeh Mocks Judah's Trust" },
    { start: 11, end: 22, title: "Hezekiah's Servants Hear the Threat" },
  ],
  37: [
    { start: 1, end: 7, title: "Hezekiah Seeks the Word of the Lord" },
    { start: 8, end: 13, title: "Assyria Renews Its Defiance" },
    { start: 14, end: 20, title: "Hezekiah Spreads the Letter Before God" },
    { start: 21, end: 35, title: "Isaiah Announces Deliverance" },
    { start: 36, end: 38, title: "The Lord Strikes Assyria" },
  ],
  38: [
    { start: 1, end: 8, title: "Hezekiah's Sickness and Sign" },
    { start: 9, end: 20, title: "Hezekiah's Song After Deliverance" },
    { start: 21, end: 22, title: "Healing Confirmed" },
  ],
  39: [
    { start: 1, end: 4, title: "Babylon's Envoys and Hezekiah's Display" },
    { start: 5, end: 8, title: "Coming Exile Announced" },
  ],
  40: [
    { start: 1, end: 11, title: "Comfort, Pardon, and the Coming Shepherd" },
    { start: 12, end: 26, title: "The Creator Beyond Comparison" },
    { start: 27, end: 31, title: "Strength for Those Who Wait" },
  ],
  41: [
    { start: 1, end: 7, title: "The Nations Summoned to Court" },
    { start: 8, end: 20, title: "Israel My Servant, Fear Not" },
    { start: 21, end: 29, title: "Idols Challenged and Found Empty" },
  ],
  42: [
    { start: 1, end: 9, title: "The Servant Brings Justice to the Nations" },
    { start: 10, end: 17, title: "A New Song for the Lord's Triumph" },
    { start: 18, end: 25, title: "Blind Servants Under Discipline" },
  ],
  43: [
    { start: 1, end: 7, title: "Redeemed by Name and Gathered Home" },
    { start: 8, end: 13, title: "Witnesses to the Only Savior" },
    { start: 14, end: 21, title: "A New Exodus Through the Wilderness" },
    { start: 22, end: 28, title: "Israel's Weariness and God's Case" },
  ],
  44: [
    { start: 1, end: 5, title: "The Spirit Poured on Jacob" },
    { start: 6, end: 8, title: "No God Beside the Lord" },
    { start: 9, end: 20, title: "The Folly of Idols" },
    { start: 21, end: 28, title: "The Redeemer Names Cyrus" },
  ],
  45: [
    { start: 1, end: 8, title: "Cyrus Called by the Sovereign Creator" },
    { start: 9, end: 13, title: "Woe to Those Who Strive With Their Maker" },
    { start: 14, end: 19, title: "Nations Turn to Israel's God" },
    { start: 20, end: 25, title: "Salvation to the Ends of the Earth" },
  ],
  46: [
    { start: 1, end: 2, title: "Babylon's Gods Carried Away" },
    { start: 3, end: 7, title: "The Lord Carries His People" },
    { start: 8, end: 13, title: "God's Counsel Stands and Salvation Near" },
  ],
  47: [
    { start: 1, end: 7, title: "Babylon Brought Down From the Throne" },
    { start: 8, end: 11, title: "Secure Wickedness Suddenly Judged" },
    { start: 12, end: 15, title: "Sorceries Unable to Save" },
  ],
  48: [
    { start: 1, end: 11, title: "Stubborn Israel Refined for God's Name" },
    { start: 12, end: 16, title: "The First and the Last Speaks" },
    { start: 17, end: 22, title: "Peace Refused and Redemption Announced" },
  ],
  49: [
    { start: 1, end: 6, title: "The Servant Called for Israel and the Nations" },
    { start: 7, end: 13, title: "Kings See, Prisoners Come Home" },
    { start: 14, end: 21, title: "Zion Comforted and Enlarged" },
    { start: 22, end: 26, title: "The Lord Contends for His Children" },
  ],
  50: [
    { start: 1, end: 3, title: "Israel's Sin and the Lord's Power to Redeem" },
    { start: 4, end: 9, title: "The Obedient Servant Set Like Flint" },
    { start: 10, end: 11, title: "Trust the Lord or Walk in Your Own Fire" },
  ],
  51: [
    { start: 1, end: 8, title: "Look to the Rock and God's Lasting Salvation" },
    { start: 9, end: 16, title: "Awake, Arm of the Lord" },
    { start: 17, end: 23, title: "Jerusalem's Cup Taken Away" },
  ],
  52: [
    { start: 1, end: 6, title: "Zion Awake and Redeemed Without Price" },
    { start: 7, end: 12, title: "Beautiful Feet and the Holy Return" },
    { start: 13, end: 15, title: "The Servant Exalted After Suffering" },
  ],
  53: [
    { start: 1, end: 3, title: "The Despised Servant Revealed" },
    { start: 4, end: 6, title: "Wounded for Our Transgressions" },
    { start: 7, end: 9, title: "Silent, Innocent, and Buried With the Rich" },
    { start: 10, end: 12, title: "The Servant's Offering and Triumph" },
  ],
  54: [
    { start: 1, end: 10, title: "Barren Zion Enlarged by Everlasting Kindness" },
    { start: 11, end: 17, title: "The City Secured and No Weapon Prevails" },
  ],
  55: [
    { start: 1, end: 5, title: "Come to the Waters and the Sure Mercies" },
    { start: 6, end: 13, title: "Seek the Lord and Trust His Word" },
  ],
  56: [
    { start: 1, end: 8, title: "Sabbath, Covenant, and a House for All Peoples" },
    { start: 9, end: 12, title: "Blind Watchmen and Self-Serving Shepherds" },
  ],
  57: [
    { start: 1, end: 2, title: "The Righteous Gathered From Evil" },
    { start: 3, end: 13, title: "Idolatry Exposed and Rebuked" },
    { start: 14, end: 21, title: "Healing for the Contrite, No Peace for the Wicked" },
  ],
  58: [
    { start: 1, end: 5, title: "False Fasting Exposed" },
    { start: 6, end: 12, title: "The Fast God Chooses" },
    { start: 13, end: 14, title: "Sabbath Delight and Covenant Joy" },
  ],
  59: [
    { start: 1, end: 8, title: "Sin Separates and Justice Collapses" },
    { start: 9, end: 15, title: "Confession in the Darkness" },
    { start: 16, end: 21, title: "The Redeemer Comes to Zion" },
  ],
  60: [
    { start: 1, end: 7, title: "Zion Arises as Nations Come" },
    { start: 8, end: 14, title: "The Nations Bring Their Wealth" },
    { start: 15, end: 22, title: "Everlasting Light and Restored Glory" },
  ],
  61: [
    { start: 1, end: 3, title: "The Anointed Messenger Brings Good News" },
    { start: 4, end: 9, title: "Ruins Rebuilt and Covenant Joy" },
    { start: 10, end: 11, title: "Garments of Salvation and Righteousness" },
  ],
  62: [
    { start: 1, end: 5, title: "Zion Named, Delighted In, and Married" },
    { start: 6, end: 9, title: "Watchmen Give the Lord No Rest" },
    { start: 10, end: 12, title: "Prepare the Way for the Holy People" },
  ],
  63: [
    { start: 1, end: 6, title: "The Divine Warrior From Edom" },
    { start: 7, end: 14, title: "Remembering the Lord's Mercies" },
    { start: 15, end: 19, title: "Pleading for Fatherly Compassion" },
  ],
  64: [
    { start: 1, end: 5, title: "Oh That You Would Rend the Heavens" },
    { start: 6, end: 12, title: "Confession, Clay, and the Desolate Sanctuary" },
  ],
  65: [
    { start: 1, end: 7, title: "Rebellion Answered by Judgment" },
    { start: 8, end: 16, title: "A Remnant Preserved and Servants Named" },
    { start: 17, end: 25, title: "New Heavens, New Earth, and Holy Joy" },
  ],
  66: [
    { start: 1, end: 4, title: "True Worship and False Religion" },
    { start: 5, end: 14, title: "Zion's Birth and Mother's Comfort" },
    { start: 15, end: 18, title: "The Lord Comes With Fire" },
    { start: 19, end: 24, title: "Nations Gathered, Worship Renewed, and Evil Ended" },
  ],
};

const passageRangeLabel = (chapter, section) =>
  `Isaiah ${chapter}:${section.start}${section.end !== section.start ? `-${section.end}` : ""}`;

const renderPassageOutline = (chapter, verse) => {
  const section = (chapterOutlines[chapter] || []).find(({ start }) => start === verse);
  if (!section) return "";

  return `
        <div class="passage-outline-divider" aria-label="${attr(passageRangeLabel(chapter, section))}">
          <div class="passage-outline-range">${htmlEscape(passageRangeLabel(chapter, section))}</div>
          <h2 class="passage-outline-title">${htmlEscape(section.title)}</h2>
        </div>`;
};

const validateChapterOutlines = (chapters) => {
  const errors = [];

  chapters.forEach((chapter) => {
    const sections = chapterOutlines[chapter.chapter] || [];
    const maxVerse = chapter.verses.length;

    if (!sections.length) {
      errors.push(`Isaiah ${chapter.chapter} has no outline sections.`);
      return;
    }

    if (sections[0].start !== 1) {
      errors.push(`Isaiah ${chapter.chapter} outline must begin at verse 1.`);
    }

    sections.forEach((section, index) => {
      if (!section.title?.trim()) {
        errors.push(`Isaiah ${chapter.chapter}:${section.start}-${section.end} is missing a title.`);
      }

      if (section.start < 1 || section.end < section.start || section.end > maxVerse) {
        errors.push(
          `Isaiah ${chapter.chapter}:${section.start}-${section.end} is outside the chapter range.`,
        );
      }

      if (index > 0 && section.start !== sections[index - 1].end + 1) {
        errors.push(
          `Isaiah ${chapter.chapter} outline has a gap or overlap before verse ${section.start}.`,
        );
      }
    });

    if (sections.at(-1)?.end !== maxVerse) {
      errors.push(`Isaiah ${chapter.chapter} outline must end at verse ${maxVerse}.`);
    }
  });

  if (errors.length) {
    throw new Error(`Invalid Isaiah chapter outlines:\n${errors.join("\n")}`);
  }
};

const chapterGrid = (extraClass = "") => `
  <div class="chapter-grid ${extraClass}">
    ${groups
      .map(([start, end]) => {
        const buttons = Array.from({ length: end - start + 1 }, (_, index) => start + index)
          .map((number) => `<a href="/chapters/${number}/"><span>Isaiah</span><strong>${number}</strong></a>`)
          .join("");
        return `<section class="chapter-group"><h3>Chapters ${start}-${end}</h3><div>${buttons}</div></section>`;
      })
      .join("")}
  </div>`;

const homePage = () =>
  shell({
    title: "Isaiah Study Workspace",
    description:
      "A static Isaiah study workspace with KJV Scripture, a devotional introduction, and verse-by-verse commentary for every chapter.",
    active: "home",
    bodyClass: "home-route",
    content: `
      <main>
        <section class="hero">
          <div class="hero-content">
            <h1><span>The</span><span>Book of</span><span>Isaiah</span></h1>
            <p class="hero-copy">Read every chapter of Isaiah with a split Scripture and complete verse-by-verse commentary workspace. The introduction is prepared for devotional study, while articles remain ready for your material.</p>
            <div class="hero-actions">
              <a class="primary-action" href="/chapters/1/">Start with Chapter 1 ${icon.arrowRight}</a>
              <a class="secondary-action" href="/background/">Introduction</a>
            </div>
          </div>
        </section>
        <section class="content-band">
          <div class="section-heading">
            <p class="eyebrow">Scripture</p>
            <h2>All 66 chapters are ready</h2>
          </div>
          ${chapterGrid()}
        </section>
        <section class="content-band muted-band">
          <div class="section-heading">
            <p class="eyebrow">Study material</p>
            <h2>Blank spaces prepared for your content</h2>
          </div>
          <div class="template-links">
            <a href="/background/">${icon.library}<span><strong>Introduction</strong><small>Historical and devotional overview</small></span></a>
            <a href="/chapters/1/">${icon.book}<span><strong>Commentary</strong><small>Verse-by-verse notes placeholder</small></span></a>
            <a href="/articles/">${icon.file}<span><strong>Articles</strong><small>Focused studies placeholder</small></span></a>
            <a href="/charts/">${icon.search}<span><strong>Visual Prophecy</strong><small>Chart placeholders ready for later studies</small></span></a>
          </article>
        </section>
      </main>`,
  });

const backgroundPage = () =>
  shell({
    title: "Introduction to Isaiah | Isaiah Study Workspace",
    description:
      "A devotional Adventist introduction to Isaiah, including authorship, historical setting, covenant crisis, major themes, and gospel hope.",
    active: "background",
    bodyClass: "subpage-route intro-route",
    content: `
      <main class="intro-page">
        <section class="intro-hero">
          <div class="intro-hero-inner">
            <div class="intro-hero-copy">
              <p class="eyebrow">Introduction</p>
              <h1>Introduction to the Book of Isaiah</h1>
              <p class="intro-lede">Isaiah is not only a book of ancient warnings. It is a living call to behold the Holy One of Israel, turn from empty confidence, and receive the salvation God Himself provides.</p>
              <div class="hero-actions">
                <a class="primary-action" href="#purpose">Read the Introduction ${icon.arrowRight}</a>
                <a class="secondary-action" href="/chapters/1/">Open Isaiah 1</a>
              </div>
            </div>
            <div class="intro-facts" aria-label="Isaiah quick facts">
              <div class="intro-fact"><span>Name</span><strong>Isaiah means "Yahweh is salvation."</strong></div>
              <div class="intro-fact"><span>Prophet</span><strong>Isaiah son of Amoz ministered in Judah and Jerusalem.</strong></div>
              <div class="intro-fact"><span>Setting</span><strong>The Assyrian crisis during Uzziah, Jotham, Ahaz, and Hezekiah.</strong></div>
              <div class="intro-fact"><span>Message</span><strong>Judgment is real, mercy is deeper, and God will save a remnant.</strong></div>
              <div class="intro-fact"><span>Hope</span><strong>The Servant, Zion, the nations, and the new heavens and new earth.</strong></div>
            </div>
          </div>
        </section>
        <div class="intro-section-nav" aria-label="Introduction page sections">
          <div class="intro-section-nav-inner">
            <p>${icon.book} Read this page</p>
            <nav>
              <a href="#purpose"><span>01</span>Purpose</a>
              <a href="#prophet"><span>02</span>Prophet</a>
              <a href="#setting"><span>03</span>Setting</a>
              <a href="#crisis"><span>04</span>Crisis</a>
              <a href="#unity"><span>05</span>Unity</a>
              <a href="#shape"><span>06</span>Shape</a>
              <a href="#themes"><span>07</span>Themes</a>
              <a href="#adventist"><span>08</span>Adventist</a>
              <a href="#begin"><span>09</span>Begin</a>
            </nav>
          </div>
        </div>
        <section class="intro-body">
          <article class="intro-article">
            <section class="intro-section" id="purpose">
              <span class="intro-number">01</span>
              <div>
                <h2>The purpose of Isaiah</h2>
                <div class="intro-copy">
                  <p>Isaiah was preserved for people who needed more than information. Judah knew the language of worship, kept the rhythm of religious life, and still drifted far from the heart of God. The book opens with a wounded Father calling heaven and earth to witness: His children have rebelled, His people have forgotten Him, and their worship has become detached from justice, mercy, and humble obedience.</p>
                  <p>That makes Isaiah painfully honest, but never hopeless. The same book that exposes sin also announces comfort. It teaches us that God does not heal by pretending the wound is small. He names rebellion, purges pride, calls for repentance, and then promises a salvation no human ruler, army, or alliance could ever create.</p>
                  <p>For devotional study, Isaiah asks a searching question: where do we run when we are afraid? Judah often ran to visible power. Isaiah calls us back to the Lord whose word stands forever, whose holiness cleanses, and whose mercy gathers a remnant for His kingdom.</p>
                  <div class="intro-callout">${icon.library}<span>The heartbeat of the book is in Isaiah's name: Yahweh is salvation. Judgment is not the end of the story. God's own saving work is.</span></div>
                </div>
              </div>
            </section>
            <section class="intro-section" id="prophet">
              <span class="intro-number">02</span>
              <div>
                <h2>Isaiah the prophet</h2>
                <div class="intro-copy">
                  <p>Isaiah ministered as a prophet in Judah, especially around Jerusalem. Scripture calls him the son of Amoz and places his ministry in the days of Uzziah, Jotham, Ahaz, and Hezekiah. Beyond that, the Bible gives only a few personal details. He was married, he had sons whose names carried prophetic meaning, and he seems to have moved close enough to royal life to speak directly into the decisions of kings.</p>
                  <p>His life was not separated from his message. His son Shear-jashub carried the promise that a remnant would return. Maher-shalal-hash-baz carried the warning that judgment would come quickly. Even Isaiah's household became a sign that God was speaking to a nation tempted to hear politics more loudly than prophecy.</p>
                  <p>The center of Isaiah's calling is chapter 6. There he sees the Lord high and lifted up, hears the cry of "Holy, holy, holy," confesses his uncleanness, receives cleansing from the altar, and answers, "Here am I; send me." Before Isaiah can speak for God, he must first be undone and remade by the holiness of God. That pattern still matters. True witness begins with worship, confession, cleansing, and surrender.</p>
                </div>
              </div>
            </section>
            <section class="intro-section" id="setting">
              <span class="intro-number">03</span>
              <div>
                <h2>The historical setting</h2>
                <div class="intro-copy">
                  <p>Isaiah's ministry belongs to the second half of the eighth century B.C., when Assyria was rising as the terrifying power of the ancient Near East. Judah had known seasons of prosperity, especially under Uzziah, but prosperity had covered over moral weakness. Beneath the surface were injustice, idolatry, religious formalism, and leadership that often feared nations more than God.</p>
                  <p>The named kings help us feel the movement of the book. Uzziah and Jotham represent a time of strength that could not heal spiritual decay. Ahaz stands at a critical moment of fear, when Judah was pressured by Syria and Israel and chose Assyrian help rather than quiet trust in the Lord. Hezekiah is more hopeful, yet even his story shows how easily faith can be mingled with political calculation and human pride.</p>
                  <p>Isaiah speaks into the Syro-Ephraimite crisis, the fall of Samaria in 722 B.C., the temptation to lean on Egypt, and Sennacherib's invasion of Judah. But his horizon stretches further. He sees Babylon, Cyrus, restoration, the suffering Servant, the gathering of the nations, final judgment, and the new creation. Isaiah is rooted in history, yet his message is larger than one generation.</p>
                </div>
              </div>
            </section>
            <section class="intro-section" id="crisis">
              <span class="intro-number">04</span>
              <div>
                <h2>Judah's covenant crisis</h2>
                <div class="intro-copy">
                  <p>The crisis that required Isaiah was not only military. Assyria was dangerous, but Judah's deeper danger was spiritual. The people could bring sacrifices while neglecting the fatherless. They could keep assemblies while their hands were full of blood. They could speak the name of the Lord while trusting alliances, wealth, idols, and human strategy.</p>
                  <p>This is why Isaiah sounds so severe. God is not offended by empty ritual because He dislikes worship. He is offended because worship without surrendered life tells lies about His character. The Holy One of Israel wants a people whose prayers, justice, Sabbath delight, mercy, and public life agree with the God they claim to serve.</p>
                  <p>Yet Isaiah's rebukes are full of pleading. "Come now, and let us reason together" is not the voice of a cold prosecutor. It is the voice of a covenant God calling His people home. Scarlet sins can become white as snow. A corrupt city can be purified. A stump can remain after the tree is cut down. A remnant can return.</p>
                  <div class="intro-callout">${icon.panel}<span>Isaiah teaches that God purges in order to heal. His judgments expose every false refuge so His people may learn to rest in Him alone.</span></div>
                </div>
              </div>
            </section>
            <section class="intro-section" id="unity">
              <span class="intro-number">05</span>
              <div>
                <h2>Authorship and unity</h2>
                <div class="intro-copy">
                  <p>The book presents its vision as the word given through Isaiah son of Amoz. Many modern discussions divide Isaiah into later sections because chapters 40-66 speak so powerfully to exile, return, Cyrus, and restoration. The uploaded background material notes those debates while also showing that even scholars who differ over composition often recognize the final book's deep literary and theological unity.</p>
                  <p>An Adventist reading can affirm that unity with confidence. Scripture does not need to be embarrassed by predictive prophecy. The God who names kings, judges empires, and announces the end from the beginning is able to reveal future deliverance before it arrives. At the same time, the book may have been preserved, arranged, and handed down through faithful transmission without weakening the authority of the prophetic word.</p>
                  <p>For study, the important point is that Isaiah should be read as one coherent witness. The early chapters prepare the later comfort. The holiness of God in Isaiah 6 belongs with the Servant's suffering in Isaiah 53. The remnant promise belongs with the new heavens and new earth. The book is not a loose collection of religious fragments; it is a grand testimony to the God who judges, cleanses, comforts, and restores.</p>
                </div>
              </div>
            </section>
            <section class="intro-section" id="shape">
              <span class="intro-number">06</span>
              <div>
                <h2>The shape of the book</h2>
                <div class="intro-copy">
                  <p>Isaiah can be read in three large movements. Chapters 1-39 focus on judgment and hope in Judah and Jerusalem, with Assyria as the great surrounding threat. Chapters 40-55 speak comfort to exiled Zion and press toward redemption through the Servant. Chapters 56-66 call the restored people to faithful waiting while looking ahead to final judgment, gathered nations, and new creation.</p>
                  <p>Within that broad movement, the book also has smaller sections that help the reader stay oriented. Isaiah 1-12 exposes Judah's sin and opens messianic hope. Isaiah 13-23 shows that the Lord rules the nations. Isaiah 24-27 widens the horizon to world judgment and restoration. Isaiah 28-35 warns against false trust. Isaiah 36-39 forms a historical bridge through Hezekiah's crisis and the shadow of Babylon.</p>
                  <p>Then the tone of comfort rises. Isaiah 40-48 announces God's sovereign ability to end exile. Isaiah 49-55 centers the Servant's mission and suffering. Isaiah 56-66 presses beyond return from exile to a people made righteous, a Sabbath made delightful, outsiders welcomed, Zion restored, evil judged, and the world finally renewed.</p>
                  <div class="intro-outline" aria-label="Isaiah study outline">
                    <div><span>Isaiah 1-39</span><strong>Judgment and hope in the Assyrian crisis</strong></div>
                    <div><span>Isaiah 40-55</span><strong>Comfort, return, and the Servant's redemption</strong></div>
                    <div><span>Isaiah 56-66</span><strong>Righteous waiting, final judgment, and new creation</strong></div>
                  </div>
                </div>
              </div>
            </section>
            <section class="intro-section" id="themes">
              <span class="intro-number">07</span>
              <div>
                <h2>Major themes</h2>
                <div class="intro-copy">
                  <p>Isaiah's first great theme is God's holiness. The Lord is not one more power inside history. He is the Holy One of Israel, high above creation, morally pure, faithful to His covenant, and sovereign over every throne. Because He is holy, sin cannot be treated lightly. Because He is holy, mercy cannot be reduced to sentiment. His salvation cleanses what it forgives.</p>
                  <p>A second theme is trust. Again and again, Judah must choose between the Lord's word and visible strength. Ahaz fails this test when fear sends him to Assyria. Hezekiah faces it when Jerusalem is surrounded. Later readers face it whenever anxiety makes human power feel more solid than God's promise.</p>
                  <p>A third theme is the remnant. Isaiah never flatters the majority, but he never gives up hope. God preserves a people who return to Him, rely on Him, and bear witness to His saving purpose. That remnant hope reaches its fullest expression in the Messiah and Servant, whose suffering brings healing and whose kingdom gathers the nations.</p>
                  <div class="intro-theme-grid">
                    <div><span>Holiness</span><strong>The Holy One exposes sin and makes cleansing possible.</strong></div>
                    <div><span>Trust</span><strong>God's people must choose His word over human security.</strong></div>
                    <div><span>Remnant</span><strong>Judgment purifies, but God preserves a faithful people.</strong></div>
                    <div><span>Messiah</span><strong>The promised King and Servant carry hope beyond Judah to the world.</strong></div>
                  </div>
                </div>
              </div>
            </section>
            <section class="intro-section" id="adventist">
              <span class="intro-number">08</span>
              <div>
                <h2>An Adventist reading of Isaiah</h2>
                <div class="intro-copy">
                  <p>Adventist readers should feel at home in Isaiah because the book holds together truths we deeply cherish: the seriousness of judgment, the beauty of grace, the call to covenant faithfulness, the hope of a purified remnant, and the promise that God's final purpose is a renewed creation. Isaiah does not separate doctrine from devotion. Truth is meant to become worship, justice, courage, and hope.</p>
                  <p>The great controversy theme is present in the background of the book's conflict. Proud empires rise, idols promise security, rulers boast, and God's people are tempted to fear what they can see. Yet the Lord reveals Himself as Creator, Redeemer, Judge, and King. History is not finally governed by Assyria, Babylon, or any human empire. It is governed by the Holy One whose word cannot fail.</p>
                  <p>Isaiah also speaks powerfully to Sabbath and righteousness. Isaiah 56 blesses the outsider who keeps covenant and takes hold of the Sabbath. Isaiah 58 shows that true Sabbath delight cannot be separated from mercy, justice, and care for the oppressed. Isaiah 66 looks toward worship in the new earth. For Adventist study, these passages do not make the Sabbath a cold badge of identity. They show it as a sign of restored relationship with the Creator and Redeemer.</p>
                  <p>Most of all, Isaiah points us to Christ. The Child born, the Son given, the Branch from Jesse, the Servant wounded for our transgressions, the One anointed to preach good tidings - all of these lines draw the reader toward the gospel. Isaiah's final hope is not merely that Judah survives, but that God fills the earth with righteousness, gathers the nations, and makes all things new.</p>
                </div>
              </div>
            </section>
            <section class="intro-section" id="begin">
              <span class="intro-number">09</span>
              <div>
                <h2>Begin studying</h2>
                <div class="intro-copy">
                  <p>Read Isaiah slowly. Let the warnings search you, and let the promises steady you. The book will not allow us to treat sin casually, but it also will not allow us to despair. The Holy One who says "Woe is me" through the lips of the prophet also sends cleansing from the altar. The God who judges empty worship also invites His people to be washed, restored, and made joyful in His house of prayer.</p>
                  <p>A helpful path is to begin with the opening covenant lawsuit in Isaiah 1, then move to Isaiah's call in chapter 6, the messianic promises in chapters 7, 9, and 11, the comfort of chapter 40, the Servant song in chapter 53, the Sabbath and justice appeal in chapter 58, and the new creation hope in chapters 65-66. From there, return to the whole book with the larger movement in mind.</p>
                  <div class="intro-chapter-links" aria-label="Recommended Isaiah chapters">
                    <a href="/chapters/1/"><span>Isaiah 1</span><strong>Sin, washing, and restored Zion</strong>${icon.arrowRight}</a>
                    <a href="/chapters/6/"><span>Isaiah 6</span><strong>Holy, cleansed, and sent</strong>${icon.arrowRight}</a>
                    <a href="/chapters/9/"><span>Isaiah 9</span><strong>The Child and the kingdom</strong>${icon.arrowRight}</a>
                    <a href="/chapters/40/"><span>Isaiah 40</span><strong>Comfort and the enduring word</strong>${icon.arrowRight}</a>
                    <a href="/chapters/53/"><span>Isaiah 53</span><strong>The suffering Servant</strong>${icon.arrowRight}</a>
                    <a href="/chapters/58/"><span>Isaiah 58</span><strong>Sabbath, justice, and repair</strong>${icon.arrowRight}</a>
                    <a href="/chapters/66/"><span>Isaiah 66</span><strong>Final worship and new creation</strong>${icon.arrowRight}</a>
                  </div>
                </div>
              </div>
            </section>
          </article>
        </section>
      </main>`,
  });

const articleLookup = (articles) =>
  new Map(articles.map((article) => [plainText(article.title), article.slug]));

const renderArticleBlock = (block, titleMap = new Map(), sectionTitle = "") => {
  if (block.type === "ul") {
    const isRelated = sectionTitle.toLowerCase() === "related articles";
    return `<ul>${block.items
      .map((item) => {
        const itemText = plainText(item);
        const linkedSlug = isRelated ? titleMap.get(itemText) : null;
        const itemContent = linkedSlug
          ? `<a href="/articles/${attr(linkedSlug)}/">${inlineMarkdown(item)}</a>`
          : inlineMarkdown(item);
        return `<li>${itemContent}</li>`;
      })
      .join("")}</ul>`;
  }

  if (block.type === "ol") {
    return `<ol>${block.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`;
  }

  return `<p>${inlineMarkdown(block.text)}</p>`;
};

const renderArticleSection = (section, titleMap) => {
  const sectionClass =
    section.title.toLowerCase() === "key passages" ? "article-section article-callout" : "article-section";

  return `
            <section class="${sectionClass}" id="${attr(section.id)}">
              <h2>${htmlEscape(section.title)}</h2>
              ${section.blocks
                .map((block) => renderArticleBlock(block, titleMap, section.title))
                .join("\n")}
            </section>`;
};

const articleCard = (article) => `
          <a class="article-card" href="/articles/${attr(article.slug)}/">
            <span class="article-card-number">${String(article.order).padStart(2, "0")}</span>
            <strong>${htmlEscape(article.title)}</strong>
            <p>${htmlEscape(truncateText(article.shortAnswer))}</p>
            <span class="article-card-link">Read article ${icon.arrowRight}</span>
          </a>`;

const articlesPage = (articles = []) =>
  shell({
    title: "Articles | Isaiah Study Workspace",
    description:
      "Explore Isaiah articles on holiness, judgment, comfort, Messiah, Sabbath, Zion, and new creation.",
    active: "articles",
    bodyClass: "subpage-route articles-route",
    content: `
      <main class="articles-page">
        <section class="subhero article-index-hero">
          <div>
            <p class="eyebrow">Isaiah study</p>
            <h1>Articles</h1>
            <p class="subcopy">A guided article series through Isaiah's message, theology, and devotional force.</p>
          </div>
        </section>
        <section class="content-band">
          <div class="article-list" aria-label="Isaiah article series">
            ${articles.map(articleCard).join("\n")}
          </div>
        </section>
      </main>`,
  });

const articlePage = (article, articles = []) => {
  const titleMap = articleLookup(articles);
  const currentIndex = articles.findIndex((item) => item.slug === article.slug);
  const previous = currentIndex > 0 ? articles[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;

  return shell({
    title: `${article.seoTitle} | Isaiah Study Workspace`,
    description: article.metaDescription || truncateText(article.shortAnswer, 150),
    active: "articles",
    bodyClass: "subpage-route articles-route",
    content: `
      <main class="article-page">
        <section class="article-hero">
          <div class="article-hero-inner">
            <p class="eyebrow">Isaiah article ${String(article.order).padStart(2, "0")}</p>
            <h1>${htmlEscape(article.title)}</h1>
            <p>${htmlEscape(article.metaDescription || truncateText(article.shortAnswer, 180))}</p>
            <div class="hero-actions">
              <a class="primary-action" href="/articles/">All articles ${icon.arrowRight}</a>
              <a class="secondary-action" href="/chapters/1/">Open Isaiah 1</a>
            </div>
          </div>
        </section>
        <section class="article-shell">
          <aside class="article-toc" aria-label="Article sections">
            <p>${icon.list} In this article</p>
            <nav>
              ${article.sections
                .map(
                  (section) =>
                    `<a href="#${attr(section.id)}">${htmlEscape(section.title)}</a>`,
                )
                .join("\n")}
            </nav>
          </aside>
          <article class="article-content">
            ${article.sections.map((section) => renderArticleSection(section, titleMap)).join("\n")}
          </article>
        </section>
        <nav class="article-nav" aria-label="Article navigation">
          ${
            previous
              ? `<a href="/articles/${attr(previous.slug)}/">${icon.arrowLeft}<span><small>Previous</small><strong>${htmlEscape(previous.title)}</strong></span></a>`
              : `<span></span>`
          }
          ${
            next
              ? `<a href="/articles/${attr(next.slug)}/"><span><small>Next</small><strong>${htmlEscape(next.title)}</strong></span>${icon.arrowRight}</a>`
              : `<span></span>`
          }
        </nav>
      </main>`,
  });
};

const chartsPage = () =>
  shell({
    title: "Visual Prophecy | Isaiah Study Workspace",
    description: "Blank visual prophecy page prepared for the Isaiah study workspace.",
    active: "charts",
    bodyClass: "subpage-route",
    content: `
      <main>
        <section class="subhero">
          <div>
            <p class="eyebrow">Isaiah study</p>
            <h1>Visual Prophecy</h1>
          </div>
        </section>
        <section class="content-band">
          <div class="blank-document blank-document-grid" aria-label="Visual prophecy placeholder">
            <div class="blank-card"></div>
            <div class="blank-card"></div>
            <div class="blank-card"></div>
          </div>
        </section>
      </main>`,
  });

const searchPage = () =>
  shell({
    title: "Search | Isaiah Study Workspace",
    description: "Search the KJV text of Isaiah.",
    active: "search",
    bodyClass: "subpage-route",
    content: `
      <main>
        <section class="subhero">
          <div>
            <p class="eyebrow">KJV text</p>
            <h1>Search Isaiah</h1>
          </div>
        </section>
        <section class="content-band">
          <div class="search-workspace">
            <label for="site-search">Search words or phrases</label>
            <div class="search-row">
              <input id="site-search" type="search" placeholder="comfort, servant, holy one..." autocomplete="off" data-search-input>
              <button class="primary-action" type="button" data-search-button>${icon.search} Search</button>
            </div>
            <div class="search-meta" data-search-meta></div>
            <div class="search-results" data-search-results></div>
          </div>
        </section>
      </main>`,
  });

const chaptersIndexPage = () =>
  shell({
    title: "Chapters | Isaiah Study Workspace",
    description: "Choose a chapter from Isaiah.",
    active: "chapters",
    bodyClass: "subpage-route",
    content: `
      <main>
        <section class="subhero">
          <div>
            <p class="eyebrow">KJV text</p>
            <h1>Isaiah Chapters</h1>
          </div>
        </section>
        <section class="content-band">
          ${chapterGrid("wide-grid")}
        </section>
      </main>`,
  });

const renderBlankCommentary = (verses, n) => `
          <div class="notes-stack" aria-label="Blank commentary placeholders">
            <article class="commentary-entry is-empty is-active">
              <h4>Isaiah ${n}</h4>
              <div class="ruled-blank"></div>
            </article>
          </div>`;

const isaiahReferenceHref = (reference) => {
  const match = String(reference).match(/^Isaiah\s+(\d+):(\d+)(?:-\d+)?$/);
  if (!match) return "";

  const [, chapter, verse] = match;
  return `/chapters/${chapter}/#v${verse}`;
};

const normalizeReferenceLabel = (reference) => String(reference).trim().replace(/\s+/g, " ");

let bibleVerseLookup = new Map();

const referenceHoverPreview = (reference) => {
  const parsed = parseBibleReference(reference);
  if (!parsed) return "";

  const endVerse = Math.max(parsed.startVerse, parsed.endVerse);
  const verseParts = [];
  for (let verse = parsed.startVerse; verse <= endVerse && verseParts.length < 3; verse += 1) {
    const text = bibleVerseLookup.get(`${parsed.book} ${parsed.chapter}:${verse}`);
    if (text) verseParts.push(`${verse} ${text}`);
  }

  if (!verseParts.length) return "";

  const hasMore = endVerse - parsed.startVerse + 1 > verseParts.length;
  return truncateText(`${normalizeReferenceLabel(reference)}: ${verseParts.join(" ")}${hasMore ? " ..." : ""}`, 420);
};

const renderReferenceChip = (reference, extraClass = "") => {
  const label = htmlEscape(reference);
  const href = isaiahReferenceHref(reference);
  const className = `cross-reference-chip${extraClass ? ` ${extraClass}` : ""}`;
  const preview = referenceHoverPreview(reference);
  const previewAttributes = preview
    ? ` data-verse-preview="${attr(preview)}" aria-label="${attr(preview)}"`
    : "";

  return href
    ? `<a class="${className}" href="${attr(href)}"${previewAttributes}>${label}</a>`
    : `<span class="${className}"${previewAttributes}>${label}</span>`;
};

const bestCrossReferences = (sourceReference, references = [], limit = 5) => {
  if (!Array.isArray(references)) return [];

  const source = normalizeReferenceLabel(sourceReference).toLowerCase();
  const seen = new Set();
  const best = [];

  for (const reference of references) {
    if (typeof reference !== "string") continue;
    const clean = normalizeReferenceLabel(reference);
    if (!clean) continue;

    const key = clean.toLowerCase();
    if (key === source || seen.has(key)) continue;

    seen.add(key);
    best.push(clean);
    if (best.length >= limit) break;
  }

  return best;
};

const phraseNoteLibrary = [
  {
    phrase: "Vision",
    test: /\bvision\b/i,
    note:
      "A biblical vision is not private imagination. It is revelation given by God so His people can see their condition and His purpose truthfully.",
    refs: ["Numbers 12:6", "Habakkuk 2:2", "2 Peter 1:21"],
  },
  {
    phrase: "Judah and Jerusalem",
    test: /\bJudah\b.*\bJerusalem\b|\bJerusalem\b.*\bJudah\b/i,
    note:
      "Isaiah begins with the covenant people and the covenant city. The message is public, historical, and aimed at worship that has lost its heart.",
    refs: ["Isaiah 2:1", "Micah 1:1", "Jeremiah 1:3"],
  },
  {
    phrase: "Hear, O heavens",
    test: /\bHear,\s*O heavens\b|\bgive ear,\s*O earth\b/i,
    note:
      "Creation is called as witness because Judah's rebellion is not a small private failure. Covenant unfaithfulness disturbs the moral order under God.",
    refs: ["Deuteronomy 30:19", "Deuteronomy 32:1", "Micah 6:1-2"],
  },
  {
    phrase: "Children",
    test: /\bchildren\b/i,
    note:
      "The family language makes the sin more painful. Rebellion here is not ignorance only, but betrayal of a Father who nourished His people.",
    refs: ["Deuteronomy 32:5-6", "Hosea 11:1", "Malachi 1:6"],
  },
  {
    phrase: "Rebelled",
    test: /\brebelled\b|\brebellion\b|\brebellious\b/i,
    note:
      "Rebellion in Isaiah is covenant resistance. It is not weakness confessed to God, but the settled refusal to be governed by Him.",
    refs: ["Deuteronomy 9:7", "Isaiah 30:9", "Ezekiel 2:3"],
  },
  {
    phrase: "Holy One of Israel",
    test: /\bHoly One of Israel\b/i,
    note:
      "This title joins God's nearness to His holiness. Israel belongs to Him, but He cannot be domesticated by Israel's sins or religious forms.",
    refs: ["Isaiah 5:24", "Isaiah 10:20", "Isaiah 43:3"],
  },
  {
    phrase: "Remnant",
    test: /\bremnant\b|\bescaped\b|\bleft\b/i,
    note:
      "The remnant is mercy after judgment. God preserves a people, not because sin is light, but because His covenant purpose will not fail.",
    refs: ["Isaiah 1:9", "Isaiah 10:20-22", "Romans 11:5"],
  },
  {
    phrase: "Zion",
    test: /\bZion\b|\bdaughter of Zion\b/i,
    note:
      "Zion is more than geography. It becomes a symbol of God's dwelling, His people, His judgment, and His promised restoration.",
    refs: ["Psalm 48:1-2", "Isaiah 2:3", "Hebrews 12:22"],
  },
  {
    phrase: "Woe",
    test: /\bwoe\b/i,
    note:
      "A woe is not mere anger. It is a covenant alarm, exposing sin while there is still time to hear and turn.",
    refs: ["Isaiah 5:8", "Habakkuk 2:6", "Matthew 23:13"],
  },
  {
    phrase: "Vineyard",
    test: /\bvineyard\b|\bvines\b/i,
    note:
      "The vineyard picture shows God's careful care and His right to expect fruit. Judgment comes when privilege produces wild grapes.",
    refs: ["Isaiah 5:1-7", "Psalm 80:8-16", "Matthew 21:33-43"],
  },
  {
    phrase: "Branch",
    test: /\bBranch\b|\bstem of Jesse\b|\broot of Jesse\b/i,
    note:
      "The Branch language holds together humiliation and hope. From what looks cut down, God brings the promised Messianic King.",
    refs: ["Isaiah 4:2", "Isaiah 11:1", "Jeremiah 23:5"],
  },
  {
    phrase: "Immanuel",
    test: /\bImmanuel\b|\bGod with us\b/i,
    note:
      "Immanuel is a sign of God's presence in crisis. It comforts faith, but it also warns unbelief that God Himself is involved.",
    refs: ["Isaiah 7:14", "Isaiah 8:8", "Matthew 1:23"],
  },
  {
    phrase: "Assyria",
    test: /\bAssyria\b|\bAssyrian\b/i,
    note:
      "Assyria is an instrument in God's hand, but never His equal. Isaiah insists that empires remain accountable to the Holy One.",
    refs: ["Isaiah 10:5-7", "Isaiah 37:29", "Nahum 1:12"],
  },
  {
    phrase: "Babylon",
    test: /\bBabylon\b|\bChaldeans\b/i,
    note:
      "Babylon represents proud human power organized against God. Isaiah treats its fall as a pledge that no rival kingdom lasts forever.",
    refs: ["Isaiah 13:19", "Isaiah 47:1", "Revelation 18:2"],
  },
  {
    phrase: "Egypt",
    test: /\bEgypt\b|\bEgyptians\b/i,
    note:
      "Egypt often stands for visible security without trust. Isaiah presses God's people to choose quiet faith over desperate alliance.",
    refs: ["Isaiah 30:1-3", "Isaiah 31:1", "Hosea 11:5"],
  },
  {
    phrase: "Day of the Lord",
    test: /\bday of the LORD\b|\bday of the Lord\b/i,
    note:
      "The day of the Lord brings pride into judgment and vindicates God's rule. In Isaiah it reaches from historical crisis to final reckoning.",
    refs: ["Isaiah 2:12", "Joel 2:31", "2 Peter 3:10"],
  },
  {
    phrase: "Servant",
    test: /\bservant\b|\bservants\b/i,
    note:
      "Servant language can describe Israel, faithful witnesses, or the coming Messianic Servant. The context shows who bears the mission.",
    refs: ["Isaiah 42:1", "Isaiah 49:3", "Isaiah 52:13"],
  },
  {
    phrase: "Comfort",
    test: /\bcomfort\b|\bcomfort ye\b/i,
    note:
      "Isaiah's comfort is not sentimentality. It rests on pardon, God's sovereign coming, and His power to gather His people like a shepherd.",
    refs: ["Isaiah 40:1-11", "2 Corinthians 1:3-4", "Revelation 21:4"],
  },
  {
    phrase: "Idols",
    test: /\bidol\b|\bidols\b|\bgraven image\b|\bimages\b/i,
    note:
      "Isaiah mocks idols because they reverse reality: people carry gods that cannot carry them. True worship depends on the God who acts.",
    refs: ["Isaiah 44:9-20", "Isaiah 46:1-4", "1 Thessalonians 1:9"],
  },
  {
    phrase: "Fear not",
    test: /\bfear not\b|\bbe not afraid\b/i,
    note:
      "The command not to fear is grounded in God's presence, not human optimism. He gives courage by pledging Himself to His people.",
    refs: ["Isaiah 41:10", "Isaiah 43:1", "Luke 12:32"],
  },
  {
    phrase: "Redeemer",
    test: /\bredeemer\b|\bredeemed\b|\bredeem\b/i,
    note:
      "Redemption is rescue by covenant claim. The Lord does not merely pity His people; He acts as the One to whom they belong.",
    refs: ["Isaiah 43:1", "Isaiah 44:6", "1 Peter 1:18-19"],
  },
  {
    phrase: "New Thing",
    test: /\bnew thing\b|\bformer things\b/i,
    note:
      "The new thing language points to God's fresh act of salvation. It does not erase the exodus pattern, but extends it with greater hope.",
    refs: ["Isaiah 43:18-19", "2 Corinthians 5:17", "Revelation 21:5"],
  },
  {
    phrase: "Cyrus",
    test: /\bCyrus\b/i,
    note:
      "Cyrus shows the Lord's rule over history. Even pagan rulers move within God's larger purpose to restore His people.",
    refs: ["Isaiah 44:28", "Isaiah 45:1", "Ezra 1:1-3"],
  },
  {
    phrase: "Light to the Gentiles",
    test: /\blight to the Gentiles\b|\blight of the Gentiles\b|\bGentiles\b|\bnations\b/i,
    note:
      "Isaiah's mission widens beyond Israel without bypassing Israel. God's salvation is meant to reach the ends of the earth.",
    refs: ["Isaiah 49:6", "Luke 2:32", "Acts 13:47"],
  },
  {
    phrase: "Wounded / Stripes",
    test: /\bwounded\b|\bbruised\b|\bstripes\b|\bhealed\b/i,
    note:
      "In the Servant passage, healing comes through substitutionary suffering. The wound that exposes sin also reveals saving mercy.",
    refs: ["Isaiah 53:4-6", "Matthew 8:17", "1 Peter 2:24"],
  },
  {
    phrase: "Lamb",
    test: /\blamb\b|\bsheep\b/i,
    note:
      "The sheep and lamb imagery stresses innocence, submission, and sacrifice. Isaiah's Servant suffers without retaliating.",
    refs: ["Isaiah 53:6-7", "John 1:29", "Acts 8:32-35"],
  },
  {
    phrase: "Sabbath",
    test: /\bSabbath\b|\bsabbath\b/i,
    note:
      "In Isaiah, Sabbath faithfulness is not bare formalism. It is covenant delight, loyalty, and worship shaped by God's own rest.",
    refs: ["Isaiah 56:2", "Isaiah 58:13-14", "Revelation 14:7"],
  },
  {
    phrase: "Fast",
    test: /\bfast\b|\bfasting\b/i,
    note:
      "The fast God chooses joins worship with justice. Isaiah refuses religion that seeks God while crushing people made in His image.",
    refs: ["Isaiah 58:3-7", "Zechariah 7:5-10", "James 1:27"],
  },
  {
    phrase: "Watchmen",
    test: /\bwatchmen\b|\bwatchman\b/i,
    note:
      "Watchmen are responsible for alertness and intercession. Isaiah rebukes sleepy guardians and honors those who give God no rest.",
    refs: ["Isaiah 56:10", "Isaiah 62:6-7", "Ezekiel 33:7"],
  },
  {
    phrase: "New Heavens and New Earth",
    test: /\bnew heavens\b|\bnew earth\b/i,
    note:
      "Isaiah's final hope is restored creation, not escape from creation. God ends sin and makes worship, life, and joy whole again.",
    refs: ["Isaiah 65:17", "Isaiah 66:22-23", "Revelation 21:1"],
  },
  {
    phrase: "Spirit of the Lord",
    test: /\bSpirit of the Lord\b|\bSpirit of the LORD\b|\bmy spirit\b/i,
    note:
      "The Spirit empowers mission, renewal, and faithful witness. Isaiah connects true restoration with God's own presence at work.",
    refs: ["Isaiah 11:2", "Isaiah 61:1", "Luke 4:18"],
  },
  {
    phrase: "Anointed",
    test: /\banointed\b|\banoint\b/i,
    note:
      "Anointing marks a person for God-given work. Isaiah 61 gives this language its fullest Messianic force.",
    refs: ["Isaiah 61:1", "Luke 4:18-21", "Acts 10:38"],
  },
  {
    phrase: "Highway",
    test: /\bhighway\b|\bway of holiness\b/i,
    note:
      "The highway image pictures a prepared path home. God's redemption is not confusion, but a holy way made for the ransomed.",
    refs: ["Isaiah 35:8-10", "Isaiah 40:3", "Hebrews 12:14"],
  },
  {
    phrase: "Wilderness",
    test: /\bwilderness\b|\bdesert\b/i,
    note:
      "The wilderness becomes a place where God displays new creation power. Barren places are not beyond His reach.",
    refs: ["Isaiah 35:1-2", "Isaiah 43:19", "Mark 1:3"],
  },
  {
    phrase: "Righteousness",
    test: /\brighteousness\b|\brighteous\b/i,
    note:
      "Righteousness in Isaiah includes right standing, right rule, and right relationships. God's salvation creates a people who reflect His justice.",
    refs: ["Isaiah 1:27", "Isaiah 32:17", "Romans 3:21-22"],
  },
  {
    phrase: "Salvation",
    test: /\bsalvation\b|\bsave\b|\bsaved\b|\bsaviour\b|\bsavior\b/i,
    note:
      "Salvation belongs to the Lord from beginning to end. Isaiah presents it as deliverance, pardon, restoration, and final hope.",
    refs: ["Isaiah 12:2", "Isaiah 45:22", "Luke 2:30"],
  },
];

const phraseNotesForVerse = (text, limit = 2) =>
  phraseNoteLibrary.filter(({ test }) => test.test(text)).slice(0, limit);

const renderWordPhraseNotes = (notes) => {
  if (!notes.length) return "";

  return `
                <div class="word-notes-section">
                  <h5>Word / Phrase Notes</h5>
                  <div class="word-note-list">
                    ${notes
                      .map(
                        ({ phrase, note, refs }) => `
                    <article class="word-note-card">
                      <h6>${htmlEscape(phrase)}</h6>
                      <p>${htmlEscape(note)}</p>
                      <div class="word-note-refs">
                        ${refs.map((reference) => renderReferenceChip(reference, "word-note-reference-chip")).join("")}
                      </div>
                    </article>`,
                      )
                      .join("")}
                  </div>
                </div>`;
};

const renderStudyLinks = (sourceReference, references = [], verseText = "") => {
  const cleanReferences = bestCrossReferences(sourceReference, references);
  const phraseNotes = phraseNotesForVerse(verseText);

  if (!cleanReferences.length && !phraseNotes.length) return "";

  return `
              <section class="study-links-panel" aria-label="Study links for ${attr(sourceReference)}">
                <p class="study-links-label">${icon.library} Study Links</p>
                ${
                  cleanReferences.length
                    ? `<div class="cross-reference-panel" aria-label="Cross references for ${attr(sourceReference)}">
                  <h5>Cross References</h5>
                  <div class="cross-reference-list">
                    ${cleanReferences.map((reference) => renderReferenceChip(reference)).join("")}
                  </div>
                </div>`
                    : ""
                }
                ${renderWordPhraseNotes(phraseNotes)}
              </section>`;
};

const renderVerseCommentary = (verses, n, chapterCommentary, crossReferences = {}) => {
  const hasStudyNotes = verses.some(
    ({ verse, text }) =>
      chapterCommentary[String(verse)]?.length ||
      crossReferences[`Isaiah ${n}:${verse}`]?.length ||
      phraseNotesForVerse(text, 1).length,
  );

  if (!hasStudyNotes) {
    return renderBlankCommentary(verses, n);
  }

  const activeVerse = String(
    verses.find(
      ({ verse, text }) =>
        chapterCommentary[String(verse)]?.length ||
        crossReferences[`Isaiah ${n}:${verse}`]?.length ||
        phraseNotesForVerse(text, 1).length,
    )?.verse ??
      verses[0]?.verse ??
      1,
  );

  return `
          <div class="notes-stack commentary-filled" aria-label="Isaiah ${n} verse-by-verse commentary" aria-live="polite">
            ${verses
              .map(({ verse, text }) => {
                const paragraphs = chapterCommentary[String(verse)] || [];
                const sourceReference = `Isaiah ${n}:${verse}`;
                const studyLinksMarkup = renderStudyLinks(
                  sourceReference,
                  crossReferences[sourceReference] || [],
                  text,
                );
                const active = String(verse) === activeVerse;
                if (!paragraphs.length && !studyLinksMarkup) {
                  return `<article class="commentary-entry is-empty${active ? " is-active" : ""}" id="note-${n}-${verse}" data-commentary-note="${verse}"${active ? "" : " hidden"}><h4>${sourceReference}</h4><div class="mini-blank"></div></article>`;
                }

                return `
            <article class="commentary-entry${active ? " is-active" : ""}" id="note-${n}-${verse}" data-commentary-note="${verse}"${active ? "" : " hidden"}>
              <h4><a href="#v${verse}">${sourceReference}</a></h4>
              ${paragraphs.map((paragraph) => `<p>${htmlEscape(paragraph)}</p>`).join("")}
              ${studyLinksMarkup}
            </article>`;
              })
              .join("")}
          </div>`;
};

const chapterPage = (chapter, chapterCommentary = {}, crossReferences = {}) => {
  const verses = chapter.verses;
  const n = chapter.chapter;
  const previous = n > 1 ? n - 1 : null;
  const next = n < 66 ? n + 1 : null;
  const meta = chapterMeta(n);
  const hasCommentary = verses.some(
    ({ verse }) =>
      chapterCommentary[String(verse)]?.length || crossReferences[`Isaiah ${n}:${verse}`]?.length,
  );
  const activeVerse = String(
    verses.find(
      ({ verse }) =>
        chapterCommentary[String(verse)]?.length || crossReferences[`Isaiah ${n}:${verse}`]?.length,
    )?.verse ??
      verses[0]?.verse ??
      1,
  );
  const verseMarkup = verses
    .map(
      ({ verse, text }) => {
        const verseKey = String(verse);
        const outlineMarkup = renderPassageOutline(n, verse);
        const verseHasCommentary =
          chapterCommentary[verseKey]?.length || crossReferences[`Isaiah ${n}:${verse}`]?.length;

        if (!hasCommentary) {
          return `
        ${outlineMarkup}
        <div class="verse-unit">
          <p class="verse verse-text" id="v${verse}">
            <sup class="verse-number"><a href="#v${verse}" aria-label="Isaiah ${n}:${verse}">${verse}</a></sup><span>${htmlEscape(text)}</span>
          </p>
        </div>`;
        }

        return `
        ${outlineMarkup}
        <div class="verse-unit">
          <button class="verse verse-button verse-highlight${verseKey === activeVerse && verseHasCommentary ? " is-active" : ""}" id="v${verse}" type="button" data-verse-select="${verse}"${verseHasCommentary ? ` aria-controls="note-${n}-${verse}"` : ""} aria-pressed="${verseKey === activeVerse && verseHasCommentary ? "true" : "false"}" aria-label="Show study notes for Isaiah ${n}:${verse}">
            <sup class="verse-number">${verse}</sup><span>${htmlEscape(text)}</span>
          </button>
        </div>`;
      },
    )
    .join("");

  return shell({
    title: `Isaiah ${n}: ${meta.shortTitle} | Isaiah Study`,
    description: meta.summary,
    active: "chapters",
    bodyClass: "chapter-route",
    content: `
      ${chapterStrip(n, activeVerse)}
      <div class="reader-shell" data-chapter-workspace="true">
        <main class="scripture-panel" data-scripture-panel data-bible-panel="true">
          <header class="reader-panel-header">
            <div>
              <p>${icon.book} King James Version</p>
              <strong>Isaiah ${n}: ${htmlEscape(meta.shortTitle)}</strong>
            </div>
            <div class="reader-controls">
              <button class="icon-button" type="button" data-font-down aria-label="Decrease scripture text size" title="Decrease text size">${icon.minus}</button>
              <button class="icon-button" type="button" data-font-up aria-label="Increase scripture text size" title="Increase text size">${icon.plus}</button>
              <a class="icon-button notes-jump" href="#commentary" aria-label="Open commentary">${icon.panel}</a>
            </div>
          </header>
          <article class="scripture-text" data-scripture-text>
            <div class="chapter-intro">
              <h1>Isaiah Chapter ${n}</h1>
              <p>${htmlEscape(meta.summary)}</p>
            </div>
            <div class="scripture-verses">
              ${verseMarkup}
            </div>
          </article>
          <nav class="prev-next" aria-label="Chapter navigation">
            ${previous ? `<a href="/chapters/${previous}/">${icon.arrowLeft} Isaiah ${previous}</a>` : `<span></span>`}
            ${next ? `<a href="/chapters/${next}/">Isaiah ${next} ${icon.arrowRight}</a>` : `<span></span>`}
          </nav>
        </main>
        <aside class="commentary-panel" id="commentary" data-study-panel="true">
          <header class="reader-panel-header notes-header">
            <div>
              <h2>${icon.list} Study Notes</h2>
            </div>
            <div class="reader-controls">
              <button class="icon-button" type="button" data-notes-font-down aria-label="Decrease study notes text size" title="Decrease study notes text size">${icon.minus}</button>
              <button class="icon-button" type="button" data-notes-font-up aria-label="Increase study notes text size" title="Increase study notes text size">${icon.plus}</button>
            </div>
          </header>
          ${renderVerseCommentary(verses, n, chapterCommentary, crossReferences)}
        </aside>
      </div>`,
  });
};

const notFoundPage = () =>
  shell({
    title: "Page Not Found | Isaiah Study Workspace",
    description: "The requested Isaiah study page was not found.",
    active: "home",
    bodyClass: "subpage-route",
    content: `
      <main>
        <section class="subhero">
          <div>
            <p class="eyebrow">404</p>
            <h1>Page Not Found</h1>
            <p class="subcopy">Return to the Isaiah study workspace or open the chapter list.</p>
            <div class="hero-actions">
              <a class="primary-action" href="/">Home ${icon.arrowRight}</a>
              <a class="secondary-action" href="/chapters/">Chapters</a>
            </div>
          </div>
        </section>
      </main>`,
  });

const css = `
:root {
  --background: #091622;
  --foreground: #f5ead5;
  --muted: #b9ab91;
  --soft: #d8c49a;
  --gold: #cfa950;
  --gold-bright: #efcf76;
  --card: #10263a;
  --card-2: #132d3f;
  --line: rgba(229, 205, 154, 0.22);
  --line-strong: rgba(239, 207, 118, 0.38);
  --ink: #07111c;
  --cream: #fbf3dd;
  --olive: #667157;
  --terra: #8d5944;
  --shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
  --display-font: "Cinzel", Georgia, serif;
  --scripture-font: "EB Garamond", Georgia, serif;
  --ui-font: "Jost", ui-sans-serif, system-ui, sans-serif;
  --serif: var(--scripture-font);
  --scripture-serif: var(--scripture-font);
  --display: var(--display-font);
  --sans: var(--ui-font);
}

* {
  box-sizing: border-box;
}

html {
  background: var(--background);
  color: var(--foreground);
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(900px 380px at 85% -6%, rgba(207, 169, 80, 0.13), transparent 62%),
    radial-gradient(760px 420px at 10% 18%, rgba(102, 113, 87, 0.18), transparent 65%),
    linear-gradient(180deg, #0b1e31 0%, #091622 52%, #07111c 100%);
  color: var(--foreground);
  font-family: var(--sans);
  font-size: 1rem;
  line-height: 1.5;
}

a {
  color: inherit;
  text-decoration: none;
}

img,
svg {
  display: block;
}

button,
input {
  font: inherit;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.icon {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.mbe-global-shell {
  z-index: 80;
}

.site-header {
  position: sticky;
  top: 46px;
  z-index: 70;
  border-bottom: 1px solid var(--line);
  background: rgba(9, 22, 34, 0.88);
  backdrop-filter: blur(18px);
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4rem;
  padding: 0 1.5rem;
}

.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  min-width: max-content;
  color: var(--foreground);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}

.brand-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid rgba(239, 207, 118, 0.35);
  border-radius: 0.35rem;
  background: var(--gold);
  color: var(--ink);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.25);
}

.brand-mark {
  width: 1.7rem;
  height: 1.7rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.site-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(1.3rem, 3vw, 2.4rem);
  flex: 1;
}

.site-nav a {
  color: rgba(245, 234, 213, 0.62);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  transition: color 160ms ease, opacity 160ms ease;
}

.site-nav a:hover,
.site-nav a.is-active {
  color: var(--foreground);
}

.icon-button {
  display: inline-grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: rgba(245, 234, 213, 0.06);
  color: var(--foreground);
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.icon-button:hover {
  border-color: var(--line-strong);
  background: rgba(239, 207, 118, 0.12);
}

.menu-button {
  display: none;
}

.mobile-nav {
  display: none;
  border-top: 1px solid var(--line);
  padding: 0.55rem;
  background: rgba(9, 22, 34, 0.94);
}

.mobile-nav a {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border-radius: 0.35rem;
  padding: 0.82rem 0.9rem;
  color: rgba(245, 234, 213, 0.72);
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.mobile-nav a.is-active {
  background: rgba(239, 207, 118, 0.12);
  color: var(--gold-bright);
}

.hero {
  position: relative;
  min-height: min(720px, calc(100svh - 46px));
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  background: #091622;
  isolation: isolate;
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  background-image:
    linear-gradient(90deg, rgba(7, 17, 28, 0.92) 0%, rgba(7, 17, 28, 0.68) 34%, rgba(7, 17, 28, 0.12) 100%),
    linear-gradient(180deg, rgba(7, 17, 28, 0.1) 0%, rgba(7, 17, 28, 0.28) 58%, rgba(7, 17, 28, 0.88) 100%),
    url("/assets/isaiah-hero.png");
  background-position: center;
  background-size: cover;
}

.hero::after,
.subhero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 78%, rgba(141, 89, 68, 0.2), transparent 38%),
    radial-gradient(circle at 80% 16%, rgba(239, 207, 118, 0.14), transparent 35%);
}

.hero-content {
  display: flex;
  width: min(100%, 1800px);
  min-height: inherit;
  flex-direction: column;
  justify-content: flex-end;
  padding: clamp(7rem, 13vh, 10rem) clamp(1.5rem, 5vw, 5rem) clamp(3rem, 8vh, 6rem);
}

.eyebrow {
  margin: 0 0 1rem;
  color: var(--gold-bright);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--display);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.06;
}

h3 {
  margin: 0;
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: 0;
}

.hero h1 {
  max-width: 11ch;
  color: var(--cream);
  font-size: clamp(3rem, 9vw, 7rem);
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.42);
}

.hero h1 span {
  display: block;
}

.hero-copy {
  max-width: 44rem;
  margin: 1.5rem 0 0;
  color: rgba(245, 234, 213, 0.82);
  font-size: clamp(0.9rem, 2vw, 1.08rem);
  line-height: 1.75;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1.6rem;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-radius: 0.35rem;
  padding: 0.7rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.primary-action {
  border: 1px solid var(--gold);
  background: var(--gold);
  color: var(--ink);
}

.secondary-action {
  border: 1px solid var(--line-strong);
  background: rgba(245, 234, 213, 0.08);
  color: var(--foreground);
}

.content-band {
  width: min(100%, 1320px);
  margin: 0 auto;
  padding: clamp(3rem, 6vw, 5.5rem) clamp(1rem, 4vw, 2rem);
}

.muted-band {
  width: 100%;
  max-width: none;
  border-top: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(19, 45, 63, 0.62), rgba(9, 22, 34, 0.24)),
    radial-gradient(600px 260px at 14% 30%, rgba(102, 113, 87, 0.18), transparent 62%);
}

.muted-band > * {
  width: min(100%, 1320px);
  margin-left: auto;
  margin-right: auto;
}

.section-heading {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.6rem;
}

.section-heading h2 {
  max-width: 18ch;
  color: var(--cream);
  font-size: clamp(1.875rem, 4vw, 3rem);
}

.chapter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.chapter-group {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  background: rgba(16, 38, 58, 0.76);
  padding: 1rem;
  box-shadow: 0 18px 52px rgba(0, 0, 0, 0.16);
}

.chapter-group h3 {
  margin-bottom: 0.8rem;
  color: var(--soft);
  font-size: 1.32rem;
}

.chapter-group div {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.6rem, 1fr));
  gap: 0.55rem;
}

.chapter-group a {
  display: flex;
  min-height: 4.2rem;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(229, 205, 154, 0.16);
  border-radius: 0.35rem;
  background: rgba(251, 243, 221, 0.04);
  padding: 0.62rem;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}

.chapter-group a:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  background: rgba(239, 207, 118, 0.1);
}

.chapter-group span {
  color: var(--muted);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.chapter-group strong {
  color: var(--cream);
  font-size: 1.32rem;
  line-height: 1;
}

.template-links {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.template-links a {
  display: flex;
  min-width: 0;
  gap: 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  background: rgba(7, 17, 28, 0.42);
  padding: 1.1rem;
}

.template-links .icon {
  flex: 0 0 auto;
  color: var(--gold-bright);
}

.template-links strong,
.template-links small {
  display: block;
}

.template-links strong {
  color: var(--cream);
  font-size: 1rem;
}

.template-links small {
  margin-top: 0.28rem;
  color: var(--muted);
  line-height: 1.45;
}

.subhero {
  position: relative;
  min-height: clamp(20rem, 44vh, 32rem);
  display: flex;
  align-items: end;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  padding: clamp(6rem, 12vh, 9rem) clamp(1.5rem, 5vw, 5rem) clamp(2rem, 6vh, 4rem);
  background-image:
    linear-gradient(90deg, rgba(7, 17, 28, 0.92), rgba(7, 17, 28, 0.48)),
    url("/assets/isaiah-hero.png");
  background-position: center;
  background-size: cover;
  isolation: isolate;
}

.subhero > div {
  width: min(100%, 1100px);
}

.subhero h1 {
  color: var(--cream);
  font-size: clamp(3rem, 7vw, 4.5rem);
}

.subcopy {
  max-width: 42rem;
  color: rgba(245, 234, 213, 0.78);
}

.blank-document {
  min-height: 32rem;
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  background:
    linear-gradient(180deg, rgba(251, 243, 221, 0.055), rgba(251, 243, 221, 0.025)),
    rgba(16, 38, 58, 0.76);
  padding: clamp(1.2rem, 3vw, 2rem);
  box-shadow: var(--shadow);
}

.blank-line,
.blank-space,
.blank-card,
.ruled-blank,
.mini-blank {
  border: 1px dashed rgba(239, 207, 118, 0.22);
  border-radius: 0.35rem;
  background:
    linear-gradient(90deg, rgba(251, 243, 221, 0.08), rgba(251, 243, 221, 0.02)),
    rgba(7, 17, 28, 0.18);
}

.blank-line {
  height: 1rem;
  max-width: 38rem;
  margin-bottom: 0.8rem;
}

.blank-line.short {
  max-width: 22rem;
}

.blank-space {
  min-height: 24rem;
  margin-top: 1.5rem;
}

.blank-document-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-height: 20rem;
  gap: 1rem;
}

.blank-card {
  min-height: 16rem;
}

.articles-route {
  background:
    radial-gradient(760px 300px at 12% 6%, rgba(201, 164, 76, 0.11), transparent 64%),
    linear-gradient(180deg, rgba(7, 17, 28, 0), rgba(7, 17, 28, 0.2));
}

.article-index-hero h1 {
  max-width: 12ch;
}

.article-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.article-card {
  display: grid;
  min-height: 19rem;
  grid-template-rows: auto auto 1fr auto;
  gap: 0.8rem;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 0.45rem;
  background:
    linear-gradient(180deg, rgba(236, 224, 196, 0.055), rgba(236, 224, 196, 0.018)),
    rgba(14, 33, 56, 0.82);
  padding: 1.15rem;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.article-card:hover {
  transform: translateY(-3px);
  border-color: rgba(201, 164, 76, 0.5);
  background:
    linear-gradient(180deg, rgba(236, 224, 196, 0.085), rgba(236, 224, 196, 0.025)),
    rgba(14, 33, 56, 0.96);
}

.article-card-number,
.article-card-link {
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.article-card strong {
  color: var(--cream);
  font-family: var(--sans);
  font-size: clamp(1.25rem, 2vw, 1.5rem);
  font-weight: 600;
  line-height: 1.14;
}

.article-card p {
  margin: 0;
  color: rgba(236, 224, 196, 0.74);
  font-size: 1rem;
  line-height: 1.65;
}

.article-card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: rgba(236, 224, 196, 0.9);
}

.article-card-link .icon {
  width: 1rem;
  height: 1rem;
}

.article-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(90deg, rgba(11, 31, 58, 0.95) 0%, rgba(11, 31, 58, 0.72) 45%, rgba(11, 31, 58, 0.22) 100%),
    linear-gradient(180deg, rgba(11, 31, 58, 0.1), rgba(11, 31, 58, 0.86)),
    url("/assets/isaiah-hero.png");
  background-position: center right;
  background-size: cover;
  isolation: isolate;
}

.article-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(circle at 86% 36%, rgba(201, 164, 76, 0.13), transparent 34%);
}

.article-hero-inner {
  width: min(100%, 1100px);
  padding: clamp(6.4rem, 13vh, 9.5rem) clamp(1.5rem, 5vw, 5rem) clamp(2.6rem, 6vh, 4.4rem);
}

.article-hero h1 {
  max-width: 14ch;
  color: var(--cream);
  font-size: clamp(2.25rem, 6vw, 4.5rem);
}

.article-hero p:not(.eyebrow) {
  max-width: 45rem;
  margin: 1.15rem 0 0;
  color: rgba(236, 224, 196, 0.8);
  font-size: clamp(0.9rem, 1.7vw, 1.08rem);
  line-height: 1.75;
}

.article-shell {
  display: grid;
  width: min(100%, 1320px);
  grid-template-columns: minmax(14rem, 17rem) minmax(0, 1fr);
  gap: clamp(1.4rem, 3vw, 3rem);
  margin: 0 auto;
  padding: clamp(2.6rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2rem);
}

.article-toc {
  position: sticky;
  top: calc(46px + 4rem + 1.5rem);
  align-self: start;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 0.45rem;
  background: rgba(14, 33, 56, 0.82);
  padding: 1rem;
}

.article-toc p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.article-toc nav {
  display: grid;
  gap: 0.25rem;
}

.article-toc a {
  border-radius: 0.32rem;
  color: rgba(236, 224, 196, 0.72);
  font-size: 0.9rem;
  line-height: 1.35;
  padding: 0.42rem 0.5rem;
}

.article-toc a:hover {
  background: rgba(236, 224, 196, 0.06);
  color: var(--cream);
}

.article-content {
  min-width: 0;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 0.45rem;
  background:
    linear-gradient(180deg, rgba(236, 224, 196, 0.04), rgba(236, 224, 196, 0.014)),
    rgba(14, 33, 56, 0.82);
  padding: clamp(1.35rem, 3.2vw, 3rem);
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.18);
}

.article-section p,
.article-section li {
  font-family: var(--serif);
}

.article-section {
  scroll-margin-top: 7.5rem;
}

.article-section + .article-section {
  margin-top: clamp(2rem, 4vw, 3.2rem);
  padding-top: clamp(1.8rem, 3vw, 2.5rem);
  border-top: 1px solid rgba(201, 164, 76, 0.16);
}

.article-section h2 {
  max-width: 20ch;
  color: var(--cream);
  font-size: clamp(1.875rem, 3.2vw, 3rem);
}

.article-section p,
.article-section li {
  color: rgba(236, 224, 196, 0.82);
  font-size: 1.08rem;
  line-height: 1.82;
}

.article-section p {
  margin: 1rem 0 0;
}

.article-section ul,
.article-section ol {
  display: grid;
  gap: 0.7rem;
  margin: 1.1rem 0 0;
  padding-left: 1.3rem;
}

.article-section li::marker {
  color: var(--gold-bright);
  font-weight: 600;
}

.article-section strong {
  color: var(--cream);
}

.article-section a {
  color: var(--gold-bright);
  text-decoration: underline;
  text-decoration-color: rgba(201, 164, 76, 0.34);
  text-underline-offset: 0.18em;
}

.article-callout {
  border: 1px solid rgba(201, 164, 76, 0.22);
  border-radius: 0.45rem;
  background: rgba(7, 17, 28, 0.25);
  padding: clamp(1rem, 2vw, 1.35rem);
}

.article-nav {
  display: grid;
  width: min(100%, 1320px);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 0 auto;
  padding: 0 clamp(1rem, 4vw, 2rem) clamp(3rem, 6vw, 5rem);
}

.article-nav a {
  display: flex;
  min-height: 5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 0.45rem;
  background: rgba(14, 33, 56, 0.82);
  padding: 1rem;
}

.article-nav a:hover {
  border-color: rgba(201, 164, 76, 0.48);
  background: rgba(14, 33, 56, 0.96);
}

.article-nav small,
.article-nav strong {
  display: block;
}

.article-nav small {
  margin-bottom: 0.25rem;
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.article-nav strong {
  color: var(--cream);
  font-family: var(--sans);
  font-size: 1.25rem;
  line-height: 1.2;
}

.intro-page {
  background:
    radial-gradient(900px 360px at 14% 4%, rgba(201, 164, 76, 0.12), transparent 62%),
    linear-gradient(180deg, rgba(7, 17, 28, 0.32), rgba(7, 17, 28, 0));
}

.intro-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(90deg, rgba(11, 31, 58, 0.96), rgba(11, 31, 58, 0.72) 48%, rgba(11, 31, 58, 0.42)),
    linear-gradient(180deg, rgba(11, 31, 58, 0.1), rgba(11, 31, 58, 0.88)),
    url("/assets/isaiah-hero.png");
  background-position: center right;
  background-size: cover;
  isolation: isolate;
}

.intro-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 80%, rgba(11, 31, 58, 0.72), transparent 42%),
    linear-gradient(90deg, rgba(7, 17, 28, 0.68), transparent 74%);
}

.intro-hero-inner {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.75fr);
  gap: clamp(2rem, 5vw, 5rem);
  width: min(100%, 1320px);
  margin: 0 auto;
  padding: clamp(6.5rem, 12vh, 9rem) clamp(1rem, 4vw, 2rem) clamp(3rem, 7vh, 5rem);
}

.intro-hero-copy {
  align-self: end;
  min-width: 0;
}

.intro-hero h1 {
  max-width: 14ch;
  color: var(--cream);
  font-size: clamp(2.25rem, 5.15vw, 4.5rem);
  text-shadow: 0 2px 22px rgba(0, 0, 0, 0.42);
}

.intro-lede {
  max-width: 46rem;
  margin: 1.35rem 0 0;
  color: rgba(245, 234, 213, 0.82);
  font-size: clamp(0.9rem, 2vw, 1.08rem);
  line-height: 1.78;
}

.intro-facts {
  display: grid;
  align-self: end;
  gap: 0.72rem;
}

.intro-fact {
  border: 1px solid rgba(201, 164, 76, 0.2);
  border-radius: 0.42rem;
  background: rgba(9, 22, 34, 0.76);
  padding: 1rem;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.18);
}

.intro-fact span,
.intro-outline span,
.intro-theme-grid span,
.intro-chapter-links span {
  display: block;
  color: var(--gold-bright);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.intro-fact strong {
  display: block;
  margin-top: 0.35rem;
  color: var(--cream);
  font-family: var(--serif);
  font-size: 1.08rem;
  font-weight: 600;
  line-height: 1.35;
}

.intro-section-nav {
  position: sticky;
  top: calc(46px + 4rem);
  z-index: 50;
  border-bottom: 1px solid var(--line);
  background: rgba(9, 22, 34, 0.95);
  padding: 0.8rem clamp(1rem, 4vw, 2rem);
  backdrop-filter: blur(16px);
}

.intro-section-nav-inner {
  width: min(100%, 1320px);
  margin: 0 auto;
}

.intro-section-nav p {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.62rem;
  color: rgba(245, 234, 213, 0.66);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.intro-section-nav p .icon {
  color: var(--gold-bright);
}

.intro-section-nav nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  scrollbar-width: thin;
}

.intro-section-nav a {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.35rem;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 999px;
  background: rgba(236, 224, 196, 0.04);
  padding: 0.48rem 0.82rem;
  color: rgba(245, 234, 213, 0.76);
  font-size: 0.82rem;
  font-weight: 600;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.intro-section-nav a:hover {
  border-color: var(--line-strong);
  background: rgba(201, 164, 76, 0.12);
  color: var(--cream);
}

.intro-section-nav a span {
  color: var(--gold-bright);
  font-size: 0.72rem;
}

.intro-body {
  width: min(100%, 1320px);
  margin: 0 auto;
  padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 2rem) clamp(4rem, 7vw, 6rem);
}

.intro-article {
  width: min(100%, 58rem);
}

.intro-section {
  display: grid;
  grid-template-columns: 2.8rem minmax(0, 1fr);
  gap: 1rem;
  scroll-margin-top: 10rem;
  border-top: 1px solid var(--line);
  padding: clamp(2.4rem, 5vw, 4rem) 0;
}

.intro-section:first-child {
  border-top: 0;
  padding-top: 0;
}

.intro-number {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border: 1px solid rgba(201, 164, 76, 0.24);
  border-radius: 999px;
  background: rgba(201, 164, 76, 0.12);
  color: var(--gold-bright);
  font-size: 0.72rem;
  font-weight: 600;
}

.intro-section h2 {
  color: var(--cream);
  font-family: var(--serif);
  font-size: clamp(1.875rem, 4vw, 3rem);
}

.intro-copy {
  margin-top: 1.25rem;
  color: rgba(245, 234, 213, 0.74);
  font-family: var(--serif);
  font-size: clamp(0.9rem, 1.5vw, 1.08rem);
  line-height: 1.82;
}

.intro-copy p {
  margin: 0;
}

.intro-copy p + p,
.intro-copy p + .intro-callout,
.intro-copy p + .intro-outline,
.intro-copy p + .intro-theme-grid,
.intro-copy p + .intro-chapter-links {
  margin-top: 1.15rem;
}

.intro-callout {
  display: flex;
  gap: 0.8rem;
  border-left: 4px solid var(--gold);
  border-radius: 0.4rem;
  background: rgba(201, 164, 76, 0.1);
  padding: 1rem;
  color: var(--cream);
  font-size: 0.98rem;
  line-height: 1.7;
}

.intro-callout .icon {
  flex: 0 0 auto;
  margin-top: 0.2rem;
  color: var(--gold-bright);
}

.intro-outline,
.intro-theme-grid,
.intro-chapter-links {
  display: grid;
  gap: 0.75rem;
}

.intro-outline,
.intro-theme-grid {
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.intro-outline div,
.intro-theme-grid div,
.intro-chapter-links a {
  min-width: 0;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 0.42rem;
  background: rgba(16, 38, 58, 0.76);
  padding: 1rem;
}

.intro-outline strong,
.intro-theme-grid strong {
  display: block;
  margin-top: 0.35rem;
  color: var(--cream);
  font-family: var(--serif);
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.38;
}

.intro-chapter-links {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}

.intro-chapter-links a {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.3rem 0.7rem;
  align-items: center;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.intro-chapter-links a:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  background: rgba(201, 164, 76, 0.1);
}

.intro-chapter-links strong {
  color: var(--cream);
  font-family: var(--serif);
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.35;
}

.intro-chapter-links .icon {
  grid-row: 1 / span 2;
  grid-column: 2;
  color: var(--gold-bright);
}

.search-workspace {
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  background: rgba(16, 38, 58, 0.76);
  padding: clamp(1rem, 3vw, 1.6rem);
  box-shadow: var(--shadow);
}

.search-workspace label {
  display: block;
  margin-bottom: 0.6rem;
  color: var(--soft);
  font-weight: 600;
}

.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.7rem;
}

.search-row input {
  min-width: 0;
  min-height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: rgba(7, 17, 28, 0.46);
  color: var(--foreground);
  padding: 0.65rem 0.8rem;
}

.search-row input:focus {
  outline: 2px solid rgba(239, 207, 118, 0.45);
  outline-offset: 2px;
}

.search-meta {
  min-height: 1.5rem;
  margin-top: 1rem;
  color: var(--muted);
}

.search-results {
  display: grid;
  gap: 0.8rem;
  margin-top: 1rem;
}

.search-results a {
  display: grid;
  gap: 0.4rem;
  border: 1px solid rgba(229, 205, 154, 0.16);
  border-radius: 0.35rem;
  background: rgba(251, 243, 221, 0.04);
  padding: 0.85rem;
}

.search-results strong {
  color: var(--gold-bright);
}

.search-results span {
  color: rgba(245, 234, 213, 0.82);
}

.search-results mark {
  border-radius: 0.2rem;
  background: rgba(239, 207, 118, 0.28);
  color: var(--cream);
}

.chapter-strip {
  position: sticky;
  top: calc(46px + 4rem);
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.65rem;
  border-bottom: 1px solid var(--line);
  background: rgba(19, 45, 63, 0.92);
  padding: 0.25rem clamp(0.75rem, 2vw, 1.25rem);
  backdrop-filter: blur(14px);
}

.chapter-strip-main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 0;
}

.chapter-jump {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: min(14rem, 38vw);
  min-width: 10.5rem;
  height: 2.1rem;
  border: 1px solid rgba(229, 205, 154, 0.22);
  border-radius: 0.4rem;
  background: rgba(7, 17, 28, 0.18);
  padding: 0 0.35rem 0 0.55rem;
  color: var(--muted);
}

.chapter-jump > span,
.chapter-progress,
.chapter-step,
.chapter-menu summary {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.chapter-jump select {
  min-width: 0;
  flex: 1 1 auto;
  border: 0;
  background: transparent;
  color: var(--cream);
  font: 600 0.82rem var(--sans);
  letter-spacing: 0;
  outline: 0;
}

.chapter-jump option {
  background: #132d3f;
  color: var(--cream);
}

.chapter-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-height: 2.1rem;
  border: 1px solid rgba(229, 205, 154, 0.14);
  border-radius: 0.4rem;
  background: rgba(7, 17, 28, 0.10);
  color: rgba(245, 234, 213, 0.60);
  padding: 0 0.65rem;
  letter-spacing: 0.04em;
}

.verse-jump {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1 1 18.5rem;
  width: min(18.5rem, 42vw);
  min-width: 13rem;
  height: 2.55rem;
  border: 1px solid rgba(229, 205, 154, 0.18);
  border-radius: 0.4rem;
  background: rgba(245, 234, 213, 0.08);
  padding: 0 0.72rem 0 0.55rem;
  color: var(--cream);
}

.verse-jump:focus-within {
  border-color: var(--line-strong);
  background: rgba(245, 234, 213, 0.12);
}

.verse-jump.is-invalid {
  border-color: rgba(207, 169, 80, 0.72);
}

.reference-picker-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
}

.reference-picker-toggle:focus-visible {
  outline: 2px solid var(--gold-bright);
  outline-offset: 0.25rem;
}

.translation-badge {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.22rem;
  background: var(--gold);
  color: var(--ink);
  font-size: 0.48rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.reference-chevron {
  flex: 0 0 auto;
  color: rgba(245, 234, 213, 0.68);
}

.reference-chevron .icon {
  width: 0.85rem;
  height: 0.85rem;
}

.verse-jump input {
  min-width: 0;
  flex: 1 1 auto;
  border: 0;
  background: transparent;
  color: var(--cream);
  font: 600 clamp(0.92rem, 1.5vw, 1.08rem) var(--sans);
  letter-spacing: 0;
  outline: 0;
}

.verse-jump input::placeholder {
  color: rgba(245, 234, 213, 0.48);
}

.verse-jump input::-webkit-search-decoration,
.verse-jump input::-webkit-search-cancel-button {
  display: none;
}

.verse-jump-status {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  z-index: 3;
  max-width: 13rem;
  border: 1px solid rgba(229, 205, 154, 0.22);
  border-radius: 0.35rem;
  background: rgba(7, 17, 28, 0.94);
  color: var(--gold-bright);
  padding: 0.35rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22);
}

.verse-jump-status:empty {
  display: none;
}

.reference-picker {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 50%;
  z-index: 120;
  width: min(24rem, calc(100vw - 1.5rem));
  max-height: none;
  overflow: hidden;
  border: 1px solid rgba(229, 205, 154, 0.22);
  border-radius: 0.45rem;
  background: rgba(11, 31, 58, 0.98);
  color: var(--cream);
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.42);
  transform: translateX(-50%);
}

.reference-picker[hidden] {
  display: none;
}

.reference-picker-close,
.reference-picker-back,
.reference-picker-go,
.reference-picker-grid button,
.recent-toggle,
.recent-list button {
  font: inherit;
}

.reference-picker-close,
.reference-picker-back {
  display: inline-grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border: 0;
  border-radius: 0.35rem;
  background: rgba(245, 234, 213, 0.08);
  color: rgba(245, 234, 213, 0.72);
  cursor: pointer;
}

.reference-picker-close {
  font-size: 1.32rem;
  line-height: 1;
}

.reference-picker-close:hover,
.reference-picker-back:hover {
  background: var(--gold);
  color: var(--ink);
}

.reference-picker-head {
  display: grid;
  grid-template-columns: 1.8rem minmax(0, 1fr) auto 1.8rem;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid rgba(229, 205, 154, 0.14);
}

.reference-picker-back[hidden] {
  display: inline-grid;
  visibility: hidden;
  pointer-events: none;
}

.reference-picker-head strong {
  text-align: center;
  font-size: clamp(0.9rem, 1.6vw, 1.08rem);
  color: var(--cream);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.reference-picker-go {
  min-width: 2.45rem;
  min-height: 1.78rem;
  border: 0;
  border-radius: 0.35rem;
  background: var(--gold);
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}

.reference-picker-go:hover {
  background: var(--gold-bright);
}

.reference-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
  max-height: none;
  overflow: visible;
  padding: 0.75rem;
}

.reference-picker-grid button {
  min-height: 1.7rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: rgba(245, 234, 213, 0.72);
  font-size: clamp(0.72rem, 1vw, 0.875rem);
  font-weight: 600;
  cursor: pointer;
}

.reference-picker-grid button:hover,
.reference-picker-grid button.is-active {
  background: var(--gold);
  color: var(--ink);
}

.reference-picker-grid button:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--gold-bright);
  outline-offset: 2px;
}

.recent-jump {
  position: relative;
  flex: 0 0 auto;
}

.recent-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.55rem;
  border: 1px solid rgba(229, 205, 154, 0.18);
  border-radius: 0.4rem;
  background: rgba(245, 234, 213, 0.07);
  color: rgba(245, 234, 213, 0.72);
  padding: 0 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.recent-toggle:hover,
.recent-toggle[aria-expanded="true"] {
  border-color: rgba(229, 205, 154, 0.32);
  background: var(--gold);
  color: var(--ink);
}

.recent-toggle .icon {
  width: 0.85rem;
  height: 0.85rem;
}

.recent-dropdown {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 118;
  width: min(15rem, calc(100vw - 1.5rem));
  border: 1px solid rgba(229, 205, 154, 0.24);
  border-radius: 0.45rem;
  background: rgba(11, 31, 58, 0.98);
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.42);
  overflow: hidden;
}

.recent-dropdown[hidden] {
  display: none;
}

.recent-list {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem;
}

.recent-list button,
.recent-empty {
  width: 100%;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: rgba(245, 234, 213, 0.82);
  padding: 0.55rem 0.65rem;
  text-align: left;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0;
}

.recent-list button {
  cursor: pointer;
}

.recent-list button:hover {
  background: var(--gold);
  color: var(--ink);
}

.recent-empty {
  margin: 0;
  color: rgba(245, 234, 213, 0.52);
  font-weight: 600;
}

.chapter-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid rgba(229, 205, 154, 0.18);
  border-radius: 0.4rem;
  background: rgba(7, 17, 28, 0.16);
  color: rgba(245, 234, 213, 0.72);
  padding: 0;
}

.chapter-step .icon {
  width: 1.05rem;
  height: 1.05rem;
}

.chapter-step:hover {
  background: var(--gold);
  color: var(--ink);
}

.chapter-step.is-disabled {
  opacity: 0.36;
}

.chapter-menu {
  position: relative;
  flex: 0 0 auto;
}

.chapter-menu summary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.15rem;
  height: 2.1rem;
  border: 1px solid rgba(229, 205, 154, 0.18);
  border-radius: 0.4rem;
  background: rgba(7, 17, 28, 0.16);
  color: rgba(245, 234, 213, 0.72);
  padding: 0 0.65rem;
  cursor: pointer;
  list-style: none;
}

.chapter-menu summary::-webkit-details-marker {
  display: none;
}

.chapter-menu[open] summary,
.chapter-menu summary:hover {
  background: var(--gold);
  color: var(--ink);
}

.chapter-menu-grid {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  z-index: 90;
  display: grid;
  grid-template-columns: repeat(11, minmax(2.35rem, 1fr));
  gap: 0.35rem;
  width: min(42rem, calc(100vw - 2rem));
  max-height: min(70vh, 31rem);
  overflow: auto;
  border: 1px solid rgba(229, 205, 154, 0.24);
  border-radius: 0.45rem;
  background: rgba(11, 31, 58, 0.98);
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.42);
  padding: 0.75rem;
}

.chapter-menu-grid a {
  display: grid;
  min-height: 2.2rem;
  place-items: center;
  border-radius: 0.35rem;
  color: rgba(245, 234, 213, 0.72);
  font-size: 0.875rem;
  font-weight: 600;
}

.chapter-menu-grid a:hover,
.chapter-menu-grid a.is-active {
  background: var(--gold);
  color: var(--ink);
}

.reader-shell {
  display: grid;
  grid-template-columns: minmax(0, 0.45fr) minmax(28rem, 0.55fr);
  height: calc(100dvh - 46px - 4rem - 2.65rem);
  min-height: 34rem;
  overflow: hidden;
}

.scripture-panel,
.commentary-panel {
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.scripture-panel {
  background: #fbf3dd;
  color: #182130;
}

.commentary-panel {
  border-left: 1px solid var(--line);
  background:
    radial-gradient(680px 280px at 84% 0%, rgba(102, 113, 87, 0.18), transparent 58%),
    linear-gradient(180deg, rgba(16, 38, 58, 0.96), rgba(7, 17, 28, 0.96));
}

.reader-panel-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 5rem;
  border-bottom: 1px solid rgba(18, 33, 48, 0.14);
  background: rgba(251, 243, 221, 0.94);
  padding: 0.85rem clamp(1rem, 3vw, 1.6rem);
  backdrop-filter: blur(14px);
}

.reader-panel-header p {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: #6b5b3d;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.reader-panel-header h1,
.reader-panel-header h2 {
  margin-top: 0.15rem;
  color: #162131;
  font-family: var(--serif);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
}

.notes-header {
  border-bottom-color: var(--line);
  background: rgba(9, 22, 34, 0.92);
}

.notes-header p {
  color: var(--muted);
}

.notes-header h2 {
  color: var(--cream);
}

.reader-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.45rem;
}

.reader-controls .icon-button {
  border-color: rgba(18, 33, 48, 0.18);
  background: rgba(255, 255, 255, 0.46);
  color: #182130;
}

.scripture-text {
  width: min(100%, 48rem);
  margin: 0 auto;
  padding: clamp(1.2rem, 4vw, 2.4rem) clamp(1rem, 3vw, 1.8rem);
  font-family: var(--serif);
  font-size: var(--reader-font-size, 1.25rem);
  line-height: 1.85;
}

.verse {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr);
  gap: 0.8rem;
  margin: 0;
  padding: 0.52rem 0;
  border-bottom: 1px solid rgba(18, 33, 48, 0.08);
}

.verse-button {
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(18, 33, 48, 0.08);
  border-radius: 0.35rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background 160ms ease, box-shadow 160ms ease;
}

.verse-button:hover,
.verse-button.is-active {
  background: rgba(207, 169, 80, 0.12);
}

.verse-button.is-active {
  box-shadow: -3px 0 0 0 var(--gold);
}

.verse-button:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

.verse > span:last-child {
  min-width: 0;
}

.verse-number {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 50%;
  background: rgba(207, 169, 80, 0.18);
  color: #6f5420;
  font-family: var(--sans);
  font-size: 0.75rem;
  font-weight: 600;
}

.prev-next {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  width: min(100%, 48rem);
  margin: 0 auto;
  padding: 0 clamp(1rem, 3vw, 1.8rem) 2rem;
}

.prev-next a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 2.7rem;
  border: 1px solid rgba(18, 33, 48, 0.14);
  border-radius: 0.35rem;
  background: rgba(24, 33, 48, 0.05);
  color: #182130;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.notes-stack {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
}

.notes-stack section {
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  background: rgba(251, 243, 221, 0.04);
  padding: 1rem;
}

.notes-stack h3 {
  margin-bottom: 0.8rem;
  color: var(--soft);
  font-size: 1.5rem;
}

.ruled-blank {
  min-height: 12rem;
  background-image:
    repeating-linear-gradient(180deg, transparent 0, transparent 2.15rem, rgba(239, 207, 118, 0.14) 2.18rem),
    linear-gradient(90deg, rgba(251, 243, 221, 0.04), rgba(251, 243, 221, 0.01));
}

.ruled-blank.compact {
  min-height: 8rem;
}

.verse-note-grid {
  display: grid;
  gap: 0.65rem;
}

.verse-note-grid > div {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
}

.verse-note-grid span {
  color: var(--gold-bright);
  font-size: 0.78rem;
  font-weight: 600;
}

.mini-blank {
  min-height: 2.35rem;
}

.commentary-filled {
  align-content: start;
}

.verse-commentary-section {
  min-width: 0;
}

.commentary-entries {
  display: grid;
  gap: 1rem;
}

.commentary-entry {
  min-width: 0;
  border: 1px solid rgba(239, 207, 118, 0.14);
  border-radius: 0.38rem;
  background: rgba(7, 17, 28, 0.24);
  padding: clamp(0.95rem, 2vw, 1.2rem);
}

.commentary-entry h4 {
  margin: 0 0 0.65rem;
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.commentary-entry h4 a {
  color: inherit;
}

.commentary-entry h4 a:hover {
  color: var(--cream);
}

.commentary-entry p {
  margin: 0;
  color: rgba(245, 234, 213, 0.78);
  font-size: 1rem;
  line-height: 1.72;
  overflow-wrap: break-word;
}

.commentary-entry p + p {
  margin-top: 0.85rem;
}

.commentary-entry.is-empty .mini-blank {
  min-height: 4rem;
}

/* Daniel visual system ported to Isaiah.
   Keep these overrides late so the generated site stays visually locked to
   the Daniel navy/gold reader, header, and shell treatment. */
:root {
  --background: #0b1f3a;
  --foreground: #ece0c4;
  --muted: #b9ad90;
  --soft: #d8b866;
  --gold: #c9a44c;
  --gold-bright: #d8b866;
  --card: #18273a;
  --card-2: #334357;
  --line: rgba(201, 164, 76, 0.18);
  --line-strong: rgba(201, 164, 76, 0.36);
  --ink: #0b1f3a;
  --cream: #f4ead2;
  --shadow: 0 26px 60px -30px rgba(0, 0, 0, 0.72);
  --serif: "EB Garamond", Georgia, serif;
  --scripture-serif: "EB Garamond", Georgia, serif;
  --display: "Cinzel", Georgia, serif;
  --sans: "Jost", ui-sans-serif, system-ui, sans-serif;
}

body {
  background:
    radial-gradient(1200px 520px at 50% -12%, rgba(201, 164, 76, 0.10), transparent 60%),
    linear-gradient(180deg, #0d1c33 0%, #0b1f3a 55%, #081521 100%) !important;
  background-attachment: fixed !important;
  color: var(--foreground);
}

.mbe-global-shell[data-tool="isaiah"],
.mbe-global-footer[data-tool="isaiah"] {
  --mbe-accent: #c9a44c;
  --mbe-accent-dark: #5a7049;
}

.mbe-global-shell,
.mbe-global-footer {
  background: linear-gradient(180deg, #0e2138 0%, #0b1f3a 100%) !important;
  border-color: var(--line) !important;
  color: var(--muted) !important;
}

.mbe-ribbon-brand {
  color: #ece0c4 !important;
}

.mbe-ribbon-back::before {
  background: rgba(201, 164, 76, 0.30) !important;
}

.mbe-ribbon-logo,
.mbe-footer-logo {
  filter: grayscale(1) brightness(0) invert(88%) sepia(18%) saturate(320%) hue-rotate(2deg);
}

.mbe-library-panel {
  background: #12263f !important;
  color: #ece0c4 !important;
  border-color: rgba(201, 164, 76, 0.22) !important;
  box-shadow: 0 26px 60px -30px rgba(0, 0, 0, 0.7) !important;
}

.mbe-library-item {
  color: #ece0c4 !important;
}

.mbe-library-item:hover {
  background: #17304c !important;
}

.mbe-library-item[aria-current="page"] {
  background: rgba(201, 164, 76, 0.16) !important;
}

.mbe-library-name {
  color: #f3e8cc !important;
}

.mbe-library-desc {
  color: #b1a488 !important;
}

.mbe-footer-link {
  color: #e0c37e !important;
  border-bottom-color: rgba(201, 164, 76, 0.45) !important;
}

.site-header {
  top: 46px;
  border-bottom-color: var(--line);
  background: rgba(14, 33, 56, 0.92);
  box-shadow: none;
}

.site-header-inner {
  min-height: 4rem;
  padding: 0 clamp(1.5rem, 4vw, 3rem);
}

.site-brand {
  font-family: var(--display);
  font-size: 0.98rem;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.brand-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.32rem;
  background: var(--gold);
  color: #0c1f34;
}

.site-nav {
  gap: clamp(1.75rem, 3vw, 2.5rem);
}

.site-nav a {
  color: rgba(236, 224, 196, 0.44);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
}

.site-nav a:hover,
.site-nav a.is-active {
  color: #ece0c4;
}

h1,
h2 {
  font-family: var(--display) !important;
  font-weight: 600;
  letter-spacing: 0.015em;
  line-height: 1.12;
}

h3,
h4 {
  font-family: var(--serif) !important;
}

.hero {
  min-height: clamp(29rem, 65svh, 37rem);
  background: #0b1f3a;
}

.hero::before {
  background-image:
    linear-gradient(90deg, rgba(11, 31, 58, 0.72) 0%, rgba(11, 31, 58, 0.28) 36%, rgba(11, 31, 58, 0.08) 100%),
    linear-gradient(180deg, rgba(11, 31, 58, 0.03) 0%, rgba(11, 31, 58, 0.32) 57%, rgba(11, 31, 58, 0.90) 100%),
    url("/assets/isaiah-hero.png");
  background-position: center top;
  opacity: 0.86;
}

.hero::after,
.subhero::after {
  background:
    radial-gradient(circle at 20% 76%, rgba(11, 31, 58, 0.76) 0%, rgba(11, 31, 58, 0.34) 24%, transparent 52%),
    radial-gradient(circle at 86% 52%, rgba(201, 164, 76, 0.11) 0%, transparent 36%);
}

.hero-content {
  min-height: inherit;
  padding-top: clamp(2.75rem, 5vh, 3.75rem);
  padding-bottom: clamp(2rem, 4vh, 2.75rem);
}

.hero h1 {
  color: #f4ead2;
  font-size: clamp(3rem, 6.2vw, 7rem);
  line-height: 1 !important;
  letter-spacing: 0.01em !important;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
}

.hero-copy,
.subcopy {
  color: rgba(236, 224, 196, 0.82);
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
}

.eyebrow,
.chapter-group h3,
.notes-stack h3 {
  color: var(--soft);
}

.primary-action {
  background: #ece0c4;
  border-color: #ece0c4;
  color: #0b1f3a;
}

.primary-action:hover {
  background: var(--gold);
  border-color: var(--gold);
}

.secondary-action,
.chapter-group,
.template-links a,
.blank-document,
.search-workspace {
  border-color: var(--line);
  background: rgba(14, 33, 56, 0.82);
}

.chapter-group a,
.search-results a {
  border-radius: 0.35rem;
  border-color: rgba(201, 164, 76, 0.16);
  background: rgba(236, 224, 196, 0.04);
}

.subhero {
  background-image:
    linear-gradient(90deg, rgba(11, 31, 58, 0.92) 0%, rgba(11, 31, 58, 0.64) 42%, rgba(11, 31, 58, 0.16) 100%),
    linear-gradient(180deg, rgba(11, 31, 58, 0.18) 0%, rgba(11, 31, 58, 0.30) 58%, rgba(11, 31, 58, 0.90) 100%),
    url("/assets/isaiah-hero.png");
  background-position: center right;
  background-size: cover;
}

.chapter-strip {
  top: calc(46px + 4rem);
  gap: 0.45rem;
  min-height: 2.65rem;
  border-bottom-color: var(--line);
  background: rgba(31, 47, 68, 0.95);
}

.chapter-jump {
  border-color: rgba(201, 164, 76, 0.24);
  background: rgba(11, 31, 58, 0.42);
}

.chapter-jump > span {
  color: rgba(236, 224, 196, 0.70);
  letter-spacing: 0.18em;
}

.chapter-step,
.chapter-menu summary {
  border-color: rgba(201, 164, 76, 0.22);
  background: rgba(11, 31, 58, 0.36);
  color: rgba(236, 224, 196, 0.66);
  font-family: var(--sans);
  font-weight: 500;
}

.chapter-step:hover,
.chapter-menu[open] summary,
.chapter-menu summary:hover,
.chapter-menu-grid a:hover,
.chapter-menu-grid a.is-active {
  background: var(--gold);
  color: #0b1f3a;
  box-shadow: 0 8px 22px -14px rgba(0, 0, 0, 0.75);
}

.chapter-menu-grid {
  border-color: rgba(201, 164, 76, 0.28);
  background: rgba(19, 32, 48, 0.99);
}

.reader-shell {
  grid-template-columns: minmax(0, 40%) minmax(0, 60%);
  height: calc(100dvh - 46px - 4rem - 2.65rem);
  background: #18273a;
}

.scripture-panel {
  background: #18273a;
  color: #ece0c4;
}

.commentary-panel {
  border-left-color: rgba(201, 164, 76, 0.18);
  background: #334357;
}

.reader-panel-header {
  min-height: 4.25rem;
  border-bottom-color: rgba(201, 164, 76, 0.16);
  background: rgba(24, 39, 58, 0.94);
  padding: 0.85rem clamp(1.35rem, 3vw, 2.5rem);
}

.reader-panel-header p {
  color: #d8b866;
  font-family: var(--sans);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.18em;
}

.reader-panel-header strong {
  display: block;
  margin-top: 0.16rem;
  color: #f4ead2;
  font-size: 0.9rem;
  font-weight: 600;
}

.reader-panel-header h1,
.reader-panel-header h2 {
  color: #f4ead2;
}

.notes-header {
  background: rgba(51, 67, 87, 0.96);
}

.reader-controls .icon-button {
  border-color: rgba(201, 164, 76, 0.20);
  background: rgba(14, 33, 56, 0.36);
  color: #ece0c4;
}

.reader-controls .icon-button:hover {
  border-color: rgba(201, 164, 76, 0.38);
  background: rgba(201, 164, 76, 0.10);
}

.scripture-text {
  width: min(100%, 44rem);
  padding: clamp(1.6rem, 4vw, 2.5rem) clamp(1.25rem, 3.4vw, 2.6rem);
  color: #ece0c4;
  font-family: var(--scripture-serif);
  font-size: var(--reader-font-size, 1.25rem);
  font-weight: 400;
  line-height: 1.7;
}

.chapter-intro {
  margin-bottom: 2rem;
}

.chapter-intro h1 {
  color: #f4ead2;
  font-size: clamp(1.875rem, 3.1vw, 2.25rem);
  line-height: 1.05;
}

.verse {
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.5rem;
  padding: 0.7rem 0;
  border-bottom-color: rgba(201, 164, 76, 0.09);
}

.verse-button {
  border-bottom-color: rgba(201, 164, 76, 0.09);
  border-radius: 0.35rem;
}

.verse:hover,
.verse-button:hover,
.verse-button.is-active {
  background: rgba(236, 224, 196, 0.035);
}

.verse-button.is-active {
  box-shadow: -3px 0 0 0 var(--gold);
}

.verse-number {
  width: auto;
  height: auto;
  align-self: start;
  justify-self: start;
  border-radius: 0;
  background: transparent;
  color: #d8b866;
  font-family: var(--sans);
  font-size: 0.78rem;
  line-height: 1.72;
}

.prev-next a {
  border-color: rgba(201, 164, 76, 0.18);
  background: rgba(236, 224, 196, 0.04);
  color: #ece0c4;
}

.notes-stack {
  gap: 1rem;
  padding: clamp(1.1rem, 3vw, 1.55rem);
}

.notes-stack section {
  border-color: rgba(201, 164, 76, 0.24);
  border-radius: 0.42rem;
  background: rgba(24, 39, 58, 0.92);
}

.ruled-blank,
.mini-blank,
.blank-line,
.blank-space,
.blank-card {
  border-color: rgba(201, 164, 76, 0.22);
  background:
    repeating-linear-gradient(180deg, transparent 0, transparent 2.15rem, rgba(201, 164, 76, 0.10) 2.18rem),
    linear-gradient(90deg, rgba(236, 224, 196, 0.04), rgba(236, 224, 196, 0.01));
}

::selection {
  background: rgba(201, 164, 76, 0.35);
  color: #fff6e4;
}

@media (max-width: 1100px) {
  .intro-hero-inner {
    grid-template-columns: 1fr;
  }

  .intro-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chapter-grid,
  .template-links,
  .article-list {
    grid-template-columns: 1fr;
  }

  .article-shell {
    grid-template-columns: 1fr;
  }

  .article-toc {
    position: static;
  }

  .reader-shell {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .scripture-panel,
  .commentary-panel {
    overflow: visible;
  }

  .commentary-panel {
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}

@media (max-width: 760px) {
  .site-header {
    top: 46px;
  }

  .site-header-inner {
    min-height: 3.75rem;
    padding: 0 1rem;
  }

  .site-nav {
    display: none;
  }

  .menu-button {
    display: inline-grid;
  }

  .mobile-nav.is-open {
    display: grid;
  }

  .hero-content {
    padding: 6.5rem 1rem 2.5rem;
  }

  .hero h1 {
    font-size: clamp(3rem, 17vw, 4.5rem);
  }

  .hero-copy {
    font-size: 1rem;
  }

  .article-hero-inner {
    padding: 6.4rem 1rem 2.4rem;
  }

  .article-hero h1 {
    font-size: clamp(2.25rem, 13vw, 3.75rem);
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .article-list {
    gap: 0.75rem;
  }

  .article-card {
    min-height: 0;
    padding: 1rem;
  }

  .article-shell {
    padding: 2rem 1rem;
  }

  .article-content {
    padding: 1.15rem;
  }

  .article-section h2 {
    font-size: clamp(1.5rem, 8vw, 1.875rem);
    overflow-wrap: anywhere;
    hyphens: auto;
  }

  .article-section p,
  .article-section li {
    font-size: 1rem;
    line-height: 1.72;
  }

  .article-nav {
    grid-template-columns: 1fr;
    padding: 0 1rem 3rem;
  }

  .intro-hero-inner {
    padding-top: 5.25rem;
    padding-bottom: 2.4rem;
  }

  .intro-hero h1 {
    font-size: clamp(2.25rem, 10.5vw, 3.75rem);
  }

  .intro-facts,
  .intro-outline,
  .intro-theme-grid,
  .intro-chapter-links {
    grid-template-columns: 1fr;
  }

  .intro-section-nav {
    top: calc(46px + 3.75rem);
  }

  .intro-section {
    grid-template-columns: 1fr;
    scroll-margin-top: 12rem;
  }

  .intro-number {
    width: 2rem;
    height: 2rem;
  }

  .chapter-strip {
    top: calc(46px + 3.75rem);
    flex-wrap: nowrap;
    gap: 0.35rem;
    min-height: 2.55rem;
    padding: 0.25rem 0.55rem;
  }

  .chapter-strip-main {
    flex: 1 1 auto;
    justify-content: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .chapter-jump {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    max-width: 11rem;
  }

  .chapter-jump > span {
    display: none;
  }

  .chapter-progress {
    display: none;
  }

  .verse-jump {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    height: 2.35rem;
    gap: 0.35rem;
    padding: 0 0.5rem 0 0.42rem;
  }

  .translation-badge {
    width: 1.32rem;
    height: 1.32rem;
    font-size: 0.42rem;
  }

  .verse-jump input {
    font-size: clamp(0.86rem, 4vw, 1rem);
  }

  .reference-picker {
    position: fixed;
    top: calc(46px + 3.15rem + 2.15rem);
    right: 1rem;
    left: 1rem;
    width: auto;
    max-height: none;
    border-radius: 0.45rem;
    transform: none;
  }

  .reference-picker-close,
  .reference-picker-back {
    width: 1.65rem;
    height: 1.65rem;
  }

  .reference-picker-close {
    font-size: 1.25rem;
  }

  .reference-picker-head {
    grid-template-columns: 1.65rem minmax(0, 1fr) auto 1.65rem;
    padding: 0.45rem 0.5rem;
  }

  .reference-picker-head strong {
    font-size: 0.875rem;
  }

  .reference-picker-go {
    min-width: 2.25rem;
    min-height: 1.62rem;
    font-size: 0.66rem;
  }

  .reference-picker-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.25rem;
    max-height: none;
    overflow: visible;
    padding: 0.5rem;
  }

  .reference-picker-grid button {
    min-height: 1.55rem;
    font-size: 0.66rem;
  }

  .recent-toggle {
    min-height: 2.35rem;
    padding: 0 0.48rem;
    font-size: 0.58rem;
    letter-spacing: 0.05em;
  }

  .recent-toggle .icon {
    width: 0.68rem;
    height: 0.68rem;
  }

  .recent-dropdown {
    width: min(12rem, calc(100vw - 1rem));
  }

  .recent-list {
    gap: 0.25rem;
    padding: 0.5rem;
  }

  .recent-list button,
  .recent-empty {
    padding: 0.45rem 0.5rem;
    font-size: 0.72rem;
  }

  .chapter-step {
    width: 2.1rem;
    min-width: 2.1rem;
  }

  .chapter-menu {
    flex: 0 0 auto;
  }

  .chapter-menu summary {
    min-width: 2.85rem;
    padding: 0 0.55rem;
  }

  .chapter-menu-grid {
    position: fixed;
    top: calc(46px + 3.75rem + 2.75rem);
    right: 0.5rem;
    left: 0.5rem;
    transform: none;
    width: auto;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .search-row {
    grid-template-columns: 1fr;
  }

  .blank-document-grid {
    grid-template-columns: 1fr;
  }

  .reader-panel-header {
    min-height: 4.5rem;
  }

  .scripture-text {
    font-size: var(--reader-font-size, 1.125rem);
  }

  .verse {
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.6rem;
  }

  .prev-next {
    grid-template-columns: 1fr;
  }

  .verse-note-grid > div {
    grid-template-columns: 3.5rem minmax(0, 1fr);
  }
}

/* Strict Isaiah font system overrides */
:root {
  --serif: "EB Garamond", Georgia, serif;
  --scripture-serif: "EB Garamond", Georgia, serif;
  --display: "Cinzel", Georgia, serif;
  --sans: "Jost", ui-sans-serif, system-ui, sans-serif;
}

body,
button,
input,
select,
textarea {
  font-family: var(--sans);
}

.chapter-strip {
  top: calc(46px + 4rem);
  min-height: 4rem;
  gap: 0.65rem;
  border-bottom-color: rgba(201, 164, 76, 0.18);
  background: rgba(31, 47, 68, 0.96);
  padding: 0.45rem clamp(1rem, 2.4vw, 2rem);
}

.chapter-strip-main {
  gap: 0.5rem;
}

.chapter-step {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  border-color: rgba(201, 164, 76, 0.22);
  background: rgba(16, 38, 58, 0.42);
  color: rgba(236, 224, 196, 0.72);
}

.chapter-step .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.verse-jump {
  width: min(34rem, 45vw);
  min-width: 24rem;
  height: 3rem;
  border-radius: 0.5rem;
  border-color: rgba(201, 164, 76, 0.28);
  background: rgba(236, 224, 196, 0.08);
  padding: 0 0.9rem 0 0.7rem;
}

.translation-badge {
  width: 2rem;
  height: 2rem;
  border-radius: 0.35rem;
  font-size: 0.62rem;
  font-weight: 600;
}

.reference-chevron .icon {
  width: 1rem;
  height: 1rem;
}

.verse-jump input {
  color: #f4ead2;
  font-family: var(--sans);
  font-size: 1.02rem;
  font-weight: 600;
}

.recent-toggle,
.chapter-menu summary {
  height: 3rem;
  min-height: 3rem;
  border-radius: 0.5rem;
  border-color: rgba(201, 164, 76, 0.24);
  font-family: var(--sans);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.recent-toggle {
  min-width: 7.1rem;
  background: rgba(236, 224, 196, 0.08);
  color: rgba(236, 224, 196, 0.76);
}

.chapter-menu summary {
  min-width: 5rem;
  background: var(--gold);
  color: var(--ink);
}

.reference-picker {
  width: min(31rem, calc(100vw - 1.5rem));
  border-radius: 0.55rem;
  background: rgba(244, 238, 224, 0.98);
  color: #111827;
}

.reference-picker-head {
  border-bottom-color: rgba(17, 24, 39, 0.1);
}

.reference-picker-head strong,
.reference-picker-grid button,
.reference-picker-close,
.reference-picker-back {
  color: #111827;
}

.reference-picker-close,
.reference-picker-back {
  background: rgba(17, 24, 39, 0.06);
}

.reference-picker-grid {
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.18rem;
  padding: 0.75rem;
}

.reference-picker-grid button {
  min-height: 2rem;
  border-radius: 0;
  background: #c5cfdd;
  font-size: 0.82rem;
}

.reference-picker-grid button:hover,
.reference-picker-grid button.is-active {
  background: var(--gold);
  color: var(--ink);
}

.reader-shell {
  display: grid;
  grid-template-columns: minmax(0, 40%) minmax(0, 60%);
  height: calc(100dvh - 46px - 4rem - 4rem);
  min-height: 0;
  overflow: hidden;
  background: #18273a;
}

.scripture-panel,
.commentary-panel {
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-top: 5rem;
  scrollbar-width: thin;
}

.scripture-panel {
  border-right: 1px solid rgba(201, 164, 76, 0.16);
  background: #18273a;
  color: #ece0c4;
}

.commentary-panel {
  border-left: 0;
  background: #334357;
  color: #ece0c4;
}

.reader-panel-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  height: 67px;
  min-height: 65px;
  border-bottom: 1px solid rgba(201, 164, 76, 0.16);
  background: rgba(24, 39, 58, 0.96);
  padding: 0.75rem 1.5rem;
  backdrop-filter: blur(14px);
}

.notes-header {
  align-items: flex-start;
  background: rgba(24, 39, 58, 0.98);
}

.reader-panel-header p,
.notes-header h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: rgba(236, 224, 196, 0.72);
  font-family: var(--sans);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1rem;
  text-transform: uppercase;
}

.notes-header h2 {
  color: #ece0c4;
  font-family: var(--display-font) !important;
  font-size: 0.875rem;
  font-weight: 600;
}

.reader-panel-header strong {
  display: block;
  max-width: min(34rem, 64vw);
  margin-top: 0.25rem;
  overflow: hidden;
  color: #f4ead2;
  font-family: var(--sans);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reader-controls .icon-button {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.375rem;
  border-color: rgba(201, 164, 76, 0.20);
  background: rgba(14, 33, 56, 0.70);
  color: rgba(236, 224, 196, 0.78);
}

.reader-controls .icon-button .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.reader-controls .icon-button:hover {
  border-color: rgba(201, 164, 76, 0.38);
  background: rgba(236, 224, 196, 0.08);
  color: #f4ead2;
}

.reader-controls .icon-button:disabled {
  cursor: default;
  opacity: 0.42;
}

.reader-controls .icon-button:disabled:hover {
  border-color: rgba(201, 164, 76, 0.20);
  background: rgba(14, 33, 56, 0.70);
  color: rgba(236, 224, 196, 0.78);
}

.notes-jump {
  display: none;
}

.scripture-text {
  width: min(100%, 48rem);
  margin: 0 auto;
  padding: 1.5rem 2.5rem 2rem;
  color: #ece0c4;
  font-family: var(--scripture-serif);
  font-size: var(--reader-font-size, 1.25rem);
  font-weight: 400;
  line-height: var(--reader-line-height, 1.75rem);
}

.chapter-intro {
  margin: 0 0 1.75rem;
  border-bottom: 0;
  padding-bottom: 0;
}

.chapter-intro h1 {
  margin: 0;
  color: #f4ead2;
  font-family: var(--display-font) !important;
  font-size: 2.25rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 2.5rem;
}

.chapter-intro p {
  max-width: 42rem;
  margin: 0.75rem 0 0;
  color: rgba(236, 224, 196, 0.72);
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.75rem;
}

.chapter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.chapter-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 1.625rem;
  border: 1px solid rgba(201, 164, 76, 0.18);
  border-radius: 999px;
  background: rgba(236, 224, 196, 0.04);
  color: rgba(236, 224, 196, 0.76);
  padding: 0.25rem 0.625rem;
  font-family: var(--sans);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.scripture-verses {
  display: grid;
  gap: 1rem;
  font-family: var(--scripture-serif);
  font-size: var(--reader-font-size, 1.25rem);
  font-weight: 400;
  line-height: var(--reader-line-height, 1.75rem);
}

.verse-unit {
  min-width: 0;
}

.verse {
  display: block;
  scroll-margin-top: 5.5rem;
  width: 100%;
  margin: 0;
  border: 0;
  border-radius: 0.25rem;
  padding: 0.5rem;
  background: transparent;
  color: inherit;
  font-family: var(--scripture-serif);
  font-size: inherit;
  font-weight: 400;
  line-height: inherit;
  text-align: left;
}

.verse-button {
  cursor: pointer;
  transition: background 250ms ease, border-color 250ms ease, box-shadow 250ms ease, color 250ms ease;
}

.verse-button:hover,
.verse-button.is-active {
  background: rgba(201, 164, 76, 0.10);
}

.verse-button.is-active {
  box-shadow: -3px 0 0 0 var(--gold);
}

.verse-number {
  display: inline;
  width: auto;
  height: auto;
  margin-right: 0.5rem;
  vertical-align: super;
  border-radius: 0;
  background: transparent;
  color: #d8b866;
  font-family: var(--sans);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 0;
}

.verse-number a {
  color: inherit;
}

.passage-outline-divider {
  margin: 2rem 0 0.65rem;
  border-top: 0;
  padding-top: 0;
  font-family: var(--sans);
}

.passage-outline-range {
  color: #d8b866;
  font-family: var(--sans);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1.35;
  text-transform: uppercase;
}

.passage-outline-title {
  margin: 0.35rem 0 0;
  color: #ece0c4;
  font-family: var(--display-font);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.35;
}

.prev-next {
  width: min(100%, 48rem);
  padding: 0 2.5rem 2rem;
}

.notes-stack {
  display: block;
  padding: 1.25rem;
  scroll-margin-top: 5rem;
}

.commentary-entry {
  width: min(100%, 66rem);
  margin: 0 auto;
  border: 1px solid rgba(201, 164, 76, 0.55);
  border-radius: 0.375rem;
  background: #18273a;
  padding: 1.25rem;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.22),
    0 0 0 1px rgba(201, 164, 76, 0.35);
}

.commentary-entry h4 {
  margin: 0 0 0.75rem;
  color: #ece0c4;
  font-family: var(--sans) !important;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.25rem;
  text-transform: none;
}

.commentary-entry h4 a:hover {
  color: var(--gold-bright);
}

.commentary-entry p {
  margin: 0;
  color: #ece0c4;
  font-family: var(--sans);
  font-size: var(--notes-font-size, 1.125rem);
  font-weight: 400;
  line-height: var(--notes-line-height, 2rem);
  overflow-wrap: break-word;
}

.commentary-entry p + p {
  margin-top: 1rem;
}

.study-links-panel {
  margin-top: 1.5rem;
  border: 1px solid rgba(201, 164, 76, 0.34);
  border-radius: 0.45rem;
  background: rgba(14, 33, 56, 0.38);
  font-size: var(--notes-font-size, 1.125rem);
  padding: 1.25rem;
}

.study-links-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  width: auto;
  margin: 0 0 1.35rem !important;
  background: rgba(236, 224, 196, 0.09);
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  line-height: 1.25rem;
  padding: 0.18rem 0.35rem;
  text-transform: uppercase;
}

.study-links-label .icon {
  width: 1rem;
  height: 1rem;
}

.cross-reference-panel {
  margin-top: 0;
}

.cross-reference-panel h5,
.word-notes-section h5 {
  margin: 0 0 1rem;
  color: rgba(236, 224, 196, 0.82);
  font-family: var(--sans);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  line-height: 1.25rem;
  text-transform: uppercase;
}

.cross-reference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.62rem 0.75rem;
  align-items: flex-start;
}

.cross-reference-chip {
  display: inline-flex;
  position: relative;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  border: 1px solid rgba(201, 164, 76, 0.42);
  border-radius: 0.45rem;
  background: rgba(236, 224, 196, 0.075);
  color: #f4ead2;
  font-family: var(--sans);
  font-size: var(--notes-chip-font-size, 1rem);
  font-weight: 600;
  line-height: 1.25rem;
  padding: 0.55rem 0.85rem;
  text-decoration: none;
}

.cross-reference-chip[data-verse-preview] {
  cursor: default;
}

a.cross-reference-chip[data-verse-preview] {
  cursor: pointer;
}

.cross-reference-chip[data-verse-preview]::after {
  content: attr(data-verse-preview);
  position: absolute;
  left: 0;
  bottom: calc(100% + 0.6rem);
  z-index: 20;
  display: none;
  width: min(27rem, calc(100vw - 2rem));
  border: 1px solid rgba(224, 182, 69, 0.62);
  border-radius: 0.45rem;
  background: rgba(7, 17, 28, 0.98);
  box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.34);
  color: #f4ead2;
  font-family: var(--sans);
  font-size: 0.875rem;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.5rem;
  padding: 0.75rem 0.85rem;
  pointer-events: none;
  text-align: left;
  text-transform: none;
  white-space: normal;
}

.cross-reference-chip[data-verse-preview]::before {
  content: "";
  position: absolute;
  left: 1rem;
  bottom: calc(100% + 0.34rem);
  z-index: 21;
  display: none;
  width: 0.55rem;
  height: 0.55rem;
  border-right: 1px solid rgba(224, 182, 69, 0.62);
  border-bottom: 1px solid rgba(224, 182, 69, 0.62);
  background: rgba(7, 17, 28, 0.98);
  pointer-events: none;
  transform: rotate(45deg);
}

.cross-reference-chip[data-verse-preview]:hover::after,
.cross-reference-chip[data-verse-preview]:hover::before,
.cross-reference-chip[data-verse-preview]:focus-visible::after,
.cross-reference-chip[data-verse-preview]:focus-visible::before {
  display: block;
}

a.cross-reference-chip:hover {
  border-color: rgba(224, 182, 69, 0.76);
  background: rgba(224, 182, 69, 0.14);
  color: #fff8e6;
}

.word-notes-section {
  margin-top: 1.5rem;
}

.word-note-list {
  display: grid;
  gap: 1rem;
}

.word-note-card {
  border: 1px solid rgba(224, 182, 69, 0.78);
  border-radius: 0.45rem;
  background: rgba(7, 17, 28, 0.18);
  padding: 1rem 1.15rem;
}

.word-note-card h6 {
  margin: 0 0 0.75rem;
  background: rgba(236, 224, 196, 0.09);
  color: var(--gold-bright);
  font-family: var(--sans);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.25rem;
  padding: 0.18rem 0.28rem;
}

.word-note-card p {
  margin: 0;
  color: rgba(236, 224, 196, 0.86);
  font-family: var(--serif);
  font-size: var(--notes-word-font-size, 1rem);
  font-weight: 400;
  line-height: var(--notes-word-line-height, 1.75rem);
}

.word-note-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.05rem;
  margin-top: 0.8rem;
}

.word-note-reference-chip {
  min-height: auto;
  border: 0;
  background: transparent;
  color: var(--gold-bright);
  font-size: var(--notes-reference-font-size, 0.875rem);
  line-height: 1.25rem;
  padding: 0;
}

a.word-note-reference-chip:hover {
  background: transparent;
  color: #fff8e6;
}

.commentary-entry.is-empty .mini-blank {
  min-height: 10rem;
}

@media (max-width: 1100px) {
  .reader-shell {
    display: block;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .scripture-panel,
  .commentary-panel {
    overflow: visible;
  }

  .scripture-panel {
    border-right: 0;
  }

  .commentary-panel {
    border-top: 1px solid rgba(201, 164, 76, 0.18);
  }

  .notes-jump {
    display: inline-grid;
  }
}

@media (max-width: 760px) {
  .chapter-strip {
    top: calc(46px + 3.75rem);
    min-height: 3.25rem;
    gap: 0.35rem;
    padding: 0.25rem 0.55rem;
  }

  .chapter-strip-main {
    gap: 0.28rem;
  }

  .chapter-step {
    width: 2.45rem;
    min-width: 2.45rem;
    height: 2.45rem;
  }

  .verse-jump {
    min-width: 0;
    height: 2.45rem;
    padding: 0 0.55rem 0 0.45rem;
  }

  .translation-badge {
    width: 1.45rem;
    height: 1.45rem;
    font-size: 0.48rem;
  }

  .verse-jump input {
    font-size: 0.98rem;
  }

  .recent-toggle,
  .chapter-menu summary {
    min-width: auto;
    height: 2.45rem;
    min-height: 2.45rem;
    padding: 0 0.58rem;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
  }

  .recent-toggle {
    min-width: 4.7rem;
  }

  .chapter-menu summary {
    min-width: 3.2rem;
  }

  .reference-picker {
    top: calc(46px + 3.75rem + 3.25rem);
  }

  .reference-picker-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.12rem;
    padding: 0.5rem;
  }

  .reference-picker-grid button {
    min-height: 1.62rem;
    font-size: 0.68rem;
  }

  .reader-panel-header {
    min-height: 65px;
    padding: 0.75rem 1rem;
  }

  .scripture-panel .reader-panel-header {
    gap: 0.5rem;
    justify-content: flex-start;
  }

  .reader-panel-header > div:first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  .reader-panel-header strong {
    max-width: min(13rem, calc(100vw - 10rem));
    font-size: 0.875rem;
  }

  .notes-header h2 {
    font-size: 0.875rem;
  }

  .reader-controls {
    gap: 0.22rem;
  }

  .reader-controls .icon-button {
    width: 2.5rem;
    height: 2.5rem;
  }

  .reader-controls .icon-button .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .scripture-text {
    padding: 1.5rem 1.25rem 2rem;
    font-size: var(--reader-font-size, 1.125rem);
    line-height: var(--reader-line-height, 1.75rem);
  }

  .scripture-verses {
    font-size: var(--reader-font-size, 1.125rem);
    line-height: var(--reader-line-height, 1.75rem);
  }

  .chapter-intro {
    margin-bottom: 1.75rem;
  }

  .chapter-intro h1 {
    font-size: 1.875rem;
    line-height: 2.25rem;
  }

  .chapter-intro p {
    font-size: 0.875rem;
    line-height: 1.75rem;
  }

  .prev-next {
    padding-right: 1.25rem;
    padding-left: 1.25rem;
  }

  .notes-stack {
    padding: 1.25rem;
  }

  .commentary-entry {
    padding: 1.25rem;
  }

  .commentary-entry p {
    font-size: var(--notes-font-size, 1.125rem);
    line-height: var(--notes-line-height, 2rem);
  }
}

@media print {
  .mbe-global-shell,
  .site-header,
  .chapter-strip,
  .commentary-panel,
  .reader-controls,
  .prev-next,
  .mbe-global-footer {
    display: none !important;
  }

  body,
  .reader-shell,
  .scripture-panel {
    display: block;
    height: auto;
    background: #fff;
    color: #000;
  }
}
`;

const js = `
(() => {
  const yearNodes = document.querySelectorAll("[data-mbe-year]");
  yearNodes.forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  if (menuButton && mobileNav) {
    menuButton.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
  }

  const chapterJump = document.querySelector("[data-chapter-jump]");
  if (chapterJump) {
    chapterJump.addEventListener("change", () => {
      const chapter = Number(chapterJump.value);
      if (chapter >= 1 && chapter <= 66) {
        window.location.href = "/chapters/" + chapter + "/";
      }
    });
  }

  const chapterMenu = document.querySelector("[data-chapter-menu]");
  if (chapterMenu) {
    document.addEventListener("click", (event) => {
      if (!chapterMenu.contains(event.target)) chapterMenu.removeAttribute("open");
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") chapterMenu.removeAttribute("open");
    });
  }

  const scripture = document.querySelector("[data-scripture-text]");
  const fontUp = document.querySelector("[data-font-up]");
  const fontDown = document.querySelector("[data-font-down]");
  const safeStorageRemove = (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Browsers can disable localStorage; text sizing still works for this page.
    }
  };
  [
    "isaiah-reader-font",
    "isaiah-reader-font-v2",
    "isaiah-reader-font-daniel",
    "isaiah-reader-font-system",
    "isaiah-reader-font-step-daniel-v2",
    "isaiah-notes-font",
    "isaiah-notes-font-v2",
    "isaiah-notes-font-daniel",
    "isaiah-notes-font-system",
    "isaiah-notes-font-step-daniel-v2",
  ].forEach(safeStorageRemove);
  const readerFontSteps = [
    { size: 1.125, line: 1.75 },
    { size: 1.25, line: 1.75 },
    { size: 1.5, line: 2 },
    { size: 1.875, line: 2.25 },
  ];
  let fontIndex = 1;
  const applyFont = () => {
    if (!scripture) return;
    const step = readerFontSteps[fontIndex];
    scripture.style.setProperty("--reader-font-size", step.size + "rem");
    scripture.style.setProperty("--reader-line-height", step.line + "rem");
    if (fontDown) fontDown.disabled = fontIndex === 0;
    if (fontUp) fontUp.disabled = fontIndex === readerFontSteps.length - 1;
  };
  if (scripture) applyFont();
  if (fontUp) fontUp.addEventListener("click", () => {
    fontIndex = Math.min(readerFontSteps.length - 1, fontIndex + 1);
    applyFont();
  });
  if (fontDown) fontDown.addEventListener("click", () => {
    fontIndex = Math.max(0, fontIndex - 1);
    applyFont();
  });

  const notesPanel = document.querySelector("[data-study-panel]");
  const notesFontUp = document.querySelector("[data-notes-font-up]");
  const notesFontDown = document.querySelector("[data-notes-font-down]");
  const notesFontSteps = [
    { size: 1, line: 2, chip: 0.875, word: 1, wordLine: 1.75, ref: 0.875 },
    { size: 1.125, line: 2, chip: 1, word: 1, wordLine: 1.75, ref: 0.875 },
    { size: 1.25, line: 2.25, chip: 1.125, word: 1.125, wordLine: 2, ref: 1 },
    { size: 1.5, line: 2.5, chip: 1.25, word: 1.25, wordLine: 2.25, ref: 1.125 },
  ];
  let notesFontIndex = 1;
  const applyNotesFont = () => {
    if (!notesPanel) return;
    const step = notesFontSteps[notesFontIndex];
    notesPanel.style.setProperty("--notes-font-size", step.size + "rem");
    notesPanel.style.setProperty("--notes-line-height", step.line + "rem");
    notesPanel.style.setProperty("--notes-chip-font-size", step.chip + "rem");
    notesPanel.style.setProperty("--notes-word-font-size", step.word + "rem");
    notesPanel.style.setProperty("--notes-word-line-height", step.wordLine + "rem");
    notesPanel.style.setProperty("--notes-reference-font-size", step.ref + "rem");
    if (notesFontDown) notesFontDown.disabled = notesFontIndex === 0;
    if (notesFontUp) notesFontUp.disabled = notesFontIndex === notesFontSteps.length - 1;
  };
  if (notesPanel) applyNotesFont();
  if (notesFontUp) notesFontUp.addEventListener("click", () => {
    notesFontIndex = Math.min(notesFontSteps.length - 1, notesFontIndex + 1);
    applyNotesFont();
  });
  if (notesFontDown) notesFontDown.addEventListener("click", () => {
    notesFontIndex = Math.max(0, notesFontIndex - 1);
    applyNotesFont();
  });

  const verseButtons = Array.from(document.querySelectorAll("[data-verse-select]"));
  const noteEntries = Array.from(document.querySelectorAll("[data-commentary-note]"));
  const commentaryPanel = document.querySelector("[data-study-panel]");
  const workspace = document.querySelector("[data-chapter-workspace]");
  const chapterVerseCounts = [0, 31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24];
  const verseJumpForm = document.querySelector("[data-verse-jump-form]");
  const verseJumpInput = document.querySelector("[data-verse-jump-input]");
  const verseJumpStatus = document.querySelector("[data-verse-jump-status]");
  const referencePicker = document.querySelector("[data-reference-picker]");
  const referencePickerToggle = document.querySelector("[data-reference-picker-toggle]");
  const referencePickerClose = document.querySelector("[data-reference-picker-close]");
  const referencePickerBack = document.querySelector("[data-reference-picker-back]");
  const referencePickerGo = document.querySelector("[data-reference-picker-go]");
  const referencePickerGrid = document.querySelector("[data-reference-picker-grid]");
  const referencePickerTitle = document.querySelector("[data-reference-picker-title]");
  const recentJump = document.querySelector("[data-recent-jump]");
  const recentToggle = document.querySelector("[data-recent-toggle]");
  const recentDropdown = document.querySelector("[data-recent-dropdown]");
  const recentList = document.querySelector("[data-recent-list]");
  const currentChapterMatch = window.location.pathname.match(/\\/chapters\\/(\\d+)\\//);
  const currentChapter = Number(
    verseJumpForm?.dataset.currentChapter || currentChapterMatch?.[1] || "0",
  );
  const recentStorageKey = "isaiahRecentReferences";
  const formatReference = (chapter, verse) => "Isaiah " + chapter + ":" + verse;
  let pickerChapter = currentChapter || 1;
  let pickerVerse = 1;
  let pickerMode = "chapters";

  const selectedVerseNumber = () => {
    const active = document.querySelector("[data-verse-select].is-active");
    if (active?.dataset.verseSelect) return Number(active.dataset.verseSelect);
    const hashMatch = window.location.hash.match(/^#v(\\d+)$/);
    return Number(hashMatch?.[1] || "1");
  };

  const validReference = (chapter, verse) =>
    chapter >= 1 && chapter <= 66 && verse >= 1 && verse <= (chapterVerseCounts[chapter] || 0);

  const readRecentReferences = () => {
    try {
      const value = JSON.parse(localStorage.getItem(recentStorageKey) || "[]");
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => ({ chapter: Number(item.chapter), verse: Number(item.verse) }))
        .filter((item) => validReference(item.chapter, item.verse))
        .slice(0, 8);
    } catch {
      return [];
    }
  };

  const writeRecentReferences = (references) => {
    try {
      localStorage.setItem(recentStorageKey, JSON.stringify(references));
    } catch {
      // Browsers can disable localStorage; the picker still works without recents.
    }
  };

  const renderRecentReferences = () => {
    if (!recentList) return;
    const references = readRecentReferences();
    if (!references.length) {
      recentList.innerHTML = '<p class="recent-empty">No recent verses yet.</p>';
      return;
    }

    recentList.innerHTML = references
      .map(
        ({ chapter, verse }) =>
          '<button type="button" data-recent-chapter="' +
          chapter +
          '" data-recent-verse="' +
          verse +
          '">' +
          formatReference(chapter, verse) +
          "</button>",
      )
      .join("");
  };

  const addRecentReference = (chapter, verse) => {
    chapter = Number(chapter);
    verse = Number(verse);
    if (!validReference(chapter, verse)) return;
    const references = readRecentReferences().filter(
      (item) => item.chapter !== chapter || item.verse !== verse,
    );
    references.unshift({ chapter, verse });
    writeRecentReferences(references.slice(0, 8));
    renderRecentReferences();
  };

  const closeRecentDropdown = () => {
    if (!recentDropdown || !recentToggle) return;
    recentDropdown.hidden = true;
    recentToggle.setAttribute("aria-expanded", "false");
  };

  const openRecentDropdown = () => {
    if (!recentDropdown || !recentToggle) return;
    closeReferencePicker();
    renderRecentReferences();
    recentDropdown.hidden = false;
    recentToggle.setAttribute("aria-expanded", "true");
  };

  const goToRecentReference = (chapter, verse) => {
    if (!validReference(chapter, verse)) return;
    addRecentReference(chapter, verse);
    closeRecentDropdown();
    if (verseJumpInput) verseJumpInput.value = formatReference(chapter, verse);

    if (chapter === currentChapter) {
      selectVerse(String(verse), {
        scrollNotes: true,
        revealNotes: true,
        scrollVerse: true,
        updateHash: true,
      });
      return;
    }

    window.location.href = "/chapters/" + chapter + "/#v" + verse;
  };

  const closeReferencePicker = () => {
    if (!referencePicker || !referencePickerToggle) return;
    referencePicker.hidden = true;
    referencePickerToggle.setAttribute("aria-expanded", "false");
  };

  const openReferencePicker = () => {
    if (!referencePicker || !referencePickerToggle || !referencePickerGrid) return;
    pickerChapter = currentChapter || 1;
    pickerVerse = selectedVerseNumber();
    closeRecentDropdown();
    referencePicker.hidden = false;
    referencePickerToggle.setAttribute("aria-expanded", "true");
    renderChapterPicker();
  };

  const goToPickerSelection = () => {
    if (!pickerChapter || !pickerVerse) return;
    setVerseJumpStatus("");
    addRecentReference(pickerChapter, pickerVerse);
    if (verseJumpInput) verseJumpInput.value = formatReference(pickerChapter, pickerVerse);
    closeReferencePicker();

    if (pickerChapter === currentChapter) {
      selectVerse(String(pickerVerse), {
        scrollNotes: true,
        revealNotes: true,
        scrollVerse: true,
        updateHash: true,
      });
      return;
    }

    window.location.href = "/chapters/" + pickerChapter + "/#v" + pickerVerse;
  };

  function renderChapterPicker() {
    if (!referencePickerGrid || !referencePickerTitle || !referencePickerBack) return;
    pickerMode = "chapters";
    referencePickerTitle.textContent = "Isaiah";
    referencePickerBack.hidden = true;
    referencePickerGrid.setAttribute("aria-label", "Choose Isaiah chapter");
    referencePickerGrid.innerHTML = Array.from({ length: 66 }, (_, index) => {
      const chapter = index + 1;
      return '<button type="button" data-picker-chapter="' + chapter + '" class="' + (chapter === pickerChapter ? "is-active" : "") + '">' + chapter + "</button>";
    }).join("");
  }

  function renderVersePicker() {
    if (!referencePickerGrid || !referencePickerTitle || !referencePickerBack) return;
    pickerMode = "verses";
    const maxVerse = chapterVerseCounts[pickerChapter] || 1;
    if (pickerVerse > maxVerse) pickerVerse = 1;
    referencePickerTitle.textContent = "Isaiah " + pickerChapter;
    referencePickerBack.hidden = false;
    referencePickerGrid.setAttribute("aria-label", "Choose Isaiah " + pickerChapter + " verse");
    referencePickerGrid.innerHTML = Array.from({ length: maxVerse }, (_, index) => {
      const verse = index + 1;
      return '<button type="button" data-picker-verse="' + verse + '" class="' + (verse === pickerVerse ? "is-active" : "") + '">' + verse + "</button>";
    }).join("");
  }

  const selectVerse = (verse, options = {}) => {
    const note = document.querySelector('[data-commentary-note="' + verse + '"]');
    if (!note) return;
    const verseButton = verseButtons.find((button) => button.dataset.verseSelect === String(verse));

    verseButtons.forEach((button) => {
      const active = button.dataset.verseSelect === String(verse);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    noteEntries.forEach((entry) => {
      const active = entry.dataset.commentaryNote === String(verse);
      entry.hidden = !active;
      entry.classList.toggle("is-active", active);
    });

    if (workspace) workspace.dataset.selectedVerse = String(verse);
    if (verseJumpInput && currentChapter) verseJumpInput.value = formatReference(currentChapter, verse);
    if (currentChapter) addRecentReference(currentChapter, Number(verse));
    if (options.updateHash) {
      const hash = "#v" + verse;
      if (window.location.hash !== hash) history.replaceState(null, "", hash);
    }
    if (options.scrollVerse && verseButton) {
      verseButton.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    if (options.scrollNotes && commentaryPanel) {
      commentaryPanel.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (options.revealNotes && commentaryPanel && window.matchMedia("(max-width: 1100px)").matches) {
      commentaryPanel.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  if (verseButtons.length && noteEntries.length) {
    verseButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectVerse(button.dataset.verseSelect, { scrollNotes: true, revealNotes: true, updateHash: true });
      });
    });

    const selectHashVerse = () => {
      const match = window.location.hash.match(/^#v(\\d+)$/);
      if (!match) return;
      const verse = match[1];
      selectVerse(verse, { scrollNotes: true, scrollVerse: verse !== "1" });
      if (verse === "1") {
        const scripturePanel = document.querySelector("[data-scripture-panel]");
        const resetReaderTop = () => {
          if (scripturePanel) scripturePanel.scrollTo({ top: 0, behavior: "auto" });
          window.scrollTo({ top: 0, behavior: "auto" });
        };
        window.requestAnimationFrame(resetReaderTop);
        window.addEventListener("load", resetReaderTop, { once: true });
        [80, 250, 600].forEach((delay) => window.setTimeout(resetReaderTop, delay));
      }
    };
    selectHashVerse();
    window.addEventListener("hashchange", selectHashVerse);
    if (currentChapter) addRecentReference(currentChapter, selectedVerseNumber());
  }

  const setVerseJumpStatus = (message = "") => {
    if (!verseJumpStatus || !verseJumpForm) return;
    verseJumpStatus.textContent = message;
    verseJumpForm.classList.toggle("is-invalid", Boolean(message));
  };

  const parseVerseReference = (rawValue) => {
    let value = rawValue.trim().toLowerCase();
    value = value
      .replace(/[–—]/g, "-")
      .replace(/^isaiah\\s+/, "")
      .replace(/^isa\\.?\\s+/, "")
      .replace(/^chapter\\s+/, "")
      .replace(/^ch\\.?\\s+/, "")
      .replace(/^verse\\s+/, "")
      .replace(/^v\\.?\\s*/, "");

    let chapter = currentChapter;
    let verse = null;
    const fullReference = value.match(/^(\\d{1,2})\\s*[:.]\\s*(\\d{1,3})$/) || value.match(/^(\\d{1,2})\\s+(\\d{1,3})$/);
    const verseOnly = value.match(/^(\\d{1,3})$/);

    if (fullReference) {
      chapter = Number(fullReference[1]);
      verse = Number(fullReference[2]);
    } else if (verseOnly) {
      verse = Number(verseOnly[1]);
    }

    if (!chapter || !verse || chapter < 1 || chapter > 66) return null;
    const maxVerse = chapterVerseCounts[chapter] || 0;
    if (verse < 1 || verse > maxVerse) return null;
    return { chapter, verse };
  };

  if (verseJumpForm && verseJumpInput) {
    verseJumpForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const target = parseVerseReference(verseJumpInput.value);
      if (!target) {
        setVerseJumpStatus("Use 5 or 53:5");
        return;
      }

      setVerseJumpStatus("");
      verseJumpInput.value = formatReference(target.chapter, target.verse);
      verseJumpInput.blur();
      addRecentReference(target.chapter, target.verse);
      closeReferencePicker();
      closeRecentDropdown();

      if (target.chapter === currentChapter) {
        selectVerse(String(target.verse), {
          scrollNotes: true,
          revealNotes: true,
          scrollVerse: true,
          updateHash: true,
        });
        return;
      }

      window.location.href = "/chapters/" + target.chapter + "/#v" + target.verse;
    });

    verseJumpInput.addEventListener("input", () => setVerseJumpStatus(""));
    verseJumpInput.addEventListener("focus", () => verseJumpInput.select());
    verseJumpInput.addEventListener("click", () => openReferencePicker());
    verseJumpInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        verseJumpForm.requestSubmit();
      }
    });
  }

  if (referencePickerToggle) {
    referencePickerToggle.addEventListener("click", () => {
      if (referencePicker?.hidden) openReferencePicker();
      else closeReferencePicker();
    });
  }

  if (recentToggle) {
    recentToggle.addEventListener("click", () => {
      if (recentDropdown?.hidden) openRecentDropdown();
      else closeRecentDropdown();
    });
  }

  if (recentList) {
    recentList.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = event.target.closest("[data-recent-chapter][data-recent-verse]");
      if (!button) return;
      goToRecentReference(Number(button.dataset.recentChapter), Number(button.dataset.recentVerse));
    });
  }

  if (referencePickerClose) referencePickerClose.addEventListener("click", closeReferencePicker);
  if (referencePickerBack) referencePickerBack.addEventListener("click", renderChapterPicker);
  if (referencePickerGo) referencePickerGo.addEventListener("click", goToPickerSelection);

  if (referencePickerGrid) {
    referencePickerGrid.addEventListener("click", (event) => {
      event.stopPropagation();
      const chapterButton = event.target.closest("[data-picker-chapter]");
      const verseButton = event.target.closest("[data-picker-verse]");

      if (chapterButton) {
        pickerChapter = Number(chapterButton.dataset.pickerChapter);
        pickerVerse = pickerChapter === currentChapter ? selectedVerseNumber() : 1;
        renderVersePicker();
        return;
      }

      if (verseButton) {
        pickerVerse = Number(verseButton.dataset.pickerVerse);
        goToPickerSelection();
      }
    });
  }

  if (referencePicker) {
    referencePicker.addEventListener("click", (event) => event.stopPropagation());
  }

  if (verseJumpForm) {
    verseJumpForm.addEventListener("click", (event) => event.stopPropagation());
  }

  if (recentJump) {
    recentJump.addEventListener("click", (event) => event.stopPropagation());
  }

  document.addEventListener("click", (event) => {
    if (referencePicker && !referencePicker.hidden && verseJumpForm && !verseJumpForm.contains(event.target)) {
      closeReferencePicker();
    }
    if (recentDropdown && !recentDropdown.hidden && recentJump && !recentJump.contains(event.target)) {
      closeRecentDropdown();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeReferencePicker();
      closeRecentDropdown();
    }
  });

  const input = document.querySelector("[data-search-input]");
  const button = document.querySelector("[data-search-button]");
  const results = document.querySelector("[data-search-results]");
  const meta = document.querySelector("[data-search-meta]");
  if (!input || !results || !meta) return;

  let dataPromise;
  const loadData = () => {
    if (!dataPromise) {
      dataPromise = fetch("/data/isaiah-kjv.json").then((response) => response.json());
    }
    return dataPromise;
  };

  const escapeRegExp = (value) => value.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
  const highlight = (text, query) => {
    const re = new RegExp("(" + escapeRegExp(query) + ")", "ig");
    return text.replace(re, "<mark>$1</mark>");
  };

  const runSearch = async () => {
    const query = input.value.trim();
    results.innerHTML = "";
    if (query.length < 2) {
      meta.textContent = "Enter at least two characters.";
      return;
    }
    const data = await loadData();
    const q = query.toLowerCase();
    const matches = [];
    data.chapters.forEach((chapter) => {
      chapter.verses.forEach((verse) => {
        if (verse.text.toLowerCase().includes(q)) {
          matches.push({ chapter: chapter.chapter, verse: verse.verse, text: verse.text });
        }
      });
    });
    meta.textContent = matches.length ? matches.length + " result" + (matches.length === 1 ? "" : "s") : "No results found.";
    results.innerHTML = matches
      .slice(0, 80)
      .map((match) => {
        return '<a href="/chapters/' + match.chapter + '/#v' + match.verse + '">' +
          "<strong>Isaiah " + match.chapter + ":" + match.verse + "</strong>" +
          "<span>" + highlight(match.text, query) + "</span>" +
          "</a>";
      })
      .join("");
  };

  if (button) button.addEventListener("click", runSearch);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });
})();
`;

const readme = `# Isaiah Study Workspace

Static deployment folder for the Isaiah study website.

## What is included

- KJV Scripture pages for all 66 chapters of Isaiah.
- Verse-by-verse commentary for all 66 chapters of Isaiah.
- A devotional Introduction page and Isaiah article series.
- Search over the local Isaiah KJV JSON file.
- Local assets only, including the Isaiah hero image and My Bible Explorer logo.

## Source text

The KJV text was generated from the local Project Gutenberg KJV data file:

\`${kjvPath}\`

## Deploy

This is a static site. Deploy the repository root to GitHub Pages, Vercel, Netlify, or any static host.
`;

const main = async () => {
  const kjv = await readJson(kjvPath);
  const commentary = await readCommentary();
  const crossReferences = await readCrossReferences();
  const articles = await readArticles();
  bibleVerseLookup = await readFullBibleVerseLookup();
  const isaiah = kjv.books.Isaiah;
  if (!isaiah || isaiah.chapters !== 66) {
    throw new Error("Unable to locate all 66 chapters of Isaiah in KJV data.");
  }

  const chapters = Object.values(isaiah.chaptersByNumber).sort((a, b) => a.chapter - b.chapter);
  const verseCount = chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
  validateChapterOutlines(chapters);

  await Promise.all([
    rm(join(root, "background"), { recursive: true, force: true }),
    rm(join(root, "articles"), { recursive: true, force: true }),
    rm(join(root, "charts"), { recursive: true, force: true }),
    rm(join(root, "chapters"), { recursive: true, force: true }),
    rm(join(root, "search"), { recursive: true, force: true }),
    rm(join(root, "data"), { recursive: true, force: true }),
  ]);

  await write(join(root, "site.css"), css.trimStart());
  await write(join(root, "site.js"), js.trimStart());
  await write(join(root, "README.md"), readme);
  await write(join(root, ".nojekyll"), "\n");
  await write(join(root, ".gitattributes"), "* text=auto\n*.png binary\n");
  await write(join(root, "CNAME"), "isaiah.mybibleexplorer.com\n");
  await write(join(root, "index.html"), homePage());
  await write(join(root, "background", "index.html"), backgroundPage());
  await write(join(root, "articles", "index.html"), articlesPage(articles));
  await write(join(root, "charts", "index.html"), chartsPage());
  await write(join(root, "search", "index.html"), searchPage());
  await write(join(root, "chapters", "index.html"), chaptersIndexPage());
  await write(join(root, "404.html"), notFoundPage());

  for (const article of articles) {
    await write(join(root, "articles", article.slug, "index.html"), articlePage(article, articles));
  }

  await write(
    join(root, "data", "isaiah-kjv.json"),
    JSON.stringify(
      {
        translation: "King James Version",
        source: "Project Gutenberg KJV eBook #30 via local normalized JSON",
        book: "Isaiah",
        chapters: chapters.map((chapter) => ({
          reference: chapter.reference,
          chapter: chapter.chapter,
          verses: chapter.verses,
        })),
      },
      null,
      2,
    ) + "\n",
  );

  for (const chapter of chapters) {
    await write(
      join(root, "chapters", String(chapter.chapter), "index.html"),
      chapterPage(chapter, commentary[String(chapter.chapter)] || {}, crossReferences),
    );
  }

  console.log(`Generated Isaiah site with ${chapters.length} chapters and ${verseCount} verses.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
