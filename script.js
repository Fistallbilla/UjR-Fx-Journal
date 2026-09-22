/* =========================================================
   UjR Fx Trading Journal
   Firebase + Firestore
   ========================================================= */

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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

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


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const provider = new GoogleAuthProvider();


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let trades = [];

let account = {

  startingBalance: 0,

  currency: "USD"

};

let unsubscribeTrades = null;

let calendarDate = new Date();

let toastTimer = null;


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id =>
  document.getElementById(id);


function number(value) {

  const n = parseFloat(value);

  return Number.isFinite(n) ? n : 0;

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

  const d = new Date();

  const year =
    d.getFullYear();

  const month =
    String(d.getMonth() + 1).padStart(2, "0");

  const day =
    String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


function getLocalTime() {

  const d = new Date();

  const hour =
    String(d.getHours()).padStart(2, "0");

  const minute =
    String(d.getMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;

}


function money(value) {

  const currency =
    account.currency || "USD";

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }
  ).format(number(value));

}


function showToast(message, type = "success") {

  const toast =
    $("toast");

  const messageEl =
    $("toastMessage");

  messageEl.textContent =
    message;

  toast.className =
    `toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {

      toast.className =
        "toast";

    }, 3000);

}


/* =========================================================
   LOGIN
   ========================================================= */

$("googleLoginBtn")
  .addEventListener("click", async () => {

    try {

      await signInWithPopup(
        auth,
        provider
      );

    } catch (error) {

      console.error(error);

      showToast(
        error.message || "Login failed.",
        "error"
      );

    }

  });


/* =========================================================
   LOGOUT
   ========================================================= */

$("logoutBtn")
  .addEventListener("click", async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error(error);

      showToast(
        "Logout failed.",
        "error"
      );

    }

  });


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    currentUser = user;

    if (!user) {

      $("loginScreen")
        .classList.remove("hidden");

      $("app")
        .classList.add("hidden");

      if (unsubscribeTrades) {

        unsubscribeTrades();

        unsubscribeTrades = null;

      }

      return;

    }


    $("loginScreen")
      .classList.add("hidden");

    $("app")
      .classList.remove("hidden");


    updateUserUI(user);

    await loadAccount();

    subscribeTrades();

    updateAll();

  }
);


/* =========================================================
   USER UI
   ========================================================= */

function updateUserUI(user) {

  const name =
    user.displayName || "Trader";

  const email =
    user.email || "";

  const photo =
    user.photoURL || "logo.png";


  $("sidebarUserName")
    .textContent = name;

  $("sidebarUserEmail")
    .textContent = email;

  $("sidebarUserPhoto")
    .src = photo;

  $("dashboardUserName")
    .textContent =
    name.split(" ")[0];

  $("settingsName")
    .textContent = name;

  $("settingsEmail")
    .textContent = email;

  $("settingsPhoto")
    .src = photo;

}


/* =========================================================
   FIRESTORE ACCOUNT
   ========================================================= */

async function loadAccount() {

  if (!currentUser) return;


  try {

    const ref =
      doc(
        db,
        "users",
        currentUser.uid,
        "settings",
        "account"
      );


    const snapshot =
      await getDoc(ref);


    if (snapshot.exists()) {

      account =
        {
          ...account,
          ...snapshot.data()
        };

    }


    $("startingBalance").value =
      account.startingBalance || "";

    $("currency").value =
      account.currency || "USD";


    $("calcBalance").value =
      account.startingBalance || "";

  } catch (error) {

    console.error(error);

    showToast(
      "Could not load settings.",
      "error"
    );

  }

}


/* =========================================================
   SAVE SETTINGS
   ========================================================= */

$("saveSettingsBtn")
  .addEventListener(
    "click",
    async () => {

      if (!currentUser) return;


      const startingBalance =
        number(
          $("startingBalance").value
        );

      const currency =
        $("currency").value;


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

          { merge: true }

        );


        $("calcBalance").value =
          startingBalance;


        updateAll();

        showToast(
          "Settings saved."
        );

      } catch (error) {

        console.error(error);

        showToast(
          "Could not save settings.",
          "error"
        );

      }

    }
  );


/* =========================================================
   TRADES SUBSCRIPTION
   ========================================================= */

function subscribeTrades() {

  if (!currentUser) return;


  if (unsubscribeTrades) {

    unsubscribeTrades();

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

        trades =
          snapshot.docs.map(
            docSnapshot => ({

              id:
                docSnapshot.id,

              ...docSnapshot.data()

            })
          );


        trades.sort(
          (a, b) => {

            const aDate =
              `${a.date || ""} ${a.time || ""}`;

            const bDate =
              `${b.date || ""} ${b.time || ""}`;

            return bDate.localeCompare(
              aDate
            );

          }
        );


        updateAll();

      },

      error => {

        console.error(error);

        showToast(
          "Could not load trades.",
          "error"
        );

      }

    );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

document
  .querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  });


document
  .querySelectorAll("[data-go-page]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.goPage
        );

      }
    );

  });


function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove(
        "active-page"
      );

    });


  const target =
    $(pageId);

  if (!target) return;


  target.classList.add(
    "active-page"
  );


  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === pageId
      );

    });


  const titles = {

    dashboardPage:
      "Dashboard",

    journalPage:
      "Journal",

    analyticsPage:
      "Analytics",

    riskPage:
      "Risk Calculator",

    calendarPage:
      "Calendar",

    settingsPage:
      "Settings"

  };


  $("pageTitle")
    .textContent =
    titles[pageId] || "Dashboard";


  if (pageId === "calendarPage") {

    renderCalendar();

  }

}


/* =========================================================
   ADD TRADE BUTTONS
   ========================================================= */

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


/* =========================================================
   MODAL
   ========================================================= */

function openTradeModal(trade = null) {

  $("tradeModal")
    .classList.remove("hidden");


  if (trade) {

    $("modalTitle")
      .textContent =
      "Edit Trade";

    $("editingTradeId")
      .value =
      trade.id;


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
      trade.result || "Win";

    $("profitLoss").value =
      trade.profitLoss ?? 0;

    $("psychology").value =
      trade.psychology || "";

    $("confidence").value =
      trade.confidence || "";

    $("mistake").value =
      trade.mistake || "None";

    $("notes").value =
      trade.notes || "";

  } else {

    $("modalTitle")
      .textContent =
      "Add Trade";

    $("editingTradeId")
      .value = "";


    $("tradeForm").reset();


    $("tradeDate").value =
      getLocalDate();

    $("tradeTime").value =
      getLocalTime();

    $("pair").value =
      "XAUUSD";

    $("direction").value =
      "Buy";

    $("riskPercent").value =
      "1";

    $("result").value =
      "Win";

    $("profitLoss").value =
      "0";

    $("mistake").value =
      "None";

  }


  updateTradeCalculations();

}


function closeTradeModal() {

  $("tradeModal")
    .classList.add("hidden");

}


$("closeModalBtn")
  .addEventListener(
    "click",
    closeTradeModal
  );


$("cancelModalBtn")
  .addEventListener(
    "click",
    closeTradeModal
  );


document
  .querySelector(".modal-overlay")
  .addEventListener(
    "click",
    closeTradeModal
  );


/* =========================================================
   AUTO TRADE CALCULATIONS
   ========================================================= */

function calculateTradeRR() {

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  const tp =
    number($("tp").value);

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


function calculateTradeRisk() {

  const balance =
    number(
      account.startingBalance
    );

  const riskPercent =
    number(
      $("riskPercent").value
    );

  const entry =
    number(
      $("entry").value
    );

  const sl =
    number(
      $("sl").value
    );


  if (
    balance <= 0 ||
    riskPercent <= 0
  ) {

    $("riskAmount").value = "";

    $("lotSize").value = "";

    return;

  }


  const riskAmount =
    balance *
    riskPercent /
    100;


  $("riskAmount").value =
    money(riskAmount);


  const distance =
    Math.abs(
      entry - sl
    );


  const contractSize =
    100;


  if (
    distance > 0
  ) {

    const lot =
      riskAmount /
      (
        distance *
        contractSize
      );


    $("lotSize").value =
      lot.toFixed(2);

  } else {

    $("lotSize").value = "";

  }

}


function updateTradeCalculations() {

  calculateTradeRR();

  calculateTradeRisk();

}


[
  "entry",
  "sl",
  "tp",
  "direction",
  "riskPercent"
].forEach(id => {

  $(id).addEventListener(
    "input",
    updateTradeCalculations
  );

  $(id).addEventListener(
    "change",
    updateTradeCalculations
  );

});


/* =========================================================
   SAVE TRADE
   ========================================================= */

$("tradeForm")
  .addEventListener(
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


      const rr =
        calculateTradeRR();


      if (
        $("rr").value === "Invalid" ||
        rr <= 0
      ) {

        showToast(
          "Please check Entry, SL and TP.",
          "error"
        );

        return;

      }


      calculateTradeRisk();


      const tradeData = {

        date:
          $("tradeDate").value,

        time:
          $("tradeTime").value,

        pair:
          $("pair").value
            .trim()
            .toUpperCase(),

        direction:
          $("direction").value,

        entry:
          number($("entry").value),

        sl:
          number($("sl").value),

        tp:
          number($("tp").value),

        rr:

          rr,

        riskPercent:
          number(
            $("riskPercent").value
          ),

        riskAmount:
          number(
            account.startingBalance
          ) *
          number(
            $("riskPercent").value
          ) /
          100,

        lotSize:
          number(
            $("lotSize").value
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

        result:
          $("result").value,

        profitLoss:
          number(
            $("profitLoss").value
          ),

        psychology:
          $("psychology").value,

        confidence:
          $("confidence").value,

        mistake:
          $("mistake").value,

        notes:
          $("notes").value.trim(),

        updatedAt:
          new Date().toISOString()

      };


      try {

        const editingId =
          $("editingTradeId").value;


        if (editingId) {

          await updateDoc(

            doc(
              db,
              "users",
              currentUser.uid,
              "trades",
              editingId
            ),

            tradeData

          );


          showToast(
            "Trade updated."
          );

        } else {

          await addDoc(

            collection(
              db,
              "users",
              currentUser.uid,
              "trades"
            ),

            tradeData

          );


          showToast(
            "Trade saved."
          );

        }


        closeTradeModal();

      } catch (error) {

        console.error(error);

        showToast(
          error.message ||
          "Could not save trade.",
          "error"
        );

      }

    }
  );


/* =========================================================
   DELETE TRADE
   ========================================================= */

async function deleteTrade(id) {

  if (!currentUser) return;


  const confirmed =
    confirm(
      "Delete this trade?"
    );


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


    showToast(
      "Trade deleted."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete trade.",
      "error"
    );

  }

}


/* =========================================================
   JOURNAL FILTER
   ========================================================= */

$("tradeSearch")
  .addEventListener(
    "input",
    renderJournal
  );


$("tradeFilter")
  .addEventListener(
    "change",
    renderJournal
  );


/* =========================================================
   JOURNAL
   ========================================================= */

function renderJournal() {

  const search =
    $("tradeSearch")
      .value
      .trim()
      .toLowerCase();


  const filter =
    $("tradeFilter").value;


  let filtered =
    [...trades];


  if (search) {

    filtered =
      filtered.filter(
        trade => {

          const text =
            [
              trade.date,
              trade.pair,
              trade.direction,
              trade.setup,
              trade.session,
              trade.result,
              trade.notes
            ]
              .join(" ")
              .toLowerCase();

          return text.includes(search);

        }
      );

  }


  if (filter !== "all") {

    filtered =
      filtered.filter(
        trade =>
          trade.result === filter
      );

  }


  const tbody =
    $("tradeTableBody");


  tbody.innerHTML = "";


  if (!filtered.length) {

    $("journalEmptyState")
      .classList.remove("hidden");

    return;

  }


  $("journalEmptyState")
    .classList.add("hidden");


  filtered.forEach(trade => {

    const tr =
      document.createElement("tr");


    const pl =
      number(
        trade.profitLoss
      );


    const resultClass =
      trade.result === "Win"
        ? "win"
        : trade.result === "Loss"
          ? "loss"
          : "be";


    const plClass =
      pl > 0
        ? "pl-positive"
        : pl < 0
          ? "pl-negative"
          : "";


    tr.innerHTML = `

      <td>
        ${escapeHTML(trade.date || "-")}
      </td>

      <td>
        <strong>
          ${escapeHTML(trade.pair || "-")}
        </strong>
      </td>

      <td>
        ${escapeHTML(trade.direction || "-")}
      </td>

      <td>
        ${number(trade.entry).toFixed(3)}
      </td>

      <td>
        ${number(trade.sl).toFixed(3)}
      </td>

      <td>
        ${number(trade.tp).toFixed(3)}
      </td>

      <td>
        1:${number(trade.rr).toFixed(2)}
      </td>

      <td>

        <span class="result-badge ${resultClass}">
          ${escapeHTML(trade.result || "-")}
        </span>

      </td>

      <td class="${plClass}">
        ${money(pl)}
      </td>

      <td>

        <button
          class="table-action edit"
          data-edit="${trade.id}">
          Edit
        </button>

        <button
          class="table-action delete"
          data-delete="${trade.id}">
          Delete
        </button>

      </td>

    `;


    tbody.appendChild(tr);

  });


  tbody
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const trade =
            trades.find(
              item =>
                item.id ===
                button.dataset.edit
            );


          if (trade) {

            openTradeModal(trade);

          }

        }
      );

    });


  tbody
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteTrade(
            button.dataset.delete
          )
      );

    });

}


/* =========================================================
   JOURNAL STATS
   ========================================================= */

function updateJournalStats() {

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


  const pl =
    trades.reduce(
      (sum, t) =>
        sum +
        number(t.profitLoss),
      0
    );


  const winRate =
    total
      ? wins / total * 100
      : 0;


  $("journalTotal")
    .textContent = total;

  $("journalWins")
    .textContent = wins;

  $("journalLosses")
    .textContent = losses;

  $("journalWinRate")
    .textContent =
    `${winRate.toFixed(1)}%`;

  $("journalPL")
    .textContent =
    money(pl);

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function calculateStats() {

  const total =
    trades.length;


  const wins =
    trades.filter(
      t => t.result === "Win"
    );


  const losses =
    trades.filter(
      t => t.result === "Loss"
    );


  const totalPL =
    trades.reduce(
      (sum, t) =>
        sum +
        number(t.profitLoss),
      0
    );


  const grossProfit =
    wins.reduce(
      (sum, t) =>
        sum +
        Math.max(
          0,
          number(t.profitLoss)
        ),
      0
    );


  const grossLoss =
    losses.reduce(
      (sum, t) =>
        sum +
        Math.abs(
          number(t.profitLoss)
        ),
      0
    );


  const winRate =
    total
      ? wins.length / total * 100
      : 0;


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const avgRR =
    total
      ? trades.reduce(
          (sum, t) =>
            sum + number(t.rr),
          0
        ) / total
      : 0;


  const avgWin =
    wins.length
      ? grossProfit / wins.length
      : 0;


  const avgLoss =
    losses.length
      ? grossLoss / losses.length
      : 0;


  const expectancy =
    total
      ? totalPL / total
      : 0;


  let equity =
    number(account.startingBalance);

  let peak =
    equity;

  let maxDrawdown =
    0;


  const chronological =
    [...trades].sort(
      (a, b) => {

        const ad =
          `${a.date || ""} ${a.time || ""}`;

        const bd =
          `${b.date || ""} ${b.time || ""}`;

        return ad.localeCompare(bd);

      }
    );


  chronological.forEach(trade => {

    equity +=
      number(trade.profitLoss);


    if (equity > peak) {

      peak = equity;

    }


    const drawdown =
      peak - equity;


    if (drawdown > maxDrawdown) {

      maxDrawdown =
        drawdown;

    }

  });


  return {

    total,
    wins: wins.length,
    losses: losses.length,
    totalPL,
    grossProfit,
    grossLoss,
    winRate,
    profitFactor,
    avgRR,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown

  };

}


function renderDashboard() {

  const stats =
    calculateStats();


  const balance =
    number(
      account.startingBalance
    ) +
    stats.totalPL;


  $("dashboardBalance")
    .textContent =
    money(balance);


  $("dashboardPL")
    .textContent =
    money(stats.totalPL);


  $("dashboardWinRate")
    .textContent =
    `${stats.winRate.toFixed(1)}%`;


  $("dashboardTrades")
    .textContent =
    stats.total;


  $("dashboardProfitFactor")
    .textContent =
    Number.isFinite(
      stats.profitFactor
    )
      ? stats.profitFactor.toFixed(2)
      : "∞";


  $("dashboardRR")
    .textContent =
    stats.avgRR.toFixed(2);


  $("summaryWins")
    .textContent =
    stats.wins;


  $("summaryLosses")
    .textContent =
    stats.losses;


  $("summaryAvgWin")
    .textContent =
    money(stats.avgWin);


  $("summaryAvgLoss")
    .textContent =
    money(-stats.avgLoss);


  $("summaryDrawdown")
    .textContent =
    money(-stats.maxDrawdown);


  $("summaryExpectancy")
    .textContent =
    money(stats.expectancy);


  renderRecentTrades();

}


/* =========================================================
   RECENT TRADES
   ========================================================= */

function renderRecentTrades() {

  const container =
    $("recentTrades");


  const recent =
    trades.slice(0, 6);


  if (!recent.length) {

    container.innerHTML = `

      <div class="empty-state">

        <div class="empty-icon">
          ▤
        </div>

        <h3>
          No trades yet
        </h3>

        <p>
          Add your first trade to start tracking.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    recent.map(trade => {

      const pl =
        number(
          trade.profitLoss
        );


      return `

        <div class="recent-trade">

          <div class="recent-left">

            <span
              class="direction-dot ${
                trade.direction === "Buy"
                  ? "buy"
                  : "sell"
              }">
            </span>

            <div>

              <strong>
                ${escapeHTML(
                  trade.pair || "XAUUSD"
                )}
              </strong>

              <span>
                ${escapeHTML(
                  trade.date || "-"
                )}
                ·
                ${escapeHTML(
                  trade.direction || "-"
                )}
              </span>

            </div>

          </div>


          <span class="recent-pl ${
            pl > 0
              ? "pl-positive"
              : pl < 0
                ? "pl-negative"
                : ""
          }">

            ${money(pl)}

          </span>

        </div>

      `;

    }).join("");

}


