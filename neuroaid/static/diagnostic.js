"use strict";

// ---------- Checklist ----------
const checklistData = [
  "Has difficulty reading unfamiliar words and often guesses at them.",
  "Pauses, repeats or makes frequent mistakes when reading aloud.",
  "Mispronounces certain words (e.g., says 'amunul' for animal).",
  "Struggles to understand what he or she has read.",
  "Doesn't like to read for fun.",
  "Makes frequent spelling errors.",
  "Has messy handwriting.",
  "Has trouble with punctuation and capitalization.",
  "Resists writing tasks.",
  "Becomes frustrated or angry when doing school work.",
  "Has a blood relative with a history of reading, spelling, or writing problems."
];

// ---------- Tasks ----------
const taskData = [
  { type:"phonological", question:"Select the word that matches the sound 'blib'.",
    options:["blib","blid","blob","blip"], answer:"blib" },
  { type:"surface", question:"Which of these is spelled correctly for the word pronounced 'yot'?",
    options:["yot","yacht","yaught","yach"], answer:"yacht" },
  { type:"visual", question:"Read the scrambled text: 'Tihs snetecne is srcmabled.'",
    options:["This sentence is scrambled.","This sentence is scrumbled.","This sentance is scrambled.","This sentence is scrembled."],
    answer:"This sentence is scrambled." },
  { type:"auditory", question:"Listen to the numbers and repeat them: '7, 4, 2'.",
    voiceOnly:true, answer:"7 4 2" }
];

let currentQuestion = 0, mode = "checklist";
let checklistYesCount = 0;
let scores = { phonological:0, surface:0, visual:0, auditory:0 };
let reactionTimes = [], startTime = Date.now();

function renderQuestion() {
  const c = document.getElementById("quiz-container");
  c.innerHTML = "";
  if (mode === "checklist") {
    if (currentQuestion < checklistData.length) {
      const div = document.createElement("div");
      div.className = "question";
      div.innerHTML = `<p>${checklistData[currentQuestion]}</p>
        <label><input type="radio" name="check${currentQuestion}" value="yes"> Yes</label>
        <label><input type="radio" name="check${currentQuestion}" value="no"> No</label>`;
      c.appendChild(div);
    } else {
      mode = "tasks"; currentQuestion = 0; renderQuestion(); return;
    }
  } else {
    if (currentQuestion < taskData.length) {
      const q = taskData[currentQuestion];
      const div = document.createElement("div"); div.className="question";
      div.innerHTML = `<p>${q.question}</p>`;
      if (!q.voiceOnly) {
        const opts = document.createElement("div"); opts.className="options";
        q.options.forEach(opt=>{
          const label = document.createElement("label");
          const input = document.createElement("input");
          input.type="radio"; input.name="task"+currentQuestion; input.value=opt;
          label.appendChild(input); label.appendChild(document.createTextNode(" "+opt));
          opts.appendChild(label);
        });
        div.appendChild(opts);
      } else {
        const btn = document.createElement("button");
        btn.textContent = "▶ Play Audio"; btn.onclick = ()=> speak(q.answer);
        div.appendChild(btn);
      }
      c.appendChild(div); startTime = Date.now();
    } else { showResults(); return; }
  }
  updateProgress();
}
function updateProgress() {
  const total = checklistData.length + taskData.length;
  const completed = (mode === "checklist") ? currentQuestion : checklistData.length + currentQuestion;
  document.getElementById("progress-fill").style.width = (completed/total*100) + "%";
}

document.getElementById("next-btn").addEventListener("click", ()=>{
  if (mode === "checklist") {
    const sel = document.querySelector(`input[name="check${currentQuestion}"]:checked`);
    if (sel && sel.value === "yes") checklistYesCount++;
    currentQuestion++; renderQuestion();
  } else {
    const q = taskData[currentQuestion];
    const sel = document.querySelector(`input[name="task${currentQuestion}"]:checked`);
    const elapsed = Date.now() - startTime; reactionTimes.push(elapsed);
    if (sel && sel.value === q.answer) scores[q.type]++;
    currentQuestion++; renderQuestion();
  }
});
document.getElementById("prev-btn").addEventListener("click", ()=>{
  if (currentQuestion>0) { currentQuestion--; renderQuestion(); }
});

function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}

document.getElementById("voice-btn").addEventListener("click", ()=>{
  const rec = new (window.SpeechRecognition||window.webkitSpeechRecognition)();
  rec.lang="en-US";
  rec.onresult=e=>{
    const transcript = e.results[0][0].transcript.trim();
    const q = taskData[currentQuestion];
    if (q?.voiceOnly && transcript === q.answer) scores[q.type]++;
    alert("You said: " + transcript);
  };
  rec.start();
});

async function showResults() {
  const r = await fetch("/api/diagnostic_score", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({scores, reactionTimes, checklistYesCount})
  });
  const data = await r.json();

  // save assessment
  await fetch("/api/save_assessment", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({scores, reactionTimes, checklistYesCount,
      riskLevel:data.riskLevel, dominantType:data.dominantType, avgTime:data.avgTime})
  });

  document.getElementById("quiz-container").innerHTML="";
  ["next-btn","prev-btn","voice-btn"].forEach(id=>document.getElementById(id).style.display="none");
  const res = document.getElementById("results"); res.style.display="block";
  res.innerHTML = `
    <h3>Assessment Results</h3>
    <h4>Checklist Risk: ${data.riskLevel}</h4>
    <p><b>Phonological:</b> ${scores.phonological} |
       <b>Surface:</b> ${scores.surface} |
       <b>Visual:</b> ${scores.visual} |
       <b>Auditory:</b> ${scores.auditory}</p>
    <p><b>Average Reaction Time:</b> ${data.avgTime}s</p>
    <h4>Most Likely Profile: ${data.dominantType.charAt(0).toUpperCase()+data.dominantType.slice(1)}</h4>
    <p><b>Suggested Actions:</b> ${data.tips}</p>
    <p style="margin-top:8px">Progress updated! Check your <a href="/dashboard">Dashboard</a>.</p>
  `;
}
renderQuestion();
