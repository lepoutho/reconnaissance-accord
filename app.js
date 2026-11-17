(function () {
  'use strict';

  var NB_FRETS = 12;
  // Cordes de la plus grave (index 0 = 6e corde) à la plus aiguë, en notes MIDI
  var OPEN_MIDI = [40, 45, 50, 55, 59, 64];
  var STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
  // Noms de fondamentale : bémols pour les accords majeurs, dièses pour certains accords mineurs
  var ROOTS_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  var ROOTS_MINOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  var FRET_DOTS = [3, 5, 7, 9, 12];
  var FR_LETTERS = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

  // Langue des notes : 'fr' (Do Ré Mi) ou 'en' (C D E)
  var lang = 'fr';
  try {
    if (window.localStorage.getItem('accords-lang') === 'en') { lang = 'en'; }
  } catch (err) { /* stockage indisponible : on garde le français */ }

  // Textes de l'interface
  var TEXTS = {
    fr: {
      title: "Reconnaissance d'accords",
      hint: "Glisse une puce (numéro de case, de 1 à 12) sur une corde. Sans puce, la corde est jouée à vide ; le bouton à gauche permet de la couper (×). Pour retirer une puce, glisse-la hors du manche.",
      play: '▶ Écouter',
      reset: 'Réinitialiser',
      tray: 'Puces à glisser (numéro de case)',
      remove: 'Retirer la puce',
      muted: 'Corde coupée (cliquer pour jouer à vide)',
      open: 'Corde à vide (cliquer pour couper)',
      omitted: ' (quinte omise)',
      also: 'Aussi possible : ',
      allMuted: 'Toutes les cordes sont coupées.',
      oneNote: 'Une seule note (pas un accord).',
      unknown: 'Accord non reconnu.',
      save: '★ Sauvegarder',
      favTitle: 'Mes positions',
      favEmpty: 'Aucune position sauvegardée. Place des puces puis clique sur « Sauvegarder ».',
      favDelete: 'Supprimer cette position',
      favLoad: 'Charger cette position',
      langFrTitle: 'Notes en français : Do Ré Mi',
      langEnTitle: 'Notes en anglais : C D E'
    },
    en: {
      title: 'Chord recognition',
      hint: 'Drag a chip (fret number, 1 to 12) onto a string. A string without a chip is played open; the button on the left mutes it (×). To remove a chip, drag it off the fretboard.',
      play: '▶ Play',
      reset: 'Reset',
      tray: 'Chips to drag (fret number)',
      remove: 'Remove the chip',
      muted: 'String muted (click to play open)',
      open: 'Open string (click to mute)',
      omitted: ' (fifth omitted)',
      also: 'Also possible: ',
      allMuted: 'All strings are muted.',
      oneNote: 'Only one note (not a chord).',
      unknown: 'Chord not recognized.',
      save: '★ Save',
      favTitle: 'My positions',
      favEmpty: 'No saved position yet. Place some chips, then click “Save”.',
      favDelete: 'Delete this position',
      favLoad: 'Load this position',
      langFrTitle: 'Note names in French: Do Ré Mi',
      langEnTitle: 'Note names in English: C D E'
    }
  };

  // Descriptions des types d'accords en anglais, par suffixe
  var LABELS_EN = {
    '': 'major', 'm': 'minor', '5': 'power chord (fifth)', '7': 'dominant seventh',
    'maj7': 'major seventh', 'm7': 'minor seventh', 'sus4': 'suspended fourth',
    'sus2': 'suspended second', '6': 'sixth', 'm6': 'minor sixth',
    'add9': 'major add ninth', 'madd9': 'minor add ninth', 'dim': 'diminished',
    'dim7': 'diminished seventh', 'm7b5': 'half-diminished', 'aug': 'augmented',
    'mMaj7': 'minor major seventh', '7sus4': 'seventh suspended fourth',
    '9': 'dominant ninth', 'maj9': 'major ninth', 'm9': 'minor ninth',
    'add11': 'major add eleventh', '7b9': 'seventh flat ninth', '11': 'dominant eleventh',
    'm11': 'minor eleventh', '13': 'dominant thirteenth'
  };

  function tr(key) { return TEXTS[lang][key]; }

  // Convertit un nom de note anglais (C, Db, F#, e...) dans la langue choisie
  function noteLabel(name) {
    if (lang === 'en') { return name; }
    var letter = name.charAt(0).toUpperCase();
    var label = FR_LETTERS[letter] + name.substring(1);
    return name.charAt(0) === 'e' ? label.charAt(0).toLowerCase() + label.substring(1) : label;
  }

  // Modèles d'accords : suffixe, nom long, intervalles
  var TEMPLATES = [
    { suffix: '',      label: 'majeur',                iv: [0, 4, 7] },
    { suffix: 'm',     label: 'mineur',                iv: [0, 3, 7] },
    { suffix: '5',     label: 'power chord (quinte)',  iv: [0, 7] },
    { suffix: '7',     label: 'septième de dominante', iv: [0, 4, 7, 10] },
    { suffix: 'maj7',  label: 'septième majeure',      iv: [0, 4, 7, 11] },
    { suffix: 'm7',    label: 'mineur septième',       iv: [0, 3, 7, 10] },
    { suffix: 'sus4',  label: 'quarte suspendue',      iv: [0, 5, 7] },
    { suffix: 'sus2',  label: 'seconde suspendue',     iv: [0, 2, 7] },
    { suffix: '6',     label: 'sixte',                 iv: [0, 4, 7, 9] },
    { suffix: 'm6',    label: 'mineur sixte',          iv: [0, 3, 7, 9] },
    { suffix: 'add9',  label: 'majeur ajout de neuvième', iv: [0, 2, 4, 7] },
    { suffix: 'madd9', label: 'mineur ajout de neuvième', iv: [0, 2, 3, 7] },
    { suffix: 'dim',   label: 'diminué',               iv: [0, 3, 6] },
    { suffix: 'dim7',  label: 'septième diminuée',     iv: [0, 3, 6, 9] },
    { suffix: 'm7b5',  label: 'demi-diminué',          iv: [0, 3, 6, 10] },
    { suffix: 'aug',   label: 'augmenté',              iv: [0, 4, 8] },
    { suffix: 'mMaj7', label: 'mineur septième majeure', iv: [0, 3, 7, 11] },
    { suffix: '7sus4', label: 'septième quarte suspendue', iv: [0, 5, 7, 10] },
    { suffix: '9',     label: 'neuvième de dominante', iv: [0, 2, 4, 7, 10] },
    { suffix: 'maj9',  label: 'neuvième majeure',      iv: [0, 2, 4, 7, 11] },
    { suffix: 'm9',    label: 'mineur neuvième',       iv: [0, 2, 3, 7, 10] },
    { suffix: 'add11', label: 'majeur ajout de onzième', iv: [0, 4, 5, 7] },
    { suffix: '7b9',   label: 'septième bémol neuvième', iv: [0, 1, 4, 7, 10] },
    { suffix: '11',    label: 'onzième de dominante',   iv: [0, 4, 5, 7, 10] },
    { suffix: '11',    label: 'onzième de dominante',   iv: [0, 2, 4, 5, 7, 10] },
    { suffix: 'm11',   label: 'mineur onzième',         iv: [0, 3, 5, 7, 10] },
    { suffix: 'm11',   label: 'mineur onzième',         iv: [0, 2, 3, 5, 7, 10] },
    { suffix: '13',    label: 'treizième de dominante', iv: [0, 4, 7, 9, 10] },
    { suffix: '13',    label: 'treizième de dominante', iv: [0, 2, 4, 7, 9, 10] }
  ];

  // État : fret = null (vide) ou 1..12 ; muted = corde coupée
  var state = { frets: [], muted: [] };
  var i;
  for (i = 0; i < 6; i++) { state.frets.push(null); state.muted.push(false); }

  var boardEl = document.getElementById('board');
  var trayEl = document.getElementById('tray');
  var nameEl = document.getElementById('chordName');
  var detailEl = document.getElementById('chordDetail');
  var laneEls = [];   // lane de chaque corde (index 0..5)
  var rowEls = [];
  var muteEls = [];
  var nameEls = [];

  // ---------- Construction de l'IHM ----------
  function buildBoard() {
    var numbers = document.createElement('div');
    numbers.className = 'numbers';
    var side = document.createElement('div');
    side.className = 'side';
    numbers.appendChild(side);
    var lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.borderLeft = '6px solid transparent';
    for (var f = 1; f <= NB_FRETS; f++) {
      var s = document.createElement('span');
      s.textContent = f;
      lane.appendChild(s);
    }
    numbers.appendChild(lane);
    boardEl.appendChild(numbers);

    // Corde aiguë en haut, grave en bas
    for (var idx = 5; idx >= 0; idx--) {
      boardEl.appendChild(buildStringRow(idx));
    }
  }

  function buildStringRow(idx) {
    var row = document.createElement('div');
    row.className = 'string-row';
    row.setAttribute('data-string', idx);

    var side = document.createElement('div');
    side.className = 'side';
    var name = document.createElement('span');
    name.className = 'string-name';
    nameEls[idx] = name;
    var mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'mute';
    mute.addEventListener('click', function () { toggleMute(idx); });
    side.appendChild(name);
    side.appendChild(mute);

    var lane = document.createElement('div');
    lane.className = 'lane';
    for (var f = 1; f <= NB_FRETS; f++) {
      var cell = document.createElement('div');
      cell.className = 'cell' + (FRET_DOTS.indexOf(f) >= 0 && idx === 2 ? ' dot' : '');
      lane.appendChild(cell);
    }
    var line = document.createElement('div');
    line.className = 'line';
    line.style.height = (1 + (5 - idx) * -0.0 + (idx === 0 ? 3.5 : idx === 1 ? 3 : idx === 2 ? 2.5 : idx === 3 ? 2 : idx === 4 ? 1.5 : 1)) + 'px';
    lane.appendChild(line);

    row.appendChild(side);
    row.appendChild(lane);
    laneEls[idx] = lane;
    rowEls[idx] = row;
    muteEls[idx] = mute;
    return row;
  }

  function buildTray() {
    for (var n = 1; n <= NB_FRETS; n++) {
      trayEl.appendChild(makeChip(n, -1));
    }
  }

  function makeChip(n, stringIdx) {
    var chip = document.createElement('div');
    chip.className = 'chip' + (stringIdx >= 0 ? ' placed' : '');
    chip.textContent = n;
    chip.setAttribute('data-fret', n);
    chip.setAttribute('data-from', stringIdx);
    if (stringIdx >= 0) {
      chip.style.left = ((n - 0.5) / NB_FRETS * 100) + '%';
    }
    chip.addEventListener('pointerdown', onChipDown);
    return chip;
  }

  // ---------- Glisser-déposer (souris et tactile) ----------
  var drag = null;
  var TOUCH_LIFT = 56;      // au doigt, la puce est affichée au-dessus du doigt pour rester visible
  var SNAP_MARGIN = 24;     // tolérance (px) autour d'une corde pour accepter le dépôt

  function blockTouchScroll(e) { e.preventDefault(); }

  function onChipDown(e) {
    e.preventDefault();
    var chip = e.currentTarget;
    var n = parseInt(chip.getAttribute('data-fret'), 10);
    var from = parseInt(chip.getAttribute('data-from'), 10);
    var ghost = document.createElement('div');
    ghost.className = 'chip ghost';
    ghost.textContent = n;
    document.body.appendChild(ghost);
    drag = { fret: n, ghost: ghost, over: -1, lift: e.pointerType === 'touch' ? TOUCH_LIFT : 0, x: e.clientX, y: e.clientY };
    moveGhost();
    if (from >= 0) {            // on saisit une puce déjà posée : on la retire
      state.frets[from] = null;
      render();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // Empêche la tablette de faire défiler la page pendant le glissement
    window.addEventListener('touchmove', blockTouchScroll, { passive: false });
  }

  function moveGhost() {
    drag.ghost.style.left = drag.x + 'px';
    drag.ghost.style.top = (drag.y - drag.lift) + 'px';
  }

  // Corde la plus proche du point (x, y), avec une marge de tolérance
  function stringAt(x, y) {
    var best = -1;
    var bestDist = SNAP_MARGIN + 1;
    for (var idx = 0; idx < 6; idx++) {
      var r = rowEls[idx].getBoundingClientRect();
      if (x < r.left || x > r.right) { continue; }
      var dist = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
      if (dist < bestDist) { best = idx; bestDist = dist; }
    }
    return best;
  }

  function dropTarget() {
    return stringAt(drag.x, drag.y - drag.lift);
  }

  function onMove(e) {
    if (!drag) { return; }
    drag.x = e.clientX;
    drag.y = e.clientY;
    moveGhost();
    var over = dropTarget();
    if (over !== drag.over) {
      if (drag.over >= 0) { rowEls[drag.over].classList.remove('over'); }
      if (over >= 0) { rowEls[over].classList.add('over'); }
      drag.over = over;
    }
  }

  function onUp() {
    if (!drag) { return; }
    var idx = dropTarget();      // dernière position connue (fiable aussi sur tablette)
    if (drag.over >= 0) { rowEls[drag.over].classList.remove('over'); }
    document.body.removeChild(drag.ghost);
    if (idx >= 0) {
      state.frets[idx] = drag.fret;
      state.muted[idx] = false;
    }
    drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('touchmove', blockTouchScroll);
    render();
  }

  function toggleMute(idx) {
    if (state.frets[idx] !== null) {
      state.frets[idx] = null;      // retire la puce : corde à vide
      state.muted[idx] = false;
    } else {
      state.muted[idx] = !state.muted[idx];
    }
    render();
  }

  // ---------- Théorie : notes et reconnaissance ----------
  function soundingNotes() {
    // retourne les notes jouées, de la corde grave à l'aiguë
    var notes = [];
    for (var s = 0; s < 6; s++) {
      if (state.muted[s]) { continue; }
      var fret = state.frets[s] === null ? 0 : state.frets[s];
      var midi = OPEN_MIDI[s] + fret;
      notes.push({ string: s, midi: midi, pc: midi % 12 });
    }
    return notes;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) { return false; }
    for (var k = 0; k < a.length; k++) { if (a[k] !== b[k]) { return false; } }
    return true;
  }

  function withoutFifth(iv) {
    var out = [];
    for (var k = 0; k < iv.length; k++) { if (iv[k] !== 7) { out.push(iv[k]); } }
    return out;
  }

  function isMinorTemplate(iv) {
    return iv.indexOf(3) >= 0 && iv.indexOf(4) < 0;
  }

  // Retourne la liste des accords possibles, du meilleur au moins bon
  function recognize(notes) {
    var pcs = [];
    var k;
    for (k = 0; k < notes.length; k++) {
      if (pcs.indexOf(notes[k].pc) < 0) { pcs.push(notes[k].pc); }
    }
    if (pcs.length < 2) { return []; }
    var bassPc = notes[0].pc;       // note la plus grave jouée
    var found = [];

    for (var r = 0; r < pcs.length; r++) {
      var root = pcs[r];
      var rel = [];
      for (k = 0; k < pcs.length; k++) { rel.push((pcs[k] - root + 12) % 12); }
      rel.sort(function (a, b) { return a - b; });

      for (var t = 0; t < TEMPLATES.length; t++) {
        var tpl = TEMPLATES[t];
        var score = -1;
        var omitted = false;
        if (sameSet(rel, tpl.iv)) {
          score = 100;
        } else if (tpl.iv.length >= 4 && tpl.iv.indexOf(7) >= 0 && sameSet(rel, withoutFifth(tpl.iv))) {
          score = 80;
          omitted = true;
        }
        if (score < 0) { continue; }
        score -= t * 0.1;
        if (root === bassPc) { score += 10; }
        var rootName = (isMinorTemplate(tpl.iv) ? ROOTS_MINOR : ROOTS_MAJOR)[root];
        found.push({ rootName: rootName, suffix: tpl.suffix, root: root, label: tpl.label, score: score, omitted: omitted });
      }
    }
    found.sort(function (a, b) { return b.score - a.score; });
    return found;
  }

  // ---------- Affichage ----------
  function render() {
    for (var s = 0; s < 6; s++) {
      var lane = laneEls[s];
      var old = lane.querySelectorAll('.chip');
      for (var k = 0; k < old.length; k++) { lane.removeChild(old[k]); }
      if (state.frets[s] !== null) {
        lane.appendChild(makeChip(state.frets[s], s));
      }
      var mb = muteEls[s];
      if (state.frets[s] !== null) {
        mb.textContent = '●'; mb.title = tr('remove'); mb.className = 'mute';
      } else if (state.muted[s]) {
        mb.textContent = '×'; mb.title = tr('muted'); mb.className = 'mute muted';
      } else {
        mb.textContent = '○'; mb.title = tr('open'); mb.className = 'mute';
      }
    }
    document.documentElement.lang = lang;
    document.title = tr('title');
    document.getElementById('pageTitle').textContent = tr('title');
    document.getElementById('hint').textContent = tr('hint');
    document.getElementById('trayTitle').textContent = tr('tray');
    document.getElementById('playBtn').textContent = tr('play');
    document.getElementById('saveBtn').textContent = tr('save');
    document.getElementById('favTitle').textContent = tr('favTitle');
    document.getElementById('saveBtn').addEventListener('click', addFavorite);
  document.getElementById('resetBtn').textContent = tr('reset');
    document.getElementById('langFr').title = tr('langFrTitle');
    document.getElementById('langEn').title = tr('langEnTitle');
    for (var n = 0; n < 6; n++) { nameEls[n].textContent = noteLabel(STRING_LABELS[n]); }
    document.getElementById('langFr').className = 'btn' + (lang === 'fr' ? ' active' : '');
    document.getElementById('langEn').className = 'btn' + (lang === 'en' ? ' active' : '');
    showResult();
    renderFavorites();
  }

  // ---------- Positions favorites (enregistrées dans le navigateur) ----------
  var favorites = [];
  try {
    var saved = JSON.parse(window.localStorage.getItem('accords-favoris'));
    if (Array.isArray(saved)) { favorites = saved; }
  } catch (err) { /* pas de sauvegarde lisible : liste vide */ }

  function storeFavorites() {
    try { window.localStorage.setItem('accords-favoris', JSON.stringify(favorites)); } catch (err) { /* ignoré */ }
  }

  // Résumé façon tablature, de la corde grave à l'aiguë : x 0 2 2 1 0
  function summary(frets, muted) {
    var parts = [];
    for (var s = 0; s < 6; s++) {
      parts.push(muted[s] ? 'x' : (frets[s] === null ? '0' : String(frets[s])));
    }
    return parts.join(' ');
  }

  function addFavorite() {
    var notes = soundingNotes();
    if (notes.length === 0) { return; }
    var sum = summary(state.frets, state.muted);
    for (var f = 0; f < favorites.length; f++) {
      if (summary(favorites[f].frets, favorites[f].muted) === sum) { return; }   // déjà sauvegardée
    }
    var chords = recognize(notes);
    favorites.push({
      frets: state.frets.slice(),
      muted: state.muted.slice(),
      rootName: chords.length > 0 ? chords[0].rootName : null,
      suffix: chords.length > 0 ? chords[0].suffix : ''
    });
    storeFavorites();
    renderFavorites();
  }

  function loadFavorite(i) {
    state.frets = favorites[i].frets.slice();
    state.muted = favorites[i].muted.slice();
    render();
  }

  function deleteFavorite(i) {
    favorites.splice(i, 1);
    storeFavorites();
    renderFavorites();
  }

  function renderFavorites() {
    var list = document.getElementById('favList');
    list.innerHTML = '';
    if (favorites.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'fav-empty';
      empty.textContent = tr('favEmpty');
      list.appendChild(empty);
      return;
    }
    for (var i = 0; i < favorites.length; i++) {
      list.appendChild(makeFavorite(i));
    }
  }

  function makeFavorite(i) {
    var fav = favorites[i];
    var item = document.createElement('div');
    item.className = 'fav-item';

    var load = document.createElement('button');
    load.type = 'button';
    load.className = 'fav-load';
    load.title = tr('favLoad');
    var name = document.createElement('strong');
    name.textContent = fav.rootName ? noteLabel(fav.rootName) + fav.suffix : '?';
    var detail = document.createElement('span');
    detail.textContent = summary(fav.frets, fav.muted);
    load.appendChild(name);
    load.appendChild(detail);
    load.addEventListener('click', function () { loadFavorite(i); });

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'fav-del';
    del.title = tr('favDelete');
    del.textContent = '×';
    del.addEventListener('click', function () { deleteFavorite(i); });

    item.appendChild(load);
    item.appendChild(del);
    return item;
  }

  function setLang(value) {
    lang = value;
    try { window.localStorage.setItem('accords-lang', value); } catch (err) { /* ignoré */ }
    render();
  }

  function chordName(chord) {
    return noteLabel(chord.rootName) + chord.suffix;
  }

  function showResult() {
    var notes = soundingNotes();
    var chords = recognize(notes);

    if (chords.length > 0) {
      var best = chords[0];
      nameEl.textContent = chordName(best);
      var html = (lang === 'en' ? LABELS_EN[best.suffix] : best.label) + (best.omitted ? tr('omitted') : '');
      var alts = [];
      for (var a = 1; a < chords.length && alts.length < 3; a++) { alts.push(chordName(chords[a])); }
      if (alts.length) { html += '<br>' + tr('also') + alts.join(', '); }
      detailEl.innerHTML = html;
      return;
    }

    var distinct = [];
    for (var d = 0; d < notes.length; d++) {
      if (distinct.indexOf(notes[d].pc) < 0) { distinct.push(notes[d].pc); }
    }
    if (distinct.length === 0) {
      nameEl.textContent = '—';
      detailEl.innerHTML = tr('allMuted');
    } else if (distinct.length === 1) {
      nameEl.textContent = '—';
      detailEl.innerHTML = tr('oneNote');
    } else {
      nameEl.textContent = '?';
      detailEl.innerHTML = tr('unknown');
    }
  }

  // ---------- Son ----------
  var audioCtx = null;
  function playChord() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { return; }
    if (!audioCtx) { audioCtx = new Ctx(); }
    var notes = soundingNotes();
    var now = audioCtx.currentTime;
    for (var k = 0; k < notes.length; k++) {
      var freq = 440 * Math.pow(2, (notes[k].midi - 69) / 12);
      var start = now + k * 0.06;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 1.9);
    }
  }

  document.getElementById('playBtn').addEventListener('click', playChord);
  document.getElementById('langFr').addEventListener('click', function () { setLang('fr'); });
  document.getElementById('langEn').addEventListener('click', function () { setLang('en'); });
  document.getElementById('resetBtn').addEventListener('click', function () {
    for (var s = 0; s < 6; s++) { state.frets[s] = null; state.muted[s] = false; }
    render();
  });

  buildBoard();
  buildTray();
  render();

  // Exposé pour les tests dans la console
  window.__chords = { state: state, render: render, recognize: recognize, soundingNotes: soundingNotes };
})();