/* =========================================================
   ANALYTICS
   ========================================================= */

function renderAnalytics() {

  const stats =
    calculateStats();


  const total =
    Math.max(
      1,
      trades.length
    );


  const wins =
    stats.wins;


  const losses =
    stats.losses;


  const be =
    trades.filter(
      t => t.result === "BE"
    ).length;


  $("winBar")
    .style.width =
    `${wins / total * 100}%`;

  $("lossBar")
    .style.width =
    `${losses / total * 100}%`;

  $("beBar")
    .style.width =
    `${be / total * 100}%`;


  $("winBarText")
    .textContent =
    wins;


  $("lossBarText")
    .textContent =
    losses;


  $("beBarText")
    .textContent =
    be;


  const buys =
    trades.filter(
      t => t.direction === "Buy"
    );


  const sells =
    trades.filter(
      t => t.direction === "Sell"
    );


  const buyWins =
    buys.filter(
      t => t.result === "Win"
    ).length;


  const sellWins =
    sells.filter(
      t => t.result === "Win"
    ).length;


  $("buyTrades")
    .textContent =
    buys.length;


  $("sellTrades")
    .textContent =
    sells.length;


  $("buyWinRate")
    .textContent =
    buys.length
      ? `${(
          buyWins /
          buys.length *
          100
        ).toFixed(1)}%`
      : "0%";


  $("sellWinRate")
    .textContent =
    sells.length
      ? `${(
          sellWins /
          sells.length *
          100
        ).toFixed(1)}%`
      : "0%";


  renderGroupedAnalytics(
    "session",
    "sessionAnalytics"
  );


  renderGroupedAnalytics(
    "setup",
    "setupAnalytics"
  );

}


