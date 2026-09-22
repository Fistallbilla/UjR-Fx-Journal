// ======================================================
// UjR Fx Journal - Complete JavaScript
// ======================================================

// ---------- FIREBASE IMPORTS ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ======================================================
// FIREBASE CONFIG
// ======================================================

const firebaseConfig = {
    apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
    authDomain: "journal-38e0e.firebaseapp.com",
    projectId: "journal-38e0e",
    storageBucket: "journal-38e0e.firebasestorage.app",
    messagingSenderId: "382226906837",
    appId: "1:382226906837:web:38df881c0f7beb24256c5c",
    measurementId: "G-R6LXDMQ9K2"
};


// ======================================================
// INITIALIZE FIREBASE
// ======================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

let currentUser = null;
let unsubscribeTrades = null;


// ======================================================
// ELEMENTS
// ======================================================

const loginScreen = document.getElementById("loginScreen");
const appContainer = document.getElementById("app");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const userName = document.getElementById("userName");
const userPhoto = document.getElementById("userPhoto");

const tradeForm = document.getElementById("tradeForm");
const tradeTableBody = document.getElementById("tradeTableBody");


// ======================================================
// DEFAULT DATE
// ======================================================

function setToday() {

    const dateInput = document.getElementById("date");

    if (!dateInput) return;

    const today = new Date();

    const year = today.getFullYear();

    const month = String(today.getMonth() + 1).padStart(2, "0");

    const day = String(today.getDate()).padStart(2, "0");

    dateInput.value = `${year}-${month}-${day}`;
}

setToday();


// ======================================================
// GOOGLE LOGIN
// ======================================================

if (googleLoginBtn) {

    googleLoginBtn.addEventListener("click", async () => {

        try {

            googleLoginBtn.disabled = true;
            googleLoginBtn.textContent = "Signing in...";

            await signInWithPopup(auth, provider);

        } catch (error) {

            console.error("Login error:", error);

            alert("Login failed: " + error.message);

            googleLoginBtn.disabled = false;
            googleLoginBtn.textContent = "Continue with Google";
        }

    });

}


// ======================================================
// LOGOUT
// ======================================================

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        try {

            await signOut(auth);

        } catch (error) {

            console.error("Logout error:", error);

            alert("Logout failed.");
        }

    });

}


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(auth, user => {

    if (user) {

        // User logged in
        currentUser = user;

        if (loginScreen) {
            loginScreen.style.display = "none";
        }

        if (appContainer) {
            appContainer.style.display = "block";
        }

        if (userName) {
            userName.textContent = user.displayName || "Trader";
        }

        if (userPhoto) {

            if (user.photoURL) {
                userPhoto.src = user.photoURL;
                userPhoto.style.display = "block";
            } else {
                userPhoto.style.display = "none";
            }
        }

        // Load trades
        loadTrades();

    } else {

        // User logged out
        currentUser = null;

        if (loginScreen) {
            loginScreen.style.display = "flex";
        }

        if (appContainer) {
            appContainer.style.display = "none";
        }

        if (unsubscribeTrades) {

            unsubscribeTrades();

            unsubscribeTrades = null;
        }
    }

});


// ======================================================
// SAVE TRADE
// ======================================================

