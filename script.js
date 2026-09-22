// ========================================
// UjR Fx Trading Journal
// Firebase Cloud Version
// ========================================


let trades = [];

let currentUser = null;

let unsubscribeTrades = null;


// ========================================
// WAIT FOR FIREBASE
// ========================================

window.addEventListener("load", () => {

    waitForFirebase();

});


function waitForFirebase() {

    if (
        window.firebaseAuth &&
        window.firebaseDB
    ) {

        startFirebase();

    } else {

        setTimeout(
            waitForFirebase,
            100
        );

    }

}


// ========================================
// START FIREBASE
// ========================================

function startFirebase() {

    const auth =
        window.firebaseAuth;

    const db =
        window.firebaseDB;


    const {
        collection,
        query,
        orderBy,
        onSnapshot,
        addDoc,
        deleteDoc,
        getDocs
    } = window.firebaseFirestore || {};


    // Firebase Firestore functions
    // are loaded below through dynamic import.

    initializeFirestoreFunctions();

}


// ========================================
// FIRESTORE FUNCTIONS
// ========================================

async function initializeFirestoreFunctions() {

    const firestore =
        await import(
            "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"
        );


    window.firestoreFunctions = firestore;


    setupAuthentication();

}


// ========================================
// GOOGLE AUTHENTICATION
// ========================================

function setupAuthentication() {

    const auth =
        window.firebaseAuth;


    const loginButton =
        document.getElementById(
            "googleLoginBtn"
        );


    const logoutButton =
        document.getElementById(
            "logoutBtn"
        );


    loginButton.addEventListener(
        "click",
        async () => {

            try {

                loginButton.disabled = true;

                loginButton.textContent =
                    "Signing in...";


                await window.signInWithPopupFirebase(
                    auth,
                    window.googleProvider
                );


            } catch (error) {

                console.error(error);

                alert(
                    "Google Login failed.\n\n" +
                    error.message
                );


                loginButton.disabled = false;

                loginButton.innerHTML =
                    "<span>G</span> Continue with Google";

            }

        }
    );


    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                await window.signOutFirebase(
                    auth
                );

            } catch (error) {

                console.error(error);

                alert(
                    "Logout failed."
                );

            }

        }
    );


    window.onAuthStateChangedFirebase(
        auth,
        user => {

            if (user) {

                currentUser = user;

                showApp(user);

                loadTrades();

            } else {

                currentUser = null;

                trades = [];

                showLogin();

            }

        }
    );

}


// ========================================
// SHOW LOGIN
// ========================================

function showLogin() {

    document
        .getElementById("loginScreen")
        .style.display = "flex";


    document
        .getElementById("app")
        .classList.add("app-hidden");


    if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;

    }

}


// ========================================
// SHOW APP
// ========================================

function showApp(user) {

    document
        .getElementById("loginScreen")
        .style.display = "none";


    document
        .getElementById("app")
        .classList.remove("app-hidden");


    const name =
        user.displayName ||
        user.email ||
        "User";


    document
        .getElementById("userName")
        .textContent = name;


    const photo =
        document.getElementById(
            "userPhoto"
        );


    if (user.photoURL) {

        photo.src =
            user.photoURL;

        photo.style.display =
            "block";

    } else {

        photo.style.display =
            "none";

    }

}


// ========================================
// LOAD TRADES FROM FIRESTORE
// ========================================

function loadTrades() {

    if (!currentUser) {
        return;
    }


    const {
        collection,
        query,
        orderBy,
        onSnapshot
    } = window.firestoreFunctions;


    const tradesRef =
        collection(
            window.firebaseDB,
            "users",
            currentUser.uid,
            "trades"
        );


    const tradesQuery =
        query(
            tradesRef,
            orderBy(
                "createdAt",
                "desc"
            )
        );


    if (unsubscribeTrades) {

        unsubscribeTrades();

    }


    unsubscribeTrades =
        onSnapshot(
            tradesQuery,

            snapshot => {

                trades =
                    snapshot.docs.map(
                        doc => ({

                            id: doc.id,

                            ...doc.data()

                        })
                    );


                updateAll();

            },

            error => {

                console.error(
                    "Firestore error:",
                    error
                );


                alert(
                    "Could not load your trades.\n\n" +
                    error.message
                );

            }
        );

}


