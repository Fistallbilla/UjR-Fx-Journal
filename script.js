/* =========================================================
   UjR Fx Trading Journal
   Firebase + Firestore
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
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
    onSnapshot,
    query,
    orderBy
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


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let trades = [];

let unsubscribeTrades = null;

let unsubscribeSettings = null;

let userSettings = {
    startingBalance: 1000,
    currency: "USD"
};

let editingTradeId = null;

let manualLotOverride = false;

let calendarDate = new Date();

let toastTimer = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);


function number(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function todayString() {

    const date = new Date();

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function currentTimeString() {

    const date = new Date();

    const hours = String(date.getHours()).padStart(2, "0");

    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}


function formatDate(dateString) {

    if (!dateString) return "—";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}


function formatMoney(value, currency = userSettings.currency) {

    const amount = number(value);

    const symbols = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        NPR: "रू"
    };

    const symbol = symbols[currency] || "$";

    const prefix = amount < 0 ? "-" : "";

    return `${prefix}${symbol}${Math.abs(amount).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;
}


function formatNumber(value, decimals = 2) {

    return number(value).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );
}


function getResultClass(result) {

    if (result === "Win") return "result-win";

    if (result === "Loss") return "result-loss";

    return "result-be";
}


function getDirectionClass(direction) {

    return direction === "Buy"
        ? "direction-buy"
        : "direction-sell";
}


function showToast(message, type = "success") {

    const toast = $("toast");

    const icon = $("toastIcon");

    const text = $("toastMessage");

    if (!toast) return;

    text.textContent = message;

    icon.textContent =
        type === "error"
            ? "!"
            : "✓";

    icon.style.color =
        type === "error"
            ? "var(--red)"
            : "var(--green)";

    icon.style.background =
        type === "error"
            ? "var(--red-soft)"
            : "var(--green-soft)";

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 2800);
}


function getUserDocRef() {

    return doc(db, "users", currentUser.uid);

}


function getTradesCollection() {

    return collection(
        db,
        "users",
        currentUser.uid,
        "trades"
    );

}


/* =========================================================
   AUTHENTICATION
========================================================= */

$("loginBtn").addEventListener("click", async () => {

    $("loginError").textContent = "";

    try {

        await signInWithPopup(
            auth,
            googleProvider
        );

    } catch (error) {

        console.error(error);

        $("loginError").textContent =
            getFirebaseErrorMessage(error);

    }

});


$("logoutBtn").addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to logout.",
            "error"
        );

    }

});


function getFirebaseErrorMessage(error) {

    const code = error?.code || "";

    const messages = {

        "auth/popup-closed-by-user":
            "Login window was closed.",

        "auth/popup-blocked":
            "Your browser blocked the login popup.",

        "auth/cancelled-popup-request":
            "Login request was cancelled.",

        "auth/unauthorized-domain":
            "This website domain is not authorized in Firebase.",

        "auth/operation-not-allowed":
            "Google login is not enabled in Firebase.",

        "auth/api-key-not-valid":
            "Firebase API key is invalid. Copy the current Web App config from Firebase Console."

    };

    return messages[code] ||
        error?.message ||
        "Login failed.";
}


onAuthStateChanged(auth, async (user) => {

    if (user) {

        currentUser = user;

        await showApp();

    } else {

        currentUser = null;

        showLogin();

    }

});


async function showApp() {

    $("loginScreen").classList.add("hidden");

    $("app").classList.remove("hidden");

    updateUserUI();

    updateCurrentDate();

    await loadSettings();

    subscribeToTrades();

    navigateTo("dashboardPage");

}


function showLogin() {

    $("app").classList.add("hidden");

    $("loginScreen").classList.remove("hidden");

    if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;

    }

    if (unsubscribeSettings) {

        unsubscribeSettings();

        unsubscribeSettings = null;

    }

}


function updateUserUI() {

    if (!currentUser) return;

    $("userName").textContent =
        currentUser.displayName ||
        "Trader";

    $("userEmail").textContent =
        currentUser.email ||
        "—";

    $("userPhoto").src =
        currentUser.photoURL ||
        "logo.png";

}


function updateCurrentDate() {

    const now = new Date();

    $("currentDate").textContent =
        now.toLocaleDateString(
            "en-US",
            {
                weekday: "short",
                month: "short",
                day: "numeric"
            }
        );

}


/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings() {

    if (!currentUser) return;

    try {

        const snapshot =
            await getDoc(
                getUserDocRef()
            );

        if (snapshot.exists()) {

            const data = snapshot.data();

            userSettings = {

                startingBalance:
                    number(data.startingBalance) || 1000,

                currency:
                    data.currency || "USD"

            };

        } else {

            userSettings = {
                startingBalance: 1000,
                currency: "USD"
            };

            await setDoc(
                getUserDocRef(),
                userSettings,
                { merge: true }
            );

        }

        populateSettings();

    } catch (error) {

        console.error(
            "Settings error:",
            error
        );

    }

}


function populateSettings() {

    $("startingBalance").value =
        userSettings.startingBalance;

    $("currency").value =
        userSettings.currency;

    $("calcBalance").value =
        userSettings.startingBalance;

}


