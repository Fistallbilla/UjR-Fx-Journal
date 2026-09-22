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


/* ==============================
   FIREBASE CONFIG
============================== */

const firebaseConfig = {
  apiKey: "AIzaSyAdCB2Vke4iXLm1zPj43cNQwC65gZlQ6Ns",
  authDomain: "journal-38e0e.firebaseapp.com",
  projectId: "journal-38e0e",
  storageBucket: "journal-38e0e.firebasestorage.app",
  messagingSenderId: "382226906837",
  appId: "1:382226906837:web:38df881c0f7beb24256c5c",
  measurementId: "G-R6LXDMQ9K2"
};


/* ==============================
   INITIALIZE FIREBASE
============================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});


/* ==============================
   VARIABLES
============================== */

let currentUser = null;
let account = {
  startingBalance: 0,
  currency: "USD"
};

let trades = [];
let unsubscribeTrades = null;


/* ==============================
   ELEMENTS
============================== */

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const loginError = document.getElementById("loginError");

const logoutBtn = document.getElementById("logoutBtn");

const userName = document.getElementById("userName");
const welcomeName = document.getElementById("welcomeName");
const userPhoto = document.getElementById("userPhoto");

const startingBalance = document.getElementById("startingBalance");
const currency = document.getElementById("currency");
const saveAccountBtn = document.getElementById("saveAccountBtn");

const addTradeBtn = document.getElementById("addTradeBtn");
const tradeModal = document.getElementById("tradeModal");
const closeModal = document.getElementById("closeModal");
const tradeForm = document.getElementById("tradeForm");

const tradeTableBody = document.getElementById("tradeTableBody");

const tradeSearch = document.getElementById("tradeSearch");
const resultFilter = document.getElementById("resultFilter");
const directionFilter = document.getElementById("directionFilter");
const setupFilter = document.getElementById("setupFilter");

const exportCSV = document.getElementById("exportCSV");


/* ==============================
   HELPER
============================== */

function showToast(message) {

  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


function money(value) {

  const number = Number(value) || 0;

  return `${account.currency} ${number.toFixed(2)}`;
}


function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ==============================
   GOOGLE LOGIN
============================== */

googleLoginBtn.addEventListener("click", async () => {

  loginError.textContent = "";

  googleLoginBtn.disabled = true;
  googleLoginBtn.textContent = "Opening Google...";

  try {

    await signInWithPopup(auth, provider);

  } catch (error) {

    console.error("GOOGLE LOGIN ERROR:", error);

    let message = "Google login failed.";

    if (error.code === "auth/popup-closed-by-user") {
      message = "Google login window was closed.";
    }

    else if (error.code === "auth/popup-blocked") {
      message = "Popup was blocked. Allow popups for this website.";
    }

    else if (error.code === "auth/unauthorized-domain") {
      message = "This website domain is not authorized in Firebase.";
    }

    else if (error.code === "auth/operation-not-allowed") {
      message = "Google Sign-In is not enabled in Firebase Authentication.";
    }

    else if (error.code === "auth/network-request-failed") {
      message = "Network error. Check your internet connection.";
    }

    else {
      message = `${error.code || "Unknown error"}: ${error.message || ""}`;
    }

    loginError.textContent = message;

    googleLoginBtn.disabled = false;
    googleLoginBtn.innerHTML = "<span>G</span> Continue with Google";
  }
});


/* ==============================
   LOGOUT
============================== */

logoutBtn.addEventListener("click", async () => {

  try {

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    await signOut(auth);

  } catch (error) {

    console.error("LOGOUT ERROR:", error);
    showToast("Logout failed.");

  }
});


/* ==============================
   AUTH STATE
============================== */

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;

    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    userName.textContent = user.displayName || "Trader";
    welcomeName.textContent = user.displayName || "Trader";

    if (user.photoURL) {
      userPhoto.src = user.photoURL;
    } else {
      userPhoto.src =
        "https://ui-avatars.com/api/?name=Trader";
    }

    googleLoginBtn.disabled = false;
    googleLoginBtn.innerHTML =
      "<span>G</span> Continue with Google";

    await loadAccount();

    loadTrades();

  } else {

    currentUser = null;

    appScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    googleLoginBtn.disabled = false;
    googleLoginBtn.innerHTML =
      "<span>G</span> Continue with Google";

  }

});


