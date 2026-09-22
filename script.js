// ======================================================
// UjR Fx Journal
// Firebase + Premium Analytics
// ======================================================


// ======================================================
// FIREBASE IMPORTS
// ======================================================

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

    apiKey:
        "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",

    authDomain:
        "journal-38e0e.firebaseapp.com",

    projectId:
        "journal-38e0e",

    storageBucket:
        "journal-38e0e.firebasestorage.app",

    messagingSenderId:
        "382226906837",

    appId:
        "1:382226906837:web:38df881c0f7beb24256c5c",

    measurementId:
        "G-R6LXDMQ9K2"
};


// ======================================================
// INITIALIZE FIREBASE
// ======================================================

const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const db =
    getFirestore(app);

const provider =
    new GoogleAuthProvider();


// ======================================================
// GLOBAL VARIABLES
// ======================================================

let currentUser = null;

let unsubscribeTrades = null;

let allTrades = [];


// ======================================================
// DOM ELEMENTS
// ======================================================

const loginScreen =
    document.getElementById("loginScreen");

const appContainer =
    document.getElementById("app");

const googleLoginBtn =
    document.getElementById("googleLoginBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const userName =
    document.getElementById("userName");

const userPhoto =
    document.getElementById("userPhoto");

const tradeForm =
    document.getElementById("tradeForm");

const tradeTableBody =
    document.getElementById("tradeTableBody");

const searchTrades =
    document.getElementById("searchTrades");


// ======================================================
// SET TODAY
// ======================================================

function setToday() {

    const input =
        document.getElementById("date");

    if (!input) return;

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1)
        .padStart(2, "0");

    const day =
        String(now.getDate())
        .padStart(2, "0");

    input.value =
        `${year}-${month}-${day}`;
}

setToday();


// ======================================================
// GOOGLE LOGIN
// ======================================================

googleLoginBtn?.addEventListener(
    "click",
    async () => {

        try {

            googleLoginBtn.disabled =
                true;

            googleLoginBtn.textContent =
                "Signing in...";

            await signInWithPopup(
                auth,
                provider
            );

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            alert(
                "Login failed:\n\n" +
                error.message
            );

            googleLoginBtn.disabled =
                false;

            googleLoginBtn.textContent =
                "Continue with Google";
        }

    }
);


// ======================================================
// LOGOUT
// ======================================================

logoutBtn?.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

            alert(
                "Logout failed."
            );
        }

    }
);


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(
    auth,
    user => {

        if (user) {

            currentUser =
                user;

            loginScreen.style.display =
                "none";

            appContainer.style.display =
                "block";

            userName.textContent =
                user.displayName ||
                "Trader";


            if (user.photoURL) {

                userPhoto.src =
                    user.photoURL;

                userPhoto.style.display =
                    "block";
            }


            loadTrades();

        } else {

            currentUser =
                null;

            allTrades =
                [];


            loginScreen.style.display =
                "flex";

            appContainer.style.display =
                "none";


            if (unsubscribeTrades) {

                unsubscribeTrades();

                unsubscribeTrades =
                    null;
            }

        }

    }
);


// ======================================================
// SAVE TRADE
// ======================================================