$("saveSettingsBtn").addEventListener(
    "click",
    async () => {

        if (!currentUser) return;

        const balance =
            number(
                $("startingBalance").value
            );

        const currency =
            $("currency").value;

        if (balance < 0) {

            showToast(
                "Starting balance cannot be negative.",
                "error"
            );

            return;

        }

        try {

            userSettings = {
                startingBalance: balance,
                currency
            };

            await setDoc(
                getUserDocRef(),
                userSettings,
                { merge: true }
            );

            $("calcBalance").value = balance;

            renderEverything();

            showToast(
                "Settings saved."
            );

        } catch (error) {

            console.error(error);

            showToast(
                "Could not save settings.",
                "error"
            );

        }

    }
);


/* =========================================================
   TRADES SUBSCRIPTION
========================================================= */

function subscribeToTrades() {

    if (!currentUser) return;

    if (unsubscribeTrades) {

        unsubscribeTrades();

    }

    const tradesRef =
        getTradesCollection();

    const tradesQuery =
        query(
            tradesRef,
            orderBy(
                "createdAt",
                "desc"
            )
        );

    unsubscribeTrades =
        onSnapshot(
            tradesQuery,
            (snapshot) => {

                trades =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderEverything();

            },
            (error) => {

                console.error(
                    "Trade listener:",
                    error
                );

                showToast(
                    "Could not load trades.",
                    "error"
                );

            }
        );

}


/* =========================================================
   NAVIGATION
========================================================= */

const navItems =
    document.querySelectorAll(
        ".nav-item"
    );


navItems.forEach(item => {

    item.addEventListener(
        "click",
        () => {

            const page =
                item.dataset.page;

            navigateTo(page);

        }
    );

});


document.querySelectorAll(
    "[data-page-target]"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            navigateTo(
                button.dataset.pageTarget
            );

        }
    );

});


function navigateTo(pageId) {

    document.querySelectorAll(
        ".page"
    ).forEach(page => {

        page.classList.remove(
            "active-page"
        );

    });


    const page = $(pageId);

    if (!page) return;

    page.classList.add(
        "active-page"
    );


    navItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.page === pageId
        );

    });


    const titles = {

        dashboardPage: [
            "TRADING DESK",
            "Dashboard"
        ],

        journalPage: [
            "TRADE DATABASE",
            "Trading Journal"
        ],

        analyticsPage: [
            "DATA & INSIGHTS",
            "Analytics"
        ],

        riskPage: [
            "POSITION PLANNING",
            "Risk Calculator"
        ],

        calendarPage: [
            "PERFORMANCE CALENDAR",
            "Trading Calendar"
        ],

        settingsPage: [
            "ACCOUNT CONFIGURATION",
            "Settings"
        ]

    };


    const title =
        titles[pageId] ||
        ["TRADING DESK", "Dashboard"];


    $("pageEyebrow").textContent =
        title[0];

    $("pageTitle").textContent =
        title[1];


    closeSidebar();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

$("mobileMenuBtn").addEventListener(
    "click",
    openSidebar
);


$("mobileCloseBtn").addEventListener(
    "click",
    closeSidebar
);


$("overlay").addEventListener(
    "click",
    closeSidebar
);


function openSidebar() {

    $("sidebar").classList.add("open");

    $("overlay").classList.add("show");

}


function closeSidebar() {

    $("sidebar").classList.remove("open");

    $("overlay").classList.remove("show");

}


/* =========================================================
   TRADE MODAL
========================================================= */

$("quickAddBtn").addEventListener(
    "click",
    openAddTradeModal
);


$("journalAddBtn").addEventListener(
    "click",
    openAddTradeModal
);


$("mobileAddBtn").addEventListener(
    "click",
    openAddTradeModal
);


$("closeModal").addEventListener(
    "click",
    closeTradeModal
);


$("cancelTrade").addEventListener(
    "click",
    closeTradeModal
);


$("tradeModal").querySelector(
    ".modal-backdrop"
).addEventListener(
    "click",
    closeTradeModal
);


function openAddTradeModal() {

    editingTradeId = null;

    manualLotOverride = false;

    $("tradeForm").reset();

    $("modalTitle").textContent =
        "Add Trade";

    $("tradeId").value = "";

    $("tradeDate").value =
        todayString();

    $("tradeTime").value =
        currentTimeString();

    $("pair").value =
        "XAUUSD";

    $("direction").value =
        "Buy";

    $("riskPercent").value =
        "1";

    $("result").value =
        "Win";

    $("riskAmount").value =
        calculateRiskAmount();

    $("lotSize").value = "";

    $("rr").value = "";

    $("tradeError").textContent = "";

    $("tradeModal").classList.remove(
        "hidden"
    );

    setTimeout(() => {

        $("entry").focus();

    }, 100);

}


function closeTradeModal() {

    $("tradeModal").classList.add(
        "hidden"
    );

}


/* =========================================================
   TRADE CALCULATIONS
========================================================= */

