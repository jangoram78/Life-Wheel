// activities.js
// Seeds the My Tasks library from a master list of activities
// on first run (or when templates are still empty).

(function (window) {
  "use strict";

  if (!window.LWEngine) {
    console.warn("[LifeWheel] LWEngine not found – activities seeding skipped.");
    return;
  }

  // Keep a reference to the original init so we can wrap it
  const ORIGINAL_INIT = window.LWEngine.init;

  // 🔹 MASTER TASK LIST
  // One task per line, in this exact format:
  // Domain|Subdomain|Difficulty|Task label
  //
  // Difficulty must be one of: Micro, Standard, Deep (case-insensitive).
  //
  // 👉 IMPORTANT:
  // Paste your full **'activity list deduped by subdomain'** here
  // so this string exactly matches the agreed master list.
  const RAW_TASKS = `
Physical|Strength|Micro|Do 2 pull-ups
Physical|Strength|Micro|Do 5 push-ups
Physical|Strength|Micro|Do 1 set of kettlebell squats
Physical|Strength|Standard|Complete one grind-style strength block (home or gym)
Physical|Strength|Standard|Do a focused pull-up + push-up + KB combo session (15–20 mins)
Physical|Strength|Deep|Do a full heavy strength workout (gym or home, 30+ mins)
Physical|Strength|Deep|Do a structured grind-style strength session with logging (30–40 mins)

Physical|Stamina|Micro|Do 3–5 minutes of skipping
Physical|Stamina|Micro|Do a brisk 10-minute walk
Physical|Stamina|Standard|Do a 20–30 minute steady-state cardio session (rower / jog / brisk walk)
Physical|Stamina|Standard|Do a 15–20 minute skipping + walk combo block
Physical|Stamina|Deep|Do a 30-minute zone 2 cardio block (rower / jog / brisk walk)
Physical|Stamina|Deep|Do a 40+ minute mixed cardio session (e.g. walk + row / jog)

Physical|Mobility|Micro|Do a 2–3 minute deep squat + spine twist stretch
Physical|Mobility|Micro|Do 2–3 minutes of passive hanging / shoulder mobility
Physical|Mobility|Standard|Do a 10–15 minute simple mobility flow (hips, hamstrings, back)
Physical|Mobility|Standard|Do 10–15 minutes of squat, hang, and spine mobility work
Physical|Mobility|Deep|Do a 20–30 minute mobility / stretching session (with audio/book)
Physical|Mobility|Deep|Do a 20–30 minute yoga-style or free-form mobility session

Physical|Health|Micro|Skip breakfast (fasting micro)
Physical|Health|Standard|Fast until lunch (extend overnight fast)
Physical|Health|Deep|Do a 24-hour fast
Physical|Health|Deep|Do a full health check-in session (weight, waist, notes, reflection)

Mental|Logic|Micro|Do 1–2 chess puzzles
Mental|Logic|Micro|Use ChatGPT to think through one small problem clearly
Mental|Logic|Standard|Do a 15–20 minute focused chess / logic / reasoning block
Mental|Logic|Standard|Use ChatGPT to reason through a moderately complex work or life decision
Mental|Logic|Deep|Do a 30–40 minute deep reasoning session (e.g. project planning, modelling)
Mental|Logic|Deep|Work through a difficult conceptual problem with written notes (30–40 mins)

Mental|Knowledge|Micro|Read or listen to 5–10 minutes of a non-fiction book
Mental|Knowledge|Micro|Read one quality article on history / geopolitics / sociology
Mental|Knowledge|Standard|Do a 20–30 minute focused reading session on a chosen topic
Mental|Knowledge|Standard|Use ChatGPT to summarise and reflect on a chapter or article
Mental|Knowledge|Deep|Do a 40+ minute deep-dive session on a single topic (with notes)
Mental|Knowledge|Deep|Create or extend a knowledge map / outline on a topic (30–40 mins)

Mental|Skill|Micro|Do 5–10 minutes of Chinese vocab / sentences
Mental|Skill|Micro|Practice one guitar exercise or chord change for 5–10 minutes
Mental|Skill|Micro|Do 5–10 minutes of a small craft or making task
Mental|Skill|Standard|Do a 20–30 minute Chinese practice block (reading / listening / speaking)
Mental|Skill|Standard|Do a 20–30 minute focused guitar practice session
Mental|Skill|Standard|Do a 20–30 minute focused craft / hands-on making session
Mental|Skill|Deep|Do a 40+ minute deep Chinese learning session (with structure)
Mental|Skill|Deep|Do a 40+ minute deep guitar practice block (song, technique, or piece)
Mental|Skill|Deep|Do a 40+ minute craft / making session (design, build, or create something)

Emotional|Emotional Stability & Regulation|Micro|Do a 5-minute breathing or grounding exercise
Emotional|Emotional Stability & Regulation|Micro|Write a quick 3-line brain-dump to clear mental noise
Emotional|Emotional Stability & Regulation|Standard|Do a 15–20 minute “stress triage” journaling session
Emotional|Emotional Stability & Regulation|Standard|Review current commitments and intentionally drop or defer one thing
Emotional|Emotional Stability & Regulation|Deep|Do a 30–40 minute deep review of stressors, boundaries, and commitments
Emotional|Emotional Stability & Regulation|Deep|Do a 30–40 minute structured problem-solving session on a recurring stressor

Emotional|Joy|Micro|Take 5–10 minutes to enjoy a coffee / drink with full attention
Emotional|Joy|Micro|Put on one nostalgic or uplifting song and listen fully
Emotional|Joy|Standard|Have a 20–30 minute fun, light, screen-free block with family (game, chat, play)
Emotional|Joy|Standard|Spend 20–30 minutes doing a hobby purely for enjoyment
Emotional|Joy|Deep|Plan and do a longer joyful activity with family or friends (outing or extended game time)
Emotional|Joy|Deep|Do a 45–60 minute personal joy block (music, reading, hobby, no productivity allowed)

Emotional|Identity|Micro|Write a 3-line reflection on “how I showed up today as a dad / learner / independent thinker”
Emotional|Identity|Micro|Re-read one short note, quote, or principle that captures how you want to live
Emotional|Identity|Standard|Do a 20–30 minute identity reflection on current roles, values, and recent actions
Emotional|Identity|Standard|Review and tweak your personal principles or life notes for 20–30 minutes
Emotional|Identity|Deep|Do a 40–60 minute deep identity review (values, roles, direction, and recent choices)
Emotional|Identity|Deep|Work on your long-form “who I am / how I live” notes or document (40+ mins)

Work & Purpose|Career|Micro|Capture 2–3 bullet points of wins or useful moments from today’s work
Work & Purpose|Career|Micro|Send one message or note that improves a professional relationship
Work & Purpose|Career|Standard|Do a 20–30 minute focused block on a meaningful work task that moves things forward
Work & Purpose|Career|Standard|Capture notes for future CV / performance review (20–30 minutes)
Work & Purpose|Career|Deep|Do a 40–60 minute deep block on a high-impact work objective
Work & Purpose|Career|Deep|Do a 40–60 minute structured review of role fit, direction, and next-step options

Work & Purpose|Mastery|Micro|Spend 5–10 minutes reading or watching something that improves your craft as a PM / leader
Work & Purpose|Mastery|Micro|Capture one insight about pattern recognition or systems from your day
Work & Purpose|Mastery|Standard|Do a 20–30 minute deepening session on one mastery topic (e.g. decision-making, leadership)
Work & Purpose|Mastery|Standard|Use ChatGPT to analyse a work situation for learning and patterns (20–30 mins)
Work & Purpose|Mastery|Deep|Do a 40–60 minute deliberate practice or learning block focused on long-term mastery
Work & Purpose|Mastery|Deep|Do a 40–60 minute “case study” reflection on a complex work challenge

Work & Purpose|Finance|Micro|Read one high-quality piece on personal finance, investing, or tax
Work & Purpose|Finance|Micro|Note one small spending or systems tweak that protects against lifestyle creep
Work & Purpose|Finance|Standard|Do a 20–30 minute learning session on a single finance topic (tax, pensions, etc.)
Work & Purpose|Finance|Standard|Review one aspect of your family financial plan and jot improvements (20–30 mins)
Work & Purpose|Finance|Deep|Do a 40–60 minute deep dive on a financial modelling or planning question
Work & Purpose|Finance|Deep|Do a 40–60 minute structured review of your current “freedom / work-optional” trajectory

Work & Purpose|Legacy|Micro|Capture one idea, story, or lesson you might want your kids to know
Work & Purpose|Legacy|Micro|Write a short note of appreciation or encouragement to one of your children
Work & Purpose|Legacy|Standard|Spend 20–30 minutes adding to your “lessons for my kids” document or notes
Work & Purpose|Legacy|Standard|Spend 20–30 minutes capturing a life story or memory you’d like them to have
Work & Purpose|Legacy|Deep|Do a 40–60 minute deep writing block on your legacy document or life lessons
Work & Purpose|Legacy|Deep|Do a 40–60 minute reflection on long-term impact, values, and family direction

Social|Family|Micro|Do one small practical task that makes life easier for the family (bags, kitchen, homework prep)
Social|Family|Micro|Set up or propose one small fun thing for the family later (game, walk, outing idea)
Social|Family|Standard|Spend 20–30 minutes of focused, phone-free time with your kids
Social|Family|Standard|Spend 20–30 minutes helping Yang with something practical or work-related
Social|Family|Deep|Do a 60+ minute family activity (outing, board game, park, or project)
Social|Family|Deep|Have a longer, relaxed block with Yang (date-style time, deep chat, or shared activity)

Social|Friends|Micro|— (no micro tasks: keep spontaneous)
Social|Friends|Standard|Reach out intentionally to a friend you haven’t spoken to in a while (message or call)
Social|Friends|Standard|Arrange or propose a catch-up with a friend
Social|Friends|Deep|Meet a friend in person for a proper catch-up (beer / coffee / walk)
Social|Friends|Deep|Do a longer social event with one or more friends (evening out, shared activity)

Social|Colleagues|Micro|Send a quick supportive or appreciative message to a colleague
Social|Colleagues|Micro|Offer a small piece of help or clarity to someone at work
Social|Colleagues|Standard|Have a 20–30 minute 1:1 or focus block that improves a key work relationship
Social|Colleagues|Standard|Spend 20–30 minutes giving thoughtful feedback or mentoring
Social|Colleagues|Deep|Do a 40–60 minute deep block on team health, collaboration, or process improvement
Social|Colleagues|Deep|Have a longer, intentional 1:1 or strategy conversation with a key colleague

Social|Civic Contribution|Micro|Take 5–10 minutes to reflect on how your current work contributes to wider society
Social|Civic Contribution|Micro|Do one small act that makes life easier for someone outside your immediate family
Social|Civic Contribution|Standard|Spend 20–30 minutes improving something that has a small-scale public benefit (systems, safety, clarity)
Social|Civic Contribution|Standard|Reflect for 20–30 minutes on how your current role and choices serve the public good
Social|Civic Contribution|Deep|Do a 40–60 minute session on how to increase your positive impact via work / choices
Social|Civic Contribution|Deep|Plan or execute one concrete action with broader benefit (within your constraints)

Spiritual|Philosophy|Micro|Read or listen to 5–10 minutes of a philosophical / reflective text
Spiritual|Philosophy|Micro|Capture one small thought or question about life, meaning, or being human
Spiritual|Philosophy|Standard|Do a 20–30 minute reading + reflection block on philosophy or meaning
Spiritual|Philosophy|Standard|Use ChatGPT to explore a philosophical question and jot your own view
Spiritual|Philosophy|Deep|Do a 40–60 minute deep reading + reflection session on a big question
Spiritual|Philosophy|Deep|Work 40–60 minutes on integrating your philosophical views into your life principles

Spiritual|Virtue|Micro|Do one small deliberate act aligned with a virtue you value (kindness, courage, honesty, etc.)
Spiritual|Virtue|Micro|Spend 3–5 minutes reflecting on how you acted today vs. your core virtues
Spiritual|Virtue|Standard|Do a 20–30 minute review of your actions vs. your values this week
Spiritual|Virtue|Standard|Write about one situation where you want to respond more virtuously next time (20–30 mins)
Spiritual|Virtue|Deep|Do a 40–60 minute deep reflection on one virtue and how to live it more consistently
Spiritual|Virtue|Deep|Work 40–60 minutes on your “principles / virtues” document with concrete examples

Systems & Structure|Planning & Review|Micro|Do a 5–10 minute micro-review of today (wins, sticking points, next steps)
Systems & Structure|Planning & Review|Micro|Capture top 3 priorities for tomorrow
Systems & Structure|Planning & Review|Standard|Do a 20–30 minute weekly-style review (even if midweek)
Systems & Structure|Planning & Review|Standard|Plan the next 3–5 days with realistic tasks and protected blocks
Systems & Structure|Planning & Review|Deep|Do a full 45–60 minute weekly review + planning session
Systems & Structure|Planning & Review|Deep|Do a 45–60 minute monthly or bigger-picture planning session

Systems & Structure|Workflow & Systems Architecture|Micro|Do a 5–10 minute tidy or improvement to one small workflow (files, notes, shortcuts)
Systems & Structure|Workflow & Systems Architecture|Micro|Capture one friction point in your digital world and note a possible fix
Systems & Structure|Workflow & Systems Architecture|Standard|Do a 20–30 minute workflow improvement session (one system only)
Systems & Structure|Workflow & Systems Architecture|Standard|Document one process so it’s easier next time (20–30 mins)
Systems & Structure|Workflow & Systems Architecture|Deep|Do a 45–60 minute deep session redesigning or consolidating systems
Systems & Structure|Workflow & Systems Architecture|Deep|Do a 45–60 minute structured pass on one big area (e.g. photos, files, backups)

Systems & Structure|Cognitive Tools & Decision Frameworks|Micro|Apply one simple mental model to a current problem (and write 3–4 lines)
Systems & Structure|Cognitive Tools & Decision Frameworks|Micro|Capture one decision or thinking pattern you want to improve
Systems & Structure|Cognitive Tools & Decision Frameworks|Standard|Do a 20–30 minute session using a decision framework on a real issue
Systems & Structure|Cognitive Tools & Decision Frameworks|Standard|Review and refine one of your existing thinking templates (20–30 mins)
Systems & Structure|Cognitive Tools & Decision Frameworks|Deep|Do a 45–60 minute deep modelling session on a complex decision or scenario
Systems & Structure|Cognitive Tools & Decision Frameworks|Deep|Design or significantly refine a personal framework for recurring decisions

Systems & Structure|AI Utilisation & Delegation|Micro|Use ChatGPT for 5–10 minutes to offload a small task you’d otherwise do manually
Systems & Structure|AI Utilisation & Delegation|Micro|Capture one idea for how AI could simplify a recurring task
Systems & Structure|AI Utilisation & Delegation|Standard|Do a 20–30 minute session improving an existing ChatGPT workflow
Systems & Structure|AI Utilisation & Delegation|Standard|Create or refine one “expert team” style prompt for a specific area
Systems & Structure|AI Utilisation & Delegation|Deep|Do a 45–60 minute session building or tuning AI workflows across a project
Systems & Structure|AI Utilisation & Delegation|Deep|Do a 45–60 minute “AI delegation” audit: what else can you offload?

Systems & Structure|Boundaries & Time Governance|Micro|Do a 2–3 minute shutdown ritual (list, offload, close apps)
Systems & Structure|Boundaries & Time Governance|Micro|Deliberately log off from work / systems at a chosen time
Systems & Structure|Boundaries & Time Governance|Standard|Do a 20–30 minute review of your timeboxes and boundaries for the week
Systems & Structure|Boundaries & Time Governance|Standard|Adjust or tighten one boundary that’s causing leakage (20–30 mins)
Systems & Structure|Boundaries & Time Governance|Deep|Do a 45–60 minute review of how you’re spending time across domains
Systems & Structure|Boundaries & Time Governance|Deep|Redesign your default weekly template / guardrails (45–60 mins)
`;

  function hasAnyTemplates(state) {
    if (!state || !state.templates) return false;
    const t = state.templates;
    for (const dKey of Object.keys(t)) {
      const subMap = t[dKey];
      if (!subMap) continue;
      for (const sKey of Object.keys(subMap)) {
        const block = subMap[sKey];
        if (!block) continue;
        if ((block.micro && block.micro.length) ||
            (block.standard && block.standard.length) ||
            (block.deep && block.deep.length)) {
          return true;
        }
      }
    }
    return false;
  }

  async function seedTemplatesFromRaw() {
    const state = window.LWEngine.getState();
    const domains = window.LWEngine.getDomains();
    if (!domains || !domains.length) return;

    // Don’t overwrite if anything already exists
    if (hasAnyTemplates(state)) {
      console.log("[LifeWheel] Task templates already present – seeding skipped.");
      return;
    }

    const parsed = {};

    RAW_TASKS.split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const parts = line.split("|");
        if (parts.length < 4) return;
        const [domainName, subName, difficultyRaw, label] = parts.map(p => p.trim());
        const diff = difficultyRaw.toLowerCase();
        if (diff !== "micro" && diff !== "standard" && diff !== "deep") return;

        if (!parsed[domainName]) parsed[domainName] = {};
        if (!parsed[domainName][subName]) {
          parsed[domainName][subName] = { micro: [], standard: [], deep: [] };
        }
        parsed[domainName][subName][diff].push(label);
      });

    for (const domainName of Object.keys(parsed)) {
      const dIdx = domains.findIndex(d => d.name === domainName);
      if (dIdx === -1) {
        console.warn("[LifeWheel] Unknown domain in RAW_TASKS:", domainName);
        continue;
      }
      const dom = domains[dIdx];
      const subMap = parsed[domainName];

      for (const subName of Object.keys(subMap)) {
        const sIdx = dom.sub.indexOf(subName);
        if (sIdx === -1) {
          console.warn("[LifeWheel] Unknown subdomain in RAW_TASKS:", domainName, "→", subName);
          continue;
        }
        const block = subMap[subName];
        await window.LWEngine.updateTaskTemplateBlock(dIdx, sIdx, "micro", block.micro);
        await window.LWEngine.updateTaskTemplateBlock(dIdx, sIdx, "standard", block.standard);
        await window.LWEngine.updateTaskTemplateBlock(dIdx, sIdx, "deep", block.deep);
      }
    }

    console.log("[LifeWheel] Seeded task templates from RAW_TASKS.");
  }

  // Wrap init so seeding happens *after* state is loaded but *before* UI uses templates
  window.LWEngine.init = async function () {
    await ORIGINAL_INIT();
    await seedTemplatesFromRaw();
  };

})(window);