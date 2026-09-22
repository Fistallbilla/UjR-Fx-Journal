// ============================================================
// UjR Fx Trading Journal
// Firebase + Firestore + Google Authentication
// ============================================================

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


// ============================================================
// FIREBASE CONFIG
// ============================================================
//
// IMPORTANT:
// If Firebase still says "auth/api-key-not-valid",
// get the CURRENT config from:
// Firebase Console > Project Settings > General > Your Apps
//
// Replace this block with the current config if necessary.
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyADCB2Vke4iXLm1zPj43cNQwC65GZlQ6Ns",
    authDomain: "journal-38e0e.firebaseapp.com",
    projectId: "journal-38e0e",
    storageBucket: "journal-38e0e.firebasestorage.app",
    messagingSenderId: "382226906837",
    appId: "1:382226906837:web:38df881c0f7beb24256c5c",
    measurementId: "G-R6LXDMQ9K2"
};


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

let app;
let auth;
let db;
let googleProvider;

try {

    app = initializeApp(firebaseConfig);

    auth = getAuth(app);

    db = getFirestore(app);

    googleProvider =
        new GoogleAuthProvider();

    googleProvider.setCustomParameters({
        prompt: "select_account"
    });

    console.log(
        "Firebase initialized."
    );

} catch (error) {

    console.error(
        "Firebase initialization error:",
        error
    );

}


// ============================================================
// STATE
// ============================================================

let currentUser = null;

let trades = [];

let unsubscribeTrades = null;

let calendarDate = new Date();

let toastTimer = null;

let account = {
    startingBalance: 0,
    currency: "USD"
};


// ============================================================
// HELPERS
// ============================================================

function $(id) {

    return document.getElementById(id);

}


function number(value) {

    const result =
        Number(value);

    return Number.isFinite(result)
        ? result
        : 0;

}


function setText(id, value) {

    const element =
        $(id);

    if (element) {
        element.textContent = value;
    }

}


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function getLocalDate() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function getLocalTime() {

    const now = new Date();

    const hours =
        String(
            now.getHours()
        ).padStart(2, "0");

    const minutes =
        String(
            now.getMinutes()
        ).padStart(2, "0");

    return `${hours}:${minutes}`;

}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );

}


function money(value) {

    const amount =
        number(value);

    const currency =
        account.currency || "USD";

    try {

        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(amount);

    } catch {

        return `$${amount.toFixed(2)}`;

    }

}


function moneyClass(value) {

    const amount =
        number(value);

    if (amount > 0) {
        return "positive";
    }

    if (amount < 0) {
        return "negative";
    }

    return "neutral";

}


function showToast(
    message,
    type = "normal"
) {

    const toast =
        $("toast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.className =
        "toast";

    if (type === "success") {
        toast.classList.add(
            "success"
        );
    }

    if (type === "error") {
        toast.classList.add(
            "error"
        );
    }

    toast.classList.remove(
        "hidden"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {
                toast.classList.add(
                    "hidden"
                );
            },
            3000
        );

}


// ============================================================
// LOGIN
// ============================================================

async function loginWithGoogle() {

    if (!auth) {

        showLoginError(
            "Firebase could not initialize. Check your Firebase configuration."
        );

        return;
    }

    const button =
        $("loginBtn");

    try {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Signing in...";

        }


        await signInWithPopup(
            auth,
            googleProvider
        );


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        let message =
            "Google login failed.";


        switch (error.code) {

            case "auth/api-key-not-valid":

                message =
                    "Firebase API key is invalid. Copy the current Web App Firebase config from Firebase Console.";

                break;


            case "auth/unauthorized-domain":

                message =
                    "This website is not authorized. Add localhost and/or 127.0.0.1 in Firebase Authentication > Settings > Authorized domains.";

                break;


            case "auth/operation-not-allowed":

                message =
                    "Google sign-in is not enabled. Enable Google under Firebase Authentication > Sign-in method.";

                break;


            case "auth/popup-blocked":

                message =
                    "Your browser blocked the Google login popup.";

                break;


            case "auth/popup-closed-by-user":

                message =
                    "The Google login window was closed.";

                break;


            case "auth/network-request-failed":

                message =
                    "Network error. Check your internet connection.";

                break;


            default:

                if (error.message) {
                    message =
                        error.message;
                }

                break;

        }


        showLoginError(
            message
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Continue with Google";

        }

    }

}


