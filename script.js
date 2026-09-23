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
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
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


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
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

  analyticsPeriod: "all",

  analyticsFrom: "",

  analyticsTo: ""

};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);


function num(value) {

  const n = Number(value);

  return Number.isFinite(n) ? n : 0;

}


function formatMoney(value) {

  const currency =
    state.settings.currency || "USD";

  const amount = num(value);

  try {

    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency
      }
    ).format(amount);

  } catch {

    return `${currency} ${amount.toFixed(2)}`;

  }

}


function formatPercent(value) {

  return `${num(value).toFixed(1)}%`;

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

  const d = new Date();

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;

}


function currentTimeString() {

  const d = new Date();

  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;

}


function sortTrades(trades) {

  return [...trades].sort((a, b) => {

    const aValue =
      `${a.date || ""} ${a.time || ""}`;

    const bValue =
      `${b.date || ""} ${b.time || ""}`;

    return bValue.localeCompare(aValue);

  });

}


function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {

    toast.classList.remove("show");

  }, 3000);

}


function friendlyAuthError(error) {

  if (!error) {
    return "Login failed.";
  }

  if (
    error.code ===
    "auth/popup-blocked"
  ) {
    return "Popup was blocked. Redirecting to Google login...";
  }

  if (
    error.code ===
    "auth/popup-closed-by-user"
  ) {
    return "Login popup was closed.";
  }

  return error.message || "Login failed.";

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


function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(page => {
      page.classList.remove("active-page");
    });


  const page = $(pageId);

  if (page) {
    page.classList.add("active-page");
  }


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === pageId
      );

    });


  $("pageTitle").textContent =
    pageTitles[pageId] || "Dashboard";


  closeMobileMenu();

}


document
  .querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener("click", () => {

      showPage(button.dataset.page);

    });

  });


document
  .querySelectorAll("[data-page-target]")
  .forEach(button => {

    button.addEventListener("click", () => {

      showPage(
        button.dataset.pageTarget
      );

    });

  });


/* =========================================================
   MOBILE MENU
========================================================= */

function openMobileMenu() {

  $("sidebar").classList.add("open");

  $("sidebarOverlay").classList.add("show");

}


function closeMobileMenu() {

  $("sidebar").classList.remove("open");

  $("sidebarOverlay").classList.remove("show");

}


$("mobileMenuBtn")
  .addEventListener(
    "click",
    openMobileMenu
  );


$("closeSidebar")
  .addEventListener(
    "click",
    closeMobileMenu
  );


$("sidebarOverlay")
  .addEventListener(
    "click",
    closeMobileMenu
  );


/* =========================================================
   AUTH
========================================================= */

$("googleLoginBtn")
  .addEventListener(
    "click",
    async () => {

      $("loginError").textContent = "";

      try {

        await signInWithPopup(
          auth,
          provider
        );

      } catch (error) {

        if (
          error.code ===
          "auth/popup-blocked"
        ) {

          await signInWithRedirect(
            auth,
            provider
          );

          return;

        }

        $("loginError").textContent =
          friendlyAuthError(error);

      }

    }
  );


(async () => {

  try {

    await getRedirectResult(auth);

  } catch (error) {

    $("loginError").textContent =
      friendlyAuthError(error);

  }

})();


$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        if (state.unsubscribeTrades) {
          state.unsubscribeTrades();
        }

        if (state.unsubscribeSettings) {
          state.unsubscribeSettings();
        }

        await signOut(auth);

      } catch (error) {

        showToast(
          error.message || "Logout failed."
        );

      }

    }
  );


/* =========================================================
   USER PROFILE
========================================================= */

async function saveUserProfile(user) {

  if (!user) return;

  try {

    await setDoc(
      doc(db, "users", user.uid),
      {
        name:
          user.displayName ||
          "Trader",

        email:
          user.email ||
          "",

        photo:
          user.photoURL ||
          "",

        updatedAt:
          new Date().toISOString()

      },
      {
        merge: true
      }
    );

  } catch (error) {

    console.error(
      "Profile save error:",
      error
    );

  }

}


/* =========================================================
   SETTINGS
========================================================= */

function listenToSettings() {

  if (!state.user) return;

  if (state.unsubscribeSettings) {
    state.unsubscribeSettings();
  }


  const ref = doc(
    db,
    "users",
    state.user.uid,
    "settings",
    "main"
  );


  state.unsubscribeSettings =
    onSnapshot(
      ref,
      snapshot => {

        if (snapshot.exists()) {

          state.settings = {
            startingBalance:
              num(
                snapshot.data()
                  .startingBalance
              ),

            currency:
              snapshot.data()
                .currency || "USD"
          };

        }


        $("startingBalance").value =
          state.settings.startingBalance || "";

        $("currency").value =
          state.settings.currency || "USD";


        renderAll();

      },
      error => {

        console.error(
          "Settings listener:",
          error
        );

      }
    );

}


$("saveSettingsBtn")
  .addEventListener(
    "click",
    async () => {

      if (!state.user) return;


      const balance =
        num(
          $("startingBalance").value
        );

      const currency =
        $("currency").value;


      try {

        await setDoc(
          doc(
            db,
            "users",
            state.user.uid,
            "settings",
            "main"
          ),
          {
            startingBalance: balance,
            currency,
            updatedAt:
              new Date().toISOString()
          },
          {
            merge: true
          }
        );


        showToast(
          "Settings saved."
        );

      } catch (error) {

        console.error(error);

        showToast(
          "Could not save settings."
        );

      }

    }
  );


