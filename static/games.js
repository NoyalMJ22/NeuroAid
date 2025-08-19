/* games.js
    Implements:
    - Phonics Karaoke
    - Sight-Word Flash
    - Flash Naming Race
    - Sound->Word Sprint
    - Word Puzzle Builder (drag & drop)
    - Sound Blend Builder
    - Read & Tap Quiz
    - Calm Story Quiz
    - Word-Picture Match
*/

(function () {
    // ---------- utilities ----------
    function $(id) { return document.getElementById(id); }
    function randInt(n) { return Math.floor(Math.random() * n); }
    function playText(t, rate = 1) {
        if ('speechSynthesis' in window) {
            let u = new SpeechSynthesisUtterance(t);
            u.rate = rate;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
        }
    }
    function postResult(obj) {
        navigator.sendBeacon ? navigator.sendBeacon('/api/save_assessment', JSON.stringify(obj)) : fetch('/api/save_assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }).catch(() => { });
    }

    // ---------- tab switching ----------
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const g = tab.dataset.game;
            document.querySelectorAll('[id^="game-"]').forEach(el => el.classList.add('hidden'));
            const sel = document.getElementById('game-' + g);
            if (sel) sel.classList.remove('hidden');
        });
    });

    // ---------- PHONICS KARAOKE ----------
    const phonicsSets = {
        cvc: ["cat", "dog", "sun", "hat", "pig", "bed"],
        sent: ["The dog runs.", "I see a red car.", "The fish swims.", "She is happy."],
        rhyme: ["The cat wears a hat.", "The frog sits on a log.", "The mouse is in the house."]
    };
    $('phonics-start').addEventListener('click', () => {
        const level = $('phonics-level').value;
        const items = phonicsSets[level].slice();
        let score = 0;
        const area = $('phonics-area');
        area.innerHTML = '';
        const next = () => {
            if (!items.length) {
                area.innerHTML += `<div class="score">Round finished — score: ${score}</div>`;
                postResult({ kind: 'game', game: 'phonics', score, timestamp: Date.now() });
                return;
            }
            const text = items.shift();
            // show text word-by-word highlight
            area.innerHTML = `<div style="font-size:1.25rem"><strong>${text}</strong></div><div style="margin-top:8px">Say the highlighted word when prompted.</div>`;
            playText(text, 0.95);
            // highlight each word sequentially and prompt STT
            const words = text.split(/\s+/);
            let i = 0;
            const speakNext = () => {
                if (i >= words.length) { setTimeout(next, 700); return; }
                const w = words[i];
                // highlight via re-render
                area.innerHTML = `<div style="font-size:1.25rem">${words.map((x, idx) => idx === i ? '<span style="background:yellow;border-radius:4px;padding:2px">' + x + '</span>' : x).join(' ')}</div>`;
                // prompt user to say word — use STT if available
                if (window.SpeechRecognition || window.webkitSpeechRecognition) {
                    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const r = new Rec();
                    r.lang = 'en-US';
                    let heard = false;
                    r.onresult = (ev) => {
                        const t = ev.results[0][0].transcript.trim().toLowerCase();
                        if (t === w.toLowerCase()) {
                            area.innerHTML += `<div style="color:green">✅ Correct: "${t}"</div>`;
                            score += 1;
                        } else {
                            area.innerHTML += `<div style="color:red">❌ Heard: "${t}". Try again later.</div>`;
                        }
                        r.stop();
                        i++;
                        setTimeout(speakNext, 700);
                    };
                    r.onerror = () => { area.innerHTML += `<div style="color:orange">(Speech recognition unavailable — you can still practice by listening)</div>`; i++; setTimeout(speakNext, 900); };
                    try { r.start(); } catch (e) { i++; setTimeout(speakNext, 900); }
                } else {
                    // no STT: just speak the word and proceed
                    area.innerHTML += `<div style="color:gray">(No speech recognition — listen and repeat)</div>`;
                    setTimeout(() => { playText(w); i++; speakNext(); }, 1200);
                }
            };
            setTimeout(speakNext, 700);
        };
        next();
    });

    // ---------- SIGHT-WORD FLASH ----------
    const sightList = ["said", "yacht", "colonel", "enough", "one", "their", "island", "could", "would", "two"];
    $('sight-start').addEventListener('click', () => {
        const area = $('sight-area');
        area.innerHTML = '';
        let score = 0;
        const speed = Math.max(300, parseInt($('sight-speed').value || 1200, 10));
        let remainingWords = sightList.slice();
        const next = () => {
            if (!remainingWords.length) {
                area.innerHTML += `<div class="score">Finished — score ${score}</div>`;
                postResult({ kind: 'game', game: 'sight', score, timestamp: Date.now() });
                return;
            }
            const word = remainingWords[randInt(remainingWords.length)];
            area.innerHTML = `<div style="font-size:2rem; font-weight:800; text-align:center">${word}</div>`;
            setTimeout(() => {
                // show options
                const opts = [word];
                while (opts.length < 3) {
                    const pick = sightList[randInt(sightList.length)];
                    if (!opts.includes(pick)) opts.push(pick);
                }
                opts.sort(() => Math.random() - 0.5);
                area.innerHTML = opts.map(o => `<button class="option" data-word="${o}">${o}</button>`).join(' ');
                area.querySelectorAll('.option').forEach(btn => {
                    btn.onclick = () => {
                        if (btn.dataset.word === word) {
                            score++;
                            btn.style.background = '#9ae6b4';
                            playText('Correct');
                            const indexToRemove = remainingWords.indexOf(word);
                            if (indexToRemove > -1) {
                                remainingWords.splice(indexToRemove, 1);
                            }
                        } else {
                            btn.style.background = '#fed7d7';
                            playText('Try again');
                        }
                        setTimeout(next, 800);
                    };
                });
            }, speed);
        };
        next();
    });

    // ---------- FLASH NAMING RACE ----------
    $('naming-start').addEventListener('click', async () => {
        const area = $('naming-area');
        area.innerHTML = '';
        let score = 0;
        const count = parseInt($('naming-count').value || 8, 10);
        // build simple pool: letters colors numbers animals words
        const pool = ['A', 'B', 'C', 'D', 'red', 'blue', 'green', '7', '12', 'dog', 'cat', 'car', 'sun', 'book', 'ball'];
        let items = Array.from({ length: count }, () => pool[randInt(pool.length)]);
        // start timer shrinking bar per item
        let i = 0;
        const nextItem = () => {
            if (i >= items.length) {
                area.innerHTML += `<div class="score">Round done — ${score}/${items.length}</div>`;
                postResult({ kind: 'game', game: 'naming', score, timestamp: Date.now() });
                return;
            }
            const it = items[i];
            area.innerHTML = `<div style="font-size:2rem;font-weight:800">${typeof it === 'string' ? it : it}</div><div style="margin-top:8px">Say it now...</div>`;
            // use STT
            if (window.SpeechRecognition || window.webkitSpeechRecognition) {
                const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
                const r = new Rec();
                r.lang = 'en-US';
                r.interimResults = false;
                let heard = false;
                r.onresult = (ev) => {
                    const t = ev.results[0][0].transcript.trim().toLowerCase();
                    if (t === String(it).toLowerCase()) {
                        score++;
                        area.innerHTML += `<div style="color:green">✅ ${t}</div>`;
                    } else {
                        area.innerHTML += `<div style="color:red">❌ ${t}</div>`;
                    }
                    r.stop();
                    i++;
                    setTimeout(nextItem, 600);
                };
                r.onerror = () => {
                    area.innerHTML += `<div style="color:orange">(Recognition error) Move on.</div>`;
                    i++;
                    setTimeout(nextItem, 600);
                };
                try { r.start(); } catch (e) { i++; setTimeout(nextItem, 600); }
            } else {
                // fallback: text input prompt
                area.innerHTML += `<div><input id="naming-fallback" placeholder="Type what you see" /><button id="naming-sub">Submit</button></div>`;
                $('naming-sub').onclick = () => {
                    const v = $('naming-fallback').value.trim().toLowerCase();
                    if (v === String(it).toLowerCase()) score++;
                    i++;
                    nextItem();
                };
            }
        };
        nextItem();
    });

    // ---------- SOUND -> WORD SPRINT ----------
    const soundwordPool = [
        { sound: 'm', label: 'm', picture: '🐵', answer: 'monkey' },
        { sound: 's', label: 's', picture: '🐍', answer: 'snake' },
        { sound: 'cat', label: 'cat', picture: '🐱', answer: 'cat' },
        { sound: 'sun', label: 'sun', picture: '🌞', answer: 'sun' },
    ];
    $('soundword-start').addEventListener('click', () => {
        const area = $('soundword-area');
        area.innerHTML = '';
        let score = 0;
        const timerSec = Math.max(1, parseInt($('soundword-timer').value || 3, 10));
        let pool = soundwordPool.slice();

        const next = () => {
            if (!pool.length) {
                area.innerHTML += `<div class="score">Finished — ${score}</div>`;
                postResult({ kind: 'game', game: 'soundword', score, timestamp: Date.now() });
                return;
            }
            const item = pool.splice(randInt(pool.length), 1)[0];
            playText(item.label, 0.95);

            // show options
            const choices = [item.answer];
            const extras = ['dog', 'car', 'tree', 'ball', 'apple', 'fish'];
            while (choices.length < 4) {
                const p = extras[randInt(extras.length)];
                if (!choices.includes(p)) choices.push(p);
            }
            choices.sort(() => Math.random() - 0.5);

            area.innerHTML = `<div style="font-size:1.4rem;margin-bottom:8px">Select the option that matches the sound</div>` + choices.map(c => `<button class="option">${c}</button>`).join(' ');

            area.querySelectorAll('.option').forEach(btn => {
                btn.onclick = () => {
                    if (btn.textContent === item.answer) {
                        score++;
                        btn.style.background = '#9ae6b4';
                        playText('Correct!');
                    } else {
                        btn.style.background = '#fed7d7';
                        playText('Incorrect');
                    }
                    setTimeout(next, 1000);
                };
            });
            // small countdown visual (not blocking)
            let t = timerSec * 10;
            const bar = document.createElement('div');
            bar.style.height = '6px';
            bar.style.background = '#cbd5e0';
            bar.style.marginTop = '8px';
            const fill = document.createElement('div');
            fill.style.height = '100%';
            fill.style.background = '#48bb78';
            fill.style.width = '100%';
            bar.appendChild(fill);
            area.appendChild(bar);
            const interval = setInterval(() => {
                t--;
                fill.style.width = (t / (timerSec * 10) * 100) + '%';
                if (t <= 0) {
                    clearInterval(interval);
                    area.innerHTML += `<div style="color:orange">Time up!</div>`;
                    setTimeout(next, 600);
                }
            }, 100);
        };
        next();
    });

    // ---------- WORD PUZZLE BUILDER (drag & drop) ----------
    const puzzleSets = {
        easy: ['cat', 'dog', 'sun', 'hat', 'fish'],
        medium: ['house', 'paper', 'friend', 'school', 'basket']
    };
    $('puzzle-start').addEventListener('click', () => {
        const area = $('puzzle-area');
        area.innerHTML = '';
        let score = 0;
        const diff = $('puzzle-diff').value || 'easy';
        const pool = puzzleSets[diff].slice();
        const word = pool[randInt(pool.length)];
        
        // shuffle letters
        const letters = word.split('').sort(() => Math.random() - 0.5);
        area.innerHTML = `
            <div class="explanation">Drag the letters to build the word.</div>
            <div class="row">
              <button id="puzzle-audio" class="button dyslexia-button">🔊 Hear Word</button>
            </div>
            <div id="puzzle-target" class="row"></div>
            <div id="puzzle-letters" class="tiles"></div>
            <div class="row">
              <button id="puzzle-check" class="button dyslexia-button">Check</button>
              <button id="puzzle-reset" class="button math-button">Reset</button>
            </div>
        `;
        playText(word, 0.95);
        const lettersEl = $('puzzle-letters');
        letters.forEach((l, idx) => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.draggable = true;
            tile.id = 'p-t-' + idx;
            tile.textContent = l;
            tile.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/plain', tile.id));
            lettersEl.appendChild(tile);
        });
        const target = $('puzzle-target');
        // create slots
        target.innerHTML = '';
        for (let i = 0; i < word.length; i++) {
            const slot = document.createElement('div');
            slot.className = 'drag-slot';
            slot.dataset.index = i;
            slot.id = 'slot-' + i;
            slot.addEventListener('dragover', (e) => e.preventDefault());
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                const dragged = document.getElementById(id);
                if (!dragged) return;
                // move tile into slot
                if (slot.children.length === 0) {
                    slot.appendChild(dragged);
                }
            });
            target.appendChild(slot);
        }
        $('puzzle-audio').onclick = () => playText(word, 0.95);
        $('puzzle-check').onclick = () => {
            const built = Array.from(target.children).map(s => s.textContent || '').join('');
            if (built === word) {
                $('puzzle-score').textContent = 'Correct! +1';
                $('puzzle-score').style.color = 'green';
                postResult({ kind: 'game', game: 'puzzle', score: 1, timestamp: Date.now() });
            } else {
                $('puzzle-score').textContent = 'Not yet — try again.';
                $('puzzle-score').style.color = 'red';
            }
        };
        $('puzzle-reset').onclick = () => {
            // Restore letters to the tile pool
            Array.from(target.children).forEach(slot => {
                if (slot.children.length > 0) {
                    const tile = slot.children[0];
                    lettersEl.appendChild(tile);
                }
            });
            // Clear slots
            target.innerHTML = '';
            for (let i = 0; i < word.length; i++) {
                const slot = document.createElement('div');
                slot.className = 'drag-slot';
                slot.dataset.index = i;
                slot.id = 'slot-' + i;
                slot.addEventListener('dragover', (e) => e.preventDefault());
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    const dragged = document.getElementById(id);
                    if (!dragged) return;
                    if (slot.children.length === 0) {
                        slot.appendChild(dragged);
                    }
                });
                target.appendChild(slot);
            }
            $('puzzle-score').textContent = '';
            $('puzzle-letters').style.display = 'flex';
        };
    });

    // ---------- SOUND BLEND BUILDER ----------
    const blendSets = [
        { tiles: ['s', 'h', 'i', 'p'], answer: 'ship' },
        { tiles: ['c', 'a', 't'], answer: 'cat' },
        { tiles: ['f', 'r', 'o', 'g'], answer: 'frog' },
    ];
    $('blend-start').addEventListener('click', () => {
        const area = $('blend-area');
        area.innerHTML = '';
        const item = blendSets[randInt(blendSets.length)];
        const tiles = item.tiles.slice().sort(() => Math.random() - 0.5);
        area.innerHTML = tiles.map((t, i) => `<button class="tile" data-letter="${t}" id="b-${i}">${t}</button>`).join('') + '<div style="margin-top:8px"><button id="blend-check" class="button math-button">Check</button></div>';
        let seq = [];
        area.querySelectorAll('.tile').forEach(btn => btn.onclick = () => {
            seq.push(btn.dataset.letter);
            btn.style.opacity = 0.6;
            playText(btn.dataset.letter); // Play sound on tap
        });
        $('blend-check').onclick = () => {
            const built = seq.join('');
            if (built === item.answer) {
                $('blend-score').textContent = 'Correct!';
                playText('Correct!');
                postResult({ kind: 'game', game: 'blend', score: 1, timestamp: Date.now() });
            } else {
                $('blend-score').textContent = `Try again — you built "${built}"`;
                playText('Try again');
            }
        };
        playText(item.answer, 0.95);
    });

    // ---------- READ & TAP QUIZ (comprehension) ----------
    const readTapSets = [
        { story: "The cat is black.", q: [{ q: "What color is the cat?", opts: ["black", "white", "red"], a: 0 }] },
        { story: "A boy runs fast.", q: [{ q: "Who runs fast?", opts: ["boy", "girl", "dog"], a: 0 }] },
        { story: "Sam has a kite. It is blue.", q: [{ q: "What does Sam have?", opts: ["kite", "ball", "bat"], a: 0 }, { q: "What color is the kite?", opts: ["red", "blue", "green"], a: 1 }] }
    ];
    function renderReadTapSet(set) {
        const area = $('readtap-area');
        area.innerHTML = '';
        area.innerHTML = `<div style="font-size:1.15rem;background:#f7fafc;padding:10px;border-radius:8px">${set.story}</div>`;
        playText(set.story, 0.95);
        set.q.forEach((item, idx) => {
            const div = document.createElement('div');
            div.style.marginTop = '8px';
            div.innerHTML = `<div style="font-weight:700">${item.q}</div>` + item.opts.map((o, i) => `<button class="option" data-idx="${idx}" data-choice="${i}">${o}</button>`).join(' ');
            area.appendChild(div);
        });
        area.querySelectorAll('.option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = +btn.dataset.idx;
                const choice = +btn.dataset.choice;
                const correct = set.q[idx].a;
                if (choice === correct) {
                    btn.style.background = '#9ae6b4';
                    playText('Correct!');
                } else {
                    btn.style.background = '#fed7d7';
                    playText('Try again');
                }
            });
        });
        // submit
        const submit = document.createElement('div');
        submit.style.marginTop = '10px';
        submit.innerHTML = `<button id="readtap-submit" class="button dyslexia-button">Finish</button>`;
        area.appendChild(submit);
        $('readtap-submit').onclick = () => {
            let correct = 0, total = 0;
            set.q.forEach((it, idx) => {
                const chosen = area.querySelector(`button[data-idx="${idx}"][style*="background: rgb("]`);
                let got = -1;
                if (chosen) {
                    // check for green background
                    if (chosen.style.background === 'rgb(154, 230, 180)' || chosen.style.background.includes('#9ae6b4')) {
                        got = +chosen.dataset.choice;
                    }
                }
                if (got === it.a) correct++;
                total++;
            });
            $('readtap-score').textContent = `You got ${correct}/${total}`;
            postResult({ kind: 'game', game: 'readtap', score: correct, timestamp: Date.now() });
        };
    }
    $('readtap-area').innerHTML = '<div><button id="readtap-start" class="button dyslexia-button">Start a passage</button></div>';
    document.addEventListener('click', (e) => { if (e.target && e.target.id === 'readtap-start') { renderReadTapSet(readTapSets[randInt(readTapSets.length)]) } });

    // ---------- CALM STORY QUIZ (no timer) ----------
    const calmSets = [
        { story: "The cat drinks milk.", q: [{ q: "What does the cat drink?", opts: ["milk", "water", "juice"], a: 0 }] },
        { story: "The sun is warm.", q: [{ q: "How is the sun?", opts: ["cold", "warm", "dark"], a: 1 }] }
    ];
    function renderCalm(set) {
        const area = $('calm-area');
        area.innerHTML = `<div style="font-size:1.1rem;padding:10px;background:#f7fafc;border-radius:8px">${set.story}</div>`;
        playText(set.story, 0.9);
        set.q.forEach((item, idx) => {
            const div = document.createElement('div');
            div.style.marginTop = '8px';
            div.innerHTML = `<div style="font-weight:700">${item.q}</div>` + item.opts.map((o, i) => `<button class="option" data-idx="${idx}" data-choice="${i}">${o}</button>`).join(' ');
            area.appendChild(div);
        });
        area.querySelectorAll('.option').forEach(btn => {
            btn.onclick = () => {
                const idx = +btn.dataset.idx,
                    choice = +btn.dataset.choice;
                if (choice === set.q[idx].a) {
                    btn.style.background = '#9ae6b4';
                    playText('Well done');
                    postResult({ kind: 'game', game: 'calm', score: 1, timestamp: Date.now() });
                } else {
                    btn.style.background = '#fed7d7';
                    playText('Try again gently');
                }
            };
        });
    }
    document.addEventListener('click', (e) => { if (e.target && e.target.id === 'calm-start') { renderCalm(calmSets[randInt(calmSets.length)]) } });
    // add a start button
    $('calm-area').innerHTML = '<div><button id="calm-start" class="button math-button">Start Calm Story</button></div>';
    document.addEventListener('click', (e) => { if (e.target && e.target.id === 'calm-start') { renderCalm(calmSets[randInt(calmSets.length)]) } });

    // ---------- WORD-PICTURE MATCH (deep dyslexia) ----------
    const deepSets = [
        { word: 'dog', pics: ['🐶', '🐱', '🐺'], correct: 0 },
        { word: 'bread', pics: ['🍞', '🍚', '🥐'], correct: 0 },
        { word: 'chair', pics: ['🪑', '🛋️', '🛏️'], correct: 0 },
        { word: 'love', pics: ['❤️', '😊', '🫂'], correct: 0 },
        { word: 'tree', pics: ['🌳', '🌴', '🌲'], correct: 0 }
    ];
    function renderDeep() {
        const area = $('deep-area');
        area.innerHTML = '';
        const item = deepSets[randInt(deepSets.length)];
        playText(item.word, 0.95);
        area.innerHTML = `<div style="font-weight:700;font-size:1.2rem">${item.word}</div>`;
        const choices = item.pics.map((p, i) => `<button class="option" data-i="${i}">${p}</button>`).join(' ');
        area.innerHTML += choices;
        area.querySelectorAll('.option').forEach(btn => {
            btn.onclick = () => {
                const i = +btn.dataset.i;
                if (i === item.correct) {
                    btn.style.background = '#9ae6b4';
                    $('deep-score').textContent = 'Correct!';
                    playText('Correct!');
                    postResult({ kind: 'game', game: 'deep', score: 1, timestamp: Date.now() });
                } else {
                    btn.style.background = '#fed7d7';
                    $('deep-score').textContent = 'Try again';
                    playText('Try again');
                }
            };
        });
    }
    $('deep-area').innerHTML = '<div><button id="deep-start" class="button dyslexia-button">Start Word-Picture Match</button></div>';
    document.addEventListener('click', (e) => { if (e.target && e.target.id === 'deep-start') { renderDeep(); } });

    // ---------- initialization: quick defaults ----------
    // add small helpers for missing areas
    if (!$('phonics-area').innerHTML) $('phonics-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('sight-area').innerHTML) $('sight-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('naming-area').innerHTML) $('naming-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('soundword-area').innerHTML) $('soundword-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('puzzle-area').innerHTML) $('puzzle-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('blend-area').innerHTML) $('blend-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('readtap-area').innerHTML) $('readtap-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('calm-area').innerHTML) $('calm-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';
    if (!$('deep-area').innerHTML) $('deep-area').innerHTML = '<div style="color:#718096">Press Start to begin</div>';

})();