// ui.js
(function(window){
  "use strict";

  // Compatibility alias: support either LWEngine or LWengine from engine.js
  if (!window.LWEngine && window.LWengine) {
    window.LWEngine = window.LWengine;
  }
  if (!window.LWEngine && !window.LWengine) {
    console.error("Life Wheel engine not found (expected LWEngine or LWengine).");
  }

  // ---- DOM refs ----
  var todayContainer,
      insightsContainer,
      settingsContainer,
      tasksDomainSelect,
      taskTemplatesContainer,
      periodLabel,
      toastEl,
      radarCanvas,
      views;

  var selectedTasksDomainIdx = 0;
  var toastTimer = null;

  // ----- Toast -----
  function showToast(msg){
    toastEl.textContent = msg || "Saved ✓";
    if(toastTimer){ clearTimeout(toastTimer); toastTimer=null; }
    toastEl.classList.add("visible");
    toastTimer = setTimeout(function(){
      toastEl.classList.remove("visible");
    },900);
  }

  // ----- Init DOM refs -----
  function initDomRefs(){
    todayContainer         = document.getElementById("todayContent");
    insightsContainer      = document.getElementById("insightsContent");
    settingsContainer      = document.getElementById("settingsDomains");
    tasksDomainSelect      = document.getElementById("tasksDomainSelect");
    taskTemplatesContainer = document.getElementById("taskTemplatesContainer");
    periodLabel            = document.getElementById("periodLabel");
    toastEl                = document.getElementById("toast");
    radarCanvas            = document.getElementById("weeklyRadar");

    views = {
      todayView:    document.getElementById("todayView"),
      insightsView: document.getElementById("insightsView"),
      logView:      document.getElementById("logView"),
      settingsView: document.getElementById("settingsView")
    };
  }

  // ----- Tabs -----
  function bindTabs(){
    var buttons=document.querySelectorAll(".tab-btn");
    buttons.forEach(function(btn){
      btn.addEventListener("click",function(){
        var target=btn.getAttribute("data-view");
        if(!views[target])return;
        Object.keys(views).forEach(function(k){
          if(views[k]){
            views[k].classList.remove("active");
          }
        });
        views[target].classList.add("active");
        buttons.forEach(function(b){b.classList.remove("active")});
        btn.classList.add("active");
      });
    });
  }

  // ----- Period label -----
  function updatePeriodLabel(){
    var info = window.LWEngine.getPeriodInfo();
    periodLabel.textContent = "Week "+info.weekKey+" · Month "+info.monthKey+" · "+info.appVersion;
  }

  // ----- Radar drawing -----
  function wrapTextLines(ctx,text,maxWidth){
    var words=text.split(" ");
    var lines=[];
    var current=words[0]||"";
    for(var i=1;i<words.length;i++){
      var test=current+" "+words[i];
      if(ctx.measureText(test).width<=maxWidth){
        current=test;
      }else{
        lines.push(current);
        current=words[i];
      }
    }
    lines.push(current);
    return lines;
  }

  function drawRadar(){
    if(!radarCanvas) return;
    var data = window.LWEngine.getRadarData();
    var labels = data.labels;
    var values = data.values;
    var n = labels.length;
    if(!n) return;

    var dpr=window.devicePixelRatio||1;
    var rect=radarCanvas.getBoundingClientRect();
    var size=Math.min(rect.width||260,320)*0.7;
    radarCanvas.width=size*dpr;
    radarCanvas.height=size*dpr;

    var ctx=radarCanvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,size,size);

    var cx=size/2,cy=size/2;
    var radius=size*0.42;
    var maxVal=10;
    var step=(Math.PI*2)/n;
    var base=-Math.PI/2;

    // rings
    ctx.strokeStyle="#e5e7eb";
    ctx.lineWidth=1;
    var rings=4;
    var r,i;
    for(r=1;r<=rings;r++){
      ctx.beginPath();
      var rr=radius*r/rings;
      ctx.arc(cx,cy,rr,0,Math.PI*2);
      ctx.stroke();
    }

    // spokes
    for(i=0;i<n;i++){
      var angle=base+step*i;
      var x=cx+radius*Math.cos(angle);
      var y=cy+radius*Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(x,y);
      ctx.stroke();
    }

    // labels
    ctx.fillStyle="#1f2933";
    ctx.font="9px -apple-system,BlinkMacSystemFont,system-ui";
    var labelRadius=radius*0.93;
    var maxLabelWidth=radius*0.6;

    for(var j=0;j<n;j++){
      var startAng=base+step*j;
      var centerAng=startAng+step/2;
      var lx=cx+labelRadius*Math.cos(centerAng);
      var ly=cy+labelRadius*Math.sin(centerAng);

      var text=labels[j];
      var lines=wrapTextLines(ctx,text,maxLabelWidth);
      var lineHeight=10;

      var ca=Math.cos(centerAng);
      var align;
      if(Math.abs(ca)<0.15){
        align="center";
      }else if(ca>0){
        align="right";
      }else{
        align="left";
      }
      ctx.textAlign=align;

      var baselineShift=(lines.length-1)*lineHeight/2;
      for(var li=0;li<lines.length;li++){
        var offsetY=-baselineShift+li*lineHeight;
        ctx.textBaseline="middle";
        ctx.fillText(lines[li],lx,ly+offsetY);
      }
    }

    // arcs per domain
    for(var k=0;k<n;k++){
      var v=values[k];
      if(v<=0)continue;
      if(v>maxVal)v=maxVal;
      var rrVal=radius*(v/maxVal);

      var segStart=base+step*k;
      var segEnd=segStart+step;

      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,rrVal,segStart,segEnd);
      ctx.closePath();
      ctx.fillStyle="rgba(93,168,255,0.23)";
      ctx.fill();
      ctx.strokeStyle="rgba(37,99,235,0.9)";
      ctx.lineWidth=1;
      ctx.stroke();
    }
  }

  // ----- TODAY VIEW -----
  function renderToday(){
    if(!todayContainer) return;
    todayContainer.innerHTML = "";

    var vm = window.LWEngine.getTodayVM();

    // We assume the radar card is already in the HTML above this container.
    // So here we only render:
    //  1) Coach nudge
    //  2) Today’s tasks

    // Nudge card
    if(vm.nudge){
      var nudgeCard=document.createElement("div");
      nudgeCard.className="card";

      var nHead=document.createElement("div");
      nHead.className="card-header";

      var nTitle=document.createElement("div");
      nTitle.className="card-title";
      nTitle.textContent="Coach nudge";

      var nType=document.createElement("div");
      nType.className="card-value";
      var chip=document.createElement("span");
      chip.className="nudge-type-chip";
      if(vm.nudge.type==="soft"){
        chip.classList.add("nudge-soft");
        chip.textContent="soft";
      }else if(vm.nudge.type==="standard"){
        chip.classList.add("nudge-standard");
        chip.textContent="standard";
      }else{
        chip.classList.add("nudge-corrective");
        chip.textContent="corrective";
      }
      nType.appendChild(chip);

      nHead.appendChild(nTitle);
      nHead.appendChild(nType);
      nudgeCard.appendChild(nHead);

      var nBody=document.createElement("div");
      nBody.className="today-stack";
      var msgEl=document.createElement("div");
      msgEl.className="nudge-message";
      msgEl.textContent=vm.nudge.message;
      nBody.appendChild(msgEl);

      nudgeCard.appendChild(nBody);
      todayContainer.appendChild(nudgeCard);
    }

    // Tasks card
    renderTasksToday(vm.tasks);
  }

  function renderTasksToday(taskPack){
    var card=document.createElement("div");
    card.className="card";

    var header=document.createElement("div");
    header.className="card-header";

    var title=document.createElement("div");
    title.className="card-title";
    title.textContent="Today’s tasks";

    var regenBtn=document.createElement("button");
    regenBtn.className="btn outline";
    regenBtn.textContent="Regenerate";
    regenBtn.style.fontSize="11px";
    regenBtn.style.padding="4px 8px";
    regenBtn.addEventListener("click",async function(){
      if(confirm("Regenerate today’s tasks? This will replace today’s pending list but keep your Done list.")){
        await window.LWEngine.regenerateTodayTasks();
        renderAll();
        showToast("Today’s tasks regenerated");
      }
    });

    header.appendChild(title);
    header.appendChild(regenBtn);
    card.appendChild(header);

    var body=document.createElement("div");
    body.className="task-stack";

    var pending = taskPack.pending || [];
    var done = taskPack.done || [];

    var micro = pending.filter(function(t){return t.difficulty==="micro";});
    var standard = pending.filter(function(t){return t.difficulty==="standard";});
    var deep = pending.filter(function(t){return t.difficulty==="deep";});

    var hasAny = micro.length || standard.length || deep.length || done.length;

    if(!hasAny){
      var msg=document.createElement("div");
      msg.className="insights-secondary";
      msg.textContent="No tasks generated yet.";
      body.appendChild(msg);
    }else{
      function addGroup(titleText, list, difficultyLabel, isDoneSection){
        if(!list || !list.length) return;
        var gTitle=document.createElement("div");
        gTitle.className="task-group-title";
        gTitle.textContent=titleText;
        body.appendChild(gTitle);

        list.forEach(function(task){
          var row=document.createElement("div");
          row.className="task-row";
          if(isDoneSection){ row.classList.add("task-done"); }

          var checkbox=document.createElement("input");
          checkbox.type="checkbox";
          checkbox.className="task-checkbox";
          checkbox.checked = isDoneSection;

          if(!isDoneSection){
            checkbox.addEventListener("change",async function(){
              if(!checkbox.checked){
                checkbox.checked = false;
                return;
              }
              await window.LWEngine.completeTask(task.id);
              renderAll();
              var domains = window.LWEngine.getDomains();
              var domName = (domains[task.domainIdx] && domains[task.domainIdx].name) || "Domain";
              showToast("Saved ✓ · "+domName);
            });
          }else{
            checkbox.disabled = true;
          }

          var main=document.createElement("div");
          main.className="task-main";

          var label=document.createElement("div");
          label.className="task-label";
          label.textContent=task.label;

          var meta=document.createElement("div");
          meta.className="task-meta";
          meta.textContent=difficultyLabel+" · ~"+task.expectedDuration+" mins · energy "+task.energyCost+"/10";

          var chip=document.createElement("div");
          chip.className="task-domain-chip";
          var domains = window.LWEngine.getDomains();
          var domName = (domains[task.domainIdx] && domains[task.domainIdx].name) || "Domain";
          if(typeof task.subdomainIdx==="number" &&
             domains[task.domainIdx] &&
             domains[task.domainIdx].sub &&
             domains[task.domainIdx].sub[task.subdomainIdx]){
            var subName = domains[task.domainIdx].sub[task.subdomainIdx];
            chip.textContent = domName+" — "+subName;
          }else{
            chip.textContent=domName;
          }

          main.appendChild(label);
          main.appendChild(meta);
          main.appendChild(chip);

          row.appendChild(checkbox);
          row.appendChild(main);

          body.appendChild(row);
        });
      }

      addGroup("Micro (5–10 mins)", micro, "Micro", false);
      addGroup("Standard (15–20 mins)", standard, "Standard", false);
      addGroup("Deep (20–30+ mins)", deep, "Deep", false);
      addGroup("Done", done, "Done", true);
    }

    card.appendChild(body);
    todayContainer.appendChild(card);
  }

  // ----- INSIGHTS VIEW -----
  function renderInsights(){
    if(!insightsContainer) return;
    insightsContainer.innerHTML="";

    var vm = window.LWEngine.getInsightsVM();

    // Summary card
    var summaryCard=document.createElement("div");
    summaryCard.className="card";

    var summaryHeader=document.createElement("div");
    summaryHeader.className="card-header";

    var summaryTitle=document.createElement("div");
    summaryTitle.className="card-title";
    summaryTitle.textContent="This week at a glance";

    var summaryValue=document.createElement("div");
    summaryValue.className="card-value";
    summaryValue.textContent="Avg "+vm.avgScoreDisplay+"/10";

    summaryHeader.appendChild(summaryTitle);
    summaryHeader.appendChild(summaryValue);
    summaryCard.appendChild(summaryHeader);

    var summaryBody=document.createElement("div");
    summaryBody.className="insights-stack";

    var bestLine=document.createElement("div");
    bestLine.className="insights-secondary";
    bestLine.textContent="Strongest: "+vm.strongest.name+" ("+vm.strongest.score+"/10)";

    var worstLine=document.createElement("div");
    worstLine.className="insights-secondary";
    worstLine.textContent="Weakest: "+vm.weakest.name+" ("+vm.weakest.score+"/10)";

    summaryBody.appendChild(bestLine);
    summaryBody.appendChild(worstLine);
    summaryCard.appendChild(summaryBody);
    insightsContainer.appendChild(summaryCard);

    // Deltas card
    var deltasCard=document.createElement("div");
    deltasCard.className="card";

    var deltasHeader=document.createElement("div");
    deltasHeader.className="card-header";

    var deltasTitle=document.createElement("div");
    deltasTitle.className="card-title";
    deltasTitle.textContent="Week-over-week change";

    deltasHeader.appendChild(deltasTitle);
    deltasCard.appendChild(deltasHeader);

    var deltasBody=document.createElement("div");
    deltasBody.className="insights-stack";

    vm.deltas.forEach(function(d){
      var row=document.createElement("div");
      row.className="insights-row";

      var label=document.createElement("div");
      label.className="insights-label";
      label.textContent=d.name;

      var right=document.createElement("div");
      right.style.display="flex";
      right.style.alignItems="baseline";

      var scoreEl=document.createElement("div");
      scoreEl.className="insights-score";
      scoreEl.textContent=d.cur+"/10";

      var deltaEl=document.createElement("div");
      deltaEl.className="insights-delta";

      if(d.delta===null){
        deltaEl.textContent="–";
        deltaEl.style.color="#94a3b8";
      }else if(d.delta>0){
        deltaEl.textContent="▲ +"+d.delta;
        deltaEl.style.color="#16a34a";
      }else if(d.delta<0){
        deltaEl.textContent="▼ "+d.delta;
        deltaEl.style.color="#dc2626";
      }else{
        deltaEl.textContent="–";
        deltaEl.style.color="#94a3b8";
      }

      right.appendChild(scoreEl);
      right.appendChild(deltaEl);
      row.appendChild(label);
      row.appendChild(right);
      deltasBody.appendChild(row);
    });

    deltasCard.appendChild(deltasBody);
    insightsContainer.appendChild(deltasCard);

    // Focus suggestion
    var focusCard=document.createElement("div");
    focusCard.className="card";

    var focusHeader=document.createElement("div");
    focusHeader.className="card-header";

    var focusTitle=document.createElement("div");
    focusTitle.className="card-title";
    focusTitle.textContent="Suggested focus for next week";

    focusHeader.appendChild(focusTitle);
    focusCard.appendChild(focusHeader);

    var focusBody=document.createElement("div");
    focusBody.className="insights-stack";

    if(!vm.deltas.length || !vm.hasPrevWeek || vm.focusIdx===null){
      var msg=document.createElement("div");
      msg.className="insights-secondary";
      msg.textContent="Not enough weekly data yet. Add some scores to see a focus suggestion.";
      focusBody.appendChild(msg);
    }else{
      var f = vm.deltas[vm.focusIdx];
      var line1=document.createElement("div");
      line1.className="insights-label";
      line1.textContent=f.name;

      var line2=document.createElement("div");
      line2.className="insights-secondary";
      var text="Current: "+f.cur+"/10";
      if(f.delta!==null && f.delta!==0){
        text+=" · Change vs last week: ";
        if(f.delta>0){
          text+="▲ +"+f.delta;
        }else{
          text+="▼ "+f.delta;
        }
      }
      line2.textContent=text;

      focusBody.appendChild(line1);
      focusBody.appendChild(line2);
    }

    focusCard.appendChild(focusBody);
    insightsContainer.appendChild(focusCard);
  }

  // ----- SETTINGS (domains) -----
  function renderSettings(){
    if(!settingsContainer)return;
    settingsContainer.innerHTML="";
    var domains = window.LWEngine.getDomains();
    domains.forEach(function(dom,idx){
      var group=document.createElement("div");
      group.className="settings-group";

      var row1=document.createElement("div");
      row1.className="settings-row";

      var inputName=document.createElement("input");
      inputName.type="text";
      inputName.value=dom.name;
      inputName.placeholder="Domain name";

      inputName.addEventListener("change",function(e){
        var v = e.target.value || ("Domain "+(idx+1));
        window.LWEngine.updateDomainName(idx,v).then(function(){
          drawRadar();
          renderInsights();
          renderToday();
          renderTaskTemplatesView();
          showToast("Saved ✓");
        });
      });

      row1.appendChild(inputName);
      group.appendChild(row1);

      var row2=document.createElement("div");
      row2.className="settings-row";

      var inputSub=document.createElement("input");
      inputSub.type="text";
      inputSub.value=dom.sub.join(", ");
      inputSub.placeholder="Subdomains (comma separated)";

      inputSub.addEventListener("change",function(e){
        var raw=e.target.value||"";
        var parts=raw.split(",").map(function(s){return s.trim()}).filter(Boolean);
        if(!parts.length) parts=["Aspect 1","Aspect 2","Aspect 3"];
        window.LWEngine.updateDomainSubdomains(idx,parts).then(function(){
          drawRadar();
          renderInsights();
          renderToday();
          renderTaskTemplatesView();
          showToast("Saved ✓");
        });
      });

      row2.appendChild(inputSub);
      group.appendChild(row2);
      settingsContainer.appendChild(group);
    });
  }

  // ----- MY TASKS (templates) within Settings -----
  function renderTaskTemplatesView(){
    if(!tasksDomainSelect || !taskTemplatesContainer) return;

    var domains = window.LWEngine.getDomains();
    tasksDomainSelect.innerHTML = "";
    domains.forEach(function(dom, idx){
      var opt=document.createElement("option");
      opt.value=String(idx);
      opt.textContent=dom.name;
      tasksDomainSelect.appendChild(opt);
    });

    if(selectedTasksDomainIdx >= domains.length) selectedTasksDomainIdx = 0;
    tasksDomainSelect.value = String(selectedTasksDomainIdx);

    taskTemplatesContainer.innerHTML = "";

    var templates = window.LWEngine.getTaskTemplatesForDomain(selectedTasksDomainIdx);
    var dom = domains[selectedTasksDomainIdx];
    if(!dom) return;

    var card=document.createElement("div");
    card.className="card";

    var head=document.createElement("div");
    head.className="card-header";

    var title=document.createElement("div");
    title.className="card-title";
    title.textContent=dom.name+" – subdomain tasks";

    head.appendChild(title);
    card.appendChild(head);

    var body=document.createElement("div");
    body.className="slider-row";

    templates.forEach(function(t){
      var subCard=document.createElement("div");
      subCard.className="template-sub-card";

      var subTitle=document.createElement("div");
      subTitle.className="template-sub-title";
      subTitle.textContent=t.subName;
      subCard.appendChild(subTitle);

      function addArea(labelText, difficultyKey, initialLines){
        var lbl=document.createElement("div");
        lbl.className="template-diff-label";
        lbl.textContent=labelText+" (one per line)";

        var ta=document.createElement("textarea");
        ta.className="template-textarea";
        ta.value=(initialLines||[]).join("\n");
        ta.addEventListener("change",function(e){
          var raw=e.target.value||"";
          var lines=raw.split("\n").map(function(s){return s.trim();}).filter(Boolean);
          window.LWEngine.updateTaskTemplateBlock(selectedTasksDomainIdx,t.subIdx,difficultyKey,lines)
            .then(function(){ showToast("Tasks saved ✓"); });
        });

        subCard.appendChild(lbl);
        subCard.appendChild(ta);
      }

      addArea("Micro (5–10 mins)","micro",t.micro);
      addArea("Standard (15–20 mins)","standard",t.standard);
      addArea("Deep (20–30+ mins)","deep",t.deep);

      body.appendChild(subCard);
    });

    card.appendChild(body);
    taskTemplatesContainer.appendChild(card);
  }

  function bindTasksDomainSelect(){
    if(!tasksDomainSelect) return;
    tasksDomainSelect.addEventListener("change",function(e){
      var idx=parseInt(e.target.value,10);
      if(isNaN(idx)) idx=0;
      selectedTasksDomainIdx=idx;
      renderTaskTemplatesView();
    });
  }

  // ----- LOG VIEW (Quick log + manual log) -----

  // Quick-log buttons: your three everyday activities
  function renderQuickLogSection(parentEl){
    var card = document.createElement("div");
    card.className = "card";

    var head = document.createElement("div");
    head.className = "card-header";

    var title = document.createElement("div");
    title.className = "card-title";
    title.textContent = "Daily quick log";

    head.appendChild(title);
    card.appendChild(head);

    var body = document.createElement("div");
    body.className = "today-stack";

    // Helper to build one button wired to a specific domain/subdomain/difficulty
    function addQuickButton(label, domainName, subName, difficulty){
      var btn = document.createElement("button");
      btn.className = "btn outline";
      btn.style.fontSize = "11px";
      btn.style.padding = "4px 8px";
      btn.textContent = label;

      btn.addEventListener("click", async function(){
        var domains = window.LWEngine.getDomains();
        var dIdx = domains.findIndex(d => d.name === domainName);
        if(dIdx === -1){
          alert("Domain '"+domainName+"' not found – check names in app settings.");
          return;
        }
        var sIdx = domains[dIdx].sub.indexOf(subName);
        if(sIdx === -1){
          alert("Subdomain '"+subName+"' not found under '"+domainName+"'.");
          return;
        }

        await window.LWEngine.addLoggedTaskToToday(dIdx, sIdx, difficulty, label);
        showToast("Logged ✓");
        renderAll();
      });

      body.appendChild(btn);
    }

    // Your three specific daily quick-log tasks:
    addQuickButton(
      "Take all vitamins",
      "Physical",
      "Health",
      "standard"
    );

    addQuickButton(
      "Drink glass of ACV first thing",
      "Physical",
      "Health",
      "micro"
    );

    addQuickButton(
      "Morning Ten Minute Workout",
      "Physical",
      "Strength",
      "standard"
    );

    card.appendChild(body);
    parentEl.appendChild(card);
  }

  function renderLogView(){
    var logContainer = document.getElementById("logContent");
    if (!logContainer) return;
    logContainer.innerHTML = "";

    // Quick-log section
    var quickSection = document.createElement("div");
    quickSection.className = "section";
    renderQuickLogSection(quickSection);
    logContainer.appendChild(quickSection);

    // Manual log section
    var formSection = document.createElement("div");
    formSection.className = "section";

    var domains = window.LWEngine.getDomains();

    // Domain select
    var domSelect = document.createElement("select");
    domSelect.id = "logDomainSelect";
    domains.forEach(function(d, idx){
      var opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = d.name;
      domSelect.appendChild(opt);
    });
    formSection.appendChild(domSelect);

    // Subdomain select
    var subSelect = document.createElement("select");
    subSelect.id = "logSubSelect";
    formSection.appendChild(subSelect);

    // Difficulty select
    var diffSelect = document.createElement("select");
    diffSelect.id = "logDiffSelect";
    ["micro","standard","deep"].forEach(function(d){
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      diffSelect.appendChild(opt);
    });
    formSection.appendChild(diffSelect);

    // Text input
    var textInput = document.createElement("input");
    textInput.id = "logTextInput";
    textInput.placeholder = "Describe what you did";
    formSection.appendChild(textInput);

    // Button
    var btn = document.createElement("button");
    btn.className = "btn outline";
    btn.textContent = "Add to Today";

    btn.addEventListener("click", async function(){
      var dIdx = parseInt(domSelect.value, 10);
      var sIdx = parseInt(subSelect.value, 10);
      var diff = diffSelect.value;
      var label = textInput.value.trim();

      if (!label) {
        alert("Please enter a description.");
        return;
      }

      await window.LWEngine.addLoggedTaskToToday(dIdx, sIdx, diff, label);
      textInput.value = "";

      showToast("Logged ✓");
      renderAll();
    });

    formSection.appendChild(btn);
    logContainer.appendChild(formSection);

    // Populate subdomains initially
    function refreshSubdomains() {
      subSelect.innerHTML = "";
      var dIdx = parseInt(domSelect.value, 10);
      var dom = domains[dIdx];
      if (!dom) return;
      dom.sub.forEach(function(s, idx){
        var opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = s;
        subSelect.appendChild(opt);
      });
    }

    domSelect.addEventListener("change", refreshSubdomains);
    refreshSubdomains();
  }

  // ----- Top-level render -----
  function renderAll(){
    updatePeriodLabel();
    drawRadar();
    renderInsights();
    renderSettings();
    renderTaskTemplatesView();
    renderLogView();
    renderToday();
  }

  // ----- Init -----
  async function initUI(){
    initDomRefs();
    bindTabs();
    bindTasksDomainSelect();

    renderAll();

    window.addEventListener("resize",function(){
      clearTimeout(window.__lwResizeTimer);
      window.__lwResizeTimer=setTimeout(function(){
        drawRadar();
      },180);
    });
  }

  document.addEventListener("DOMContentLoaded",function(){
    console.log("LWEngine at DOMContentLoaded:", window.LWEngine);
    window.LWEngine.init().then(function(){
      initUI();
    });
  });

})(window);