/* =========================================================
   TRADES LISTENER
========================================================= */

function listenToTrades() {

  if (!state.user) return;


  if (state.unsubscribeTrades) {
    state.unsubscribeTrades();
  }


  const ref = collection(
    db,
    "users",
    state.user.uid,
    "trades"
  );


  state.unsubscribeTrades =
    onSnapshot(
      ref,
      snapshot => {

        state.trades =
          snapshot.docs.map(
            item => ({
              id: item.id,
              ...item.data()
            })
          );


        state.trades =
          sortTrades(state.trades);


        renderAll();

      },
      error => {

        console.error(
          "Trades listener:",
          error
        );

        showToast(
          "Could not load trades."
        );

      }
    );

}


/* =========================================================
   TRADE RR
========================================================= */

function calculateTradeRR() {

  const entry = num(
    $("entry").value
  );

  const sl = num(
    $("sl").value
  );

  const tp = num(
    $("tp").value
  );

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

    $("rr").value = "Invalid";

    return 0;

  }


  const rr = reward / risk;


  $("rr").value =
    `1:${rr.toFixed(2)}`;


  return rr;

}


/* =========================================================
   MANUAL RISK AMOUNT
========================================================= */

function calculateModalRisk() {

  const entry =
    num($("entry").value);

  const sl =
    num($("sl").value);

  /*
    IMPORTANT:

    Risk Amount is MANUAL.

    We do NOT calculate or overwrite
    the value entered by the user.
  */

  const manualRiskAmount =
    num($("riskAmount").value);


  const distance =
    Math.abs(entry - sl);


  if (
    manualRiskAmount <= 0 ||
    distance <= 0
  ) {

    if (
      $("lotSize").dataset.manual !== "true"
    ) {

      $("lotSize").value = "";

    }

    return;

  }


  /*
    Simplified lot estimate.

    This is only an estimate for the journal.
  */

  const estimatedLot =
    manualRiskAmount /
    (distance * 100);


  if (
    $("lotSize").dataset.manual !== "true"
  ) {

    $("lotSize").value =
      estimatedLot.toFixed(2);

  }

}


/* =========================================================
   P/L NORMALIZATION
========================================================= */

function normalizeProfitLossByResult() {

  const result =
    $("result").value;

  const input =
    $("profitLoss");


  /*
    Break Even always becomes 0.
  */

  if (
    result === "Break Even"
  ) {

    input.value = "0";

    return;

  }


  /*
    Don't change an empty field.
  */

  if (
    input.value === ""
  ) {

    return;

  }


  const value =
    Number(input.value);


  if (!Number.isFinite(value)) {

    return;

  }


  /*
    Win = positive
  */

  if (result === "Win") {

    input.value =
      Math.abs(value);

  }


  /*
    Loss = negative
  */

  if (result === "Loss") {

    input.value =
      -Math.abs(value);

  }

}


function getNormalizedPL() {

  const result =
    $("result").value;

  const raw =
    $("profitLoss").value;


  /*
    Break Even is always exactly 0.
  */

  if (
    result === "Break Even"
  ) {

    return 0;

  }


  /*
    User must manually enter P/L.
  */

  if (raw === "") {

    return null;

  }


  const value =
    Number(raw);


  if (!Number.isFinite(value)) {

    return null;

  }


  if (result === "Win") {

    return Number(
      Math.abs(value).toFixed(2)
    );

  }


  if (result === "Loss") {

    return Number(
      -Math.abs(value).toFixed(2)
    );

  }


  return Number(
    value.toFixed(2)
  );

}


/* =========================================================
   TRADE MODAL
========================================================= */

function resetTradeForm() {

  $("tradeForm").reset();

  $("tradeId").value = "";

  $("tradeDate").value =
    todayString();

  $("tradeTime").value =
    currentTimeString();

  $("pair").value =
    "XAUUSD";

  $("tradingType").value =
    "Scalping";

  $("direction").value =
    "Buy";

  $("riskPercent").value =
    "1";

  $("riskAmount").value =
    "";

  $("lotSize").value =
    "";

  $("lotSize").dataset.manual =
    "false";

  $("profitLoss").value =
    "";

  $("rr").value =
    "";

  $("tradeError").textContent =
    "";

}


function openTradeModal(tradeId = null) {

  resetTradeForm();

  state.editingTradeId =
    tradeId;


  if (tradeId) {

    const trade =
      state.trades.find(
        item =>
          item.id === tradeId
      );


    if (!trade) {

      showToast(
        "Trade not found."
      );

      return;

    }


    $("modalTitle").textContent =
      "Edit Trade";


    $("tradeId").value =
      trade.id || "";

    $("tradeDate").value =
      trade.date || "";

    $("tradeTime").value =
      trade.time || "";

    $("pair").value =
      trade.pair || "XAUUSD";

    $("tradingType").value =
      trade.tradingType || "Scalping";

    $("direction").value =
      trade.direction || "Buy";

    $("setup").value =
      trade.setup || "";

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
      trade.lotSize
        ? "true"
        : "false";

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
      trade.confidence ?? "";

    $("psychology").value =
      trade.psychology || "";

    $("mistake").value =
      trade.mistake || "";

    $("notes").value =
      trade.notes || "";


  } else {

    $("modalTitle").textContent =
      "Add Trade";

  }


  calculateTradeRR();


  /*
    Do not overwrite manual risk amount.
  */

  calculateModalRisk();


  $("tradeModal")
    .classList.remove("hidden");

  document.body.style.overflow =
    "hidden";

}


