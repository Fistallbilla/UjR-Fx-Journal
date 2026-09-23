/* =========================================================
   UjR Fx Trading Journal
   Firebase + Advanced Analytics
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
    authDomain: "journal-38e0e.firebaseapp.com",
    databaseURL: "https://journal-38e0e-default-rtdb.firebaseio.com",
    projectId: "journal-38e0e",
    storageBucket: "journal-38e0e.firebasestorage.app",
    messagingSenderId: "382226906837",
    appId: "1:382226906837:web:38df881c0f7beb24256c5c",
    measurementId: "G-R6LXDMQ9K2"
};

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: "select_account"
});


/* =========================================================
   STATE
========================================================= */

const state = {

    user: null,

    trades: [],

    settings: {
        startingBalance: 0,
        currency: "USD"
    },

    unsubscribeTrades: null,
    unsubscribeSettings: null,

    editingTradeId: null,

    calendarDate: new Date(),

    manualLot: false

};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);


function number(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;

}


function todayString() {

    const d = new Date();

    const y = d.getFullYear();

    const m = String(d.getMonth() + 1).padStart(2, "0");

    const day = String(d.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;

}


function formatMoney(value) {

    const amount = number(value);

    const currency = state.settings.currency || "USD";

    try {

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 2
        }).format(amount);

    } catch {

        return `${currency} ${amount.toFixed(2)}`;

    }

}


function signedMoney(value) {

    const n = number(value);

    if (n > 0) return `+${formatMoney(n)}`;

    return formatMoney(n);

}


function formatPercent(value) {

    return `${number(value).toFixed(2)}%`;

}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function sortedTrades() {

    return [...state.trades].sort((a, b) => {

        const ad = `${a.date || ""} ${a.time || ""}`;

        const bd = `${b.date || ""} ${b.time || ""}`;

        return bd.localeCompare(ad);

    });

}


function getResultClass(result) {

    if (result === "Win") return "result-win";

    if (result === "Loss") return "result-loss";

    return "result-be";

}


function normalizeTrade(trade) {

    return {

        ...trade,

        entry: number(trade.entry),
        sl: number(trade.sl),
        tp: number(trade.tp),
        rr: number(trade.rr),
        riskPercent: number(trade.riskPercent),
        riskAmount: number(trade.riskAmount),
        lotSize: number(trade.lotSize),
        profitLoss: number(trade.profitLoss),
        confidence: trade.confidence || "",
        date: trade.date || "",
        time: trade.time || ""

    };

}


/* =========================================================
   AUTH ERROR
========================================================= */

function friendlyAuthError(error) {

    switch (error?.code) {

        case "auth/unauthorized-domain":
            return "This website address is not authorized in Firebase. Add your current domain under Firebase Authentication → Settings → Authorized domains.";

        case "auth/operation-not-allowed":
            return "Google Sign-In is not enabled. Enable Google under Firebase Authentication → Sign-in method.";

        case "auth/popup-blocked":
            return "The Google login popup was blocked. Redirect login will be used.";

        case "auth/popup-closed-by-user":
            return "The Google login window was closed.";

        case "auth/api-key-not-valid":
            return "Firebase rejected the API key. Check the Web App configuration in Firebase.";

        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";

        case "auth/cancelled-popup-request":
            return "A Google login request is already open.";

        default:
            return error?.message || "Google login failed.";

    }

}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

$("loginBtn").addEventListener("click", async () => {

    const button = $("loginBtn");

    try {

        button.disabled = true;

        $("loginError").textContent = "";

        await signInWithPopup(auth, googleProvider);

    } catch (error) {

        console.error("Google login:", error);

        if (error?.code === "auth/popup-blocked") {

            try {

                await signInWithRedirect(auth, googleProvider);

                return;

            } catch (redirectError) {

                console.error(redirectError);

                $("loginError").textContent =
                    friendlyAuthError(redirectError);

            }

        } else {

            $("loginError").textContent =
                friendlyAuthError(error);

        }

    } finally {

        button.disabled = false;

    }

});


/* =========================================================
   REDIRECT RESULT
========================================================= */

(async function checkRedirectLogin() {

    try {

        await getRedirectResult(auth);

    } catch (error) {

        console.error("Redirect login:", error);

        $("loginError").textContent =
            friendlyAuthError(error);

    }

})();


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, async user => {

    if (!user) {

        state.user = null;

        $("app").classList.add("hidden");

        $("loginScreen").classList.remove("hidden");

        if (state.unsubscribeTrades) {
            state.unsubscribeTrades();
            state.unsubscribeTrades = null;
        }

        if (state.unsubscribeSettings) {
            state.unsubscribeSettings();
            state.unsubscribeSettings = null;
        }

        return;

    }


    state.user = user;

    $("loginScreen").classList.add("hidden");

    $("app").classList.remove("hidden");


    updateUserUI(user);

    await createUserProfile(user);

    loadSettings();

    loadTrades();

});


/* =========================================================
   USER PROFILE
========================================================= */

function updateUserUI(user) {

    const name = user.displayName || "Trader";

    const email = user.email || "";

    const photo = user.photoURL || "./logo.png";

    $("userName").textContent = name;

    $("userEmail").textContent = email;

    $("dashboardName").textContent =
        name.split(" ")[0] || "Trader";

    $("settingsName").textContent = name;

    $("settingsEmail").textContent = email;

    $("userPhoto").src = photo;

    $("topUserPhoto").src = photo;

    $("settingsPhoto").src = photo;

}


