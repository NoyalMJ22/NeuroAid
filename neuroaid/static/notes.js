async function refreshNotes() {
  const r = await fetch("/api/notes"); const list = await r.json();
  const root = document.getElementById("notesList"); root.innerHTML="";
  list.forEach(n=>{
    const div=document.createElement('div'); div.className='note';
    if (n.kind==='audio') {
      div.innerHTML = `<b>Audio</b> <audio controls src="${n.content}"></audio>
        <button data-id="${n.id}">Delete</button>`;
    } else {
      div.innerHTML = `<b>Text</b> ${n.content}
        <button data-id="${n.id}">Delete</button>`;
    }
    div.querySelector('button').onclick=async (e)=>{
      await fetch("/api/notes?id="+n.id, {method:"DELETE"});
      refreshNotes();
    };
    root.appendChild(div);
  });
}

document.getElementById("addText").onclick = async ()=>{
  const val = document.getElementById("noteText").value.trim();
  if (!val) return;
  await fetch("/api/notes", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({kind:"text", content: val})});
  document.getElementById("noteText").value = "";
  refreshNotes();
};

// Audio recording (MediaRecorder)
let media, chunks=[], rec;
const recBtn = document.getElementById("recBtn");
const stopBtn = document.getElementById("stopRecBtn");

recBtn.onclick = async ()=>{
  try {
    media = await navigator.mediaDevices.getUserMedia({audio:true});
    rec = new MediaRecorder(media);
    chunks=[]; rec.ondataavailable = e=> chunks.push(e.data);
    rec.onstop = async ()=>{
      const blob = new Blob(chunks, {type:"audio/webm"});
      const url = URL.createObjectURL(blob);
      await fetch("/api/notes", {method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({kind:"audio", content: url})});
      refreshNotes();
    };
    rec.start();
    recBtn.disabled = true; stopBtn.disabled = false; recBtn.textContent="Recording…";
  } catch(e){ alert("Mic permission needed."); }
};
stopBtn.onclick = ()=>{
  rec?.stop(); recBtn.disabled=false; stopBtn.disabled=true; recBtn.textContent="● Start Recording";
};

refreshNotes();