function renderGroupedAnalytics(
  field,
  elementId
) {

  const container =
    $(elementId);


  const groups = {};


  trades.forEach(trade => {

    const key =
      trade[field] || "Not Set";


    if (!groups[key]) {

      groups[key] = {

        total: 0,
        wins: 0,
        pl: 0

      };

    }


    groups[key].total++;

    if (trade.result === "Win") {

      groups[key].wins++;

    }

    groups[key].pl +=
      number(
        trade.profitLoss
      );

  });


  const keys =
    Object.keys(groups);


  if (!keys.length) {

    container.innerHTML = `

      <div>

        <span>
          No data yet
        </span>

        <strong>
          —
        </strong>

      </div>

    `;

    return;

  }


  container.innerHTML =
    keys.map(key => {

      const item =
        groups[key];


      return `

        <div>

          <span>
            ${escapeHTML(key)}
          </span>

          <strong>
            ${item.total} trades ·
            ${
              item.total
                ? (
                    item.wins /
                    item.total *
                    100
                  ).toFixed(0)
                : 0
            }%
          </strong>

        </div>

      `;

    }).join("");

}


/* =========================================================
   RISK CALCULATOR
   ========================================================= */

[
  "calcBalance",
  "calcRiskPercent",
  "calcEntry",
  "calcSL",
  "calcTP",
  "calcContractSize"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateRiskCalculator
  );

});


