import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// =====================================================
// FIREBASE
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
  authDomain: "journal-38e0e.firebaseapp.com",
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


// =====================================================
// STATE
// =====================================================

let currentUser = null;

let allTrades = [];

let unsubscribeTrades = null;

let unsubscribeSettings = null;

let accountSettings = {
  startingBalance: 0,
  currency: "$"
};


// =====================================================
// ELEMENTS
// =====================================================

const loginScreen =
  document.getElementById("loginScreen");

const appScreen =
  document.getElementById("appScreen");

const googleLoginBtn =
  document.getElementById("googleLoginBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const loginError =
  document.getElementById("loginError");

const userName =
  document.getElementById("userName");

const userPhoto =
  document.getElementById("userPhoto");

const addTradeBtn =
  document.getElementById("addTradeBtn");

const tradeModal =
  document.getElementById("tradeModal");

const closeTradeModal =
  document.getElementById("closeTradeModal");

const cancelTradeBtn =
  document.getElementById("cancelTradeBtn");

const tradeForm =
  document.getElementById("tradeForm");

const saveTradeBtn =
  document.getElementById("saveTradeBtn");


// =====================================================
// GOOGLE LOGIN
// =====================================================

googleLoginBtn.addEventListener("click", async () => {

  if (googleLoginBtn.disabled) return;

  try {

    loginError.textContent = "";

    googleLoginBtn.disabled = true;

    googleLoginBtn.textContent = "Signing in...";

    console.log("Starting Google login...");

    const result =
      await signInWithPopup(
        auth,
        provider
      );

    console.log(
      "Login successful:",
      result.user.email
    );

  }

  catch (error) {

    console.error(
      "GOOGLE LOGIN ERROR:",
      error
    );

    let message =
      "Google login failed.";

    switch (error.code) {

      case "auth/popup-blocked":
        message =
          "Popup blocked. Allow popups for this website.";
        break;

      case "auth/popup-closed-by-user":
        message =
          "Login window was closed.";
        break;

      case "auth/unauthorized-domain":
        message =
          "This website domain is not authorized in Firebase.";
        break;

      case "auth/operation-not-allowed":
        message =
          "Google Sign-In is not enabled in Firebase.";
        break;

      case "auth/invalid-api-key":
        message =
          "Firebase API key is invalid.";
        break;

      case "auth/api-key-not-valid":
        message =
          "Firebase API key is not valid.";
        break;

      case "auth/network-request-failed":
        message =
          "Network error. Check your internet.";
        break;

      default:
        message =
          error.message ||
          "Google login failed.";

    }

    loginError.textContent =
      message;

    showToast(
      message,
      "error"
    );

  }

  finally {

    googleLoginBtn.disabled = false;

    googleLoginBtn.textContent =
      "Continue with Google";

  }

});


// =====================================================
// LOGOUT
// =====================================================

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    }

    catch (error) {

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
);


// =====================================================
// AUTH STATE
// =====================================================

onAuthStateChanged(
  auth,
  user => {

    currentUser = user;

    if (user) {

      loginScreen.classList.add(
        "hidden"
      );

      appScreen.classList.remove(
        "hidden"
      );

      userName.textContent =
        user.displayName ||
        "Trader";

      if (user.photoURL) {

        userPhoto.src =
          user.photoURL;

        userPhoto.style.display =
          "block";

      }

      loadSettings();

      loadTrades();

    }

    else {

      loginScreen.classList.remove(
        "hidden"
      );

      appScreen.classList.add(
        "hidden"
      );

      allTrades = [];

      if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;

      }

      if (unsubscribeSettings) {

        unsubscribeSettings();

        unsubscribeSettings = null;

      }

    }

  }
);


// =====================================================
// ACCOUNT SETTINGS
// =====================================================

document
  .getElementById("saveAccountBtn")
  .addEventListener(
    "click",
    async () => {

      if (!currentUser) return;

      const balance =
        Number(
          document.getElementById(
            "startingBalance"
          ).value
        ) || 0;

      const currency =
        document.getElementById(
          "currency"
        ).value || "$";

      try {

        await setDoc(

          doc(
            db,
            "users",
            currentUser.uid,
            "settings",
            "account"
          ),

          {
            startingBalance: balance,
            currency: currency,
            updatedAt: serverTimestamp()
          }

        );

        accountSettings = {
          startingBalance: balance,
          currency: currency
        };

        calculateRiskAmount();

        updateDashboard();

        showToast(
          "Account saved.",
          "success"
        );

      }

      catch (error) {

        console.error(error);

        showToast(
          "Could not save account.",
          "error"
        );

      }

    }
  );