function closeTradeModal() {

  $("tradeModal")
    .classList.add("hidden");

  document.body.style.overflow =
    "";

  state.editingTradeId =
    null;

}


$("journalAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("dashboardAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("quickAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("sidebarAddTrade")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("closeModal")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("cancelTrade")
  .addEventListener(
    "click",
    closeTradeModal
  );


document
  .querySelector(".modal-backdrop")
  .addEventListener(
    "click",
    closeTradeModal
  );


/* =========================================================
   MODAL INPUT EVENTS
========================================================= */

[
  "entry",
  "sl",
  "tp",
  "direction"
].forEach(id => {

  $(id).addEventListener(
    "input",
    () => {

      calculateTradeRR();

      calculateModalRisk();

    }
  );


  $(id).addEventListener(
    "change",
    () => {

      calculateTradeRR();

      calculateModalRisk();

    }
  );

});


$("riskPercent")
  .addEventListener(
    "input",
    calculateModalRisk
  );


/*
  Risk Amount is manually entered.

  When it changes, we only update
  estimated lot size.
*/

$("riskAmount")
  .addEventListener(
    "input",
    () => {

      if (
        $("lotSize").dataset.manual !== "true"
      ) {

        calculateModalRisk();

      }

    }
  );


$("lotSize")
  .addEventListener(
    "input",
    () => {

      $("lotSize").dataset.manual =
        "true";

    }
  );


/*
  IMPORTANT:

  We do NOT normalize P/L on every
  keystroke.

  That was the original bug.

  It is normalized when:
  - Result changes
  - User leaves P/L field
  - Trade is saved
*/

$("result")
  .addEventListener(
    "change",
    () => {

      normalizeProfitLossByResult();

    }
  );


$("profitLoss")
  .addEventListener(
    "blur",
    () => {

      normalizeProfitLossByResult();

    }
  );


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!state.user) {

        $("tradeError").textContent =
          "Please login first.";

        return;

      }


      $("tradeError").textContent =
        "";


      const date =
        $("tradeDate").value;

      const time =
        $("tradeTime").value;

      const pair =
        $("pair").value.trim();

      const tradingType =
        $("tradingType").value;

      const direction =
        $("direction").value;

      const entry =
        num($("entry").value);

      const sl =
        num($("sl").value);

      const tp =
        num($("tp").value);

      const rr =
        calculateTradeRR();


      const riskPercent =
        num($("riskPercent").value);


      /*
        MANUAL RISK AMOUNT
      */

      const riskAmountRaw =
        $("riskAmount")
          .value
          .trim();


      let riskAmount = 0;


      if (riskAmountRaw !== "") {

        riskAmount =
          Number(riskAmountRaw);

      }


      if (
        !Number.isFinite(riskAmount) ||
        riskAmount < 0
      ) {

        $("tradeError").textContent =
          "Risk Amount must be a valid positive number.";

        return;

      }


      /*
        P/L

        This is MANUAL.

        We only normalize the sign
        according to Result.
      */

      normalizeProfitLossByResult();


      const profitLoss =
        getNormalizedPL();


      if (
        profitLoss === null
      ) {

        $("tradeError").textContent =
          "Please enter the actual Profit / Loss amount.";

        return;

      }


      if (!date) {

        $("tradeError").textContent =
          "Please select a date.";

        return;

      }


      if (!pair) {

        $("tradeError").textContent =
          "Please enter the pair.";

        return;

      }


      if (
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0
      ) {

        $("tradeError").textContent =
          "Entry, SL and TP must be greater than 0.";

        return;

      }


      if (!rr || rr <= 0) {

        $("tradeError").textContent =
          "Invalid Risk : Reward. Check Entry, SL and TP.";

        return;

      }


      const result =
        $("result").value;


      if (!result) {

        $("tradeError").textContent =
          "Please select the trade result.";

        return;

      }


      /*
        LOT SIZE
      */

      let lotSize =
        num($("lotSize").value);


      if (
        $("lotSize").dataset.manual !== "true"
      ) {

        const distance =
          Math.abs(entry - sl);


        if (
          riskAmount > 0 &&
          distance > 0
        ) {

          lotSize =
            riskAmount /
            (distance * 100);

        }

      }


      const tradeData = {

        date,

        time,

        pair:
          pair.toUpperCase(),

        tradingType,

        direction,

        entry,

        sl,

        tp,

        rr:

          Number(
            rr.toFixed(2)
          ),

        riskPercent,

        /*
          MANUAL VALUE
        */

        riskAmount:
          Number(
            riskAmount.toFixed(2)
          ),

        lotSize:
          Number(
            lotSize.toFixed(2)
          ),

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

        result,

        /*
          MANUAL P/L
          WITH NORMALIZED SIGN
        */

        profitLoss:
          Number(
            profitLoss.toFixed(2)
          ),

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

        const tradesRef =
          collection(
            db,
            "users",
            state.user.uid,
            "trades"
          );


        if (
          state.editingTradeId
        ) {

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


          showToast(
            "Trade updated successfully."
          );

        } else {

          await addDoc(
            tradesRef,
            {
              ...tradeData,

              createdAt:
                new Date().toISOString()
            }
          );


          showToast(
            "Trade saved successfully."
          );

        }


        closeTradeModal();

      } catch (error) {

        console.error(
          "Save trade error:",
          error
        );

        $("tradeError").textContent =
          error.message ||
          "Could not save trade.";

      }

    }
  );


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(tradeId) {

  if (!state.user) return;


  const confirmed =
    confirm(
      "Delete this trade permanently?"
    );


  if (!confirmed) return;


  try {

    await deleteDoc(
      doc(
        db,
        "users",
        state.user.uid,
        "trades",
        tradeId
      )
    );


    showToast(
      "Trade deleted."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade."
    );

  }

}