// ========================================
// SAVE TRADE TO FIRESTORE
// ========================================

async function saveTradeToCloud(trade) {

    if (!currentUser) {

        alert(
            "Please login first."
        );

        return;

    }


    const {
        collection,
        addDoc,
        serverTimestamp
    } = window.firestoreFunctions;


    const tradesRef =
        collection(
            window.firebaseDB,
            "users",
            currentUser.uid,
            "trades"
        );


    await addDoc(
        tradesRef,
        {

            date: trade.date,

            pair: trade.pair,

            direction: trade.direction,

            entry: trade.entry,

            sl: trade.sl,

            tp: trade.tp,

            setup: trade.setup,

            result: trade.result,

            profit: trade.profit,

            mistake: trade.mistake,

            notes: trade.notes,

            createdAt:
                serverTimestamp()

        }
    );

}


// ========================================
// DELETE TRADE
// ========================================

async function deleteTrade(index) {

    const trade =
        trades[index];


    if (!trade || !trade.id) {
        return;
    }


    const confirmDelete =
        confirm(
            "Delete this trade?"
        );


    if (!confirmDelete) {
        return;
    }


    try {

        const {
            doc,
            deleteDoc
        } = window.firestoreFunctions;


        const tradeRef =
            doc(
                window.firebaseDB,
                "users",
                currentUser.uid,
                "trades",
                trade.id
            );


        await deleteDoc(
            tradeRef
        );


    } catch (error) {

        console.error(error);

        alert(
            "Could not delete trade."
        );

    }

}


// ========================================
// CLEAR ALL TRADES
// ========================================

async function clearAllTrades() {

    if (!currentUser) {
        return;
    }


    if (trades.length === 0) {

        alert(
            "There are no trades to delete."
        );

        return;

    }


    const confirmDelete =
        confirm(
            "Are you sure you want to delete ALL trades?"
        );


    if (!confirmDelete) {
        return;
    }


    try {

        const {
            collection,
            getDocs,
            deleteDoc
        } = window.firestoreFunctions;


        const tradesRef =
            collection(
                window.firebaseDB,
                "users",
                currentUser.uid,
                "trades"
            );


        const snapshot =
            await getDocs(
                tradesRef
            );


        const deletePromises =
            snapshot.docs.map(
                doc =>
                    deleteDoc(
                        doc.ref
                    )
            );


        await Promise.all(
            deletePromises
        );


    } catch (error) {

        console.error(error);

        alert(
            "Could not delete trades."
        );

    }

}


// ========================================
// CALCULATE R:R
// ========================================

function calculateRR(trade) {

    const risk =
        Math.abs(
            Number(trade.entry) -
            Number(trade.sl)
        );


    const reward =
        Math.abs(
            Number(trade.tp) -
            Number(trade.entry)
        );


    if (risk === 0) {

        return "—";

    }


    return "1:" +
        (reward / risk)
            .toFixed(2);

}


// ========================================
// DASHBOARD
// ========================================

function updateDashboard() {

    const total =
        trades.length;


    const wins =
        trades.filter(
            trade =>
                trade.result === "Win"
        ).length;


    const losses =
        trades.filter(
            trade =>
                trade.result === "Loss"
        ).length;


    const totalPL =
        trades.reduce(
            (sum, trade) =>
                sum +
                Number(
                    trade.profit || 0
                ),
            0
        );


    const winRate =
        total > 0
            ? (wins / total) * 100
            : 0;


    document
        .getElementById("totalTrades")
        .textContent = total;


    document
        .getElementById("wins")
        .textContent = wins;


    document
        .getElementById("losses")
        .textContent = losses;


    document
        .getElementById("winRate")
        .textContent =
            winRate.toFixed(1) + "%";


    const plElement =
        document.getElementById(
            "totalPL"
        );


    plElement.textContent =
        totalPL.toFixed(2);


    updatePLColor(
        plElement,
        totalPL
    );

}


// ========================================
// P/L COLOR
// ========================================