// =====================================================
// LOAD SETTINGS
// =====================================================

function loadSettings() {

  if (!currentUser) return;

  const settingsRef =
    doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

  unsubscribeSettings =
    onSnapshot(
      settingsRef,
      snapshot => {

        if (snapshot.exists()) {

          const data =
            snapshot.data();

          accountSettings = {

            startingBalance:
              Number(
                data.startingBalance
              ) || 0,

            currency:
              data.currency || "$"

          };

        }

        else {

          accountSettings = {
            startingBalance: 0,
            currency: "$"
          };

        }

        document.getElementById(
          "startingBalance"
        ).value =
          accountSettings.startingBalance ||
          "";

        document.getElementById(
          "currency"
        ).value =
          accountSettings.currency;

        calculateRiskAmount();

        updateDashboard();

      },

      error => {

        console.error(
          "SETTINGS ERROR:",
          error
        );

      }
    );

}


// =====================================================
// LOAD TRADES
// =====================================================

function loadTrades() {

  if (!currentUser) return;

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

        allTrades = [];

        snapshot.forEach(
          item => {

            allTrades.push({
              id: item.id,
              ...item.data()
            });

          }
        );

        allTrades.sort(
          (a, b) => {

            const A =
              `${a.date || ""} ${a.time || ""}`;

            const B =
              `${b.date || ""} ${b.time || ""}`;

            return B.localeCompare(A);

          }
        );

        renderTrades();

        updateSetupFilter();

        updateDashboard();

        updateAnalytics();

        updateWeeklyStats();

        updateMonthlyStats();

        updateEquityCurve();

      },

      error => {

        console.error(
          "FIRESTORE ERROR:",
          error
        );

        showToast(
          "Could not load trades. Check Firestore rules.",
          "error"
        );

      }

    );

}


// =====================================================
// MODAL
// =====================================================

addTradeBtn.addEventListener(
  "click",
  () => {

    openTradeModal();

  }
);


closeTradeModal.addEventListener(
  "click",
  closeModal
);


cancelTradeBtn.addEventListener(
  "click",
  closeModal
);


tradeModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      tradeModal
    ) {

      closeModal();

    }

  }
);


function openTradeModal(trade = null) {

  tradeModal.style.display =
    "block";

  tradeForm.reset();

  document.getElementById(
    "tradeId"
  ).value =
    trade?.id || "";

  document.getElementById(
    "modalTitle"
  ).textContent =
    trade
      ? "Edit Trade"
      : "Add Trade";

  saveTradeBtn.textContent =
    trade
      ? "Update Trade"
      : "Save Trade";

  if (trade) {

    setField(
      "tradeDate",
      trade.date
    );

    setField(
      "tradeTime",
      trade.time
    );

    setField(
      "pair",
      trade.pair
    );

    setField(
      "direction",
      trade.direction
    );

    setField(
      "entry",
      trade.entry
    );

    setField(
      "sl",
      trade.sl
    );

    setField(
      "tp",
      trade.tp
    );

    setField(
      "riskPercent",
      trade.riskPercent
    );

    setField(
      "riskAmount",
      trade.riskAmount
    );

    setField(
      "lotSize",
      trade.lotSize
    );

    setField(
      "setup",
      trade.setup
    );

    setField(
      "session",
      trade.session
    );

    setField(
      "htfBias",
      trade.htfBias
    );

    setField(
      "liquidity",
      trade.liquidity
    );

    setField(
      "confirmation",
      trade.confirmation
    );

    setField(
      "result",
      trade.result
    );

    setField(
      "profit",
      trade.profit
    );

    setField(
      "psychology",
      trade.psychology
    );

    setField(
      "confidence",
      trade.confidence
    );

    setField(
      "mistake",
      trade.mistake
    );

    setField(
      "notes",
      trade.notes
    );

    calculateRR();

  }

  else {

    document.getElementById(
      "tradeDate"
    ).value =
      getToday();

  }

}