/* =========================================================
   JOURNAL FILTERS
========================================================= */

function getFilteredJournalTrades() {

  const result =
    $("journalResultFilter").value;

  const pair =
    $("journalPairFilter")
      .value
      .trim()
      .toLowerCase();

  const date =
    $("journalDateFilter").value;


  return state.trades.filter(
    trade => {

      if (
        result !== "All" &&
        trade.result !== result
      ) {

        return false;

      }


      if (
        pair &&
        !String(
          trade.pair || ""
        )
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

    }
  );

}


[
  "journalResultFilter",
  "journalPairFilter",
  "journalDateFilter"
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


$("clearJournalFilters")
  .addEventListener(
    "click",
    () => {

      $("journalResultFilter").value =
        "All";

      $("journalPairFilter").value =
        "";

      $("journalDateFilter").value =
        "";

      renderJournal();

    }
  );


/* =========================================================
   STATS
========================================================= */

function getAllStats(trades) {

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


  const breakeven =
    trades.filter(
      t => t.result === "Break Even"
    ).length;


  const pl =
    trades.reduce(
      (sum, t) =>
        sum + num(t.profitLoss),
      0
    );


  const grossProfit =
    trades
      .filter(
        t =>
          num(t.profitLoss) > 0
      )
      .reduce(
        (sum, t) =>
          sum + num(t.profitLoss),
        0
      );


  const grossLoss =
    Math.abs(
      trades
        .filter(
          t =>
            num(t.profitLoss) < 0
        )
        .reduce(
          (sum, t) =>
            sum + num(t.profitLoss),
          0
        )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const winRate =
    total > 0
      ? wins / total * 100
      : 0;


  const rValues =
    trades
      .filter(
        t =>
          num(t.riskAmount) > 0
      )
      .map(
        t =>
          num(t.profitLoss) /
          num(t.riskAmount)
      );


  const avgR =
    rValues.length
      ? rValues.reduce(
          (a, b) => a + b,
          0
        ) / rValues.length
      : 0;


  const avgWin =
    wins > 0
      ? trades
          .filter(
            t =>
              t.result === "Win"
          )
          .reduce(
            (sum, t) =>
              sum + num(t.profitLoss),
            0
          ) / wins
      : 0;


  const avgLoss =
    losses > 0
      ? trades
          .filter(
            t =>
              t.result === "Loss"
          )
          .reduce(
            (sum, t) =>
              sum + num(t.profitLoss),
            0
          ) / losses
      : 0;


  const expectancy =
    total > 0
      ? pl / total
      : 0;


  const avgRisk =
    trades.length
      ? trades.reduce(
          (sum, t) =>
            sum + num(t.riskAmount),
          0
        ) / trades.length
      : 0;


  return {

    total,

    wins,

    losses,

    breakeven,

    pl,

    grossProfit,

    grossLoss,

    profitFactor,

    winRate,

    avgR,

    avgWin,

    avgLoss,

    expectancy,

    avgRisk

  };

}


/* =========================================================
   DRAWDOWN
========================================================= */

function calculateDrawdown(trades) {

  const ordered =
    [...trades].sort(
      (a, b) => {

        const aa =
          `${a.date || ""} ${a.time || ""}`;

        const bb =
          `${b.date || ""} ${b.time || ""}`;

        return aa.localeCompare(bb);

      }
    );


  let equity = 0;

  let peak = 0;

  let maxDrawdown = 0;


  ordered.forEach(
    trade => {

      equity +=
        num(trade.profitLoss);


      peak =
        Math.max(
          peak,
          equity
        );


      const drawdown =
        peak - equity;


      maxDrawdown =
        Math.max(
          maxDrawdown,
          drawdown
        );

    }
  );


  return maxDrawdown;

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const stats =
    getAllStats(
      state.trades
    );


  $("dashTotalTrades")
    .textContent =
      stats.total;


  $("dashWinRate")
    .textContent =
      formatPercent(
        stats.winRate
      );


  $("dashPL")
    .textContent =
      formatMoney(
        stats.pl
      );


  $("dashProfitFactor")
    .textContent =
      stats.profitFactor === Infinity
        ? "∞"
        : stats.profitFactor.toFixed(2);


  $("dashAverageR")
    .textContent =
      `${stats.avgR.toFixed(2)}R`;


  $("dashExpectancy")
    .textContent =
      formatMoney(
        stats.expectancy
      );


  $("dashWins")
    .textContent =
      stats.wins;


  $("dashLosses")
    .textContent =
      stats.losses;


  $("dashBreakeven")
    .textContent =
      stats.breakeven;


  $("dashAvgWin")
    .textContent =
      formatMoney(
        stats.avgWin
      );


  $("dashAvgLoss")
    .textContent =
      formatMoney(
        stats.avgLoss
      );


  $("dashDrawdown")
    .textContent =
      formatMoney(
        calculateDrawdown(
          state.trades
        )
      );


  renderRecentTrades();

  drawEquityCurve();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const trades =
    state.trades.slice(0, 8);


  if (!trades.length) {

    $("recentTrades").innerHTML =
      `<div class="empty-state">
        No trades yet.
      </div>`;

    return;

  }


  $("recentTrades").innerHTML = `

    <table>

      <thead>

        <tr>
          <th>Date</th>
          <th>Pair</th>
          <th>Type</th>
          <th>Direction</th>
          <th>Strategy</th>
          <th>Result</th>
          <th>P/L</th>
        </tr>

      </thead>

      <tbody>

        ${trades.map(trade => `

          <tr>

            <td>
              ${escapeHtml(trade.date)}
            </td>

            <td>
              ${escapeHtml(trade.pair)}
            </td>

            <td>
              ${escapeHtml(trade.tradingType)}
            </td>

            <td>
              ${escapeHtml(trade.direction)}
            </td>

            <td>
              ${escapeHtml(trade.setup || "-")}
            </td>

            <td class="${
              trade.result === "Win"
                ? "result-win"
                : trade.result === "Loss"
                  ? "result-loss"
                  : "result-be"
            }">

              ${escapeHtml(trade.result)}

            </td>

            <td>
              ${formatMoney(
                trade.profitLoss
              )}
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>

  `;

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

  const trades =
    getFilteredJournalTrades();


  const stats =
    getAllStats(trades);


  $("journalTradeCount")
    .textContent =
      stats.total;


  $("journalWinCount")
    .textContent =
      stats.wins;


  $("journalLossCount")
    .textContent =
      stats.losses;


  $("journalTotalPL")
    .textContent =
      formatMoney(
        stats.pl
      );


  if (!trades.length) {

    $("journalTable").innerHTML =
      `<div class="empty-state">
        No trades found.
      </div>`;

    return;

  }


  $("journalTable").innerHTML = `

    <table>

      <thead>

        <tr>

          <th>Date</th>
          <th>Pair</th>
          <th>Trading Type</th>
          <th>Direction</th>
          <th>Strategy</th>
          <th>Entry</th>
          <th>RR</th>
          <th>Result</th>
          <th>P/L</th>
          <th>Action</th>

        </tr>

      </thead>

      <tbody>

        ${trades.map(trade => `

          <tr>

            <td>
              ${escapeHtml(
                trade.date
              )}
            </td>

            <td>
              ${escapeHtml(
                trade.pair
              )}
            </td>

            <td>
              ${escapeHtml(
                trade.tradingType
              )}
            </td>

            <td>
              ${escapeHtml(
                trade.direction
              )}
            </td>

            <td>
              ${escapeHtml(
                trade.setup || "-"
              )}
            </td>

            <td>
              ${num(
                trade.entry
              ).toFixed(3)}
            </td>

            <td>
              1:${num(
                trade.rr
              ).toFixed(2)}
            </td>

            <td class="${
              trade.result === "Win"
                ? "result-win"
                : trade.result === "Loss"
                  ? "result-loss"
                  : "result-be"
            }">

              ${escapeHtml(
                trade.result
              )}

            </td>

            <td>
              ${formatMoney(
                trade.profitLoss
              )}
            </td>

            <td>

              <div class="action-buttons">

                <button
                  class="action-btn"
                  data-edit="${trade.id}"
                >
                  Edit
                </button>

                <button
                  class="action-btn delete"
                  data-delete="${trade.id}"
                >
                  Delete
                </button>

              </div>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>

  `;


  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openTradeModal(
            button.dataset.edit
          );

        }
      );

    });


  document
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteTrade(
            button.dataset.delete
          );

        }
      );

    });

}


