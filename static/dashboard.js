async function load() {
  const r = await fetch("/api/progress"); const data = await r.json();
  document.getElementById("xp").textContent = data.xp;
  const b = document.getElementById("badges"); b.innerHTML="";
  (data.badges||[]).forEach(x=>{
    const s=document.createElement('span'); s.className='badge'; s.textContent=x; b.appendChild(s);
  });
  const rec = document.getElementById("recent"); rec.innerHTML="";
  (data.assessments||[]).forEach(a=>{
    const d=document.createElement('div'); d.className='output';
    d.innerHTML = `<b>${a.dominantType||a.game||'entry'}</b> — ${a.riskLevel||''} <br>
      <small>${a.timestamp||''}</small>`;
    rec.appendChild(d);
  });
}
load();