function closeModal() {

  tradeModal.style.display =
    "none";

}


// =====================================================
// R:R
// =====================================================

[
  "entry",
  "sl",
  "tp"
].forEach(
  id => {

    document.getElementById(id)
      .addEventListener(
        "input",
        calculateRR
      );

  }
);


function calculateRR() {

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

  document.getElementById(
    "rr"
  ).value =
    rr > 0
      ? rr.toFixed(2)
      : "";

}


// =====================================================
// RISK
// =====================================================

document
  .getElementById(
    "riskPercent"
  )
  .addEventListener(
    "input",
    calculateRiskAmount
  );


function calculateRiskAmount() {

  const riskPercent =
    Number(
      document.getElementById(
        "riskPercent"
      ).value
    ) || 0;

  const amount =
    accountSettings.startingBalance *
    riskPercent /
    100;

  document.getElementById(
    "riskAmount"
  ).value =
    amount
      ? amount.toFixed(2)
      : "";

}


// =====================================================
// SAVE TRADE
// =====================================================

tradeForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!currentUser) {

      showToast(
        "Please login first.",
        "error"
      );

      return;

    }

    const tradeId =
      document.getElementById(
        "tradeId"
      ).value;


    const entry =
      Number(
        getField("entry")
      ) || 0;

    const sl =
      Number(
        getField("sl")
      ) || 0;

    const tp =
      Number(
        getField("tp")
      ) || 0;


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


    const riskPercent =
      Number(
        getField("riskPercent")
      ) || 0;


    const riskAmount =
      accountSettings.startingBalance *
      riskPercent /
      100;


    const trade = {

      date:
        getField("tradeDate"),

      time:
        getField("tradeTime"),

      pair:
        getField("pair"),

      direction:
        getField("direction"),

      entry,
      sl,
      tp,

      risk,
      reward,
      rr,

      riskPercent,

      riskAmount,

      lotSize:
        Number(
          getField("lotSize")
        ) || 0,

      setup:
        getField("setup"),

      session:
        getField("session"),

      htfBias:
        getField("htfBias"),

      liquidity:
        getField("liquidity"),

      confirmation:
        getField("confirmation"),

      result:
        getField("result"),

      profit:
        Number(
          getField("profit")
        ) || 0,

      psychology:
        getField("psychology"),

      confidence:
        Number(
          getField("confidence")
        ) || 0,

      mistake:
        getField("mistake"),

      notes:
        getField("notes"),

      updatedAt:
        serverTimestamp()

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

          trade

        );

        showToast(
          "Trade updated.",
          "success"
        );

      }

      else {

        await addDoc(

          collection(
            db,
            "users",
            currentUser.uid,
            "trades"
          ),

          {
            ...trade,
            createdAt:
              serverTimestamp()
          }

        );

        showToast(
          "Trade saved.",
          "success"
        );

      }

      closeModal();

    }

    catch (error) {

      console.error(
        "TRADE SAVE ERROR:",
        error
      );

      showToast(
        "Could not save trade.",
        "error"
      );

    }

  }
);


// =====================================================
// RENDER TRADES
// =====================================================