/* =========================================================
   ANALYTICS FILTER
========================================================= */

function getAnalyticsTrades() {

  const period =
    state.analyticsPeriod;


  if (
    period === "all"
  ) {

    return [...state.trades];

  }


  const today =
    new Date();


  let from = null;

  let to = null;


  if (period === "7") {

    from =
      new Date(today);

    from.setDate(
      today.getDate() - 6
    );

    to =
      today;

  }


  if (period === "30") {

    from =
      new Date(today);

    from.setDate(
      today.getDate() - 29
    );

    to =
      today;

  }


  if (period === "month") {

    from =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

    to =
      today;

  }


  if (period === "custom") {

    from =
      state.analyticsFrom
        ? new Date(
            `${state.analyticsFrom}T00:00:00`
          )
        : null;

    to =
      state.analyticsTo
        ? new Date(
            `${state.analyticsTo}T23:59:59`
          )
        : null;

  }


  return state.trades.filter(
    trade => {

      if (!trade.date) {
        return false;
      }


      const date =
        new Date(
          `${trade.date}T12:00:00`
        );


      if (
        from &&
        date < from
      ) {

        return false;

      }


      if (
        to &&
        date > to
      ) {

        return false;

      }


      return true;

    }
  );

}


$("analyticsPeriod")
  .addEventListener(
    "change",
    () => {

      $("customDateControls")
        .classList.toggle(
          "hidden",
          $("analyticsPeriod").value !==
            "custom"
        );

    }
  );