function calculateTradeRR() {

    const entry =
        number($("entry").value);

    const sl =
        number($("sl").value);

    const tp =
        number($("tp").value);

    const direction =
        $("direction").value;


    if (
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0
    ) {

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


    if (
        risk <= 0 ||
        reward <= 0
    ) {

        $("rr").value =
            "Invalid";

        return 0;

    }


    const rr =
        reward / risk;


    $("rr").value =
        `1:${rr.toFixed(2)}`;


    return rr;

}


function calculateRiskAmount() {

    const balance =
        userSettings.startingBalance;

    const riskPercent =
        number(
            $("riskPercent")?.value
        ) || 0;

    return balance *
        riskPercent /
        100;

}


function calculateAutoLot() {

    const entry =
        number($("entry").value);

    const sl =
        number($("sl").value);

    const riskAmount =
        number($("riskAmount").value);

    if (
        entry <= 0 ||
        sl <= 0 ||
        riskAmount <= 0
    ) {

        return 0;

    }


    const distance =
        Math.abs(entry - sl);


    if (distance <= 0) {

        return 0;

    }


    /*
        Simplified XAUUSD calculation:
        1 standard lot = approximately 100 oz.

        lot = risk amount / (SL distance × 100)
    */

    const lot =
        riskAmount /
        (distance * 100);


    return lot;

}


function updateTradeCalculations() {

    const riskAmount =
        calculateRiskAmount();


    $("riskAmount").value =
        riskAmount > 0
            ? riskAmount.toFixed(2)
            : "";


    calculateTradeRR();


    if (!manualLotOverride) {

        const lot =
            calculateAutoLot();

        $("lotSize").value =
            lot > 0
                ? lot.toFixed(2)
                : "";

    }

}


[
    "entry",
    "sl",
    "tp",
    "direction",
    "riskPercent"
].forEach(id => {

    $(id).addEventListener(
        "input",
        updateTradeCalculations
    );

    $(id).addEventListener(
        "change",
        updateTradeCalculations
    );

});


$("lotSize").addEventListener(
    "input",
    () => {

        manualLotOverride =
            $("lotSize").value !== "";

    }
);


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        $("tradeError").textContent = "";

        if (!currentUser) return;


        const entry =
            number($("entry").value);

        const sl =
            number($("sl").value);

        const tp =
            number($("tp").value);

        const direction =
            $("direction").value;

        const riskPercent =
            number($("riskPercent").value);


        if (
            entry <= 0 ||
            sl <= 0 ||
            tp <= 0
        ) {

            $("tradeError").textContent =
                "Please enter valid Entry, SL and TP values.";

            return;

        }


        let riskDistance;

        let rewardDistance;


        if (direction === "Buy") {

            riskDistance =
                entry - sl;

            rewardDistance =
                tp - entry;

        } else {

            riskDistance =
                sl - entry;

            rewardDistance =
                entry - tp;

        }


        if (
            riskDistance <= 0 ||
            rewardDistance <= 0
        ) {

            $("tradeError").textContent =
                "Your SL/TP does not match the selected direction.";

            return;

        }


        const rr =
            rewardDistance /
            riskDistance;


        const riskAmount =
            userSettings.startingBalance *
            riskPercent /
            100;


        const lot =
            number(
                $("lotSize").value
            ) ||
            calculateAutoLot();


        const profitLoss =
            number(
                $("profitLoss").value
            );


        const tradeData = {

            date:
                $("tradeDate").value,

            time:
                $("tradeTime").value,

            pair:
                $("pair").value,

            direction,

            entry,

            sl,

            tp,

            rr,

            riskPercent,

            riskAmount,

            lotSize:
                lot,

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
                $("notes").value,

            updatedAt:
                Date.now()

        };


        try {

            if (editingTradeId) {

                await updateDoc(
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "trades",
                        editingTradeId
                    ),
                    tradeData
                );

                showToast(
                    "Trade updated."
                );

            } else {

                tradeData.createdAt =
                    Date.now();

                await addDoc(
                    getTradesCollection(),
                    tradeData
                );

                showToast(
                    "Trade added."
                );

            }


            closeTradeModal();

        } catch (error) {

            console.error(error);

            $("tradeError").textContent =
                "Could not save the trade.";

        }

    }
);


/* =========================================================
   EDIT TRADE
========================================================= */

function editTrade(id) {

    const trade =
        trades.find(
            item => item.id === id
        );

    if (!trade) return;


    editingTradeId = id;

    manualLotOverride = true;


    $("modalTitle").textContent =
        "Edit Trade";


    $("tradeId").value =
        id;


    $("tradeDate").value =
        trade.date || todayString();

    $("tradeTime").value =
        trade.time || "";

    $("pair").value =
        trade.pair || "XAUUSD";

    $("direction").value =
        trade.direction || "Buy";

    $("entry").value =
        trade.entry ?? "";

    $("sl").value =
        trade.sl ?? "";

    $("tp").value =
        trade.tp ?? "";

    $("riskPercent").value =
        trade.riskPercent ?? 1;

    $("riskAmount").value =
        trade.riskAmount ?? "";

    $("lotSize").value =
        trade.lotSize ?? "";

    $("setup").value =
        trade.setup || "";

    $("session").value =
        trade.session || "";

    $("htfBias").value =
        trade.htfBias || "";

    $("liquidity").value =
        trade.liquidity || "";

    $("confirmation").value =
        trade.confirmation || "";

    $("result").value =
        trade.result || "Win";

    $("profitLoss").value =
        trade.profitLoss ?? "";

    $("confidence").value =
        trade.confidence || "";

    $("psychology").value =
        trade.psychology || "";

    $("mistake").value =
        trade.mistake || "";

    $("notes").value =
        trade.notes || "";


    calculateTradeRR();


    $("tradeError").textContent = "";

    $("tradeModal").classList.remove(
        "hidden"
    );

}


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(id) {

    const trade =
        trades.find(
            item => item.id === id
        );

    if (!trade) return;


    const confirmed =
        window.confirm(
            `Delete the ${trade.pair || "trade"} from ${formatDate(trade.date)}?`
        );


    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "trades",
                id
            )
        );

        showToast(
            "Trade deleted."
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Could not delete trade.",
            "error"
        );

    }

}