function updatePLColor(
    element,
    value
) {

    element.classList.remove(
        "green",
        "red"
    );


    if (value > 0) {

        element.classList.add(
            "green"
        );

    }


    if (value < 0) {

        element.classList.add(
            "red"
        );

    }

}


// ========================================
// DISPLAY TRADES
// ========================================

function displayTrades() {

    const table =
        document.getElementById(
            "tradeHistory"
        );


    const emptyMessage =
        document.getElementById(
            "emptyMessage"
        );


    table.innerHTML = "";


    if (trades.length === 0) {

        emptyMessage.style.display =
            "block";

        return;

    }


    emptyMessage.style.display =
        "none";


    trades.forEach(
        (trade, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            let resultClass = "";


            if (
                trade.result ===
                "Win"
            ) {

                resultClass =
                    "result-win";

            }


            if (
                trade.result ===
                "Loss"
            ) {

                resultClass =
                    "result-loss";

            }


            if (
                trade.result ===
                "Breakeven"
            ) {

                resultClass =
                    "result-breakeven";

            }


            let profitClass = "";


            if (
                Number(trade.profit) >
                0
            ) {

                profitClass =
                    "green";

            }


            if (
                Number(trade.profit) <
                0
            ) {

                profitClass =
                    "red";

            }


            row.innerHTML = `

                <td>
                    ${formatDate(trade.date)}
                </td>

                <td>
                    ${safe(trade.pair)}
                </td>

                <td>
                    ${safe(trade.direction)}
                </td>

                <td>
                    ${trade.entry}
                </td>

                <td>
                    ${trade.sl}
                </td>

                <td>
                    ${trade.tp}
                </td>

                <td>
                    ${calculateRR(trade)}
                </td>

                <td>
                    ${safe(trade.setup || "—")}
                </td>

                <td class="${resultClass}">
                    ${safe(trade.result)}
                </td>

                <td class="${profitClass}">
                    ${Number(
                        trade.profit || 0
                    ).toFixed(2)}
                </td>

                <td>
                    ${safe(
                        trade.mistake ||
                        "No mistake"
                    )}
                </td>

                <td>
                    ${safe(
                        trade.notes ||
                        "—"
                    )}
                </td>

                <td>

                    <button
                        class="delete-btn"
                        onclick="deleteTrade(${index})"
                    >
                        Delete
                    </button>

                </td>

            `;


            table.appendChild(row);

        }
    );

}


// ========================================
// ADD TRADE
// ========================================

document
    .getElementById("tradeForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            if (!currentUser) {

                alert(
                    "Please login first."
                );

                return;

            }


            const saveButton =
                this.querySelector(
                    "button[type='submit']"
                );


            saveButton.disabled =
                true;


            saveButton.textContent =
                "Saving...";


            const trade = {

                date:
                    document
                        .getElementById("date")
                        .value,

                pair:
                    document
                        .getElementById("pair")
                        .value,

                direction:
                    document
                        .getElementById("direction")
                        .value,

                entry:
                    Number(
                        document
                            .getElementById("entry")
                            .value
                    ),

                sl:
                    Number(
                        document
                            .getElementById("sl")
                            .value
                    ),

                tp:
                    Number(
                        document
                            .getElementById("tp")
                            .value
                    ),

                setup:
                    document
                        .getElementById("setup")
                        .value,

                result:
                    document
                        .getElementById("result")
                        .value,

                profit:
                    Number(
                        document
                            .getElementById("profit")
                            .value
                    ),

                mistake:
                    document
                        .getElementById("mistake")
                        .value,

                notes:
                    document
                        .getElementById("notes")
                        .value

            };


            try {

                await saveTradeToCloud(
                    trade
                );


                this.reset();


                document
                    .getElementById("pair")
                    .value =
                    "XAUUSD";


            } catch (error) {

                console.error(error);

                alert(
                    "Could not save trade.\n\n" +
                    error.message
                );

            }


            saveButton.disabled =
                false;


            saveButton.textContent =
                "Save Trade";

        }
    );


// ========================================
// SAFE HTML
// ========================================