function renderTrades() {

  const body =
    document.getElementById(
      "tradeTableBody"
    );

  const search =
    document.getElementById(
      "tradeSearch"
    ).value
      .toLowerCase();

  const result =
    document.getElementById(
      "resultFilter"
    ).value;

  const direction =
    document.getElementById(
      "directionFilter"
    ).value;

  const setup =
    document.getElementById(
      "setupFilter"
    ).value;


  let trades =
    [...allTrades];


  if (search) {

    trades =
      trades.filter(
        trade => {

          const text =
            [
              trade.pair,
              trade.setup,
              trade.session,
              trade.result,
              trade.notes,
              trade.mistake
            ]
              .join(" ")
              .toLowerCase();

          return text.includes(
            search
          );

        }
      );

  }


  if (result) {

    trades =
      trades.filter(
        trade =>
          trade.result === result
      );

  }


  if (direction) {

    trades =
      trades.filter(
        trade =>
          trade.direction ===
          direction
      );

  }


  if (setup) {

    trades =
      trades.filter(
        trade =>
          trade.setup === setup
      );

  }


  body.innerHTML = "";


  if (!trades.length) {

    body.innerHTML = `
      <tr>
        <td colspan="10"
            class="empty-state">
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  trades.forEach(
    trade => {

      const profit =
        Number(
          trade.profit
        ) || 0;


      const row =
        document.createElement(
          "tr"
        );


      row.innerHTML = `

        <td>
          ${escapeHTML(
            trade.date || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            trade.pair || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            trade.direction || "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            trade.setup || "-"
          )}
        </td>

        <td>
          ${number(
            trade.entry
          )}
        </td>

        <td>
          ${number(
            trade.sl
          )}
        </td>

        <td>
          ${number(
            trade.tp
          )}
        </td>

        <td>
          ${number(
            trade.rr
          )}
        </td>

        <td class="${
          profit > 0
            ? "positive"
            : profit < 0
              ? "negative"
              : ""
        }">
          ${money(profit)}
        </td>

        <td>

          <button
            class="small-btn"
            onclick="editTrade('${trade.id}')">
            Edit
          </button>

          <button
            class="small-btn danger"
            onclick="deleteTrade('${trade.id}')">
            Delete
          </button>

        </td>

      `;


      body.appendChild(row);

    }
  );

}


// =====================================================
// SETUP FILTER
// =====================================================

function updateSetupFilter() {

  const select =
    document.getElementById(
      "setupFilter"
    );

  const current =
    select.value;

  const setups =
    [
      ...new Set(
        allTrades
          .map(
            trade =>
              trade.setup
          )
          .filter(Boolean)
      )
    ]
      .sort();


  select.innerHTML =
    `<option value="">
      All Setups
    </option>`;


  setups.forEach(
    setup => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        setup;

      option.textContent =
        setup;

      select.appendChild(
        option
      );

    }
  );


  select.value =
    current;

}


// =====================================================
// FILTER EVENTS
// =====================================================

[
  "tradeSearch",
  "resultFilter",
  "directionFilter",
  "setupFilter"
].forEach(
  id => {

    document
      .getElementById(id)
      .addEventListener(
        "input",
        renderTrades
      );

  }
);


// =====================================================
// DASHBOARD
// =====================================================

function updateDashboard() {

  const total =
    allTrades.length;


  const wins =
    allTrades.filter(
      t =>
        t.result === "Win"
    ).length;


  const losses =
    allTrades.filter(
      t =>
        t.result === "Loss"
    ).length;


  const winRate =
    total
      ? wins / total * 100
      : 0;


  const totalProfit =
    allTrades.reduce(
      (sum, trade) =>
        sum +
        (
          Number(
            trade.profit
          ) || 0
        ),
      0
    );


  const balance =
    accountSettings.startingBalance +
    totalProfit;


  const winning =
    allTrades
      .filter(
        t =>
          Number(t.profit) > 0
      )
      .map(
        t =>
          Number(t.profit)
      );


  const losing =
    allTrades
      .filter(
        t =>
          Number(t.profit) < 0
      )
      .map(
        t =>
          Math.abs(
            Number(t.profit)
          )
      );


  const grossProfit =
    winning.reduce(
      (a, b) => a + b,
      0
    );


  const grossLoss =
    losing.reduce(
      (a, b) => a + b,
      0
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit /
        grossLoss
      : 0;


  const averageWin =
    winning.length
      ? grossProfit /
        winning.length
      : 0;


  const averageLoss =
    losing.length
      ? grossLoss /
        losing.length
      : 0;


  const expectancy =
    total
      ? totalProfit / total
      : 0;


  const averageRR =
    total
      ? allTrades.reduce(
          (sum, trade) =>
            sum +
            (
              Number(
                trade.rr
              ) || 0
            ),
          0
        ) / total
      : 0;


  const drawdown =
    calculateDrawdown();


  setText(
    "totalTrades",
    total
  );

  setText(
    "winRate",
    winRate.toFixed(1) + "%"
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
    "totalProfit",
    money(totalProfit)
  );

  setText(
    "currentBalance",
    money(balance)
  );

  setText(
    "profitFactor",
    profitFactor
      ? profitFactor.toFixed(2)
      : "0.00"
  );

  setText(
    "expectancy",
    money(expectancy)
  );

  setText(
    "averageWin",
    money(averageWin)
  );

  setText(
    "averageLoss",
    money(-averageLoss)
  );

  setText(
    "maxDrawdown",
    money(-drawdown)
  );

  setText(
    "averageRR",
    averageRR.toFixed(2)
  );


  updateStreaks();

}


// =====================================================
// STREAKS
// =====================================================

function updateStreaks() {

  const trades =
    [...allTrades].sort(
      sortTrades
    );


  let current = 0;

  let best = 0;

  let worst = 0;

  let winStreak = 0;

  let lossStreak = 0;


  trades.forEach(
    trade => {

      if (
        trade.result ===
        "Win"
      ) {

        winStreak++;

        lossStreak = 0;

        best =
          Math.max(
            best,
            winStreak
          );

      }

      else if (
        trade.result ===
        "Loss"
      ) {

        lossStreak++;

        winStreak = 0;

        worst =
          Math.max(
            worst,
            lossStreak
          );

      }

    }
  );


  if (trades.length) {

    const last =
      trades[
        trades.length - 1
      ];

    const result =
      last.result;


    if (
      result === "Win" ||
      result === "Loss"
    ) {

      let count = 0;

      for (
        let i =
          trades.length - 1;
        i >= 0;
        i--
      ) {

        if (
          trades[i].result ===
          result
        ) {

          count++;

        }

        else {

          break;

        }

      }

      current =
        result === "Loss"
          ? -count
          : count;

    }

  }


  const average =
    allTrades.length
      ? allTrades.reduce(
          (sum, trade) =>
            sum +
            (
              Number(
                trade.profit
              ) || 0
            ),
          0
        ) /
        allTrades.length
      : 0;


  setText(
    "currentStreak",
    current
  );

  setText(
    "bestWinStreak",
    best
  );

  setText(
    "worstLossStreak",
    worst
  );

  setText(
    "averagePL",
    money(average)
  );

}


// =====================================================
// DRAWDOWN
// =====================================================

function calculateDrawdown() {

  let equity = 0;

  let peak = 0;

  let max = 0;


  const trades =
    [...allTrades].sort(
      sortTrades
    );


  trades.forEach(
    trade => {

      equity +=
        Number(
          trade.profit
        ) || 0;

      peak =
        Math.max(
          peak,
          equity
        );

      max =
        Math.max(
          max,
          peak - equity
        );

    }
  );


  return max;

}


// =====================================================
// ANALYTICS
// =====================================================

function updateAnalytics() {

  updateSetupAnalytics();

  updateMistakeAnalytics();

}


function updateSetupAnalytics() {

  const container =
    document.getElementById(
      "setupAnalytics"
    );


  const data = {};


  allTrades.forEach(
    trade => {

      const setup =
        trade.setup ||
        "Unknown";


      if (!data[setup]) {

        data[setup] = {
          trades: 0,
          wins: 0,
          profit: 0
        };

      }


      data[setup].trades++;

      data[setup].profit +=
        Number(
          trade.profit
        ) || 0;


      if (
        trade.result ===
        "Win"
      ) {

        data[setup].wins++;

      }

    }
  );


  const entries =
    Object.entries(data);


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">
        No setup data yet.
      </div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([setup, value]) => {

        const winRate =
          value.trades
            ? value.wins /
              value.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <div>
              <strong>
                ${escapeHTML(setup)}
              </strong>

              <small>
                ${value.trades} trades
              </small>
            </div>

            <div>
              ${winRate.toFixed(1)}%
            </div>

            <div class="${
              value.profit >= 0
                ? "positive"
                : "negative"
            }">

              ${money(value.profit)}

            </div>

          </div>

        `;

      }
    ).join("");

}


