from flask import Flask, render_template, request, jsonify, g
from datetime import datetime, timedelta
import sqlite3
import os

APP_DB = os.path.join(os.path.dirname(__file__), "neuroaid.db")

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# ----------------- DB helpers -----------------
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(APP_DB)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    cur = db.cursor()
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handle TEXT UNIQUE DEFAULT 'anon'
    );
    CREATE TABLE IF NOT EXISTS preferences (
        user_id INTEGER,
        key TEXT,
        value TEXT,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        payload TEXT,
        timestamp TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        xp INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        last_active TEXT,
        badges TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)
    db.commit()
    # ensure anon user exists + progress row
    cur.execute("INSERT OR IGNORE INTO users(handle) VALUES (?)", ("anon",))
    db.commit()
    cur.execute("SELECT id FROM users WHERE handle = ?", ("anon",))
    row = cur.fetchone()
    uid = row["id"]
    cur.execute("INSERT OR IGNORE INTO progress(user_id, xp, streak, last_active, badges) VALUES (?,?,?,?,?)",
                (uid, 0, 0, None, ""))
    db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()

# ----------------- util -----------------
def get_anon_id():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE handle = ?", ("anon",))
    return cur.fetchone()["id"]

def read_progress_row(user_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM progress WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        return {"xp": 0, "streak": 0, "last_active": None, "badges": []}
    badges = row["badges"].split(",") if row["badges"] else []
    return {"xp": row["xp"], "streak": row["streak"], "last_active": row["last_active"], "badges": badges}

def update_progress(user_id, xp_delta=0, add_badge=None):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT xp, streak, last_active, badges FROM progress WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        cur.execute("INSERT INTO progress(user_id,xp,streak,last_active,badges) VALUES (?,?,?,?,?)",
                    (user_id, xp_delta, 0, datetime.utcnow().isoformat(), add_badge or ""))
        db.commit()
        return

    xp = row["xp"] + xp_delta
    last_active = row["last_active"]
    streak = row["streak"]
    # update daily streak
    if last_active:
        last_dt = datetime.fromisoformat(last_active)
        if datetime.utcnow().date() > last_dt.date():
            # last active earlier day -> check contiguous
            if datetime.utcnow().date() - last_dt.date() == timedelta(days=1):
                streak += 1
            else:
                streak = 1
        else:
            # same day
            pass
    else:
        streak = 1

    badges = row["badges"].split(",") if row["badges"] else []
    if add_badge and add_badge not in badges:
        badges.append(add_badge)

    cur.execute("UPDATE progress SET xp = ?, streak = ?, last_active = ?, badges = ? WHERE user_id = ?",
                (xp, streak, datetime.utcnow().isoformat(), ",".join(badges), user_id))
    db.commit()

# ----------------- Init DB -----------------
with app.app_context():
    init_db()

# ----------------- Pages -----------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/dyslexia")
def dyslexia():
    return render_template("dyslexia.html")

@app.route("/games")
def games():
    return render_template("games.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/about")
def about():
    return render_template("about.html")

# ----------------- API: Preferences -----------------
@app.route("/api/preferences", methods=["GET", "POST"])
def api_preferences():
    user_id = get_anon_id()
    db = get_db()
    cur = db.cursor()
    if request.method == "GET":
        cur.execute("SELECT key, value FROM preferences WHERE user_id = ?", (user_id,))
        prefs = {r["key"]: r["value"] for r in cur.fetchall()}
        return jsonify(prefs)
    data = request.get_json(force=True, silent=True) or {}
    for k, v in data.items():
        cur.execute("INSERT OR REPLACE INTO preferences(user_id, key, value) VALUES (?,?,?)", (user_id, k, str(v)))
    db.commit()
    return jsonify({"ok": True})

# ----------------- API: Save assessment -----------------
@app.route("/api/save_assessment", methods=["POST"])
def api_save_assessment():
    user_id = get_anon_id()
    payload = request.get_json(force=True, silent=True) or {}
    db = get_db()
    cur = db.cursor()
    cur.execute("INSERT INTO assessments(user_id, payload, timestamp) VALUES (?,?,?)",
                (user_id, str(payload), datetime.utcnow().isoformat()))
    db.commit()

    # Award XP and badges depending on payload
    xp = 0
    badge = None
    if payload.get("kind") == "game":
        xp += 10 * (payload.get("score", 0))
        # adapt badge names per game
        g = payload.get("game", "")
        if payload.get("score", 0) >= payload.get("total", 1) * 0.8:
            badge = f"{g.capitalize()} Star"
    elif payload.get("kind") == "assessment":
        xp += 20
        # if high-risk, badge to notify
        if payload.get("riskLevel") == "High Risk":
            badge = "High-Risk Screened"

    update_progress(user_id, xp_delta=xp, add_badge=badge)
    return jsonify({"ok": True, "xp_awarded": xp})

# ----------------- API: assessments & progress -----------------
@app.route("/api/assessments")
def api_assessments():
    user_id = get_anon_id()
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, payload, timestamp FROM assessments WHERE user_id = ? ORDER BY id DESC LIMIT 50", (user_id,))
    rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows)

@app.route("/api/progress")
def api_progress():
    user_id = get_anon_id()
    p = read_progress_row(user_id)
    return jsonify(p)

# ----------------- API: diagnostic scoring helper -----------------
@app.route("/api/diagnostic_score", methods=["POST"])
def api_diagnostic_score():
    payload = request.get_json(force=True, silent=True) or {}
    scores = payload.get("scores", {})
    reaction_times = payload.get("reactionTimes", [])
    checklist_yes = payload.get("checklistYesCount", 0)

    # risk level
    if checklist_yes >= 8:
        risk = "High Risk"
    elif checklist_yes >= 5:
        risk = "Moderate Risk"
    elif checklist_yes >= 3:
        risk = "Mild Risk"
    else:
        risk = "Low Risk"

    # dominant type
    dominant = "general"
    if scores:
        dominant = max(scores, key=scores.get)

    avg_time = round(sum(reaction_times) / (len(reaction_times) or 1) / 1000, 2)

    tips = {
        "phonological": "Phonics-based, multisensory reading programs.",
        "surface": "Sight words with visual supports and repeated exposure.",
        "visual": "Line focus, larger font, color overlays, spaced text.",
        "auditory": "Paired TTS & auditory memory drills.",
        "attentional": "Short tasks, minimized distractions.",
        "general": "Balanced multisensory practice."
    }

    return jsonify({"riskLevel": risk, "dominantType": dominant, "avgTime": avg_time, "tips": tips.get(dominant)})

# ----------------- run -----------------
if __name__ == "__main__":
    app.run(debug=True)
 