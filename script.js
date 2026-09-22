// ============================================================
// UjR Fx Trading Journal
// Firebase + Trading Journal
// ============================================================

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
// INITIALIZE FIREBASE
// ============================================================

let firebaseApp;
let auth;
let db;
let googleProvider;

try {
  firebaseApp = initializeApp(firebaseConfig);

  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);

  googleProvider = new GoogleAuthProvider();

  googleProvider.setCustomParameters({
    prompt: "select_account"
  });

  console.log("Firebase initialized successfully.");

} catch (error) {
  console.error("Firebase initialization error:", error);
}


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let trades = [];

let account = {
  startingBalance: 0,
  currency: "USD"
};

let unsubscribeTrades = null;

let calendarDate = new Date();

let toastTimer = null;


// ============================================================
// HELPERS
// ============================================================

function $(id) {
  return document.getElementById(id);
}


function number(value) {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}


function money(value) {
  const amount = number(value);

  const currency = account.currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}


function moneyClass(value) {
  const n = number(value);

  if (n > 0) return "positive";

  if (n < 0) return "negative";

  return "neutral";
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

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getLocalTime() {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");

  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}


function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}


function showToast(message, type = "normal") {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.className = "toast";

  if (type === "success") {
    toast.classList.add("success");
  }

  if (type === "error") {
    toast.classList.add("error");
  }

  toast.classList.remove("hidden");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}


// ============================================================
// AUTHENTICATION
// ============================================================

async function loginWithGoogle() {
  if (!auth) {
    showLoginError(
      "Firebase is not initialized. Check your Firebase configuration."
    );

    return;
  }

  const loginButton = $("loginBtn");

  try {
    if (loginButton) {
      loginButton.disabled = true;

      loginButton.textContent = "Signing in...";
    }

    await signInWithPopup(auth, googleProvider);

  } catch (error) {
    console.error("Google login error:", error);

    let message = "Unable to sign in.";

    if (error.code === "auth/api-key-not-valid") {
      message =
        "Firebase API key is invalid. Check the Firebase configuration in script.js.";
    }

    else if (error.code === "auth/unauthorized-domain") {
      message =
        "This website domain is not authorized in Firebase Authentication.";
    }

    else if (error.code === "auth/popup-blocked") {
      message =
        "Your browser blocked the Google login popup.";
    }

    else if (error.code === "auth/popup-closed-by-user") {
      message =
        "Google login window was closed.";
    }

    else if (error.code === "auth/operation-not-allowed") {
      message =
        "Google sign-in is not enabled in Firebase Authentication.";
    }

    else if (error.code === "auth/network-request-failed") {
      message =
        "Network error. Check your internet connection.";
    }

    else if (error.message) {
      message = error.message;
    }

    showLoginError(message);

  } finally {
    if (loginButton) {
      loginButton.disabled = false;

      loginButton.textContent = "Continue with Google";
    }
  }
}


function showLoginError(message) {
  const errorElement = $("loginError");

  if (!errorElement) {
    alert(message);

    return;
  }

  errorElement.textContent = message;

  errorElement.classList.remove("hidden");
}


async function logout() {
  try {
    await signOut(auth);

    showToast("Logged out successfully.", "success");

  } catch (error) {
    console.error("Logout error:", error);

    showToast("Logout failed.", "error");
  }
}


// ============================================================
// USER UI
// ============================================================