tradeForm?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (!currentUser) {

            alert(
                "Please login first."
            );

            return;
        }


        // ------------------------------------------
        // GET FORM VALUES
        // ------------------------------------------

        const date =
            document.getElementById(
                "date"
            ).value;


        const pair =
            document.getElementById(
                "pair"
            ).value
            .trim()
            .toUpperCase();


        const direction =
            document.getElementById(
                "direction"
            ).value;


        const entry =
            Number(
                document.getElementById(
                    "entry"
                ).value
            );


        const sl =
            Number(
                document.getElementById(
                    "sl"
                ).value
            );


        const tp =
            Number(
                document.getElementById(
                    "tp"
                ).value
            );


        const setup =
            document.getElementById(
                "setup"
            ).value;


        const result =
            document.getElementById(
                "result"
            ).value;


        const profit =
            Number(
                document.getElementById(
                    "profit"
                ).value
            );


        const mistake =
            document.getElementById(
                "mistake"
            ).value;


        const notes =
            document.getElementById(
                "notes"
            ).value
            .trim();


        // ------------------------------------------
        // TIME
        // ------------------------------------------

        const now =
            new Date();


        const time =
            now.toLocaleTimeString(
                "en-US",
                {
                    timeZone:
                        "Asia/Kathmandu",

                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit",

                    hour12:
                        true
                }
            );


        // ------------------------------------------
        // R:R
        // ------------------------------------------

        const risk =
            Math.abs(
                entry - sl
            );


        const reward =
            Math.abs(
                tp - entry
            );


        const rr =
            risk > 0
                ? reward / risk
                : 0;


        // ------------------------------------------
        // SAVE BUTTON
        // ------------------------------------------

        const saveButton =
            tradeForm.querySelector(
                'button[type="submit"]'
            );


        try {

            if (saveButton) {

                saveButton.disabled =
                    true;

                saveButton.textContent =
                    "Saving...";
            }


            const tradesRef =
                collection(
                    db,
                    "users",
                    currentUser.uid,
                    "trades"
                );


            await addDoc(
                tradesRef,
                {

                    date,

                    time,

                    pair,

                    direction,

                    entry,

                    sl,

                    tp,

                    setup,

                    result,

                    profit,

                    mistake,

                    notes,

                    rr,

                    savedAt:
                        Date.now(),

                    createdAt:
                        serverTimestamp()

                }
            );


            tradeForm.reset();

            setToday();


            document.getElementById(
                "pair"
            ).value =
                "XAUUSD";


            alert(
                "Trade saved successfully! ✅"
            );


        } catch (error) {

            console.error(
                "Save trade error:",
                error
            );

            alert(
                "Trade could not be saved.\n\n" +
                error.message
            );


        } finally {

            if (saveButton) {

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    "Save Trade";
            }

        }

    }
);


// ======================================================
// LOAD TRADES
// ======================================================

function loadTrades() {

    if (!currentUser)
        return;


    if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades =
            null;
    }


    const tradesRef =
        collection(
            db,
            "users",
            currentUser.uid,
            "trades"
        );


    unsubscribeTrades =
        onSnapshot(

            tradesRef,

            snapshot => {

                allTrades =
                    [];


                snapshot.forEach(
                    documentSnapshot => {

                        allTrades.push({

                            id:
                                documentSnapshot.id,

                            ...documentSnapshot.data()

                        });

                    }
                );


                sortTrades();

                refreshEverything();

            },


            error => {

                console.error(
                    "Firestore error:",
                    error
                );

                alert(
                    "Could not load trades.\n\n" +
                    error.message
                );

            }

        );
}


// ======================================================
// SORT TRADES
// ======================================================

function sortTrades() {

    allTrades.sort(
        (a, b) => {

            return Number(
                b.savedAt || 0
            )
            -
            Number(
                a.savedAt || 0
            );

        }
    );
}


// ======================================================
// REFRESH EVERYTHING
// ======================================================

function refreshEverything() {

    updateDashboard(
        allTrades
    );


    updateTradeTable(
        getFilteredTrades()
    );


    updateWeeklyStats(
        allTrades
    );


    updateMonthlyStats(
        allTrades
    );


    drawEquityChart(
        allTrades
    );


    // PREMIUM

    updatePremiumAnalytics(
        allTrades
    );
}


// ======================================================
// DASHBOARD
// ======================================================