/* ==============================
   ACCOUNT
============================== */

async function loadAccount() {

  if (!currentUser) return;

  try {

    const ref = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {

      account = {
        startingBalance:
          Number(snapshot.data().startingBalance) || 0,

        currency:
          snapshot.data().currency || "USD"
      };

    }

    startingBalance.value = account.startingBalance;
    currency.value = account.currency;

    updateDashboard();

  } catch (error) {

    console.error("LOAD ACCOUNT ERROR:", error);

    showToast("Could not load account settings.");

  }
}


/* ==============================
   SAVE ACCOUNT
============================== */

saveAccountBtn.addEventListener("click", async () => {

  if (!currentUser) {

    showToast("Please login first.");
    return;

  }

  const balance = Number(startingBalance.value);
  const selectedCurrency = currency.value;

  if (!Number.isFinite(balance) || balance < 0) {

    showToast("Enter a valid starting balance.");
    return;

  }

  saveAccountBtn.disabled = true;
  saveAccountBtn.textContent = "Saving...";

  try {

    const ref = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "account"
    );

    await setDoc(
      ref,
      {
        startingBalance: balance,
        currency: selectedCurrency,
        updatedAt: new Date().toISOString()
      },
      {
        merge: true
      }
    );

    account = {
      startingBalance: balance,
      currency: selectedCurrency
    };

    updateDashboard();

    showToast("Account saved successfully.");

  } catch (error) {

    console.error("SAVE ACCOUNT ERROR:", error);

    if (error.code === "permission-denied") {

      showToast(
        "Permission denied. Check Firestore Rules."
      );

    } else if (error.code === "failed-precondition") {

      showToast(
        "Firestore is not ready. Check Firebase Firestore."
      );

    } else {

      showToast(
        `Save failed: ${error.message || "Unknown error"}`
      );

    }

  } finally {

    saveAccountBtn.disabled = false;
    saveAccountBtn.textContent = "Save Account";

  }

});


/* ==============================
   LOAD TRADES
============================== */

function loadTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
  }

  const tradesRef = collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );

  const q = query(
    tradesRef,
    orderBy("createdAt", "desc")
  );

  unsubscribeTrades = onSnapshot(
    q,
    (snapshot) => {

      trades = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...docItem.data()
      }));

      updateSetupFilter();
      renderTrades();
      updateDashboard();

    },
    (error) => {

      console.error("TRADES ERROR:", error);

      showToast(
        `Trade loading error: ${error.message}`
      );

    }
  );
}


/* ==============================
   MODAL
============================== */

addTradeBtn.addEventListener("click", () => {

  tradeForm.reset();

  document.getElementById("tradeId").value = "";

  document.getElementById("tradeDate").value =
    new Date().toISOString().split("T")[0];

  document.getElementById("pair").value = "XAUUSD";

  document.getElementById("riskPercent").value = 1;

  document.getElementById("result").value = "Win";

  document.getElementById("modalTitle").textContent =
    "Add Trade";

  tradeModal.classList.remove("hidden");

});


closeModal.addEventListener("click", () => {

  tradeModal.classList.add("hidden");

});


tradeModal.addEventListener("click", (event) => {

  if (event.target === tradeModal) {
    tradeModal.classList.add("hidden");
  }

});


/* ==============================
   AUTO RR
============================== */

function calculateRR() {

  const entry = Number(
    document.getElementById("entry").value
  );

  const sl = Number(
    document.getElementById("sl").value
  );

  const tp = Number(
    document.getElementById("tp").value
  );

  const direction =
    document.getElementById("direction").value;

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(sl) ||
    !Number.isFinite(tp)
  ) {

    document.getElementById("rr").value = "";
    return;

  }

  let risk;
  let reward;

  if (direction === "Buy") {

    risk = entry - sl;
    reward = tp - entry;

  } else {

    risk = sl - entry;
    reward = entry - tp;

  }

  if (risk > 0 && reward > 0) {

    document.getElementById("rr").value =
      (reward / risk).toFixed(2);

  } else {

    document.getElementById("rr").value = "";

  }

}


