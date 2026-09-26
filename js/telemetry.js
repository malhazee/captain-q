/**
 * Telemetry & Analytics Module for Captain Q HTML5
 * Sends live start ping and final diagnostic reports to Google Sheets Webhook
 */

class TelemetryTracker {
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl || GAME_CONFIG.WEBHOOK_URL;
        this.studentName = "طالب مجهول";
        this.studentSection = "شعبة أ";
        this.startTime = Date.now();
        this.events = []; // { label, isTarget, misconception, timestamp }
        this.score = 0;
        this.level = 1;
        this.lives = GAME_CONFIG.INITIAL_LIVES;
    }

    setStudent(name, section) {
        this.studentName = name || "طالب مجهول";
        this.studentSection = section || "شعبة أ";
    }

    resetSession() {
        this.startTime = Date.now();
        this.events = [];
        this.score = 0;
        this.level = 1;
        this.lives = GAME_CONFIG.INITIAL_LIVES;
        this.lastReportSent = false;
    }

    recordAnswer(label, isTarget, misconception = "") {
        this.events.push({
            label: label,
            isTarget: isTarget,
            misconception: isTarget ? "" : (misconception || GAME_CONFIG.MISCONCEPTIONS[label] || "خطأ حسابي بحاجة لتدريب"),
            time: Date.now()
        });
    }

    getCorrectCount() {
        return this.events.filter(e => e.isTarget).length;
    }

    getWrongCount() {
        return this.events.filter(e => !e.isTarget).length;
    }

    getAccuracyRate() {
        const total = this.events.length;
        if (total === 0) return "100.0%";
        const correct = this.getCorrectCount();
        return ((correct / total) * 100).toFixed(1) + "%";
    }

    getMisconceptions() {
        const list = this.events
            .filter(e => !e.isTarget && e.misconception)
            .map(e => e.misconception);
        return [...new Set(list)];
    }

    sendPayload(payload) {
        if (!this.webhookUrl) return;
        try {
            fetch(this.webhookUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            }).then(() => {
                console.log("Telemetry dispatched successfully:", payload);
            }).catch(err => {
                console.warn("Telemetry dispatch error:", err);
            });
        } catch (e) {
            console.warn("Fetch error:", e);
        }
    }

    sendStartPing() {
        const payload = {
            student_name: this.studentName,
            student_section: this.studentSection,
            level_reached: 1,
            score: 0,
            lives_remaining: this.lives,
            correct_count: 0,
            wrong_count: 0,
            accuracy_rate: "0.0%",
            time_spent_seconds: 0,
            misconceptions: ["🎮 بدأ الجلسة الآن (قيد التحدي)"],
            questions_detail: "بدء التحدي عبر نسخة HTML5 الخفيفة",
            timestamp: new Date().toISOString()
        };
        this.sendPayload(payload);
    }

    sendFinalReport(status = "انتهاء اللعبة") {
        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
        const miscs = this.getMisconceptions();
        const payload = {
            student_name: this.studentName,
            student_section: this.studentSection,
            section: this.studentSection,
            level_reached: this.level,
            levels_cleared: this.level,
            score: this.score,
            final_score: this.score,
            lives_remaining: this.lives,
            correct_count: this.getCorrectCount(),
            wrong_count: this.getWrongCount(),
            accuracy_rate: this.getAccuracyRate(),
            accuracy_percentage: parseFloat(this.getAccuracyRate()),
            time_spent_seconds: timeSpent,
            misconceptions: miscs.length > 0 ? miscs : ["أتقن الطالب كافة معايير الأعداد النسبية بنجاح 🌟"],
            questions_detail: `${status} - مجموع البطاقات: ${this.events.length}`,
            date: new Date().toLocaleString("ar-JO"),
            timestamp: new Date().toISOString()
        };
        this.lastReportSent = true;
        this.sendPayload(payload);

        // Update collective leaderboard cache
        if (this.studentName && this.studentName !== "طالب مجهول") {
            this.updateLocalLeaderboard(this.studentName, this.studentSection, this.score, this.getAccuracyRate(), this.level);
        }
    }

    getDefaultLeaderboard() {
        return [
            { rank: 1, name: "كريم عدي الزعبي", section: "شعبة أ", score: 3000, accuracy: "100%", level: 6 },
            { rank: 2, name: "مصعب", section: "شعبة ج", score: 3000, accuracy: "100%", level: 6 },
            { rank: 3, name: "هيثم يوسف الخطيب", section: "شعبة ب", score: 3000, accuracy: "100%", level: 6 },
            { rank: 4, name: "محمود عدي الزعبي", section: "شعبة أ", score: 2810, accuracy: "90.9%", level: 6 },
            { rank: 5, name: "وسام علي ابراهيم الزعبي", section: "شعبة أ", score: 2780, accuracy: "88.2%", level: 6 },
            { rank: 6, name: "أحمد رسول الزعبي", section: "شعبة أ", score: 2750, accuracy: "85.7%", level: 6 },
            { rank: 7, name: "مهند يزن الزعبي", section: "شعبة ج", score: 2750, accuracy: "85.7%", level: 6 },
            { rank: 8, name: "عمر باسل الزعبي", section: "شعبة ج", score: 2690, accuracy: "81.1%", level: 6 },
            { rank: 9, name: "احمد سليمان عارف", section: "شعبة ب", score: 2690, accuracy: "81.1%", level: 6 },
            { rank: 10, name: "عبدالله عدنان شقيرات", section: "شعبة أ", score: 2690, accuracy: "81.1%", level: 6 },
            { rank: 11, name: "ابراهيم مفلح الزعبي", section: "شعبة ب", score: 2660, accuracy: "78.9%", level: 6 },
            { rank: 12, name: "محمد معاذ عارف", section: "شعبة ج", score: 2660, accuracy: "78.9%", level: 6 },
            { rank: 13, name: "سامي طارق سامي", section: "شعبة ب", score: 2600, accuracy: "75.0%", level: 5 },
            { rank: 14, name: "محمد أحمد الزعبي", section: "شعبة ج", score: 2600, accuracy: "75.0%", level: 5 }
        ];
    }

    getLocalLeaderboard() {
        try {
            const raw = localStorage.getItem("captain_q_public_leaderboard");
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list) && list.length > 0) {
                    const hasOldPlaceholder = list.some(item => item.name === "زيد المحاسيس" || item.name === "عمر الطراونة");
                    if (!hasOldPlaceholder) {
                        return list;
                    }
                }
            }
        } catch (e) {
            console.warn("Error reading local leaderboard:", e);
        }
        const realDefaults = this.getDefaultLeaderboard();
        try {
            localStorage.setItem("captain_q_public_leaderboard", JSON.stringify(realDefaults));
        } catch (e) {}
        return realDefaults;
    }

    updateLocalLeaderboard(name, section, score, accuracy, level) {
        if (!name || name === "طالب مجهول") return;
        try {
            let list = this.getLocalLeaderboard();
            let found = false;
            for (let item of list) {
                if (item.name.trim() === name.trim()) {
                    if (score > item.score) {
                        item.score = score;
                        item.accuracy = accuracy;
                        item.level = level;
                        item.section = section;
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                list.push({
                    name: name.trim(),
                    section: section,
                    score: score,
                    accuracy: accuracy,
                    level: level
                });
            }
            // Sort descending by score, then accuracy
            list.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (parseFloat(b.accuracy) || 0) - (parseFloat(a.accuracy) || 0);
            });
            // Re-assign ranks
            list.slice(0, 15).forEach((item, idx) => {
                item.rank = idx + 1;
            });
            list = list.slice(0, 15);
            localStorage.setItem("captain_q_public_leaderboard", JSON.stringify(list));
        } catch (e) {
            console.warn("Error updating local leaderboard:", e);
        }
    }

    async fetchLeaderboard() {
        // 1. Try to fetch from Google Apps Script Webhook with 2.5s timeout
        if (this.webhookUrl) {
            try {
                const sep = this.webhookUrl.includes("?") ? "&" : "?";
                const url = `${this.webhookUrl}${sep}action=leaderboard&t=${Date.now()}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                const res = await fetch(url, { method: "GET", signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
                        localStorage.setItem("captain_q_public_leaderboard", JSON.stringify(data.leaderboard));
                        return { source: "cloud", data: data.leaderboard };
                    }
                }
            } catch (err) {
                // Cloud not reachable or timed out, fallback to local storage
            }
        }
        // 2. Fallback to cached/local storage
        return { source: "local", data: this.getLocalLeaderboard() };
    }
}
