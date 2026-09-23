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
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
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


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

const firebaseApp =
  initializeApp(firebaseConfig);

const auth =
  getAuth(firebaseApp);

const db =
  getFirestore(firebaseApp);

const provider =
  new GoogleAuthProvider();

provider.setCustomParameters({
  prompt:"select_account"
});


/* =========================================================
   STATE
========================================================= */

const state = {

  user:null,

  trades:[],

  editingId:null,

  currency:"USD",

  startingBalance:0,

  calendarDate:new Date()

};


/* =========================================================
   SHORTCUT
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   GENERAL HELPERS
========================================================= */

function number(value){

  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;

}


function money(value){

  const amount =
    number(value);

  try{

    return new Intl.NumberFormat(
      "en-US",
      {
        style:"currency",
        currency:state.currency || "USD",
        maximumFractionDigits:2
      }
    ).format(amount);

  }catch{

    return `$${amount.toFixed(2)}`;

  }

}


function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function getToday(){

  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth()+1
    ).padStart(2,"0");

  const day =
    String(
      date.getDate()
    ).padStart(2,"0");

  return `${year}-${month}-${day}`;

}


function generateTradeId(){

  return (
    "UJR-" +
    Date.now()
      .toString()
      .slice(-8)
  );

}


function sortTrades(trades){

  return [...trades].sort(
    (a,b) => {

      const dateA =
        new Date(
          `${a.date || "1970-01-01"}T00:00:00`
        );

      const dateB =
        new Date(
          `${b.date || "1970-01-01"}T00:00:00`
        );

      if(dateB - dateA !== 0){

        return dateB - dateA;

      }

      return (
        number(b.createdAtMillis) -
        number(a.createdAtMillis)
      );

    }
  );

}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

$("googleLoginBtn")
  .addEventListener(
    "click",
    async () => {

      const button =
        $("googleLoginBtn");

      button.disabled = true;

      button.innerHTML = `
        <span class="google-icon">G</span>
        <span>Signing in...</span>
      `;

      $("loginError").textContent = "";


      try{

        await signInWithPopup(
          auth,
          provider
        );

      }catch(error){

        console.error(
          "Google Login Error:",
          error
        );


        switch(error.code){

          case "auth/popup-blocked":

            $("loginError").textContent =
              "Popup was blocked. Allow popups for this website.";

            break;


          case "auth/popup-closed-by-user":

            $("loginError").textContent =
              "Login window was closed.";

            break;


          case "auth/unauthorized-domain":

            $("loginError").textContent =
              "This website domain is not authorized in Firebase.";

            break;


          case "auth/operation-not-allowed":

            $("loginError").textContent =
              "Google login is not enabled in Firebase.";

            break;


          case "auth/network-request-failed":

            $("loginError").textContent =
              "Network error. Check your internet connection.";

            break;


          default:

            $("loginError").textContent =
              error.message ||
              "Google login failed.";

        }

      }finally{

        button.disabled = false;

        button.innerHTML = `
          <span class="google-icon">G</span>
          <span>Continue with Google</span>
        `;

      }

    }
  );


/* =========================================================
   REDIRECT RESULT
========================================================= */

getRedirectResult(auth)
  .catch(error => {

    if(error){

      console.error(
        "Redirect auth error:",
        error
      );

    }

  });


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    if(user){

      state.user =
        user;


      $("loginScreen")
        .classList
        .add("hidden");


      $("app")
        .classList
        .remove("hidden");


      updateUserUI();


      await loadUserData();

    }else{

      state.user =
        null;

      state.trades =
        [];


      $("app")
        .classList
        .add("hidden");


      $("loginScreen")
        .classList
        .remove("hidden");

    }

  }
);


/* =========================================================
   USER UI
========================================================= */

function updateUserUI(){

  if(!state.user)
    return;


  const name =
    state.user.displayName ||
    "Trader";


  const email =
    state.user.email ||
    "";


  const photo =
    state.user.photoURL ||
    "logo.png";


  $("sidebarName")
    .textContent =
    name;


  $("sidebarEmail")
    .textContent =
    email;


  $("sidebarAvatar")
    .src =
    photo;


  $("settingsName")
    .textContent =
    name;


  $("settingsEmail")
    .textContent =
    email;


  $("settingsAvatar")
    .src =
    photo;

}


/* =========================================================
   LOAD USER DATA
========================================================= */

async function loadUserData(){

  if(!state.user)
    return;


  try{

    await Promise.all([
      loadTrades(),
      loadSettings()
    ]);


    renderAll();

  }catch(error){

    console.error(
      "Loading user data failed:",
      error
    );

  }

}


/* =========================================================
   LOAD TRADES
========================================================= */