/* =========================================================
   FILTERS
========================================================= */

[
    "filterResult",
    "filterPair",
    "filterDate"
].forEach(id => {

    $(id).addEventListener(
        "input",
        renderJournal
    );

    $(id).addEventListener(
        "change",
        renderJournal
    );

});


$("clearFilters").addEventListener(
    "click",
    () => {

        $("filterResult").value = "";

        $("filterPair").value = "";

        $("filterDate").value = "";

        renderJournal();

    }
);


function getFilteredTrades() {

    const result =
        $("filterResult").value;

    const pair =
        $("filterPair").value;

    const date =
        $("filterDate").value;


    return trades.filter(
        trade => {

            if (
                result &&
                trade.result !== result
            ) {
                return false;
            }


            if (
                pair &&
                trade.pair !== pair
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

        }
    );

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

    const total =
        trades.length;


    const wins =
        trades.filter(
            t => t.result === "Win"
        ).length;


    const losses =
        trades.filter(
            t => t.result === "Loss"
        ).length;


    const breakevens =
        trades.filter(
            t => t.result === "Breakeven"
        ).length;


    const totalPL =
        trades.reduce(
            (sum, trade) =>
                sum + number(trade.profitLoss),
            0
        );


    const winRate =
        total > 0
            ? wins / total * 100
            : 0;


    const starting =
        number(
            userSettings.startingBalance
        );


    const currentBalance =
        starting + totalPL;


    $("totalTrades").textContent =
        total;


    $("dashboardWins").textContent =
        wins;


    $("dashboardLosses").textContent =
        losses;


    $("winRate").textContent =
        `${winRate.toFixed(1)}%`;


    $("totalPL").textContent =
        formatMoney(totalPL);


    $("currentBalance").textContent =
        formatMoney(currentBalance);


    $("balanceChange").textContent =
        formatMoney(totalPL);


    $("balanceChange").className =
        totalPL > 0
            ? "positive"
            : totalPL < 0
                ? "negative"
                : "neutral-text";


    $("totalPL").className =
        `stat-value ${
            totalPL > 0
                ? "positive"
                : totalPL < 0
                    ? "negative"
                    : ""
        }`;


    $("dashboardWinBar").style.width =
        `${Math.min(winRate, 100)}%`;


    const grossProfit =
        trades
            .filter(
                t => number(t.profitLoss) > 0
            )
            .reduce(
                (sum, t) =>
                    sum + number(t.profitLoss),
                0
            );


    const grossLoss =
        Math.abs(
            trades
                .filter(
                    t => number(t.profitLoss) < 0
                )
                .reduce(
                    (sum, t) =>
                        sum + number(t.profitLoss),
                    0
                )
        );


    const profitFactor =
        grossLoss > 0
            ? grossProfit / grossLoss
            : grossProfit > 0
                ? Infinity
                : 0;


    const rrValues =
        trades
            .map(t => number(t.rr))
            .filter(v => v > 0);


    const avgRR =
        rrValues.length
            ? rrValues.reduce(
                (a, b) => a + b,
                0
            ) / rrValues.length
            : 0;


    const winsPL =
        trades
            .filter(
                t => number(t.profitLoss) > 0
            )
            .map(
                t => number(t.profitLoss)
            );


    const lossesPL =
        trades
            .filter(
                t => number(t.profitLoss) < 0
            )
            .map(
                t => number(t.profitLoss)
            );


    const avgWin =
        winsPL.length
            ? winsPL.reduce(
                (a, b) => a + b,
                0
            ) / winsPL.length
            : 0;


    const avgLoss =
        lossesPL.length
            ? lossesPL.reduce(
                (a, b) => a + b,
                0
            ) / lossesPL.length
            : 0;


    $("dashboardProfitFactor").textContent =
        grossLoss > 0
            ? profitFactor.toFixed(2)
            : grossProfit > 0
                ? "∞"
                : "—";


    $("dashboardAverageR").textContent =
        avgRR > 0
            ? `1:${avgRR.toFixed(2)}`
            : "—";


    $("dashboardAverageWin").textContent =
        formatMoney(avgWin);


    $("dashboardAverageLoss").textContent =
        formatMoney(avgLoss);


    renderRecentTrades();

    renderEquityChart();

    renderDonut(
        wins,
        losses,
        breakevens
    );

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

    const body =
        $("recentTradesBody");


    const recent =
        [...trades]
            .sort(
                (a, b) =>
                    number(b.createdAt) -
                    number(a.createdAt)
            )
            .slice(0, 7);


    body.innerHTML = "";


    $("recentEmpty").classList.toggle(
        "hidden",
        recent.length > 0
    );


    recent.forEach(trade => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHtml(formatDate(trade.date))}
            </td>

            <td>
                <strong>
                    ${escapeHtml(trade.pair || "—")}
                </strong>
            </td>

            <td class="${getDirectionClass(trade.direction)}">
                ${escapeHtml(trade.direction || "—")}
            </td>

            <td>
                ${escapeHtml(trade.setup || "—")}
            </td>

            <td>
                ${trade.rr > 0
                    ? `1:${number(trade.rr).toFixed(2)}`
                    : "—"
                }
            </td>

            <td>
                <span class="result-chip ${getResultClass(trade.result)}">
                    ${escapeHtml(trade.result || "—")}
                </span>
            </td>

            <td class="${
                number(trade.profitLoss) > 0
                    ? "positive"
                    : number(trade.profitLoss) < 0
                        ? "negative"
                        : ""
            }">

                ${formatMoney(trade.profitLoss)}

            </td>

        `;


        body.appendChild(row);

    });

}


/* =========================================================
   EQUITY CHART
========================================================= */

function renderEquityChart() {

    const canvas =
        $("equityCanvas");

    if (!canvas) return;


    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio || 1;


    const width =
        Math.max(rect.width, 300);

    const height =
        Math.max(rect.height, 220);


    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;


    const ctx =
        canvas.getContext("2d");


    ctx.scale(dpr, dpr);


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const sorted =
        [...trades]
            .sort(
                (a, b) =>
                    number(a.createdAt) -
                    number(b.createdAt)
            );


    const values = [];

    let equity =
        number(
            userSettings.startingBalance
        );


    values.push(equity);


    sorted.forEach(trade => {

        equity +=
            number(trade.profitLoss);

        values.push(equity);

    });


    if (values.length < 2) {

        drawChartEmpty(
            ctx,
            width,
            height
        );

        return;

    }


    const padding = {
        left: 10,
        right: 10,
        top: 20,
        bottom: 28
    };


    const min =
        Math.min(...values);

    const max =
        Math.max(...values);


    const range =
        Math.max(max - min, 1);


    const chartWidth =
        width -
        padding.left -
        padding.right;


    const chartHeight =
        height -
        padding.top -
        padding.bottom;


    /* GRID */

    ctx.strokeStyle =
        "rgba(255,255,255,0.055)";

    ctx.lineWidth = 1;


    for (
        let i = 0;
        i <= 4;
        i++
    ) {

        const y =
            padding.top +
            chartHeight *
            (i / 4);


        ctx.beginPath();

        ctx.moveTo(
            padding.left,
            y
        );

        ctx.lineTo(
            width - padding.right,
            y
        );

        ctx.stroke();

    }


    /* AREA */

    const points =
        values.map(
            (value, index) => {

                const x =
                    padding.left +
                    chartWidth *
                    (
                        index /
                        (values.length - 1)
                    );


                const y =
                    padding.top +
                    chartHeight *
                    (
                        1 -
                        (value - min) /
                        range
                    );


                return {
                    x,
                    y
                };

            }
        );


    const gradient =
        ctx.createLinearGradient(
            0,
            padding.top,
            0,
            height
        );


    gradient.addColorStop(
        0,
        "rgba(216,168,78,0.20)"
    );


    gradient.addColorStop(
        1,
        "rgba(216,168,78,0)"
    );


    ctx.beginPath();

    ctx.moveTo(
        points[0].x,
        height - padding.bottom
    );


    points.forEach(
        point => {

            ctx.lineTo(
                point.x,
                point.y
            );

        }
    );


    ctx.lineTo(
        points[points.length - 1].x,
        height - padding.bottom
    );


    ctx.closePath();

    ctx.fillStyle =
        gradient;

    ctx.fill();


    /* LINE */

    ctx.beginPath();

    points.forEach(
        (point, index) => {

            if (index === 0) {

                ctx.moveTo(
                    point.x,
                    point.y
                );

            } else {

                ctx.lineTo(
                    point.x,
                    point.y
                );

            }

        }
    );


    ctx.strokeStyle =
        "#e2b85a";

    ctx.lineWidth = 2;

    ctx.stroke();


    /* LAST POINT */

    const last =
        points[points.length - 1];


    ctx.beginPath();

    ctx.arc(
        last.x,
        last.y,
        4,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#e2b85a";

    ctx.fill();


    ctx.beginPath();

    ctx.arc(
        last.x,
        last.y,
        8,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle =
        "rgba(226,184,90,0.2)";

    ctx.stroke();


    /* LABEL */

    ctx.fillStyle =
        "#697281";

    ctx.font =
        "9px Inter, system-ui";


    ctx.fillText(
        formatMoney(max),
        10,
        12
    );


    ctx.fillText(
        formatMoney(min),
        10,
        height - 7
    );

}


function drawChartEmpty(
    ctx,
    width,
    height
) {

    ctx.fillStyle =
        "#596170";

    ctx.font =
        "11px Inter, system-ui";

    ctx.textAlign = "center";

    ctx.fillText(
        "Add trades to build your equity curve",
        width / 2,
        height / 2
    );

    ctx.textAlign = "left";

}


/* =========================================================
   DONUT
========================================================= */

function renderDonut(
    wins,
    losses,
    breakevens
) {

    const total =
        wins +
        losses +
        breakevens;


    $("donutTotal").textContent =
        total;

    $("donutWins").textContent =
        wins;

    $("donutLosses").textContent =
        losses;

    $("donutBE").textContent =
        breakevens;


    if (!total) {

        $("resultDonut").style.background =
            "conic-gradient(#343b48 0deg 360deg)";

        return;

    }


    const winDeg =
        wins / total * 360;

    const lossDeg =
        losses / total * 360;


    $("resultDonut").style.background =
        `
        conic-gradient(
            var(--green)
            0deg ${winDeg}deg,

            var(--red)
            ${winDeg}deg
            ${winDeg + lossDeg}deg,

            #697384
            ${winDeg + lossDeg}deg
            360deg
        )
        `;

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

    const filtered =
        getFilteredTrades();


    const wins =
        filtered.filter(
            t => t.result === "Win"
        ).length;


    const losses =
        filtered.filter(
            t => t.result === "Loss"
        ).length;


    const pl =
        filtered.reduce(
            (sum, t) =>
                sum + number(t.profitLoss),
            0
        );


    $("journalTrades").textContent =
        filtered.length;

    $("journalWins").textContent =
        wins;

    $("journalLosses").textContent =
        losses;

    $("journalPL").textContent =
        formatMoney(pl);


    $("journalPL").className =
        pl > 0
            ? "positive"
            : pl < 0
                ? "negative"
                : "";


    const body =
        $("journalTableBody");


    body.innerHTML = "";


    $("journalEmpty").classList.toggle(
        "hidden",
        filtered.length > 0
    );


    filtered.forEach(trade => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${escapeHtml(formatDate(trade.date))}
            </td>

            <td>
                <strong>
                    ${escapeHtml(trade.pair || "—")}
                </strong>
            </td>

            <td class="${getDirectionClass(trade.direction)}">
                ${escapeHtml(trade.direction || "—")}
            </td>

            <td>
                ${trade.entry !== undefined
                    ? formatNumber(trade.entry, 2)
                    : "—"
                }
            </td>

            <td>
                ${trade.rr > 0
                    ? `1:${number(trade.rr).toFixed(2)}`
                    : "—"
                }
            </td>

            <td>
                ${trade.riskPercent !== undefined
                    ? `${number(trade.riskPercent).toFixed(1)}%`
                    : "—"
                }
            </td>

            <td>
                <span class="result-chip ${getResultClass(trade.result)}">
                    ${escapeHtml(trade.result || "—")}
                </span>
            </td>

            <td class="${
                number(trade.profitLoss) > 0
                    ? "positive"
                    : number(trade.profitLoss) < 0
                        ? "negative"
                        : ""
            }">
                ${formatMoney(trade.profitLoss)}
            </td>

            <td>

                <div class="action-group">

                    <button
                        class="icon-action"
                        title="Edit"
                        data-action="edit"
                        data-id="${trade.id}"
                    >
                        ✎
                    </button>

                    <button
                        class="icon-action delete"
                        title="Delete"
                        data-action="delete"
                        data-id="${trade.id}"
                    >
                        ×
                    </button>

                </div>

            </td>

        `;


        body.appendChild(row);

    });

}