function calculateRiskCalculator() {

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


  const contractSize =
    number(
      $("calcContractSize").value
    ) || 100;


  const riskAmount =
    balance *
    riskPercent /
    100;


  const distance =
    Math.abs(
      entry - sl
    );


  const rewardDistance =
    Math.abs(
      tp - entry
    );


  const lotSize =
    distance > 0
      ? riskAmount /
        (
          distance *
          contractSize
        )
      : 0;


  const potentialProfit =
    rewardDistance *
    contractSize *
    lotSize;


  const rr =
    distance > 0
      ? rewardDistance /
        distance
      : 0;


  $("calcRiskAmount")
    .textContent =
    money(riskAmount);


  $("calcLotSize")
    .textContent =
    lotSize.toFixed(2);


  $("calcPotentialProfit")
    .textContent =
    money(potentialProfit);


  $("calcRR")
    .textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "0.00";

}


/* =========================================================
   CALENDAR
   ========================================================= */

$("prevMonthBtn")
  .addEventListener(
    "click",
    () => {

      calendarDate.setMonth(
        calendarDate.getMonth() - 1
      );

      renderCalendar();

    }
  );


$("nextMonthBtn")
  .addEventListener(
    "click",
    () => {

      calendarDate.setMonth(
        calendarDate.getMonth() + 1
      );

      renderCalendar();

    }
  );