function updateUserUI() {
  if (!currentUser) return;

  const name =
    currentUser.displayName ||
    currentUser.email?.split("@")[0] ||
    "Trader";

  const email = currentUser.email || "";

  const photo = currentUser.photoURL || "";


  const nameElements = document.querySelectorAll("[data-user-name]");

  nameElements.forEach(element => {
    element.textContent = name;
  });


  const emailElements = document.querySelectorAll("[data-user-email]");

  emailElements.forEach(element => {
    element.textContent = email;
  });


  const avatarElements = document.querySelectorAll("[data-user-avatar]");

  avatarElements.forEach(element => {

    if (photo) {
      element.src = photo;
    }

    else {
      element.src =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=151515&color=d8a83e`;
    }
  });
}


// ============================================================
// ACCOUNT SETTINGS
// ============================================================

async function loadAccount() {
  if (!currentUser || !db) return;

  try {
    const accountRef = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

    const snapshot = await getDoc(accountRef);

    if (snapshot.exists()) {

      const data = snapshot.data();

      account = {
        startingBalance: number(data.startingBalance),
        currency: data.currency || "USD"
      };

    }

    else {

      account = {
        startingBalance: 0,
        currency: "USD"
      };

    }

    updateSettingsUI();

  } catch (error) {

    console.error("Load account error:", error);

    if (error.code === "permission-denied") {
      showToast(
        "Firestore permission denied. Check your Firebase rules.",
        "error"
      );
    }
  }
}


function updateSettingsUI() {

  const balanceInput = $("startingBalance");

  if (balanceInput) {
    balanceInput.value =
      account.startingBalance || "";
  }


  const currencyInput = $("currency");

  if (currencyInput) {
    currencyInput.value =
      account.currency || "USD";
  }
}


async function saveAccount() {
  if (!currentUser || !db) return;

  const startingBalance =
    number($("startingBalance")?.value);

  const currency =
    $("currency")?.value || "USD";


  account = {
    startingBalance,
    currency
  };


  try {

    const accountRef = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );


    await setDoc(
      accountRef,
      account,
      { merge: true }
    );


    showToast(
      "Account settings saved.",
      "success"
    );


    renderAll();

  } catch (error) {

    console.error(
      "Save account error:",
      error
    );

    showToast(
      "Could not save account settings.",
      "error"
    );
  }
}


// ============================================================
// TRADES FIRESTORE
// ============================================================

function startTradeListener() {

  if (!currentUser || !db) return;


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


  const tradesQuery = query(
    tradesRef,
    orderBy("createdAt", "desc")
  );


  unsubscribeTrades = onSnapshot(
    tradesQuery,

    snapshot => {

      trades = snapshot.docs.map(
        item => ({
          id: item.id,
          ...item.data()
        })
      );


      renderAll();

    },

    error => {

      console.error(
        "Trade listener error:",
        error
      );


      if (error.code === "failed-precondition") {

        showToast(
          "Firestore index required.",
          "error"
        );

      }

      else if (
        error.code === "permission-denied"
      ) {

        showToast(
          "Firestore permission denied.",
          "error"
        );

      }

      else {

        showToast(
          "Could not load trades.",
          "error"
        );
      }
    }
  );
}


// ============================================================
// TRADE CALCULATIONS
// ============================================================

function calculateTradeRR() {

  const entry =
    number($("entry")?.value);

  const sl =
    number($("sl")?.value);

  const tp =
    number($("tp")?.value);

  const direction =
    $("direction")?.value || "Buy";


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


  let risk = 0;

  let reward = 0;


  if (direction === "Buy") {

    risk = entry - sl;

    reward = tp - entry;

  }

  else {

    risk = sl - entry;

    reward = entry - tp;
  }


  if (
    risk <= 0 ||
    reward <= 0
  ) {

    if ($("rr")) {
      $("rr").value = "Invalid";
    }

    return 0;
  }


  const rr =
    reward / risk;


  if ($("rr")) {

    $("rr").value =
      `1:${rr.toFixed(2)}`;
  }


  return rr;
}


// ============================================================
// AUTO LOT SIZE
// ============================================================

function calculateAutoLotSize() {

  const balance =
    account.startingBalance || 0;

  const riskPercent =
    number($("riskPercent")?.value);

  const entry =
    number($("entry")?.value);

  const sl =
    number($("sl")?.value);


  if (
    balance <= 0 ||
    riskPercent <= 0 ||
    entry <= 0 ||
    sl <= 0
  ) {

    return;
  }


  const riskAmount =
    balance * riskPercent / 100;


  if ($("riskAmount")) {

    $("riskAmount").value =
      riskAmount.toFixed(2);
  }


  const distance =
    Math.abs(entry - sl);


  if (distance <= 0) return;


  // Simplified XAUUSD contract assumption.
  // Actual broker contract size/tick value can differ.

  const lot =
    riskAmount /
    (distance * 100);


  if ($("lotSize")) {

    const input =
      $("lotSize");


    // Don't overwrite a manually changed lot size.

    if (
      input.dataset.auto !== "false"
    ) {

      input.value =
        Math.max(
          0.01,
          lot
        ).toFixed(2);

      input.dataset.auto =
        "true";
    }
  }
}


// ============================================================
// TRADE MODAL
// ============================================================

function openTradeModal(trade = null) {

  const modal =
    $("tradeModal");

  const form =
    $("tradeForm");


  if (!modal || !form) return;


  form.reset();


  const tradeId =
    $("tradeId");


  if (tradeId) {
    tradeId.value =
      trade?.id || "";
  }


  if (trade) {

    if ($("tradeDate"))
      $("tradeDate").value =
        trade.date || "";

    if ($("tradeTime"))
      $("tradeTime").value =
        trade.time || "";

    if ($("pair"))
      $("pair").value =
        trade.pair || "XAUUSD";

    if ($("direction"))
      $("direction").value =
        trade.direction || "Buy";

    if ($("entry"))
      $("entry").value =
        trade.entry ?? "";

    if ($("sl"))
      $("sl").value =
        trade.sl ?? "";

    if ($("tp"))
      $("tp").value =
        trade.tp ?? "";

    if ($("rr"))
      $("rr").value =
        trade.rr || "";

    if ($("riskPercent"))
      $("riskPercent").value =
        trade.riskPercent ?? 1;

    if ($("riskAmount"))
      $("riskAmount").value =
        trade.riskAmount ?? "";

    if ($("lotSize")) {

      $("lotSize").value =
        trade.lotSize ?? "";

      $("lotSize").dataset.auto =
        "false";
    }

    if ($("setup"))
      $("setup").value =
        trade.setup || "";

    if ($("session"))
      $("session").value =
        trade.session || "";

    if ($("htfBias"))
      $("htfBias").value =
        trade.htfBias || "";

    if ($("liquidity"))
      $("liquidity").value =
        trade.liquidity || "";

    if ($("confirmation"))
      $("confirmation").value =
        trade.confirmation || "";

    if ($("result"))
      $("result").value =
        trade.result || "";

    if ($("profitLoss"))
      $("profitLoss").value =
        trade.profitLoss ?? "";

    if ($("confidence"))
      $("confidence").value =
        trade.confidence || "";

    if ($("psychology"))
      $("psychology").value =
        trade.psychology || "";

    if ($("mistake"))
      $("mistake").value =
        trade.mistake || "";

    if ($("notes"))
      $("notes").value =
        trade.notes || "";

  }

  else {

    if ($("tradeDate"))
      $("tradeDate").value =
        getLocalDate();

    if ($("tradeTime"))
      $("tradeTime").value =
        getLocalTime();

    if ($("pair"))
      $("pair").value =
        "XAUUSD";

    if ($("direction"))
      $("direction").value =
        "Buy";

    if ($("riskPercent"))
      $("riskPercent").value =
        1;

    if ($("lotSize")) {

      $("lotSize").value =
        "";

      $("lotSize").dataset.auto =
        "true";
    }

    calculateAutoLotSize();
  }


  calculateTradeRR();


  const title =
    modal.querySelector("[data-modal-title]");


  if (title) {

    title.textContent =
      trade
        ? "Edit Trade"
        : "Add Trade";
  }


  modal.classList.remove("hidden");
}


function closeTradeModal() {

  const modal =
    $("tradeModal");

  if (!modal) return;

  modal.classList.add("hidden");
}


// ============================================================
// SAVE TRADE
// ============================================================

async function saveTrade(event) {

  event.preventDefault();


  if (!currentUser || !db) {

    showToast(
      "You are not logged in.",
      "error"
    );

    return;
  }


  const tradeError =
    $("tradeError");


  if (tradeError) {
    tradeError.textContent = "";
    tradeError.classList.add("hidden");
  }


  const entry =
    number($("entry")?.value);

  const sl =
    number($("sl")?.value);

  const tp =
    number($("tp")?.value);

  const direction =
    $("direction")?.value || "Buy";


  const rr =
    calculateTradeRR();


  if (
    entry <= 0 ||
    sl <= 0 ||
    tp <= 0
  ) {

    showTradeError(
      "Enter valid Entry, Stop Loss and Take Profit."
    );

    return;
  }


  if (rr <= 0) {

    showTradeError(
      "Your Entry, SL and TP are invalid for this direction."
    );

    return;
  }


  const tradeId =
    $("tradeId")?.value || "";


  const lotSize =
    number($("lotSize")?.value);


  const riskPercent =
    number($("riskPercent")?.value);


  const riskAmount =
    account.startingBalance *
    riskPercent /
    100;


  const profitLoss =
    number($("profitLoss")?.value);


  const tradeData = {

    date:
      $("tradeDate")?.value ||
      getLocalDate(),

    time:
      $("tradeTime")?.value ||
      getLocalTime(),

    pair:
      $("pair")?.value ||
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
      $("setup")?.value || "",

    session:
      $("session")?.value || "",

    htfBias:
      $("htfBias")?.value || "",

    liquidity:
      $("liquidity")?.value || "",

    confirmation:
      $("confirmation")?.value || "",

    result:
      $("result")?.value || "",

    profitLoss,

    confidence:
      $("confidence")?.value || "",

    psychology:
      $("psychology")?.value || "",

    mistake:
      $("mistake")?.value || "",

    notes:
      $("notes")?.value || "",

    updatedAt:
      Date.now()
  };


  try {

    if (tradeId) {

      const tradeRef =
        doc(
          db,
          "users",
          currentUser.uid,
          "trades",
          tradeId
        );


      await updateDoc(
        tradeRef,
        tradeData
      );


      showToast(
        "Trade updated.",
        "success"
      );

    }

    else {

      tradeData.createdAt =
        Date.now();


      const tradesRef =
        collection(
          db,
          "users",
          currentUser.uid,
          "trades"
        );


      await addDoc(
        tradesRef,
        tradeData
      );


      showToast(
        "Trade added successfully.",
        "success"
      );
    }


    closeTradeModal();


  } catch (error) {

    console.error(
      "Save trade error:",
      error
    );


    if (
      error.code ===
      "permission-denied"
    ) {

      showTradeError(
        "Firestore permission denied. Check your Firestore security rules."
      );

    }

    else {

      showTradeError(
        error.message ||
        "Could not save trade."
      );
    }
  }
}


function showTradeError(message) {

  const error =
    $("tradeError");

  if (!error) {

    showToast(
      message,
      "error"
    );

    return;
  }


  error.textContent =
    message;

  error.classList.remove(
    "hidden"
  );
}


// ============================================================
// DELETE TRADE
// ============================================================

async function deleteTrade(tradeId) {

  if (!currentUser || !db) return;


  const trade =
    trades.find(
      item => item.id === tradeId
    );


  if (!trade) return;


  const confirmed =
    confirm(
      "Delete this trade?"
    );


  if (!confirmed) return;


  try {

    const tradeRef =
      doc(
        db,
        "users",
        currentUser.uid,
        "trades",
        tradeId
      );


    await deleteDoc(
      tradeRef
    );


    showToast(
      "Trade deleted.",
      "success"
    );

  } catch (error) {

    console.error(
      "Delete trade error:",
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
        number(trade.profitLoss) > 0
    ).length;


  const losses =
    trades.filter(
      trade =>
        number(trade.profitLoss) < 0
    ).length;


  const pnl =
    trades.reduce(
      (sum, trade) =>
        sum +
        number(trade.profitLoss),
      0
    );


  const winRate =
    total > 0
      ? (wins / total) * 100
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


  const balance =
    account.startingBalance +
    pnl;


  setText(
    "dashboardBalance",
    money(balance)
  );


  const recentContainer =
    $("recentTrades");


  if (!recentContainer) return;


  const recent =
    trades.slice(0, 5);


  if (!recent.length) {

    recentContainer.innerHTML =
      `<div class="empty-state">
        No trades yet.
      </div>`;

    return;
  }


  recentContainer.innerHTML =
    recent.map(
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
                  trade.pair || "XAUUSD"
                )}
              </strong>

              <small>
                ${escapeHTML(
                  trade.date || ""
                )}
              </small>
            </div>

            <div>
              <span class="${moneyClass(pnl)}">
                ${pnl >= 0 ? "+" : ""}
                ${money(pnl)}
              </span>
            </div>

          </div>
        `;
      }
    ).join("");
}


// ============================================================
// JOURNAL
// ============================================================

function renderJournal() {

  const tbody =
    $("journalTableBody");


  if (!tbody) return;


  const search =
    (
      $("journalSearch")?.value ||
      ""
    ).toLowerCase();


  const resultFilter =
    $("journalResultFilter")?.value ||
    "all";


  const directionFilter =
    $("journalDirectionFilter")?.value ||
    "all";


  let filtered =
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


        const matchesSearch =
          !search ||
          text.includes(search);


        const pnl =
          number(
            trade.profitLoss
          );


        let matchesResult =
          true;


        if (resultFilter === "win") {

          matchesResult =
            pnl > 0;

        }

        else if (
          resultFilter === "loss"
        ) {

          matchesResult =
            pnl < 0;

        }

        else if (
          resultFilter === "breakeven"
        ) {

          matchesResult =
            pnl === 0;
        }


        const matchesDirection =
          directionFilter === "all" ||
          trade.direction ===
            directionFilter;


        return (
          matchesSearch &&
          matchesResult &&
          matchesDirection
        );
      }
    );


  if (!filtered.length) {

    tbody.innerHTML = "";

    const empty =
      $("journalEmpty");

    if (empty) {
      empty.classList.remove(
        "hidden"
      );
    }

    return;
  }


  const empty =
    $("journalEmpty");

  if (empty) {
    empty.classList.add(
      "hidden"
    );
  }


  tbody.innerHTML =
    filtered.map(
      trade => {

        const pnl =
          number(
            trade.profitLoss
          );


        const rr =
          number(trade.rr);


        return `
          <tr>

            <td>
              ${formatDate(
                trade.date
              )}
            </td>

            <td>
              ${escapeHTML(
                trade.pair || "XAUUSD"
              )}
            </td>

            <td>
              <span class="direction ${String(
                trade.direction || ""
              ).toLowerCase()}">
                ${escapeHTML(
                  trade.direction || "-"
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

            <td class="${moneyClass(pnl)}">
              ${pnl >= 0 ? "+" : ""}
              ${money(pnl)}
            </td>

            <td>
              <button
                class="table-btn"
                data-edit-trade="${trade.id}">
                Edit
              </button>

              <button
                class="table-btn danger"
                data-delete-trade="${trade.id}">
                Delete
              </button>
            </td>

          </tr>
        `;
      }
    ).join("");
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
        number(trade.profitLoss) > 0
    ).length;


  const losses =
    trades.filter(
      trade =>
        number(trade.profitLoss) < 0
    ).length;


  const breakeven =
    trades.filter(
      trade =>
        number(trade.profitLoss) === 0
    ).length;


  const winRate =
    total
      ? wins / total * 100
      : 0;


  const totalProfit =
    trades
      .filter(
        trade =>
          number(trade.profitLoss) > 0
      )
      .reduce(
        (sum, trade) =>
          sum +
          number(trade.profitLoss),
        0
      );


  const totalLoss =
    trades
      .filter(
        trade =>
          number(trade.profitLoss) < 0
      )
      .reduce(
        (sum, trade) =>
          sum +
          number(trade.profitLoss),
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
    money(totalProfit)
  );

  setText(
    "analyticsLoss",
    money(totalLoss)
  );

  setText(
    "analyticsNet",
    money(totalProfit + totalLoss)
  );
}