async function createUserProfile(user) {

    try {

        await setDoc(
            doc(db, "users", user.uid),
            {
                name: user.displayName || "Trader",
                email: user.email || "",
                photo: user.photoURL || "",
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );

    } catch (error) {

        console.error("Profile:", error);

    }

}


/* =========================================================
   FIRESTORE SETTINGS
========================================================= */

function loadSettings() {

    if (!state.user) return;

    const settingsRef =
        doc(db, "users", state.user.uid, "settings", "main");

    state.unsubscribeSettings =
        onSnapshot(settingsRef, snapshot => {

            if (snapshot.exists()) {

                state.settings = {
                    ...state.settings,
                    ...snapshot.data()
                };

            } else {

                state.settings = {
                    startingBalance: 0,
                    currency: "USD"
                };

            }

            $("startingBalance").value =
                state.settings.startingBalance || 0;

            $("currency").value =
                state.settings.currency || "USD";

            renderAll();

        }, error => {

            console.error("Settings listener:", error);

        });

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

$("saveSettingsBtn").addEventListener("click", async () => {

    if (!state.user) return;

    const startingBalance =
        number($("startingBalance").value);

    const currency =
        $("currency").value || "USD";

    try {

        await setDoc(
            doc(db, "users", state.user.uid, "settings", "main"),
            {
                startingBalance,
                currency,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );

        showToast("Settings saved.");

    } catch (error) {

        console.error(error);

        showToast("Could not save settings.");

    }

});


/* =========================================================
   FIRESTORE TRADES
========================================================= */

function loadTrades() {

    if (!state.user) return;

    const tradesRef =
        collection(db, "users", state.user.uid, "trades");

    state.unsubscribeTrades =
        onSnapshot(tradesRef, snapshot => {

            state.trades =
                snapshot.docs.map(docSnap => {

                    return {
                        id: docSnap.id,
                        ...normalizeTrade(docSnap.data())
                    };

                });

            renderAll();

        }, error => {

            console.error("Trades listener:", error);

            showToast("Could not load trades.");

        });

}


/* =========================================================
   TRADE CALCULATIONS
========================================================= */

function calculateTradeRR() {

    const entry = number($("entry").value);

    const sl = number($("sl").value);

    const tp = number($("tp").value);

    const direction = $("direction").value;


    if (entry <= 0 || sl <= 0 || tp <= 0) {

        $("rr").value = "";

        return 0;

    }


    let risk = 0;

    let reward = 0;


    if (direction === "Buy") {

        risk = entry - sl;

        reward = tp - entry;

    } else {

        risk = sl - entry;

        reward = entry - tp;

    }


    if (risk <= 0 || reward <= 0) {

        $("rr").value = "Invalid";

        return 0;

    }


    const rr = reward / risk;

    $("rr").value = `1:${rr.toFixed(2)}`;

    return rr;

}


function calculateTradeRisk() {

    const balance =
        number(state.settings.startingBalance);

    const riskPercent =
        number($("riskPercent").value);

    const entry =
        number($("entry").value);

    const sl =
        number($("sl").value);


    const riskAmount =
        balance * riskPercent / 100;


    $("riskAmount").value =
        riskAmount > 0
            ? riskAmount.toFixed(2)
            : "";


    if (entry <= 0 || sl <= 0 || riskAmount <= 0) {

        if (!state.manualLot) {
            $("lotSize").value = "";
        }

        return;

    }


    const distance =
        Math.abs(entry - sl);


    /*
       Simplified XAUUSD calculation:

       1 lot ≈ 100 oz

       lot = risk / (distance × 100)
    */

    const lot =
        riskAmount / (distance * 100);


    if (!state.manualLot) {

        $("lotSize").value =
            lot > 0
                ? lot.toFixed(2)
                : "";

    }

}


function updateTradeCalculations() {

    calculateTradeRR();

    calculateTradeRisk();

}


/* =========================================================
   P/L NORMALIZATION
========================================================= */

function normalizeProfitLossByResult() {

    const result = $("result").value;

    const input = $("profitLoss");

    const raw = input.value.trim();


    if (result === "Loss") {

        const value =
            Math.abs(number(raw));

        input.value =
            value
                ? (-value).toFixed(2)
                : "";

    }

    else if (result === "Win") {

        const value =
            Math.abs(number(raw));

        input.value =
            value
                ? value.toFixed(2)
                : "";

    }

    else if (result === "Break Even") {

        input.value = "0";

    }

}


function getNormalizedPL() {

    const result =
        $("result").value;

    let value =
        number($("profitLoss").value);


    if (result === "Loss") {

        value = -Math.abs(value);

    }

    else if (result === "Win") {

        value = Math.abs(value);

    }

    else {

        value = 0;

    }


    return Number(value.toFixed(2));

}


/* =========================================================
   TRADE FORM EVENTS
========================================================= */

[
    "entry",
    "sl",
    "tp",
    "direction",
    "riskPercent"
].forEach(id => {

    $(id).addEventListener("input", updateTradeCalculations);

    $(id).addEventListener("change", updateTradeCalculations);

});


$("lotSize").addEventListener("input", () => {

    state.manualLot = true;

});


$("result").addEventListener("change", () => {

    normalizeProfitLossByResult();

});


$("profitLoss").addEventListener("input", () => {

    normalizeProfitLossByResult();

});


/* =========================================================
   OPEN TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

    $("tradeModal").classList.remove("hidden");

    $("tradeError").textContent = "";

    state.manualLot = false;


    if (!trade) {

        state.editingTradeId = null;

        $("modalTitle").textContent = "Add Trade";

        $("tradeForm").reset();

        $("tradeDate").value = todayString();

        $("tradeTime").value =
            new Date().toTimeString().slice(0,5);

        $("pair").value = "XAUUSD";

        $("direction").value = "Buy";

        $("riskPercent").value = "1";

        $("result").value = "Win";

        $("profitLoss").value = "";

        $("rr").value = "";

        $("riskAmount").value = "";

        $("lotSize").value = "";

        return;

    }


    state.editingTradeId = trade.id;

    $("modalTitle").textContent = "Edit Trade";


    $("tradeId").value = trade.id;

    $("tradeDate").value = trade.date || todayString();

    $("tradeTime").value = trade.time || "";

    $("pair").value = trade.pair || "XAUUSD";

    $("direction").value = trade.direction || "Buy";

    $("entry").value = trade.entry || "";

    $("sl").value = trade.sl || "";

    $("tp").value = trade.tp || "";

    $("riskPercent").value =
        trade.riskPercent || 1;

    $("riskAmount").value =
        trade.riskAmount || "";

    $("lotSize").value =
        trade.lotSize || "";

    $("rr").value =
        trade.rr
            ? `1:${number(trade.rr).toFixed(2)}`
            : "";

    $("setup").value = trade.setup || "";

    $("session").value = trade.session || "";

    $("htfBias").value = trade.htfBias || "";

    $("liquidity").value = trade.liquidity || "";

    $("confirmation").value =
        trade.confirmation || "";

    $("result").value =
        trade.result || "Win";

    $("profitLoss").value =
        trade.profitLoss ?? 0;

    $("confidence").value =
        trade.confidence || "";

    $("psychology").value =
        trade.psychology || "";

    $("mistake").value =
        trade.mistake || "";

    $("notes").value =
        trade.notes || "";


    state.manualLot = true;

    normalizeProfitLossByResult();

}


function closeTradeModal() {

    $("tradeModal").classList.add("hidden");

    state.editingTradeId = null;

}


$("journalAddBtn").addEventListener("click", () => {

    openTradeModal();

});


$("quickAddBtn").addEventListener("click", () => {

    openTradeModal();

});


$("mobileAddBtn").addEventListener("click", () => {

    openTradeModal();

});


$("closeModal").addEventListener("click", closeTradeModal);

$("cancelTrade").addEventListener("click", closeTradeModal);

$("tradeModal").querySelector(".modal-backdrop")
    .addEventListener("click", closeTradeModal);


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener("submit", async event => {

    event.preventDefault();

    if (!state.user) return;


    $("tradeError").textContent = "";


    const rr = calculateTradeRR();

    const entry = number($("entry").value);

    const sl = number($("sl").value);

    const tp = number($("tp").value);


    if (!entry || !sl || !tp) {

        $("tradeError").textContent =
            "Entry, Stop Loss and Take Profit are required.";

        return;

    }


    if (!rr || rr <= 0) {

        $("tradeError").textContent =
            "Invalid trade structure. Check Entry, SL, TP and direction.";

        return;

    }


    const profitLoss =
        getNormalizedPL();


    const tradeData = {

        date: $("tradeDate").value,

        time: $("tradeTime").value,

        pair: $("pair").value.trim().toUpperCase(),

        direction: $("direction").value,

        entry,

        sl,

        tp,

        rr,

        riskPercent:
            number($("riskPercent").value),

        riskAmount:
            number($("riskAmount").value),

        lotSize:
            number($("lotSize").value),

        setup:
            $("setup").value,

        session:
            $("session").value,

        htfBias:
            $("htfBias").value,

        liquidity:
            $("liquidity").value,

        confirmation:
            $("confirmation").value,

        result:
            $("result").value,

        profitLoss,

        confidence:
            $("confidence").value,

        psychology:
            $("psychology").value,

        mistake:
            $("mistake").value,

        notes:
            $("notes").value.trim(),

        updatedAt:
            new Date().toISOString()

    };


    try {

        if (state.editingTradeId) {

            await updateDoc(
                doc(
                    db,
                    "users",
                    state.user.uid,
                    "trades",
                    state.editingTradeId
                ),
                tradeData
            );

            showToast("Trade updated.");

        } else {

            await addDoc(
                collection(
                    db,
                    "users",
                    state.user.uid,
                    "trades"
                ),
                {
                    ...tradeData,
                    createdAt:
                        new Date().toISOString()
                }
            );

            showToast("Trade added.");

        }


        closeTradeModal();


    } catch (error) {

        console.error("Save trade:", error);

        $("tradeError").textContent =
            "Could not save trade. Check Firestore rules and your connection.";

    }

});


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

    if (!state.user || !id) return;


    const confirmed =
        confirm("Delete this trade permanently?");

    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                state.user.uid,
                "trades",
                id
            )
        );

        showToast("Trade deleted.");

    } catch (error) {

        console.error(error);

        showToast("Could not delete trade.");

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

const pageTitles = {

    dashboardPage: "Dashboard",

    journalPage: "Journal",

    analyticsPage: "Analytics",

    riskPage: "Risk Calculator",

    calendarPage: "Calendar",

    settingsPage: "Settings"

};


function navigate(pageId) {

    document.querySelectorAll(".page")
        .forEach(page => {

            page.classList.toggle(
                "active-page",
                page.id === pageId
            );

        });


    document.querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === pageId
            );

        });


    $("topTitle").textContent =
        pageTitles[pageId] || "Dashboard";


    closeMobileMenu();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


document.querySelectorAll("[data-page]")
    .forEach(element => {

        element.addEventListener("click", () => {

            const page =
                element.dataset.page;

            if (page) navigate(page);

        });

    });


/* =========================================================
   MOBILE MENU
========================================================= */

function openMobileMenu() {

    $("sidebar").classList.add("open");

    $("overlay").classList.add("show");

}


function closeMobileMenu() {

    $("sidebar").classList.remove("open");

    $("overlay").classList.remove("show");

}


$("mobileMenuBtn").addEventListener(
    "click",
    openMobileMenu
);

$("mobileMenuClose").addEventListener(
    "click",
    closeMobileMenu
);

$("overlay").addEventListener(
    "click",
    closeMobileMenu
);


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        console.error(error);

    }

});


