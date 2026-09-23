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
   FIREBASE
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65GZlQ6Ns",
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

  const n = num(value);

  const currency =
    state.settings.currency || "USD";

  try {

    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }
    ).format(n);

  } catch {

    return `${currency} ${n.toFixed(2)}`;

  }

}


function formatPercent(value) {

  return `${num(value).toFixed(1)}%`;

}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function todayString() {

  const d = new Date();

  const y = d.getFullYear();

  const m =
    String(d.getMonth() + 1).padStart(2, "0");

  const day =
    String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;

}


function currentTimeString() {

  const d = new Date();

  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

}


function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


function sortTrades(trades) {

  return [...trades].sort((a, b) => {

    const aKey =
      `${a.date || ""} ${a.time || ""}`;

    const bKey =
      `${b.date || ""} ${b.time || ""}`;

    return bKey.localeCompare(aKey);

  });

}


/* =========================================================
   NAVIGATION
========================================================= */

const pageNames = {

  dashboard: "Dashboard",

  journal: "Journal",

  analytics: "Analytics",

  risk: "Risk Calculator",

  calendar: "Calendar",

  settings: "Settings"

};


function showPage(pageName) {

  document.querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove("active-page");

    });


  const page =
    $(`${pageName}Page`);

  if (page) {

    page.classList.add("active-page");

  }


  document.querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === pageName
      );

    });


  $("pageTitle").textContent =
    pageNames[pageName] || "Dashboard";


  closeMobileSidebar();

}


document.querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener("click", () => {

      showPage(button.dataset.page);

    });

  });


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openMobileSidebar() {

  $("sidebar").classList.add("open");

  $("sidebarOverlay").classList.add("show");

}


function closeMobileSidebar() {

  $("sidebar").classList.remove("open");

  $("sidebarOverlay").classList.remove("show");

}


$("openSidebar").addEventListener(
  "click",
  openMobileSidebar
);


$("closeSidebar").addEventListener(
  "click",
  closeMobileSidebar
);


$("sidebarOverlay").addEventListener(
  "click",
  closeMobileSidebar
);


/* =========================================================
   AUTH
========================================================= */

$("googleLoginBtn")
  .addEventListener("click", async () => {

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

  });


function friendlyAuthError(error) {

  if (!error) {
    return "Login failed.";
  }

  if (
    error.code ===
    "auth/popup-closed-by-user"
  ) {
    return "Login window was closed.";
  }

  if (
    error.code ===
    "auth/unauthorized-domain"
  ) {
    return "This website domain is not authorized in Firebase.";
  }

  return error.message ||
    "Login failed.";

}


$("logoutBtn")
  .addEventListener("click", async () => {

    try {

      if (state.unsubscribeTrades) {
        state.unsubscribeTrades();
      }

      if (state.unsubscribeSettings) {
        state.unsubscribeSettings();
      }

      state.trades = [];

      state.user = null;

      await signOut(auth);

    } catch (error) {

      showToast(
        "Logout failed."
      );

    }

  });


(async function handleRedirect() {

  try {

    await getRedirectResult(auth);

  } catch (error) {

    console.error(
      "Redirect login error:",
      error
    );

  }

})();


onAuthStateChanged(
  auth,
  async user => {

    if (user) {

      state.user = user;

      $("loginScreen")
        .classList.add("hidden");

      $("app")
        .classList.remove("hidden");


      $("settingsName").textContent =
        user.displayName || "Trader";

      $("settingsEmail").textContent =
        user.email || "";

      $("settingsPhoto").src =
        user.photoURL || "logo.png";


      await saveUserProfile(user);

      listenToSettings();

      listenToTrades();

      renderAll();

    } else {

      $("loginScreen")
        .classList.remove("hidden");

      $("app")
        .classList.add("hidden");

      state.trades = [];

    }

  }
);


/* =========================================================
   USER PROFILE
========================================================= */

async function saveUserProfile(user) {

  try {

    await setDoc(
      doc(db, "users", user.uid),
      {
        name:
          user.displayName || "Trader",

        email:
          user.email || "",

        photo:
          user.photoURL || "",

        updatedAt:
          new Date().toISOString()

      },
      {
        merge: true
      }
    );

  } catch (error) {

    console.error(
      "Profile save failed:",
      error
    );

  }

}


/* =========================================================
   SETTINGS
========================================================= */

function settingsRef() {

  return doc(
    db,
    "users",
    state.user.uid,
    "settings",
    "main"
  );

}