async function loadTrades(){

  const tradesRef =
    collection(
      db,
      "users",
      state.user.uid,
      "trades"
    );


  const snapshot =
    await getDocs(tradesRef);


  const loadedTrades = [];


  snapshot.forEach(item => {

    const data =
      item.data();


    /*
      createdAt from Firestore is converted
      into milliseconds when possible.
    */

    let createdAtMillis = 0;


    if(
      data.createdAt &&
      typeof data.createdAt.toMillis === "function"
    ){

      createdAtMillis =
        data.createdAt.toMillis();

    }


    loadedTrades.push({

      id:item.id,

      ...data,

      /*
        Old trades may not have pair.
        They safely become XAUUSD.
      */

      pair:
        String(
          data.pair ||
          "XAUUSD"
        )
          .trim()
          .toUpperCase(),

      createdAtMillis

    });

  });


  state.trades =
    sortTrades(
      loadedTrades
    );

}


/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings(){

  if(!state.user)
    return;


  const settingsRef =
    doc(
      db,
      "users",
      state.user.uid,
      "settings",
      "main"
    );


  try{

    const snapshot =
      await getDocs(
        collection(
          db,
          "users",
          state.user.uid,
          "settings"
        )
      );


    if(!snapshot.empty){

      const data =
        snapshot.docs[0].data();


      state.currency =
        data.currency ||
        "USD";


      state.startingBalance =
        number(
          data.startingBalance
        );

    }


  }catch(error){

    console.error(
      "Settings loading error:",
      error
    );

  }


  $("startingBalance").value =
    state.startingBalance || "";


  $("currencySelect").value =
    state.currency;

}


/* =========================================================
   NAVIGATION
========================================================= */

document
  .querySelectorAll(".nav-btn")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const page =
          button.dataset.page;


        document
          .querySelectorAll(".nav-btn")
          .forEach(btn =>
            btn.classList.remove("active")
          );


        button.classList.add("active");


        document
          .querySelectorAll(".page")
          .forEach(section =>
            section.classList.remove(
              "active-page"
            )
          );


        const target =
          $(`page-${page}`);


        if(target){

          target.classList.add(
            "active-page"
          );

        }


        closeMobileMenu();

        renderAll();

      }
    );

  });


/* =========================================================
   MOBILE MENU
========================================================= */

$("mobileMenuBtn")
  .addEventListener(
    "click",
    () => {

      $("sidebar")
        .classList
        .toggle("mobile-open");


      $("mobileOverlay")
        .classList
        .toggle("active");

    }
  );


$("mobileOverlay")
  .addEventListener(
    "click",
    closeMobileMenu
  );


function closeMobileMenu(){

  $("sidebar")
    .classList
    .remove("mobile-open");


  $("mobileOverlay")
    .classList
    .remove("active");

}


/* =========================================================
   ADD TRADE BUTTONS
========================================================= */

document
  .querySelectorAll(".add-trade-btn")
  .forEach(button => {

    button.addEventListener(
      "click",
      openAddTrade
    );

  });


/* =========================================================
   OPEN ADD TRADE
========================================================= */

function openAddTrade(){

  state.editingId =
    null;


  $("tradeForm")
    .reset();


  $("modalTitle")
    .textContent =
    "Add Trade";


  $("editingTradeId")
    .value = "";


  $("tradeId")
    .value =
    generateTradeId();


  $("tradeDate")
    .value =
    getToday();


  /*
    Default pair.
  */

  $("pair")
    .value =
    "XAUUSD";


  $("tradingType")
    .value =
    "Scalping";


  $("direction")
    .value =
    "Buy";


  $("strategy")
    .value =
    "Liquidity Sweep";


  $("session")
    .value =
    "London";


  $("marketBias")
    .value =
    "Bullish";


  $("result")
    .value =
    "Win";


  $("confidence")
    .value =
    "3/5";


  $("emotion")
    .value =
    "Calm";


  $("rr")
    .value =
    "";


  $("tradeError")
    .textContent =
    "";


  $("tradeModal")
    .classList
    .remove("hidden");


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeTradeModal(){

  $("tradeModal")
    .classList
    .add("hidden");


  document.body.style.overflow =
    "";

}


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
  .querySelector(".modal-overlay")
  .addEventListener(
    "click",
    closeTradeModal
  );


document.addEventListener(
  "keydown",
  event => {

    if(
      event.key === "Escape" &&
      !$("tradeModal")
        .classList
        .contains("hidden")
    ){

      closeTradeModal();

    }

  }
);


/* =========================================================
   RR CALCULATION
========================================================= */

function calculateTradeRR(){

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


  if(
    entry <= 0 ||
    sl <= 0 ||
    tp <= 0
  ){

    $("rr").value =
      "";

    return 0;

  }


  let risk = 0;
  let reward = 0;


  if(direction === "Buy"){

    risk =
      entry - sl;

    reward =
      tp - entry;

  }else{

    risk =
      sl - entry;

    reward =
      entry - tp;

  }


  if(
    risk <= 0 ||
    reward <= 0
  ){

    $("rr").value =
      "Invalid";

    return 0;

  }


  const rr =
    reward / risk;


  $("rr").value =
    `1:${rr.toFixed(2)}`;


  return rr;

}


[
  "entry",
  "sl",
  "tp",
  "direction"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateTradeRR
  );


  $(id).addEventListener(
    "change",
    calculateTradeRR
  );

});