// ============================================================
// CALENDAR
// ============================================================

function renderCalendar() {

  const grid =
    $("calendarGrid");


  if (!grid) return;


  const year =
    calendarDate.getFullYear();


  const month =
    calendarDate.getMonth();


  const monthName =
    calendarDate.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric"
      }
    );


  setText(
    "calendarMonthLabel",
    monthName
  );


  const monthTrades =
    trades.filter(
      trade => {

        if (!trade.date) return false;

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
      trade =>
        number(trade.profitLoss) > 0
    ).length;


  const monthLosses =
    monthTrades.filter(
      trade =>
        number(trade.profitLoss) < 0
    ).length;


  setText(
    "calendarMonthPL",
    money(monthPL)
  );

  setText(
    "calendarWins",
    monthWins
  );

  setText(
    "calendarLosses",
    monthLosses
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
    day <= daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dayTrades =
      monthTrades.filter(
        trade =>
          trade.date ===
          dateString
      );


    const dayPL =
      dayTrades.reduce(
        (sum, trade) =>
          sum +
          number(trade.profitLoss),
        0
      );


    const today =
      getLocalDate() ===
      dateString;


    html += `
      <div class="calendar-day ${today ? "today" : ""}">

        <div class="calendar-date">
          ${day}
        </div>

        ${
          dayTrades.length
            ? `
              <div class="calendar-trades">
                ${dayTrades.length}
                ${dayTrades.length === 1 ? "trade" : "trades"}
              </div>

              <div class="calendar-pnl ${moneyClass(dayPL)}">
                ${dayPL >= 0 ? "+" : ""}
                ${money(dayPL)}
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


  const riskPercent =
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


  const riskAmount =
    balance *
    riskPercent /
    100;


  const distance =
    Math.abs(
      entry - sl
    );


  let lot = 0;


  if (
    riskAmount > 0 &&
    distance > 0
  ) {

    lot =
      riskAmount /
      (distance * 100);
  }


  setText(
    "riskAmountResult",
    money(riskAmount)
  );


  setText(
    "riskLotResult",
    lot > 0
      ? lot.toFixed(2)
      : "-"
  );
}


// ============================================================
// CSV EXPORT
// ============================================================

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

      ].map(
        value =>
          `"${String(
            value ?? ""
          ).replaceAll('"', '""')}"`
      )
    );


  const csv =
    [
      headers.map(
        value =>
          `"${value}"`
      ).join(","),

      ...rows.map(
        row =>
          row.join(",")
      )

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


  link.href =
    url;

  link.download =
    `UjR-Fx-Trading-Journal-${getLocalDate()}.csv`;


  document.body.appendChild(link);

  link.click();

  link.remove();


  URL.revokeObjectURL(url);


  showToast(
    "CSV exported successfully.",
    "success"
  );
}


