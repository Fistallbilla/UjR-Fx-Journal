import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
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
  editingId: null,
  currency: "USD",
  startingBalance: 0,
  calendarDate: new Date()
};


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

function num(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value){
  const currency = state.currency || "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(num(value));
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function todayString(){
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");

  return `${y}-${m}-${day}`;
}

function generateTradeId(){
  return "UJR-" + Date.now().toString().slice(-8);
}

function sortTrades(trades){
  return [...trades].sort((a,b) => {
    const da = new Date(`${a.date || "1970-01-01"}T00:00:00`);
    const db = new Date(`${b.date || "1970-01-01"}T00:00:00`);

    return db - da;
  });
}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

$("googleLoginBtn").addEventListener("click", async () => {

  const button = $("googleLoginBtn");

  button.disabled = true;

  button.innerHTML = `
    <span class="google-icon">G</span>
    <span>Signing in...</span>
  `;

  $("loginError").textContent = "";

  try{

    await signInWithPopup(auth, provider);

  }catch(error){

    console.error("Google Login Error:", error);

    if(error.code === "auth/popup-blocked"){

      $("loginError").textContent =
        "Popup was blocked. Allow popups for this website.";

    }else if(error.code === "auth/popup-closed-by-user"){

      $("loginError").textContent =
        "Login window was closed.";

    }else if(error.code === "auth/unauthorized-domain"){

      $("loginError").textContent =
        "This website domain is not authorized in Firebase.";

    }else if(error.code === "auth/operation-not-allowed"){

      $("loginError").textContent =
        "Google login is not enabled in Firebase.";

    }else if(error.code === "auth/network-request-failed"){

      $("loginError").textContent =
        "Network error. Check your internet connection.";

    }else{

      $("loginError").textContent =
        error.message || "Google login failed.";

    }

  }finally{

    button.disabled = false;

    button.innerHTML = `
      <span class="google-icon">G</span>
      <span>Continue with Google</span>
    `;
  }

});


getRedirectResult(auth).catch(error => {

  if(error){
    console.error("Redirect auth error:", error);
  }

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, async user => {

  if(user){

    state.user = user;

    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    updateUserUI();

    await loadUserData();

  }else{

    state.user = null;

    $("app").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");

  }

});


/* =========================================================
   USER UI
========================================================= */

function updateUserUI(){

  if(!state.user) return;

  const name =
    state.user.displayName ||
    "Trader";

  const email =
    state.user.email ||
    "";

  const photo =
    state.user.photoURL ||
    "logo.png";

  $("sidebarName").textContent = name;
  $("sidebarEmail").textContent = email;

  $("sidebarAvatar").src = photo;

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;

  $("settingsAvatar").src = photo;
}


/* =========================================================
   LOAD TRADES
========================================================= */

async function loadUserData(){

  if(!state.user) return;

  try{

    const tradesRef =
      collection(
        db,
        "users",
        state.user.uid,
        "trades"
      );

    const snapshot =
      await getDocs(tradesRef);

    state.trades = [];

    snapshot.forEach(item => {

      state.trades.push({
        id:item.id,
        ...item.data()
      });

    });

    state.trades = sortTrades(state.trades);

    await loadSettings();

    renderAll();

  }catch(error){

    console.error("Loading data failed:", error);

  }

}


/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings(){

  if(!state.user) return;

  try{

    const settingsRef =
      collection(
        db,
        "users",
        state.user.uid,
        "settings"
      );

    const snapshot =
      await getDocs(settingsRef);

    if(!snapshot.empty){

      const data = snapshot.docs[0].data();

      state.currency =
        data.currency || "USD";

      state.startingBalance =
        num(data.startingBalance);

    }

  }catch(error){

    console.error("Settings error:",error);

  }

  $("startingBalance").value =
    state.startingBalance || "";

  $("currencySelect").value =
    state.currency;
}


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav-btn").forEach(button => {

  button.addEventListener("click", () => {

    const page = button.dataset.page;

    document.querySelectorAll(".nav-btn")
      .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");

    document.querySelectorAll(".page")
      .forEach(section => section.classList.remove("active-page"));

    const target =
      document.getElementById(`page-${page}`);

    if(target){
      target.classList.add("active-page");
    }

    closeMobileMenu();

    renderAll();

  });

});


/* =========================================================
   MOBILE MENU
========================================================= */