/* =========================================================
   ANALYTICS ENGINE
========================================================= */

function getAnalytics(trades = state.trades) {

    const list =
        trades
            .map(normalizeTrade)
            .sort((a,b) =>
                `${a.date} ${a.time}`
                .localeCompare(`${b.date} ${b.time}`)
            );


    const wins =
        list.filter(t => t.result === "Win");

    const losses =
        list.filter(t => t.result === "Loss");

    const breakevens =
        list.filter(t => t.result === "Break Even");


    const totalPL =
        list.reduce(
            (sum,t) => sum + t.profitLoss,
            0
        );


    const grossProfit =
        wins.reduce(
            (sum,t) => sum + Math.max(0,t.profitLoss),
            0
        );


    const grossLoss =
        Math.abs(
            losses.reduce(
                (sum,t) => sum + Math.min(0,t.profitLoss),
                0
            )
        );


    const profitFactor =
        grossLoss > 0
            ? grossProfit / grossLoss
            : grossProfit > 0
                ? Infinity
                : 0;


    const averageWin =
        wins.length
            ? wins.reduce((s,t) => s + t.profitLoss,0) / wins.length
            : 0;


    const averageLoss =
        losses.length
            ? losses.reduce((s,t) => s + t.profitLoss,0) / losses.length
            : 0;


    const winRate =
        list.length
            ? wins.length / list.length * 100
            : 0;


    const expectancy =
        list.length
            ? totalPL / list.length
            : 0;


    const averageR =
        list.length
            ? list.reduce((s,t) => {

                if (!t.riskAmount) return s;

                return s + (
                    t.profitLoss /
                    t.riskAmount
                );

            },0) / list.length
            : 0;


    const averageRisk =
        list.length
            ? list.reduce(
                (s,t) => s + t.riskPercent,
                0
            ) / list.length
            : 0;


    const bestTrade =
        list.length
            ? Math.max(...list.map(t => t.profitLoss))
            : 0;


    const worstTrade =
        list.length
            ? Math.min(...list.map(t => t.profitLoss))
            : 0;


    /* Equity and drawdown */

    let equity =
        number(state.settings.startingBalance);

    let peak = equity;

    let maxDrawdown = 0;

    let maxDrawdownPercent = 0;

    let equityPoints = [];


    list.forEach(trade => {

        equity += trade.profitLoss;

        peak = Math.max(peak,equity);

        const drawdown =
            peak - equity;

        const drawdownPercent =
            peak > 0
                ? drawdown / peak * 100
                : 0;

        maxDrawdown =
            Math.max(
                maxDrawdown,
                drawdown
            );

        maxDrawdownPercent =
            Math.max(
                maxDrawdownPercent,
                drawdownPercent
            );


        equityPoints.push({
            date: trade.date,
            equity,
            drawdown
        });

    });


    const streaks =
        calculateStreaks(list);


    return {

        list,

        wins,

        losses,

        breakevens,

        totalPL,

        grossProfit,

        grossLoss,

        profitFactor,

        averageWin,

        averageLoss,

        winRate,

        expectancy,

        averageR,

        averageRisk,

        bestTrade,

        worstTrade,

        maxDrawdown,

        maxDrawdownPercent,

        equity,

        equityPoints,

        ...streaks

    };

}