$("journalTableBody").addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-action]"
            );

        if (!button) return;


        const id =
            button.dataset.id;


        if (
            button.dataset.action ===
            "edit"
        ) {

            editTrade(id);

        }


        if (
            button.dataset.action ===
            "delete"
        ) {

            deleteTrade(id);

        }

    }
);


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

    const total =
        trades.length;


    const wins =
        trades.filter(
            t => t.result === "Win"
        ).length;


    const losses =
        trades.filter(
            t => t.result === "Loss"
        ).length;


    const be =
        trades.filter(
            t => t.result === "Breakeven"
        ).length;


    const winRate =
        total
            ? wins / total * 100
            : 0;


    const pl =
        trades.reduce(
            (sum, t) =>
                sum + number(t.profitLoss),
            0
        );


    const rrValues =
        trades
            .map(
                t => number(t.rr)
            )
            .filter(
                v => v > 0
            );


    const avgRR =
        rrValues.length
            ? rrValues.reduce(
                (a, b) => a + b,
                0
            ) / rrValues.length
            : 0;


    const positivePL =
        trades
            .filter(
                t => number(t.profitLoss) > 0
            )
            .map(
                t => number(t.profitLoss)
            );


    const negativePL =
        trades
            .filter(
                t => number(t.profitLoss) < 0
            )
            .map(
                t => number(t.profitLoss)
            );


    const grossProfit =
        positivePL.reduce(
            (a, b) => a + b,
            0
        );


    const grossLoss =
        Math.abs(
            negativePL.reduce(
                (a, b) => a + b,
                0
            )
        );


    const avgWin =
        positivePL.length
            ? grossProfit /
              positivePL.length
            : 0;


    const avgLoss =
        negativePL.length
            ? (
                negativePL.reduce(
                    (a, b) => a + b,
                    0
                ) /
                negativePL.length
            )
            : 0;


    const best =
        positivePL.length
            ? Math.max(...positivePL)
            : 0;


    const worst =
        negativePL.length
            ? Math.min(...negativePL)
            : 0;


    $("analyticsTrades").textContent =
        total;


    $("analyticsWinRate").textContent =
        `${winRate.toFixed(1)}%`;


    $("analyticsRR").textContent =
        avgRR > 0
            ? `1:${avgRR.toFixed(2)}`
            : "—";


    $("analyticsPL").textContent =
        formatMoney(pl);


    $("analyticsPL").className =
        pl > 0
            ? "positive"
            : pl < 0
                ? "negative"
                : "";


    $("analyticsWins").textContent =
        wins;


    $("analyticsLosses").textContent =
        losses;


    $("analyticsBE").textContent =
        be;


    $("winBar").style.width =
        total
            ? `${wins / total * 100}%`
            : "0%";


    $("lossBar").style.width =
        total
            ? `${losses / total * 100}%`
            : "0%";


    $("beBar").style.width =
        total
            ? `${be / total * 100}%`
            : "0%";


    $("avgWin").textContent =
        formatMoney(avgWin);


    $("avgLoss").textContent =
        formatMoney(avgLoss);


    $("bestTrade").textContent =
        formatMoney(best);


    $("worstTrade").textContent =
        formatMoney(worst);


    $("analyticsProfitFactor").textContent =
        grossLoss > 0
            ? (
                grossProfit /
                grossLoss
            ).toFixed(2)
            : grossProfit > 0
                ? "∞"
                : "—";


    renderBreakdown(
        "sessionBreakdown",
        "session"
    );


    renderBreakdown(
        "setupBreakdown",
        "setup"
    );

}


