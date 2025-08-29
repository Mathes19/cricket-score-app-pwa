// ======= State =======
    const initialState = () => ({
      teams: {
        A: { name: 'Team A', players: {}, bowlers: {}, fielders: {} },
        B: { name: 'Team B', players: {}, bowlers: {}, fielders: {} },
      },
      toss: { winner: 'A', decision: 'bat' },
      innings: 1, // 1 or 2
      target: null, // set after 1st innings
      chasingDone: false,
      current: {
        battingKey: 'A',
        bowlingKey: 'B',
        striker: null,
        nonStriker: null,
        bowler: null,
        runs: 0,
        wickets: 0,
        balls: 0, // legal balls only
        fours: 0,
        sixes: 0,
        commentary: [],
        battingList: [], // order of batsmen
        bowlingList: [], // list of bowlers used
      },
      inningsData: { 1: null, 2: null },
      matchOver: false,
    });

    let S = initialState();

    // ======= Helpers =======
    const el = (id) => document.getElementById(id);
    const oversText = (balls) => `${Math.floor(balls/6)}.${balls%6}`;
    const sr = (r,b) => b? ((r/b)*100).toFixed(1): '—';
    const econ = (r,b) => b? ( (r/(b/6)).toFixed(1) ) : '—';

    function ensureBatter(teamKey, name){
      const team = S.teams[teamKey];
      if(!team.players[name]){
        team.players[name] = { runs:0, balls:0, fours:0, sixes:0, out:false, how:'' };
        if(!S.current.battingList.includes(name)) S.current.battingList.push(name);
      }
      return team.players[name];
    }
    function ensureBowler(teamKey, name){
      const team = S.teams[teamKey];
      if(!team.bowlers[name]){
        team.bowlers[name] = { balls:0, runs:0, wickets:0, maidens:0, overRuns:0 };
        if(!S.current.bowlingList.includes(name)) S.current.bowlingList.push(name);
      }
      return team.bowlers[name];
    }
    function addFielder(teamKey, name){
      const team = S.teams[teamKey];
      if(!team.fielders[name]) team.fielders[name] = { dismissals:0 };
      team.fielders[name].dismissals++;
    }

    function pushCom(text){
      const tag = `${S.innings===1? '1st' : '2nd'} Inn ${oversText(S.current.balls)}`;
      S.current.commentary.unshift(`${tag}: ${text}`);
      renderCommentary();
    }

    // ======= Setup / Start =======
    function determineBatting(){
      const tossBatFirst = (S.toss.decision==='bat') ? S.toss.winner : (S.toss.winner==='A' ? 'B':'A');
      S.current.battingKey = tossBatFirst;
      S.current.bowlingKey = tossBatFirst==='A' ? 'B' : 'A';
    }

    function startMatch(){
      // Team names
      S.teams.A.name = el('teamAName').value?.trim() || 'Team A';
      S.teams.B.name = el('teamBName').value?.trim() || 'Team B';
      S.toss.winner = el('tossWinner').value;
      S.toss.decision = el('tossDecision').value;
      determineBatting();

      // Opening players
      const st = el('strikerName').value.trim() || 'Batter 1';
      const nst = el('nonStrikerName').value.trim() || 'Batter 2';
      const bw = el('bowlerName').value.trim() || 'Bowler 1';

      S.current.striker = st; ensureBatter(S.current.battingKey, st);
      S.current.nonStriker = nst; ensureBatter(S.current.battingKey, nst);
      S.current.bowler = bw; ensureBowler(S.current.bowlingKey, bw);

      pushCom(`${S.teams[S.current.battingKey].name} won the toss and will ${S.toss.decision}. ${S.teams[S.current.battingKey].name} to bat first.`);
      updateLiveMeta();
      switchTab('live');
      renderAll();
    }

    // ======= Ball Events =======
    function addRun(n){
      if(S.matchOver) return;
      const bat = ensureBatter(S.current.battingKey, S.current.striker);
      const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);

      S.current.runs += n;
      S.current.balls += 1;
      bat.runs += n; bat.balls += 1;
      bowl.runs += n; bowl.balls += 1; bowl.overRuns += n;
      if(n===4){ S.current.fours++; bat.fours++; }
      if(n===6){ S.current.sixes++; bat.sixes++; }

      pushCom(`${S.current.striker} scores ${n}.`);
      history.push({ 
    type:"run", 
   runs:n, 
   striker:S.current.striker, 
   bowler:S.current.bowler, 
    swap:(n % 2 === 1) 
});

      // strike rotation
      if(n%2===1) [S.current.striker, S.current.nonStriker] = [S.current.nonStriker, S.current.striker];

      // End over auto
      if(S.current.balls % 6 === 0){
        endOver(true);
      }
      renderAll();
      checkChase();
    }

    function wicketEvent(){
      if(S.matchOver) return;
      const how = prompt('Wicket! Dismissal type (bowled/lbw/caught/runout/stumped/hitwicket):','caught') || 'wicket';
      let fielder = '';
      if(['caught','runout','stumped'].includes(how)){
        fielder = prompt('Fielder name (leave blank if not applicable):','') || '';
        if(fielder) addFielder(S.current.bowlingKey, fielder);
      }
      const nextName = prompt('Next batsman name:','New Batter') || 'New Batter';

      const bat = ensureBatter(S.current.battingKey, S.current.striker);
      const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);

      S.current.wickets += 1;
      S.current.balls += 1;
      bat.balls += 1; bat.out = true; bat.how = how + (fielder? (' by '+fielder): '');
      bowl.balls += 1; bowl.wickets += 1; // count wicket to current ball

      pushCom(`WICKET! ${S.current.striker} ${bat.how || ''}`);
      history.push({ 
      type:"wicket", 
      striker:S.current.striker, 
      bowler:S.current.bowler 
      });

      // New batter comes to crease, striker replaced
      S.current.striker = nextName; ensureBatter(S.current.battingKey, nextName);

      if(S.current.balls % 6 === 0){ endOver(true); }
      renderAll();
      checkChase();
    }
    
    function endOver(auto=false){
      const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);
      if(bowl.overRuns === 0) bowl.maidens += 1;
      bowl.overRuns = 0; // reset for next over

      // swap strike at over end
      [S.current.striker, S.current.nonStriker] = [S.current.nonStriker, S.current.striker];

      const next = prompt('Over complete. Next bowler name:','New Bowler');
      if(next){ S.current.bowler = next; ensureBowler(S.current.bowlingKey, next); }
      pushCom('End of over ' + Math.floor(S.current.balls/6));
      renderAll();
    }

    function endInnings(){
      // Save innings snapshot
      S.inningsData[S.innings] = JSON.parse(JSON.stringify(S.current));

      if(S.innings === 1){
        S.target = S.current.runs + 1;
        pushCom(`End of 1st innings: ${S.teams[S.current.battingKey].name} ${S.current.runs}/${S.current.wickets} in ${oversText(S.current.balls)}. Target for ${S.teams[S.current.bowlingKey].name}: ${S.target}.`);

        // Prepare 2nd innings
        S.innings = 2;
        const prevBat = S.current.battingKey;
        S.current = {
          battingKey: prevBat==='A' ? 'B' : 'A',
          bowlingKey: prevBat,
          striker: null, nonStriker: null, bowler: null,
          runs:0,wickets:0,balls:0,fours:0,sixes:0,
          commentary:[], battingList:[], bowlingList:[]
        };

        alert('Start 2nd Innings: Enter new opener names and bowler.');
        const st = prompt('Opening Striker (2nd Innings):','Batter 1') || 'Batter 1';
        const nst = prompt('Opening Non-Striker (2nd Innings):','Batter 2') || 'Batter 2';
        const bw = prompt('Opening Bowler (2nd Innings):','Bowler 1') || 'Bowler 1';
        S.current.striker = st; ensureBatter(S.current.battingKey, st);
        S.current.nonStriker = nst; ensureBatter(S.current.battingKey, nst);
        S.current.bowler = bw; ensureBowler(S.current.bowlingKey, bw);

        updateLiveMeta();
        renderAll();
        switchTab('live');
      } else {
        // End of 2nd innings
        pushCom(`End of 2nd innings: ${S.teams[S.current.battingKey].name} ${S.current.runs}/${S.current.wickets} in ${oversText(S.current.balls)}.`);
        S.inningsData[2] = JSON.parse(JSON.stringify(S.current));
        computeResult(true);
        S.matchOver = true;
        renderAwards();
        switchTab('awards');
      }
    }

    function checkChase(){
      if(S.innings===2 && S.target){
        if(S.current.runs >= S.target){
          // Chasing team won
          computeResult(true);
          S.matchOver = true;
          renderAwards();
          switchTab('awards');
        }
      }
    }

    function computeResult(final=false){
      const inn1 = S.inningsData[1];
      const inn2 = (final ? S.current : S.inningsData[2]) || S.current;
      if(!inn1) return;
      const team1 = S.teams[inn1.battingKey].name;
      const team2 = S.teams[inn2.battingKey].name;

      let result = '';
      if(inn2.runs >= inn1.runs + 1){
        const wktRemain = 10 - inn2.wickets;
        result = `${team2} won by ${wktRemain} wicket(s)`;
      } else if(final){
        const runMargin = (inn1.runs - inn2.runs);
        if(runMargin===0) result = 'Match tied'; else result = `${team1} won by ${runMargin} run(s)`;
      } else {
        result = `${team2} need ${inn1.runs + 1 - inn2.runs} more to win`;
      }
      el('resultLine').textContent = result;
      el('targetLine').textContent = S.target ? (`Target: ${S.target} | 2nd Inn: ${inn2.runs}/${inn2.wickets} in ${oversText(inn2.balls)}`) : '—';
    }
    // Keep track of history for Undo