/* =========================================================
   STREAK CALCULATOR
========================================================= */

function calculateStreaks(trades) {

    let currentType = null;

    let current = 0;

    let longestWin = 0;

    let longestLoss = 0;


    trades.forEach(trade => {

        const type =
            trade.result === "Win"
                ? "Win"
                : trade.result === "Loss"
                    ? "Loss"
                    : "BE";


        if (type === currentType) {

            current++;

        } else {

            currentType = type;

            current = 1;

        }


        if (type === "Win") {

            longestWin =
                Math.max(longestWin,current);

        }


        if (type === "Loss") {

            longestLoss =
                Math.max(longestLoss,current);

        }

    });


    return {

        currentStreak:
            currentType
                ? `${current} ${currentType}`
                : "0",

        longestWinStreak:
            longestWin,

        longestLossStreak:
            longestLoss

    };

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

    const a =
        getAnalytics();


    $("totalTrades").textContent =
        a.list.length;

    $("winRate").textContent =
        `${a.winRate.toFixed(1)}%`;

    $("winRateSub").textContent =
        `${a.wins.length} wins / ${a.list.length} trades`;

    $("totalPL").textContent =
        signedMoney(a.totalPL);

    $("totalPL").className =
        `stat-value ${a.totalPL >= 0 ? "pl-positive" : "pl-negative"}`;

    const balance =
        number(state.settings.startingBalance)
        + a.totalPL;

    $("currentBalance").textContent =
        formatMoney(balance);

    const returnPercent =
        state.settings.startingBalance
            ? a.totalPL /
              state.settings.startingBalance *
              100
            : 0;

    $("dashboardPLPercent").textContent =
        `${returnPercent >= 0 ? "+" : ""}${returnPercent.toFixed(2)}%`;

    $("profitFactor").textContent =
        Number.isFinite(a.profitFactor)
            ? a.profitFactor.toFixed(2)
            : "∞";

    $("expectancy").textContent =
        signedMoney(a.expectancy);

    $("dashboardAvgRisk").textContent =
        `${a.averageRisk.toFixed(2)}%`;

    $("dashboardAvgR").textContent =
        `${a.averageR.toFixed(2)}R`;

    $("dashboardDrawdown").textContent =
        `${a.maxDrawdownPercent.toFixed(2)}%`;

    $("dashboardBest").textContent =
        signedMoney(a.bestTrade);

    $("dashboardWorst").textContent =
        signedMoney(a.worstTrade);


    const today =
        todayString();

    $("dashboardTodayTrades").textContent =
        a.list.filter(t => t.date === today).length;


    $("equityReturn").textContent =
        `${returnPercent >= 0 ? "+" : ""}${returnPercent.toFixed(2)}%`;


    renderRecentTrades();

    renderDiscipline();

    drawEquityChart(
        $("equityCanvas"),
        a.equityPoints,
        false
    );

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

    const body =
        $("recentTradesBody");

    const trades =
        sortedTrades().slice(0,6);


    body.innerHTML = "";


    if (!trades.length) {

        $("recentEmpty").classList.remove("hidden");

        return;

    }


    $("recentEmpty").classList.add("hidden");


    trades.forEach(trade => {

        const row =
            document.createElement("tr");


        const plClass =
            trade.profitLoss >= 0
                ? "pl-positive"
                : "pl-negative";


        row.innerHTML = `

            <td>${escapeHtml(trade.date)}</td>

            <td>${escapeHtml(trade.pair)}</td>

            <td>${escapeHtml(trade.direction)}</td>

            <td>
                <span class="result-chip ${getResultClass(trade.result)}">
                    ${escapeHtml(trade.result)}
                </span>
            </td>

            <td class="${plClass}">
                ${signedMoney(trade.profitLoss)}
            </td>

        `;


        body.appendChild(row);

    });

}