$("applyAnalytics")
  .addEventListener(
    "click",
    () => {

      state.analyticsPeriod =
        $("analyticsPeriod").value;

      state.analyticsFrom =
        $("analyticsFrom").value;

      state.analyticsTo =
        $("analyticsTo").value;

      renderAnalytics();

    }
  );


/* =========================================================
   ANALYTICS GROUP
========================================================= */

function groupTrades(
  trades,
  property
) {

  const groups = {};


  trades.forEach(
    trade => {

      const key =
        trade[property] ||
        "Not Set";


      if (!groups[key]) {

        groups[key] = [];

      }


      groups[key].push(
        trade
      );

    }
  );


  return groups;

}


function renderGroupAnalytics(
  elementId,
  trades,
  property
) {

  const groups =
    groupTrades(
      trades,
      property
    );


  const entries =
    Object.entries(groups);


  if (!entries.length) {

    $(elementId).innerHTML =
      `<div class="empty-state">
        No data.
      </div>`;

    return;

  }


  $(elementId).innerHTML = `

    <table class="mini-table">

      <thead>

        <tr>

          <th>Name</th>
          <th>Trades</th>
          <th>Win Rate</th>
          <th>P/L</th>

        </tr>

      </thead>

      <tbody>

        ${entries.map(
          ([name, group]) => {

            const stats =
              getAllStats(group);


            return `

              <tr>

                <td>
                  ${escapeHtml(name)}
                </td>

                <td>
                  ${stats.total}
                </td>

                <td>
                  ${formatPercent(
                    stats.winRate
                  )}
                </td>

                <td>
                  ${formatMoney(
                    stats.pl
                  )}
                </td>

              </tr>

            `;

          }
        ).join("")}

      </tbody>

    </table>

  `;

}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  const stats =
    getAllStats(trades);


  $("analyticsTrades")
    .textContent =
      stats.total;


  $("analyticsWinRate")
    .textContent =
      formatPercent(
        stats.winRate
      );


  $("analyticsAverageR")
    .textContent =
      `${stats.avgR.toFixed(2)}R`;


  $("analyticsPL")
    .textContent =
      formatMoney(
        stats.pl
      );


  $("analyticsProfitFactor")
    .textContent =
      stats.profitFactor === Infinity
        ? "∞"
        : stats.profitFactor.toFixed(2);


  $("analyticsExpectancy")
    .textContent =
      formatMoney(
        stats.expectancy
      );


  $("analyticsAvgRisk")
    .textContent =
      formatMoney(
        stats.avgRisk
      );


  $("analyticsMaxDrawdown")
    .textContent =
      formatMoney(
        calculateDrawdown(
          trades
        )
      );


  renderGroupAnalytics(
    "strategyAnalytics",
    trades,
    "setup"
  );


  renderGroupAnalytics(
    "tradingTypeAnalytics",
    trades,
    "tradingType"
  );


  renderGroupAnalytics(
    "sessionAnalytics",
    trades,
    "session"
  );


  renderGroupAnalytics(
    "directionAnalytics",
    trades,
    "direction"
  );


  renderBehaviorAnalytics(
    trades
  );


  drawAnalyticsEquity(
    trades
  );


  drawMonthlyChart(
    trades
  );

}


/* =========================================================
   BEHAVIOR ANALYTICS
========================================================= */

function mostCommon(
  trades,
  property
) {

  const counts = {};


  trades.forEach(
    trade => {

      const value =
        trade[property];


      if (!value) return;


      counts[value] =
        (counts[value] || 0) + 1;

    }
  );


  let best =
    "None";

  let highest =
    0;


  Object.entries(
    counts
  ).forEach(
    ([key, count]) => {

      if (
        count > highest
      ) {

        highest = count;

        best = key;

      }

    }
  );


  return `${best} (${highest})`;

}


function renderBehaviorAnalytics(
  trades
) {

  const overRisk =
    trades.filter(
      trade =>
        num(trade.riskPercent) > 2
    ).length;


  const mistakes =
    trades.filter(
      trade =>
        trade.mistake
    ).length;


  const behavior = [

    [
      "Most Common Psychology",
      mostCommon(
        trades,
        "psychology"
      )
    ],

    [
      "Most Common Mistake",
      mostCommon(
        trades,
        "mistake"
      )
    ],

    [
      "Most Used Strategy",
      mostCommon(
        trades,
        "setup"
      )
    ],

    [
      "Risk > 2%",
      overRisk
    ]

  ];


  $("behaviorAnalytics")
    .innerHTML =
      behavior.map(
        ([title, value]) => `

          <div class="behavior-item">

            <span>
              ${escapeHtml(title)}
            </span>

            <strong>
              ${escapeHtml(value)}
            </strong>

          </div>

        `
      ).join("");

}


/* =========================================================
   CANVAS
========================================================= */

function setupCanvas(
  canvas
) {

  if (!canvas) {
    return null;
  }


  const rect =
    canvas.getBoundingClientRect();


  const ratio =
    window.devicePixelRatio || 1;


  canvas.width =
    rect.width * ratio;


  canvas.height =
    rect.height * ratio;


  const ctx =
    canvas.getContext("2d");


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  return {
    ctx,
    width: rect.width,
    height: rect.height
  };

}