function updateMistakeAnalytics() {

  const container =
    document.getElementById(
      "mistakeAnalytics"
    );


  const data = {};


  allTrades.forEach(
    trade => {

      const mistake =
        trade.mistake ||
        "No Mistake";


      if (!data[mistake]) {

        data[mistake] = {
          count: 0,
          profit: 0
        };

      }


      data[mistake].count++;

      data[mistake].profit +=
        Number(
          trade.profit
        ) || 0;

    }
  );


  const entries =
    Object.entries(data);


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">
        No mistake data yet.
      </div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([mistake, value]) => `

        <div class="analytics-row">

          <div>
            <strong>
              ${escapeHTML(mistake)}
            </strong>
          </div>

          <div>
            ${value.count}
          </div>

          <div class="${
            value.profit >= 0
              ? "positive"
              : "negative"
          }">

            ${money(value.profit)}

          </div>

        </div>

      `
    ).join("");

}


// =====================================================
// WEEKLY
// =====================================================

function updateWeeklyStats() {

  const container =
    document.getElementById(
      "weeklyStats"
    );


  const weeks = {};


  allTrades.forEach(
    trade => {

      if (!trade.date) return;


      const date =
        new Date(
          trade.date +
          "T00:00:00"
        );


      const key =
        getWeekKey(date);


      if (!weeks[key]) {

        weeks[key] = {
          trades: 0,
          wins: 0,
          profit: 0
        };

      }


      weeks[key].trades++;

      weeks[key].profit +=
        Number(
          trade.profit
        ) || 0;


      if (
        trade.result ===
        "Win"
      ) {

        weeks[key].wins++;

      }

    }
  );


  const entries =
    Object.entries(
      weeks
    ).sort(
      (a, b) =>
        b[0].localeCompare(
          a[0]
        )
    );


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">
        No weekly data yet.
      </div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([week, value]) => {

        const rate =
          value.trades
            ? value.wins /
              value.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <div>
              <strong>
                ${week}
              </strong>
            </div>

            <div>
              ${value.trades}
            </div>

            <div>
              ${rate.toFixed(1)}%
            </div>

            <div class="${
              value.profit >= 0
                ? "positive"
                : "negative"
            }">

              ${money(value.profit)}

            </div>

          </div>

        `;

      }
    ).join("");

}


// =====================================================
// MONTHLY
// =====================================================

function updateMonthlyStats() {

  const container =
    document.getElementById(
      "monthlyStats"
    );


  const months = {};


  allTrades.forEach(
    trade => {

      if (!trade.date) return;


      const key =
        trade.date.substring(
          0,
          7
        );


      if (!months[key]) {

        months[key] = {
          trades: 0,
          wins: 0,
          profit: 0
        };

      }


      months[key].trades++;

      months[key].profit +=
        Number(
          trade.profit
        ) || 0;


      if (
        trade.result ===
        "Win"
      ) {

        months[key].wins++;

      }

    }
  );


  const entries =
    Object.entries(
      months
    ).sort(
      (a, b) =>
        b[0].localeCompare(
          a[0]
        )
    );


  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">
        No monthly data yet.
      </div>`;

    return;

  }


  container.innerHTML =
    entries.map(
      ([month, value]) => {

        const rate =
          value.trades
            ? value.wins /
              value.trades *
              100
            : 0;


        return `

          <div class="analytics-row">

            <div>
              <strong>
                ${month}
              </strong>
            </div>

            <div>
              ${value.trades}
            </div>

            <div>
              ${rate.toFixed(1)}%
            </div>

            <div class="${
              value.profit >= 0
                ? "positive"
                : "negative"
            }">

              ${money(value.profit)}

            </div>

          </div>

        `;

      }
    ).join("");

}