/* =========================================================
   DISCIPLINE
========================================================= */

function renderDiscipline() {

    const container =
        $("disciplineList");


    const mistakes = {};


    state.trades.forEach(trade => {

        const mistake =
            trade.mistake || "No mistake";

        if (!mistakes[mistake]) {

            mistakes[mistake] = {
                count: 0,
                pl: 0
            };

        }

        mistakes[mistake].count++;

        mistakes[mistake].pl +=
            number(trade.profitLoss);

    });


    const entries =
        Object.entries(mistakes)
            .sort((a,b) =>
                b[1].count - a[1].count
            )
            .slice(0,6);


    if (!entries.length) {

        container.innerHTML =
            `<div class="empty-state small">
                Record trades to see behavior analytics.
             </div>`;

        return;

    }


    container.innerHTML =
        entries.map(([name,data]) => `

            <div class="breakdown-item">

                <div class="breakdown-top">

                    <span class="breakdown-name">
                        ${escapeHtml(name)}
                    </span>

                    <span class="breakdown-pl ${
                        data.pl >= 0
                            ? "pl-positive"
                            : "pl-negative"
                    }">
                        ${signedMoney(data.pl)}
                    </span>

                </div>

                <div class="breakdown-meta">
                    <span>${data.count} trade${data.count === 1 ? "" : "s"}</span>
                </div>

            </div>

        `).join("");

}


/* =========================================================
   JOURNAL
========================================================= */

function getFilteredTrades() {

    const result =
        $("filterResult").value;

    const pair =
        $("filterPair").value
            .trim()
            .toLowerCase();

    const date =
        $("filterDate").value;


    return sortedTrades().filter(trade => {

        if (result &&
            trade.result !== result) {

            return false;

        }


        if (
            pair &&
            !String(trade.pair || "")
                .toLowerCase()
                .includes(pair)
        ) {

            return false;

        }


        if (
            date &&
            trade.date !== date
        ) {

            return false;

        }


        return true;

    });

}


function renderJournal() {

    const trades =
        getFilteredTrades();


    const wins =
        trades.filter(
            t => t.result === "Win"
        ).length;


    const losses =
        trades.filter(
            t => t.result === "Loss"
        ).length;


    const pl =
        trades.reduce(
            (sum,t) =>
                sum + number(t.profitLoss),
            0
        );


    $("journalTrades").textContent =
        trades.length;

    $("journalWins").textContent =
        wins;

    $("journalLosses").textContent =
        losses;

    $("journalPL").textContent =
        signedMoney(pl);


    const body =
        $("journalTableBody");


    body.innerHTML = "";


    if (!trades.length) {

        $("journalEmpty").classList.remove("hidden");

        return;

    }


    $("journalEmpty").classList.add("hidden");


    trades.forEach(trade => {

        const row =
            document.createElement("tr");


        const plClass =
            trade.profitLoss >= 0
                ? "pl-positive"
                : "pl-negative";


        row.innerHTML = `

            <td>${escapeHtml(trade.date)}</td>

            <td>${escapeHtml(trade.pair)}</td>

            <td>${escapeHtml(trade.direction)}</td>

            <td>${trade.entry}</td>

            <td>${trade.sl}</td>

            <td>${trade.tp}</td>

            <td>1:${trade.rr.toFixed(2)}</td>

            <td>
                <span class="result-chip ${getResultClass(trade.result)}">
                    ${escapeHtml(trade.result)}
                </span>
            </td>

            <td class="${plClass}">
                ${signedMoney(trade.profitLoss)}
            </td>

            <td>

                <button
                    class="action-btn edit-btn"
                    data-id="${trade.id}">
                    Edit
                </button>

                <button
                    class="action-btn delete-btn"
                    data-id="${trade.id}">
                    ×
                </button>

            </td>

        `;


        body.appendChild(row);

    });


    body.querySelectorAll(".edit-btn")
        .forEach(button => {

            button.addEventListener("click", () => {

                const trade =
                    state.trades.find(
                        t => t.id === button.dataset.id
                    );

                if (trade) {

                    openTradeModal(trade);

                }

            });

        });


    body.querySelectorAll(".delete-btn")
        .forEach(button => {

            button.addEventListener("click", () => {

                deleteTrade(button.dataset.id);

            });

        });

}


[
    "filterResult",
    "filterPair",
    "filterDate"
].forEach(id => {

    $(id).addEventListener("input", renderJournal);

    $(id).addEventListener("change", renderJournal);

});


$("clearFilters").addEventListener("click", () => {

    $("filterResult").value = "";

    $("filterPair").value = "";

    $("filterDate").value = "";

    renderJournal();

});


/* =========================================================
   ADVANCED ANALYTICS
========================================================= */