function renderCalendar() {

  const year =
    calendarDate.getFullYear();


  const month =
    calendarDate.getMonth();


  const monthName =
    calendarDate.toLocaleString(
      "default",
      {
        month: "long"
      }
    );


  $("calendarMonth")
    .textContent =
    `${monthName} ${year}`;


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


  const today =
    new Date();


  const grid =
    $("calendarGrid");


  grid.innerHTML = "";


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const blank =
      document.createElement("div");

    blank.className =
      "calendar-day empty";

    grid.appendChild(blank);

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    const dayTrades =
      trades.filter(
        trade =>
          trade.date ===
          dateString
      );


    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";


    if (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    ) {

      cell.classList.add(
        "today"
      );

    }


    cell.innerHTML = `

      <div class="calendar-day-number">
        ${day}
      </div>

      <div class="calendar-trades">

        ${dayTrades
          .slice(0, 3)
          .map(
            trade => `

              <div class="calendar-trade">

                ${escapeHTML(
                  trade.pair || "Trade"
                )}
                ·
                ${escapeHTML(
                  trade.result || ""
                )}

              </div>

            `
          )
          .join("")}

        ${
          dayTrades.length > 3
            ? `
              <div class="calendar-trade">
                +${dayTrades.length - 3} more
              </div>
            `
            : ""
        }

      </div>

    `;


    grid.appendChild(cell);

  }

}