if (tradeForm) {

    tradeForm.addEventListener("submit", async event => {

        event.preventDefault();

        if (!currentUser) {

            alert("Please login first.");

            return;
        }


        // ---------- GET FORM VALUES ----------

        const date = document.getElementById("date").value;

        const pair = document.getElementById("pair").value;

        const direction = document.getElementById("direction").value;

        const entry = Number(document.getElementById("entry").value);

        const sl = Number(document.getElementById("sl").value);

        const tp = Number(document.getElementById("tp").value);

        const setup = document.getElementById("setup").value;

        const result = document.getElementById("result").value;

        const profit = Number(document.getElementById("profit").value);

        const mistake = document.getElementById("mistake").value;

        const notes = document.getElementById("notes").value;


        // ==================================================
        // AUTOMATIC TIME
        // 12-HOUR FORMAT + AM/PM
        // ==================================================

        const now = new Date();

        const time = now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });


        // ==================================================
        // CALCULATE R:R
        // ==================================================

        let risk = Math.abs(entry - sl);

        let reward = Math.abs(tp - entry);

        let rr = 0;

        if (risk > 0) {

            rr = reward / risk;
        }


        // ==================================================
        // SAVE TO FIREBASE
        // ==================================================

        try {

            const saveButton = tradeForm.querySelector(
                'button[type="submit"]'
            );

            if (saveButton) {

                saveButton.disabled = true;

                saveButton.textContent = "Saving...";
            }


            const tradesRef = collection(
                db,
                "users",
                currentUser.uid,
                "trades"
            );


            await addDoc(tradesRef, {

                date: date,

                time: time,

                pair: pair,

                direction: direction,

                entry: entry,

                sl: sl,

                tp: tp,

                setup: setup,

                result: result,

                profit: profit,

                mistake: mistake,

                notes: notes,

                rr: rr,

                createdAt: serverTimestamp()

            });


            // Success

            alert("Trade saved successfully! ✅");


            // Reset form

            tradeForm.reset();

            setToday();


            // Default values

            const pairInput = document.getElementById("pair");

            if (pairInput) {
                pairInput.value = "XAUUSD";
            }


        } catch (error) {

            console.error("Save trade error:", error);

            alert(
                "Trade could not be saved.\n\n" +
                error.message
            );

        } finally {

            const saveButton = tradeForm.querySelector(
                'button[type="submit"]'
            );

            if (saveButton) {

                saveButton.disabled = false;

                saveButton.textContent = "Save Trade";
            }
        }

    });

}


// ======================================================
// LOAD TRADES FROM FIREBASE
// ======================================================

function loadTrades() {

    if (!currentUser) return;


    if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;
    }


    const tradesRef = collection(
        db,
        "users",
        currentUser.uid,
        "trades"
    );


    unsubscribeTrades = onSnapshot(
        tradesRef,

        snapshot => {

            const trades = [];


            snapshot.forEach(documentSnapshot => {

                trades.push({

                    id: documentSnapshot.id,

                    ...documentSnapshot.data()

                });

            });


            // Newest first
            trades.sort((a, b) => {

                const dateA = `${a.date || ""} ${a.time || ""}`;

                const dateB = `${b.date || ""} ${b.time || ""}`;

                return dateB.localeCompare(dateA);
            });


            updateDashboard(trades);

            updateTradeTable(trades);

            updateWeeklyStats(trades);

            updateMonthlyStats(trades);

        },

        error => {

            console.error(
                "Firestore loading error:",
                error
            );

            alert(
                "Could not load your trades.\n\n" +
                error.message
            );

        }
    );

}


// ======================================================
// DASHBOARD
// ======================================================

function updateDashboard(trades) {

    const totalTrades = trades.length;

    const wins = trades.filter(
        trade => trade.result === "Win"
    ).length;

    const losses = trades.filter(
        trade => trade.result === "Loss"
    ).length;


    const winRate =
        totalTrades > 0
            ? (wins / totalTrades) * 100
            : 0;


    const totalPL = trades.reduce(
        (sum, trade) =>
            sum + Number(trade.profit || 0),
        0
    );


    setText(
        "totalTrades",
        totalTrades
    );

    setText(
        "wins",
        wins
    );

    setText(
        "losses",
        losses
    );

    setText(
        "winRate",
        winRate.toFixed(1) + "%"
    );

    setText(
        "totalPL",
        totalPL.toFixed(2)
    );

}


// ======================================================
// TRADE TABLE
// ======================================================