function renderAnalytics() {

    const a =
        getAnalytics();


    $("analyticsTrades").textContent =
        a.list.length;

    $("analyticsWinRate").textContent =
        `${a.winRate.toFixed(2)}%`;

    $("analyticsPL").textContent =
        signedMoney(a.totalPL);

    $("analyticsProfitFactor").textContent =
        Number.isFinite(a.profitFactor)
            ? a.profitFactor.toFixed(2)
            : "∞";

    $("analyticsRR").textContent =
        `${a.averageR.toFixed(2)}R`;

    $("analyticsExpectancy").textContent =
        signedMoney(a.expectancy);

    $("analyticsMaxDrawdown").textContent =
        formatMoney(-a.maxDrawdown);

    $("analyticsDrawdownPercent").textContent =
        `${a.maxDrawdownPercent.toFixed(2)}%`;


    $("analyticsWins").textContent =
        a.wins.length;

    $("analyticsLosses").textContent =
        a.losses.length;

    $("analyticsBE").textContent =
        a.breakevens.length;


    const total =
        a.list.length || 1;


    $("winBar").style.width =
        `${a.wins.length / total * 100}%`;

    $("lossBar").style.width =
        `${a.losses.length / total * 100}%`;

    $("beBar").style.width =
        `${a.breakevens.length / total * 100}%`;


    $("currentStreak").textContent =
        a.currentStreak;

    $("longestWinStreak").textContent =
        a.longestWinStreak;

    $("longestLossStreak").textContent =
        a.longestLossStreak;

    $("avgWin").textContent =
        signedMoney(a.averageWin);

    $("avgLoss").textContent =
        signedMoney(a.averageLoss);

    $("bestTrade").textContent =
        signedMoney(a.bestTrade);

    $("worstTrade").textContent =
        signedMoney(a.worstTrade);

    $("analyticsAvgRisk").textContent =
        `${a.averageRisk.toFixed(2)}%`;


    drawEquityChart(
        $("analyticsEquityCanvas"),
        a.equityPoints,
        true
    );


    renderBreakdown(
        "session",
        $("sessionBreakdown")
    );

    renderBreakdown(
        "setup",
        $("setupBreakdown")
    );

    renderBreakdown(
        "direction",
        $("directionBreakdown")
    );

    renderBreakdown(
        "htfBias",
        $("biasBreakdown")
    );

    renderBreakdown(
        "liquidity",
        $("liquidityBreakdown")
    );

    renderBreakdown(
        "confirmation",
        $("confirmationBreakdown")
    );

    renderMistakes();

    renderMonthlyAnalytics();

}


/* =========================================================
   BREAKDOWN ANALYTICS
========================================================= */

function renderBreakdown(field, container) {

    const groups = {};


    state.trades.forEach(trade => {

        const name =
            trade[field] || "Not recorded";


        if (!groups[name]) {

            groups[name] = {

                trades: 0,

                wins: 0,

                losses: 0,

                pl: 0

            };

        }


        groups[name].trades++;

        groups[name].pl +=
            number(trade.profitLoss);


        if (trade.result === "Win") {

            groups[name].wins++;

        }


        if (trade.result === "Loss") {

            groups[name].losses++;

        }

    });


    const entries =
        Object.entries(groups)
            .sort((a,b) =>
                b[1].pl - a[1].pl
            );


    if (!entries.length) {

        container.innerHTML =
            `<div class="empty-state small">
                No data recorded yet.
             </div>`;

        return;

    }


    const maxAbsPL =
        Math.max(
            1,
            ...entries.map(
                ([,data]) =>
                    Math.abs(data.pl)
            )
        );


    container.innerHTML =
        entries.map(([name,data]) => {

            const winRate =
                data.trades
                    ? data.wins /
                      data.trades *
                      100
                    : 0;


            const width =
                Math.min(
                    100,
                    Math.abs(data.pl) /
                    maxAbsPL *
                    100
                );


            return `

                <div class="breakdown-item">

                    <div class="breakdown-top">

                        <span class="breakdown-name">
                            ${escapeHtml(name)}
                        </span>

                        <span class="breakdown-pl ${
                            data.pl >= 0
                                ? "pl-positive"
                                : "pl-negative"
                        }">
                            ${signedMoney(data.pl)}
                        </span>

                    </div>

                    <div class="breakdown-meta">

                        <span>
                            ${data.trades} trades
                        </span>

                        <span>
                            ${winRate.toFixed(1)}% win
                        </span>

                        <span>
                            ${data.wins}W / ${data.losses}L
                        </span>

                    </div>

                    <div class="breakdown-bar">

                        <span
                            style="width:${width}%">
                        </span>

                    </div>

                </div>

            `;

        }).join("");

}


/* =========================================================
   MISTAKE ANALYTICS
========================================================= */

function renderMistakes() {

    const container =
        $("mistakeBreakdown");


    const groups = {};


    state.trades.forEach(trade => {

        const name =
            trade.mistake || "No mistake";


        if (!groups[name]) {

            groups[name] = {

                count: 0,

                pl: 0,

                wins: 0,

                losses: 0

            };

        }


        groups[name].count++;

        groups[name].pl +=
            number(trade.profitLoss);


        if (trade.result === "Win")
            groups[name].wins++;

        if (trade.result === "Loss")
            groups[name].losses++;

    });


    const entries =
        Object.entries(groups)
            .sort((a,b) =>
                b[1].count - a[1].count
            );


    if (!entries.length) {

        container.innerHTML =
            `<div class="empty-state">
                Record mistakes and psychology to unlock discipline analytics.
             </div>`;

        return;

    }


    container.innerHTML =
        entries.map(([name,data]) => {

            const rate =
                data.count
                    ? data.wins /
                      data.count *
                      100
                    : 0;


            return `

                <div class="mistake-card">

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    <span>
                        ${data.count} trades
                    </span>

                    <span>
                        ${rate.toFixed(1)}% win rate
                    </span>

                    <span class="${
                        data.pl >= 0
                            ? "pl-positive"
                            : "pl-negative"
                    }">
                        ${signedMoney(data.pl)}
                    </span>

                </div>

            `;

        }).join("");

}


/* =========================================================
   MONTHLY ANALYTICS
========================================================= */