function safe(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ========================================
// DATE FORMAT
// ========================================

function formatDate(dateString) {

    if (!dateString) {
        return "—";
    }


    const parts =
        dateString.split("-");


    if (
        parts.length !== 3
    ) {

        return dateString;

    }


    return (
        parts[2] +
        "-" +
        parts[1] +
        "-" +
        parts[0]
    );

}


// ========================================
// LOCAL DATE PARSER
// Prevents timezone problems
// ========================================

function parseLocalDate(
    dateString
) {

    const [
        year,
        month,
        day
    ] =
        dateString
            .split("-")
            .map(Number);


    return new Date(
        year,
        month - 1,
        day
    );

}


// ========================================
// GET WEEK START
// ========================================

function getWeekStart(date) {

    const d =
        new Date(date);


    const day =
        d.getDay();


    const difference =
        day === 0
            ? -6
            : 1 - day;


    d.setDate(
        d.getDate() +
        difference
    );


    d.setHours(
        0,
        0,
        0,
        0
    );


    return d;

}


// ========================================
// WEEKLY STATISTICS
// ========================================

function updateWeeklyStats() {

    const today =
        new Date();


    const weekStart =
        getWeekStart(today);


    const weekTrades =
        trades.filter(
            trade => {

                if (!trade.date) {
                    return false;
                }


                const tradeDate =
                    parseLocalDate(
                        trade.date
                    );


                return (
                    tradeDate >=
                    weekStart
                );

            }
        );


    const total =
        weekTrades.length;


    const wins =
        weekTrades.filter(
            trade =>
                trade.result ===
                "Win"
        ).length;


    const losses =
        weekTrades.filter(
            trade =>
                trade.result ===
                "Loss"
        ).length;


    const pl =
        weekTrades.reduce(
            (sum, trade) =>
                sum +
                Number(
                    trade.profit || 0
                ),
            0
        );


    const winRate =
        total > 0
            ? (wins / total) * 100
            : 0;


    document
        .getElementById("weekTrades")
        .textContent = total;


    document
        .getElementById("weekWins")
        .textContent = wins;


    document
        .getElementById("weekLosses")
        .textContent = losses;


    document
        .getElementById("weekWinRate")
        .textContent =
            winRate.toFixed(1) +
            "%";


    const plElement =
        document.getElementById(
            "weekPL"
        );


    plElement.textContent =
        pl.toFixed(2);


    updatePLColor(
        plElement,
        pl
    );


    createWeeklyChart();

}


// ========================================
// MONTHLY STATISTICS
// ========================================

function updateMonthlyStats() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        now.getMonth();


    const monthTrades =
        trades.filter(
            trade => {

                const d =
                    parseLocalDate(
                        trade.date
                    );


                return (
                    d.getFullYear() ===
                    year
                    &&
                    d.getMonth() ===
                    month
                );

            }
        );


    const total =
        monthTrades.length;


    const wins =
        monthTrades.filter(
            trade =>
                trade.result ===
                "Win"
        ).length;


    const losses =
        monthTrades.filter(
            trade =>
                trade.result ===
                "Loss"
        ).length;


    const pl =
        monthTrades.reduce(
            (sum, trade) =>
                sum +
                Number(
                    trade.profit || 0
                ),
            0
        );


    const winRate =
        total > 0
            ? (wins / total) * 100
            : 0;


    document
        .getElementById("monthTrades")
        .textContent = total;


    document
        .getElementById("monthWins")
        .textContent = wins;


    document
        .getElementById("monthLosses")
        .textContent = losses;


    document
        .getElementById("monthWinRate")
        .textContent =
            winRate.toFixed(1) +
            "%";


    const plElement =
        document.getElementById(
            "monthPL"
        );


    plElement.textContent =
        pl.toFixed(2);


    updatePLColor(
        plElement,
        pl
    );


    createMonthlyChart();

}


// ========================================
// WEEKLY CHART
// ========================================