// =====================================================
// EQUITY CURVE
// =====================================================

function updateEquityCurve() {

  const canvas =
    document.getElementById(
      "equityCurve"
    );


  const ctx =
    canvas.getContext(
      "2d"
    );


  const width =
    canvas.clientWidth || 700;

  const height =
    canvas.clientHeight || 300;


  const ratio =
    window.devicePixelRatio || 1;


  canvas.width =
    width * ratio;

  canvas.height =
    height * ratio;


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const trades =
    [...allTrades].sort(
      sortTrades
    );


  if (!trades.length) {

    ctx.fillStyle =
      "#8b98aa";

    ctx.font =
      "14px Arial";

    ctx.fillText(
      "No trade data yet.",
      20,
      30
    );

    return;

  }


  let equity =
    accountSettings.startingBalance;


  const values =
    [equity];


  trades.forEach(
    trade => {

      equity +=
        Number(
          trade.profit
        ) || 0;

      values.push(
        equity
      );

    }
  );


  const min =
    Math.min(
      ...values
    );

  const max =
    Math.max(
      ...values
    );


  const range =
    max - min || 1;


  const padding = 35;


  ctx.beginPath();


  values.forEach(
    (value, index) => {

      const x =
        padding +
        index *
        (
          (
            width -
            padding * 2
          ) /
          Math.max(
            values.length - 1,
            1
          )
        );


      const y =
        height -
        padding -
        (
          (
            value - min
          ) /
          range
        ) *
        (
          height -
          padding * 2
        );


      if (index === 0) {

        ctx.moveTo(
          x,
          y
        );

      }

      else {

        ctx.lineTo(
          x,
          y
        );

      }

    }
  );


  ctx.strokeStyle =
    "#24d18a";

  ctx.lineWidth = 2;

  ctx.stroke();

}