/* =========================================================
   P/L
========================================================= */

function normalizeProfitLossByResult(){

  const result =
    $("result").value;


  const input =
    $("profitLoss");


  if(result === "Break Even"){

    input.value =
      "0";

    return;

  }


  if(input.value === "")
    return;


  const value =
    Number(input.value);


  if(!Number.isFinite(value))
    return;


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

  const result =
    $("result").value;


  const raw =
    $("profitLoss").value;


  if(result === "Break Even")
    return 0;


  if(raw === "")
    return null;


  const value =
    Number(raw);


  if(!Number.isFinite(value))
    return null;


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


      if(!state.user){

        $("tradeError")
          .textContent =
          "Please login first.";

        return;

      }


      $("tradeError")
        .textContent =
        "";


      /*
        PAIR
      */

      const pair =
        $("pair")
          .value
          .trim()
          .toUpperCase();


      if(!pair){

        $("tradeError")
          .textContent =
          "Pair is required.";

        $("pair").focus();

        return;

      }


      /*
        RISK
      */

      const riskRaw =
        $("riskAmount")
          .value
          .trim();


      const riskAmount =
        riskRaw === ""
          ? 0
          : Number(riskRaw);


      if(
        !Number.isFinite(riskAmount) ||
        riskAmount < 0
      ){

        $("tradeError")
          .textContent =
          "Risk Amount must be 0 or a positive number.";

        $("riskAmount").focus();

        return;

      }


      /*
        P/L
      */

      const pl =
        getNormalizedPL();


      if(pl === null){

        $("tradeError")
          .textContent =
          "Please enter Profit / Loss.";

        $("profitLoss").focus();

        return;

      }


      /*
        RR
      */

      const rr =
        calculateTradeRR();


      /*
        DATA
      */

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
          number(
            $("entry").value
          ),

        sl:
          number(
            $("sl").value
          ),

        tp:
          number(
            $("tp").value
          ),

        rr,

        riskAmount,

        lotSize:
          number(
            $("lotSize").value
          ),

        result:
          $("result").value,

        profitLoss:
          pl,

        confidence:
          $("confidence").value,

        emotion:
          $("emotion").value,

        notes:
          $("tradeNotes")
            .value
            .trim(),

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

        console.error(
          "Save trade error:",
          error
        );


        $("tradeError")
          .textContent =
          error.message ||
          "Could not save trade.";

      }

    }
  );


/* =========================================================
   EDIT TRADE
========================================================= */

window.editTrade =
  function(id){

    const trade =
      state.trades.find(
        item =>
          item.id === id
      );


    if(!trade)
      return;


    state.editingId =
      id;


    $("modalTitle")
      .textContent =
      "Edit Trade";


    $("editingTradeId")
      .value =
      id;


    $("tradeId")
      .value =
      trade.tradeId ||
      generateTradeId();


    $("tradeDate")
      .value =
      trade.date ||
      getToday();


    $("pair")
      .value =
      trade.pair ||
      "XAUUSD";


    $("tradingType")
      .value =
      trade.tradingType ||
      "Scalping";


    $("direction")
      .value =
      trade.direction ||
      "Buy";


    $("strategy")
      .value =
      trade.strategy ||
      "Liquidity Sweep";


    $("session")
      .value =
      trade.session ||
      "London";


    $("marketBias")
      .value =
      trade.marketBias ||
      "Bullish";


    $("entry")
      .value =
      trade.entry ?? "";


    $("sl")
      .value =
      trade.sl ?? "";


    $("tp")
      .value =
      trade.tp ?? "";


    $("riskAmount")
      .value =
      trade.riskAmount ?? "";


    $("lotSize")
      .value =
      trade.lotSize ?? "";


    $("result")
      .value =
      trade.result ||
      "Win";


    $("profitLoss")
      .value =
      trade.profitLoss ?? "";


    $("confidence")
      .value =
      trade.confidence ||
      "3/5";


    $("emotion")
      .value =
      trade.emotion ||
      "Calm";


    $("tradeNotes")
      .value =
      trade.notes ||
      "";


    calculateTradeRR();


    $("tradeError")
      .textContent =
      "";


    $("tradeModal")
      .classList
      .remove("hidden");


    document.body.style.overflow =
      "hidden";

  };


/* =========================================================
   DELETE TRADE
========================================================= */

window.deleteTrade =
  async function(id){

    if(!state.user)
      return;


    const confirmed =
      window.confirm(
        "Delete this trade permanently?"
      );


    if(!confirmed)
      return;


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

      console.error(
        "Delete trade error:",
        error
      );


      window.alert(
        "Could not delete this trade."
      );

    }

  };


/* =========================================================
   STATISTICS
========================================================= */