function createWeeklyChart() {

    const chart =
        document.getElementById(
            "weeklyChart"
        );


    chart.innerHTML = "";


    const currentWeek =
        getWeekStart(
            new Date()
        );


    const weeks = [];


    for (
        let i = 7;
        i >= 0;
        i--
    ) {

        const start =
            new Date(
                currentWeek
            );


        start.setDate(
            start.getDate() -
            i * 7
        );


        const end =
            new Date(start);


        end.setDate(
            end.getDate() +
            7
        );


        const pl =
            trades
                .filter(
                    trade => {

                        const d =
                            parseLocalDate(
                                trade.date
                            );


                        return (
                            d >= start &&
                            d < end
                        );

                    }
                )
                .reduce(
                    (sum, trade) =>
                        sum +
                        Number(
                            trade.profit ||
                            0
                        ),
                    0
                );


        weeks.push({
            start,
            pl
        });

    }


    const max =
        Math.max(
            ...weeks.map(
                week =>
                    Math.abs(
                        week.pl
                    )
            ),
            1
        );


    weeks.forEach(
        week => {

            const container =
                document.createElement(
                    "div"
                );


            container.className =
                "bar-container";


            const value =
                document.createElement(
                    "div"
                );


            value.className =
                "bar-value";


            value.textContent =
                week.pl.toFixed(0);


            const bar =
                document.createElement(
                    "div"
                );


            bar.className =
                "bar";


            if (week.pl < 0) {

                bar.classList.add(
                    "negative"
                );

            }


            bar.style.height =
                Math.max(
                    3,
                    (
                        Math.abs(
                            week.pl
                        ) /
                        max
                    ) * 150
                ) + "px";


            const label =
                document.createElement(
                    "div"
                );


            label.className =
                "bar-label";


            label.textContent =
                formatShortDate(
                    week.start
                );


            container.appendChild(
                value
            );


            container.appendChild(
                bar
            );


            container.appendChild(
                label
            );


            chart.appendChild(
                container
            );

        }
    );

}


// ========================================
// MONTHLY CHART
// ========================================

function createMonthlyChart() {

    const chart =
        document.getElementById(
            "monthlyChart"
        );


    chart.innerHTML = "";


    const now =
        new Date();


    const months = [];


    for (
        let i = 11;
        i >= 0;
        i--
    ) {

        const date =
            new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );


        const year =
            date.getFullYear();


        const month =
            date.getMonth();


        const pl =
            trades
                .filter(
                    trade => {

                        const d =
                            parseLocalDate(
                                trade.date
                            );


                        return (
                            d.getFullYear() ===
                            year
                            &&
                            d.getMonth() ===
                            month
                        );

                    }
                )
                .reduce(
                    (sum, trade) =>
                        sum +
                        Number(
                            trade.profit ||
                            0
                        ),
                    0
                );


        months.push({
            date,
            pl
        });

    }


    const max =
        Math.max(
            ...months.map(
                month =>
                    Math.abs(
                        month.pl
                    )
            ),
            1
        );


    months.forEach(
        month => {

            const container =
                document.createElement(
                    "div"
                );


            container.className =
                "bar-container";


            const value =
                document.createElement(
                    "div"
                );


            value.className =
                "bar-value";


            value.textContent =
                month.pl.toFixed(0);


            const bar =
                document.createElement(
                    "div"
                );


            bar.className =
                "bar";


            if (month.pl < 0) {

                bar.classList.add(
                    "negative"
                );

            }


            bar.style.height =
                Math.max(
                    3,
                    (
                        Math.abs(
                            month.pl
                        ) /
                        max
                    ) * 150
                ) + "px";


            const label =
                document.createElement(
                    "div"
                );


            label.className =
                "bar-label";


            label.textContent =
                month.date.toLocaleDateString(
                    "en-US",
                    {
                        month: "short"
                    }
                );


            container.appendChild(
                value
            );


            container.appendChild(
                bar
            );


            container.appendChild(
                label
            );


            chart.appendChild(
                container
            );

        }
    );

}


// ========================================
// SHORT DATE
// ========================================

function formatShortDate(
    date
) {

    return date.toLocaleDateString(
        "en-US",
        {
            day: "numeric",
            month: "short"
        }
    );

}


// ========================================
// SCROLL TO TRADE
// ========================================

function scrollToTrade() {

    document
        .getElementById(
            "tradeSection"
        )
        .scrollIntoView({
            behavior: "smooth"
        });

}


// ========================================
// UPDATE EVERYTHING
// ========================================

function updateAll() {

    updateDashboard();

    displayTrades();

    updateWeeklyStats();

    updateMonthlyStats();

}