function updateDashboard(
    trades
) {

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


    const winRate =
        total > 0
            ? wins / total * 100
            : 0;


    const totalPL =
        trades.reduce(
            (sum, trade) =>
                sum +
                Number(
                    trade.profit || 0
                ),
            0
        );


    const averagePL =
        total > 0
            ? totalPL / total
            : 0;


    setText(
        "totalTrades",
        total
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


    setText(
        "averagePL",
        averagePL.toFixed(2)
    );
}


// ======================================================
// TRADE TABLE
// ======================================================

function updateTradeTable(
    trades
) {

    if (!tradeTableBody)
        return;


    tradeTableBody.innerHTML =
        "";


    if (trades.length === 0) {

        tradeTableBody.innerHTML = `

            <tr>

                <td
                    colspan="14"
                    class="empty-table"
                >
                    No trades found
                </td>

            </tr>

        `;

        return;
    }


    trades.forEach(
        trade => {

            const row =
                document.createElement(
                    "tr"
                );


            let resultClass =
                "result-breakeven";


            if (
                trade.result === "Win"
            )
                resultClass =
                    "result-win";


            if (
                trade.result === "Loss"
            )
                resultClass =
                    "result-loss";


            const pl =
                Number(
                    trade.profit || 0
                );


            const plClass =
                pl > 0
                    ? "green"
                    : pl < 0
                        ? "red"
                        : "";


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        formatDate(
                            trade.date
                        )
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        trade.time || "-"
                    )}
                </td>

                <td>
                    <strong>
                        ${escapeHTML(
                            trade.pair || "-"
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHTML(
                        trade.direction || "-"
                    )}
                </td>

                <td>
                    ${formatNumber(
                        trade.entry
                    )}
                </td>

                <td>
                    ${formatNumber(
                        trade.sl
                    )}
                </td>

                <td>
                    ${formatNumber(
                        trade.tp
                    )}
                </td>

                <td>
                    ${
                        trade.rr
                            ? Number(
                                trade.rr
                              ).toFixed(2)
                            : "-"
                    }
                </td>

                <td>
                    ${escapeHTML(
                        trade.setup || "-"
                    )}
                </td>

                <td>

                    <span
                        class="result-badge ${resultClass}"
                    >
                        ${escapeHTML(
                            trade.result || "-"
                        )}
                    </span>

                </td>

                <td class="${plClass}">
                    ${pl.toFixed(2)}
                </td>

                <td>
                    ${escapeHTML(
                        trade.mistake || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        trade.notes || "-"
                    )}
                </td>

                <td>

                    <button
                        class="delete-btn"
                        data-id="${trade.id}"
                    >
                        Delete
                    </button>

                </td>

            `;


            tradeTableBody.appendChild(
                row
            );

        }
    );
}


// ======================================================
// DELETE TRADE
// ======================================================

tradeTableBody?.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                ".delete-btn"
            );


        if (!button)
            return;


        const tradeId =
            button.dataset.id;


        const confirmed =
            confirm(
                "Delete this trade permanently?"
            );


        if (!confirmed)
            return;


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

    }
);


// ======================================================
// SEARCH
// ======================================================

searchTrades?.addEventListener(
    "input",
    () => {

        updateTradeTable(
            getFilteredTrades()
        );

    }
);


function getFilteredTrades() {

    const query =
        searchTrades?.value
            .trim()
            .toLowerCase() || "";


    if (!query)
        return allTrades;


    return allTrades.filter(
        trade => {

            const searchable = [

                trade.date,

                trade.time,

                trade.pair,

                trade.direction,

                trade.setup,

                trade.result,

                trade.mistake,

                trade.notes

            ]
            .join(" ")
            .toLowerCase();


            return searchable.includes(
                query
            );

        }
    );
}


// ======================================================
// WEEKLY STATS
// ======================================================

function updateWeeklyStats(
    trades
) {

    const now =
        new Date();


    const day =
        now.getDay();


    const diff =
        day === 0
            ? 6
            : day - 1;


    const start =
        new Date(now);


    start.setDate(
        start.getDate() - diff
    );


    start.setHours(
        0,
        0,
        0,
        0
    );


    const weekly =
        trades.filter(
            trade => {

                if (!trade.date)
                    return false;


                const date =
                    new Date(
                        trade.date +
                        "T00:00:00"
                    );


                return date >= start;

            }
        );


    updatePeriodStats(
        weekly,
        "week"
    );
}


// ======================================================
// MONTHLY STATS
// ======================================================

function updateMonthlyStats(
    trades
) {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        now.getMonth();


    const monthly =
        trades.filter(
            trade => {

                if (!trade.date)
                    return false;


                const date =
                    new Date(
                        trade.date +
                        "T00:00:00"
                    );


                return (
                    date.getFullYear()
                    === year
                    &&
                    date.getMonth()
                    === month
                );

            }
        );


    updatePeriodStats(
        monthly,
        "month"
    );
}


// ======================================================
// PERIOD STATS
// ======================================================

function updatePeriodStats(
    trades,
    prefix
) {

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
            (sum, trade) =>
                sum +
                Number(
                    trade.profit || 0
                ),
            0
        );


    const winRate =
        trades.length > 0
            ? wins /
              trades.length *
              100
            : 0;


    setText(
        prefix + "Trades",
        trades.length
    );


    setText(
        prefix + "Wins",
        wins
    );


    setText(
        prefix + "Losses",
        losses
    );


    setText(
        prefix + "WinRate",
        winRate.toFixed(1) + "%"
    );


    setText(
        prefix + "PL",
        pl.toFixed(2)
    );
}


// ======================================================
// PREMIUM ANALYTICS
// ======================================================

function updatePremiumAnalytics(
    trades
) {

    updateSetupAnalytics(
        trades
    );


    updateMistakeAnalytics(
        trades
    );


    updateAverageRR(
        trades
    );
}


// ======================================================
// SETUP ANALYTICS
// ======================================================

function updateSetupAnalytics(
    trades
) {

    const setupMap =
        {};


    trades.forEach(
        trade => {

            const setup =
                trade.setup ||
                "Unknown";


            if (!setupMap[setup]) {

                setupMap[setup] = {

                    trades: 0,

                    wins: 0,

                    losses: 0,

                    pl: 0

                };

            }


            setupMap[setup].trades++;


            if (
                trade.result === "Win"
            ) {

                setupMap[setup].wins++;

            }


            if (
                trade.result === "Loss"
            ) {

                setupMap[setup].losses++;

            }


            setupMap[setup].pl +=
                Number(
                    trade.profit || 0
                );

        }
    );


    const setups =
        Object.entries(
            setupMap
        );


    const body =
        document.getElementById(
            "setupStatsBody"
        );


    if (!body)
        return;


    body.innerHTML =
        "";


    if (setups.length === 0) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-table"
                >
                    No setup data yet
                </td>

            </tr>

        `;

        setText(
            "bestSetup",
            "-"
        );

        setText(
            "bestSetupWinRate",
            "Win Rate: -"
        );

        setText(
            "bestSetupPL",
            "0.00"
        );

        return;
    }


    // Sort by P/L

    setups.sort(
        (a, b) =>
            b[1].pl -
            a[1].pl
    );


    // Best setup

    const best =
        setups[0];


    const bestName =
        best[0];


    const bestData =
        best[1];


    const bestWinRate =
        bestData.trades > 0
            ? bestData.wins /
              bestData.trades *
              100
            : 0;


    setText(
        "bestSetup",
        bestName
    );


    setText(
        "bestSetupWinRate",
        "Win Rate: " +
        bestWinRate.toFixed(1) +
        "%"
    );


    setText(
        "bestSetupPL",
        bestData.pl.toFixed(2)
    );


    // Table

    setups.forEach(
        ([setup, data]) => {

            const winRate =
                data.trades > 0
                    ? data.wins /
                      data.trades *
                      100
                    : 0;


            const plClass =
                data.pl > 0
                    ? "green"
                    : data.pl < 0
                        ? "red"
                        : "";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    <strong>
                        ${escapeHTML(
                            setup
                        )}
                    </strong>
                </td>

                <td>
                    ${data.trades}
                </td>

                <td class="green">
                    ${data.wins}
                </td>

                <td class="red">
                    ${data.losses}
                </td>

                <td>
                    ${winRate.toFixed(1)}%
                </td>

                <td class="${plClass}">
                    ${data.pl.toFixed(2)}
                </td>

            `;


            body.appendChild(
                row
            );

        }
    );
}


// ======================================================
// MISTAKE ANALYTICS
// ======================================================

function updateMistakeAnalytics(
    trades
) {

    const mistakeMap =
        {};


    trades.forEach(
        trade => {

            const mistake =
                trade.mistake ||
                "No mistake";


            if (!mistakeMap[mistake]) {

                mistakeMap[mistake] = {

                    count: 0,

                    wins: 0,

                    losses: 0,

                    pl: 0

                };

            }


            mistakeMap[mistake].count++;


            if (
                trade.result === "Win"
            ) {

                mistakeMap[mistake].wins++;

            }


            if (
                trade.result === "Loss"
            ) {

                mistakeMap[mistake].losses++;

            }


            mistakeMap[mistake].pl +=
                Number(
                    trade.profit || 0
                );

        }
    );


    const mistakes =
        Object.entries(
            mistakeMap
        );


    const body =
        document.getElementById(
            "mistakeStatsBody"
        );


    if (!body)
        return;


    body.innerHTML =
        "";


    if (mistakes.length === 0) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-table"
                >
                    No mistake data yet
                </td>

            </tr>

        `;

        setText(
            "commonMistake",
            "-"
        );

        setText(
            "commonMistakeCount",
            "0 trades"
        );

        return;
    }


    // Sort by frequency

    mistakes.sort(
        (a, b) =>
            b[1].count -
            a[1].count
    );


    // Most common mistake

    const common =
        mistakes[0];


    setText(
        "commonMistake",
        common[0]
    );


    setText(
        "commonMistakeCount",
        common[1].count +
        " trades"
    );


    // Table

    mistakes.forEach(
        ([mistake, data]) => {

            const winRate =
                data.count > 0
                    ? data.wins /
                      data.count *
                      100
                    : 0;


            const plClass =
                data.pl > 0
                    ? "green"
                    : data.pl < 0
                        ? "red"
                        : "";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    <strong>
                        ${escapeHTML(
                            mistake
                        )}
                    </strong>
                </td>

                <td>
                    ${data.count}
                </td>

                <td class="green">
                    ${data.wins}
                </td>

                <td class="red">
                    ${data.losses}
                </td>

                <td>
                    ${winRate.toFixed(1)}%
                </td>

                <td class="${plClass}">
                    ${data.pl.toFixed(2)}
                </td>

            `;


            body.appendChild(
                row
            );

        }
    );
}


// ======================================================
// AVERAGE R:R
// ======================================================

function updateAverageRR(
    trades
) {

    const validTrades =
        trades.filter(
            trade =>
                Number(
                    trade.rr
                ) > 0
        );


    const average =
        validTrades.length > 0

            ? validTrades.reduce(
                (sum, trade) =>
                    sum +
                    Number(
                        trade.rr
                    ),
                0
            )
            /
            validTrades.length

            : 0;


    setText(
        "averageRR",
        average.toFixed(2)
    );
}


// ======================================================
// EQUITY CURVE
// ======================================================

function drawEquityChart(
    trades
) {

    const canvas =
        document.getElementById(
            "equityChart"
        );


    const empty =
        document.getElementById(
            "emptyChart"
        );


    if (!canvas)
        return;


    if (
        trades.length === 0
    ) {

        empty.style.display =
            "flex";

        return;
    }


    empty.style.display =
        "none";


    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        rect.width * dpr;


    canvas.height =
        290 * dpr;


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.scale(
        dpr,
        dpr
    );


    const width =
        rect.width;


    const height =
        290;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const ordered =
        [...trades].sort(
            (a, b) =>
                Number(
                    a.savedAt || 0
                )
                -
                Number(
                    b.savedAt || 0
                )
        );


    let equity =
        0;


    const points =
        [];


    ordered.forEach(
        trade => {

            equity +=
                Number(
                    trade.profit || 0
                );


            points.push(
                equity
            );

        }
    );


    const min =
        Math.min(
            0,
            ...points
        );


    const max =
        Math.max(
            0,
            ...points
        );


    const range =
        max - min || 1;


    // Grid

    ctx.strokeStyle =
        "rgba(255,255,255,.07)";

    ctx.lineWidth =
        1;


    for (
        let i = 0;
        i <= 4;
        i++
    ) {

        const y =
            20 +
            (
                height - 40
            )
            *
            i
            /
            4;


        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();

    }


    // Curve

    ctx.beginPath();


    points.forEach(
        (value, index) => {

            const x =
                points.length === 1

                    ? width / 2

                    :

                    index /
                    (
                        points.length - 1
                    )
                    *
                    (
                        width - 20
                    )
                    +
                    10;


            const y =
                height -
                20 -
                (
                    (
                        value - min
                    )
                    /
                    range
                )
                *
                (
                    height - 40
                );


            if (
                index === 0
            )
                ctx.moveTo(
                    x,
                    y
                );

            else
                ctx.lineTo(
                    x,
                    y
                );

        }
    );


    ctx.strokeStyle =
        "#7c5cff";

    ctx.lineWidth =
        3;

    ctx.stroke();


    // Last point

    if (
        points.length > 0
    ) {

        const last =
            points[
                points.length - 1
            ];


        const x =
            points.length === 1
                ? width / 2
                : width - 10;


        const y =
            height -
            20 -
            (
                (
                    last - min
                )
                /
                range
            )
            *
            (
                height - 40
            );


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            5,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            "#7c5cff";

        ctx.fill();

    }
}


// ======================================================
// EXPORT CSV
// ======================================================

window.exportCSV =
    function () {

        if (
            !currentUser ||
            allTrades.length === 0
        ) {

            alert(
                "There are no trades to export."
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

            "Setup",

            "Result",

            "Profit/Loss",

            "Mistake",

            "Notes"

        ];


        const rows =
            allTrades.map(
                trade => [

                    trade.date,

                    trade.time,

                    trade.pair,

                    trade.direction,

                    trade.entry,

                    trade.sl,

                    trade.tp,

                    trade.rr,

                    trade.setup,

                    trade.result,

                    trade.profit,

                    trade.mistake,

                    trade.notes

                ].map(
                    value =>
                        csvEscape(
                            value
                        )
                )
            );


        const csv =
            [
                headers,
                ...rows
            ]

            .map(
                row =>
                    row.join(",")
            )

            .join("\n");


        const blob =
            new Blob(
                [csv],
                {
                    type:
                        "text/csv;charset=utf-8;"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            "UjR-Fx-Trading-Journal.csv";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );

    };


// ======================================================
// CSV ESCAPE
// ======================================================

function csvEscape(
    value
) {

    if (
        value === undefined ||
        value === null
    )
        return "";


    return `"${String(value)
        .replace(/"/g, '""')}"`;
}


// ======================================================
// SET TEXT
// ======================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element)
        element.textContent =
            value;
}


// ======================================================
// FORMAT NUMBER
// ======================================================

function formatNumber(
    value
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    )
        return "-";


    const number =
        Number(value);


    if (
        Number.isNaN(number)
    )
        return "-";


    return number.toFixed(2);
}


// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(
    dateString
) {

    if (!dateString)
        return "-";


    const parts =
        dateString.split("-");


    if (
        parts.length !== 3
    )
        return dateString;


    return (
        `${parts[2]}/` +
        `${parts[1]}/` +
        `${parts[0]}`
    );
}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    )
        return "";


    return String(value)

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


// ======================================================
// SCROLL TO ADD TRADE
// ======================================================

window.scrollToTrade =
    function () {

        const section =
            document.getElementById(
                "tradeSection"
            );


        if (section) {

            section.scrollIntoView(
                {
                    behavior:
                        "smooth"
                }
            );

        }

    };


// ======================================================
// RESIZE CHART
// ======================================================

window.addEventListener(
    "resize",
    () => {

        drawEquityChart(
            allTrades
        );

    }
);


// ======================================================
// SERVICE WORKER
// ======================================================

if (
    "serviceWorker"
    in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "./sw.js"
                )

                .then(
                    () =>
                        console.log(
                            "UjR Fx Journal PWA ready."
                        )
                )

                .catch(
                    error =>
                        console.error(
                            "Service Worker error:",
                            error
                        )
                );

        }
    );

}
