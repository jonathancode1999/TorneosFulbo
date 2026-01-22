/* Tournament app - vanilla JS
   - localStorage persistence
   - Liga / Copa / Copa con grupos
*/

(() => {
  const LS_LEAGUES = 'torneoapp.leagues.v1';
  const LS_TOURNAMENTS = 'torneoapp.tournaments.v1';
  const LS_STATS = 'torneoapp.stats.v1';

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString('es-AR'); } catch { return iso; }
  };
  const escapeHtml = (s) => String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');

  function shuffle(arr){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getLeagues(){
    const raw = localStorage.getItem(LS_LEAGUES);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* fallthrough */ }
    }
    // seed
    const seeded = clone(window.DEFAULT_LEAGUES || []);
    localStorage.setItem(LS_LEAGUES, JSON.stringify(seeded));
    return seeded;
  }

  function setLeagues(leagues){
    localStorage.setItem(LS_LEAGUES, JSON.stringify(leagues));
  }

  function getTournaments(){
    const raw = localStorage.getItem(LS_TOURNAMENTS);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function setTournaments(list){
    localStorage.setItem(LS_TOURNAMENTS, JSON.stringify(list));
  }

  function getStats(){
    const raw = localStorage.getItem(LS_STATS);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function setStats(stats){
    localStorage.setItem(LS_STATS, JSON.stringify(stats));
  }

  function asArrayMaybe(x){
    return Array.isArray(x) ? x : [];
  }

  // ---------- routing ----------
  const routes = ['home','create','tournaments','teams'];
  function show(route){
    routes.forEach(r => {
      const el = document.getElementById(`view-${r}`);
      if (el) el.classList.toggle('hidden', r !== route);
    });
    $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.route === route));
    if (route === 'create') renderCreate();
    if (route === 'tournaments') renderTournaments();
    if (route === 'teams') renderTeams();
  }

  // ---------- Create tournament state ----------
  const CT = {
    name: '',
    type: 'league',
    participants: [], // {id,name}
    leagueIds: new Set(), // default: all deselected

    // cup groups options
    groupAdvance: 2, // how many advance per group

    // committed
    assignments: null,      // participants with teams
    tournamentDraft: null,  // full tournament object ready to save

    // animation / interactive draw (create view)
    pendingAssignments: null,
    pendingDraft: null,
    drawPool: null,
    isAnimating: false
  };

  function resetCreate(){
    CT.name = '';
    CT.type = 'league';
    CT.participants = [];
    CT.leagueIds = new Set(); // all deselected by default

    CT.groupAdvance = 2;

    CT.assignments = null;
    CT.tournamentDraft = null;

    CT.pendingAssignments = null;
    CT.pendingDraft = null;
    CT.drawPool = null;
    CT.isAnimating = false;
  }

  function renderCreate(){
    // inputs
    const leagues = getLeagues();
    $('#ct-name').value = CT.name;
    $('#ct-type').value = CT.type;
    $('#ct-groups-advance').value = String(CT.groupAdvance);
    $('#ct-groups-advance-row').classList.toggle('hidden', CT.type !== 'cup_groups');

    // participants list
    const wrap = $('#ct-participants');
    wrap.innerHTML = '';
    if (CT.participants.length === 0) {
      wrap.innerHTML = `<div class="muted">Todavía no agregaste participantes.</div>`;
    } else {
      CT.participants.forEach(p => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div>
            <div class="pill">${escapeHtml(p.name)}</div>
            ${CT.assignments ? `<div class="muted">Equipo: <b>${escapeHtml(p.teamName||'')}</b> (${escapeHtml(p.leagueName||'')})</div>` : ''}
          </div>
          <button class="danger" data-del="${p.id}">Quitar</button>
        `;
        wrap.appendChild(div);
      });
      wrap.querySelectorAll('button[data-del]').forEach(btn => {
        btn.onclick = () => {
          CT.participants = CT.participants.filter(x => x.id !== btn.dataset.del);
          CT.assignments = null;
          CT.tournamentDraft = null;
          renderCreate();
        };
      });
    }

    // league checkboxes
    const lwrap = $('#ct-leagues');
    if (CT.leagueIds.size === 0) {
      // default: all deselected
    }
    lwrap.innerHTML = '';
    leagues.forEach(l => {
      const box = document.createElement('label');
      box.className = 'check';
      const checked = CT.leagueIds.has(l.id);
      box.innerHTML = `
        <input type="checkbox" ${checked ? 'checked' : ''} data-league="${l.id}">
        <span>${escapeHtml(l.name)} <span class="muted">(${l.teams.length} equipos)</span></span>
      `;
      lwrap.appendChild(box);
    });
    
    // toggle-all checkbox
    const tgl = $('#ct-leagues-toggleall');
    const total = leagues.length;
    const selectedCount = CT.leagueIds.size;
    tgl.indeterminate = selectedCount > 0 && selectedCount < total;
    tgl.checked = total > 0 && selectedCount === total;
    tgl.onchange = () => {
      if (tgl.checked) leagues.forEach(l => CT.leagueIds.add(l.id));
      else CT.leagueIds.clear();
      CT.assignments = null;
      CT.tournamentDraft = null;
      renderCreate();
    };

lwrap.querySelectorAll('input[data-league]').forEach(chk => {
      chk.onchange = () => {
        if (chk.checked) CT.leagueIds.add(chk.dataset.league);
        else CT.leagueIds.delete(chk.dataset.league);
        CT.assignments = null;
        CT.tournamentDraft = null;
        renderCreate();
      };
    });

    // output
    const out = $('#ct-output');
    out.classList.toggle('hidden', !(CT.assignments || CT.tournamentDraft || CT.pendingAssignments || CT.pendingDraft));
    if (CT.pendingDraft) {
      out.innerHTML = CT.pendingDraft.__html || '';
    } else if (CT.pendingAssignments) {
      out.innerHTML = CT.pendingAssignments.__html || '';
    } else if (CT.tournamentDraft) {
      out.innerHTML = renderDraftHtml(CT.tournamentDraft);
    } else if (CT.assignments) {
      out.innerHTML = renderAssignmentsHtml(CT.assignments);
    } else {
      out.innerHTML = '';
    }

    // buttons
    $('#ct-generate').disabled = !CT.assignments || CT.isAnimating;
    $('#ct-save').disabled = !CT.tournamentDraft || CT.isAnimating;
    $('#ct-start').disabled = !CT.tournamentDraft || CT.isAnimating;
    $('#ct-draw').disabled = CT.isAnimating;
    $('#ct-reset').disabled = CT.isAnimating;

    // attach handlers only once
    $('#ct-name').oninput = (e) => { CT.name = e.target.value; };
    $('#ct-type').onchange = (e) => {
      CT.type = e.target.value;
      CT.assignments = null;
      CT.tournamentDraft = null;
      renderCreate();
    };

    $('#ct-groups-advance').onchange = (e) => {
      CT.groupAdvance = Math.max(1, Math.min(4, parseInt(e.target.value || '2', 10) || 2));
      CT.tournamentDraft = null;
      renderCreate();
    };
    $('#ct-add').onclick = () => {
      const v = ($('#ct-participant').value || '').trim();
      if (!v) return;
      CT.participants.unshift({ id: uid(), name: v });
      $('#ct-participant').value = '';
      CT.assignments = null;
      CT.tournamentDraft = null;
      renderCreate();
    };
    $('#ct-participant').onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#ct-add').click(); }
    };

    $('#ct-draw').onclick = async () => {
      if (CT.isAnimating) return;
      try {
        const pool = buildTeamPool(Array.from(CT.leagueIds), leagues);
        const assignments = drawTeams(CT.participants, Array.from(CT.leagueIds), leagues);
        // animate before committing to CT.assignments so it doesn't show instantly
        await animateTeamDraw(assignments, pool);
      } catch(err){
        alert(err.message || String(err));
      }
    };

    $('#ct-generate').onclick = async () => {
      if (CT.isAnimating) return;
      try {
        const draft = buildTournamentDraft({
          name: CT.name.trim() || `Torneo ${new Date().toLocaleDateString('es-AR')}`,
          type: CT.type,
          participants: CT.participants,
        });
        // animate progressive fixture
        await animateFixtureBuild(draft);
      } catch(err){
        alert(err.message || String(err));
      }
    };

    $('#ct-save').onclick = () => {
      if (!CT.tournamentDraft) return;
      const list = getTournaments();
      list.unshift(CT.tournamentDraft);
      setTournaments(list);
      selectedTournamentId = CT.tournamentDraft.id;
      resetCreate();
      renderCreate();
      show('tournaments');
    };

    $('#ct-start').onclick = () => {
      // "Arrancar" = guardar y abrir directo en la vista de torneo para cargar resultados
      if (!CT.tournamentDraft) return;
      const list = getTournaments();
      list.unshift(CT.tournamentDraft);
      setTournaments(list);
      selectedTournamentId = CT.tournamentDraft.id;

      resetCreate();
      renderCreate();
      show('tournaments');
    };


    $('#ct-reset').onclick = () => {
      if (!confirm('¿Limpiar el formulario de creación?')) return;
      resetCreate();
      renderCreate();
    };
  }

  function drawTeams(participants, selectedLeagueIds, leagues){
    if (!participants || participants.length < 2) throw new Error('Agregá al menos 2 participantes.');
    const selected = leagues.filter(l => selectedLeagueIds.includes(l.id));
    if (selected.length === 0) throw new Error('Seleccioná al menos 1 liga para el sorteo.');

    const pool = [];
    selected.forEach(l => l.teams.forEach(t => pool.push({ leagueId: l.id, leagueName: l.name, teamName: t })));

    if (pool.length < participants.length) {
      throw new Error(`No hay suficientes equipos para asignar sin repetir. Necesitás ${participants.length} y hay ${pool.length}.`);
    }

    const poolShuffled = shuffle(pool);
    const picked = poolShuffled.slice(0, participants.length);

    return participants.map((p, i) => ({
      id: p.id,
      name: p.name,
      teamLeagueId: picked[i].leagueId,
      leagueName: picked[i].leagueName,
      teamName: picked[i].teamName
    }));
  }


  function buildTeamPool(selectedLeagueIds, leagues){
    const selected = leagues.filter(l => selectedLeagueIds.includes(l.id));
    if (selected.length === 0) throw new Error('Seleccioná al menos 1 liga para el sorteo.');
    const pool = [];
    selected.forEach(l => l.teams.forEach(t => pool.push({ leagueId: l.id, leagueName: l.name, teamName: t })));
    return pool;
  }

  function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

  async function animateTeamDraw(assignments, pool){
    CT.isAnimating = true;

    const out = $('#ct-output');
    out.classList.remove('hidden');

    out.innerHTML = `
      <div class="draw-shell">
        <h3>Sorteo de equipos</h3>
        <div class="muted">Se sortea 1 por 1. Tocá <span class="kbd">Siguiente jugador</span> para continuar.</div>

        <div class="draw-stage">
          <div class="draw-head">
            <div class="draw-ball">🎱</div>
            <div class="draw-now">
              <div class="who" id="draw-who">Listo…</div>
              <div class="what">Equipo sorteado:</div>
            </div>
          </div>
          <div class="draw-reel" id="draw-reel">—</div>

          <div class="row gap">
            <button class="primary" id="draw-next">Siguiente jugador</button>
            <button class="secondary" id="draw-skip">Mostrar todo</button>
            <button class="ghost" id="draw-close">Cerrar</button>
          </div>
        </div>

        <div class="draw-results" id="draw-results"></div>
      </div>
    `;

    CT.pendingAssignments = { __html: out.innerHTML };

    const elWho = $('#draw-who');
    const elReel = $('#draw-reel');
    const elRes = $('#draw-results');

    const poolNames = pool.map(x => `${x.teamName} (${x.leagueName})`);

    const spin = async (ms) => {
      const start = Date.now();
      while (Date.now() - start < ms){
        const i = Math.floor(Math.random() * poolNames.length);
        elReel.textContent = poolNames[i] || '—';
        await sleep(55);
      }
    };

    let i = 0;

    const addCard = (a, idxCard) => {
      const card = document.createElement('div');
      card.className = 'draw-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:900">${escapeHtml(a.name)}</div>
            <div class="muted">Equipo: <b>${escapeHtml(a.teamName)}</b> (${escapeHtml(a.leagueName)})</div>
          </div>
          <div class="pill">#${idxCard}</div>
        </div>
      `;
      elRes.appendChild(card);
    };

    const finalize = () => {
      CT.assignments = assignments;
      CT.participants = assignments.map(p => ({ ...p }));
      CT.tournamentDraft = null;
      CT.pendingAssignments = null;
      CT.isAnimating = false;
      renderCreate();
    };

    const revealOne = async () => {
      if (i >= assignments.length) return;
      const a = assignments[i];
      elWho.textContent = a.name;

      $('#draw-next').disabled = true;
      await spin(1400);
      elReel.textContent = `${a.teamName} (${a.leagueName})`;
      addCard(a, i+1);

      i++;
      $('#draw-next').disabled = false;
      if (i >= assignments.length){
        $('#draw-next').textContent = 'Finalizar sorteo';
      }
    };

    $('#draw-close').onclick = finalize;

    $('#draw-skip').onclick = () => {
      while (i < assignments.length){
        const a = assignments[i];
        elWho.textContent = a.name;
        elReel.textContent = `${a.teamName} (${a.leagueName})`;
        addCard(a, i+1);
        i++;
      }
      $('#draw-next').textContent = 'Finalizar sorteo';
    };

    $('#draw-next').onclick = async () => {
      if (i >= assignments.length){
        finalize();
        return;
      }
      await revealOne();
    };

    elWho.textContent = assignments[0]?.name || 'Listo…';
    elReel.textContent = '—';
  }

  async function animateFixtureBuild(draft){
    CT.isAnimating = true;

    const out = $('#ct-output');
    out.classList.remove('hidden');

    // build a progressive list of matches
    const allMatches = asArrayMaybe(draft.matches);
    if (!allMatches.length){
      out.innerHTML = `<div class="card soft"><h3>No se pudo generar el fixture</h3><div class="muted">No hay partidos generados para este formato/cantidad de participantes.</div></div>`;
      CT.pendingDraft = null;
      CT.isAnimating = false;
      return;
    }
    const title = (draft.type === 'league') ? 'Fixture de Liga' : (draft.type === 'cup_groups' ? 'Fixture (Grupos + Llaves)' : 'Fixture (Eliminación Directa)');

    out.innerHTML = `
      <div class="draw-shell">
        <h3>${title}</h3>
        <div class="muted">Generando… se va completando partido por partido. Acelerá con <span class="kbd">Espacio</span> o completá con <span class="kbd">Enter</span>.</div>

        <div class="draw-stage">
          <div class="draw-head">
            <div class="draw-ball">📅</div>
            <div class="draw-now">
              <div class="who" id="fix-who">Armando fixture…</div>
              <div class="what">Próximo partido:</div>
            </div>
          </div>
          <div class="draw-reel" id="fix-reel">—</div>
          <div class="row gap">
            <button class="secondary" id="fix-skip">Completar</button>
            <button class="ghost" id="fix-close">Cerrar</button>
          </div>
        </div>

        <div class="draw-results" id="fix-results"></div>
      </div>
    `;
    CT.pendingDraft = { __html: out.innerHTML };

    let fast = false;
    let showAll = false;

    const keyHandler = (e) => {
      if (e.key === ' ') { e.preventDefault(); fast = true; }
      if (e.key === 'Enter') { e.preventDefault(); showAll = true; }
    };
    window.addEventListener('keydown', keyHandler);

    const elWho = $('#fix-who');
    const elReel = $('#fix-reel');
    const elRes = $('#fix-results');

    const close = () => {
      window.removeEventListener('keydown', keyHandler);
      CT.pendingDraft = null;
      CT.isAnimating = false;
      renderCreate();
    };
    $('#fix-close').onclick = close;
    $('#fix-skip').onclick = () => { showAll = true; };

    for (let i=0;i<allMatches.length;i++){
      const m = allMatches[i];
      const label = `${m.homeName} vs ${m.awayName}`;
      elWho.textContent = `Partido ${i+1} de ${allMatches.length}`;
      elReel.textContent = label;

      const card = document.createElement('div');
      card.className = 'draw-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:900">${escapeHtml(m.homeName)} <span class="muted">vs</span> ${escapeHtml(m.awayName)}</div>
            <div class="muted">${escapeHtml(m.round || m.group || '')}</div>
          </div>
          <div class="pill">${escapeHtml(m.stage || 'Partido')}</div>
        </div>
      `;
      elRes.appendChild(card);

      await sleep(showAll || fast ? 30 : 180);
      if (showAll) fast = true;
    }

    // commit
    CT.tournamentDraft = draft;
    CT.pendingDraft = null;

    window.removeEventListener('keydown', keyHandler);
    CT.isAnimating = false;
    renderCreate();
  }

  function renderAssignmentsHtml(assignments){
    const rows = assignments.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td><b>${escapeHtml(p.teamName)}</b></td>
        <td class="muted">${escapeHtml(p.leagueName)}</td>
      </tr>
    `).join('');

    return `
      <h3>Asignación de equipos (sin repetir)</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Participante</th><th>Equipo</th><th>Liga</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="muted">Si no te gusta el sorteo, apretá “Sortear equipos” otra vez.</div>
    `;
  }

  // ---------- Fixture generation ----------
  function buildTournamentDraft({name, type, participants}){
    if (!participants || participants.length < 2) throw new Error('Mínimo 2 participantes.');
    if (!['league','cup','cup_groups'].includes(type)) throw new Error('Tipo inválido.');

    const t = {
      id: uid(),
      name,
      type,
      createdAt: new Date().toISOString(),
      status: 'active',
      participants: participants.map(p => ({
        id: p.id,
        name: p.name,
        teamName: p.teamName,
        leagueName: p.leagueName,
        teamLeagueId: p.teamLeagueId,
      })),
      meta: {},
      matches: [],
      championId: null,
      runnerUpId: null,
    };

    const ids = t.participants.map(p => p.id);
    if (type === 'league') {
      t.matches = generateRoundRobin(ids).map(m => ({ ...m, stage:'league' }));
      return t;
    }

    if (type === 'cup') {
      const bracket = generateKnockout(ids);
      t.meta.bracket = bracket;
      t.matches = flattenBracket(bracket);
      return t;
    }

    // cup with groups
    const groups = generateGroups(ids);
    t.meta.groups = groups;
    t.meta.groupAdvance = CT.groupAdvance;
    const groupMatches = [];
    Object.entries(groups).forEach(([g, pids]) => {
      generateRoundRobin(pids).forEach(m => groupMatches.push({ ...m, stage:'group', group:g }));
    });

    t.matches = groupMatches;
    // knockout will be generated when groups finished
    t.meta.bracket = null;
    return t;
  }

  function generateRoundRobin(participantIds){
    const ids = participantIds.slice();
    const isOdd = ids.length % 2 === 1;
    if (isOdd) ids.push(null); // bye

    const n = ids.length;
    const rounds = n - 1;
    const half = n / 2;

    let arr = ids.slice();
    const matches = [];

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < half; i++) {
        const home = arr[i];
        const away = arr[n - 1 - i];
        if (home === null || away === null) continue;
        matches.push({
          id: uid(),
          round: r + 1,
          homeId: home,
          awayId: away,
          homeGoals: null,
          awayGoals: null,
          played: false,
          winnerId: null,
          decidedBy: null
        });
      }
      // rotate (circle method): keep first fixed
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed, ...rest];
    }

    return matches;
  }

  function nextPowerOfTwo(n){
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  function generateKnockout(ids){
    const shuffled = shuffle(ids);
    const n = shuffled.length;
    const p2 = nextPowerOfTwo(n);
    const byes = p2 - n;

    // seed order: first participants in shuffled get byes
    const withByes = shuffled.slice();

    const rounds = [];
    let current = [];

    // first round: pair remaining after byes
    const byeWinners = withByes.slice(0, byes).map(id => ({
      id: uid(),
      homeId: id,
      awayId: null,
      homeGoals: 0,
      awayGoals: 0,
      played: true,
      winnerId: id,
      decidedBy: 'bye'
    }));

    const remaining = withByes.slice(byes);
    for (let i = 0; i < remaining.length; i += 2) {
      current.push({
        id: uid(),
        homeId: remaining[i],
        awayId: remaining[i+1] ?? null,
        homeGoals: null,
        awayGoals: null,
        played: false,
        winnerId: null,
        decidedBy: null
      });
    }

    // If we had odd number remaining, last becomes a bye too
    current = current.map(m => {
      if (m.awayId === null) {
        return { ...m, homeGoals: 0, awayGoals: 0, played: true, winnerId: m.homeId, decidedBy: 'bye' };
      }
      return m;
    });

    // Merge bye matches into round 1 for simplicity
    const round1 = byeWinners.concat(current);
    rounds.push({ name: 'Ronda 1', matches: round1 });

    // build subsequent empty rounds placeholders; will be populated as winners appear
    let mcount = round1.length;
    let r = 2;
    while (mcount > 1) {
      mcount = Math.ceil(mcount / 2);
      rounds.push({ name: `Ronda ${r}`, matches: Array.from({length: mcount}, () => ({
        id: uid(),
        homeId: null,
        awayId: null,
        homeGoals: null,
        awayGoals: null,
        played: false,
        winnerId: null,
        decidedBy: null
      }))});
      r++;
    }

    return { rounds };
  }

  function flattenBracket(bracket){
    const matches = [];
    bracket.rounds.forEach((round, idx) => {
      round.matches.forEach(m => matches.push({
        ...m,
        stage: 'knockout',
        roundName: round.name,
        roundIndex: idx
      }));
    });
    return matches;
  }

  function generateGroups(ids){
    const shuffled = shuffle(ids);
    const n = shuffled.length;
    const groupSize = n >= 16 ? 4 : (n >= 9 ? 3 : 3);
    const gcount = Math.max(2, Math.round(n / groupSize));

    const groups = {};
    for (let i = 0; i < gcount; i++) groups[String.fromCharCode(65+i)] = [];

    // distribute
    let gi = 0;
    shuffled.forEach(id => {
      const key = Object.keys(groups)[gi % gcount];
      groups[key].push(id);
      gi++;
    });

    // ensure minimum 3 per group if possible, otherwise allow 2
    return groups;
  }

  function renderDraftHtml(t){
    const list = t.participants.map(p => `<li>${escapeHtml(p.name)} — <b>${escapeHtml(p.teamName||'')}</b> <span class="muted">(${escapeHtml(p.leagueName||'')})</span></li>`).join('');

    let extra = '';
    if (t.type === 'league') {
      extra = `<div class="muted">Se generó un fixture todos contra todos (una vuelta).</div>`;
    } else if (t.type === 'cup') {
      extra = `<div class="muted">Copa eliminación directa. Si no es potencia de 2, hay byes.</div>`;
    } else {
      const g = t.meta.groups || {};
      extra = `<div class="muted">Grupos: ${Object.keys(g).map(k => `Grupo ${k} (${g[k].length})`).join(', ')}</div>`;
      extra += `<div class="muted">Eliminatorias se generan cuando terminan los grupos (clasifican los 2 primeros de cada grupo).</div>`;
    }

    return `
      <h3>Fixture generado</h3>
      <div class="grid-2">
        <div>
          <div class="muted">Torneo: <b>${escapeHtml(t.name)}</b></div>
          <div class="muted">Tipo: <b>${typeLabel(t.type)}</b></div>
          <div class="muted">Partidos creados: <b>${t.matches.length}</b></div>
          ${extra}
        </div>
        <div>
          <div class="muted"><b>Participantes</b></div>
          <ul class="compact">${list}</ul>
        </div>
      </div>
    `;
  }

  function typeLabel(type){
    if (type === 'league') return 'Liga';
    if (type === 'cup') return 'Copa (sin grupos)';
    return 'Copa (con grupos)';
  }

  // ---------- Tournament view + logic ----------
  let selectedTournamentId = null;

  function renderTournaments(){
    // tab controls
    $$('.tabbtn').forEach(btn => {
      btn.onclick = () => {
        $$('.tabbtn').forEach(b => b.classList.toggle('active', b === btn));
        $$('.tab').forEach(t => t.classList.add('hidden'));
        document.getElementById(btn.dataset.tab).classList.remove('hidden');
      };
    });

    // list
    const tournaments = getTournaments();
    $('#t-list').innerHTML = tournaments.length ? renderTListTable(tournaments) : `<div class="card">No hay torneos todavía. Creá uno en “Crear torneo”.</div>`;
    $('#t-details').classList.add('hidden');

    // row clicks
    $$('#t-list button[data-open]').forEach(btn => {
      btn.onclick = () => {
        selectedTournamentId = btn.dataset.open;
        const t = getTournaments().find(x => x.id === selectedTournamentId);
        if (!t) return;
        $('#t-details').classList.remove('hidden');
        $('#t-details').innerHTML = renderTournamentDetails(t);
        wireTournamentDetails(t);
        window.scrollTo({ top: $('#t-details').offsetTop - 80, behavior: 'smooth' });
      };
    });
    // auto-open when coming from "Arrancar / Guardar" (selectedTournamentId already set)
    if (selectedTournamentId){
      const tAuto = getTournaments().find(x => x.id === selectedTournamentId);
      if (tAuto){
        $('#t-details').classList.remove('hidden');
        $('#t-details').innerHTML = renderTournamentDetails(tAuto);
        wireTournamentDetails(tAuto);
      }
    }



    // backup export/import
    $('#btn-export').onclick = () => {
      const payload = {
        leagues: getLeagues(),
        tournaments: getTournaments(),
        stats: getStats(),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `torneos_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    $('#btn-import').onclick = () => $('#importFile').click();
    $('#importFile').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const txt = await file.text();
        const data = JSON.parse(txt);
        if (data.leagues) setLeagues(data.leagues);
        if (data.tournaments) setTournaments(data.tournaments);
        if (data.stats) setStats(data.stats);
        alert('Importación OK.');
        renderTournaments();
      } catch (err) {
        alert('No pude importar ese JSON.');
      } finally {
        e.target.value = '';
      }
    };

    $('#btn-reset-all').onclick = () => {
      if (!confirm('Esto borra TODOS los torneos y el ranking guardado en este navegador. ¿Seguro?')) return;
      localStorage.removeItem(LS_TOURNAMENTS);
      localStorage.removeItem(LS_STATS);
      renderTournaments();
      renderRanking();
    };

    renderRanking();
  }

  function renderTListTable(tournaments){
    const rows = tournaments.map(t => `
      <tr>
        <td><b>${escapeHtml(t.name)}</b><div class="muted">${escapeHtml(typeLabel(t.type))}</div></td>
        <td>${fmtDate(t.createdAt)}</td>
        <td><span class="badge ${t.status === 'completed' ? 'b-ok' : 'b-warn'}">${t.status === 'completed' ? 'Finalizado' : 'En juego'}</span></td>
        <td>${t.championId ? escapeHtml(getParticipantName(t, t.championId)) : '<span class="muted">-</span>'}</td>
        <td style="text-align:right"><button class="secondary" data-open="${t.id}">Abrir</button></td>
      </tr>
    `).join('');

    return `
      <table>
        <thead>
          <tr><th>Torneo</th><th>Creado</th><th>Estado</th><th>Campeón</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function getParticipantName(t, pid){
    return (t.participants || []).find(p => p.id === pid)?.name || 'Desconocido';
  }

  function renderTournamentDetails(t){
    const pcount = (t.participants||[]).length;
    const played = (t.matches||[]).filter(m => m.played).length;
    const total = (t.matches||[]).length;

    const header = `
      <div class="row between">
        <div>
          <h3 style="margin:0">${escapeHtml(t.name)}</h3>
          <div class="muted">${escapeHtml(typeLabel(t.type))} · ${pcount} participantes · ${played}/${total} partidos jugados</div>
        </div>
        <div class="row gap">
          <button id="td-finalize" class="success" ${t.status==='completed' ? 'disabled' : ''}>Finalizar torneo</button>
          <button id="td-delete" class="danger">Eliminar</button>
        </div>
      </div>
    `;

    const participantsTable = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Participante</th><th>Equipo</th><th>Liga</th></tr></thead>
          <tbody>
            ${(t.participants||[]).map(p => `
              <tr>
                <td>${escapeHtml(p.name)}</td>
                <td><b>${escapeHtml(p.teamName||'')}</b></td>
                <td class="muted">${escapeHtml(p.leagueName||'')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const body = `
      <div class="grid-2">
        <div class="card soft">
          <h4>Participantes</h4>
          ${participantsTable}
        </div>
        <div class="card soft">
          <h4>Estado / Campeón</h4>
          ${renderChampionBox(t)}
        </div>
      </div>

      <div class="card soft">
        <h4>Partidos y resultados</h4>
        ${renderMatchesEditor(t)}
      </div>

      <div class="grid-2">
        <div class="card soft">
          <h4>Tablas / Llaves</h4>
          ${renderStandingsOrBracket(t)}
        </div>
        <div class="card soft">
          <h4>Historial (por participante)</h4>
          <div class="muted">Elegí un participante para ver sus partidos en este torneo.</div>
          <div class="row gap">
            <select id="td-person-select">
              <option value="">Seleccionar…</option>
              ${(t.participants||[]).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div id="td-person-matches" class="mt"></div>
        </div>
      </div>
    `;

    return header + body;
  }

  function renderChampionBox(t){
    if (t.status === 'completed' && t.championId) {
      return `
        <div class="pill big">🏆 Campeón: ${escapeHtml(getParticipantName(t, t.championId))}</div>
        ${t.runnerUpId ? `<div class="muted">Subcampeón: <b>${escapeHtml(getParticipantName(t, t.runnerUpId))}</b></div>` : ''}
      `;
    }

    const maybe = computeCurrentLeader(t);
    return `
      <div class="muted">El torneo todavía no está finalizado.</div>
      ${maybe ? `<div class="muted">Probable líder actual: <b>${escapeHtml(maybe)}</b></div>` : ''}
      <div class="muted">Cuando todos los partidos estén cargados, apretá <b>Finalizar torneo</b>.</div>
    `;
  }

  function computeCurrentLeader(t){
    try {
      if (t.type === 'league') {
        const table = computeLeagueTable(t);
        return table[0]?.name || null;
      }
      if (t.type === 'cup') {
        const last = getCupWinnerIfReady(t);
        return last?.name || null;
      }
      if (t.type === 'cup_groups') {
        const last = getCupWinnerIfReady(t);
        return last?.name || null;
      }
    } catch {}
    return null;
  }

  function renderMatchesEditor(t){
    // group by stage/round
    const matches = asArrayMaybe(t.matches);
    if (!matches.length) return '<div class="muted">Sin partidos.</div>';

    const blocks = [];

    if (t.type === 'league') {
      const byRound = {};
      matches.forEach(m => { (byRound[m.round] ||= []).push(m); });
      Object.keys(byRound).sort((a,b)=>Number(a)-Number(b)).forEach(r => {
        blocks.push(renderMatchBlock(`Fecha ${r}`, byRound[r], t));
      });
      return blocks.join('');
    }

    // cups
    const groupMatches = matches.filter(m => m.stage === 'group');
    const koMatches = matches.filter(m => m.stage === 'knockout');

    if (groupMatches.length) {
      const byGroup = {};
      groupMatches.forEach(m => { (byGroup[m.group] ||= []).push(m); });
      Object.keys(byGroup).sort().forEach(g => {
        const byRound = {};
        byGroup[g].forEach(m => { (byRound[m.round] ||= []).push(m); });
        Object.keys(byRound).sort((a,b)=>Number(a)-Number(b)).forEach(r => {
          blocks.push(renderMatchBlock(`Grupo ${g} · Fecha ${r}`, byRound[r], t));
        });
      });
    }

    if (koMatches.length) {
      const byRound = {};
      koMatches.forEach(m => { (byRound[m.roundIndex] ||= []).push(m); });
      Object.keys(byRound).sort((a,b)=>Number(a)-Number(b)).forEach(ri => {
        const roundName = byRound[ri][0]?.roundName || `Ronda ${Number(ri)+1}`;
        blocks.push(renderMatchBlock(roundName, byRound[ri], t, { knockout:true }));
      });
    } else if (t.type === 'cup_groups') {
      blocks.push(`<div class="muted">Las eliminatorias aparecerán cuando terminen los grupos.</div>`);
    }

    return blocks.join('');
  }

  function renderMatchBlock(title, matches, t, opts={}){
    const rows = matches.map(m => {
      const home = getParticipantName(t, m.homeId);
      const away = m.awayId ? getParticipantName(t, m.awayId) : 'BYE';
      const hg = m.homeGoals ?? '';
      const ag = m.awayGoals ?? '';
      const disabled = (t.status === 'completed') ? 'disabled' : '';

      const tie = (m.played && m.awayId && m.homeGoals === m.awayGoals);
      const winnerPicker = (opts.knockout && m.awayId) ? `
        <select class="m-winner" data-mid="${m.id}" ${disabled}>
          <option value="">Ganador (si empate)</option>
          <option value="${m.homeId}" ${m.winnerId===m.homeId ? 'selected' : ''}>${escapeHtml(home)}</option>
          <option value="${m.awayId}" ${m.winnerId===m.awayId ? 'selected' : ''}>${escapeHtml(away)}</option>
        </select>
      ` : '';

      return `
        <tr>
          <td class="muted">${escapeHtml(home)}</td>
          <td style="width:90px"><input class="score" data-mid="${m.id}" data-side="home" value="${hg}" inputmode="numeric" ${disabled}></td>
          <td style="text-align:center" class="muted">vs</td>
          <td style="width:90px"><input class="score" data-mid="${m.id}" data-side="away" value="${ag}" inputmode="numeric" ${disabled}></td>
          <td class="muted">${escapeHtml(away)}</td>
          <td style="width:220px">${winnerPicker}${tie ? '<span class="badge b-warn">Empate</span>' : (m.played ? '<span class="badge b-ok">OK</span>' : '<span class="badge">Pendiente</span>')}</td>
        </tr>
      `;
    }).join('');

    return `
      <details open class="matchblock">
        <summary>${escapeHtml(title)} <span class="muted">(${matches.filter(m=>m.played).length}/${matches.length})</span></summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th colspan="1">Local</th><th colspan="1"></th><th></th><th></th><th colspan="1">Visitante</th><th>Estado</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </details>
    `;
  }

  function renderStandingsOrBracket(t){
    if (t.type === 'league') {
      const table = computeLeagueTable(t);
      return renderLeagueTableHtml(table);
    }

    if (t.type === 'cup_groups') {
      const groups = t.meta?.groups || {};
      let html = '';
      Object.keys(groups).sort().forEach(g => {
        const table = computeGroupTable(t, g);
        html += `<h5 style="margin:12px 0 6px">Grupo ${escapeHtml(g)}</h5>`;
        html += renderLeagueTableHtml(table, { compact:true });
      });

      // If knockout exists, render bracket summary
      if (t.meta?.bracket) {
        html += `<h5 style="margin:12px 0 6px">Eliminatorias</h5>`;
        html += renderBracketSummary(t);
      }
      return html;
    }

    // cup
    return renderBracketSummary(t);
  }

  function renderLeagueTableHtml(table, opts={}){
    const rows = table.map((r, idx) => `
      <tr>
        <td>${idx+1}</td>
        <td><b>${escapeHtml(r.name)}</b> <span class="muted">(${escapeHtml(r.teamName||'')})</span></td>
        <td>${r.pj}</td>
        <td>${r.pg}</td>
        <td>${r.pe}</td>
        <td>${r.pp}</td>
        <td>${r.gf}</td>
        <td>${r.gc}</td>
        <td>${r.dg}</td>
        <td><b>${r.pts}</b></td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap">
        <table class="${opts.compact ? 'compact' : ''}">
          <thead>
            <tr>
              <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderBracketSummary(t){
    const bracket = t.meta?.bracket;
    if (!bracket) {
      // cup_groups might not have it yet
      return `<div class="muted">Sin eliminatorias todavía.</div>`;
    }

    // build from matches
    const ko = (t.matches||[]).filter(m => m.stage === 'knockout');
    const byRound = {};
    ko.forEach(m => { (byRound[m.roundIndex] ||= []).push(m); });

    const blocks = Object.keys(byRound).sort((a,b)=>Number(a)-Number(b)).map(ri => {
      const list = byRound[ri].map(m => {
        const home = m.homeId ? getParticipantName(t, m.homeId) : 'TBD';
        const away = m.awayId ? getParticipantName(t, m.awayId) : 'TBD';
        const s = m.played ? `${m.homeGoals}-${m.awayGoals}` : '—';
        const w = m.winnerId ? ` · <span class="muted">gana</span> <b>${escapeHtml(getParticipantName(t, m.winnerId))}</b>` : '';
        return `<li>${escapeHtml(home)} <span class="muted">vs</span> ${escapeHtml(away)} <span class="muted">(${s})</span>${w}</li>`;
      }).join('');

      const name = byRound[ri][0]?.roundName || `Ronda ${Number(ri)+1}`;
      return `<div class="card soft" style="margin:10px 0">
        <b>${escapeHtml(name)}</b>
        <ul class="compact">${list}</ul>
      </div>`;
    }).join('');

    return blocks;
  }

  function computeLeagueTable(t){
    const participants = t.participants || [];
    const rows = {};
    participants.forEach(p => {
      rows[p.id] = { id:p.id, name:p.name, teamName:p.teamName, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 };
    });

    const matches = (t.matches||[]).filter(m => m.stage === 'league' && m.played);
    matches.forEach(m => {
      const home = rows[m.homeId];
      const away = rows[m.awayId];
      if (!home || !away) return;
      home.pj++; away.pj++;
      home.gf += m.homeGoals; home.gc += m.awayGoals;
      away.gf += m.awayGoals; away.gc += m.homeGoals;
      if (m.homeGoals > m.awayGoals) { home.pg++; away.pp++; home.pts += 3; }
      else if (m.homeGoals < m.awayGoals) { away.pg++; home.pp++; away.pts += 3; }
      else { home.pe++; away.pe++; home.pts += 1; away.pts += 1; }
    });

    Object.values(rows).forEach(r => r.dg = r.gf - r.gc);

    return Object.values(rows).sort((a,b) =>
      b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name)
    );
  }

  function computeGroupTable(t, groupKey){
    const ids = (t.meta?.groups?.[groupKey] || []);
    const pmap = Object.fromEntries((t.participants||[]).map(p => [p.id,p]));

    const tableRows = {};
    ids.forEach(id => {
      const p = pmap[id];
      if (!p) return;
      tableRows[id] = { id, name:p.name, teamName:p.teamName, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 };
    });

    const matches = (t.matches||[]).filter(m => m.stage==='group' && m.group===groupKey && m.played);
    matches.forEach(m => {
      const home = tableRows[m.homeId];
      const away = tableRows[m.awayId];
      if (!home || !away) return;
      home.pj++; away.pj++;
      home.gf += m.homeGoals; home.gc += m.awayGoals;
      away.gf += m.awayGoals; away.gc += m.homeGoals;
      if (m.homeGoals > m.awayGoals) { home.pg++; away.pp++; home.pts += 3; }
      else if (m.homeGoals < m.awayGoals) { away.pg++; home.pp++; away.pts += 3; }
      else { home.pe++; away.pe++; home.pts += 1; away.pts += 1; }
    });
    Object.values(tableRows).forEach(r => r.dg = r.gf - r.gc);

    return Object.values(tableRows).sort((a,b) =>
      b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name)
    );
  }

  function ensureKnockoutFromGroups(t){
    if (t.type !== 'cup_groups') return t;
    if (t.meta?.bracket) return t;

    // check if all group matches played
    const groupMatches = (t.matches||[]).filter(m => m.stage==='group');
    if (groupMatches.some(m => !m.played)) return t;

    // qualify top N from each group (configurable)
    const groups = t.meta?.groups || {};
    const takeN = Math.max(1, Math.min(4, (t.meta?.groupAdvance ?? 2)));
    const qualifiers = [];
    Object.keys(groups).sort().forEach(g => {
      const table = computeGroupTable(t, g);
      qualifiers.push(...table.slice(0, takeN).map(r => r.id));
    });

    const bracket = generateKnockout(qualifiers);
    t.meta.bracket = bracket;
    const koMatches = flattenBracket(bracket);
    t.matches = (t.matches||[]).concat(koMatches);

    return t;
  }

  function propagateBracketWinners(t){
    // Ensure bracket matches next rounds filled based on winners
    if (!t.meta?.bracket) return t;

    const rounds = t.meta.bracket.rounds;
    if (!rounds?.length) return t;

    // build lookup for knockout matches by id in t.matches
    const koMatches = (t.matches||[]).filter(m => m.stage==='knockout');
    const byId = Object.fromEntries(koMatches.map(m => [m.id, m]));

    // sync t.meta.bracket round matches from t.matches (ids match)
    for (let r = 0; r < rounds.length; r++) {
      rounds[r].matches = rounds[r].matches.map(m => byId[m.id] ? {
        id: m.id,
        homeId: byId[m.id].homeId,
        awayId: byId[m.id].awayId,
        homeGoals: byId[m.id].homeGoals,
        awayGoals: byId[m.id].awayGoals,
        played: byId[m.id].played,
        winnerId: byId[m.id].winnerId,
        decidedBy: byId[m.id].decidedBy
      } : m);
    }

    // gather winners per round and fill next
    for (let r = 0; r < rounds.length - 1; r++) {
      const winners = rounds[r].matches.map(m => m.winnerId).filter(Boolean);
      const next = rounds[r+1].matches;
      for (let i = 0; i < next.length; i++) {
        const a = winners[i*2] ?? null;
        const b = winners[i*2+1] ?? null;
        const matchId = next[i].id;
        const tm = koMatches.find(mm => mm.id === matchId);
        if (!tm) continue;

        // Only set if not already set or if changed
        const changed = tm.homeId !== a || tm.awayId !== b;
        if (changed) {
          tm.homeId = a;
          tm.awayId = b;
          tm.homeGoals = null;
          tm.awayGoals = null;
          tm.played = false;
          tm.winnerId = (b === null && a !== null) ? a : null;
          tm.decidedBy = (b === null && a !== null) ? 'bye' : null;
          if (tm.decidedBy === 'bye') { tm.homeGoals = 0; tm.awayGoals = 0; tm.played = true; }
        }
      }
    }

    // write back
    t.meta.bracket.rounds = rounds;
    // ensure winnerId for bye matches
    return t;
  }

  function getCupWinnerIfReady(t){
    const ko = (t.matches||[]).filter(m => m.stage==='knockout');
    if (!ko.length) return null;

    const lastRoundIdx = Math.max(...ko.map(m => m.roundIndex));
    const finalMatch = ko.find(m => m.roundIndex === lastRoundIdx);
    if (!finalMatch?.played || !finalMatch.winnerId) return null;

    const champ = (t.participants||[]).find(p => p.id === finalMatch.winnerId);
    return champ || null;
  }

  function computeCupRunnerUp(t){
    const ko = (t.matches||[]).filter(m => m.stage==='knockout');
    if (!ko.length) return null;
    const lastRoundIdx = Math.max(...ko.map(m => m.roundIndex));
    const finalMatch = ko.find(m => m.roundIndex === lastRoundIdx);
    if (!finalMatch?.played || !finalMatch.winnerId) return null;
    const other = finalMatch.homeId === finalMatch.winnerId ? finalMatch.awayId : finalMatch.homeId;
    if (!other) return null;
    return (t.participants||[]).find(p => p.id === other) || null;
  }

  function wireTournamentDetails(t){
    // delete
    $('#td-delete').onclick = () => {
      if (!confirm('¿Eliminar este torneo? No se puede deshacer.')) return;
      const list = getTournaments().filter(x => x.id !== t.id);
      setTournaments(list);
      selectedTournamentId = null;
      renderTournaments();
    };

    // finalize
    $('#td-finalize').onclick = () => {
      const latest = getTournaments().find(x => x.id === t.id);
      if (!latest) return;

      const updated = finalizeTournament(latest);
      if (!updated) return;

      const list = getTournaments().map(x => x.id === t.id ? updated : x);
      setTournaments(list);
      renderTournaments();

      // reopen
      const reopened = getTournaments().find(x => x.id === t.id);
      if (reopened) {
        $('#t-details').classList.remove('hidden');
        $('#t-details').innerHTML = renderTournamentDetails(reopened);
        wireTournamentDetails(reopened);
      }
    };

    // match inputs
    $$('#t-details input.score').forEach(inp => {
      inp.oninput = () => {
        const mid = inp.dataset.mid;
        const side = inp.dataset.side;
        const v = inp.value.trim();
        if (v === '') return; // allow blank
        if (!/^\d+$/.test(v)) { inp.value = v.replace(/\D/g,''); }
      };
      inp.onchange = () => {
        saveMatchScore(t.id, inp.dataset.mid, inp.dataset.side, inp.value);
      };
    });

    $$('#t-details select.m-winner').forEach(sel => {
      sel.onchange = () => {
        saveMatchWinnerOverride(t.id, sel.dataset.mid, sel.value);
      };
    });

    // person match history
    $('#td-person-select').onchange = (e) => {
      const pid = e.target.value;
      if (!pid) { $('#td-person-matches').innerHTML = ''; return; }
      const latest = getTournaments().find(x => x.id === t.id);
      $('#td-person-matches').innerHTML = renderPersonMatches(latest, pid);
    };
  }

  function saveMatchScore(tournamentId, matchId, side, value){
    const list = getTournaments();
    const t = list.find(x => x.id === tournamentId);
    if (!t || t.status === 'completed') return;

    let changed = false;
    t.matches = (t.matches||[]).map(m => {
      if (m.id !== matchId) return m;
      const nm = { ...m };
      const num = value === '' ? null : Number(value);
      if (side === 'home') nm.homeGoals = num;
      if (side === 'away') nm.awayGoals = num;

      // mark played only if both filled and away exists
      if (nm.awayId && nm.homeGoals !== null && nm.awayGoals !== null) {
        nm.played = true;
        // compute winner
        if (nm.homeGoals > nm.awayGoals) { nm.winnerId = nm.homeId; nm.decidedBy = 'normal'; }
        else if (nm.homeGoals < nm.awayGoals) { nm.winnerId = nm.awayId; nm.decidedBy = 'normal'; }
        else {
          // draw
          nm.winnerId = (nm.stage === 'knockout') ? null : null;
          nm.decidedBy = (nm.stage === 'knockout') ? 'draw' : 'draw';
        }
      } else {
        // incomplete
        nm.played = (nm.decidedBy === 'bye') ? true : false;
        if (nm.decidedBy !== 'bye') { nm.winnerId = null; nm.decidedBy = null; }
      }
      changed = true;
      return nm;
    });

    // cup_groups: if group stage finished, generate bracket
    const ensured = ensureKnockoutFromGroups(t);
    const propagated = propagateBracketWinners(ensured);

    if (changed) {
      setTournaments(list.map(x => x.id === t.id ? propagated : x));
      // re-render details
      const reopened = getTournaments().find(x => x.id === t.id);
      $('#t-details').innerHTML = renderTournamentDetails(reopened);
      wireTournamentDetails(reopened);
    }
  }

  function saveMatchWinnerOverride(tournamentId, matchId, winnerId){
    const list = getTournaments();
    const t = list.find(x => x.id === tournamentId);
    if (!t || t.status === 'completed') return;

    t.matches = (t.matches||[]).map(m => {
      if (m.id !== matchId) return m;
      const nm = { ...m };
      if (!nm.awayId) return nm;
      if (nm.homeGoals === null || nm.awayGoals === null) return nm;
      if (nm.homeGoals !== nm.awayGoals) return nm; // not tied

      if (winnerId === nm.homeId || winnerId === nm.awayId) {
        nm.winnerId = winnerId;
        nm.decidedBy = 'pens';
      } else {
        nm.winnerId = null;
        nm.decidedBy = 'draw';
      }
      return nm;
    });

    const ensured = ensureKnockoutFromGroups(t);
    const propagated = propagateBracketWinners(ensured);

    setTournaments(list.map(x => x.id === t.id ? propagated : x));
    const reopened = getTournaments().find(x => x.id === t.id);
    $('#t-details').innerHTML = renderTournamentDetails(reopened);
    wireTournamentDetails(reopened);
  }

  function renderPersonMatches(t, pid){
    const p = (t.participants||[]).find(x => x.id === pid);
    if (!p) return '';

    const matches = (t.matches||[]).filter(m => m.homeId === pid || m.awayId === pid);
    const items = matches.map(m => {
      const home = getParticipantName(t, m.homeId);
      const away = m.awayId ? getParticipantName(t, m.awayId) : 'BYE';
      const s = (m.homeGoals===null || m.awayGoals===null) ? '—' : `${m.homeGoals}-${m.awayGoals}`;
      const st = m.stage === 'league' ? `Liga (Fecha ${m.round})` : (m.stage==='group' ? `Grupo ${m.group} (Fecha ${m.round})` : `${m.roundName}`);
      return `<li><span class="muted">${escapeHtml(st)}:</span> ${escapeHtml(home)} vs ${escapeHtml(away)} <span class="muted">(${s})</span></li>`;
    }).join('');

    return `
      <div class="pill">${escapeHtml(p.name)} — <b>${escapeHtml(p.teamName||'')}</b></div>
      <ul class="compact">${items || '<li class="muted">Sin partidos.</li>'}</ul>
    `;
  }

  function finalizeTournament(t){
    if (t.status === 'completed') return null;

    // If cup_groups, ensure bracket exists if groups played
    t = ensureKnockoutFromGroups(t);
    t = propagateBracketWinners(t);

    // Check all matches played
    const missing = (t.matches||[]).filter(m => !m.played);
    if (missing.length) {
      alert(`Todavía faltan ${missing.length} partidos por cargar.`);
      return null;
    }

    let champion = null;
    let runner = null;

    if (t.type === 'league') {
      const table = computeLeagueTable(t);
      champion = table[0]?.id || null;
      runner = table[1]?.id || null;
    } else {
      const champP = getCupWinnerIfReady(t);
      if (!champP) {
        alert('No se detecta campeón todavía (revisá empates en la final).');
        return null;
      }
      champion = champP.id;
      runner = computeCupRunnerUp(t)?.id || null;
    }

    if (!champion) {
      alert('No pude calcular el campeón.');
      return null;
    }

    t.status = 'completed';
    t.championId = champion;
    t.runnerUpId = runner;

    // update stats
    const stats = getStats();
    const champName = getParticipantName(t, champion);
    const champ = stats[champName] || {
      name: champName,
      titlesTotal: 0,
      titlesLeague: 0,
      titlesCup: 0,
      history: []
    };

    champ.titlesTotal += 1;
    if (t.type === 'league') champ.titlesLeague += 1;
    else champ.titlesCup += 1;

    champ.history.unshift({
      tournamentId: t.id,
      tournamentName: t.name,
      type: t.type,
      date: t.createdAt,
      participants: t.participants,
      matches: t.matches,
      championId: t.championId,
      runnerUpId: t.runnerUpId,
    });

    stats[champName] = champ;
    setStats(stats);

    renderRanking();
    return t;
  }

  // ---------- Ranking ----------
  function renderRanking(){
    const stats = getStats();
    const arr = Object.values(stats);
    arr.sort((a,b)=> (b.titlesTotal - a.titlesTotal) || (b.titlesCup - a.titlesCup) || (b.titlesLeague - a.titlesLeague) || a.name.localeCompare(b.name));

    if (!arr.length) {
      $('#rank').innerHTML = `<h3 style="margin:0 0 8px">Ranking de campeones</h3><div class="muted">Todavía no hay torneos finalizados.</div>`;
      $('#person-details').classList.add('hidden');
      return;
    }

    const rows = arr.map((p,i)=>`
      <tr>
        <td>${i+1}</td>
        <td><b>${escapeHtml(p.name)}</b></td>
        <td><b>${p.titlesTotal}</b></td>
        <td>${p.titlesLeague}</td>
        <td>${p.titlesCup}</td>
        <td style="text-align:right"><button class="secondary" data-person="${escapeHtml(p.name)}">Ver historial</button></td>
      </tr>
    `).join('');

    $('#rank').innerHTML = `
      <h3 style="margin:0 0 8px">Ranking de campeones</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Persona</th><th>Campeonatos</th><th>Ligas</th><th>Copas</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    $$('#rank button[data-person]').forEach(btn => {
      btn.onclick = () => {
        renderPersonHistory(btn.dataset.person);
      };
    });
  }

  function renderPersonHistory(name){
    const stats = getStats();
    const p = stats[name];
    if (!p) return;

    const hist = (p.history||[]);
    const items = hist.map(h => {
      const champName = getParticipantName(h, h.championId);
      const runnerName = h.runnerUpId ? getParticipantName(h, h.runnerUpId) : '-';
      return `
        <div class="card soft" style="margin:10px 0">
          <div class="row between">
            <div>
              <b>${escapeHtml(h.tournamentName)}</b>
              <div class="muted">${escapeHtml(typeLabel(h.type))} · ${fmtDate(h.date)}</div>
            </div>
            <div class="pill">🏆 ${escapeHtml(champName)}</div>
          </div>
          <div class="muted">Final: <b>${escapeHtml(champName)}</b> vs <b>${escapeHtml(runnerName)}</b></div>
          <details>
            <summary>Ver partidos (${(h.matches||[]).length})</summary>
            <ul class="compact">
              ${(h.matches||[]).map(m => {
                const home = getParticipantName(h, m.homeId);
                const away = m.awayId ? getParticipantName(h, m.awayId) : 'BYE';
                const s = (m.homeGoals===null || m.awayGoals===null) ? '—' : `${m.homeGoals}-${m.awayGoals}`;
                const st = m.stage === 'league' ? `Liga (Fecha ${m.round})` : (m.stage==='group' ? `Grupo ${m.group} (Fecha ${m.round})` : `${m.roundName}`);
                return `<li><span class="muted">${escapeHtml(st)}:</span> ${escapeHtml(home)} vs ${escapeHtml(away)} <span class="muted">(${s})</span></li>`;
              }).join('')}
            </ul>
          </details>
        </div>
      `;
    }).join('');

    $('#person-details').classList.remove('hidden');
    $('#person-details').innerHTML = `
      <div class="row between">
        <h3 style="margin:0">Historial de ${escapeHtml(p.name)}</h3>
        <button id="close-person" class="ghost">Cerrar</button>
      </div>
      <div class="muted">Títulos: <b>${p.titlesTotal}</b> (Ligas: ${p.titlesLeague} · Copas: ${p.titlesCup})</div>
      ${items || '<div class="muted">Sin historial.</div>'}
    `;

    $('#close-person').onclick = () => $('#person-details').classList.add('hidden');
  }

  // ---------- Teams & leagues ----------
  let selectedLeagueId = null;

  function renderTeams(){
    const leagues = getLeagues();
    const list = $('#league-list');
    list.innerHTML = '';

    leagues.forEach(l => {
      const div = document.createElement('div');
      div.className = 'list-item clickable';
      div.dataset.lid = l.id;
      div.innerHTML = `
        <div>
          <div><b>${escapeHtml(l.name)}</b></div>
          <div class="muted">${escapeHtml(l.region)} · ${l.teams.length} equipos</div>
        </div>
        <button class="secondary" data-open-league="${l.id}">Abrir</button>
      `;
      list.appendChild(div);
    });

    list.querySelectorAll('button[data-open-league]').forEach(btn => {
      btn.onclick = () => {
        selectedLeagueId = btn.dataset.openLeague;
        renderLeagueTeams();
      };
    });

    $('#teams-reset').onclick = () => {
      if (!confirm('¿Restaurar el listado precargado de equipos? Se pierden tus cambios.')) return;
      localStorage.removeItem(LS_LEAGUES);
      selectedLeagueId = null;
      renderTeams();
    };

    renderLeagueTeams();
  }

  function renderLeagueTeams(){
    const leagues = getLeagues();
    const league = leagues.find(l => l.id === selectedLeagueId);
    const title = $('#league-title');
    const wrap = $('#league-teams');

    if (!league) {
      title.textContent = 'Seleccioná una liga';
      wrap.innerHTML = '<div class="muted">Elegí una liga en la columna izquierda.</div>';
      return;
    }

    title.textContent = league.name;

    const items = league.teams.map((t,i) => `
      <div class="list-item">
        <div class="pill">${escapeHtml(t)}</div>
        <button class="danger" data-del-team="${i}">Quitar</button>
      </div>
    `).join('');

    wrap.innerHTML = `
      <div class="row gap">
        <input id="team-add" type="text" placeholder="Agregar equipo…" />
        <button id="team-add-btn" class="secondary">Agregar</button>
      </div>
      <div class="mt list">${items || '<div class="muted">Sin equipos.</div>'}</div>
    `;

    // wire
    $('#team-add-btn').onclick = () => {
      const v = ($('#team-add').value||'').trim();
      if (!v) return;
      const leagues2 = getLeagues();
      const l2 = leagues2.find(x => x.id === selectedLeagueId);
      if (!l2) return;
      if (l2.teams.some(x => x.toLowerCase() === v.toLowerCase())) {
        alert('Ese equipo ya existe en la liga.');
        return;
      }
      l2.teams.push(v);
      setLeagues(leagues2);
      renderLeagueTeams();
    };
    $('#team-add').onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#team-add-btn').click(); }
    };

    $$('#league-teams button[data-del-team]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.delTeam);
        const leagues2 = getLeagues();
        const l2 = leagues2.find(x => x.id === selectedLeagueId);
        if (!l2) return;
        l2.teams.splice(idx,1);
        setLeagues(leagues2);
        renderLeagueTeams();
      };
    });
  }

  // ---------- boot ----------
  function boot(){
    // nav
    $$('.navbtn').forEach(btn => btn.onclick = () => show(btn.dataset.route));
    $('#goCreate').onclick = () => show('create');
    $('#goTournaments').onclick = () => show('tournaments');

    // initial
    show('home');
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