$("mobileMenuBtn").addEventListener("click", () => {

  document.querySelector(".sidebar")
    .classList.toggle("mobile-open");

  $("mobileOverlay")
    .classList.toggle("active");

});

$("mobileOverlay").addEventListener("click", closeMobileMenu);

function closeMobileMenu(){

  document.querySelector(".sidebar")
    .classList.remove("mobile-open");

  $("mobileOverlay")
    .classList.remove("active");

}


/* =========================================================
   ADD TRADE BUTTONS
   IMPORTANT:
   Every page has only its own single button.
========================================================= */

document.querySelectorAll(".add-trade-btn")
  .forEach(button => {

    button.addEventListener("click", openAddTrade);

  });


/* =========================================================
   MODAL
========================================================= */

function openAddTrade(){

  state.editingId = null;

  $("tradeForm").reset();

  $("modalTitle").textContent = "Add Trade";

  $("editingTradeId").value = "";

  $("tradeId").value = generateTradeId();

  $("tradeDate").value = todayString();

  $("pair").value = "XAUUSD";

  $("tradingType").value = "Scalping";

  $("direction").value = "Buy";

  $("result").value = "Win";

  $("confidence").value = "3/5";

  $("emotion").value = "Calm";

  $("rr").value = "";

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

}


function closeTradeModal(){

  $("tradeModal").classList.add("hidden");

}

$("closeModal").addEventListener("click",closeTradeModal);

$("cancelTrade").addEventListener("click",closeTradeModal);

$("tradeModal").querySelector(".modal-overlay")
  .addEventListener("click",closeTradeModal);


/* =========================================================
   RR
========================================================= */

function calculateTradeRR(){

  const entry = num($("entry").value);
  const sl = num($("sl").value);
  const tp = num($("tp").value);

  const direction = $("direction").value;

  if(entry <= 0 || sl <= 0 || tp <= 0){

    $("rr").value = "";

    return 0;
  }

  let risk = 0;
  let reward = 0;

  if(direction === "Buy"){

    risk = entry - sl;
    reward = tp - entry;

  }else{

    risk = sl - entry;
    reward = entry - tp;

  }

  if(risk <= 0 || reward <= 0){

    $("rr").value = "Invalid";

    return 0;

  }

  const rr = reward / risk;

  $("rr").value =
    `1:${rr.toFixed(2)}`;

  return rr;
}

["entry","sl","tp","direction"]
.forEach(id => {

  $(id).addEventListener("input",calculateTradeRR);
  $(id).addEventListener("change",calculateTradeRR);

});


/* =========================================================
   P/L NORMALIZATION
========================================================= */

function normalizeProfitLossByResult(){

  const result = $("result").value;

  const input = $("profitLoss");

  if(result === "Break Even"){

    input.value = "0";

    return;
  }

  if(input.value === "") return;

  const value = Number(input.value);

  if(!Number.isFinite(value)) return;

  if(result === "Win"){

    input.value =
      Math.abs(value);

  }

  if(result === "Loss"){

    input.value =
      -Math.abs(value);

  }

}

function getNormalizedPL(){

  const result = $("result").value;

  const raw = $("profitLoss").value;

  if(result === "Break Even") return 0;

  if(raw === "") return null;

  const value = Number(raw);

  if(!Number.isFinite(value)) return null;

  if(result === "Win"){

    return Number(
      Math.abs(value).toFixed(2)
    );

  }

  if(result === "Loss"){

    return Number(
      -Math.abs(value).toFixed(2)
    );

  }

  return Number(
    value.toFixed(2)
  );

}


$("result").addEventListener(
  "change",
  normalizeProfitLossByResult
);