// ============================================================
// SET TEXT HELPER
// ============================================================

function setText(id, value) {

  const element =
    $(id);

  if (element) {
    element.textContent =
      value;
  }
}


// ============================================================
// NAVIGATION
// ============================================================

function showPage(pageName) {

  document
    .querySelectorAll(".page")
    .forEach(
      page =>
        page.classList.add(
          "hidden"
        )
    );


  const page =
    $(`${pageName}Page`);


  if (page) {
    page.classList.remove(
      "hidden"
    );
  }


  document
    .querySelectorAll("[data-page]")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            pageName
        );
      }
    );


  closeMobileMenu();
}


// ============================================================
// MOBILE MENU
// ============================================================

function openMobileMenu() {

  $("sidebar")?.classList.add(
    "open"
  );

  $("overlay")?.classList.add(
    "show"
  );
}


function closeMobileMenu() {

  $("sidebar")?.classList.remove(
    "open"
  );

  $("overlay")?.classList.remove(
    "show"
  );
}


// ============================================================
// RENDER EVERYTHING
// ============================================================

function renderAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

  // Login

  $("loginBtn")?.addEventListener(
    "click",
    loginWithGoogle
  );


  // Logout

  $("logoutBtn")?.addEventListener(
    "click",
    logout
  );


  // Navigation

  document
    .querySelectorAll("[data-page]")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            showPage(
              button.dataset.page
            );

          }
        );
      }
    );


  // Mobile menu

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


  // Add trade buttons

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


  // Modal close

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


  // Trade form

  $("tradeForm")
    ?.addEventListener(
      "submit",
      saveTrade
    );


  // Trade calculation

  [
    "entry",
    "sl",
    "tp",
    "direction"
  ].forEach(
    id => {

      $(id)?.addEventListener(
        "input",
        () => {

          calculateTradeRR();

          calculateAutoLotSize();

        }
      );


      $(id)?.addEventListener(
        "change",
        () => {

          calculateTradeRR();

          calculateAutoLotSize();

        }
      );

    }
  );


  // Risk percentage

  $("riskPercent")
    ?.addEventListener(
      "input",
      calculateAutoLotSize
    );


  // Manual lot size

  $("lotSize")
    ?.addEventListener(
      "input",
      () => {

        $("lotSize").dataset.auto =
          "false";

      }
    );


  // Journal filters

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


  // Journal table actions

  $("journalTableBody")
    ?.addEventListener(
      "click",
      event => {

        const editButton =
          event.target.closest(
            "[data-edit-trade]"
          );


        if (editButton) {

          const trade =
            trades.find(
              item =>
                item.id ===
                editButton.dataset.editTrade
            );


          if (trade) {
            openTradeModal(
              trade
            );
          }


          return;
        }


        const deleteButton =
          event.target.closest(
            "[data-delete-trade]"
          );


        if (deleteButton) {

          deleteTrade(
            deleteButton.dataset.deleteTrade
          );

        }

      }
    );


  // Settings

  $("saveSettingsBtn")
    ?.addEventListener(
      "click",
      saveAccount
    );


  // Risk calculator

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


  // Calendar

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


  // CSV

  $("exportCSV")
    ?.addEventListener(
      "click",
      exportCSV
    );


  // Close modal when clicking background

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


  // Keyboard shortcut N

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key.toLowerCase() ===
          "n" &&

        $("tradeModal")?.classList
          .contains("hidden") &&

        document.activeElement?.tagName !==
          "INPUT" &&

        document.activeElement?.tagName !==
          "TEXTAREA" &&

        document.activeElement?.tagName !==
          "SELECT"
      ) {

        openTradeModal();

      }


      if (
        event.key === "Escape"
      ) {

        closeTradeModal();

        closeMobileMenu();

      }

    }
  );
}


// ============================================================
// AUTH STATE
// ============================================================

function setupAuthListener() {

  if (!auth) {

    console.error(
      "Firebase Auth is unavailable."
    );

    return;
  }


  onAuthStateChanged(
    auth,

    async user => {

      currentUser =
        user;


      const loginScreen =
        $("loginScreen");

      const app =
        $("app");


      if (user) {

        console.log(
          "Logged in:",
          user.email
        );


        loginScreen?.classList.add(
          "hidden"
        );


        app?.classList.remove(
          "hidden"
        );


        updateUserUI();


        await loadAccount();


        startTradeListener();


        renderAll();

      }

      else {

        console.log(
          "No user logged in."
        );


        loginScreen?.classList.remove(
          "hidden"
        );


        app?.classList.add(
          "hidden"
        );


        currentUser = null;

        trades = [];


        if (unsubscribeTrades) {

          unsubscribeTrades();

          unsubscribeTrades = null;
        }

      }

    }
  );
}


// ============================================================
// START APP
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupEventListeners();

    setupAuthListener();

    renderAll();

  }
);