function calculateStats(trades){

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


  const be =
    trades.filter(
      trade =>
        trade.result === "Break Even"
    ).length;


  const totalPL =
    trades.reduce(
      (sum,trade) =>
        sum +
        number(
          trade.profitLoss
        ),
      0
    );


  const winningPL =
    trades
      .filter(
        trade =>
          number(
            trade.profitLoss
          ) > 0
      )
      .reduce(
        (sum,trade) =>
          sum +
          number(
            trade.profitLoss
          ),
        0
      );


  const losingPL =
    Math.abs(
      trades
        .filter(
          trade =>
            number(
              trade.profitLoss
            ) < 0
        )
        .reduce(
          (sum,trade) =>
            sum +
            number(
              trade.profitLoss
            ),
          0
        )
    );


  const winRate =
    total > 0
      ? wins / total * 100
      : 0;


  let profitFactor = 0;


  if(losingPL > 0){

    profitFactor =
      winningPL / losingPL;

  }else if(winningPL > 0){

    profitFactor =
      Infinity;

  }


  const rrTrades =
    trades.filter(
      trade =>
        number(trade.rr) > 0
    );


  const averageRR =
    rrTrades.length > 0
      ? rrTrades.reduce(
          (sum,trade) =>
            sum +
            number(trade.rr),
          0
        ) /
        rrTrades.length
      : 0;


  const expectancy =
    total > 0
      ? totalPL / total
      : 0;


  const averageWin =
    wins > 0
      ? winningPL / wins
      : 0;


  const averageLoss =
    losses > 0
      ? -losingPL / losses
      : 0;


  const bestTrade =
    trades.length > 0
      ? Math.max(
          ...trades.map(
            trade =>
              number(
                trade.profitLoss
              )
          )
        )
      : 0;


  const worstTrade =
    trades.length > 0
      ? Math.min(
          ...trades.map(
            trade =>
              number(
                trade.profitLoss
              )
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


/* =========================================================
   CURRENT STREAK
========================================================= */

function getCurrentStreak(trades){

  if(!trades.length){

    return "0";

  }


  const sorted =
    [...trades].sort(
      (a,b) => {

        const dateA =
          new Date(
            `${a.date || "1970-01-01"}T00:00:00`
          );

        const dateB =
          new Date(
            `${b.date || "1970-01-01"}T00:00:00`
          );

        return dateB - dateA;

      }
    );


  const firstResult =
    sorted[0].result;


  if(
    firstResult !== "Win" &&
    firstResult !== "Loss"
  ){

    return "0";

  }


  let count = 0;


  for(
    const trade of sorted
  ){

    if(
      trade.result ===
      firstResult
    ){

      count++;

    }else{

      break;

    }

  }


  return `${count} ${
    firstResult === "Win"
      ? "W"
      : "L"
  }`;

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard(){

  const stats =
    calculateStats(
      state.trades
    );


  $("statTotalTrades")
    .textContent =
    stats.total;


  $("statWinRate")
    .textContent =
    `${stats.winRate.toFixed(1)}%`;


  $("statTotalPL")
    .textContent =
    money(stats.totalPL);


  $("statProfitFactor")
    .textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor.toFixed(2);


  $("statAverageRR")
    .textContent =
    stats.averageRR.toFixed(2);


  $("statExpectancy")
    .textContent =
    money(stats.expectancy);


  $("statWins")
    .textContent =
    stats.wins;


  $("statLosses")
    .textContent =
    stats.losses;


  $("statBE")
    .textContent =
    stats.be;


  $("statBestTrade")
    .textContent =
    money(stats.bestTrade);


  $("statWorstTrade")
    .textContent =
    money(stats.worstTrade);


  $("statStreak")
    .textContent =
    getCurrentStreak(
      state.trades
    );


  renderRecentTrades();

  drawEquityChart();

}


/* =========================================================
   RECENT TRADES
========================================================= */

function renderRecentTrades(){

  const container =
    $("recentTrades");


  const trades =
    sortTrades(
      state.trades
    ).slice(0,8);


  if(!trades.length){

    container.innerHTML = `
      <div class="empty-state">
        No trades yet.
      </div>
    `;

    return;

  }


  container.innerHTML =
    trades.map(
      trade => {

        const pl =
          number(
            trade.profitLoss
          );


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
                ${escapeHtml(
                  trade.pair ||
                  "XAUUSD"
                )}

                ·

                ${escapeHtml(
                  trade.strategy ||
                  "-"
                )}
              </strong>

              <span>

                ${escapeHtml(
                  trade.date ||
                  "-"
                )}

                ·

                ${escapeHtml(
                  trade.direction ||
                  "-"
                )}

              </span>

            </div>


            <div class="recent-pl ${resultClass}">

              ${
                pl >= 0
                  ? "+"
                  : ""
              }

              ${money(pl)}

            </div>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   JOURNAL FILTER
========================================================= */

function renderJournal(){

  const search =
    $("journalSearch")
      .value
      .trim()
      .toLowerCase();


  const result =
    $("journalResultFilter")
      .value;


  const type =
    $("journalTypeFilter")
      .value;


  const date =
    $("journalDateFilter")
      .value;


  const trades =
    state.trades.filter(
      trade => {

        const searchable = [

          trade.pair,

          trade.strategy,

          trade.direction,

          trade.session,

          trade.tradingType,

          trade.result

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

      }
    );


  const tbody =
    $("journalTableBody");


  if(!trades.length){

    tbody.innerHTML = `
      <tr>
        <td
          colspan="10"
          style="
            text-align:center;
            padding:35px;
            color:#888;
          "
        >
          No trades found.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    trades.map(
      trade => {

        const pl =
          number(
            trade.profitLoss
          );


        const resultClass =
          trade.result === "Win"
            ? "result-win"
            : trade.result === "Loss"
              ? "result-loss"
              : "result-be";


        const rr =
          number(trade.rr) > 0
            ? `1:${number(
                trade.rr
              ).toFixed(2)}`
            : "-";


        return `
          <tr>

            <td>
              ${escapeHtml(
                trade.date || "-"
              )}
            </td>


            <td>

              <strong>
                ${escapeHtml(
                  trade.pair ||
                  "XAUUSD"
                )}
              </strong>

            </td>


            <td>
              ${escapeHtml(
                trade.tradingType ||
                "-"
              )}
            </td>


            <td>
              ${escapeHtml(
                trade.direction ||
                "-"
              )}
            </td>


            <td>
              ${escapeHtml(
                trade.strategy ||
                "-"
              )}
            </td>


            <td>
              ${
                trade.entry !== undefined &&
                trade.entry !== null &&
                trade.entry !== ""
                  ? escapeHtml(
                      trade.entry
                    )
                  : "-"
              }
            </td>


            <td>
              ${rr}
            </td>


            <td class="${resultClass}">

              ${escapeHtml(
                trade.result ||
                "-"
              )}

            </td>


            <td
              class="${
                pl >= 0
                  ? "result-win"
                  : "result-loss"
              }"
            >

              ${
                pl >= 0
                  ? "+"
                  : ""
              }

              ${money(pl)}

            </td>


            <td>

              <div class="action-buttons">

                <button
                  type="button"
                  class="icon-btn"
                  title="Edit"
                  onclick="editTrade('${escapeHtml(
                    trade.id
                  )}')"
                >
                  ✎
                </button>


                <button
                  type="button"
                  class="icon-btn"
                  title="Delete"
                  onclick="deleteTrade('${escapeHtml(
                    trade.id
                  )}')"
                >
                  ×
                </button>

              </div>

            </td>

          </tr>
        `;

      }
    ).join("");

}


/* =========================================================
   JOURNAL FILTER EVENTS
========================================================= */

$("journalSearch")
  .addEventListener(
    "input",
    renderJournal
  );


$("journalResultFilter")
  .addEventListener(
    "change",
    renderJournal
  );


$("journalTypeFilter")
  .addEventListener(
    "change",
    renderJournal
  );


$("journalDateFilter")
  .addEventListener(
    "change",
    renderJournal
  );


$("clearFilters")
  .addEventListener(
    "click",
    () => {

      $("journalSearch").value =
        "";

      $("journalResultFilter").value =
        "";

      $("journalTypeFilter").value =
        "";

      $("journalDateFilter").value =
        "";

      renderJournal();

    }
  );


/* =========================================================
   ANALYTICS PERIOD
========================================================= */

$("analyticsPeriod")
  .addEventListener(
    "change",
    renderAnalytics
  );


function getAnalyticsTrades(){

  const period =
    $("analyticsPeriod")
      .value;


  if(period === "all"){

    return [
      ...state.trades
    ];

  }


  const now =
    new Date();

  let start;


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


  start.setHours(
    0,0,0,0
  );


  return state.trades.filter(
    trade => {

      if(!trade.date)
        return false;


      const tradeDate =
        new Date(
          `${trade.date}T00:00:00`
        );


      return tradeDate >= start;

    }
  );

}


/* =========================================================
   GROUP ANALYTICS
========================================================= */

function groupPerformance(
  trades,
  key
){

  const groups = {};


  trades.forEach(
    trade => {

      const raw =
        trade[key];


      const name =
        raw === undefined ||
        raw === null ||
        String(raw).trim() === ""
          ? "Unknown"
          : String(raw).trim();


      if(!groups[name]){

        groups[name] = {

          name,

          trades:0,

          wins:0,

          losses:0,

          pl:0

        };

      }


      groups[name].trades++;


      if(
        trade.result ===
        "Win"
      ){

        groups[name].wins++;

      }


      if(
        trade.result ===
        "Loss"
      ){

        groups[name].losses++;

      }


      groups[name].pl +=
        number(
          trade.profitLoss
        );

    }
  );


  return Object.values(
    groups
  ).sort(
    (a,b) =>
      b.pl - a.pl
  );

}


/* =========================================================
   BREAKDOWN
========================================================= */

function renderBreakdown(
  elementId,
  data
){

  const container =
    $(elementId);


  if(!data.length){

    container.innerHTML = `
      <div class="empty-state">
        No data available.
      </div>
    `;

    return;

  }


  const max =
    Math.max(
      ...data.map(
        item =>
          Math.abs(item.pl)
      ),
      1
    );


  container.innerHTML =
    data.map(
      item => {

        const winRate =
          item.trades > 0
            ? item.wins /
              item.trades *
              100
            : 0;


        const width =
          Math.min(
            100,
            Math.max(
              4,
              Math.abs(item.pl) /
              max *
              100
            )
          );


        return `
          <div class="breakdown-row">

            <div class="breakdown-top">

              <strong>
                ${escapeHtml(
                  item.name
                )}
              </strong>

              <span>
                ${item.trades}
                ${
                  item.trades === 1
                    ? "trade"
                    : "trades"
                }
              </span>

            </div>


            <div class="progress">

              <span
                style="
                  width:${width}%;
                "
              ></span>

            </div>


            <div class="breakdown-bottom">

              <span>
                WR ${winRate.toFixed(1)}%
              </span>


              <span
                class="${
                  item.pl >= 0
                    ? "result-win"
                    : "result-loss"
                }"
              >

                ${
                  item.pl >= 0
                    ? "+"
                    : ""
                }

                ${money(item.pl)}

              </span>

            </div>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics(){

  const trades =
    getAnalyticsTrades();


  const stats =
    calculateStats(
      trades
    );


  $("analyticsPL")
    .textContent =
    money(
      stats.totalPL
    );


  $("analyticsWinRate")
    .textContent =
    `${stats.winRate.toFixed(1)}%`;


  $("analyticsAvgWin")
    .textContent =
    money(
      stats.averageWin
    );


  $("analyticsAvgLoss")
    .textContent =
    money(
      stats.averageLoss
    );


  $("analyticsPF")
    .textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor.toFixed(2);


  $("analyticsExpectancy")
    .textContent =
    money(
      stats.expectancy
    );


  renderBreakdown(
    "pairAnalytics",
    groupPerformance(
      trades,
      "pair"
    )
  );


  renderBreakdown(
    "strategyAnalytics",
    groupPerformance(
      trades,
      "strategy"
    )
  );


  renderBreakdown(
    "typeAnalytics",
    groupPerformance(
      trades,
      "tradingType"
    )
  );


  renderBreakdown(
    "sessionAnalytics",
    groupPerformance(
      trades,
      "session"
    )
  );


  renderBreakdown(
    "directionAnalytics",
    groupPerformance(
      trades,
      "direction"
    )
  );


  renderResultDistribution(
    trades
  );


  renderDailyAnalytics(
    trades
  );

}


/* =========================================================
   RESULT DISTRIBUTION
========================================================= */

function renderResultDistribution(
  trades
){

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


  const be =
    trades.filter(
      trade =>
        trade.result ===
        "Break Even"
    ).length;


  const total =
    trades.length;


  const safeTotal =
    total || 1;


  const data = [

    {
      name:"Wins",
      value:wins,
      color:"var(--green)"
    },

    {
      name:"Losses",
      value:losses,
      color:"var(--red)"
    },

    {
      name:"Break Even",
      value:be,
      color:"var(--orange)"
    }

  ];


  $("resultAnalytics")
    .innerHTML =
    data.map(
      item => {

        const percent =
          item.value /
          safeTotal *
          100;


        return `
          <div class="result-line">

            <span
              style="
                color:${item.color};
              "
            >
              ${item.name}
            </span>


            <div
              class="result-line-bar"
            >

              <span
                style="
                  width:${percent}%;
                  background:${item.color};
                "
              ></span>

            </div>


            <strong>
              ${item.value}
            </strong>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   DAILY ANALYTICS
========================================================= */

function renderDailyAnalytics(
  trades
){

  const groups = {};


  trades.forEach(
    trade => {

      const date =
        trade.date ||
        "Unknown";


      if(!groups[date]){

        groups[date] = {

          date,

          pl:0,

          trades:0

        };

      }


      groups[date].pl +=
        number(
          trade.profitLoss
        );


      groups[date].trades++;

    }
  );


  const rows =
    Object.values(
      groups
    ).sort(
      (a,b) => {

        if(
          a.date === "Unknown"
        )
          return 1;

        if(
          b.date === "Unknown"
        )
          return -1;

        return (
          new Date(
            `${b.date}T00:00:00`
          ) -
          new Date(
            `${a.date}T00:00:00`
          )
        );

      }
    );


  if(!rows.length){

    $("dailyAnalytics")
      .innerHTML = `
        <div class="empty-state">
          No data available.
        </div>
      `;

    return;

  }


  const max =
    Math.max(
      ...rows.map(
        row =>
          Math.abs(row.pl)
      ),
      1
    );


  $("dailyAnalytics")
    .innerHTML =
    rows.map(
      row => {

        const width =
          Math.max(
            4,
            Math.abs(row.pl) /
            max *
            100
          );


        return `
          <div class="daily-row">

            <span>
              ${escapeHtml(
                row.date
              )}
            </span>


            <div class="daily-bar">

              <span
                style="
                  width:${width}%;
                  background:${
                    row.pl >= 0
                      ? "var(--green)"
                      : "var(--red)"
                  };
                "
              ></span>

            </div>


            <strong
              class="${
                row.pl >= 0
                  ? "result-win"
                  : "result-loss"
              }"
            >

              ${
                row.pl >= 0
                  ? "+"
                  : ""
              }

              ${money(row.pl)}

            </strong>

          </div>
        `;

      }
    ).join("");

}


/* =========================================================
   EQUITY CURVE
========================================================= */

function drawEquityChart(){

  const canvas =
    $("equityChart");


  if(!canvas)
    return;


  const width =
    Math.max(
      canvas.clientWidth,
      200
    );


  const height =
    270;


  const dpr =
    window.devicePixelRatio ||
    1;


  canvas.width =
    width * dpr;


  canvas.height =
    height * dpr;


  canvas.style.height =
    `${height}px`;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
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
    [...state.trades]
      .sort(
        (a,b) => {

          const dateA =
            new Date(
              `${a.date || "1970-01-01"}T00:00:00`
            );

          const dateB =
            new Date(
              `${b.date || "1970-01-01"}T00:00:00`
            );

          if(
            dateA - dateB !== 0
          ){

            return dateA - dateB;

          }

          return (
            number(
              a.createdAtMillis
            ) -
            number(
              b.createdAtMillis
            )
          );

        }
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
    number(
      state.startingBalance
    );


  const points = [];


  trades.forEach(
    trade => {

      equity +=
        number(
          trade.profitLoss
        );

      points.push(
        equity
      );

    }
  );


  const min =
    Math.min(
      ...points
    );


  const max =
    Math.max(
      ...points
    );


  const range =
    max - min || 1;


  const padding = 25;


  ctx.beginPath();


  points.forEach(
    (value,index) => {

      const x =
        padding +
        (
          index /
          Math.max(
            points.length - 1,
            1
          )
        ) *
        (
          width -
          padding * 2
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


      if(index === 0){

        ctx.moveTo(
          x,
          y
        );

      }else{

        ctx.lineTo(
          x,
          y
        );

      }

    }
  );


  ctx.strokeStyle =
    "#d6ae55";

  ctx.lineWidth =
    2;

  ctx.stroke();


  points.forEach(
    (value,index) => {

      const x =
        padding +
        (
          index /
          Math.max(
            points.length - 1,
            1
          )
        ) *
        (
          width -
          padding * 2
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

    }
  );

}


window.addEventListener(
  "resize",
  () => {

    if(
      $("page-dashboard")
        .classList
        .contains("active-page")
    ){

      drawEquityChart();

    }

  }
);


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );


function exportCSV(){

  if(!state.trades.length){

    window.alert(
      "There are no trades to export."
    );

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
    state.trades.map(
      trade => [

        trade.tradeId || "",

        trade.date || "",

        trade.pair ||
          "XAUUSD",

        trade.tradingType ||
          "",

        trade.direction ||
          "",

        trade.strategy ||
          "",

        trade.session ||
          "",

        trade.marketBias ||
          "",

        trade.entry ??
          "",

        trade.sl ??
          "",

        trade.tp ??
          "",

        trade.rr ??
          "",

        trade.riskAmount ??
          "",

        trade.lotSize ??
          "",

        trade.result ||
          "",

        trade.profitLoss ??
          "",

        trade.confidence ||
          "",

        trade.emotion ||
          "",

        trade.notes ||
          ""

      ]
    );


  const csvRows = [

    headers,

    ...rows

  ];


  const csv =
    csvRows
      .map(
        row =>
          row
            .map(
              value => {

                const text =
                  String(
                    value ?? ""
                  );

                return `"${text.replaceAll(
                  '"',
                  '""'
                )}"`;

              }
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


  link.href =
    url;


  link.download =
    `UjR-Fx-Trading-Journal-${getToday()}.csv`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

function calculateRisk(){

  const balance =
    number(
      $("calcBalance").value
    );


  const riskPercent =
    number(
      $("calcRiskPercent").value
    );


  const entry =
    number(
      $("calcEntry").value
    );


  const sl =
    number(
      $("calcSL").value
    );


  const tp =
    number(
      $("calcTP").value
    );


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
      ? reward /
        stopDistance
      : 0;


  /*
    Approximate XAUUSD lot calculation.
    This is a journal calculator, not a broker
    execution calculation.
  */

  const lot =
    stopDistance > 0
      ? riskAmount /
        (
          stopDistance *
          100
        )
      : 0;


  $("calcRiskAmount")
    .textContent =
    money(
      riskAmount
    );


  $("calcStopDistance")
    .textContent =
    stopDistance > 0
      ? stopDistance.toFixed(3)
      : "0";


  $("calcRR")
    .textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0";


  $("calcLot")
    .textContent =
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
].forEach(
  id => {

    $(id)
      .addEventListener(
        "input",
        calculateRisk
      );


    $(id)
      .addEventListener(
        "change",
        calculateRisk
      );

  }
);


/* =========================================================
   CALENDAR
========================================================= */

$("prevMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate
        .setMonth(
          state.calendarDate
            .getMonth() - 1
        );


      renderCalendar();

    }
  );


$("nextMonth")
  .addEventListener(
    "click",
    () => {

      state.calendarDate
        .setMonth(
          state.calendarDate
            .getMonth() + 1
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


  $("calendarTitle")
    .textContent =
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
    [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ];


  let html =
    names
      .map(
        name => `
          <div class="calendar-day-name">
            ${name}
          </div>
        `
      )
      .join("");


  for(
    let i = 0;
    i < firstDay;
    i++
  ){

    html +=
      `<div class="calendar-cell empty"></div>`;

  }


  for(
    let day = 1;
    day <= days;
    day++
  ){

    const dateString =
      `${year}-${String(
        month + 1
      ).padStart(2,"0")}-${String(
        day
      ).padStart(2,"0")}`;


    const trades =
      state.trades.filter(
        trade =>
          trade.date ===
          dateString
      );


    const pl =
      trades.reduce(
        (sum,trade) =>
          sum +
          number(
            trade.profitLoss
          ),
        0
      );


    const plClass =
      pl >= 0
        ? "result-win"
        : "result-loss";


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
                class="calendar-pl ${plClass}"
              >

                ${
                  pl >= 0
                    ? "+"
                    : ""
                }

                ${money(pl)}

              </div>

              <div class="calendar-count">

                ${trades.length}

                ${
                  trades.length === 1
                    ? "trade"
                    : "trades"
                }

              </div>
            `
            : ""
        }

      </div>
    `;

  }


  $("calendarGrid")
    .innerHTML =
    html;


  document
    .querySelectorAll(
      ".calendar-cell[data-date]"
    )
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          () => {

            renderCalendarTrades(
              cell.dataset.date
            );

          }
        );

      }
    );

}


/* =========================================================
   CALENDAR TRADE DETAILS
========================================================= */

function renderCalendarTrades(
  date
){

  const trades =
    state.trades.filter(
      trade =>
        trade.date ===
        date
    );


  if(!trades.length){

    $("calendarTrades")
      .innerHTML = `
        <div class="panel">

          <span
            style="
              color:#888;
              font-size:11px;
            "
          >
            No trades on ${escapeHtml(
              date
            )}.

          </span>

        </div>
      `;

    return;

  }


  $("calendarTrades")
    .innerHTML = `

      <div class="panel">

        <div class="panel-header">

          <div>

            <h2>
              ${escapeHtml(
                date
              )}
            </h2>

            <span>
              ${trades.length}
              ${
                trades.length === 1
                  ? "trade"
                  : "trades"
              }
            </span>

          </div>

        </div>


        ${trades.map(
          trade => {

            const pl =
              number(
                trade.profitLoss
              );


            return `

              <div class="recent-trade">

                <div class="recent-main">

                  <strong>

                    ${escapeHtml(
                      trade.pair ||
                      "XAUUSD"
                    )}

                  </strong>

                  <span>

                    ${escapeHtml(
                      trade.strategy ||
                      "-"
                    )}

                    ·

                    ${escapeHtml(
                      trade.result ||
                      "-"
                    )}

                  </span>

                </div>


                <div
                  class="${
                    pl >= 0
                      ? "result-win"
                      : "result-loss"
                  }"
                >

                  ${
                    pl >= 0
                      ? "+"
                      : ""
                  }

                  ${money(pl)}

                </div>

              </div>

            `;

          }
        ).join("")}

      </div>

    `;

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

$("saveSettings")
  .addEventListener(
    "click",
    async () => {

      if(!state.user)
        return;


      const startingBalance =
        number(
          $("startingBalance")
            .value
        );


      const currency =
        $("currencySelect")
          .value;


      try{

        /*
          Use a fixed settings document.
          This avoids creating multiple settings
          documents every time the user saves.
        */

        const settingsRef =
          doc(
            db,
            "users",
            state.user.uid,
            "settings",
            "main"
          );


        await setDoc(
          settingsRef,
          {
            startingBalance,

            currency,

            updatedAt:
              serverTimestamp()
          },
          {
            merge:true
          }
        );


        state.startingBalance =
          startingBalance;


        state.currency =
          currency;


        $("settingsMessage")
          .textContent =
          "Settings saved successfully.";


        renderAll();


        setTimeout(
          () => {

            $("settingsMessage")
              .textContent =
              "";

          },
          2500
        );


      }catch(error){

        console.error(
          "Settings save error:",
          error
        );


        $("settingsMessage")
          .textContent =
          "Could not save settings.";

      }

    }
  );


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      try{

        await signOut(
          auth
        );

      }catch(error){

        console.error(
          "Logout error:",
          error
        );

      }

    }
  );


/* =========================================================
   INITIALIZE
========================================================= */

$("tradeDate")
  .value =
  getToday();


$("tradeId")
  .value =
  generateTradeId();


$("pair")
  .value =
  "XAUUSD";


$("tradingType")
  .value =
  "Scalping";


$("result")
  .value =
  "Win";


renderCalendar();

calculateRisk();