$("profitLoss").addEventListener(
  "blur",
  normalizeProfitLossByResult
);


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener("submit", async event => {

  event.preventDefault();

  if(!state.user){

    $("tradeError").textContent =
      "Please login first.";

    return;
  }


  $("tradeError").textContent = "";


  const pair =
    $("pair").value.trim().toUpperCase();

  if(!pair){

    $("tradeError").textContent =
      "Pair is required.";

    return;
  }


  const riskRaw =
    $("riskAmount").value.trim();

  const riskAmount =
    riskRaw === ""
      ? 0
      : Number(riskRaw);


  if(
    !Number.isFinite(riskAmount) ||
    riskAmount < 0
  ){

    $("tradeError").textContent =
      "Risk Amount must be a valid number.";

    return;
  }


  const pl =
    getNormalizedPL();


  if(pl === null){

    $("tradeError").textContent =
      "Please enter Profit / Loss.";

    return;
  }


  const rr =
    calculateTradeRR();


  const tradeData = {

    tradeId:
      $("tradeId").value,

    date:
      $("tradeDate").value,

    pair,

    tradingType:
      $("tradingType").value,

    direction:
      $("direction").value,

    strategy:
      $("strategy").value,

    session:
      $("session").value,

    marketBias:
      $("marketBias").value,

    entry:
      num($("entry").value),

    sl:
      num($("sl").value),

    tp:
      num($("tp").value),

    rr:
      rr,

    riskAmount,

    lotSize:
      num($("lotSize").value),

    result:
      $("result").value,

    profitLoss:
      pl,

    confidence:
      $("confidence").value,

    emotion:
      $("emotion").value,

    notes:
      $("tradeNotes").value.trim(),

    updatedAt:
      serverTimestamp()

  };


  try{

    if(state.editingId){

      const tradeRef =
        doc(
          db,
          "users",
          state.user.uid,
          "trades",
          state.editingId
        );

      await updateDoc(
        tradeRef,
        tradeData
      );

    }else{

      tradeData.createdAt =
        serverTimestamp();

      await addDoc(
        collection(
          db,
          "users",
          state.user.uid,
          "trades"
        ),
        tradeData
      );

    }


    closeTradeModal();

    await loadUserData();

  }catch(error){

    console.error(error);

    $("tradeError").textContent =
      error.message ||
      "Could not save trade.";

  }

});


/* =========================================================
   EDIT TRADE
========================================================= */

window.editTrade = function(id){

  const trade =
    state.trades.find(
      item => item.id === id
    );

  if(!trade) return;

  state.editingId = id;

  $("modalTitle").textContent =
    "Edit Trade";

  $("editingTradeId").value = id;

  $("tradeId").value =
    trade.tradeId || generateTradeId();

  $("tradeDate").value =
    trade.date || todayString();

  $("pair").value =
    trade.pair || "XAUUSD";

  $("tradingType").value =
    trade.tradingType || "Scalping";

  $("direction").value =
    trade.direction || "Buy";

  $("strategy").value =
    trade.strategy || "Liquidity Sweep";

  $("session").value =
    trade.session || "London";

  $("marketBias").value =
    trade.marketBias || "Bullish";

  $("entry").value =
    trade.entry || "";

  $("sl").value =
    trade.sl || "";

  $("tp").value =
    trade.tp || "";

  $("riskAmount").value =
    trade.riskAmount ?? "";

  $("lotSize").value =
    trade.lotSize ?? "";

  $("result").value =
    trade.result || "Win";

  $("profitLoss").value =
    trade.profitLoss ?? "";

  $("confidence").value =
    trade.confidence || "3/5";

  $("emotion").value =
    trade.emotion || "Calm";

  $("tradeNotes").value =
    trade.notes || "";

  calculateTradeRR();

  $("tradeError").textContent = "";

  $("tradeModal").classList.remove("hidden");

};


/* =========================================================
   DELETE TRADE
========================================================= */

window.deleteTrade = async function(id){

  const confirmed =
    confirm("Delete this trade?");

  if(!confirmed) return;

  if(!state.user) return;

  try{

    await deleteDoc(
      doc(
        db,
        "users",
        state.user.uid,
        "trades",
        id
      )
    );

    await loadUserData();

  }catch(error){

    console.error(error);

    alert(
      "Could not delete this trade."
    );

  }

};


/* =========================================================
   DASHBOARD
========================================================= */