function drawEmptyChart(
  canvas,
  message
) {

  const result =
    setupCanvas(canvas);


  if (!result) return;


  const {
    ctx,
    width,
    height
  } = result;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  ctx.fillStyle =
    "#777d89";


  ctx.font =
    "12px system-ui";


  ctx.textAlign =
    "center";


  ctx.fillText(
    message,
    width / 2,
    height / 2
  );

}


function drawEquityCurve() {

  const canvas =
    $("equityChart");


  const trades =
    [...state.trades]
      .sort(
        (a, b) =>
          `${a.date} ${a.time || ""}`
            .localeCompare(
              `${b.date} ${b.time || ""}`
            )
      );


  if (!trades.length) {

    drawEmptyChart(
      canvas,
      "No trades yet"
    );

    return;

  }


  drawLineChart(
    canvas,
    trades
  );

}


function drawAnalyticsEquity(
  trades
) {

  const canvas =
    $("analyticsEquityChart");


  if (!trades.length) {

    drawEmptyChart(
      canvas,
      "No data for this period"
    );

    return;

  }


  const ordered =
    [...trades].sort(
      (a, b) =>
        `${a.date} ${a.time || ""}`
          .localeCompare(
            `${b.date} ${b.time || ""}`
          )
    );


  drawLineChart(
    canvas,
    ordered
  );

}


function drawLineChart(
  canvas,
  trades
) {

  const result =
    setupCanvas(canvas);


  if (!result) return;


  const {
    ctx,
    width,
    height
  } = result;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const values = [];

  let equity = 0;


  trades.forEach(
    trade => {

      equity +=
        num(trade.profitLoss);

      values.push(
        equity
      );

    }
  );


  if (!values.length) {

    drawEmptyChart(
      canvas,
      "No data"
    );

    return;

  }


  const min =
    Math.min(
      0,
      ...values
    );


  const max =
    Math.max(
      0,
      ...values
    );


  const range =
    max - min || 1;


  const padding = 35;


  ctx.strokeStyle =
    "rgba(255,255,255,.08)";


  ctx.lineWidth =
    1;


  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const y =
      padding +
      ((height - padding * 2) / 4) *
      i;


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


  const points =
    values.map(
      (value, index) => {

        const x =
          padding +
          (index /
            Math.max(
              values.length - 1,
              1
            )) *
          (width - padding * 2);


        const y =
          height -
          padding -
          ((value - min) / range) *
            (height - padding * 2);


        return {
          x,
          y
        };

      }
    );


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
    "#d6ae55";


  ctx.lineWidth =
    2.5;


  ctx.stroke();


  points.forEach(
    point => {

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        3,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "#f0cf79";

      ctx.fill();

    }
  );


  ctx.fillStyle =
    "#777d89";


  ctx.font =
    "10px system-ui";


  ctx.textAlign =
    "left";


  ctx.fillText(
    formatMoney(max),
    5,
    padding
  );


  ctx.fillText(
    formatMoney(min),
    5,
    height - padding
  );

}