// =====================================================
// CSV
// =====================================================

document
  .getElementById(
    "exportCsvBtn"
  )
  .addEventListener(
    "click",
    exportCSV
  );


function exportCSV() {

  if (!allTrades.length) {

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
    "Psychology",
    "Confidence",
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
        trade.riskPercent,
        trade.riskAmount,
        trade.lotSize,
        trade.setup,
        trade.session,
        trade.htfBias,
        trade.liquidity,
        trade.confirmation,
        trade.result,
        trade.profit,
        trade.psychology,
        trade.confidence,
        trade.mistake,
        trade.notes

      ]
    );


  const csv =
    [
      headers,
      ...rows
    ]
      .map(
        row =>
          row
            .map(
              csvEscape
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
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href = url;

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

}


// =====================================================
// DELETE
// =====================================================

async function deleteTrade(id) {

  if (!currentUser) return;


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
        id
      )

    );

    showToast(
      "Trade deleted.",
      "success"
    );

  }

  catch (error) {

    console.error(
      error
    );

    showToast(
      "Could not delete trade.",
      "error"
    );

  }

}


// =====================================================
// EDIT
// =====================================================

function editTrade(id) {

  const trade =
    allTrades.find(
      t =>
        t.id === id
    );


  if (!trade) return;


  openTradeModal(
    trade
  );

}


// =====================================================
// HELPERS
// =====================================================

function getField(id) {

  return (
    document.getElementById(id)
      ?.value || ""
  );

}


function setField(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );

  if (
    element &&
    value !== undefined &&
    value !== null
  ) {

    element.value =
      value;

  }

}


function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );

  if (element) {

    element.textContent =
      value;

  }

}


function number(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n.toFixed(2)
    : "-";

}


function money(value) {

  const n =
    Number(value) || 0;

  return (
    accountSettings.currency ||
    "$"
  ) +
    n.toFixed(2);

}


function getToday() {

  const d =
    new Date();

  const year =
    d.getFullYear();

  const month =
    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    year +
    "-" +
    month +
    "-" +
    day
  );

}


function sortTrades(
  a,
  b
) {

  const A =
    `${a.date || ""} ${a.time || ""}`;

  const B =
    `${b.date || ""} ${b.time || ""}`;

  return A.localeCompare(
    B
  );

}


function getWeekKey(
  date
) {

  const d =
    new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    );


  const day =
    d.getUTCDay() || 7;


  d.setUTCDate(
    d.getUTCDate() +
    4 -
    day
  );


  const year =
    d.getUTCFullYear();


  const first =
    new Date(
      Date.UTC(
        year,
        0,
        1
      )
    );


  const week =
    Math.ceil(
      (
        (
          d - first
        ) /
        86400000 +
        1
      ) / 7
    );


  return (
    year +
    "-W" +
    String(
      week
    ).padStart(
      2,
      "0"
    )
  );

}


function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
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


function csvEscape(
  value
) {

  const text =
    String(
      value ?? ""
    );


  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {

    return (
      '"' +
      text.replace(
        /"/g,
        '""'
      ) +
      '"'
    );

  }


  return text;

}


// =====================================================
// TOAST
// =====================================================

function showToast(
  message,
  type
) {

  const toast =
    document.getElementById(
      "toast"
    );


  toast.textContent =
    message;


  toast.className =
    type || "";


  toast.classList.add(
    "show"
  );


  setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );

    },
    3000
  );

}


// =====================================================
// GLOBAL
// =====================================================

window.editTrade =
  editTrade;

window.deleteTrade =
  deleteTrade;


// =====================================================
// RESIZE
// =====================================================

window.addEventListener(
  "resize",
  updateEquityCurve
);


console.log(
  "UjR Fx Journal loaded."
);
