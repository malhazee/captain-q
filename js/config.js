/**
 * Captain Q - Grade 7 Rational Numbers Curriculum & Game Configuration
 * Arabic Educational Math Pacman
 */

const DIR = {
    NONE: { dx: 0, dy: 0, angle: 0, name: "NONE" },
    NORTH: { dx: 0, dy: -1, angle: -Math.PI / 2, name: "NORTH" },
    SOUTH: { dx: 0, dy: 1, angle: Math.PI / 2, name: "SOUTH" },
    EAST: { dx: 1, dy: 0, angle: 0, name: "EAST" },
    WEST: { dx: -1, dy: 0, angle: Math.PI, name: "WEST" },
    UP: { dx: 0, dy: -1, angle: -Math.PI / 2, name: "UP" },
    DOWN: { dx: 0, dy: 1, angle: Math.PI / 2, name: "DOWN" },
    LEFT: { dx: -1, dy: 0, angle: Math.PI, name: "LEFT" },
    RIGHT: { dx: 1, dy: 0, angle: 0, name: "RIGHT" }
};

const GAME_CONFIG = {
    // Canvas & Grid settings
    CANVAS_SIZE: 960,
    GRID_WIDTH: 21,
    GRID_HEIGHT: 21,
    
    // Gameplay rules: points strictly on correct answers, everything else is 0
    INITIAL_LIVES: 3,
    POINTS_PER_TARGET: 100,
    PENALTY_PER_TRAP: 0,
    POINTS_PER_DOT: 0,
    POINTS_PER_SUPER_DOT: 0,
    POINTS_PER_GHOST: 0,
    
    // Timing
    LEVEL_TIME_LIMIT: 90, // seconds
    INTRO_COUNTDOWN: 10,  // 10 seconds to read questions, correct answers, and traps
    SUPER_DOT_DURATION: 8, // seconds frightened mode
    
    // Google Sheets Telemetry Webhook
    WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbzW67pTOIhLxD89xYACaGs-O6qMbkBbUmpb7oEaQ7Vj0p_WxaQw_epiPI6aKpUN0nH6/exec",
    
    // Misconceptions dictionary
    MISCONCEPTIONS: {
        "1/3": "الخلط بين كسر الثلث والنصف",
        "0.05": "خطأ القيمة المنزلية العشرية (0.05 بدلاً من 0.5)",
        "-0.5": "إهمال الإشارة السالبة (العدد سالب والنصف موجب)",
        "2/5": "كسر اعتيادي لا يكافئ النصف (قيمته 0.4)",
        "+0.5": "اختيار عدد موجب بدلاً من السالب",
        "3/4": "عدم التمييز بين الكسر الموجب والسالب",
        "0": "اعتبار الصفر عدداً سالباً (الصفر عدد محايد)",
        "1.2": "اختيار كسر عشري موجب أكبر من الصفر",
        "3/5": "الخلط في حساب النسبة المئوية (3/5 = 60% وليس 75%)",
        "0.34": "الخلط بين الكسر 3/4 والكسر العشري 0.34",
        "4/3": "اختيار مقلوب الكسر بدلاً من مكافئه",
        "7/10": "تقدير غير دقيق للنسبة 75% (7/10 = 70%)",
        "-2.5": "مقارنة العدد السالب مباشرة بدلاً من قيمته المطلقة",
        "5/2": "كسر غير فعلي قيمته 2.5 وقيمته المطلقة أكبر من 1",
        "-3": "نسيان أن القيمة المطلقة موجبة |-3| = 3 وهي أكبر من 1",
        "1.8": "العدد العشري 1.8 قيمته المطلقة أكبر من 1",
        "5/4": "الخلط بين الكسر الفعلي وغير الفعلي (5/4 أكبر من 1)",
        "1.5": "العدد العشري 1.5 أكبر من الواحد الصحيح",
        "-1/2": "العدد النسبي السالب يقع يسار الصفر وليس بين 0 و 1",
        "-1/3": "العدد النسبي السالب يقع يسار الصفر وليس بين 0 و 1",
        "3/2": "كسر غير فعلي مقداره 1.5 وهو أكبر من 1",
        "1/0": "القسمة على صفر كمية غير معرّفة وليست عدداً نسبياً",
        "5/0": "مقام العدد النسبي لا يجوز أن يساوي صفراً",
        "0/0": "كمية غير معينة وليست عدداً نسبياً",
        "pi": "العدد باي (π) عدد غير نسبي"
    },
    
    // The 6 Curriculum Levels
    LEVELS: [
        {
            level: 1,
            title: "بوابة الأعداد النسبية",
            prompt: "التقط مكافئات النصف 1/2 (0.5)",
            targets: ["1/2", "2/4", "3/6", "5/10", "0.5"],
            traps: ["1/3", "0.05", "-0.5", "2/5"],
            neededCount: 5,
            ghostCount: 4,
            playerSpeed: 1.35,
            ghostSpeed: 0.85
        },
        {
            level: 2,
            title: "وادي السوالب وخط الأعداد",
            prompt: "التقط الأعداد النسبية السالبة (أقل من صفر)",
            targets: ["-1/2", "-0.75", "-3/4", "-1.5", "-2"],
            traps: ["+0.5", "3/4", "0", "1.2"],
            neededCount: 5,
            ghostCount: 4,
            playerSpeed: 1.40,
            ghostSpeed: 0.90
        },
        {
            level: 3,
            title: "مملكة الكسور المتكافئة",
            prompt: "التقط مكافئات 3/4 والنسب المئوية (75%)",
            targets: ["6/8", "9/12", "75%", "0.75", "15/20"],
            traps: ["3/5", "0.34", "4/3", "7/10"],
            neededCount: 5,
            ghostCount: 4,
            playerSpeed: 1.45,
            ghostSpeed: 0.95
        },
        {
            level: 4,
            title: "حصن القيمة المطلقة",
            prompt: "التقط أعداداً قيمتها المطلقة |س| أقل من أو تساوي 1",
            targets: ["-0.4", "-0.8", "-2/3", "0.25", "1"],
            traps: ["-2.5", "5/2", "-3", "1.8"],
            neededCount: 5,
            ghostCount: 4,
            playerSpeed: 1.50,
            ghostSpeed: 1.00
        },
        {
            level: 5,
            title: "مملكة الكسور الفعلية",
            prompt: "التقط الكسور الفعلية التي تقع بين 0 و 1",
            targets: ["1/4", "2/3", "4/5", "3/8", "5/6"],
            traps: ["5/4", "1.5", "-1/3", "3/2"],
            neededCount: 5,
            ghostCount: 4,
            playerSpeed: 1.55,
            ghostSpeed: 1.05
        },
        {
            level: 6,
            title: "تحدي العباقرة الختامي",
            prompt: "التقط أعداداً نسبية (تجنب القسمة على 0)",
            targets: ["11/4", "-0.6", "12/5", "50%", "|-2|"],
            traps: ["1/0", "5/0", "0/0", "pi"],
            neededCount: 5,
            ghostCount: 4,
            playerSpeed: 1.60,
            ghostSpeed: 1.10
        }
    ]
};
