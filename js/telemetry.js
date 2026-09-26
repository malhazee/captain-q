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
    }
}