/* =========================================================
   CSV EXPORT
   ========================================================= */

$("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );


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
    "P/L",
    "Psychology",
    "Confidence",
    "Mistake",
    "Notes"

  ];


  const rows =
    trades.map(trade => [

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
      trade.psychology,
      trade.confidence,
      trade.mistake,
      trade.notes

    ]);


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
    `UjR-Fx-Trading-Journal-${getLocalDate()}.csv`;


  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);


  showToast(
    "CSV exported."
  );

}


/* =========================================================
   DATE / TIME
   ========================================================= */

function updateDateTime() {

  const now =
    new Date();


  $("currentDateTime")
    .textContent =
    now.toLocaleString(
      "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

}


setInterval(
  updateDateTime,
  1000
);


updateDateTime();


/* =========================================================
   UPDATE EVERYTHING
   ========================================================= */

function updateAll() {

  updateJournalStats();

  renderJournal();

  renderDashboard();

  renderAnalytics();

  calculateRiskCalculator();

  renderCalendar();

}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        !$("tradeModal")
          .classList.contains("hidden")
      ) {

        closeTradeModal();

      }


      if (
        event.key.toLowerCase() === "n" &&
        !$("tradeModal")
          .classList.contains("hidden") === false
      ) {

        const tag =
          document.activeElement?.tagName;

        if (
          tag !== "INPUT" &&
          tag !== "TEXTAREA" &&
          tag !== "SELECT"
        ) {

          openTradeModal();

        }

      }

    }
  );


/* =========================================================
   INITIAL
   ========================================================= */

renderCalendar();
