/* dyslexia.js
   Updated: 
   - Scrambled words continuously reshuffle (each tick different arrangement).
   - Spacebar won't trigger TTS when typing inside the input box.
   - Voice select dropdown now functional.
*/

(function(){
  // ----- helpers -----
  const api = {
    getPrefs: () => fetch('/api/preferences').then(r=>r.json()).catch(()=>({})),
    savePrefs: (p) => fetch('/api/preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).then(r=>r.json()).catch(()=>({}))
  };

  function byId(id){ return document.getElementById(id); }
  function vibrate(ms){ if(navigator.vibrate) navigator.vibrate(ms); }

  // ----- elements -----
  const textInput = byId('text-input');
  const scrambled = byId('scrambled-text');
  const original = byId('original-text');
  const readOut = byId('read-aloud');
  const fontControl = byId('fontSize');
  const lineControl = byId('lineHeight');
  const rateControl = byId('rate');
  const rulerToggle = byId('rulerToggle');
  const voiceSelect = byId('voiceSelect');
  const speakBtn = byId('speakBtn');
  const stopBtn = byId('stopSpeakBtn');
  const savePrefsBtn = byId('savePrefs');

  // ----- preferences -----
  async function applyPrefs(p){
    if(!p) p = {};
    if(fontControl) fontControl.value = p.fontSize || 18;
    if(lineControl) lineControl.value = p.lineHeight || 1.8;
    if(rateControl) rateControl.value = p.ttsRate || 1.0;
    if(textInput){
      textInput.style.fontSize = (p.fontSize || 18) + 'px';
      textInput.style.lineHeight = (p.lineHeight || 1.8);
      textInput.style.letterSpacing = p.letterSpacing || '0.2px';
      if(p.dyslexicFont === 'on'){
        textInput.classList.add('dyslexia-font');
      } else {
        textInput.classList.remove('dyslexia-font');
      }
    }
    if(document.body) document.body.style.background = p.bg || '#f7fafc';
  }

  async function loadPrefs(){
    const p = await api.getPrefs();
    applyPrefs(p);
  }

  // ----- scrambling -----
  function scrambleWord(word){
    if(!word || word.length <= 3) return word;
    const arr = word.split('');
    for(let i=1;i<arr.length-1;i++){
      if(Math.random() > 0.5){
        const j = 1 + Math.floor(Math.random()*(arr.length-2));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    return arr.join('');
  }
  let jumbleIntervalId = null;
  function startContinuousScrambling(sourceText){
    if(!scrambled || !original) return;
    const words = sourceText.trim().split(/\s+/);
    original.textContent = sourceText;
    if(jumbleIntervalId) clearInterval(jumbleIntervalId);
    jumbleIntervalId = setInterval(()=>{
      scrambled.textContent = words.map(w => scrambleWord(w)).join(' ');
    }, 500);
  }

  // ----- TTS highlight -----
  let highlightTimer = null;
  function clearHighlighting(){
    if(highlightTimer) { clearInterval(highlightTimer); highlightTimer = null; }
    if(readOut) readOut.innerHTML = '';
  }

  function highlightByTimer(text, wpm=150){
    clearHighlighting();
    const words = text.trim().split(/\s+/);
    readOut.innerHTML = '';
    words.forEach((w,i)=>{
      const sp = document.createElement('span'); sp.id = 'rw-'+i; sp.textContent = w + ' '; readOut.appendChild(sp);
    });
    let i = 0;
    const interval = (60 / wpm) * 1000;
    highlightTimer = setInterval(()=>{
      if(i>0) document.getElementById('rw-'+(i-1))?.style.removeProperty('background');
      if(i < words.length){
        const el = document.getElementById('rw-'+i);
        if(el) el.style.background = 'yellow';
        i++;
      } else {
        clearHighlighting();
      }
    }, interval);
  }

  function speakAndHighlight(text, rate=1.0, voice=null){
    if(!('speechSynthesis' in window)) {
      highlightByTimer(text, Math.round(150*rate));
      return;
    }
    window.speechSynthesis.cancel();
    clearHighlighting();
    const ut = new SpeechSynthesisUtterance(text);
    ut.rate = rate;
    if(voice) ut.voice = voice;

    ut.onboundary = function(evt){
      if(evt.name === "word" || evt.charIndex !== undefined){
        const i = text.slice(0, evt.charIndex).trim().split(/\s+/).length - 1;
        for(let j = Math.max(0,i-2); j < i+2; j++){
          const e = document.getElementById('rw-'+j);
          if(e) e.style.removeProperty('background');
        }
        const cur = document.getElementById('rw-'+i);
        if(cur) cur.style.background = 'yellow';
      }
    };
    ut.onend = function(){ clearHighlighting(); };

    // prepare spans
    readOut.innerHTML = '';
    text.trim().split(/\s+/).forEach((w,i)=>{
      const sp = document.createElement('span'); sp.id = 'rw-'+i; sp.textContent = w + ' '; readOut.appendChild(sp);
    });

    window.speechSynthesis.speak(ut);

    // fallback if boundary not firing
    setTimeout(()=> {
      if(!ut.onboundary) highlightByTimer(text, Math.round(150*rate));
    }, 300);
  }

  // ----- voices -----
  function populateVoices(){
    if(!voiceSelect) return;
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach((v,i)=>{
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = v.name + (v.lang ? ` (${v.lang})` : '');
      voiceSelect.appendChild(opt);
    });
  }
  if('speechSynthesis' in window){
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  // ----- keyboard nav -----
  function initKeyboardNavigation(){
    document.addEventListener('keydown', (ev)=>{
      if(ev.target.tagName === "TEXTAREA" || ev.target.tagName === "INPUT") return; // don't trigger inside typing
      if(ev.key === 'ArrowRight' || ev.key === 'ArrowDown'){
        byId('next-btn')?.click();
        ev.preventDefault();
      } else if(ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'){
        byId('prev-btn')?.click();
        ev.preventDefault();
      } else if(ev.key === ' '){
        speakBtn?.click();
        ev.preventDefault();
      }
    });
  }

  // ----- wire UI -----
  function wire() {
    if(textInput){
      textInput.addEventListener('input', ()=> startContinuousScrambling(textInput.value));
      if(textInput.value) startContinuousScrambling(textInput.value);
    }
    if(speakBtn) speakBtn.addEventListener('click', ()=>{
      const text = (textInput && textInput.value) || original.textContent || "";
      const rate = rateControl ? parseFloat(rateControl.value) : 1.0;
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices[voiceSelect?.value] || null;
      speakAndHighlight(text, rate, selectedVoice);
    });
    if(stopBtn) stopBtn.addEventListener('click', ()=> { window.speechSynthesis.cancel(); clearHighlighting(); });
    if(savePrefsBtn) savePrefsBtn.addEventListener('click', async ()=>{
      const prefs = {
        fontSize: parseInt(fontControl?.value || 18),
        lineHeight: parseFloat(lineControl?.value || 1.8),
        ttsRate: parseFloat(rateControl?.value || 1.0),
        dyslexicFont: document.body.classList.contains('dyslexia-font') ? 'on' : 'off'
      };
      await api.savePrefs(prefs);
      applyPrefs(prefs);
      vibrate(40);
      alert('Preferences saved');
    });
    if(rulerToggle){
      rulerToggle.addEventListener('change', (e)=> enableLineFocus(e.target.checked));
    }
    initKeyboardNavigation();
    populateVoices();
  }

  // ----- init -----
  document.addEventListener('DOMContentLoaded', async ()=>{
    loadPrefs();
    wire();
  });

})();