function renderMonthlyAnalytics() {

    const groups = {};


    state.trades.forEach(trade => {

        const month =
            String(trade.date || "")
                .slice(0,7);


        if (!month) return;


        if (!groups[month]) {

            groups[month] = {

                trades: 0,

                wins: 0,

                losses: 0,

                pl: 0

            };

        }


        groups[month].trades++;

        groups[month].pl +=
            number(trade.profitLoss);


        if (trade.result === "Win")
            groups[month].wins++;

        if (trade.result === "Loss")
            groups[month].losses++;

    });


    const entries =
        Object.entries(groups)
            .sort((a,b) =>
                b[0].localeCompare(a[0])
            );


    const body =
        $("monthlyAnalyticsBody");


    body.innerHTML = "";


    entries.forEach(([month,data]) => {

        const winRate =
            data.trades
                ? data.wins /
                  data.trades *
                  100
                : 0;


        const [year,monthNum] =
            month.split("-");


        const label =
            new Date(
                Number(year),
                Number(monthNum) - 1,
                1
            ).toLocaleDateString(
                "en-US",
                {
                    month: "long",
                    year: "numeric"
                }
            );


        body.innerHTML += `

            <tr>

                <td>${label}</td>

                <td>${data.trades}</td>

                <td>${data.wins}</td>

                <td>${data.losses}</td>

                <td>${winRate.toFixed(1)}%</td>

                <td class="${
                    data.pl >= 0
                        ? "pl-positive"
                        : "pl-negative"
                }">
                    ${signedMoney(data.pl)}
                </td>

            </tr>

        `;

    });


    if (!entries.length) {

        body.innerHTML =
            `<tr>
                <td colspan="6" style="text-align:center;color:#667080">
                    No monthly data yet.
                </td>
             </tr>`;

    }

}


/* =========================================================
   EQUITY CHART
========================================================= */

function drawEquityChart(canvas, points, advanced = false) {

    if (!canvas) return;


    const rect =
        canvas.getBoundingClientRect();


    const width =
        Math.max(
            300,
            rect.width
        );


    const height =
        advanced
            ? 330
            : 280;


    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;


    canvas.style.height =
        `${height}px`;


    const ctx =
        canvas.getContext("2d");


    ctx.scale(dpr,dpr);

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const padding = 30;


    /* Grid */

    ctx.strokeStyle =
        "rgba(255,255,255,.05)";

    ctx.lineWidth = 1;


    for (let i = 0; i <= 4; i++) {

        const y =
            padding +
            i *
            (height - padding * 2) /
            4;


        ctx.beginPath();

        ctx.moveTo(
            padding,
            y
        );

        ctx.lineTo(
            width - padding,
            y
        );

        ctx.stroke();

    }


    if (!points.length) {

        ctx.fillStyle =
            "#5f6878";

        ctx.font =
            "12px Inter, sans-serif";

        ctx.textAlign =
            "center";

        ctx.fillText(
            "Add trades to generate your equity curve",
            width / 2,
            height / 2
        );

        return;

    }


    const values =
        points.map(
            p => p.equity
        );


    const min =
        Math.min(...values);

    const max =
        Math.max(...values);


    const range =
        max - min || 1;


    const getX =
        index =>
            padding +
            index *
            (width - padding * 2) /
            Math.max(1,points.length - 1);


    const getY =
        value =>
            height -
            padding -
            ((value - min) / range) *
            (height - padding * 2);


    /* Area */

    ctx.beginPath();

    points.forEach((point,index) => {

        const x =
            getX(index);

        const y =
            getY(point.equity);


        if (index === 0) {

            ctx.moveTo(x,y);

        } else {

            ctx.lineTo(x,y);

        }

    });


    ctx.lineTo(
        getX(points.length - 1),
        height - padding
    );

    ctx.lineTo(
        getX(0),
        height - padding
    );

    ctx.closePath();


    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            height
        );


    gradient.addColorStop(
        0,
        "rgba(215,173,85,.20)"
    );

    gradient.addColorStop(
        1,
        "rgba(215,173,85,0)"
    );


    ctx.fillStyle =
        gradient;

    ctx.fill();


    /* Equity line */

    ctx.beginPath();


    points.forEach((point,index) => {

        const x =
            getX(index);

        const y =
            getY(point.equity);


        if (index === 0) {

            ctx.moveTo(x,y);

        } else {

            ctx.lineTo(x,y);

        }

    });


    ctx.strokeStyle =
        "#d7ad55";

    ctx.lineWidth = 2.5;

    ctx.stroke();


    /* Points */

    points.forEach((point,index) => {

        const x =
            getX(index);

        const y =
            getY(point.equity);


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            3,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#f0cf78";

        ctx.fill();

    });


    /* Labels */

    ctx.fillStyle =
        "#687283";

    ctx.font =
        "9px Inter, sans-serif";

    ctx.textAlign =
        "left";

    ctx.fillText(
        formatMoney(max),
        padding,
        14
    );


    ctx.fillText(
        formatMoney(min),
        padding,
        height - 7
    );

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

function calculateRiskCalculator() {

    const balance =
        number($("calcBalance").value);

    const riskPercent =
        number($("calcRisk").value);

    const entry =
        number($("calcEntry").value);

    const sl =
        number($("calcSL").value);

    const tp =
        number($("calcTP").value);

    const direction =
        $("calcDirection").value;


    const riskAmount =
        balance *
        riskPercent /
        100;


    const distance =
        Math.abs(entry - sl);


    let risk = 0;

    let reward = 0;


    if (direction === "Buy") {

        risk =
            entry - sl;

        reward =
            tp - entry;

    } else {

        risk =
            sl - entry;

        reward =
            entry - tp;

    }


    const rr =
        risk > 0 &&
        reward > 0
            ? reward / risk
            : 0;


    const lot =
        distance > 0
            ? riskAmount /
              (distance * 100)
            : 0;


    $("calcRiskAmount").textContent =
        formatMoney(riskAmount);


    $("calcDistance").textContent =
        distance.toFixed(3);


    $("calcRR").textContent =
        rr > 0
            ? `1:${rr.toFixed(2)}`
            : "Invalid";


    $("calcLot").textContent =
        lot > 0
            ? lot.toFixed(2)
            : "0.00";

}