function drawMonthlyChart(
  trades
) {

  const canvas =
    $("monthlyChart");


  if (!trades.length) {

    drawEmptyChart(
      canvas,
      "No monthly data"
    );

    return;

  }


  const months = {};


  trades.forEach(
    trade => {

      const key =
        String(
          trade.date || ""
        ).slice(0, 7);


      if (!key) return;


      months[key] =
        (months[key] || 0) +
        num(trade.profitLoss);

    }
  );


  const entries =
    Object.entries(
      months
    ).sort(
      ([a], [b]) =>
        a.localeCompare(b)
    );


  const result =
    setupCanvas(canvas);


  if (!result) return;


  const {
    ctx,
    width,
    height
  } = result;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const maxAbs =
    Math.max(
      1,
      ...entries.map(
        ([, value]) =>
          Math.abs(value)
      )
    );


  const padding =
    35;


  const chartHeight =
    height - padding * 2;


  const barWidth =
    Math.max(
      15,
      (width - padding * 2) /
        entries.length *
        .55
    );


  entries.forEach(
    ([month, value], index) => {

      const x =
        padding +
        (index + .5) *
        (
          (width - padding * 2) /
          entries.length
        );


      const barHeight =
        Math.abs(value) /
        maxAbs *
        (chartHeight / 2);


      const zero =
        height / 2;


      const y =
        value >= 0
          ? zero - barHeight
          : zero;


      ctx.fillStyle =
        value >= 0
          ? "#36d399"
          : "#ff5c70";


      ctx.fillRect(
        x - barWidth / 2,
        y,
        barWidth,
        barHeight
      );


      ctx.fillStyle =
        "#777d89";


      ctx.font =
        "9px system-ui";


      ctx.textAlign =
        "center";


      ctx.fillText(
        month,
        x,
        height - 8
      );

    }
  );


  ctx.strokeStyle =
    "rgba(255,255,255,.1)";


  ctx.beginPath();

  ctx.moveTo(
    padding,
    height / 2
  );

  ctx.lineTo(
    width - padding,
    height / 2
  );

  ctx.stroke();

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

function calculateRiskCalculator() {

  const balance =
    num(
      $("calcBalance").value
    );


  const riskPercent =
    num(
      $("calcRiskPercent").value
    );


  const entry =
    num(
      $("calcEntry").value
    );


  const sl =
    num(
      $("calcSL").value
    );


  const tp =
    num(
      $("calcTP").value
    );


  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  let riskDistance = 0;

  let rewardDistance = 0;


  if (
    direction === "Buy"
  ) {

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


  let rr = 0;


  if (
    riskDistance > 0 &&
    rewardDistance > 0
  ) {

    rr =
      rewardDistance /
      riskDistance;

  }


  let lot = 0;


  if (
    riskAmount > 0 &&
    riskDistance > 0
  ) {

    lot =
      riskAmount /
      (
        riskDistance * 100
      );

  }


  $("calcRiskAmount")
    .textContent =
      formatMoney(
        riskAmount
      );


  $("calcDistance")
    .textContent =
      riskDistance > 0
        ? riskDistance.toFixed(3)
        : "Invalid";


  $("calcRR")
    .textContent =
      rr > 0
        ? `1:${rr.toFixed(2)}`
        : "Invalid";


  $("calcLot")
    .textContent =
      lot > 0
        ? lot.toFixed(2)
        : "0.00";

}


$("calculateRiskBtn")
  .addEventListener(
    "click",
    calculateRiskCalculator
  );


[
  "calcBalance",
  "calcRiskPercent",
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


  $("calendarMonth")
    .textContent =
      date.toLocaleDateString(
        undefined,
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


  const cells = [];


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    cells.push(
      `<div class="calendar-day empty"></div>`
    );

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(
        month + 1
      ).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;


    const dayTrades =
      state.trades.filter(
        trade =>
          trade.date ===
          dateString
      );


    const pl =
      dayTrades.reduce(
        (sum, trade) =>
          sum +
          num(
            trade.profitLoss
          ),
        0
      );


    const className =
      pl > 0
        ? "calendar-profit"
        : pl < 0
          ? "calendar-loss"
          : "";


    cells.push(`

      <div
        class="calendar-day ${className}"
      >

        <div class="calendar-number">
          ${day}
        </div>

        <div class="calendar-pl">

          ${
            dayTrades.length
              ? formatMoney(pl)
              : "-"
          }

        </div>

        <div class="calendar-trades">

          ${
            dayTrades.length
              ? `${dayTrades.length} trade${
                  dayTrades.length === 1
                    ? ""
                    : "s"
                }`
              : ""
          }

        </div>

      </div>

    `);

  }


  $("calendarGrid")
    .innerHTML =
      cells.join("");

}


$("prevMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate =
        new Date(
          state.calendarDate
            .getFullYear(),
          state.calendarDate
            .getMonth() - 1,
          1
        );

      renderCalendar();

    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate =
        new Date(
          state.calendarDate
            .getFullYear(),
          state.calendarDate
            .getMonth() + 1,
          1
        );

      renderCalendar();

    }
  );


/* =========================================================
   CSV EXPORT
========================================================= */

function csvEscape(value) {

  const string =
    String(
      value ?? ""
    );


  return `"${string.replace(
    /"/g,
    '""'
  )}"`;

}


function exportCSV() {

  if (!state.trades.length) {

    showToast(
      "No trades to export."
    );

    return;

  }


  const headers = [

    "Trade ID",
    "Date",
    "Time",
    "Pair",
    "Trading Type",
    "Direction",
    "Strategy",
    "Entry",
    "SL",
    "TP",
    "RR",
    "Risk %",
    "Risk Amount",
    "Lot Size",
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
    state.trades.map(
      trade => [

        trade.id,

        trade.date,

        trade.time,

        trade.pair,

        trade.tradingType,

        trade.direction,

        trade.setup,

        trade.entry,

        trade.sl,

        trade.tp,

        trade.rr,

        trade.riskPercent,

        trade.riskAmount,

        trade.lotSize,

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
    );


  const csv = [

    headers,

    ...rows

  ]
    .map(
      row =>
        row
          .map(csvEscape)
          .join(",")
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


  showToast(
    "CSV exported."
  );

}


$("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    state.user =
      user || null;


    if (user) {

      $("loginScreen")
        .classList.add("hidden");


      $("app")
        .classList.remove("hidden");


      $("userName")
        .textContent =
          user.displayName ||
          "Trader";


      $("userEmail")
        .textContent =
          user.email ||
          "";


      $("userPhoto").src =
        user.photoURL ||
        "logo.png";


      await saveUserProfile(
        user
      );


      listenToSettings();

      listenToTrades();

      renderAll();


    } else {

      $("app")
        .classList.add("hidden");


      $("loginScreen")
        .classList.remove("hidden");


      state.trades = [];

      state.user = null;


      if (
        state.unsubscribeTrades
      ) {

        state.unsubscribeTrades();

        state.unsubscribeTrades =
          null;

      }


      if (
        state.unsubscribeSettings
      ) {

        state.unsubscribeSettings();

        state.unsubscribeSettings =
          null;

      }

    }

  }
);


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

}


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    drawEquityCurve();

    drawAnalyticsEquity(
      getAnalyticsTrades()
    );

    drawMonthlyChart(
      getAnalyticsTrades()
    );

  }
);


/* =========================================================
   INITIAL
========================================================= */

$("currentDate")
  .textContent =
    new Date().toLocaleDateString(
      undefined,
      {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
      }
    );


$("tradeDate").value =
  todayString();


$("tradeTime").value =
  currentTimeString();


$("lotSize").dataset.manual =
  "false";


showPage(
  "dashboardPage"
);


calculateRiskCalculator();
