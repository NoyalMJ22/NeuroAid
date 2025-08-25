document.addEventListener("DOMContentLoaded", () => {
  const speakBtn = document.getElementById("speakBtn");
  const voiceSelect = document.getElementById("voiceSelect");
  const readerInput = document.getElementById("readerInput");

  // Load available voices
  function loadVoices() {
    voiceSelect.innerHTML = "";
    const voices = speechSynthesis.getVoices();
    voices.forEach(v => {
      const option = document.createElement("option");
      option.value = v.name;
      option.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(option);
    });
  }
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  // Speak text
  speakBtn.addEventListener("click", () => {
    const text = readerInput.value.trim();
    if(!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    const selectedVoice = voiceSelect.value;
    const voice = speechSynthesis.getVoices().find(v => v.name === selectedVoice);
    if(voice) utter.voice = voice;
    speechSynthesis.speak(utter);
  });
});