["entry", "sl", "tp", "direction"].forEach(id => {

  document.getElementById(id)
    .addEventListener("input", calculateRR);

});


/* ==============================
   SAVE TRADE
============================== */

tradeForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!currentUser) {

    showToast("Please login first.");
    return;

  }

  const tradeId =
    document.getElementById("tradeId").value;

  const trade = {

    date:
      document.getElementById("tradeDate").value,

    time:
      document.getElementById("tradeTime").value,

    pair:
      document.getElementById("pair").value.trim(),

    direction:
      document.getElementById("direction").value,

    entry:
      Number(document.getElementById("entry").value) || 0,

    sl:
      Number(document.getElementById("sl").value) || 0,

    tp:
      Number(document.getElementById("tp").value) || 0,

    rr:
      Number(document.getElementById("rr").value) || 0,

    riskPercent:
      Number(document.getElementById("riskPercent").value) || 0,

    riskAmount:
      Number(document.getElementById("riskAmount").value) || 0,

    lotSize:
      Number(document.getElementById("lotSize").value) || 0,

    setup:
      document.getElementById("setup").value.trim(),

    session:
      document.getElementById("session").value,

    htfBias:
      document.getElementById("htfBias").value,

    liquidity:
      document.getElementById("liquidity").value.trim(),

    confirmation:
      document.getElementById("confirmation").value.trim(),

    result:
      document.getElementById("result").value,

    profitLoss:
      Number(document.getElementById("profitLoss").value) || 0,

    psychology:
      document.getElementById("psychology").value.trim(),

    confidence:
      Number(document.getElementById("confidence").value) || 0,

    mistake:
      document.getElementById("mistake").value.trim(),

    notes:
      document.getElementById("notes").value.trim(),

    updatedAt:
      new Date().toISOString()

  };


  try {

    if (tradeId) {

      const ref = doc(
        db,
        "users",
        currentUser.uid,
        "trades",
        tradeId
      );

      await updateDoc(ref, trade);

      showToast("Trade updated.");

    } else {

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
            new Date().toISOString()
        }
      );

      showToast("Trade saved.");

    }

    tradeModal.classList.add("hidden");

  } catch (error) {

    console.error("SAVE TRADE ERROR:", error);

    showToast(
      `Trade save failed: ${error.message}`
    );

  }

});


/* ==============================
   RENDER TRADES
============================== */

function getFilteredTrades() {

  const search =
    tradeSearch.value.toLowerCase().trim();

  const result =
    resultFilter.value;

  const direction =
    directionFilter.value;

  const setup =
    setupFilter.value;


  return trades.filter(trade => {

    const searchText = [
      trade.pair,
      trade.setup,
      trade.notes,
      trade.mistake
    ]
      .join(" ")
      .toLowerCase();


    const matchesSearch =
      !search || searchText.includes(search);

    const matchesResult =
      result === "all" || trade.result === result;

    const matchesDirection =
      direction === "all" ||
      trade.direction === direction;

    const matchesSetup =
      setup === "all" ||
      trade.setup === setup;

    return (
      matchesSearch &&
      matchesResult &&
      matchesDirection &&
      matchesSetup
    );

  });

}