function calculateStats(trades){

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
      t => t.result === "Break Even"
    ).length;

  const totalPL =
    trades.reduce(
      (sum,t) => sum + num(t.profitLoss),
      0
    );

  const winningPL =
    trades
      .filter(t => num(t.profitLoss) > 0)
      .reduce(
        (sum,t) => sum + num(t.profitLoss),
        0
      );

  const losingPL =
    Math.abs(
      trades
        .filter(t => num(t.profitLoss) < 0)
        .reduce(
          (sum,t) => sum + num(t.profitLoss),
          0
        )
    );

  const winRate =
    total
      ? (wins / total) * 100
      : 0;

  const profitFactor =
    losingPL > 0
      ? winningPL / losingPL
      : winningPL > 0
        ? Infinity
        : 0;

  const rrTrades =
    trades.filter(
      t => num(t.rr) > 0
    );

  const averageRR =
    rrTrades.length
      ? rrTrades.reduce(
          (sum,t) => sum + num(t.rr),
          0
        ) / rrTrades.length
      : 0;

  const expectancy =
    total
      ? totalPL / total
      : 0;

  const averageWin =
    wins
      ? winningPL / wins
      : 0;

  const averageLoss =
    losses
      ? -losingPL / losses
      : 0;

  const bestTrade =
    trades.length
      ? Math.max(
          ...trades.map(
            t => num(t.profitLoss)
          )
        )
      : 0;

  const worstTrade =
    trades.length
      ? Math.min(
          ...trades.map(
            t => num(t.profitLoss)
          )
        )
      : 0;

  return {
    total,
    wins,
    losses,
    be,
    totalPL,
    winningPL,
    losingPL,
    winRate,
    profitFactor,
    averageRR,
    expectancy,
    averageWin,
    averageLoss,
    bestTrade,
    worstTrade
  };

}