function showLoginError(
    message
) {

    const element =
        $("loginError");

    if (!element) {

        alert(message);

        return;
    }

    element.textContent =
        message;

    element.classList.remove(
        "hidden"
    );

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await signOut(auth);

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showToast(
            "Logout failed.",
            "error"
        );

    }

}


// ============================================================
// USER UI
// ============================================================

function updateUserUI() {

    if (!currentUser) {
        return;
    }


    const name =
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "Trader";


    const email =
        currentUser.email || "";


    const avatar =
        currentUser.photoURL || "";


    document
        .querySelectorAll(
            "[data-user-name]"
        )
        .forEach(
            element => {
                element.textContent =
                    name;
            }
        );


    document
        .querySelectorAll(
            "[data-user-email]"
        )
        .forEach(
            element => {
                element.textContent =
                    email;
            }
        );


    document
        .querySelectorAll(
            "[data-user-avatar]"
        )
        .forEach(
            element => {

                if (avatar) {

                    element.src =
                        avatar;

                } else {

                    element.src =
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=151515&color=d8a83e`;

                }

            }
        );

}


// ============================================================
// ACCOUNT SETTINGS
// ============================================================

async function loadAccount() {

    if (!currentUser || !db) {
        return;
    }


    try {

        const reference =
            doc(
                db,
                "users",
                currentUser.uid,
                "settings",
                "account"
            );


        const snapshot =
            await getDoc(
                reference
            );


        if (snapshot.exists()) {

            const data =
                snapshot.data();


            account = {

                startingBalance:
                    number(
                        data.startingBalance
                    ),

                currency:
                    data.currency ||
                    "USD"

            };

        }


        updateSettingsUI();


    } catch (error) {

        console.error(
            "Account loading error:",
            error
        );

        showToast(
            "Could not load account settings.",
            "error"
        );

    }

}


function updateSettingsUI() {

    const balance =
        $("startingBalance");

    if (balance) {

        balance.value =
            account.startingBalance ||
            "";

    }


    const currency =
        $("currency");

    if (currency) {

        currency.value =
            account.currency ||
            "USD";

    }

}


async function saveAccount() {

    if (!currentUser || !db) {
        return;
    }


    const startingBalance =
        number(
            $("startingBalance")?.value
        );


    const currency =
        $("currency")?.value ||
        "USD";


    account = {

        startingBalance,

        currency

    };


    try {

        await setDoc(

            doc(
                db,
                "users",
                currentUser.uid,
                "settings",
                "account"
            ),

            account,

            {
                merge: true
            }

        );


        showToast(
            "Settings saved.",
            "success"
        );


        renderAll();


    } catch (error) {

        console.error(
            "Save settings error:",
            error
        );

        showToast(
            "Could not save settings.",
            "error"
        );

    }

}


// ============================================================
// FIRESTORE TRADE LISTENER
// ============================================================

function startTradeListener() {

    if (!currentUser || !db) {
        return;
    }


    if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades =
            null;

    }


    const reference =
        collection(
            db,
            "users",
            currentUser.uid,
            "trades"
        );


    const tradeQuery =
        query(
            reference,
            orderBy(
                "createdAt",
                "desc"
            )
        );


    unsubscribeTrades =
        onSnapshot(

            tradeQuery,

            snapshot => {

                trades =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderAll();

            },


            error => {

                console.error(
                    "Firestore listener error:",
                    error
                );


                if (
                    error.code ===
                    "permission-denied"
                ) {

                    showToast(
                        "Firestore permission denied. Check Firestore Rules.",
                        "error"
                    );

                } else {

                    showToast(
                        "Could not load trades.",
                        "error"
                    );

                }

            }

        );

}


// ============================================================
// R:R CALCULATION
// ============================================================

function calculateTradeRR() {

    const entry =
        number(
            $("entry")?.value
        );


    const sl =
        number(
            $("sl")?.value
        );


    const tp =
        number(
            $("tp")?.value
        );


    const direction =
        $("direction")?.value ||
        "Buy";


    if (
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0
    ) {

        if ($("rr")) {
            $("rr").value = "";
        }

        return 0;

    }


    let risk;

    let reward;


    if (
        direction === "Buy"
    ) {

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


    if (
        risk <= 0 ||
        reward <= 0
    ) {

        if ($("rr")) {
            $("rr").value =
                "Invalid";
        }

        return 0;

    }


    const ratio =
        reward / risk;


    if ($("rr")) {

        $("rr").value =
            `1:${ratio.toFixed(2)}`;

    }


    return ratio;

}


// ============================================================
// AUTO LOT SIZE
// ============================================================

function calculateAutoLotSize() {

    const balance =
        number(
            account.startingBalance
        );


    const riskPercent =
        number(
            $("riskPercent")?.value
        );


    const entry =
        number(
            $("entry")?.value
        );


    const sl =
        number(
            $("sl")?.value
        );


    if (
        balance <= 0 ||
        riskPercent <= 0 ||
        entry <= 0 ||
        sl <= 0
    ) {

        return;

    }


    const riskAmount =
        balance *
        riskPercent /
        100;


    if ($("riskAmount")) {

        $("riskAmount").value =
            riskAmount.toFixed(2);

    }


    const distance =
        Math.abs(
            entry - sl
        );


    if (distance <= 0) {
        return;
    }


    // Simplified XAUUSD calculation.
    // Broker contract specifications can differ.

    const lot =
        riskAmount /
        (distance * 100);


    const lotInput =
        $("lotSize");


    if (!lotInput) {
        return;
    }


    if (
        lotInput.dataset.manual !==
        "true"
    ) {

        lotInput.value =
            Math.max(
                0.01,
                lot
            ).toFixed(2);

    }

}


// ============================================================
// OPEN TRADE MODAL
// ============================================================

function openTradeModal(
    trade = null
) {

    const modal =
        $("tradeModal");

    const form =
        $("tradeForm");


    if (!modal || !form) {
        return;
    }


    form.reset();


    const id =
        $("tradeId");


    if (id) {

        id.value =
            trade?.id || "";

    }


    if (trade) {

        $("tradeDate").value =
            trade.date || "";

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

        $("lotSize").dataset.manual =
            "true";


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
            trade.result || "";

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

    } else {

        $("tradeDate").value =
            getLocalDate();

        $("tradeTime").value =
            getLocalTime();

        $("pair").value =
            "XAUUSD";

        $("direction").value =
            "Buy";

        $("riskPercent").value =
            1;

        $("lotSize").value =
            "";

        $("lotSize").dataset.manual =
            "false";

    }


    calculateTradeRR();

    calculateAutoLotSize();


    const title =
        modal.querySelector(
            "[data-modal-title]"
        );


    if (title) {

        title.textContent =
            trade
                ? "Edit Trade"
                : "Add Trade";

    }


    modal.classList.remove(
        "hidden"
    );

}


function closeTradeModal() {

    $("tradeModal")
        ?.classList.add(
            "hidden"
        );

}


// ============================================================
// SAVE TRADE
// ============================================================

async function saveTrade(
    event
) {

    event.preventDefault();


    if (!currentUser || !db) {

        showToast(
            "Please login first.",
            "error"
        );

        return;

    }


    const entry =
        number(
            $("entry").value
        );


    const sl =
        number(
            $("sl").value
        );


    const tp =
        number(
            $("tp").value
        );


    const direction =
        $("direction").value;


    const rr =
        calculateTradeRR();


    if (
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0
    ) {

        showTradeError(
            "Enter valid Entry, SL and TP."
        );

        return;

    }


    if (rr <= 0) {

        showTradeError(
            "Your Entry, SL and TP do not match the selected direction."
        );

        return;

    }


    const tradeId =
        $("tradeId").value;


    const riskPercent =
        number(
            $("riskPercent").value
        );


    const riskAmount =
        account.startingBalance *
        riskPercent /
        100;


    const lotSize =
        number(
            $("lotSize").value
        );


    const data = {

        date:
            $("tradeDate").value ||
            getLocalDate(),

        time:
            $("tradeTime").value ||
            getLocalTime(),

        pair:
            $("pair").value ||
            "XAUUSD",

        direction,

        entry,

        sl,

        tp,

        rr:
            Number(
                rr.toFixed(4)
            ),

        riskPercent,

        riskAmount,

        lotSize,

        setup:
            $("setup").value || "",

        session:
            $("session").value || "",

        htfBias:
            $("htfBias").value || "",

        liquidity:
            $("liquidity").value || "",

        confirmation:
            $("confirmation").value || "",

        result:
            $("result").value || "",

        profitLoss:
            number(
                $("profitLoss").value
            ),

        confidence:
            $("confidence").value || "",

        psychology:
            $("psychology").value || "",

        mistake:
            $("mistake").value || "",

        notes:
            $("notes").value || "",

        updatedAt:
            Date.now()

    };


    try {

        if (tradeId) {

            await updateDoc(

                doc(
                    db,
                    "users",
                    currentUser.uid,
                    "trades",
                    tradeId
                ),

                data

            );


            showToast(
                "Trade updated.",
                "success"
            );

        } else {

            data.createdAt =
                Date.now();


            await addDoc(

                collection(
                    db,
                    "users",
                    currentUser.uid,
                    "trades"
                ),

                data

            );


            showToast(
                "Trade added.",
                "success"
            );

        }


        closeTradeModal();


    } catch (error) {

        console.error(
            "Trade save error:",
            error
        );


        showTradeError(
            error.message ||
            "Could not save trade."
        );

    }

}


function showTradeError(
    message
) {

    const element =
        $("tradeError");


    if (!element) {

        showToast(
            message,
            "error"
        );

        return;

    }


    element.textContent =
        message;


    element.classList.remove(
        "hidden"
    );

}


// ============================================================
// DELETE TRADE
// ============================================================

async function deleteTrade(
    tradeId
) {

    if (!currentUser || !db) {
        return;
    }


    if (
        !confirm(
            "Delete this trade?"
        )
    ) {

        return;

    }


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


        showToast(
            "Trade deleted.",
            "success"
        );


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );


        showToast(
            "Could not delete trade.",
            "error"
        );

    }

}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {

    const total =
        trades.length;


    const wins =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) > 0
        ).length;


    const losses =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) < 0
        ).length;


    const pnl =
        trades.reduce(
            (
                total,
                trade
            ) =>
                total +
                number(
                    trade.profitLoss
                ),
            0
        );


    const winRate =
        total > 0
            ? wins / total * 100
            : 0;


    setText(
        "dashboardTotalTrades",
        total
    );


    setText(
        "dashboardWins",
        wins
    );


    setText(
        "dashboardLosses",
        losses
    );


    setText(
        "dashboardWinRate",
        `${winRate.toFixed(1)}%`
    );


    setText(
        "dashboardPL",
        money(pnl)
    );


    setText(
        "dashboardBalance",
        money(
            account.startingBalance +
            pnl
        )
    );


    const container =
        $("recentTrades");


    if (!container) {
        return;
    }


    if (!trades.length) {

        container.innerHTML =
            `
            <div class="empty-state">
                <h3>No trades yet</h3>
                <p>Add your first trade.</p>
            </div>
            `;

        return;
    }


    container.innerHTML =
        trades
            .slice(0, 5)
            .map(
                trade => {

                    const pnl =
                        number(
                            trade.profitLoss
                        );


                    return `
                    <div class="recent-trade">

                        <div>
                            <strong>
                                ${escapeHTML(
                                    trade.pair ||
                                    "XAUUSD"
                                )}
                            </strong>

                            <small>
                                ${formatDate(
                                    trade.date
                                )}
                            </small>
                        </div>

                        <div
                            class="${moneyClass(pnl)}"
                        >
                            ${pnl >= 0 ? "+" : ""}
                            ${money(pnl)}
                        </div>

                    </div>
                    `;

                }
            )
            .join("");

}


// ============================================================
// JOURNAL
// ============================================================

function renderJournal() {

    const tbody =
        $("journalTableBody");


    if (!tbody) {
        return;
    }


    const search =
        (
            $("journalSearch")
                ?.value ||
            ""
        )
            .toLowerCase();


    const resultFilter =
        $("journalResultFilter")
            ?.value ||
        "all";


    const directionFilter =
        $("journalDirectionFilter")
            ?.value ||
        "all";


    const filtered =
        trades.filter(
            trade => {

                const text =
                    [
                        trade.pair,
                        trade.setup,
                        trade.session,
                        trade.result,
                        trade.notes
                    ]
                        .join(" ")
                        .toLowerCase();


                const searchMatch =
                    !search ||
                    text.includes(
                        search
                    );


                const pnl =
                    number(
                        trade.profitLoss
                    );


                let resultMatch =
                    true;


                if (
                    resultFilter ===
                    "win"
                ) {

                    resultMatch =
                        pnl > 0;

                }


                if (
                    resultFilter ===
                    "loss"
                ) {

                    resultMatch =
                        pnl < 0;

                }


                if (
                    resultFilter ===
                    "breakeven"
                ) {

                    resultMatch =
                        pnl === 0;

                }


                const directionMatch =
                    directionFilter ===
                        "all" ||
                    trade.direction ===
                        directionFilter;


                return (
                    searchMatch &&
                    resultMatch &&
                    directionMatch
                );

            }
        );


    updateJournalSummary();


    if (!filtered.length) {

        tbody.innerHTML =
            "";

        $("journalEmpty")
            ?.classList.remove(
                "hidden"
            );

        return;

    }


    $("journalEmpty")
        ?.classList.add(
            "hidden"
        );


    tbody.innerHTML =
        filtered
            .map(
                trade => {

                    const pnl =
                        number(
                            trade.profitLoss
                        );


                    const rr =
                        number(
                            trade.rr
                        );


                    return `
                    <tr>

                        <td>
                            ${formatDate(
                                trade.date
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                trade.pair ||
                                "XAUUSD"
                            )}
                        </td>

                        <td>
                            <span
                                class="direction ${
                                    String(
                                        trade.direction ||
                                        ""
                                    ).toLowerCase()
                                }"
                            >
                                ${escapeHTML(
                                    trade.direction ||
                                    "-"
                                )}
                            </span>
                        </td>

                        <td>
                            ${number(
                                trade.entry
                            ).toFixed(2)}
                        </td>

                        <td>
                            ${number(
                                trade.sl
                            ).toFixed(2)}
                        </td>

                        <td>
                            ${number(
                                trade.tp
                            ).toFixed(2)}
                        </td>

                        <td>
                            1:${rr.toFixed(2)}
                        </td>

                        <td
                            class="${moneyClass(pnl)}"
                        >
                            ${pnl >= 0 ? "+" : ""}
                            ${money(pnl)}
                        </td>

                        <td>

                            <button
                                class="table-btn"
                                data-edit="${trade.id}"
                                type="button"
                            >
                                Edit
                            </button>

                            <button
                                class="table-btn danger"
                                data-delete="${trade.id}"
                                type="button"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>
                    `;

                }
            )
            .join("");

}


function updateJournalSummary() {

    const wins =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) > 0
        ).length;


    const losses =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) < 0
        ).length;


    const pnl =
        trades.reduce(
            (
                total,
                trade
            ) =>
                total +
                number(
                    trade.profitLoss
                ),
            0
        );


    setText(
        "journalTotal",
        trades.length
    );


    setText(
        "journalWins",
        wins
    );


    setText(
        "journalLosses",
        losses
    );


    setText(
        "journalPL",
        money(pnl)
    );

}


// ============================================================
// ANALYTICS
// ============================================================

function renderAnalytics() {

    const total =
        trades.length;


    const wins =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) > 0
        ).length;


    const losses =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) < 0
        ).length;


    const breakeven =
        trades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) === 0
        ).length;


    const winRate =
        total > 0
            ? wins / total * 100
            : 0;


    const profit =
        trades
            .filter(
                trade =>
                    number(
                        trade.profitLoss
                    ) > 0
            )
            .reduce(
                (
                    total,
                    trade
                ) =>
                    total +
                    number(
                        trade.profitLoss
                    ),
                0
            );


    const loss =
        trades
            .filter(
                trade =>
                    number(
                        trade.profitLoss
                    ) < 0
            )
            .reduce(
                (
                    total,
                    trade
                ) =>
                    total +
                    number(
                        trade.profitLoss
                    ),
                0
            );


    setText(
        "analyticsTotal",
        total
    );


    setText(
        "analyticsWins",
        wins
    );


    setText(
        "analyticsLosses",
        losses
    );


    setText(
        "analyticsBreakeven",
        breakeven
    );


    setText(
        "analyticsWinRate",
        `${winRate.toFixed(1)}%`
    );


    setText(
        "analyticsProfit",
        money(profit)
    );


    setText(
        "analyticsLoss",
        money(loss)
    );


    setText(
        "analyticsNet",
        money(
            profit + loss
        )
    );

}


// ============================================================
// CALENDAR
// ============================================================

function renderCalendar() {

    const grid =
        $("calendarGrid");


    if (!grid) {
        return;
    }


    const year =
        calendarDate.getFullYear();


    const month =
        calendarDate.getMonth();


    const label =
        calendarDate.toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );


    setText(
        "calendarMonthLabel",
        label
    );


    const monthTrades =
        trades.filter(
            trade => {

                if (!trade.date) {
                    return false;
                }


                const date =
                    new Date(
                        `${trade.date}T00:00:00`
                    );


                return (
                    date.getFullYear() ===
                        year &&
                    date.getMonth() ===
                        month
                );

            }
        );


    const monthPL =
        monthTrades.reduce(
            (
                total,
                trade
            ) =>
                total +
                number(
                    trade.profitLoss
                ),
            0
        );


    const wins =
        monthTrades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) > 0
        ).length;


    const losses =
        monthTrades.filter(
            trade =>
                number(
                    trade.profitLoss
                ) < 0
        ).length;


    setText(
        "calendarMonthPL",
        money(monthPL)
    );


    setText(
        "calendarWins",
        wins
    );


    setText(
        "calendarLosses",
        losses
    );


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const days =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    let html = "";


    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        html +=
            `<div class="calendar-day empty"></div>`;

    }


    for (
        let day = 1;
        day <= days;
        day++
    ) {

        const date =
            `${year}-${String(
                month + 1
            ).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`;


        const dayTrades =
            monthTrades.filter(
                trade =>
                    trade.date ===
                    date
            );


        const pnl =
            dayTrades.reduce(
                (
                    total,
                    trade
                ) =>
                    total +
                    number(
                        trade.profitLoss
                    ),
                0
            );


        const today =
            date ===
            getLocalDate();


        html += `
            <div
                class="calendar-day ${
                    today ? "today" : ""
                }"
            >

                <div class="calendar-date">
                    ${day}
                </div>

                ${
                    dayTrades.length
                        ? `
                            <div class="calendar-trades">
                                ${dayTrades.length}
                                ${
                                    dayTrades.length === 1
                                        ? "trade"
                                        : "trades"
                                }
                            </div>

                            <div
                                class="calendar-pnl ${moneyClass(pnl)}"
                            >
                                ${
                                    pnl >= 0
                                        ? "+"
                                        : ""
                                }${money(pnl)}
                            </div>
                        `
                        : `
                            <div class="calendar-no-trade">
                                No trade
                            </div>
                        `
                }

            </div>
        `;

    }


    grid.innerHTML =
        html;

}


// ============================================================
// RISK CALCULATOR
// ============================================================

function calculateRisk() {

    const balance =
        number(
            $("riskBalance")?.value
        );


    const percent =
        number(
            $("riskCalcPercent")?.value
        );


    const entry =
        number(
            $("riskEntry")?.value
        );


    const sl =
        number(
            $("riskSL")?.value
        );


    const risk =
        balance *
        percent /
        100;


    const distance =
        Math.abs(
            entry - sl
        );


    let lot = 0;


    if (
        risk > 0 &&
        distance > 0
    ) {

        lot =
            risk /
            (
                distance *
                100
            );

    }


    setText(
        "riskAmountResult",
        money(risk)
    );


    setText(
        "riskLotResult",
        lot > 0
            ? lot.toFixed(2)
            : "-"
    );

}


// ============================================================
// CSV
// ============================================================

function exportCSV() {

    if (!trades.length) {

        showToast(
            "No trades to export.",
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
            trade =>
                [

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

                ]
                    .map(
                        value =>
                            `"${String(
                                value ?? ""
                            ).replaceAll(
                                '"',
                                '""'
                            )}"`
                    )
                    .join(",")
        );


    const csv =
        [
            headers.join(","),
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
        `UjR-Fx-Journal-${getLocalDate()}.csv`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "CSV exported.",
        "success"
    );

}