let history = [];

// ======= Extra Features =======
function wideBall(){
  if(S.matchOver) return;
  const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);
  S.current.runs += 1;
  bowl.runs += 1;
  pushCom(`Wide ball by ${S.current.bowler}`);
  history.push({ type:"wide" });
  renderAll();
  checkChase();
}

function noBall(){
  if(S.matchOver) return;
  const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);
  S.current.runs += 1;
  bowl.runs += 1;
  pushCom(`No ball by ${S.current.bowler}`);
  history.push({ type:"noball" });
  renderAll();
  checkChase();
}

function changeStrike(){
  [S.current.striker, S.current.nonStriker] = [S.current.nonStriker, S.current.striker];
  pushCom("Strike changed manually.");
  history.push({ type:"strike" });
  renderAll();
}

function undoLastBall(){
  if(history.length === 0) return;
  const last = history.pop();

  if(last.type === "run"){
    const bat = ensureBatter(S.current.battingKey, last.striker);
    const bowl = ensureBowler(S.current.bowlingKey, last.bowler);
    S.current.runs -= last.runs;
    S.current.balls -= 1;
    bat.runs -= last.runs; bat.balls -= 1;
    bowl.runs -= last.runs; bowl.balls -= 1;
    if(last.runs===4){ S.current.fours--; bat.fours--; }
    if(last.runs===6){ S.current.sixes--; bat.sixes--; }
    if(last.swap) [S.current.striker, S.current.nonStriker] = [S.current.nonStriker, S.current.striker];
    pushCom("Last run undone.");
  }
  else if(last.type === "wicket"){
    S.current.wickets -= 1;
    S.current.balls -= 1;
    const bowl = ensureBowler(S.current.bowlingKey, last.bowler);
    bowl.balls -= 1; bowl.wickets -= 1;
    const bat = ensureBatter(S.current.battingKey, last.striker);
    bat.balls -= 1; bat.out = false; bat.how = "";
    S.current.striker = last.striker; // restore previous striker
    pushCom("Last wicket undone.");
  }
  else if(last.type === "wide"){
    const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);
    S.current.runs -= 1; bowl.runs -= 1;
    pushCom("Last wide undone.");
  }
  else if(last.type === "noball"){
    const bowl = ensureBowler(S.current.bowlingKey, S.current.bowler);
    S.current.runs -= 1; bowl.runs -= 1;
    pushCom("Last no-ball undone.");
  }
  else if(last.type === "strike"){
    [S.current.striker, S.current.nonStriker] = [S.current.nonStriker, S.current.striker];
    pushCom("Strike change undone.");
  }

  renderAll();
}

    // ======= Rendering =======
    function updateLiveMeta(){
      const batName = S.teams[S.current.battingKey].name;
      const bowlName = S.teams[S.current.bowlingKey].name;
      el('liveMeta').textContent = `${batName} vs ${bowlName}`;
      el('inningsTag').textContent = S.innings===1 ? '1st Innings' : '2nd Innings';
    }

    function renderLive(){
      el('scoreline').textContent = `${S.current.runs}/${S.current.wickets} (${oversText(S.current.balls)})`;
      el('batsDisplay').innerHTML = `<b>${S.current.striker}</b> ${statLine(S.current.battingKey, S.current.striker)} • <b>${S.current.nonStriker}</b> ${statLine(S.current.battingKey, S.current.nonStriker)}`;
      el('bowlerDisplay').innerHTML = `<b>${S.current.bowler}</b> ${bowlLine(S.current.bowlingKey, S.current.bowler)}`;
    }

    function statLine(teamKey, name){
      const p = ensureBatter(teamKey, name);
      return `${p.runs}(${p.balls}) 4x${p.fours} 6x${p.sixes} SR ${sr(p.runs,p.balls)}`;
    }
    function bowlLine(teamKey, name){
      const b = ensureBowler(teamKey, name);
      return `${oversText(b.balls)} • ${b.maidens}m • ${b.runs}r • ${b.wickets}w • Econ ${econ(b.runs,b.balls)}`;
    }

    function renderScorecard(){
  // helper: build a table row for batsmen
  function batsTableHtml(innData, battingKey){
    if(!innData) return `<div class="meta">Not started</div>`;
    const list = innData.battingList || [];
    if(list.length === 0) return `<div class="meta">No batting data</div>`;

    let rows = `<table id="battingTableInline" style="width:100%; border-collapse:collapse; margin-top:8px;">
      <thead style="background:#f8fafc;"><tr><th style="padding:8px">Batsman</th><th style="padding:8px">R</th><th style="padding:8px">B</th><th style="padding:8px">4s</th><th style="padding:8px">6s</th><th style="padding:8px">SR</th></tr></thead><tbody>`;
    list.forEach(name => {
      const p = (S.teams[battingKey] && S.teams[battingKey].players[name]) || {};
      const runs = p.runs || 0;
      const balls = p.balls || 0;
      const fours = p.fours || 0;
      const sixes = p.sixes || 0;
      const outText = p.out ? `(${p.how || 'out'})` : ( (name === S.current.striker || name === S.current.nonStriker) && !p.out ? '*' : (p.out ? `(${p.how||'out'})` : '*') );
      rows += `<tr>
        <td style="padding:8px">${name} ${p.out ? `(${p.how||'out'})` : (p.balls ? '' : '')}</td>
        <td style="padding:8px">${runs}</td>
        <td style="padding:8px">${balls}</td>
        <td style="padding:8px">${fours}</td>
        <td style="padding:8px">${sixes}</td>
        <td style="padding:8px">${balls? ((runs/balls)*100).toFixed(1) : '—'}</td>
      </tr>`;
    });
    rows += `</tbody></table>`;
    return rows;
  }

  // helper: build a table for bowlers
  function bowlsTableHtml(innData, bowlingKey){
    if(!innData) return `<div class="meta">Not started</div>`;
    const list = innData.bowlingList || [];
    if(list.length === 0) return `<div class="meta">No bowling data</div>`;

    let rows = `<table id="bowlingTableInline" style="width:100%; border-collapse:collapse; margin-top:8px;">
      <thead style="background:#f8fafc;"><tr><th style="padding:8px">Bowler</th><th style="padding:8px">O</th><th style="padding:8px">M</th><th style="padding:8px">R</th><th style="padding:8px">W</th><th style="padding:8px">Econ</th></tr></thead><tbody>`;
    list.forEach(name => {
      const b = (S.teams[bowlingKey] && S.teams[bowlingKey].bowlers[name]) || {};
      const balls = b.balls || 0;
      const overs = `${Math.floor(balls/6)}.${balls%6}`;
      const maid = b.maidens || 0;
      const runs = b.runs || 0;
      const wkts = b.wickets || 0;
      const econ = (balls? (runs/(balls/6)).toFixed(1) : '—');
      rows += `<tr>
        <td style="padding:8px">${name}</td>
        <td style="padding:8px">${overs}</td>
        <td style="padding:8px">${maid}</td>
        <td style="padding:8px">${runs}</td>
        <td style="padding:8px">${wkts}</td>
        <td style="padding:8px">${econ}</td>
      </tr>`;
    });
    rows += `</tbody></table>`;
    return rows;
  }

  // build inning block html for index 1 or 2
  function inningBlockHtml(index){
    // use snapshot if available, otherwise if current innings matches index use S.current as live snapshot
    const snap = S.inningsData[index] ? JSON.parse(JSON.stringify(S.inningsData[index])) : null;
    const live = (S.innings === index) ? S.current : null;
    const data = snap || live;

    const battingKey = data ? data.battingKey : (index===1 ? (S.toss && S.toss.winner && ((S.toss.decision==='bat')? S.toss.winner : (S.toss.winner==='A'?'B':'A')) ) : (S.toss && S.toss.winner ? (S.toss.winner==='A'?'B':'A') : '') );
    const bowlingKey = data ? data.bowlingKey : (battingKey ? (battingKey==='A' ? 'B':'A') : '');

    const teamName = battingKey ? (S.teams[battingKey].name || (battingKey==='A'?'Team A':'Team B')) : '—';
    const runs = data ? data.runs || 0 : 0;
    const wkts = data ? data.wickets || 0 : 0;
    const balls = data ? data.balls || 0 : 0;

    const scoreLine = data ? `${runs}/${wkts} (${Math.floor(balls/6)}.${balls%6})` : 'Not started';

    let html = `<div class="card" style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div>
          <h4 style="margin:6px 0;">${index}st Innings — ${teamName}</h4>
          <div class="meta">Score: <strong>${scoreLine}</strong></div>
        </div>
      </div>

      <div style="margin-top:10px;">
        <h5 style="margin:8px 0 6px 0;">Batting — ${teamName}</h5>
        ${ batsTableHtml(data, battingKey) }
      </div>

      <div style="margin-top:12px;">
        <h5 style="margin:8px 0 6px 0;">Bowling — ${ (bowlingKey && S.teams[bowlingKey]) ? S.teams[bowlingKey].name : '—' }</h5>
        ${ bowlsTableHtml(data, bowlingKey) }
      </div>
    </div>`;

    return html;
  }

  // Render both innings (1 then 2)
  const scContainer = el('scorecard');
  let combined = '';

  // Ensure header remains like before
  combined += `<h3 id="scHeader">Scorecard</h3>`;
  combined += inningBlockHtml(1);
  combined += inningBlockHtml(2);

  // Optionally show final result / target line (if available)
  if(S.target){
    combined += `<div class="card"><div class="meta">Target: <strong>${S.target}</strong></div>`;
    if(S.innings === 2){
      combined += `<div class="meta">2nd Innings: ${S.current.runs}/${S.current.wickets} in ${Math.floor(S.current.balls/6)}.${S.current.balls%6}</div>`;
    } else if(S.inningsData[2]) {
      combined += `<div class="meta">2nd Innings: ${S.inningsData[2].runs}/${S.inningsData[2].wickets} in ${Math.floor((S.inningsData[2].balls||0)/6)}.${(S.inningsData[2].balls||0)%6}</div>`;
    }
    combined += `</div>`;
  }

  scContainer.innerHTML = combined;
}

    function renderCommentary(){
      const ul = el('comList');
      ul.innerHTML = '';
      S.current.commentary.forEach(line => {
        const li = document.createElement('li');
        li.textContent = line;
        ul.appendChild(li);
      });
    }

    function renderAwards(){
      computeResult(S.matchOver);

      // Best batsman (max runs)
      let bestBat = { name:'—', runs:-1, balls:0, team:'' };
      let bestBowl = { name:'—', wickets:-1, econ:Infinity, runs:0, balls:0, team:'' };
      let bestField = { name:'—', dismissals:-1, team:'' };

      ['A','B'].forEach(k => {
        const t = S.teams[k];
        Object.entries(t.players).forEach(([name,p])=>{
          if(p.runs > bestBat.runs){ bestBat = { name, runs:p.runs, balls:p.balls, team:t.name }; }
        });
        Object.entries(t.bowlers).forEach(([name,b])=>{
          const e = b.balls? b.runs/(b.balls/6) : Infinity;
          if(b.wickets > bestBowl.wickets || (b.wickets===bestBowl.wickets && e < bestBowl.econ)){
            bestBowl = { name, wickets:b.wickets, econ:e, runs:b.runs, balls:b.balls, team:t.name };
          }
        });
        Object.entries(t.fielders).forEach(([name,f])=>{
          if(f.dismissals > bestField.dismissals){ bestField = { name, dismissals:f.dismissals, team:t.name }; }
        });
      });

      el('bestBat').textContent = bestBat.runs>=0 ? `${bestBat.name} (${bestBat.team}) — ${bestBat.runs} runs off ${bestBat.balls} balls` : '—';
      el('bestBowl').textContent = bestBowl.wickets>=0 ? `${bestBowl.name} (${bestBowl.team}) — ${bestBowl.wickets} wickets, Econ ${bestBowl.econ===Infinity? '—' : bestBowl.econ.toFixed(1)}` : '—';
      el('bestField').textContent = bestField.dismissals>=0 ? `${bestField.name} (${bestField.team}) — ${bestField.dismissals} dismissals` : '—';

      // Simple Man of the Match heuristic: runs + 20*wickets + 10*dismissals
      let mom = { name:'—', score:-1, team:'' };
      const scoreOf = (k,name) => {
        const p = S.teams[k].players[name] || {runs:0};
        const b = S.teams[k].bowlers[name] || {wickets:0};
        const f = S.teams[k].fielders[name] || {dismissals:0};
        return (p.runs) + 20*(b.wickets) + 10*(f.dismissals);
      };
      const names = new Set();
      ['A','B'].forEach(k => { Object.keys(S.teams[k].players).forEach(n=>names.add(n)); Object.keys(S.teams[k].bowlers).forEach(n=>names.add(n)); Object.keys(S.teams[k].fielders).forEach(n=>names.add(n)); });
      names.forEach(n => {
        const sa = scoreOf('A',n), sb = scoreOf('B',n);
        const sc = Math.max(sa,sb);
        if(sc > mom.score){ mom = { name:n, score:sc, team: (sa>sb? S.teams.A.name : (sb>sa? S.teams.B.name : '')) } }
      });
      el('mom').textContent = mom.score>=0 ? `${mom.name} (${mom.team||'—'})` : '—';
    }

    function renderAll(){
      updateLiveMeta();
      renderLive();
      renderScorecard();
      renderCommentary();
      computeResult(false);
    }

    // ======= Tabs =======
    function switchTab(name){
      document.querySelectorAll('.tab-btn').forEach(b=> b.classList.toggle('active', b.dataset.tab===name));
      document.querySelectorAll('.tab-section').forEach(s=> s.classList.add('hidden'));
      el(name).classList.remove('hidden');
    }

    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=> switchTab(btn.dataset.tab));
    });

    // ======= Events =======
    el('startMatch').addEventListener('click', startMatch);
    document.querySelectorAll('.run').forEach(b=> b.addEventListener('click', () => addRun(parseInt(b.dataset.run))));
    el('wicketBtn').addEventListener('click', wicketEvent);
    el('endOverBtn').addEventListener('click', ()=> endOver(false));
    el('endInningsBtn').addEventListener('click', endInnings);
    el('newMatchBtn').addEventListener('click', ()=>{ if(confirm('Start a new match? Current progress will be lost.')){ S = initialState(); location.reload(); }});
    el('wideBtn').addEventListener('click', wideBall);
    el('noBallBtn').addEventListener('click', noBall);
    el('strikeChangeBtn').addEventListener('click', changeStrike);
    el('undoBtn').addEventListener('click', undoLastBall);

    // Initialize defaults for setup dropdowns
    el('tossWinner').addEventListener('change', e=> S.toss.winner=e.target.value);
    el('tossDecision').addEventListener('change', e=> S.toss.decision=e.target.value);
    el('undoBtn').addEventListener('click', undoLastBall);
