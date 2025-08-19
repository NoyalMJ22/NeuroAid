// ---------- Scramble a word (simulate dyslexia effect) ----------
function scrambleWord(word) {
    if (word.length <= 3) return word;

    const firstLetter = word[0];
    const lastLetter = word[word.length - 1];
    let middleLetters = word.substring(1, word.length - 1).split('');

    if (middleLetters.length >= 2) {
        let a, b;
        do {
            a = Math.floor(Math.random() * middleLetters.length);
            b = Math.floor(Math.random() * middleLetters.length);
        } while (a === b);

        [middleLetters[a], middleLetters[b]] = [middleLetters[b], middleLetters[a]];
    }

    return firstLetter + middleLetters.join('') + lastLetter;
}

// ---------- Continuous scrambling ----------
let jumbleIntervalId = null;

function startContinuousScrambling(sourceText) {
    const scrambledTextEl = document.getElementById("scrambled-text");
    const originalTextEl = document.getElementById("original-text");
    if (!scrambledTextEl || !originalTextEl) return;

    const words = sourceText.trim().split(/\s+/);

    if (jumbleIntervalId) clearInterval(jumbleIntervalId);

    originalTextEl.textContent = sourceText;

    jumbleIntervalId = setInterval(() => {
        let scrambledHtml = words.map(word => {
            return Math.random() > 0.5
                ? `<span>${scrambleWord(word)}</span>`
                : `<span>${word}</span>`;
        }).join(" ");
        scrambledTextEl.innerHTML = scrambledHtml;
    }, 80);
}

// ---------- Highlight words as they are read aloud ----------
let highlightIntervalId = null;

function highlightWords(text) {
    const readAloudEl = document.getElementById("read-aloud");
    if (!readAloudEl) return;

    const words = text.trim().split(/\s+/);
    readAloudEl.innerHTML = "";

    words.forEach((word, index) => {
        let span = document.createElement("span");
        span.innerText = word + " ";
        span.id = "read-aloud-word-" + index;
        readAloudEl.appendChild(span);
    });

    if (highlightIntervalId) clearInterval(highlightIntervalId);

    let i = 0;
    const estimatedReadingSpeed = 150; // words per minute
    const intervalTime = (60 / estimatedReadingSpeed) * 1000;

    highlightIntervalId = setInterval(() => {
        if (i > 0) {
            const prevWordSpan = document.getElementById("read-aloud-word-" + (i - 1));
            if (prevWordSpan) prevWordSpan.style.backgroundColor = "";
        }
        if (i < words.length) {
            const currentWordSpan = document.getElementById("read-aloud-word-" + i);
            if (currentWordSpan) currentWordSpan.style.backgroundColor = "yellow";
            i++;
        } else {
            clearInterval(highlightIntervalId);
            highlightIntervalId = null;
        }
    }, intervalTime);
}

// ---------- Main: run on page load ----------
document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('text-input');
    const form = document.querySelector('form');

    if (textInput) {
        textInput.addEventListener('input', () => {
            startContinuousScrambling(textInput.value);
        });

        if (textInput.value) {
            startContinuousScrambling(textInput.value);
        }
    }

    if (form && textInput) {
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // avoid full reload
            highlightWords(textInput.value);
        });
    }

    // ---------- Dyslexia-friendly font toggle ----------
    const fontSelect = document.getElementById("fontSelect");
    const reader = document.getElementById("reader");

    if (fontSelect && reader) {
        // Load saved font preference
        if (localStorage.getItem("preferredFont")) {
            reader.classList.remove("inter-font", "opendyslexic-font");
            reader.classList.add(localStorage.getItem("preferredFont"));
            fontSelect.value = localStorage.getItem("preferredFont").replace("-font", "");
        }

        fontSelect.addEventListener("change", () => {
            reader.classList.remove("inter-font", "opendyslexic-font");

            if (fontSelect.value === "opendyslexic") {
                reader.classList.add("opendyslexic-font");
                localStorage.setItem("preferredFont", "opendyslexic-font");
            } else {
                reader.classList.add("inter-font");
                localStorage.setItem("preferredFont", "inter-font");
            }
        });
    }
});