// ============================================================
// NAVIGATION
// ============================================================

function showPage(
    name
) {

    document
        .querySelectorAll(
            ".page"
        )
        .forEach(
            page =>
                page.classList.add(
                    "hidden"
                )
        );


    const page =
        $(`${name}Page`);


    if (page) {

        page.classList.remove(
            "hidden"
        );

    }


    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page ===
                        name
                );

            }
        );


    closeMobileMenu();

}


// ============================================================
// MOBILE MENU
// ============================================================

function openMobileMenu() {

    $("sidebar")
        ?.classList.add(
            "open"
        );


    $("overlay")
        ?.classList.add(
            "show"
        );

}


function closeMobileMenu() {

    $("sidebar")
        ?.classList.remove(
            "open"
        );


    $("overlay")
        ?.classList.remove(
            "show"
        );

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

    $("loginBtn")
        ?.addEventListener(
            "click",
            loginWithGoogle
        );


    $("logoutBtn")
        ?.addEventListener(
            "click",
            logout
        );


    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        showPage(
                            button.dataset.page
                        )
                );

            }
        );


    $("mobileMenuBtn")
        ?.addEventListener(
            "click",
            openMobileMenu
        );


    $("overlay")
        ?.addEventListener(
            "click",
            closeMobileMenu
        );


    $("quickAddBtn")
        ?.addEventListener(
            "click",
            () => openTradeModal()
        );


    $("journalAddBtn")
        ?.addEventListener(
            "click",
            () => openTradeModal()
        );


    $("mobileAddBtn")
        ?.addEventListener(
            "click",
            () => openTradeModal()
        );


    $("closeModal")
        ?.addEventListener(
            "click",
            closeTradeModal
        );


    $("cancelTrade")
        ?.addEventListener(
            "click",
            closeTradeModal
        );


    $("tradeForm")
        ?.addEventListener(
            "submit",
            saveTrade
        );


    [
        "entry",
        "sl",
        "tp"
    ].forEach(
        id => {

            $(id)?.addEventListener(
                "input",
                () => {

                    calculateTradeRR();

                    calculateAutoLotSize();

                }
            );

        }
    );


    $("direction")
        ?.addEventListener(
            "change",
            () => {

                calculateTradeRR();

                calculateAutoLotSize();

            }
        );


    $("riskPercent")
        ?.addEventListener(
            "input",
            calculateAutoLotSize
        );


    $("lotSize")
        ?.addEventListener(
            "input",
            () => {

                $("lotSize").dataset.manual =
                    "true";

            }
        );


    [
        "journalSearch",
        "journalResultFilter",
        "journalDirectionFilter"
    ].forEach(
        id => {

            $(id)?.addEventListener(
                "input",
                renderJournal
            );

            $(id)?.addEventListener(
                "change",
                renderJournal
            );

        }
    );


    $("journalTableBody")
        ?.addEventListener(
            "click",
            event => {

                const edit =
                    event.target.closest(
                        "[data-edit]"
                    );


                if (edit) {

                    const trade =
                        trades.find(
                            item =>
                                item.id ===
                                edit.dataset.edit
                        );


                    if (trade) {

                        openTradeModal(
                            trade
                        );

                    }

                    return;

                }


                const remove =
                    event.target.closest(
                        "[data-delete]"
                    );


                if (remove) {

                    deleteTrade(
                        remove.dataset.delete
                    );

                }

            }
        );


    $("saveSettingsBtn")
        ?.addEventListener(
            "click",
            saveAccount
        );


    [
        "riskBalance",
        "riskCalcPercent",
        "riskEntry",
        "riskSL"
    ].forEach(
        id => {

            $(id)?.addEventListener(
                "input",
                calculateRisk
            );

        }
    );


    $("prevMonth")
        ?.addEventListener(
            "click",
            () => {

                calendarDate =
                    new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() - 1,
                        1
                    );

                renderCalendar();

            }
        );


    $("nextMonth")
        ?.addEventListener(
            "click",
            () => {

                calendarDate =
                    new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() + 1,
                        1
                    );

                renderCalendar();

            }
        );


    $("todayMonth")
        ?.addEventListener(
            "click",
            () => {

                calendarDate =
                    new Date();

                renderCalendar();

            }
        );


    $("exportCSV")
        ?.addEventListener(
            "click",
            exportCSV
        );


    $("tradeModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("tradeModal")
                ) {

                    closeTradeModal();

                }

            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                    "Escape"
            ) {

                closeTradeModal();

                closeMobileMenu();

            }


            if (
                event.key.toLowerCase() ===
                    "n" &&

                $("tradeModal")
                    ?.classList
                    .contains(
                        "hidden"
                    ) &&

                document.activeElement
                    ?.tagName !==
                    "INPUT" &&

                document.activeElement
                    ?.tagName !==
                    "TEXTAREA" &&

                document.activeElement
                    ?.tagName !==
                    "SELECT"
            ) {

                openTradeModal();

            }

        }
    );

}


// ============================================================
// AUTH STATE
// ============================================================

function setupAuth() {

    if (!auth) {

        showLoginError(
            "Firebase failed to initialize. Check your Firebase configuration."
        );

        return;

    }


    onAuthStateChanged(
        auth,
        async user => {

            currentUser =
                user;


            if (user) {

                $("loginScreen")
                    ?.classList.add(
                        "hidden"
                    );


                $("app")
                    ?.classList.remove(
                        "hidden"
                    );


                updateUserUI();


                await loadAccount();


                startTradeListener();


                renderAll();

            } else {

                $("loginScreen")
                    ?.classList.remove(
                        "hidden"
                    );


                $("app")
                    ?.classList.add(
                        "hidden"
                    );


                currentUser =
                    null;


                trades = [];


                if (
                    unsubscribeTrades
                ) {

                    unsubscribeTrades();

                    unsubscribeTrades =
                        null;

                }

            }

        }
    );

}


// ============================================================
// RENDER ALL
// ============================================================

function renderAll() {

    renderDashboard();

    renderJournal();

    renderAnalytics();

    renderCalendar();

}


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        setupAuth();

        renderAll();

    }
);
