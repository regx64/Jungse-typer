(() => {
  "use strict";

  // ---- Unicode Hangul Jamo tables (U+1100..U+11FF), modern subset ----
  const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]
    .map((ch, i) => ({ ch, code: 0x1100 + i }));
  const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"]
    .map((ch, i) => ({ ch, code: 0x1161 + i }));
  const JONG = [null, ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"]
    .map((ch, i) => (ch === null ? null : { ch, code: 0x11A7 + i }));
  // (0x11A7 is the Unicode "jongseong filler"; real finals start at 0x11A8 = index 1)

  const idxCho = (ch) => CHO.findIndex((c) => c.ch === ch);
  const idxJung = (ch) => JUNG.findIndex((c) => c.ch === ch);
  const idxJong = (ch) => JONG.findIndex((c) => c && c.ch === ch);

  // ---- Archaic (Middle Korean) jamo, verified Unicode code points ----
  const OLD = {
    araea:        { jungCode: 0x119E, ch: "ㆍ" },           // HANGUL JUNGSEONG ARAEA
    araeai:       { jungCode: 0x11A1, ch: "ㆎ" },           // HANGUL JUNGSEONG ARAEA-I
    pansios:      { choCode: 0x1140, jongCode: 0x11EB, ch: "ㅿ" }, // panSIOS (반치음)
    yesieung:     { choCode: 0x114C, jongCode: 0x11F0, ch: "ㆁ" }, // yesieung (옛이응)
    yeorinhieuh:  { choCode: 0x1159, jongCode: null,   ch: "ㆆ" }, // yeorinhieuh (여린히읗)
    kapyeounpieup:{ choCode: 0x112B, jongCode: null,   ch: "ㅸ" }, // kapyeounpieup (순경음비읍)
  };

  // ---- dubeolsik (두벌식) key layout ----
  const BASE_CONSONANT = {
    q: "ㅂ", w: "ㅈ", e: "ㄷ", r: "ㄱ", t: "ㅅ",
    a: "ㅁ", s: "ㄴ", d: "ㅇ", f: "ㄹ", g: "ㅎ",
    z: "ㅋ", x: "ㅌ", c: "ㅊ", v: "ㅍ",
  };
  const SHIFT_CONSONANT = { q: "ㅃ", w: "ㅉ", e: "ㄸ", r: "ㄲ", t: "ㅆ" };
  const BASE_VOWEL = {
    y: "ㅛ", u: "ㅕ", i: "ㅑ", o: "ㅐ", p: "ㅔ",
    h: "ㅗ", j: "ㅓ", k: "ㅏ", l: "ㅣ",
    b: "ㅠ", n: "ㅜ", m: "ㅡ",
  };
  const SHIFT_VOWEL = { o: "ㅒ", p: "ㅖ" };

  // key -> old jamo, active while the layer is on
  const OLD_KEY = {
    q: OLD.kapyeounpieup,
    t: OLD.pansios,
    d: OLD.yesieung,
    g: OLD.yeorinhieuh,
    k: OLD.araea,
  };

  const VOWEL_COMBINE = {
    "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ",
    "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ",
    "ㅡㅣ": "ㅢ",
  };

  const JONG_COMBINE = {
    "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ",
    "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ",
    "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ",
  };
  const JONG_SPLIT = {
    "ㄳ": ["ㄱ", "ㅅ"], "ㄵ": ["ㄴ", "ㅈ"], "ㄶ": ["ㄴ", "ㅎ"],
    "ㄺ": ["ㄹ", "ㄱ"], "ㄻ": ["ㄹ", "ㅁ"], "ㄼ": ["ㄹ", "ㅂ"], "ㄽ": ["ㄹ", "ㅅ"],
    "ㄾ": ["ㄹ", "ㅌ"], "ㄿ": ["ㄹ", "ㅍ"], "ㅀ": ["ㄹ", "ㅎ"], "ㅄ": ["ㅂ", "ㅅ"],
  };
  const NOT_A_FINAL = new Set(["ㄸ", "ㅃ", "ㅉ"]); // double consonants with no jongseong form

  // ---- composition state ----
  // cho/jung/jong hold either a modern jamo string (e.g. "ㄱ") or an OLD.* entry object.
  let cho = null, jung = null, jong = null;
  let committed = "";
  let oldLayerHeld = false;
  let oldLayerLocked = false;

  const isOld = (v) => typeof v === "object" && v !== null;

  function choCode(v) {
    if (v === null) return null;
    if (isOld(v)) return v.choCode;
    return CHO[idxCho(v)].code;
  }
  function jungCode(v) {
    if (v === null) return null;
    if (isOld(v)) return v.jungCode;
    return JUNG[idxJung(v)].code;
  }
  function jongCode(v) {
    if (v === null) return null;
    if (isOld(v)) return v.jongCode;
    return JONG[idxJong(v)].code;
  }

  function renderBlock() {
    if (cho === null && jung === null && jong === null) return "";
    const anyOld = isOld(cho) || isOld(jung) || isOld(jong);
    const cc = choCode(cho), jc = jungCode(jung), tc = jongCode(jong);

    if (!anyOld && cc !== null && jc !== null) {
      const base = 0xac00 + (idxCho(cho) * 21 + idxJung(jung)) * 28 + (jong === null ? 0 : idxJong(jong));
      return String.fromCodePoint(base);
    }
    // Not representable as a precomposed modern syllable (old jamo, or an
    // incomplete block): emit the raw conjoining jamo and let the font/OS
    // shape it, per the Hangul Jamo (U+1100-U+11FF) conjoining behavior.
    let out = "";
    if (cc !== null) out += String.fromCodePoint(cc);
    if (jc !== null) out += String.fromCodePoint(jc);
    if (tc !== null) out += String.fromCodePoint(tc);
    return out;
  }

  function commit() {
    committed += renderBlock();
    cho = jung = jong = null;
  }

  function startSyllable(consonant) {
    cho = consonant;
    jung = null;
    jong = null;
  }

  function pressConsonant(sym) {
    if (cho === null && jung === null && jong === null) {
      startSyllable(sym);
      return;
    }
    if (cho !== null && jung === null) {
      // lone leading consonant already sitting there; finish it and restart
      commit();
      startSyllable(sym);
      return;
    }
    if (jung !== null && jong === null) {
      if (NOT_A_FINAL.has(sym)) { commit(); startSyllable(sym); return; }
      // tentatively becomes the final consonant
      jong = sym;
      return;
    }
    if (jung !== null && jong !== null) {
      // try to merge into a compound final
      if (!isOld(jong)) {
        const combined = JONG_COMBINE[jong + sym];
        if (combined) {
          jong = combined;
          return;
        }
      }
      // can't merge: finish current syllable, start a new one with sym
      commit();
      startSyllable(sym);
      return;
    }
  }

  function pressVowel(sym) {
    if (cho !== null && jung === null && jong === null) {
      jung = sym;
      return;
    }
    if (jung !== null && jong === null) {
      if (jung === OLD.araea && sym === "ㅣ") { jung = OLD.araeai; return; }
      if (!isOld(jung)) {
        const combined = VOWEL_COMBINE[jung + sym];
        if (combined) { jung = combined; return; }
      }
      // second vowel that doesn't combine: commit the lone vowel(s) syllable and start a fresh vowel-only block
      commit();
      jung = sym;
      return;
    }
    if (jung !== null && jong !== null) {
      // the trailing consonant(s) actually belong to the *next* syllable
      let popCho;
      if (!isOld(jong) && JONG_SPLIT[jong]) {
        const [keep, pop] = JONG_SPLIT[jong];
        jong = keep;
        popCho = pop;
      } else {
        popCho = isOld(jong) ? null : jong;
        jong = null;
      }
      commit();
      if (popCho !== null) startSyllable(popCho);
      jung = sym;
      return;
    }
    // no cho, no jung: bare vowel
    if (cho === null && jung === null && jong === null) {
      jung = sym;
    }
  }

  function pressOld(entry) {
    if (entry.jungCode !== undefined && entry.choCode === undefined) {
      // araea: vowel-only old jamo
      if (jung !== null) { commit(); }
      jung = entry;
      return;
    }
    // choseong-capable old consonant (also usable as jongseong if it has one)
    if (cho === null && jung === null && jong === null) {
      startSyllable(entry);
      return;
    }
    if (cho !== null && jung === null) {
      commit();
      startSyllable(entry);
      return;
    }
    if (jung !== null && jong === null) {
      if (entry.jongCode !== null) { jong = entry; return; }
      commit();
      startSyllable(entry);
      return;
    }
    commit();
    startSyllable(entry);
  }

  function backspace() {
    if (jong !== null) {
      if (!isOld(jong) && JONG_SPLIT[jong]) jong = JONG_SPLIT[jong][0];
      else jong = null;
      return;
    }
    if (jung !== null) {
      if (jung === OLD.araeai) { jung = OLD.araea; return; }
      if (!isOld(jung)) {
        const entry = Object.entries(VOWEL_COMBINE).find(([, v]) => v === jung);
        if (entry) { jung = entry[0][0]; return; }
      }
      jung = null;
      return;
    }
    if (cho !== null) { cho = null; return; }
    committed = committed.slice(0, -1);
  }

  // ---- rendering ----
  const output = document.getElementById("output");
  function draw() {
    output.textContent = committed + renderBlock();
    placeCaretAtEnd(output);
  }
  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function handleKey(key, shift, useOld) {
    if (useOld && OLD_KEY[key.toLowerCase()]) {
      pressOld(OLD_KEY[key.toLowerCase()]);
      return true;
    }
    const lower = key.toLowerCase();
    if (shift && SHIFT_CONSONANT[lower]) { pressConsonant(SHIFT_CONSONANT[lower]); return true; }
    if (shift && SHIFT_VOWEL[lower]) { pressVowel(SHIFT_VOWEL[lower]); return true; }
    if (BASE_CONSONANT[lower]) { pressConsonant(BASE_CONSONANT[lower]); return true; }
    if (BASE_VOWEL[lower]) { pressVowel(BASE_VOWEL[lower]); return true; }
    return false;
  }

  function updateOldToggleLabel() {
    const btn = document.getElementById("oldLayerToggle");
    btn.setAttribute("aria-pressed", String(oldLayerLocked));
    btn.textContent = `옛글자 잠금: ${oldLayerLocked ? "켜짐" : "꺼짐"}`;
  }

  document.getElementById("oldLayerToggle").addEventListener("click", () => {
    oldLayerLocked = !oldLayerLocked;
    updateOldToggleLabel();
  });
  document.getElementById("clearBtn").addEventListener("click", () => {
    committed = ""; cho = jung = jong = null; draw();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote") { oldLayerHeld = true; e.preventDefault(); return; }
    if (e.key === "Backspace") { backspace(); draw(); e.preventDefault(); return; }
    if (e.key === "Enter") { commit(); committed += "\n"; draw(); e.preventDefault(); return; }
    if (e.key === " ") { commit(); committed += " "; draw(); e.preventDefault(); return; }
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      const useOld = oldLayerHeld || oldLayerLocked;
      const handled = handleKey(e.key, e.shiftKey, useOld);
      if (handled) { draw(); e.preventDefault(); }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Backquote") oldLayerHeld = false;
  });

  // ---- on-screen keyboard ----
  const ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ];
  const kb = document.getElementById("keyboard");
  ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    row.forEach((key) => {
      const btn = document.createElement("div");
      btn.className = "key";
      const base = BASE_CONSONANT[key] || BASE_VOWEL[key] || key;
      const shiftCh = SHIFT_CONSONANT[key] || SHIFT_VOWEL[key];
      btn.innerHTML = `<span>${base}</span>${OLD_KEY[key] ? `<span class="old-mark">${OLD_KEY[key].ch}</span>` : ""}`;
      btn.title = shiftCh ? `${base} / Shift: ${shiftCh}` : base;
      btn.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        const useOld = oldLayerLocked || ev.altKey;
        handleKey(key, ev.shiftKey, useOld);
        draw();
      });
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
  const spaceRow = document.createElement("div");
  spaceRow.className = "kb-row";
  const spaceKey = document.createElement("div");
  spaceKey.className = "key space";
  spaceKey.textContent = "spacebar";
  spaceKey.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    commit(); committed += " "; draw();
  });
  spaceRow.appendChild(spaceKey);
  kb.appendChild(spaceRow);

  updateOldToggleLabel();
  draw();
})();