function renderBreakdown(
    containerId,
    field
) {

    const container =
        $(containerId);


    const groups = {};


    trades.forEach(
        trade => {

            const key =
                trade[field] ||
                "Not specified";


            if (!groups[key]) {

                groups[key] = {
                    count: 0,
                    pl: 0
                };

            }


            groups[key].count++;

            groups[key].pl +=
                number(trade.profitLoss);

        }
    );


    const entries =
        Object.entries(groups)
            .sort(
                (a, b) =>
                    b[1].count -
                    a[1].count
            );


    if (!entries.length) {

        container.innerHTML = `
            <div class="empty-state compact-empty">
                <p>No data yet.</p>
            </div>
        `;

        return;

    }


    const maxCount =
        Math.max(
            ...entries.map(
                item => item[1].count
            )
        );


    container.innerHTML =
        entries.map(
            ([name, data]) => `

                <div class="breakdown-item">

                    <div class="breakdown-top">

                        <span>
                            ${escapeHtml(name)}
                        </span>

                        <strong class="${
                            data.pl > 0
                                ? "positive"
                                : data.pl < 0
                                    ? "negative"
                                    : ""
                        }">

                            ${data.count}
                            ·
                            ${formatMoney(data.pl)}

                        </strong>

                    </div>

                    <div class="breakdown-track">

                        <div
                            class="breakdown-fill"
                            style="width:${(
                                data.count /
                                maxCount *
                                100
                            ).toFixed(1)}%"
                        ></div>

                    </div>

                </div>

            `
        )
        .join("");

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

$("calculateRiskBtn").addEventListener(
    "click",
    calculateRisk
);


function calculateRisk() {

    const balance =
        number(
            $("calcBalance").value
        );


    const riskPercent =
        number(
            $("calcRisk").value
        );


    const entry =
        number(
            $("calcEntry").value
        );


    const sl =
        number(
            $("calcSL").value
        );


    const tp =
        number(
            $("calcTP").value
        );


    const direction =
        $("calcDirection").value;


    const riskAmount =
        balance *
        riskPercent /
        100;


    let distance = 0;

    let reward = 0;


    if (direction === "Buy") {

        distance =
            entry - sl;

        reward =
            tp - entry;

    } else {

        distance =
            sl - entry;

        reward =
            entry - tp;

    }


    $("calcRiskAmount").textContent =
        formatMoney(riskAmount);


    if (
        balance <= 0 ||
        riskPercent <= 0 ||
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0 ||
        distance <= 0 ||
        reward <= 0
    ) {

        $("calcDistance").textContent =
            "Invalid";

        $("calcRR").textContent =
            "Invalid";

        $("calcLot").textContent =
            "—";

        return;

    }


    const rr =
        reward / distance;


    const lot =
        riskAmount /
        (distance * 100);


    $("calcDistance").textContent =
        formatNumber(
            Math.abs(distance),
            2
        );


    $("calcRR").textContent =
        `1:${rr.toFixed(2)}`;


    $("calcLot").textContent =
        lot.toFixed(2);

}


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth").addEventListener(
    "click",
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() - 1
        );

        renderCalendar();

    }
);


