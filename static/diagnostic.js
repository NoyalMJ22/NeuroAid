document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startDiagnostic");
  const diagPage = document.getElementById("diagnosticPage");
  const diagContent = document.getElementById("diagnosticContent");
  const nextBtn = document.getElementById("nextQuestion");

  let current = 0;
  let score = 0;

  const questions = [
    {
      q: "Which letter do you see?",
      options: ["b","d","p","q"],
      answer: "b"
    },
    {
      q: "Listen to this word and choose the missing sound.",
      audio: "cat",
      options: ["c","b","m"],
      answer: "c"
    },
    {
      q: "Which word is spelled correctly?",
      options: ["beleve","believe","beleev"],
      answer: "believe"
    },
    {
      q: "Remember this number sequence: 142",
      input: true,
      answer: "142"
    }
  ];

  function showQuestion() {
    const q = questions[current];
    diagContent.innerHTML = `<h3>${q.q}</h3>`;
    if(q.audio) {
      let btn = document.createElement("button");
      btn.textContent = "🔊 Play";
      btn.onclick = () => speechSynthesis.speak(new SpeechSynthesisUtterance(q.audio));
      diagContent.appendChild(btn);
    }
    if(q.input) {
      diagContent.innerHTML += `<input type="text" id="userInput">`;
    } else {
      q.options.forEach(opt=>{
        let btn = document.createElement("button");
        btn.textContent = opt;
        btn.onclick = ()=>checkAnswer(opt);
        diagContent.appendChild(btn);
      });
    }
  }

  function checkAnswer(ans) {
    const q = questions[current];
    if(ans === q.answer) score++;
    nextBtn.classList.remove("hidden");
  }

  nextBtn.addEventListener("click", () => {
    if(questions[current].input) {
      const val = document.getElementById("userInput").value.trim();
      if(val === questions[current].answer) score++;
    }
    current++;
    nextBtn.classList.add("hidden");
    if(current < questions.length) {
      showQuestion();
    } else {
      diagContent.innerHTML = `<h3>Test Complete!</h3>
        <p>Your score: ${score}/${questions.length}</p>
        <p>${score >= 3 ? "👍 Low risk of dyslexia." : "⚠️ Some signs of difficulty. Consider professional evaluation."}</p>`;
    }
  });

  startBtn.addEventListener("click", () => {
    document.getElementById("diagnosticIntro").classList.add("hidden");
    diagPage.classList.remove("hidden");
    showQuestion();
  });
});