[
    "calcBalance",
    "calcRisk",
    "calcEntry",
    "calcSL",
    "calcTP",
    "calcDirection"
].forEach(id => {

    $(id).addEventListener(
        "input",
        calculateRiskCalculator
    );

    $(id).addEventListener(
        "change",
        calculateRiskCalculator
    );

});


$("calculateRiskBtn")
    .addEventListener(
        "click",
        calculateRiskCalculator
    );


/* =========================================================
   CALENDAR
========================================================= */

function renderCalendar() {

    const date =
        state.calendarDate;


    const year =
        date.getFullYear();

    const month =
        date.getMonth();


    $("calendarMonthLabel")
        .textContent =
        date.toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const previousDays =
        new Date(
            year,
            month,
            0
        ).getDate();


    const grid =
        $("calendarGrid");


    grid.innerHTML = "";


    const names =
        [
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat"
        ];


    names.forEach(name => {

        grid.innerHTML += `
            <div class="calendar-day-name">
                ${name}
            </div>
        `;

    });


    /* Previous month */

    for (
        let i = firstDay - 1;
        i >= 0;
        i--
    ) {

        const day =
            previousDays - i;


        grid.innerHTML += `
            <div class="calendar-day muted">
                <div class="calendar-number">${day}</div>
            </div>
        `;

    }


    /* Current month */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const dateString =
            `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


        const trades =
            state.trades.filter(
                t => t.date === dateString
            );


        const pl =
            trades.reduce(
                (sum,t) =>
                    sum + number(t.profitLoss),
                0
            );


        const isToday =
            dateString === todayString();


        let plHTML = "";


        if (trades.length) {

            plHTML = `

                <div class="calendar-pl ${
                    pl >= 0
                        ? "pl-positive"
                        : "pl-negative"
                }">
                    ${signedMoney(pl)}
                </div>

                <div class="calendar-trades">
                    ${trades.length} trade${trades.length === 1 ? "" : "s"}
                </div>

            `;

        }


        grid.innerHTML += `

            <div class="calendar-day ${
                isToday ? "today" : ""
            }">

                <div class="calendar-number">
                    ${day}
                </div>

                ${plHTML}

            </div>

        `;

    }


    /* Monthly stats */

    const monthTrades =
        state.trades.filter(t => {

            return (
                t.date &&
                Number(t.date.slice(0,4)) === year &&
                Number(t.date.slice(5,7)) === month + 1
            );

        });


    const monthPL =
        monthTrades.reduce(
            (sum,t) =>
                sum + number(t.profitLoss),
            0
        );


    const wins =
        monthTrades.filter(
            t => t.result === "Win"
        ).length;


    const losses =
        monthTrades.filter(
            t => t.result === "Loss"
        ).length;


    $("calendarMonthPL").textContent =
        signedMoney(monthPL);

    $("calendarWins").textContent =
        wins;

    $("calendarLosses").textContent =
        losses;

}


$("prevMonth").addEventListener("click", () => {

    state.calendarDate.setMonth(
        state.calendarDate.getMonth() - 1
    );

    renderCalendar();

});


$("nextMonth").addEventListener("click", () => {

    state.calendarDate.setMonth(
        state.calendarDate.getMonth() + 1
    );

    renderCalendar();

});


$("todayMonth").addEventListener("click", () => {

    state.calendarDate = new Date();

    renderCalendar();

});


/* =========================================================
   CSV EXPORT
========================================================= */

function csvEscape(value) {

    const text =
        String(value ?? "");

    return `"${text.replaceAll('"','""')}"`;

}


function exportCSV() {

    const trades =
        getFilteredTrades();


    if (!trades.length) {

        showToast("No trades to export.");

        return;

    }


    const headers = [

        "Date",
        "Time",
        "Pair",
        "Direction",
        "Entry",
        "SL",
        "TP",
        "RR",
        "Risk %",
        "Risk Amount",
        "Lot Size",
        "Setup",
        "Session",
        "HTF Bias",
        "Liquidity",
        "Confirmation",
        "Result",
        "Profit/Loss",
        "Confidence",
        "Psychology",
        "Mistake",
        "Notes"

    ];


    const rows =
        trades.map(trade => [

            trade.date,
            trade.time,
            trade.pair,
            trade.direction,
            trade.entry,
            trade.sl,
            trade.tp,
            trade.rr,
            trade.riskPercent,
            trade.riskAmount,
            trade.lotSize,
            trade.setup,
            trade.session,
            trade.htfBias,
            trade.liquidity,
            trade.confirmation,
            trade.result,
            trade.profitLoss,
            trade.confidence,
            trade.psychology,
            trade.mistake,
            trade.notes

        ].map(csvEscape).join(","));


    const csv =
        [
            headers.map(csvEscape).join(","),
            ...rows
        ].join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        `ujr-fx-trading-journal-${todayString()}.csv`;


    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showToast("CSV exported.");

}


$("exportCsvBtn")
    .addEventListener(
        "click",
        exportCSV
    );


/* =========================================================
   TOP DATE
========================================================= */

function updateTopDate() {

    $("topDate").textContent =
        new Date().toLocaleDateString(
            "en-US",
            {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );

}

updateTopDate();


/* =========================================================
   TOAST
========================================================= */

let toastTimer;


function showToast(message) {

    const toast =
        $("toast");


    toast.textContent =
        message;


    toast.classList.add("show");


    clearTimeout(toastTimer);


    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2600);

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

    renderDashboard();

    renderJournal();

    renderAnalytics();

    renderCalendar();

    calculateRiskCalculator();

}


/* =========================================================
   RESIZE CHARTS
========================================================= */

window.addEventListener(
    "resize",
    () => {

        const dashboardAnalytics =
            getAnalytics();


        drawEquityChart(
            $("equityCanvas"),
            dashboardAnalytics.equityPoints,
            false
        );


        drawEquityChart(
            $("analyticsEquityCanvas"),
            dashboardAnalytics.equityPoints,
            true
        );

    }
);


/* =========================================================
   START
========================================================= */

renderAll();