function renderTrades() {

  const filtered = getFilteredTrades();

  if (!filtered.length) {

    tradeTableBody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;padding:30px;">
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  tradeTableBody.innerHTML =
    filtered.map(trade => {

      const pl =
        Number(trade.profitLoss) || 0;

      const plClass =
        pl > 0
          ? "profit"
          : pl < 0
            ? "loss"
            : "";


      return `
        <tr>

          <td>${escapeHTML(trade.date)}</td>

          <td>${escapeHTML(trade.pair)}</td>

          <td>${escapeHTML(trade.direction)}</td>

          <td>${trade.entry || "-"}</td>

          <td>${trade.sl || "-"}</td>

          <td>${trade.tp || "-"}</td>

          <td>${trade.rr ? trade.rr.toFixed(2) : "-"}</td>

          <td>${escapeHTML(trade.result)}</td>

          <td class="${plClass}">
            ${money(pl)}
          </td>

          <td>${escapeHTML(trade.setup || "-")}</td>

          <td>

            <button
              class="action-btn"
              onclick="editTrade('${trade.id}')">
              Edit
            </button>

            <button
              class="action-btn delete-btn"
              onclick="deleteTrade('${trade.id}')">
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


/* ==============================
   EDIT TRADE
============================== */

window.editTrade = function(id) {

  const trade =
    trades.find(item => item.id === id);

  if (!trade) return;


  document.getElementById("tradeId").value =
    trade.id;

  document.getElementById("tradeDate").value =
    trade.date || "";

  document.getElementById("tradeTime").value =
    trade.time || "";

  document.getElementById("pair").value =
    trade.pair || "XAUUSD";

  document.getElementById("direction").value =
    trade.direction || "Buy";

  document.getElementById("entry").value =
    trade.entry || "";

  document.getElementById("sl").value =
    trade.sl || "";

  document.getElementById("tp").value =
    trade.tp || "";

  document.getElementById("rr").value =
    trade.rr || "";

  document.getElementById("riskPercent").value =
    trade.riskPercent || "";

  document.getElementById("riskAmount").value =
    trade.riskAmount || "";

  document.getElementById("lotSize").value =
    trade.lotSize || "";

  document.getElementById("setup").value =
    trade.setup || "";

  document.getElementById("session").value =
    trade.session || "";

  document.getElementById("htfBias").value =
    trade.htfBias || "";

  document.getElementById("liquidity").value =
    trade.liquidity || "";

  document.getElementById("confirmation").value =
    trade.confirmation || "";

  document.getElementById("result").value =
    trade.result || "Win";

  document.getElementById("profitLoss").value =
    trade.profitLoss || 0;

  document.getElementById("psychology").value =
    trade.psychology || "";

  document.getElementById("confidence").value =
    trade.confidence || "";

  document.getElementById("mistake").value =
    trade.mistake || "";

  document.getElementById("notes").value =
    trade.notes || "";


  document.getElementById("modalTitle").textContent =
    "Edit Trade";

  tradeModal.classList.remove("hidden");

};


/* ==============================
   DELETE TRADE
============================== */

window.deleteTrade = async function(id) {

  if (!currentUser) return;

  const confirmed =
    confirm("Delete this trade?");

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

    showToast("Trade deleted.");

  } catch (error) {

    console.error("DELETE ERROR:", error);

    showToast(
      `Delete failed: ${error.message}`
    );

  }

};


/* ==============================
   FILTERS
============================== */

tradeSearch.addEventListener(
  "input",
  renderTrades
);

resultFilter.addEventListener(
  "change",
  renderTrades
);

directionFilter.addEventListener(
  "change",
  renderTrades
);

setupFilter.addEventListener(
  "change",
  renderTrades
);


function updateSetupFilter() {

  const current =
    setupFilter.value;

  const setups =
    [...new Set(
      trades
        .map(t => t.setup)
        .filter(Boolean)
    )]
      .sort();


  setupFilter.innerHTML =
    `<option value="all">All Setups</option>` +
    setups
      .map(setup =>
        `<option value="${escapeHTML(setup)}">
          ${escapeHTML(setup)}
        </option>`
      )
      .join("");


  if (
    setups.includes(current)
  ) {

    setupFilter.value = current;

  }

}


/* ==============================
   DASHBOARD
============================== */

function updateDashboard() {

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
    total
      ? (wins / total) * 100
      : 0;


  const netPL =
    trades.reduce(
      (sum, trade) =>
        sum + (Number(trade.profitLoss) || 0),
      0
    );


  const currentBalance =
    Number(account.startingBalance || 0)
    + netPL;


  const winningPL =
    trades
      .filter(t => Number(t.profitLoss) > 0)
      .reduce(
        (sum, t) =>
          sum + Number(t.profitLoss),
        0
      );


  const losingPL =
    Math.abs(
      trades
        .filter(t => Number(t.profitLoss) < 0)
        .reduce(
          (sum, t) =>
            sum + Number(t.profitLoss),
          0
        )
    );


  const profitFactor =
    losingPL > 0
      ? winningPL / losingPL
      : winningPL > 0
        ? Infinity
        : 0;


  const expectancy =
    total
      ? netPL / total
      : 0;


  const averageRR =
    total
      ? trades.reduce(
          (sum, t) =>
            sum + (Number(t.rr) || 0),
          0
        ) / total
      : 0;


  const winningTrades =
    trades.filter(
      t => Number(t.profitLoss) > 0
    );

  const losingTrades =
    trades.filter(
      t => Number(t.profitLoss) < 0
    );


  const averageWin =
    winningTrades.length
      ? winningPL / winningTrades.length
      : 0;


  const averageLoss =
    losingTrades.length
      ? -losingPL / losingTrades.length
      : 0;


  const drawdown =
    calculateMaxDrawdown();


  document.getElementById("totalTrades").textContent =
    total;

  document.getElementById("winRate").textContent =
    `${winRate.toFixed(1)}%`;

  document.getElementById("wins").textContent =
    wins;

  document.getElementById("losses").textContent =
    losses;

  document.getElementById("totalProfit").textContent =
    money(netPL);

  document.getElementById("currentBalance").textContent =
    money(currentBalance);

  document.getElementById("profitFactor").textContent =
    Number.isFinite(profitFactor)
      ? profitFactor.toFixed(2)
      : "∞";

  document.getElementById("expectancy").textContent =
    money(expectancy);

  document.getElementById("averageRR").textContent =
    averageRR.toFixed(2);

  document.getElementById("averageWin").textContent =
    money(averageWin);

  document.getElementById("averageLoss").textContent =
    money(averageLoss);

  document.getElementById("maxDrawdown").textContent =
    money(drawdown);


  updateStreaks();
  updateEquityCurve();
  updateSetupAnalytics();
  updateMistakeAnalytics();

}


/* ==============================
   DRAWDOWN
============================== */

function calculateMaxDrawdown() {

  let balance =
    Number(account.startingBalance) || 0;

  let peak = balance;
  let maxDD = 0;


  const ordered =
    [...trades].sort(
      (a, b) =>
        new Date(
          `${a.date || ""} ${a.time || ""}`
        ) -
        new Date(
          `${b.date || ""} ${b.time || ""}`
        )
    );


  for (const trade of ordered) {

    balance +=
      Number(trade.profitLoss) || 0;

    if (balance > peak) {
      peak = balance;
    }

    const dd =
      peak - balance;

    if (dd > maxDD) {
      maxDD = dd;
    }

  }

  return maxDD;
}


/* ==============================
   STREAKS
============================== */

function updateStreaks() {

  const ordered =
    [...trades].sort(
      (a, b) =>
        new Date(
          `${a.date || ""} ${a.time || ""}`
        ) -
        new Date(
          `${b.date || ""} ${b.time || ""}`
        )
    );


  let current = 0;
  let best = 0;
  let worst = 0;

  let winStreak = 0;
  let lossStreak = 0;


  for (const trade of ordered) {

    if (trade.result === "Win") {

      winStreak++;
      lossStreak = 0;

      best =
        Math.max(best, winStreak);

    }

    else if (trade.result === "Loss") {

      lossStreak++;
      winStreak = 0;

      worst =
        Math.max(worst, lossStreak);

    }

  }


  for (
    let i = ordered.length - 1;
    i >= 0;
    i--
  ) {

    if (ordered[i].result === "Win") {
      current++;
    } else {
      break;
    }

  }


  if (
    ordered.length &&
    ordered[ordered.length - 1].result === "Loss"
  ) {

    current = 0;

    for (
      let i = ordered.length - 1;
      i >= 0;
      i--
    ) {

      if (ordered[i].result === "Loss") {
        current--;
      } else {
        break;
      }

    }

  }


  document.getElementById("currentStreak").textContent =
    current;

  document.getElementById("bestWinStreak").textContent =
    best;

  document.getElementById("worstLossStreak").textContent =
    worst;

}


/* ==============================
   EQUITY CURVE
============================== */

function updateEquityCurve() {

  const canvas =
    document.getElementById("equityCurve");

  const ctx =
    canvas.getContext("2d");


  const width =
    canvas.clientWidth || 800;

  const height =
    320;


  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;

  ctx.scale(dpr, dpr);

  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const ordered =
    [...trades].sort(
      (a, b) =>
        new Date(
          `${a.date || ""} ${a.time || ""}`
        ) -
        new Date(
          `${b.date || ""} ${b.time || ""}`
        )
    );


  let balance =
    Number(account.startingBalance) || 0;


  const points = [
    balance
  ];


  ordered.forEach(trade => {

    balance +=
      Number(trade.profitLoss) || 0;

    points.push(balance);

  });


  if (points.length < 2) {

    ctx.fillStyle = "#8b98aa";
    ctx.font = "14px Arial";

    ctx.fillText(
      "Add trades to see your equity curve.",
      20,
      40
    );

    return;

  }


  const min =
    Math.min(...points);

  const max =
    Math.max(...points);

  const range =
    max - min || 1;


  ctx.beginPath();


  points.forEach((value, index) => {

    const x =
      20 +
      (index / (points.length - 1))
      * (width - 40);


    const y =
      height -
      25 -
      ((value - min) / range)
      * (height - 50);


    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

  });


  ctx.strokeStyle = "#5b8cff";
  ctx.lineWidth = 3;
  ctx.stroke();

}


/* ==============================
   SETUP ANALYTICS
============================== */

function updateSetupAnalytics() {

  const box =
    document.getElementById("setupAnalytics");


  const map = {};


  trades.forEach(trade => {

    const setup =
      trade.setup || "No Setup";

    if (!map[setup]) {

      map[setup] = {
        trades: 0,
        wins: 0,
        pl: 0
      };

    }


    map[setup].trades++;

    if (trade.result === "Win") {
      map[setup].wins++;
    }

    map[setup].pl +=
      Number(trade.profitLoss) || 0;

  });


  const entries =
    Object.entries(map);


  if (!entries.length) {

    box.innerHTML =
      `<p class="muted">No setup data yet.</p>`;

    return;

  }


  box.innerHTML =
    entries.map(
      ([setup, data]) => {

        const rate =
          data.trades
            ? (data.wins / data.trades) * 100
            : 0;

        return `
          <div class="analytics-row">

            <span>
              ${escapeHTML(setup)}
            </span>

            <span>
              ${rate.toFixed(0)}%
              ·
              ${money(data.pl)}
            </span>

          </div>
        `;

      }
    ).join("");

}


/* ==============================
   MISTAKE ANALYTICS
============================== */

function updateMistakeAnalytics() {

  const box =
    document.getElementById("mistakeAnalytics");


  const map = {};


  trades.forEach(trade => {

    if (!trade.mistake) return;

    map[trade.mistake] =
      (map[trade.mistake] || 0) + 1;

  });


  const entries =
    Object.entries(map)
      .sort((a, b) => b[1] - a[1]);


  if (!entries.length) {

    box.innerHTML =
      `<p class="muted">No mistakes recorded.</p>`;

    return;

  }


  box.innerHTML =
    entries.map(
      ([mistake, count]) => {

        return `
          <div class="analytics-row">
            <span>${escapeHTML(mistake)}</span>
            <strong>${count}</strong>
          </div>
        `;

      }
    ).join("");

}


/* ==============================
   CSV EXPORT
============================== */

exportCSV.addEventListener("click", () => {

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
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"
  ];


  const rows =
    trades.map(t => [

      t.date,
      t.time,
      t.pair,
      t.direction,
      t.entry,
      t.sl,
      t.tp,
      t.rr,
      t.riskPercent,
      t.riskAmount,
      t.lotSize,
      t.setup,
      t.session,
      t.htfBias,
      t.liquidity,
      t.confirmation,
      t.result,
      t.profitLoss,
      t.psychology,
      t.confidence,
      t.mistake,
      t.notes

    ].map(value => {

      const text =
        String(value ?? "");

      return `"${text.replaceAll('"', '""')}"`;

    }).join(","));


  const csv =
    [headers.join(","), ...rows]
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
    "ujr-fx-trading-journal.csv";

  link.click();

  URL.revokeObjectURL(url);

});


/* ==============================
   RESIZE
============================== */

window.addEventListener(
  "resize",
  updateEquityCurve
);