$("nextMonth").addEventListener(
    "click",
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() + 1
        );

        renderCalendar();

    }
);


$("todayMonth").addEventListener(
    "click",
    () => {

        calendarDate =
            new Date();

        renderCalendar();

    }
);


function renderCalendar() {

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();


    $("calendarMonthLabel").textContent =
        calendarDate.toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );


    const monthTrades =
        trades.filter(
            trade => {

                if (!trade.date)
                    return false;

                const date =
                    new Date(
                        `${trade.date}T00:00:00`
                    );

                return (
                    date.getFullYear() === year &&
                    date.getMonth() === month
                );

            }
        );


    const monthPL =
        monthTrades.reduce(
            (sum, trade) =>
                sum +
                number(trade.profitLoss),
            0
        );


    const monthWins =
        monthTrades.filter(
            t => t.result === "Win"
        ).length;


    const monthLosses =
        monthTrades.filter(
            t => t.result === "Loss"
        ).length;


    $("calendarMonthPL").textContent =
        formatMoney(monthPL);


    $("calendarMonthPL").className =
        monthPL > 0
            ? "positive"
            : monthPL < 0
                ? "negative"
                : "";


    $("calendarWins").textContent =
        monthWins;


    $("calendarLosses").textContent =
        monthLosses;


    const grid =
        $("calendarGrid");


    grid.innerHTML = "";


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    /*
        Convert Sunday=0 into
        Monday=0.
    */

    const startOffset =
        (
            firstDay.getDay() +
            6
        ) % 7;


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const previousMonthDays =
        new Date(
            year,
            month,
            0
        ).getDate();


    const totalCells =
        Math.ceil(
            (
                startOffset +
                daysInMonth
            ) / 7
        ) * 7;


    const today =
        todayString();


    for (
        let i = 0;
        i < totalCells;
        i++
    ) {

        let dayNumber;

        let cellDate;

        let isOtherMonth = false;


        if (i < startOffset) {

            dayNumber =
                previousMonthDays -
                startOffset +
                i +
                1;

            cellDate =
                new Date(
                    year,
                    month - 1,
                    dayNumber
                );

            isOtherMonth = true;

        } else if (
            i >=
            startOffset +
            daysInMonth
        ) {

            dayNumber =
                i -
                (
                    startOffset +
                    daysInMonth
                ) +
                1;

            cellDate =
                new Date(
                    year,
                    month + 1,
                    dayNumber
                );

            isOtherMonth = true;

        } else {

            dayNumber =
                i -
                startOffset +
                1;

            cellDate =
                new Date(
                    year,
                    month,
                    dayNumber
                );

        }


        const dateKey =
            `${cellDate.getFullYear()}-${
                String(
                    cellDate.getMonth() + 1
                ).padStart(2, "0")
            }-${
                String(
                    cellDate.getDate()
                ).padStart(2, "0")
            }`;


        const dayTrades =
            trades.filter(
                trade =>
                    trade.date === dateKey
            );


        const dayPL =
            dayTrades.reduce(
                (sum, trade) =>
                    sum +
                    number(trade.profitLoss),
                0
            );


        const cell =
            document.createElement("div");


        cell.className =
            "calendar-day";


        if (isOtherMonth) {

            cell.classList.add(
                "other-month"
            );

        }


        if (dateKey === today) {

            cell.classList.add(
                "today"
            );

        }


        let resultHTML = "";


        if (dayTrades.length > 0) {

            resultHTML = `

                <div class="day-result">

                    <div class="day-pl ${
                        dayPL > 0
                            ? "positive"
                            : dayPL < 0
                                ? "negative"
                                : ""
                    }">

                        ${formatMoney(dayPL)}

                    </div>

                    <div class="day-count">

                        ${dayTrades.length}
                        trade${dayTrades.length === 1 ? "" : "s"}

                    </div>

                </div>

            `;

        }


        cell.innerHTML = `

            <div class="day-number">
                ${dayNumber}
            </div>

            ${resultHTML}

        `;


        grid.appendChild(cell);

    }

}


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn").addEventListener(
    "click",
    exportCSV
);