function listenToSettings() {

  if (!state.user) return;

  if (state.unsubscribeSettings) {
    state.unsubscribeSettings();
  }


  state.unsubscribeSettings =
    onSnapshot(
      settingsRef(),
      snapshot => {

        if (snapshot.exists()) {

          state.settings = {
            startingBalance:
              num(
                snapshot.data().startingBalance
              ),

            currency:
              snapshot.data().currency ||
              "USD"
          };

        }


        $("startingBalance").value =
          state.settings.startingBalance || "";

        $("currency").value =
          state.settings.currency || "USD";


        if (!$("calcBalance").value) {

          $("calcBalance").value =
            state.settings.startingBalance || "";

        }


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


$("saveAccountBtn")
  .addEventListener("click", async () => {

    if (!state.user) return;


    const startingBalance =
      num(
        $("startingBalance").value
      );

    const currency =
      $("currency").value;


    try {

      await setDoc(
        settingsRef(),
        {
          startingBalance,
          currency,
          updatedAt:
            new Date().toISOString()
        },
        {
          merge: true
        }
      );

      $("accountMessage").textContent =
        "Settings saved.";

      showToast(
        "Settings saved."
      );

    } catch (error) {

      $("accountMessage").textContent =
        "Could not save settings.";

      console.error(error);

    }

  });


/* =========================================================
   TRADES FIRESTORE
========================================================= */

function tradesCollection() {

  return collection(
    db,
    "users",
    state.user.uid,
    "trades"
  );

}


function listenToTrades() {

  if (!state.user) return;

  if (state.unsubscribeTrades) {
    state.unsubscribeTrades();
  }


  state.unsubscribeTrades =
    onSnapshot(
      tradesCollection(),
      snapshot => {

        state.trades =
          snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
          }));

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

  const entry =
    num($("entry").value);

  const sl =
    num($("sl").value);

  const tp =
    num($("tp").value);

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

    $("rr").value = "Invalid";

    return 0;

  }


  const rr =
    reward / risk;


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

    Risk Amount is manual.

    We NEVER overwrite it here.
  */

  const manualRiskAmount =
    num($("riskAmount").value);


  const distance =
    Math.abs(entry - sl);


  if (
    manualRiskAmount <= 0 ||
    distance <= 0
  ) {

    return;

  }


  /*
    Simplified estimate for lot size.

    This does NOT change Risk Amount.
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
    Break Even is always 0.
  */

  if (result === "BE") {

    input.value = "0";

    return;

  }


  /*
    Do not modify an empty field.
  */

  if (input.value === "") {

    return;

  }


  const value =
    Number(input.value);


  if (!Number.isFinite(value)) {

    return;

  }


  if (result === "Win") {

    input.value =
      Math.abs(value);

  }


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


  if (result === "BE") {

    return 0;

  }


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

  $("modalTitle").textContent =
    "Add Trade";

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

  $("result").value =
    "Win";

  $("profitLoss").value =
    "";

  $("rr").value =
    "";

  $("tradeError").textContent =
    "";

}


function openTradeModal(tradeId = null) {

  resetTradeForm();


  if (tradeId) {

    const trade =
      state.trades.find(
        item => item.id === tradeId
      );


    if (!trade) return;


    state.editingTradeId =
      tradeId;


    $("modalTitle").textContent =
      "Edit Trade";


    $("tradeId").value =
      tradeId;


    $("tradeDate").value =
      trade.date || todayString();

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
      "true";

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

    $("psychology").value =
      trade.psychology || "";

    $("confidence").value =
      trade.confidence ?? "";

    $("mistake").value =
      trade.mistake || "";

    $("notes").value =
      trade.notes || "";

  } else {

    state.editingTradeId =
      null;

  }


  calculateTradeRR();

  calculateModalRisk();


  $("tradeModal")
    .classList.add("show");

}


function closeTradeModal() {

  $("tradeModal")
    .classList.remove("show");

  state.editingTradeId =
    null;

}


$("quickAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("journalAddBtn")
  .addEventListener(
    "click",
    () => openTradeModal()
  );


$("emptyAddBtn")
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


$("tradeModal")
  .addEventListener(
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


/* =========================================================
   MODAL INPUTS
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


$("riskAmount")
  .addEventListener(
    "input",
    () => {

      calculateModalRisk();

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
  Normalize P/L only when the user
  changes result or leaves the field.

  NOT on every keystroke.
*/

$("result")
  .addEventListener(
    "change",
    normalizeProfitLossByResult
  );


$("profitLoss")
  .addEventListener(
    "blur",
    normalizeProfitLossByResult
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

      const pair =
        $("pair").value.trim();


      const entry =
        num($("entry").value);

      const sl =
        num($("sl").value);

      const tp =
        num($("tp").value);


      if (!date) {

        $("tradeError").textContent =
          "Please select a date.";

        return;

      }


      if (!pair) {

        $("tradeError").textContent =
          "Please enter a pair.";

        return;

      }


      if (
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0
      ) {

        $("tradeError").textContent =
          "Entry, Stop Loss and Take Profit must be valid.";

        return;

      }


      const rr =
        calculateTradeRR();


      if (
        !rr ||
        $("rr").value === "Invalid"
      ) {

        $("tradeError").textContent =
          "The Entry, SL and TP combination gives an invalid R:R.";

        return;

      }


      /*
        MANUAL RISK AMOUNT
      */

      const riskAmountRaw =
        $("riskAmount").value.trim();


      let riskAmount = 0;


      if (riskAmountRaw !== "") {

        riskAmount =
          Number(riskAmountRaw);


        if (
          !Number.isFinite(riskAmount) ||
          riskAmount < 0
        ) {

          $("tradeError").textContent =
            "Risk Amount must be a valid positive number.";

          return;

        }

      }


      /*
        MANUAL P/L
      */

      normalizeProfitLossByResult();


      const profitLoss =
        getNormalizedPL();


      if (profitLoss === null) {

        $("tradeError").textContent =
          "Please enter the actual Profit / Loss amount.";

        return;

      }


      /*
        LOT SIZE
      */

      let lotSize =
        num($("lotSize").value);


      if (
        $("lotSize").dataset.manual !==
        "true"
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

        time:
          $("tradeTime").value,

        pair,

        tradingType:
          $("tradingType").value,

        direction:
          $("direction").value,

        entry,

        sl,

        tp,

        rr:

          Number(
            rr.toFixed(4)
          ),

        riskPercent:
          num(
            $("riskPercent").value
          ),

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
          $("liquidity").value.trim(),

        confirmation:
          $("confirmation").value.trim(),

        result:
          $("result").value,

        profitLoss:
          Number(
            profitLoss.toFixed(2)
          ),

        confidence:
          num(
            $("confidence").value
          ),

        psychology:
          $("psychology").value.trim(),

        mistake:
          $("mistake").value.trim(),

        notes:
          $("notes").value.trim(),

        updatedAt:
          new Date().toISOString()

      };


      try {

        const tradeId =
          $("tradeId").value;


        if (tradeId) {

          await updateDoc(
            doc(
              db,
              "users",
              state.user.uid,
              "trades",
              tradeId
            ),
            tradeData
          );


          showToast(
            "Trade updated."
          );

        } else {

          await addDoc(
            tradesCollection(),
            {
              ...tradeData,

              createdAt:
                new Date().toISOString()
            }
          );


          showToast(
            "Trade saved."
          );

        }


        closeTradeModal();

      } catch (error) {

        console.error(
          "Save trade error:",
          error
        );


        $("tradeError").textContent =
          "Could not save trade. Check Firebase permissions.";

      }

    }
  );


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(tradeId) {

  if (!state.user) return;


  const trade =
    state.trades.find(
      item => item.id === tradeId
    );


  if (!trade) return;


  const confirmed =
    window.confirm(
      "Delete this trade?"
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
   STATS
========================================================= */

function getStats(trades) {

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
      t => t.result === "BE"
    ).length;


  const pl =
    trades.reduce(
      (sum, t) =>
        sum + num(t.profitLoss),
      0
    );


  const grossProfit =
    trades
      .filter(t => num(t.profitLoss) > 0)
      .reduce(
        (sum, t) =>
          sum + num(t.profitLoss),
        0
      );


  const grossLoss =
    Math.abs(
      trades
        .filter(t => num(t.profitLoss) < 0)
        .reduce(
          (sum, t) =>
            sum + num(t.profitLoss),
          0
        )
    );


  const winRate =
    total
      ? wins / total * 100
      : 0;


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const avgWin =
    wins
      ? trades
          .filter(t => t.result === "Win")
          .reduce(
            (sum, t) =>
              sum + Math.abs(num(t.profitLoss)),
            0
          ) / wins
      : 0;


  const avgLoss =
    losses
      ? trades
          .filter(t => t.result === "Loss")
          .reduce(
            (sum, t) =>
              sum + Math.abs(num(t.profitLoss)),
            0
          ) / losses
      : 0;


  const expectancy =
    total
      ? pl / total
      : 0;


  const plannedRRTrades =
    trades.filter(
      t => num(t.rr) > 0
    );


  const averageRR =
    plannedRRTrades.length
      ? plannedRRTrades.reduce(
          (sum, t) =>
            sum + num(t.rr),
          0
        ) /
        plannedRRTrades.length
      : 0;


  const rTrades =
    trades.filter(
      t =>
        num(t.riskAmount) > 0
    );


  const averageR =
    rTrades.length
      ? rTrades.reduce(
          (sum, t) =>
            sum +
            num(t.profitLoss) /
            num(t.riskAmount),
          0
        ) /
        rTrades.length
      : 0;


  const averageRisk =
    rTrades.length
      ? rTrades.reduce(
          (sum, t) =>
            sum + num(t.riskAmount),
          0
        ) /
        rTrades.length
      : 0;


  return {

    total,
    wins,
    losses,
    breakeven,

    pl,

    grossProfit,
    grossLoss,

    winRate,
    profitFactor,

    avgWin,
    avgLoss,

    expectancy,

    averageRR,
    averageR,

    averageRisk

  };

}


/* =========================================================
   DRAW DOWN
========================================================= */

function calculateDrawdown(trades) {

  const ordered =
    [...trades].sort(
      (a, b) => {

        const aKey =
          `${a.date || ""} ${a.time || ""}`;

        const bKey =
          `${b.date || ""} ${b.time || ""}`;

        return aKey.localeCompare(bKey);

      }
    );


  let equity =
    num(
      state.settings.startingBalance
    );

  let peak =
    equity;

  let maxDrawdown =
    0;


  for (const trade of ordered) {

    equity +=
      num(trade.profitLoss);


    if (equity > peak) {

      peak = equity;

    }


    const drawdown =
      peak - equity;


    if (
      drawdown >
      maxDrawdown
    ) {

      maxDrawdown =
        drawdown;

    }

  }


  return maxDrawdown;

}


/* =========================================================
   STREAKS
========================================================= */

function getStreaks(trades) {

  const ordered =
    [...trades].sort(
      (a, b) => {

        const aKey =
          `${a.date || ""} ${a.time || ""}`;

        const bKey =
          `${b.date || ""} ${b.time || ""}`;

        return aKey.localeCompare(bKey);

      }
    );


  let currentType =
    "";

  let current =
    0;

  let bestWin =
    0;

  let worstLoss =
    0;

  let win =
    0;

  let loss =
    0;


  for (const trade of ordered) {

    if (trade.result === "Win") {

      win++;

      loss = 0;

      if (win > bestWin) {
        bestWin = win;
      }

    } else if (
      trade.result === "Loss"
    ) {

      loss++;

      win = 0;

      if (loss > worstLoss) {
        worstLoss = loss;
      }

    } else {

      win = 0;

      loss = 0;

    }

  }


  const last =
    ordered[ordered.length - 1];


  if (last?.result === "Win") {

    currentType = "Win streak";

    current = win;

  } else if (
    last?.result === "Loss"
  ) {

    currentType = "Loss streak";

    current = loss;

  } else {

    currentType = "No streak";

    current = 0;

  }


  return {

    current,
    currentType,
    bestWin,
    worstLoss

  };

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const stats =
    getStats(state.trades);


  const startingBalance =
    num(
      state.settings.startingBalance
    );


  const balance =
    startingBalance +
    stats.pl;


  $("dashBalance").textContent =
    formatMoney(balance);


  $("totalProfit").textContent =
    formatMoney(stats.pl);


  $("totalProfit").className =
    stats.pl > 0
      ? "pl-positive"
      : stats.pl < 0
        ? "pl-negative"
        : "";


  $("profitPercent").textContent =
    startingBalance
      ? formatPercent(
          stats.pl /
          startingBalance *
          100
        )
      : "0%";


  $("winRate").textContent =
    formatPercent(
      stats.winRate
    );


  $("winLossText").textContent =
    `${stats.wins}W / ${stats.losses}L`;


  $("maxDrawdown").textContent =
    formatMoney(
      calculateDrawdown(
        state.trades
      )
    );


  $("profitFactor").textContent =
    Number.isFinite(
      stats.profitFactor
    )
      ? stats.profitFactor.toFixed(2)
      : "∞";


  $("expectancy").textContent =
    formatMoney(
      stats.expectancy
    );


  $("averageRR").textContent =
    stats.averageRR
      ? `1:${stats.averageRR.toFixed(2)}`
      : "0.00";


  $("averageWin").textContent =
    formatMoney(
      stats.avgWin
    );


  $("averageLoss").textContent =
    formatMoney(
      stats.avgLoss
    );


  $("equityProfit").textContent =
    formatMoney(stats.pl);


  const streaks =
    getStreaks(
      state.trades
    );


  $("currentStreak").textContent =
    streaks.current;


  $("currentStreakType").textContent =
    streaks.currentType;


  $("bestWinStreak").textContent =
    streaks.bestWin;


  $("worstLossStreak").textContent =
    streaks.worstLoss;


  renderRecentTrades();

  renderQuickInsights();

  drawEquityCurve();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades() {

  const trades =
    sortTrades(
      state.trades
    ).slice(0, 7);


  if (!trades.length) {

    $("recentTrades").innerHTML = `
      <div class="empty-state">
        <p>No trades yet.</p>
      </div>
    `;

    return;

  }


  $("recentTrades").innerHTML = `

    <div class="table-wrap">

      <table>

        <thead>

          <tr>
            <th>Date</th>
            <th>Pair</th>
            <th>Direction</th>
            <th>Result</th>
            <th>P/L</th>
          </tr>

        </thead>

        <tbody>

          ${trades.map(trade => {

            const pl =
              num(
                trade.profitLoss
              );


            const resultClass =
              trade.result === "Win"
                ? "result-win"
                : trade.result === "Loss"
                  ? "result-loss"
                  : "result-be";


            return `

              <tr>

                <td>
                  ${escapeHtml(trade.date || "-")}
                </td>

                <td>
                  ${escapeHtml(trade.pair || "-")}
                </td>

                <td>
                  ${escapeHtml(trade.direction || "-")}
                </td>

                <td>
                  <span class="result-pill ${resultClass}">
                    ${escapeHtml(trade.result || "-")}
                  </span>
                </td>

                <td class="${
                  pl > 0
                    ? "pl-positive"
                    : pl < 0
                      ? "pl-negative"
                      : ""
                }">

                  ${pl >= 0 ? "+" : ""}
                  ${formatMoney(pl)}

                </td>

              </tr>

            `;

          }).join("")}

        </tbody>

      </table>

    </div>

  `;

}


/* =========================================================
   QUICK INSIGHTS
========================================================= */

function renderQuickInsights() {

  const stats =
    getStats(state.trades);


  if (!state.trades.length) {

    $("quickInsights").innerHTML = `
      <div class="empty-state">
        <p>Add trades to see insights.</p>
      </div>
    `;

    return;

  }


  const bestSetup =
    getBestCategory(
      state.trades,
      "setup"
    );


  const bestSession =
    getBestCategory(
      state.trades,
      "session"
    );


  const bestDirection =
    getBestCategory(
      state.trades,
      "direction"
    );


  $("quickInsights").innerHTML = `

    <div class="analytics-row">

      <span class="analytics-name">
        Win Rate
      </span>

      <span class="analytics-meta">
        ${stats.wins}W / ${stats.losses}L
      </span>

      <strong class="analytics-value">
        ${formatPercent(stats.winRate)}
      </strong>

    </div>


    <div class="analytics-row">

      <span class="analytics-name">
        Best Setup
      </span>

      <span class="analytics-meta">
        ${escapeHtml(bestSetup.name)}
      </span>

      <strong class="analytics-value">
        ${formatMoney(bestSetup.pl)}
      </strong>

    </div>


    <div class="analytics-row">

      <span class="analytics-name">
        Best Session
      </span>

      <span class="analytics-meta">
        ${escapeHtml(bestSession.name)}
      </span>

      <strong class="analytics-value">
        ${formatMoney(bestSession.pl)}
      </strong>

    </div>


    <div class="analytics-row">

      <span class="analytics-name">
        Buy / Sell
      </span>

      <span class="analytics-meta">
        ${escapeHtml(bestDirection.name)}
      </span>

      <strong class="analytics-value">
        ${formatMoney(bestDirection.pl)}
      </strong>

    </div>

  `;

}


function getBestCategory(
  trades,
  property
) {

  const groups = {};


  trades.forEach(trade => {

    const name =
      trade[property] ||
      "Not Set";


    if (!groups[name]) {

      groups[name] = {
        name,
        pl: 0,
        count: 0
      };

    }


    groups[name].pl +=
      num(trade.profitLoss);

    groups[name].count++;

  });


  const values =
    Object.values(groups);


  if (!values.length) {

    return {
      name: "—",
      pl: 0,
      count: 0
    };

  }


  values.sort(
    (a, b) => b.pl - a.pl
  );


  return values[0];

}


/* =========================================================
   JOURNAL FILTERS
========================================================= */

function populateSetupFilter() {

  const current =
    $("setupFilter").value;


  const setups =
    [
      ...new Set(
        state.trades
          .map(t => t.setup)
          .filter(Boolean)
      )
    ]
    .sort();


  $("setupFilter").innerHTML = `
    <option value="all">
      All Setups
    </option>

    ${setups.map(setup => `
      <option value="${escapeHtml(setup)}">
        ${escapeHtml(setup)}
      </option>
    `).join("")}
  `;


  if (
    setups.includes(current)
  ) {

    $("setupFilter").value =
      current;

  }

}


[
  "tradeSearch",
  "resultFilter",
  "directionFilter",
  "setupFilter"
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


function getFilteredTrades() {

  const search =
    $("tradeSearch")
      .value
      .trim()
      .toLowerCase();


  const result =
    $("resultFilter").value;

  const direction =
    $("directionFilter").value;

  const setup =
    $("setupFilter").value;


  return state.trades.filter(
    trade => {

      const text = [
        trade.date,
        trade.pair,
        trade.tradingType,
        trade.direction,
        trade.setup,
        trade.result,
        trade.session,
        trade.htfBias,
        trade.psychology,
        trade.notes
      ]
      .join(" ")
      .toLowerCase();


      if (
        search &&
        !text.includes(search)
      ) {
        return false;
      }


      if (
        result !== "all" &&
        trade.result !== result
      ) {
        return false;
      }


      if (
        direction !== "all" &&
        trade.direction !== direction
      ) {
        return false;
      }


      if (
        setup !== "all" &&
        trade.setup !== setup
      ) {
        return false;
      }


      return true;

    }
  );

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal() {

  populateSetupFilter();


  const trades =
    getFilteredTrades();


  const stats =
    getStats(trades);


  $("journalCount").textContent =
    stats.total;


  $("journalWins").textContent =
    stats.wins;


  $("journalLosses").textContent =
    stats.losses;


  $("journalPL").textContent =
    formatMoney(stats.pl);


  $("journalPL").className =
    stats.pl > 0
      ? "pl-positive"
      : stats.pl < 0
        ? "pl-negative"
        : "";


  $("emptyTrades").style.display =
    trades.length
      ? "none"
      : "block";


  $("tradeTableBody").innerHTML =
    trades.map(trade => {

      const pl =
        num(
          trade.profitLoss
        );


      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";


      return `

        <tr>

          <td>
            ${escapeHtml(trade.date || "-")}
          </td>

          <td>
            ${escapeHtml(trade.pair || "-")}
          </td>

          <td>
            ${escapeHtml(
              trade.tradingType || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.direction || "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              trade.setup || "-"
            )}
          </td>

          <td>
            ${num(trade.entry).toFixed(3)}
          </td>

          <td>
            ${num(trade.sl).toFixed(3)}
          </td>

          <td>
            ${num(trade.tp).toFixed(3)}
          </td>

          <td>
            ${
              num(trade.rr)
                ? `1:${num(trade.rr).toFixed(2)}`
                : "-"
            }
          </td>

          <td>

            <span class="result-pill ${resultClass}">
              ${escapeHtml(
                trade.result === "BE"
                  ? "Break Even"
                  : trade.result || "-"
              )}
            </span>

          </td>

          <td class="${
            pl > 0
              ? "pl-positive"
              : pl < 0
                ? "pl-negative"
                : ""
          }">

            ${pl >= 0 ? "+" : ""}
            ${formatMoney(pl)}

          </td>

          <td>

            <div class="action-buttons">

              <button
                class="action-btn"
                type="button"
                data-edit="${trade.id}"
                title="Edit"
              >
                ✎
              </button>

              <button
                class="action-btn delete"
                type="button"
                data-delete="${trade.id}"
                title="Delete"
              >
                ×
              </button>

            </div>

          </td>

        </tr>

      `;

    }).join("");

}


$("tradeTableBody")
  .addEventListener(
    "click",
    event => {

      const editButton =
        event.target.closest(
          "[data-edit]"
        );


      const deleteButton =
        event.target.closest(
          "[data-delete]"
        );


      if (editButton) {

        openTradeModal(
          editButton.dataset.edit
        );

      }


      if (deleteButton) {

        deleteTrade(
          deleteButton.dataset.delete
        );

      }

    }
  );


/* =========================================================
   ANALYTICS PERIOD
========================================================= */

$("analyticsPeriod")
  .addEventListener(
    "change",
    () => {

      $("customAnalytics")
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

      showToast(
        "Analytics updated."
      );

    }
  );


function getAnalyticsTrades() {

  let trades =
    [...state.trades];


  const period =
    state.analyticsPeriod;


  if (period === "all") {

    return trades;

  }


  const today =
    new Date();

  let from =
    new Date(today);


  let to =
    new Date(today);


  to.setHours(
    23,
    59,
    59,
    999
  );


  if (period === "7") {

    from.setDate(
      from.getDate() - 6
    );

  }


  if (period === "30") {

    from.setDate(
      from.getDate() - 29
    );

  }


  if (period === "month") {

    from =
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );

  }


  if (period === "custom") {

    if (!state.analyticsFrom) {
      return trades;
    }


    from =
      new Date(
        `${state.analyticsFrom}T00:00:00`
      );


    if (state.analyticsTo) {

      to =
        new Date(
          `${state.analyticsTo}T23:59:59`
        );

    }

  }


  return trades.filter(
    trade => {

      if (!trade.date) {
        return false;
      }


      const date =
        new Date(
          `${trade.date}T12:00:00`
        );


      return (
        date >= from &&
        date <= to
      );

    }
  );

}


/* =========================================================
   ANALYTICS RENDER
========================================================= */

function renderAnalytics() {

  const trades =
    getAnalyticsTrades();


  const stats =
    getStats(trades);


  $("aTrades").textContent =
    stats.total;


  $("aWinRate").textContent =
    formatPercent(
      stats.winRate
    );


  $("aPL").textContent =
    formatMoney(stats.pl);


  $("aPL").className =
    stats.pl > 0
      ? "pl-positive"
      : stats.pl < 0
        ? "pl-negative"
        : "";


  $("aAvgR").textContent =
    `${stats.averageR.toFixed(2)}R`;


  $("aAvgRisk").textContent =
    formatMoney(
      stats.averageRisk
    );


  $("aDrawdown").textContent =
    formatMoney(
      calculateDrawdown(trades)
    );


  renderCategoryAnalytics(
    trades,
    "setup",
    "setupAnalytics"
  );


  renderCategoryAnalytics(
    trades,
    "direction",
    "directionAnalytics"
  );


  renderCategoryAnalytics(
    trades,
    "tradingType",
    "typeAnalytics"
  );


  renderCategoryAnalytics(
    trades,
    "session",
    "sessionAnalytics"
  );


  renderCategoryAnalytics(
    trades,
    "psychology",
    "psychologyAnalytics"
  );


  renderCategoryAnalytics(
    trades,
    "mistake",
    "mistakeAnalytics"
  );


  renderMonthlyAnalytics(
    trades
  );

}


function renderCategoryAnalytics(
  trades,
  property,
  targetId
) {

  const groups = {};


  trades.forEach(trade => {

    const name =
      trade[property] ||
      "Not Set";


    if (!groups[name]) {

      groups[name] = {

        name,

        trades: 0,

        wins: 0,

        pl: 0

      };

    }


    groups[name].trades++;

    groups[name].pl +=
      num(trade.profitLoss);


    if (
      trade.result === "Win"
    ) {

      groups[name].wins++;

    }

  });


  const rows =
    Object.values(groups)
      .sort(
        (a, b) =>
          b.pl - a.pl
      );


  if (!rows.length) {

    $(targetId).innerHTML = `
      <div class="empty-state">
        <p>No data yet.</p>
      </div>
    `;

    return;

  }


  const maxCount =
    Math.max(
      ...rows.map(
        row => row.trades
      ),
      1
    );


  $(targetId).innerHTML =
    rows.map(row => {

      const winRate =
        row.trades
          ? row.wins /
            row.trades *
            100
          : 0;


      const pl =
        row.pl;


      return `

        <div class="analytics-row">

          <div>

            <div class="analytics-name">
              ${escapeHtml(row.name)}
            </div>

            <div class="bar">
              <span
                style="width:${Math.max(
                  4,
                  row.trades /
                  maxCount *
                  100
                )}%"
              ></span>
            </div>

          </div>

          <span class="analytics-meta">
            ${row.trades} trades
          </span>

          <strong class="analytics-value ${
            pl > 0
              ? "pl-positive"
              : pl < 0
                ? "pl-negative"
                : ""
          }">

            ${formatPercent(winRate)}
            /
            ${pl >= 0 ? "+" : ""}
            ${formatMoney(pl)}

          </strong>

        </div>

      `;

    }).join("");

}


function renderMonthlyAnalytics(trades) {

  const groups = {};


  trades.forEach(trade => {

    if (!trade.date) return;


    const key =
      trade.date.slice(0, 7);


    if (!groups[key]) {

      groups[key] = 0;

    }


    groups[key] +=
      num(trade.profitLoss);

  });


  const rows =
    Object.entries(groups)
      .sort(
        ([a], [b]) =>
          a.localeCompare(b)
      );


  if (!rows.length) {

    $("monthlyAnalytics").innerHTML = `
      <div class="empty-state">
        <p>No monthly data yet.</p>
      </div>
    `;

    return;

  }


  $("monthlyAnalytics").innerHTML =
    rows.map(
      ([month, pl]) => `

        <div class="analytics-row">

          <span class="analytics-name">
            ${escapeHtml(month)}
          </span>

          <span class="analytics-meta">
            Monthly P/L
          </span>

          <strong class="analytics-value ${
            pl > 0
              ? "pl-positive"
              : pl < 0
                ? "pl-negative"
                : ""
          }">

            ${pl >= 0 ? "+" : ""}
            ${formatMoney(pl)}

          </strong>

        </div>

      `
    ).join("");

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

$("calculateRisk")
  .addEventListener(
    "click",
    calculateRisk
  );


function calculateRisk() {

  const balance =
    num(
      $("calcBalance").value
    );

  const riskPercent =
    num(
      $("calcRisk").value
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

  const contract =
    num(
      $("calcContract").value
    );


  const riskAmount =
    balance *
    riskPercent /
    100;


  const distance =
    Math.abs(
      entry - sl
    );


  let rr = 0;


  if (
    distance > 0 &&
    entry > 0 &&
    tp > 0
  ) {

    rr =
      Math.abs(
        tp - entry
      ) /
      distance;

  }


  let lot = 0;


  if (
    distance > 0 &&
    contract > 0
  ) {

    lot =
      riskAmount /
      (distance * contract);

  }


  const potentialLoss =
    riskAmount;


  const potentialProfit =
    riskAmount * rr;


  $("calcRiskAmount").textContent =
    formatMoney(
      riskAmount
    );


  $("calcDistance").textContent =
    distance.toFixed(3);


  $("calcRR").textContent =
    rr
      ? `1:${rr.toFixed(2)}`
      : "0.00";


  $("calcLot").textContent =
    lot.toFixed(2);


  $("calcLoss").textContent =
    formatMoney(
      potentialLoss
    );


  $("calcProfit").textContent =
    formatMoney(
      potentialProfit
    );

}


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate.setMonth(
        state.calendarDate.getMonth() - 1
      );

      renderCalendar();

    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate.setMonth(
        state.calendarDate.getMonth() + 1
      );

      renderCalendar();

    }
  );


function renderCalendar() {

  const year =
    state.calendarDate.getFullYear();

  const month =
    state.calendarDate.getMonth();


  $("calendarMonth").textContent =
    new Date(
      year,
      month,
      1
    ).toLocaleDateString(
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


  const previousDays =
    new Date(
      year,
      month,
      0
    ).getDate();


  let html = "";


  for (
    let i = firstDay - 1;
    i >= 0;
    i--
  ) {

    html += `

      <div class="calendar-day muted">

        <div class="calendar-number">
          ${previousDays - i}
        </div>

      </div>

    `;

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const date =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dailyTrades =
      state.trades.filter(
        trade =>
          trade.date === date
      );


    const dailyPL =
      dailyTrades.reduce(
        (sum, trade) =>
          sum + num(trade.profitLoss),
        0
      );


    const today =
      date === todayString();


    html += `

      <div class="calendar-day ${
        today ? "today" : ""
      }">

        <div class="calendar-number">
          ${day}
        </div>

        ${
          dailyTrades.length
            ? `
              <div class="calendar-pl ${
                dailyPL > 0
                  ? "pl-positive"
                  : dailyPL < 0
                    ? "pl-negative"
                    : ""
              }">

                ${dailyPL >= 0 ? "+" : ""}
                ${formatMoney(dailyPL)}

              </div>
            `
            : ""
        }

      </div>

    `;

  }


  const totalCells =
    firstDay +
    daysInMonth;


  const remaining =
    (7 -
      totalCells % 7) % 7;


  for (
    let day = 1;
    day <= remaining;
    day++
  ) {

    html += `

      <div class="calendar-day muted">

        <div class="calendar-number">
          ${day}
        </div>

      </div>

    `;

  }


  $("calendarGrid").innerHTML =
    html;

}


/* =========================================================
   EQUITY CURVE
========================================================= */

function drawEquityCurve() {

  const canvas =
    $("equityCanvas");


  if (!canvas) return;


  const rect =
    canvas.getBoundingClientRect();


  const width =
    Math.max(
      rect.width,
      300
    );


  const height =
    Math.max(
      rect.height,
      220
    );


  const ratio =
    window.devicePixelRatio ||
    1;


  canvas.width =
    width * ratio;

  canvas.height =
    height * ratio;


  const ctx =
    canvas.getContext("2d");


  ctx.scale(
    ratio,
    ratio
  );


  const ordered =
    [...state.trades].sort(
      (a, b) => {

        const aKey =
          `${a.date || ""} ${a.time || ""}`;

        const bKey =
          `${b.date || ""} ${b.time || ""}`;

        return aKey.localeCompare(bKey);

      }
    );


  let equity =
    num(
      state.settings.startingBalance
    );


  const points = [
    equity
  ];


  ordered.forEach(
    trade => {

      equity +=
        num(trade.profitLoss);

      points.push(
        equity
      );

    }
  );


  if (
    points.length === 1
  ) {

    points.push(
      points[0]
    );

  }


  const min =
    Math.min(...points);

  const max =
    Math.max(...points);


  const range =
    max - min || 1;


  const padding = 25;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  /*
    Grid
  */

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;


  for (
    let i = 1;
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


  /*
    Line
  */

  ctx.beginPath();


  points.forEach(
    (value, index) => {

      const x =
        padding +
        index /
        (points.length - 1) *
        (width - padding * 2);


      const y =
        height -
        padding -
        ((value - min) /
          range) *
        (height - padding * 2);


      if (index === 0) {

        ctx.moveTo(
          x,
          y
        );

      } else {

        ctx.lineTo(
          x,
          y
        );

      }

    }
  );


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth = 2.5;

  ctx.stroke();


  /*
    Fill
  */

  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      0,
      height
    );


  gradient.addColorStop(
    0,
    "rgba(214,174,85,.18)"
  );


  gradient.addColorStop(
    1,
    "rgba(214,174,85,0)"
  );


  ctx.lineTo(
    width - padding,
    height - padding
  );


  ctx.lineTo(
    padding,
    height - padding
  );


  ctx.closePath();


  ctx.fillStyle =
    gradient;

  ctx.fill();


  /*
    Current point
  */

  const last =
    points[points.length - 1];


  const lastX =
    width - padding;


  const lastY =
    height -
    padding -
    ((last - min) /
      range) *
    (height - padding * 2);


  ctx.beginPath();

  ctx.arc(
    lastX,
    lastY,
    4,
    0,
    Math.PI * 2
  );


  ctx.fillStyle =
    "#f1d27d";

  ctx.fill();

}


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCSV")
  .addEventListener(
    "click",
    exportCSV
  );


function exportCSV() {

  if (!state.trades.length) {

    showToast(
      "No trades to export."
    );

    return;

  }


  const headers = [

    "Date",
    "Time",
    "Pair",
    "Trading Type",
    "Direction",
    "Setup",
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
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"

  ];


  const rows =
    state.trades.map(
      trade => [

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
        trade.psychology,
        trade.confidence,
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


  link.href =
    url;


  link.download =
    `UjR_Fx_Trading_Journal_${todayString()}.csv`;


  link.click();


  URL.revokeObjectURL(
    url
  );


  showToast(
    "CSV exported."
  );

}


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
   INITIAL SETUP
========================================================= */

$("tradeDate").value =
  todayString();

$("tradeTime").value =
  currentTimeString();

$("lotSize").dataset.manual =
  "false";


$("calcBalance").value =
  state.settings.startingBalance ||
  "";


showPage(
  "dashboard"
);


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    if (
      $("dashboardPage")
        .classList
        .contains("active-page")
    ) {

      drawEquityCurve();

    }

  }
);
