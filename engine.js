// engine.js — LocalStorage Persistence Version (U13-Engine)
(function(window){
  "use strict";

  var APP_VERSION = "U13-Engine";

  // -------------------------------------------------------
  //  LocalStorage-based persistence (replaces localforage)
  // -------------------------------------------------------

  var STATE_KEY = "userState_v2";

  function loadStateFromStorage() {
    try {
      var raw = window.localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error("[LifeWheel] Failed to load state from localStorage", e);
      return null;
    }
  }

  function saveStateToStorage(state) {
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("[LifeWheel] Failed to save state to localStorage", e);
    }
    return Promise.resolve(state);
  }

  // -------------------------------------------------------
  //  Domain Model
  // -------------------------------------------------------

  var defaultDomains = [
    { name:"Mental",          sub:["Logic","Knowledge","Skill"] },
    { name:"Physical",        sub:["Strength","Stamina","Health","Mobility"] },
    { name:"Work & Purpose",  sub:["Career","Mastery","Finance","Legacy"] },
    { name:"Social",          sub:["Family","Friends","Colleagues","Civic Contribution"] },
    { name:"Emotional",       sub:["Emotional Stability & Regulation","Joy","Identity"] },
    { name:"Spiritual",       sub:["Philosophy","Virtue"] }
  ];

  // -------------------------------------------------------
  //  Helper functions (dates, neglect, momentum)
  // -------------------------------------------------------

  function getTodayKey(){
    var d=new Date();
    var y=d.getFullYear();
    var m=d.getMonth()+1;
    var day=d.getDate();
    var mm=(m<10?"0"+m:m);
    var dd=(day<10?"0"+day:day);
    return y+"-"+mm+"-"+dd;
  }

  function getWeekKey(date){
    var d=date || new Date();
    var year=d.getFullYear();
    var oneJan=new Date(year,0,1);
    var dayMS=24*60*60*1000;
    var diff=d-oneJan;
    var day=oneJan.getDay()||7;
    var week=Math.ceil(((diff/dayMS)+day)/7);
    return year+"-W"+(week<10?"0"+week:week);
  }

  function getMonthKey(date){
    var d=date || new Date();
    var year=d.getFullYear();
    var m=d.getMonth()+1;
    return year+"-"+(m<10?"0"+m:m);
  }

  function getPreviousWeekKey(){
    var d=new Date();
    d.setDate(d.getDate()-7);
    return getWeekKey(d);
  }

  function deriveNeglect(score){
    var d=new Date();
    var js=d.getDay();              // Sun=0...Sat=6
    var dow=(js===0?7:js);          // Mon=1...Sun=7
    var frac=dow/7;                 // 1/7 .. 1

    var baseNone=7;
    var baseMedium=4;

    var thrNone=baseNone*frac;
    var thrMedium=baseMedium*frac;

    if(score>=thrNone) return "none";
    if(score>=thrMedium) return "medium";
    return "serious";
  }

  function computeWeeklyMomentum(weeklyScores, weekKey, domainCount){
    var wk = weeklyScores[weekKey] || {};
    if(!domainCount) return 0;
    var total=0, count=0;
    for(var i=0;i<domainCount;i++){
      var v = typeof wk[i]==="number" ? wk[i] : 0;
      total += v;
      count++;
    }
    if(!count) return 0;
    var avg = total / count;     // 0..10
    var m = (avg - 5) / 5;       // map to -1..+1
    if(m > 1) m = 1;
    if(m < -1) m = -1;
    return m;
  }

  // -------------------------------------------------------
  //  Default State
  // -------------------------------------------------------

  var userState = null;

  function buildDefaultState(){
    var todayKey = getTodayKey();
    var weekKey  = getWeekKey();
    var monthKey = getMonthKey();

    var domains = defaultDomains.map(function(d){
      return { name:d.name, sub:d.sub.slice(0) };
    });

    var weeklyScores = {};
    weeklyScores[weekKey] = {};
    domains.forEach(function(_,idx){
      weeklyScores[weekKey][idx] = 0;
    });

    var monthlyScores = {};
    monthlyScores[monthKey] = {};
    domains.forEach(function(dom,idx){
      monthlyScores[monthKey][idx] = {};
      dom.sub.forEach(function(_,sIdx){
        monthlyScores[monthKey][idx][sIdx] = 0;
      });
    });

    var tasks = {};
    tasks[todayKey] = { pending: [], done: [] };

    var templates = {}; // domainIdx -> subIdx -> {micro,standard,deep}

    return {
      version: 1,
      appVersion: APP_VERSION,
      todayKey: todayKey,
      weekKey: weekKey,
      monthKey: monthKey,
      domains: domains,
      weeklyScores: weeklyScores,
      monthlyScores: monthlyScores,
      tasks: tasks,
      templates: templates
    };
  }

  // -------------------------------------------------------
  //  Frame initialisation
  // -------------------------------------------------------

  function ensureCurrentFrames(){
    var todayKey = getTodayKey();
    var weekKey  = getWeekKey();
    var monthKey = getMonthKey();

    userState.todayKey = todayKey;
    userState.weekKey  = weekKey;
    userState.monthKey = monthKey;

    if (!userState.weeklyScores) userState.weeklyScores = {};
    if (!userState.monthlyScores) userState.monthlyScores = {};
    if (!userState.tasks) userState.tasks = {};
    if (!userState.templates) userState.templates = {};

    // Weekly frame
    if (!userState.weeklyScores[weekKey]) {
      userState.weeklyScores[weekKey] = {};
      for (var i = 0; i < userState.domains.length; i++) {
        userState.weeklyScores[weekKey][i] = 0;
      }
    }

    // Monthly frame
    if (!userState.monthlyScores[monthKey]) {
      userState.monthlyScores[monthKey] = {};
    }
    for (var dIdx = 0; dIdx < userState.domains.length; dIdx++) {
      if (!userState.monthlyScores[monthKey][dIdx]) {
        userState.monthlyScores[monthKey][dIdx] = {};
      }
      for (var sIdx=0; sIdx<userState.domains[dIdx].sub.length; sIdx++){
        if (typeof userState.monthlyScores[monthKey][dIdx][sIdx] !== "number") {
          userState.monthlyScores[monthKey][dIdx][sIdx] = 0;
        }
      }
    }

    // Today tasks slot
    if (!userState.tasks[todayKey]) {
      userState.tasks[todayKey] = { pending: [], done: [] };
    }
  }

  // -------------------------------------------------------
  //  Template Handling
  // -------------------------------------------------------

  function ensureTemplateSlot(domainIdx, subIdx){
    if(!userState.templates[domainIdx]){
      userState.templates[domainIdx] = {};
    }
    if(!userState.templates[domainIdx][subIdx]){
      userState.templates[domainIdx][subIdx] = {
        micro:[],
        standard:[],
        deep:[]
      };
    }
    return userState.templates[domainIdx][subIdx];
  }

  function pickTemplateForDomain(domainIdx, difficulty){
    var dom = userState.domains[domainIdx];
    if(!dom) return null;
    var result = [];
    for(var sIdx=0; sIdx < dom.sub.length; sIdx++){
      var slot = ensureTemplateSlot(domainIdx, sIdx);
      var arr = slot[difficulty] || [];
      arr.forEach(function(label){
        result.push({domainIdx:domainIdx, subdomainIdx:sIdx, label:label});
      });
    }
    if(!result.length) return null;
    var rIdx = Math.floor(Math.random()*result.length);
    return result[rIdx];
  }

  // -------------------------------------------------------
  //  Nudge system
  // -------------------------------------------------------

  function buildNudge(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var domains = userState.domains;

    var info = domains.map(function(dom, idx){
      var score = wk[idx] || 0;
      var neglect = deriveNeglect(score);
      var neglectRank = (neglect==="serious"?2:(neglect==="medium"?1:0));
      return { idx, name:dom.name, score, neglect, neglectRank };
    });

    info.sort(function(a,b){
      if(b.neglectRank!==a.neglectRank) return b.neglectRank - a.neglectRank;
      return a.score - b.score;
    });

    var worst = info[0];

    var total=0, count=0;
    info.forEach(function(d){ total+=d.score; count++; });
    var avg = total / count;

    var momentum = computeWeeklyMomentum(userState.weeklyScores, userState.weekKey, userState.domains.length);

    var type;
    if(worst.neglect==="serious" || avg<4) type="corrective";
    else if(worst.neglect==="medium" || avg<6) type="standard";
    else type="soft";

    var msg;
    if(type==="soft"){
      msg = "You’re broadly on track. If you can, do one small thing today that supports "+worst.name+".";
    }else if(type==="standard"){
      msg = worst.name+" is falling behind this week. Protect 5–10 minutes today to nudge it forward.";
    }else{
      msg = "You’ve been neglecting "+worst.name+". Ring-fence one simple action today so this domain doesn’t keep sliding.";
    }

    if(momentum < 0 && type!=="corrective"){
      msg += " Keep it very small – the aim is just to get moving again.";
    }

    return { type, message:msg, target:worst.name };
  }

  // -------------------------------------------------------
  //  Task generation
  // -------------------------------------------------------

  function generateBaseTaskPack(){
    var todayKey = userState.todayKey;
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var domains = userState.domains;

    var domainInfo = domains.map(function(dom, idx){
      var score = wk[idx] || 0;
      var neglect = deriveNeglect(score);
      var neglectRank = (neglect==="serious"?2:(neglect==="medium"?1:0));
      return { idx, name:dom.name, score, neglect, neglectRank };
    });

    domainInfo.sort(function(a,b){
      if(b.neglectRank!==a.neglectRank) return b.neglectRank - a.neglectRank;
      return a.score - b.score;
    });

    var neglected = domainInfo.filter(function(d){ return d.neglect!=="none"; });
    var focus = neglected.length ? neglected : domainInfo;
    focus = focus.slice(0,2);

    var pack = { pending:[], done:[] };
    var nowIso = new Date().toISOString();

    // Micro tasks
    for(var i=0; i<focus.length; i++){
      var d = focus[i];
      var templ = pickTemplateForDomain(d.idx, "micro");
      var label, subIdx=null;

      if(templ){ label = templ.label; subIdx=templ.subdomainIdx; }
      else { label="Do one small 5–10 min action for "+d.name+" (your choice)."; }

      pack.pending.push({
        id: todayKey+"-"+d.idx+"-"+i+"-m",
        domainIdx: d.idx,
        subdomainIdx: subIdx,
        difficulty: "micro",
        label,
        energyCost: 3,
        expectedDuration: 10,
        state: "pending",
        createdAt: nowIso
      });
    }

    // Standard
    if(focus.length){
      var worst = focus[0];
      var templStd = pickTemplateForDomain(worst.idx,"standard");

      var labelStd, subIdxStd=null;
      if(templStd){ labelStd = templStd.label; subIdxStd = templStd.subdomainIdx; }
      else{ labelStd = "Spend 15–20 mins deliberately improving "+worst.name+"."; }

      pack.pending.push({
        id: todayKey+"-"+worst.idx+"-std",
        domainIdx: worst.idx,
        subdomainIdx: subIdxStd,
        difficulty: "standard",
        label: labelStd,
        energyCost: 5,
        expectedDuration: 20,
        state:"pending",
        createdAt: nowIso
      });
    }

    // Deep
    var momentum = computeWeeklyMomentum(userState.weeklyScores,userState.weekKey,userState.domains.length);
    if(momentum >= 0.3){
      var sorted = domainInfo.slice().sort((a,b)=>b.score-a.score);
      var best = sorted[0];

      var templDeep = pickTemplateForDomain(best.idx,"deep");
      var labelDeep, subIdxDeep=null;

      if(templDeep){ labelDeep=templDeep.label; subIdxDeep=templDeep.subdomainIdx; }
      else{ labelDeep="Optional 20–30 min deep block for "+best.name+"."; }

      pack.pending.push({
        id: todayKey+"-"+best.idx+"-deep",
        domainIdx: best.idx,
        subdomainIdx: subIdxDeep,
        difficulty: "deep",
        label: labelDeep,
        energyCost: 7,
        expectedDuration: 25,
        state:"pending",
        createdAt: nowIso
      });
    }

    return pack;
  }

  function ensureTasksForToday(force){
    var todayKey = userState.todayKey;
    if(!userState.tasks[todayKey]) userState.tasks[todayKey] = { pending:[], done:[] };

    var pack = userState.tasks[todayKey];

    if(!force && pack.pending.length){
      return;
    }

    var newPack = generateBaseTaskPack();
    pack.pending = newPack.pending;
  }

  function generateTaskForDomainAndDifficulty(domainIdx, difficulty){
    var todayKey = userState.todayKey;
    var domName = userState.domains[domainIdx]?.name || "Domain";

    var rand = Math.floor(Math.random()*100000);
    var id = `${todayKey}-${domainIdx}-${difficulty}-extra-${rand}`;

    var templ = pickTemplateForDomain(domainIdx,difficulty);

    var label, subIdx=null, duration, energy;

    if(templ){ label = templ.label; subIdx = templ.subdomainIdx; }
    else{
      if(difficulty==="micro") label = "Another small 5–10 min action for "+domName+".";
      else if(difficulty==="standard") label = "Another 15–20 min block improving "+domName+".";
      else label = "Optional deep 20–30 min block for "+domName+".";
    }

    if(difficulty==="micro"){ duration=10; energy=3; }
    else if(difficulty==="standard"){ duration=20; energy=5; }
    else{ duration=25; energy=7; }

    return {
      id, domainIdx, subdomainIdx: subIdx,
      difficulty, label,
      energyCost: energy,
      expectedDuration: duration,
      state:"pending",
      createdAt: new Date().toISOString()
    };
  }

  function applyTaskCompletionImpact(task){
    if(typeof task.domainIdx !== "number") return;

    var idx = task.domainIdx;
    var wk = userState.weeklyScores[userState.weekKey] || {};

    var current = wk[idx] || 0;
    var delta = (task.difficulty==="micro"?0.3 : task.difficulty==="standard"?0.5 : 0.8);

    var updated = Math.min(10, Math.max(0, current + delta));

    wk[idx] = updated;
  }

  // -------------------------------------------------------
  //  Persistence wrapper
  // -------------------------------------------------------

  function saveState(){
    return saveStateToStorage(userState);
  }

  // -------------------------------------------------------
  //  Public API (init + getters + updates)
  // -------------------------------------------------------

  async function init(){
    var stored = loadStateFromStorage();

    if(stored && typeof stored==="object"){
      userState = stored;

      if (!userState.domains || !Array.isArray(userState.domains) || !userState.domains.length) {
        userState.domains = defaultDomains.map(d=>({name:d.name, sub:d.sub.slice(0)}));
      }
      if (!userState.weeklyScores) userState.weeklyScores = {};
      if (!userState.monthlyScores) userState.monthlyScores = {};
      if (!userState.tasks) userState.tasks = {};
      if (!userState.templates) userState.templates = {};

    } else {
      userState = buildDefaultState();
    }

    ensureCurrentFrames();
    ensureTasksForToday(false);
    await saveState();
  }

  function getState(){
    return userState;
  }

  function getDomains(){
    return userState && Array.isArray(userState.domains)
      ? userState.domains
      : [];
  }

  function getPeriodInfo(){
    return {
      weekKey: userState.weekKey,
      monthKey: userState.monthKey,
      appVersion: userState.appVersion
    };
  }

  function getTodayVM(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var domains = userState.domains;
    var prevKey = getPreviousWeekKey();
    var prevWeek = userState.weeklyScores[prevKey] || null;

    var scores = domains.map((_,i)=>wk[i] || 0);

    var total=scores.reduce((a,b)=>a+b,0);
    var avg = total / domains.length;

    var maxScore=Math.max.apply(null,scores);
    var minScore=Math.min.apply(null,scores);
    var maxIdx=scores.indexOf(maxScore);
    var minIdx=scores.indexOf(minScore);

    var domainInfo = domains.map(function(dom, i){
      var score = scores[i];
      var neglect = deriveNeglect(score);
      var neglectRank = (neglect==="serious"?2:(neglect==="medium"?1:0));
      return {
        idx:i,
        name:dom.name,
        score,
        neglect,
        neglectRank,
        lastWeek: prevWeek ? prevWeek[i] : null
      };
    });

    domainInfo.sort(function(a,b){
      if(b.neglectRank !== a.neglectRank) return b.neglectRank - a.neglectRank;
      return a.score - b.score;
    });

    var nudge = buildNudge();

    var todayKey = userState.todayKey;
    var pack = userState.tasks[todayKey] || {pending:[], done:[]};

    return {
      avgScore: avg,
      avgScoreDisplay: avg.toFixed(1),
      strongest: { idx:maxIdx, name:domains[maxIdx].name, score:maxScore },
      weakest: { idx:minIdx, name:domains[minIdx].name, score:minScore },
      domains: domainInfo,
      nudge,
      tasks: {
        pending: pack.pending.slice(0),
        done: pack.done.slice(0)
      },
      prevWeekKey: prevKey
    };
  }

  function getWeeklyVM(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var list = userState.domains.map(function(dom,i){
      return {
        idx:i,
        name:dom.name,
        sub:dom.sub.slice(0),
        score: wk[i] || 0
      };
    });
    return { domains:list };
  }

  function getInsightsVM(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var prevKey = getPreviousWeekKey();
    var prevWeek = userState.weeklyScores[prevKey] || null;

    var domains = userState.domains;
    var scores = domains.map((_,i)=>wk[i] || 0);

    var total=scores.reduce((a,b)=>a+b,0);
    var avg = total / scores.length;

    var maxScore=Math.max.apply(null,scores);
    var minScore=Math.min.apply(null,scores);
    var maxIdx=scores.indexOf(maxScore);
    var minIdx=scores.indexOf(minScore);

    var deltas = domains.map(function(dom,i){
      var cur = scores[i];
      var prevVal = prevWeek ? prevWeek[i] : null;
      var delta = (prevVal===null) ? null : cur-prevVal;
      return { idx:i, name:dom.name, cur, prev:prevVal, delta };
    });

    var focusIdx = null;
    if(deltas.length){
      var minCur = Math.min.apply(null, deltas.map(d=>d.cur));
      var candidates = deltas.filter(d=>d.cur===minCur).map(d=>d.idx);

      if(prevWeek){
        var bestIdx = candidates[0];
        var bestDelta = null;
        candidates.forEach(function(ci){
          var d = deltas[ci].delta;
          if(d===null) return;
          if(bestDelta===null || d<bestDelta){
            bestDelta=d;
            bestIdx=ci;
          }
        });
        focusIdx = bestIdx;
      } else {
        focusIdx = candidates[0];
      }
    }

    return {
      avgScore: avg,
      avgScoreDisplay: avg.toFixed(1),
      strongest: { idx:maxIdx, name:domains[maxIdx].name, score:maxScore },
      weakest: { idx:minIdx, name:domains[minIdx].name, score:minScore },
      deltas,
      focusIdx,
      hasPrevWeek: !!prevWeek
    };
  }

  function getMonthlyVM(){
    var mk = userState.monthlyScores[userState.monthKey] || {};
    var result = userState.domains.map(function(dom,i){
      var subs = dom.sub.map(function(subName,sIdx){
        var v = mk[i] && typeof mk[i][sIdx]==="number" ? mk[i][sIdx] : 0;
        return { idx:sIdx, name:subName, value:v };
      });
      return { idx:i, name:dom.name, subs };
    });
    return { domains: result };
  }

  async function updateWeeklyScore(domainIdx, value){
    userState.weeklyScores[userState.weekKey][domainIdx] = value;
    await saveState();
  }

  async function updateMonthlySubScore(domainIdx, subIdx, value){
    var mk = userState.monthlyScores[userState.monthKey];
    if(!mk[domainIdx]) mk[domainIdx] = {};
    mk[domainIdx][subIdx] = value;
    await saveState();
  }

  async function regenerateTodayTasks(){
    ensureCurrentFrames();
    ensureTasksForToday(true);
    await saveState();
  }

  async function completeTask(taskId){
    var todayKey = userState.todayKey;
    var pack = userState.tasks[todayKey];
    if(!pack) return;

    var foundIdx = pack.pending.findIndex(t=>t.id===taskId);
    if(foundIdx===-1) return;

    var task = pack.pending[foundIdx];
    pack.pending.splice(foundIdx,1);

    task.state="done";
    pack.done.push(task);

    applyTaskCompletionImpact(task);

    var replacement = generateTaskForDomainAndDifficulty(task.domainIdx, task.difficulty);
    pack.pending.push(replacement);

    await saveState();
  }

  function getTaskTemplatesForDomain(domainIdx){
    var dom = userState.domains[domainIdx];
    if(!dom) return [];
    var result = [];
    for(var sIdx=0; sIdx<dom.sub.length; sIdx++){
      var slot = ensureTemplateSlot(domainIdx,sIdx);
      result.push({
        subIdx:sIdx,
        subName:dom.sub[sIdx],
        micro: slot.micro.slice(0),
        standard: slot.standard.slice(0),
        deep: slot.deep.slice(0)
      });
    }
    return result;
  }

  async function updateTaskTemplateBlock(domainIdx, subIdx, difficulty, lines){
    var slot = ensureTemplateSlot(domainIdx,subIdx);
    slot[difficulty] = lines.slice(0);
    await saveState();
  }

  async function updateDomainName(domainIdx, newName){
    userState.domains[domainIdx].name = newName || ("Domain "+(domainIdx+1));
    await saveState();
  }

  async function updateDomainSubdomains(domainIdx, newSubs){
    userState.domains[domainIdx].sub = newSubs.slice(0);

    var mk = userState.monthlyScores[userState.monthKey];
    if(!mk[domainIdx]) mk[domainIdx] = {};

    for(var sIdx=0; sIdx<newSubs.length; sIdx++){
      if(typeof mk[domainIdx][sIdx] !== "number"){
        mk[domainIdx][sIdx] = 0;
      }
      ensureTemplateSlot(domainIdx,sIdx);
    }

    await saveState();
  }

  function getRadarData(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var labels = userState.domains.map(d=>d.name);
    var values = userState.domains.map((_,i)=>wk[i] || 0);
    return { labels, values };
  }

  // -------------------------------------------------------
  //  Public API export
  // -------------------------------------------------------

  window.LWEngine = {
    init,
    getState,
    getDomains,
    getPeriodInfo,
    getTodayVM,
    getWeeklyVM,
    getInsightsVM,
    getMonthlyVM,
    updateWeeklyScore,
    updateMonthlySubScore,
    regenerateTodayTasks,
    completeTask,
    getTaskTemplatesForDomain,
    updateTaskTemplateBlock,
    updateDomainName,
    updateDomainSubdomains,
    getRadarData
  };

})(window);