function exportCSV() {

    if (!trades.length) {

        showToast(
            "There are no trades to export.",
            "error"
        );

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
        trades.map(
            trade => [

                trade.date || "",

                trade.time || "",

                trade.pair || "",

                trade.direction || "",

                trade.entry ?? "",

                trade.sl ?? "",

                trade.tp ?? "",

                trade.rr ?? "",

                trade.riskPercent ?? "",

                trade.riskAmount ?? "",

                trade.lotSize ?? "",

                trade.setup || "",

                trade.session || "",

                trade.htfBias || "",

                trade.liquidity || "",

                trade.confirmation || "",

                trade.result || "",

                trade.profitLoss ?? "",

                trade.confidence || "",

                trade.psychology || "",

                trade.mistake || "",

                trade.notes || ""

            ]
        );


    const csv = [

        headers,
        ...rows

    ]
        .map(
            row =>
                row
                    .map(
                        value =>
                            `"${String(value)
                                .replace(/"/g, '""')}"`
                    )
                    .join(",")
        )
        .join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type: "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        `UjR-Fx-Trading-Journal-${todayString()}.csv`;


    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);


    showToast(
        "CSV exported."
    );

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderEverything() {

    renderDashboard();

    renderJournal();

    renderAnalytics();

    renderCalendar();

}


/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        if (
            $("dashboardPage")
                .classList
                .contains("active-page")
        ) {

            renderEquityChart();

        }

    }
);


/* =========================================================
   KEYBOARD SHORTCUT
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        const tag =
            document.activeElement?.tagName;


        if (
            event.key.toLowerCase() === "n" &&
            tag !== "INPUT" &&
            tag !== "TEXTAREA" &&
            tag !== "SELECT"
        ) {

            openAddTradeModal();

        }


        if (
            event.key === "Escape" &&
            !$("tradeModal")
                .classList
                .contains("hidden")
        ) {

            closeTradeModal();

        }

    }
);


/* =========================================================
   INITIAL UI
========================================================= */

$("tradeDate").value =
    todayString();

$("tradeTime").value =
    currentTimeString();

$("calcBalance").value =
    userSettings.startingBalance;


/* =========================================================
   END
========================================================= */