function updateTradeTable(trades) {

    if (!tradeTableBody) return;


    tradeTableBody.innerHTML = "";


    if (trades.length === 0) {

        tradeTableBody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align:center;">
                    No trades yet
                </td>
            </tr>
        `;

        return;
    }


    trades.forEach(trade => {

        const row = document.createElement("tr");


        row.innerHTML = `

            <td>${escapeHTML(formatDate(trade.date))}</td>

            <td>${escapeHTML(trade.time || "-")}</td>

            <td>${escapeHTML(trade.pair || "-")}</td>

            <td>${escapeHTML(trade.direction || "-")}</td>

            <td>${formatNumber(trade.entry)}</td>

            <td>${formatNumber(trade.sl)}</td>

            <td>${formatNumber(trade.tp)}</td>

            <td>${trade.rr ? Number(trade.rr).toFixed(2) : "-"}</td>

            <td>${escapeHTML(trade.setup || "-")}</td>

            <td>${escapeHTML(trade.result || "-")}</td>

            <td>${formatNumber(trade.profit)}</td>

            <td>${escapeHTML(trade.mistake || "-")}</td>

            <td>${escapeHTML(trade.notes || "-")}</td>

            <td>
                <button
                    class="delete-btn"
                    onclick="deleteTrade('${trade.id}')"
                >
                    Delete
                </button>
            </td>

        `;


        tradeTableBody.appendChild(row);

    });

}


// ======================================================
// DELETE TRADE
// ======================================================

window.deleteTrade = async function (tradeId) {

    if (!currentUser) return;


    const confirmed = confirm(
        "Delete this trade?"
    );


    if (!confirmed) return;


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "trades",
                tradeId
            )
        );


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        alert(
            "Could not delete trade.\n\n" +
            error.message
        );

    }

};


// ======================================================
// WEEKLY STATISTICS
// ======================================================

function updateWeeklyStats(trades) {

    const now = new Date();

    const startOfWeek = new Date(now);

    const day = startOfWeek.getDay();

    const difference =
        day === 0
            ? 6
            : day - 1;


    startOfWeek.setDate(
        startOfWeek.getDate() - difference
    );

    startOfWeek.setHours(0, 0, 0, 0);


    const weeklyTrades = trades.filter(trade => {

        if (!trade.date) return false;

        const tradeDate =
            new Date(trade.date + "T00:00:00");

        return tradeDate >= startOfWeek;

    });


    const wins = weeklyTrades.filter(
        trade => trade.result === "Win"
    ).length;


    const losses = weeklyTrades.filter(
        trade => trade.result === "Loss"
    ).length;


    const pl = weeklyTrades.reduce(
        (sum, trade) =>
            sum + Number(trade.profit || 0),
        0
    );


    const winRate =
        weeklyTrades.length > 0
            ? (wins / weeklyTrades.length) * 100
            : 0;


    setText(
        "weekTrades",
        weeklyTrades.length
    );

    setText(
        "weekWins",
        wins
    );

    setText(
        "weekLosses",
        losses
    );

    setText(
        "weekWinRate",
        winRate.toFixed(1) + "%"
    );

    setText(
        "weekPL",
        pl.toFixed(2)
    );

}


// ======================================================
// MONTHLY STATISTICS
// ======================================================

function updateMonthlyStats(trades) {

    const now = new Date();

    const currentYear =
        now.getFullYear();

    const currentMonth =
        now.getMonth();


    const monthlyTrades = trades.filter(trade => {

        if (!trade.date) return false;


        const tradeDate =
            new Date(trade.date + "T00:00:00");


        return (
            tradeDate.getFullYear() === currentYear &&
            tradeDate.getMonth() === currentMonth
        );

    });


    const wins = monthlyTrades.filter(
        trade => trade.result === "Win"
    ).length;


    const losses = monthlyTrades.filter(
        trade => trade.result === "Loss"
    ).length;


    const pl = monthlyTrades.reduce(
        (sum, trade) =>
            sum + Number(trade.profit || 0),
        0
    );


    const winRate =
        monthlyTrades.length > 0
            ? (wins / monthlyTrades.length) * 100
            : 0;


    setText(
        "monthTrades",
        monthlyTrades.length
    );

    setText(
        "monthWins",
        wins
    );

    setText(
        "monthLosses",
        losses
    );

    setText(
        "monthWinRate",
        winRate.toFixed(1) + "%"
    );

    setText(
        "monthPL",
        pl.toFixed(2)
    );

}


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent = value;
    }
}


function formatNumber(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "-";
    }


    const number =
        Number(value);


    if (Number.isNaN(number)) {

        return "-";
    }


    return number.toFixed(2);
}


function formatDate(dateString) {

    if (!dateString) return "-";


    const parts =
        dateString.split("-");


    if (parts.length !== 3) {

        return dateString;
    }


    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


function escapeHTML(value) {

    if (value === undefined || value === null) {

        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================================
// ADD TRADE BUTTON
// ======================================================

window.scrollToTrade = function () {

    const section =
        document.getElementById("tradeSection");


    if (section) {

        section.scrollIntoView({
            behavior: "smooth"
        });

    }

};


// ======================================================
// SERVICE WORKER
// ======================================================

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./sw.js")
            .then(() => {

                console.log(
                    "UjR Fx Journal Service Worker registered."
                );

            })
            .catch(error => {

                console.error(
                    "Service Worker error:",
                    error
                );

            });

    });

}