function renderDashboard(){

  const stats =
    calculateStats(state.trades);

  $("statTotalTrades").textContent =
    stats.total;

  $("statWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("statTotalPL").textContent =
    money(stats.totalPL);

  $("statProfitFactor").textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor.toFixed(2);

  $("statAverageRR").textContent =
    stats.averageRR.toFixed(2);

  $("statExpectancy").textContent =
    money(stats.expectancy);

  $("statWins").textContent =
    stats.wins;

  $("statLosses").textContent =
    stats.losses;

  $("statBE").textContent =
    stats.be;

  $("statBestTrade").textContent =
    money(stats.bestTrade);

  $("statWorstTrade").textContent =
    money(stats.worstTrade);


  const streak =
    getCurrentStreak(state.trades);

  $("statStreak").textContent =
    streak.text;


  renderRecentTrades();

  drawEquityChart();

}


function getCurrentStreak(trades){

  if(!trades.length){

    return {
      count:0,
      text:"0"
    };

  }

  const sorted =
    [...trades].sort(
      (a,b) =>
        new Date(b.date) -
        new Date(a.date)
    );

  const first =
    sorted[0].result;

  if(first === "Break Even"){

    return {
      count:0,
      text:"0"
    };

  }

  let count = 0;

  for(const trade of sorted){

    if(trade.result === first){

      count++;

    }else{

      break;

    }

  }

  return {
    count,
    text:
      `${count} ${first === "Win" ? "W" : "L"}`
  };

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades(){

  const container =
    $("recentTrades");

  const trades =
    sortTrades(state.trades)
      .slice(0,8);

  if(!trades.length){

    container.innerHTML =
      `<div class="empty-state">No trades yet.</div>`;

    return;
  }

  container.innerHTML =
    trades.map(trade => {

      const pl =
        num(trade.profitLoss);

      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";

      return `
        <div class="recent-trade">

          <div class="recent-main">

            <strong>
              ${escapeHtml(trade.pair || "XAUUSD")}
              ·
              ${escapeHtml(trade.strategy || "-")}
            </strong>

            <span>
              ${escapeHtml(trade.date || "-")}
              ·
              ${escapeHtml(trade.direction || "-")}
            </span>

          </div>

          <div class="recent-pl ${resultClass}">
            ${pl >= 0 ? "+" : ""}
            ${money(pl)}
          </div>

        </div>
      `;

    }).join("");

}


/* =========================================================
   JOURNAL
========================================================= */

function renderJournal(){

  const search =
    $("journalSearch").value
      .trim()
      .toLowerCase();

  const result =
    $("journalResultFilter").value;

  const type =
    $("journalTypeFilter").value;

  const date =
    $("journalDateFilter").value;


  let trades =
    [...state.trades];


  trades =
    trades.filter(trade => {

      const searchable = [

        trade.pair,
        trade.strategy,
        trade.direction,
        trade.session,
        trade.tradingType

      ]
      .join(" ")
      .toLowerCase();

      if(
        search &&
        !searchable.includes(search)
      ){

        return false;

      }

      if(
        result &&
        trade.result !== result
      ){

        return false;

      }

      if(
        type &&
        trade.tradingType !== type
      ){

        return false;

      }

      if(
        date &&
        trade.date !== date
      ){

        return false;

      }

      return true;

    });


  const tbody =
    $("journalTableBody");


  if(!trades.length){

    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:35px;color:#888;">
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    trades.map(trade => {

      const pl =
        num(trade.profitLoss);

      const resultClass =
        trade.result === "Win"
          ? "result-win"
          : trade.result === "Loss"
            ? "result-loss"
            : "result-be";

      const rr =
        num(trade.rr) > 0
          ? `1:${num(trade.rr).toFixed(2)}`
          : "-";


      return `
        <tr>

          <td>${escapeHtml(trade.date || "-")}</td>

          <td>
            <strong>
              ${escapeHtml(trade.pair || "XAUUSD")}
            </strong>
          </td>

          <td>${escapeHtml(trade.tradingType || "-")}</td>

          <td>${escapeHtml(trade.direction || "-")}</td>

          <td>${escapeHtml(trade.strategy || "-")}</td>

          <td>${trade.entry || "-"}</td>

          <td>${rr}</td>

          <td class="${resultClass}">
            ${escapeHtml(trade.result || "-")}
          </td>

          <td class="${pl >= 0 ? "result-win" : "result-loss"}">
            ${pl >= 0 ? "+" : ""}
            ${money(pl)}
          </td>

          <td>

            <div class="action-buttons">

              <button
                class="icon-btn"
                onclick="editTrade('${trade.id}')"
                title="Edit"
              >
                ✎
              </button>

              <button
                class="icon-btn"
                onclick="deleteTrade('${trade.id}')"
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


$("journalSearch").addEventListener(
  "input",
  renderJournal
);

$("journalResultFilter").addEventListener(
  "change",
  renderJournal
);

$("journalTypeFilter").addEventListener(
  "change",
  renderJournal
);

$("journalDateFilter").addEventListener(
  "change",
  renderJournal
);


$("clearFilters").addEventListener("click",() => {

  $("journalSearch").value = "";
  $("journalResultFilter").value = "";
  $("journalTypeFilter").value = "";
  $("journalDateFilter").value = "";

  renderJournal();

});


/* =========================================================
   ADVANCED ANALYTICS
========================================================= */

function getAnalyticsTrades(){

  const period =
    $("analyticsPeriod").value;

  const now =
    new Date();

  let start = null;


  if(period === "7"){

    start =
      new Date();

    start.setDate(
      start.getDate() - 6
    );

  }


  if(period === "30"){

    start =
      new Date();

    start.setDate(
      start.getDate() - 29
    );

  }


  if(period === "month"){

    start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

  }


  if(!start){

    return [...state.trades];

  }


  start.setHours(0,0,0,0);

  return state.trades.filter(trade => {

    if(!trade.date) return false;

    const date =
      new Date(
        `${trade.date}T00:00:00`
      );

    return date >= start;

  });

}


function groupPerformance(trades,key){

  const map = {};

  trades.forEach(trade => {

    const value =
      trade[key] ||
      "Unknown";

    if(!map[value]){

      map[value] = {
        name:value,
        trades:0,
        wins:0,
        losses:0,
        pl:0
      };

    }

    map[value].trades++;

    if(trade.result === "Win")
      map[value].wins++;

    if(trade.result === "Loss")
      map[value].losses++;

    map[value].pl +=
      num(trade.profitLoss);

  });


  return Object.values(map)
    .sort(
      (a,b) => b.pl - a.pl
    );

}


function renderBreakdown(id,data){

  const container = $(id);

  if(!data.length){

    container.innerHTML =
      `<div style="color:#888;font-size:11px;">No data.</div>`;

    return;

  }

  const max =
    Math.max(
      ...data.map(item =>
        Math.abs(item.pl)
      ),
      1
    );


  container.innerHTML =
    data.map(item => {

      const winRate =
        item.trades
          ? (item.wins / item.trades) * 100
          : 0;

      const width =
        Math.min(
          100,
          Math.max(
            4,
            Math.abs(item.pl) / max * 100
          )
        );


      return `
        <div class="breakdown-row">

          <div class="breakdown-top">

            <strong>
              ${escapeHtml(item.name)}
            </strong>

            <span>
              ${item.trades} trades
            </span>

          </div>

          <div class="progress">

            <span style="width:${width}%"></span>

          </div>

          <div class="breakdown-bottom">

            <span>
              WR ${winRate.toFixed(1)}%
            </span>

            <span class="${item.pl >= 0 ? "result-win" : "result-loss"}">
              ${item.pl >= 0 ? "+" : ""}
              ${money(item.pl)}
            </span>

          </div>

        </div>
      `;

    }).join("");

}


function renderAnalytics(){

  const trades =
    getAnalyticsTrades();

  const stats =
    calculateStats(trades);


  $("analyticsPL").textContent =
    money(stats.totalPL);

  $("analyticsWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("analyticsAvgWin").textContent =
    money(stats.averageWin);

  $("analyticsAvgLoss").textContent =
    money(stats.averageLoss);

  $("analyticsPF").textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor.toFixed(2);

  $("analyticsExpectancy").textContent =
    money(stats.expectancy);


  renderBreakdown(
    "pairAnalytics",
    groupPerformance(trades,"pair")
  );

  renderBreakdown(
    "strategyAnalytics",
    groupPerformance(trades,"strategy")
  );

  renderBreakdown(
    "typeAnalytics",
    groupPerformance(trades,"tradingType")
  );

  renderBreakdown(
    "sessionAnalytics",
    groupPerformance(trades,"session")
  );

  renderBreakdown(
    "directionAnalytics",
    groupPerformance(trades,"direction")
  );


  renderResultDistribution(trades);

  renderDailyAnalytics(trades);

}


$("analyticsPeriod").addEventListener(
  "change",
  renderAnalytics
);


/* =========================================================
   RESULT DISTRIBUTION
========================================================= */

function renderResultDistribution(trades){

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
      t => t.result === "Break Even"
    ).length;

  const total =
    trades.length || 1;


  const data = [
    {
      name:"Wins",
      value:wins,
      cls:"result-win"
    },
    {
      name:"Losses",
      value:losses,
      cls:"result-loss"
    },
    {
      name:"Break Even",
      value:be,
      cls:"result-be"
    }
  ];


  $("resultAnalytics").innerHTML =
    data.map(item => {

      const percent =
        item.value / total * 100;

      return `
        <div class="result-line">

          <span class="${item.cls}">
            ${item.name}
          </span>

          <div class="result-line-bar">
            <span
              style="
                width:${percent}%;
                background:currentColor;
              "
            ></span>
          </div>

          <strong>
            ${item.value}
          </strong>

        </div>
      `;

    }).join("");

}


/* =========================================================
   DAILY ANALYTICS
========================================================= */

function renderDailyAnalytics(trades){

  const map = {};

  trades.forEach(trade => {

    const date =
      trade.date || "Unknown";

    if(!map[date]){

      map[date] = {
        date,
        pl:0,
        trades:0
      };

    }

    map[date].pl +=
      num(trade.profitLoss);

    map[date].trades++;

  });


  const rows =
    Object.values(map)
      .sort(
        (a,b) =>
          new Date(b.date) -
          new Date(a.date)
      );


  if(!rows.length){

    $("dailyAnalytics").innerHTML =
      `<div style="color:#888;font-size:11px;">No data.</div>`;

    return;

  }


  const max =
    Math.max(
      ...rows.map(
        row => Math.abs(row.pl)
      ),
      1
    );


  $("dailyAnalytics").innerHTML =
    rows.map(row => {

      const width =
        Math.max(
          4,
          Math.abs(row.pl) / max * 100
        );


      return `
        <div class="daily-row">

          <span>
            ${escapeHtml(row.date)}
          </span>

          <div class="daily-bar">

            <span
              style="
                width:${width}%;
                background:${row.pl >= 0
                  ? "var(--green)"
                  : "var(--red)"};
              "
            ></span>

          </div>

          <strong class="${row.pl >= 0 ? "result-win" : "result-loss"}">
            ${row.pl >= 0 ? "+" : ""}
            ${money(row.pl)}
          </strong>

        </div>
      `;

    }).join("");

}


/* =========================================================
   EQUITY CHART
========================================================= */

function drawEquityChart(){

  const canvas =
    $("equityChart");

  if(!canvas) return;

  const ctx =
    canvas.getContext("2d");

  const width =
    canvas.clientWidth;

  const height =
    270;

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;

  ctx.scale(dpr,dpr);

  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const trades =
    [...state.trades]
      .sort(
        (a,b) =>
          new Date(a.date) -
          new Date(b.date)
      );


  if(!trades.length){

    ctx.fillStyle =
      "#777";

    ctx.font =
      "12px system-ui";

    ctx.fillText(
      "No trades to display",
      20,
      35
    );

    return;

  }


  let equity =
    num(state.startingBalance);

  const points = [];

  trades.forEach(trade => {

    equity +=
      num(trade.profitLoss);

    points.push(equity);

  });


  const min =
    Math.min(...points);

  const max =
    Math.max(...points);

  const range =
    max - min || 1;


  const pad = 25;

  ctx.beginPath();


  points.forEach((value,index) => {

    const x =
      pad +
      (index /
        Math.max(points.length - 1,1)) *
      (width - pad * 2);

    const y =
      height -
      pad -
      ((value - min) / range) *
      (height - pad * 2);


    if(index === 0){

      ctx.moveTo(x,y);

    }else{

      ctx.lineTo(x,y);

    }

  });


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth = 2;

  ctx.stroke();


  points.forEach((value,index) => {

    const x =
      pad +
      (index /
        Math.max(points.length - 1,1)) *
      (width - pad * 2);

    const y =
      height -
      pad -
      ((value - min) / range) *
      (height - pad * 2);


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      3,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#f0cf79";

    ctx.fill();

  });

}


window.addEventListener(
  "resize",
  drawEquityChart
);


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn").addEventListener(
  "click",
  exportCSV
);


function exportCSV(){

  if(!state.trades.length){

    alert("No trades to export.");

    return;

  }


  const headers = [

    "Trade ID",
    "Date",
    "Pair",
    "Trading Type",
    "Direction",
    "Strategy",
    "Session",
    "Market Bias",
    "Entry",
    "Stop Loss",
    "Take Profit",
    "RR",
    "Risk Amount",
    "Lot Size",
    "Result",
    "Profit/Loss",
    "Confidence",
    "Emotion",
    "Notes"

  ];


  const rows =
    state.trades.map(trade => [

      trade.tradeId,
      trade.date,
      trade.pair || "XAUUSD",
      trade.tradingType,
      trade.direction,
      trade.strategy,
      trade.session,
      trade.marketBias,
      trade.entry,
      trade.sl,
      trade.tp,
      trade.rr,
      trade.riskAmount,
      trade.lotSize,
      trade.result,
      trade.profitLoss,
      trade.confidence,
      trade.emotion,
      trade.notes

    ]);


  const csv = [

    headers,

    ...rows

  ].map(row =>

    row.map(value => {

      const text =
        String(value ?? "");

      return `"${text.replaceAll('"','""')}"`;

    }).join(",")

  ).join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type:"text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `UjR-Fx-Trading-Journal-${todayString()}.csv`;

  link.click();

  URL.revokeObjectURL(url);

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

function calculateRisk(){

  const balance =
    num($("calcBalance").value);

  const riskPercent =
    num($("calcRiskPercent").value);

  const entry =
    num($("calcEntry").value);

  const sl =
    num($("calcSL").value);

  const tp =
    num($("calcTP").value);

  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  let stopDistance = 0;
  let reward = 0;


  if(direction === "Buy"){

    stopDistance =
      entry - sl;

    reward =
      tp - entry;

  }else{

    stopDistance =
      sl - entry;

    reward =
      entry - tp;

  }


  const rr =
    stopDistance > 0 &&
    reward > 0
      ? reward / stopDistance
      : 0;


  const lot =
    stopDistance > 0
      ? riskAmount /
        (stopDistance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);

  $("calcStopDistance").textContent =
    stopDistance > 0
      ? stopDistance.toFixed(3)
      : "0";

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0";

  $("calcLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";

}


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
    calculateRisk
  );

  $(id).addEventListener(
    "change",
    calculateRisk
  );

});


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth").addEventListener(
  "click",
  () => {

    state.calendarDate.setMonth(
      state.calendarDate.getMonth() - 1
    );

    renderCalendar();

  }
);


