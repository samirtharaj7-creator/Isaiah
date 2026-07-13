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
  const scripturePanel = document.querySelector("[data-scripture-panel]");
  const pageFooter = document.querySelector(".mbe-global-footer");
  const desktopReaderQuery = window.matchMedia("(min-width: 1101px)");

  if (
    document.body.classList.contains("chapter-route") &&
    workspace &&
    scripturePanel &&
    commentaryPanel &&
    pageFooter
  ) {
    const readerPanels = [scripturePanel, commentaryPanel];
    const previousScrollTop = new WeakMap();
    let footerVisible = false;

    const panelIsAtBottom = (panel) =>
      panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 3;

    const measureFooter = () => {
      if (!desktopReaderQuery.matches) return;
      const footerHeight = Math.ceil(pageFooter.getBoundingClientRect().height);
      document.body.style.setProperty("--reader-footer-height", footerHeight + "px");
    };

    const keepPanelAtBottom = (panel) => {
      window.requestAnimationFrame(() => {
        panel.scrollTop = panel.scrollHeight;
        previousScrollTop.set(panel, panel.scrollTop);
      });
    };

    const setFooterVisible = (visible, sourcePanel = null) => {
      if (!desktopReaderQuery.matches) visible = false;
      if (visible === footerVisible) return;

      footerVisible = visible;
      document.body.classList.toggle("reader-footer-visible", visible);

      if (visible && sourcePanel) {
        measureFooter();
        keepPanelAtBottom(sourcePanel);
      }
    };

    const handlePanelScroll = (event) => {
      if (!desktopReaderQuery.matches) return;
      const panel = event.currentTarget;
      const currentScrollTop = panel.scrollTop;
      const lastScrollTop = previousScrollTop.get(panel) ?? currentScrollTop;
      const direction = currentScrollTop - lastScrollTop;
      previousScrollTop.set(panel, currentScrollTop);

      if (direction < -1) {
        setFooterVisible(false);
        return;
      }

      if (direction > 0 && panelIsAtBottom(panel)) {
        setFooterVisible(true, panel);
      }
    };

    const handlePanelWheel = (event) => {
      if (!desktopReaderQuery.matches) return;
      const panel = event.currentTarget;

      if (event.deltaY < 0) {
        setFooterVisible(false);
      } else if (event.deltaY > 0 && panelIsAtBottom(panel)) {
        setFooterVisible(true, panel);
      }
    };

    const syncReaderFooterMode = () => {
      setFooterVisible(false);
      readerPanels.forEach((panel) => previousScrollTop.set(panel, panel.scrollTop));

      if (desktopReaderQuery.matches) {
        document.body.classList.add("reader-footer-ready");
        measureFooter();
      } else {
        document.body.classList.remove("reader-footer-ready");
        document.body.style.removeProperty("--reader-footer-height");
      }
    };

    readerPanels.forEach((panel) => {
      previousScrollTop.set(panel, panel.scrollTop);
      panel.addEventListener("scroll", handlePanelScroll, { passive: true });
      panel.addEventListener("wheel", handlePanelWheel, { passive: true });
    });

    if ("ResizeObserver" in window) {
      const footerResizeObserver = new ResizeObserver(measureFooter);
      footerResizeObserver.observe(pageFooter);
    }

    desktopReaderQuery.addEventListener("change", syncReaderFooterMode);
    window.addEventListener("resize", measureFooter, { passive: true });
    syncReaderFooterMode();
  }
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
  const currentChapterMatch = window.location.pathname.match(/\/chapters\/(\d+)\//);
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
    const hashMatch = window.location.hash.match(/^#v(\d+)$/);
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
      const match = window.location.hash.match(/^#v(\d+)$/);
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
      .replace(/^isaiah\s+/, "")
      .replace(/^isa\.?\s+/, "")
      .replace(/^chapter\s+/, "")
      .replace(/^ch\.?\s+/, "")
      .replace(/^verse\s+/, "")
      .replace(/^v\.?\s*/, "");

    let chapter = currentChapter;
    let verse = null;
    const fullReference = value.match(/^(\d{1,2})\s*[:.]\s*(\d{1,3})$/) || value.match(/^(\d{1,2})\s+(\d{1,3})$/);
    const verseOnly = value.match(/^(\d{1,3})$/);

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

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
