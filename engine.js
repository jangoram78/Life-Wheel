// engine.js
(function(window){
  "use strict";

  var APP_VERSION = "U13-Engine";

  // localForage config
  localforage.config({
    name: "LifeWheelApp",
    storeName: "lifewheel_state"
  });

  var STATE_KEY = "userState_v2";

  // ----- Domain model (Option A, definitive) -----
  var defaultDomains = [
    { name:"Mental",          sub:["Logic","Knowledge","Skill"] },
    { name:"Physical",        sub:["Strength","Stamina","Health","Mobility"] },
    { name:"Work & Purpose",  sub:["Career","Mastery","Finance","Legacy"] },
    { name:"Social",          sub:["Family","Friends","Colleagues","Civic Contribution"] },
    { name:"Emotional",       sub:["Emotional Stability & Regulation","Joy","Identity"] },
    { name:"Spiritual",       sub:["Philosophy","Virtue"] }
  ];

  // ----- Helpers for date keys -----
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

  // ----- Neglect / momentum helpers -----
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

  // ----- Unified state structure -----
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
    tasks[todayKey] = {
      pending: [],
      done: []
    };

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

function ensureCurrentFrames(){
    var todayKey = getTodayKey();
    var weekKey  = getWeekKey();
    var monthKey = getMonthKey();

    userState.todayKey = todayKey;
    userState.weekKey  = weekKey;
    userState.monthKey = monthKey;

    // Make sure the containers exist
    if (!userState.weeklyScores || typeof userState.weeklyScores !== "object") {
      userState.weeklyScores = {};
    }
    if (!userState.monthlyScores || typeof userState.monthlyScores !== "object") {
      userState.monthlyScores = {};
    }
    if (!userState.tasks || typeof userState.tasks !== "object") {
      userState.tasks = {};
    }
    if (!userState.templates || typeof userState.templates !== "object") {
      userState.templates = {};
    }

    // Ensure weekly frame
    if (!userState.weeklyScores[weekKey]) {
      userState.weeklyScores[weekKey] = {};
      for (var i = 0; i < userState.domains.length; i++) {
        userState.weeklyScores[weekKey][i] = 0;
      }
    } else {
      for (var i2 = 0; i2 < userState.domains.length; i2++) {
        if (typeof userState.weeklyScores[weekKey][i2] !== "number") {
          userState.weeklyScores[weekKey][i2] = 0;
        }
      }
    }

    // Ensure monthly frame
    if (!userState.monthlyScores[monthKey]) {
      userState.monthlyScores[monthKey] = {};
    }
    for (var dIdx = 0; dIdx < userState.domains.length; dIdx++) {
      if (!userState.monthlyScores[monthKey][dIdx]) {
        userState.monthlyScores[monthKey][dIdx] = {};
      }
      for (var sIdx = 0; sIdx < userState.domains[dIdx].sub.length; sIdx++) {
        if (typeof userState.monthlyScores[monthKey][dIdx][sIdx] !== "number") {
          userState.monthlyScores[monthKey][dIdx][sIdx] = 0;
        }
      }
    }

    // Ensure tasks slot for today
    if (!userState.tasks[todayKey]) {
      userState.tasks[todayKey] = { pending: [], done: [] };
    } else {
      var pack = userState.tasks[todayKey];
      if (!Array.isArray(pack.pending)) pack.pending = [];
      if (!Array.isArray(pack.done))    pack.done = [];
    }
}


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
    for(var sIdx=0; sIdx<dom.sub.length; sIdx++){
      var slot = ensureTemplateSlot(domainIdx,sIdx);
      var arr = slot[difficulty] || [];
      arr.forEach(function(label){
        result.push({domainIdx:domainIdx,subdomainIdx:sIdx,label:label});
      });
    }
    if(!result.length) return null;
    var rIdx = Math.floor(Math.random()*result.length);
    return result[rIdx];
  }

  function buildNudge(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var domains = userState.domains;
    if(!domains.length) return null;

    var info = domains.map(function(dom, idx){
      var score = typeof wk[idx]==="number" ? wk[idx] : 0;
      var neglect = deriveNeglect(score);
      var neglectRank = (neglect==="serious"?2:(neglect==="medium"?1:0));
      return {
        idx: idx,
        name: dom.name,
        score: score,
        neglect: neglect,
        neglectRank: neglectRank
      };
    });

    info.sort(function(a,b){
      if(b.neglectRank!==a.neglectRank){
        return b.neglectRank - a.neglectRank;
      }
      return a.score - b.score;
    });

    var worst = info[0];
    if(!worst) return null;

    var total=0, count=0;
    info.forEach(function(d){
      total+=d.score;
      count++;
    });
    var avg = count? total/count : 0;
    var momentum = computeWeeklyMomentum(userState.weeklyScores, userState.weekKey, userState.domains.length);

    var type;
    if(worst.neglect==="serious" || avg<4){
      type="corrective";
    }else if(worst.neglect==="medium" || avg<6){
      type="standard";
    }else{
      type="soft";
    }

    var msg;
    if(type==="soft"){
      msg = "You’re broadly on track. If you can, do one small thing today that supports "+worst.name+".";
    }else if(type==="standard"){
      msg = worst.name+" is falling behind this week. Protect 5–10 minutes today to nudge it forward.";
    }else{
      msg = "You’ve been neglecting "+worst.name+". Ring-fence one simple action today so this domain doesn’t keep sliding.";
    }

    if(momentum<0 && type!=="corrective"){
      msg += " Keep it very small – the aim is just to get moving again.";
    }

    return {
      type:type,
      message:msg,
      target:worst.name
    };
  }

  // ----- Task generation -----

  function generateBaseTaskPack(){
    var todayKey = userState.todayKey;
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var domains = userState.domains;

    var domainInfo = domains.map(function(dom, idx){
      var score = typeof wk[idx]==="number" ? wk[idx] : 0;
      var neglect = deriveNeglect(score);
      var neglectRank = (neglect==="serious"?2:(neglect==="medium"?1:0));
      return {
        idx: idx,
        name: dom.name,
        score: score,
        neglect: neglect,
        neglectRank: neglectRank
      };
    });

    domainInfo.sort(function(a,b){
      if(b.neglectRank!==a.neglectRank){
        return b.neglectRank - a.neglectRank;
      }
      return a.score - b.score;
    });

    var neglected = domainInfo.filter(function(d){ return d.neglect!=="none"; });
    var focus = neglected.length ? neglected : domainInfo;
    focus = focus.slice(0,2);

    var nowIso = new Date().toISOString();
    var pack = { pending:[], done:[] };

    // Micro: 1 per focus domain (2 tasks)
    for(var i=0;i<focus.length;i++){
      var d = focus[i];
      var templ = pickTemplateForDomain(d.idx,"micro");
      var label, subIdx=null;
      if(templ){
        label = templ.label;
        subIdx = templ.subdomainIdx;
      }else{
        label = "Do one small 5–10 min action for "+d.name+" (your choice).";
      }
      var idBase = todayKey+"-"+d.idx+"-"+i;
      pack.pending.push({
        id: idBase+"-m",
        domainIdx: d.idx,
        subdomainIdx: subIdx,
        difficulty: "micro",
        label: label,
        energyCost: 3,
        expectedDuration: 10,
        state: "pending",
        createdAt: nowIso
      });
    }

    // Standard: 1 for worst focus domain
    if(focus.length){
      var worst = focus[0];
      var templStd = pickTemplateForDomain(worst.idx,"standard");
      var labelStd, subIdxStd=null;
      if(templStd){
        labelStd = templStd.label;
        subIdxStd = templStd.subdomainIdx;
      }else{
        labelStd = "Spend 15–20 mins deliberately improving "+worst.name+" in a concrete way.";
      }
      var idStd = todayKey+"-"+worst.idx+"-std";
      pack.pending.push({
        id: idStd,
        domainIdx: worst.idx,
        subdomainIdx: subIdxStd,
        difficulty: "standard",
        label: labelStd,
        energyCost: 5,
        expectedDuration: 20,
        state: "pending",
        createdAt: nowIso
      });
    }

    // Deep: 1 for best-scoring domain if momentum decent
    var momentum = computeWeeklyMomentum(userState.weeklyScores, userState.weekKey, userState.domains.length);
    if(momentum >= 0.3 && domainInfo.length){
      var sortedByScore = domainInfo.slice().sort(function(a,b){
        return b.score - a.score;
      });
      var best = sortedByScore[0];
      var templDeep = pickTemplateForDomain(best.idx,"deep");
      var labelDeep, subIdxDeep=null;
      if(templDeep){
        labelDeep = templDeep.label;
        subIdxDeep = templDeep.subdomainIdx;
      }else{
        labelDeep = "Optional 20–30 min deep block for "+best.name+" (only if you have the energy).";
      }
      var idDeep = todayKey+"-"+best.idx+"-deep";
      pack.pending.push({
        id: idDeep,
        domainIdx: best.idx,
        subdomainIdx: subIdxDeep,
        difficulty: "deep",
        label: labelDeep,
        energyCost: 7,
        expectedDuration: 25,
        state: "pending",
        createdAt: nowIso
      });
    }

    return pack;
  }

  function ensureTasksForToday(force){
    var todayKey = userState.todayKey;
    if(!userState.tasks[todayKey]){
      userState.tasks[todayKey] = { pending:[], done:[] };
    }
    var pack = userState.tasks[todayKey];
    if(!Array.isArray(pack.pending)) pack.pending=[];
    if(!Array.isArray(pack.done))    pack.done=[];

    var hasPending = pack.pending.length>0;
    if(!force && hasPending){
      return;
    }

    var newPack = generateBaseTaskPack();
    // IMPORTANT: keep done list; just replace pending
    pack.pending = newPack.pending;
    // pack.done is left as-is
  }

  function generateTaskForDomainAndDifficulty(domainIdx, difficulty){
    var todayKey = userState.todayKey;
    var domName = (userState.domains[domainIdx] && userState.domains[domainIdx].name) || "Domain";
    var rand = Math.floor(Math.random()*100000);
    var id = todayKey+"-"+domainIdx+"-"+difficulty+"-extra-"+rand;

    var templ = pickTemplateForDomain(domainIdx,difficulty);
    var label, subIdx=null, duration, energy;
    if(templ){
      label = templ.label;
      subIdx = templ.subdomainIdx;
    }else{
      if(difficulty==="micro"){
        label = "Another small 5–10 min action for "+domName+".";
      }else if(difficulty==="standard"){
        label = "Another 15–20 min block improving "+domName+".";
      }else{
        label = "Optional deep 20–30+ min block for "+domName+".";
      }
    }

    if(difficulty==="micro"){
      duration = 10; energy = 3;
    }else if(difficulty==="standard"){
      duration = 20; energy = 5;
    }else{
      duration = 25; energy = 7;
    }

    return {
      id: id,
      domainIdx: domainIdx,
      subdomainIdx: subIdx,
      difficulty: difficulty,
      label: label,
      energyCost: energy,
      expectedDuration: duration,
      state: "pending",
      createdAt: new Date().toISOString()
    };
  }

  function applyTaskCompletionImpact(task){
    if(typeof task.domainIdx!=="number") return;
    var idx = task.domainIdx;
    var weekKey = userState.weekKey;
    if(!userState.weeklyScores[weekKey]){
      userState.weeklyScores[weekKey] = {};
    }
    var current = typeof userState.weeklyScores[weekKey][idx]==="number"
      ? userState.weeklyScores[weekKey][idx]
      : 0;

    var delta = 0;
    if(task.difficulty==="micro")      delta = 0.3;
    else if(task.difficulty==="standard") delta = 0.5;
    else if(task.difficulty==="deep")  delta = 0.8;

    var updated = current + delta;
    if(updated > 10) updated = 10;
    if(updated < 0)  updated = 0;

    userState.weeklyScores[weekKey][idx] = updated;
  }

  // ----- Persistence -----

  function saveState(){
    return localforage.setItem(STATE_KEY,userState);
  }

  // ----- Public API -----

  async function init(){
  var stored = await localforage.getItem(STATE_KEY);

  if (stored && typeof stored === "object") {
    userState = stored;

    // --- Migration / safety guards ---
    if (!userState.domains || !Array.isArray(userState.domains) || !userState.domains.length) {
      userState.domains = defaultDomains.map(function(d){
        return { name: d.name, sub: d.sub.slice(0) };
      });
    }

    if (!userState.weeklyScores || typeof userState.weeklyScores !== "object") {
      userState.weeklyScores = {};
    }
    if (!userState.monthlyScores || typeof userState.monthlyScores !== "object") {
      userState.monthlyScores = {};
    }
    if (!userState.tasks || typeof userState.tasks !== "object") {
      userState.tasks = {};
    }
    if (!userState.templates || typeof userState.templates !== "object") {
      userState.templates = {};
    }

  } else {
    userState = buildDefaultState();
  }

  // Ensure frames & today's tasks
  ensureCurrentFrames();
  ensureTasksForToday(false);
  await saveState();
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

    var scores = [];
    var i;
    for(i=0;i<domains.length;i++){
      var cur = typeof wk[i]==="number" ? wk[i] : 0;
      scores.push(cur);
    }

    var total=0, count=0;
    for(i=0;i<scores.length;i++){
      total += scores[i];
      count++;
    }
    var avg = count ? (total/count) : 0;

    var maxScore=-Infinity, minScore=Infinity;
    var maxIdx=0, minIdx=0;
    for(i=0;i<scores.length;i++){
      var v=scores[i];
      if(v>maxScore){maxScore=v;maxIdx=i;}
      if(v<minScore){minScore=v;minIdx=i;}
    }

    var domainInfo = [];
    for(i=0;i<domains.length;i++){
      var score = scores[i];
      var neglect = deriveNeglect(score);
      var neglectRank = (neglect==="serious"?2:(neglect==="medium"?1:0));
      domainInfo.push({
        idx:i,
        name:domains[i].name,
        score:score,
        neglect:neglect,
        neglectRank:neglectRank,
        lastWeek: prevWeek && typeof prevWeek[i]==="number" ? prevWeek[i] : null
      });
    }

    domainInfo.sort(function(a,b){
      if(b.neglectRank!==a.neglectRank){
        return b.neglectRank - a.neglectRank;
      }
      return a.score - b.score;
    });

    var nudge = buildNudge();

    var todayKey = userState.todayKey;
    var pack = userState.tasks[todayKey] || {pending:[],done:[]};
    if(!Array.isArray(pack.pending)) pack.pending=[];
    if(!Array.isArray(pack.done))    pack.done=[];

    return {
      avgScore: avg,
      avgScoreDisplay: avg.toFixed(1),
      strongest: { idx:maxIdx, name:domains[maxIdx].name, score:maxScore },
      weakest: { idx:minIdx, name:domains[minIdx].name, score:minScore },
      domains: domainInfo,
      nudge: nudge,
      tasks: {
        pending: pack.pending.slice(0),
        done: pack.done.slice(0)
      },
      prevWeekKey: prevKey
    };
  }

  function getWeeklyVM(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var list = [];
    for(var i=0;i<userState.domains.length;i++){
      var v = typeof wk[i]==="number" ? wk[i] : 0;
      list.push({idx:i,name:userState.domains[i].name,sub:userState.domains[i].sub.slice(0),score:v});
    }
    return { domains:list };
  }

  function getInsightsVM(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var prevKey = getPreviousWeekKey();
    var prevWeek = userState.weeklyScores[prevKey] || null;

    var domains = userState.domains;
    var scores = [];
    var i;
    for(i=0;i<domains.length;i++){
      var cur = typeof wk[i]==="number" ? wk[i] : 0;
      scores.push(cur);
    }

    var total=0, count=0;
    for(i=0;i<scores.length;i++){
      total += scores[i]; count++;
    }
    var avg = count ? (total/count) : 0;

    var maxScore=-Infinity, minScore=Infinity;
    var maxIdx=0, minIdx=0;
    for(i=0;i<scores.length;i++){
      var v=scores[i];
      if(v>maxScore){maxScore=v;maxIdx=i;}
      if(v<minScore){minScore=v;minIdx=i;}
    }

    var deltas = [];
    for(i=0;i<domains.length;i++){
      var cur = scores[i];
      var prevVal = prevWeek && typeof prevWeek[i]==="number" ? prevWeek[i] : null;
      var delta = (prevVal===null)? null : (cur - prevVal);
      deltas.push({idx:i, name:domains[i].name, cur:cur, prev:prevVal, delta:delta});
    }

    var focusIdx = null;
    if(deltas.length){
      var minScore = Infinity;
      var candidates = [];
      for(i=0;i<deltas.length;i++){
        if(deltas[i].cur < minScore){
          minScore = deltas[i].cur;
          candidates = [i];
        }else if(deltas[i].cur === minScore){
          candidates.push(i);
        }
      }
      focusIdx = candidates[0];
      if(prevWeek){
        var bestIdx = focusIdx;
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
      }
    }

    return {
      avgScore: avg,
      avgScoreDisplay: avg.toFixed(1),
      strongest: { idx:maxIdx, name:domains[maxIdx].name, score:maxScore },
      weakest: { idx:minIdx, name:domains[minIdx].name, score:minScore },
      deltas: deltas,
      focusIdx: focusIdx,
      hasPrevWeek: !!prevWeek
    };
  }

  function getMonthlyVM(){
    var mk = userState.monthlyScores[userState.monthKey] || {};
    var domains = [];
    for (var i = 0; i < userState.domains.length; i++) {
      var dom = userState.domains[i];
      var subs = [];
      for(var sIdx=0;sIdx<dom.sub.length;sIdx++){
        var v = mk[i] && typeof mk[i][sIdx]==="number" ? mk[i][sIdx] : 0;
        subs.push({ idx:sIdx, name:dom.sub[sIdx], value:v });
      }
      domains.push({ idx:i, name:dom.name, subs:subs });
    }
    return { domains:domains };
  }

  async function updateWeeklyScore(domainIdx, value){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    wk[domainIdx] = value;
    userState.weeklyScores[userState.weekKey] = wk;
    // tasks & nudge will be recomputed lazily when needed
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
    ensureTasksForToday(true); // regenerate pending, keep done
    await saveState();
  }

  async function completeTask(taskId){
    var todayKey = userState.todayKey;
    var pack = userState.tasks[todayKey];
    if(!pack){
      return;
    }
    if(!Array.isArray(pack.pending)) pack.pending=[];
    if(!Array.isArray(pack.done))    pack.done=[];

    var found = null;
    var idx = -1;

    for(var i=0;i<pack.pending.length;i++){
      if(pack.pending[i].id === taskId){
        found = pack.pending[i];
        idx = i;
        break;
      }
    }
    if(!found){
      // Already done or not found
      return;
    }

    // Remove from pending
    pack.pending.splice(idx,1);

    // Mark done and push into done list
    found.state = "done";
    pack.done.push(found);

    // Apply impact
    applyTaskCompletionImpact(found);

    // Generate replacement with same domain + difficulty
    var replacement = generateTaskForDomainAndDifficulty(found.domainIdx, found.difficulty);
    pack.pending.push(replacement);

    await saveState();
  }

  function getTaskTemplatesForDomain(domainIdx){
    var dom = userState.domains[domainIdx];
    if(!dom) return [];
    var result = [];
    for(var sIdx=0;sIdx<dom.sub.length;sIdx++){
      var slot = ensureTemplateSlot(domainIdx,sIdx);
      result.push({
        subIdx:sIdx,
        subName:dom.sub[sIdx],
        micro:slot.micro.slice(0),
        standard:slot.standard.slice(0),
        deep:slot.deep.slice(0)
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
    if(!userState.domains[domainIdx]) return;
    userState.domains[domainIdx].name = newName || ("Domain "+(domainIdx+1));
    await saveState();
  }

  async function updateDomainSubdomains(domainIdx, newSubs){
    if(!userState.domains[domainIdx]) return;
    if(!newSubs || !newSubs.length) return;
    userState.domains[domainIdx].sub = newSubs.slice(0);
    // Ensure monthly scores + templates consistent
    var monthKey = userState.monthKey;
    if(!userState.monthlyScores[monthKey][domainIdx]){
      userState.monthlyScores[monthKey][domainIdx] = {};
    }
    for(var sIdx=0;sIdx<newSubs.length;sIdx++){
      if(typeof userState.monthlyScores[monthKey][domainIdx][sIdx]!=="number"){
        userState.monthlyScores[monthKey][domainIdx][sIdx] = 0;
      }
      ensureTemplateSlot(domainIdx,sIdx);
    }
    await saveState();
  }

  // Radar helper
  function getRadarData(){
    var wk = userState.weeklyScores[userState.weekKey] || {};
    var labels = [];
    var values = [];
    for(var i=0;i<userState.domains.length;i++){
      labels.push(userState.domains[i].name);
      var v = typeof wk[i]==="number" ? wk[i] : 0;
      values.push(v);
    }
    return { labels:labels, values:values };
  }
function getState(){
  return userState;
}

function getDomains(){
  return userState && Array.isArray(userState.domains)
    ? userState.domains
    : [];
}
  // Public
  window.LWEngine = {
    init: init,
    getState: getState,
    getDomains: getDomains,
    getPeriodInfo: getPeriodInfo,
    getTodayVM: getTodayVM,
    getWeeklyVM: getWeeklyVM,
    getInsightsVM: getInsightsVM,
    getMonthlyVM: getMonthlyVM,
    updateWeeklyScore: updateWeeklyScore,
    updateMonthlySubScore: updateMonthlySubScore,
    regenerateTodayTasks: regenerateTodayTasks,
    completeTask: completeTask,
    getTaskTemplatesForDomain: getTaskTemplatesForDomain,
    updateTaskTemplateBlock: updateTaskTemplateBlock,
    updateDomainName: updateDomainName,
    updateDomainSubdomains: updateDomainSubdomains,
    getRadarData: getRadarData
  };

})(window);