$("nextMonth").addEventListener(
  "click",
  () => {

    state.calendarDate.setMonth(
      state.calendarDate.getMonth() + 1
    );

    renderCalendar();

  }
);


function renderCalendar(){

  const date =
    state.calendarDate;

  const year =
    date.getFullYear();

  const month =
    date.getMonth();


  $("calendarTitle").textContent =
    date.toLocaleDateString(
      "en-US",
      {
        month:"long",
        year:"numeric"
      }
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


  const names =
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];


  let html =
    names.map(name => `
      <div class="calendar-day-name">
        ${name}
      </div>
    `).join("");


  for(let i=0;i<firstDay;i++){

    html +=
      `<div class="calendar-cell empty"></div>`;

  }


  for(let day=1;day<=days;day++){

    const dateString =
      `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;


    const trades =
      state.trades.filter(
        trade =>
          trade.date === dateString
      );


    const pl =
      trades.reduce(
        (sum,t) =>
          sum + num(t.profitLoss),
        0
      );


    html += `
      <div
        class="calendar-cell"
        data-date="${dateString}"
      >

        <div class="calendar-number">
          ${day}
        </div>

        ${
          trades.length
            ? `
              <div
                class="calendar-pl ${
                  pl >= 0
                    ? "result-win"
                    : "result-loss"
                }"
              >
                ${pl >= 0 ? "+" : ""}
                ${money(pl)}
              </div>

              <div class="calendar-count">
                ${trades.length} trade${trades.length > 1 ? "s" : ""}
              </div>
            `
            : ""
        }

      </div>
    `;

  }


  $("calendarGrid").innerHTML =
    html;


  document
    .querySelectorAll(".calendar-cell[data-date]")
    .forEach(cell => {

      cell.addEventListener(
        "click",
        () => {

          renderCalendarTrades(
            cell.dataset.date
          );

        }
      );

    });

}


function renderCalendarTrades(date){

  const trades =
    state.trades.filter(
      trade => trade.date === date
    );


  if(!trades.length){

    $("calendarTrades").innerHTML =
      `<div class="panel">
        <span style="color:#888;font-size:11px;">
          No trades on ${date}.
        </span>
      </div>`;

    return;

  }


  $("calendarTrades").innerHTML = `
    <div class="panel">

      <div class="panel-header">

        <div>
          <h2>${date}</h2>
          <span>${trades.length} trade(s)</span>
        </div>

      </div>

      ${trades.map(trade => `

        <div class="recent-trade">

          <div class="recent-main">

            <strong>
              ${escapeHtml(trade.pair || "XAUUSD")}
            </strong>

            <span>
              ${escapeHtml(trade.strategy || "-")}
              ·
              ${escapeHtml(trade.result || "-")}
            </span>

          </div>

          <div class="${
            num(trade.profitLoss) >= 0
              ? "result-win"
              : "result-loss"
          }">

            ${
              num(trade.profitLoss) >= 0
                ? "+"
                : ""
            }

            ${money(trade.profitLoss)}

          </div>

        </div>

      `).join("")}

    </div>
  `;

}


/* =========================================================
   SETTINGS SAVE
========================================================= */

$("saveSettings").addEventListener(
  "click",
  async () => {

    if(!state.user) return;


    const startingBalance =
      num(
        $("startingBalance").value
      );

    const currency =
      $("currencySelect").value;


    try{

      const settingsRef =
        collection(
          db,
          "users",
          state.user.uid,
          "settings"
        );


      const existing =
        await getDocs(settingsRef);


      const data = {
        startingBalance,
        currency
      };


      if(existing.empty){

        await addDoc(
          settingsRef,
          data
        );

      }else{

        const first =
          existing.docs[0];

        await updateDoc(
          doc(
            db,
            "users",
            state.user.uid,
            "settings",
            first.id
          ),
          data
        );

      }


      state.startingBalance =
        startingBalance;

      state.currency =
        currency;


      $("settingsMessage").textContent =
        "Settings saved.";

      renderAll();


      setTimeout(() => {

        $("settingsMessage").textContent = "";

      },2500);


    }catch(error){

      console.error(error);

      $("settingsMessage").textContent =
        "Could not save settings.";

    }

  }
);


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener(
  "click",
  async () => {

    try{

      await signOut(auth);

    }catch(error){

      console.error(error);

    }

  }
);


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll(){

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

  calculateRisk();

}


/* =========================================================
   INITIAL DEFAULTS
========================================================= */

$("tradeDate").value =
  todayString();

$("pair").value =
  "XAUUSD";

$("tradeId").value =
  generateTradeId();

renderCalendar();
