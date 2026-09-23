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

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";


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
const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const number = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const money = value => {
  const currency = window.appCurrency || "$";
  const n = number(value);

  if (currency === "Rs") {
    return `Rs ${n.toFixed(2)}`;
  }

  return `${currency}${n.toFixed(2)}`;
};

const escapeHTML = value => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const todayString = () => {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const nowTimeString = () => {
  const d = new Date();

  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

const safeFileName = name => {
  return String(name || "chart")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
};


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let trades = [];

let unsubscribeTrades = null;

let startingBalance = 0;
window.appCurrency = "$";

let calendarDate = new Date();

let pendingImageFile = null;
let existingImageUrl = "";
let existingImagePath = "";
let removeExistingImage = false;

let manualLotSize = false;


/* =========================================================
   AUTH
========================================================= */

$("loginBtn").addEventListener("click", async () => {

  $("loginError").textContent = "";

  try {

    await signInWithPopup(auth, googleProvider);

  } catch (error) {

    console.error(error);

    $("loginError").textContent =
      error.message || "Google login failed.";

  }

});


$("logoutBtn").addEventListener("click", async () => {

  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
  }

});


onAuthStateChanged(auth, async user => {

  currentUser = user;

  if (!user) {

    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");

    if (unsubscribeTrades) {
      unsubscribeTrades();
      unsubscribeTrades = null;
    }

    return;
  }


  $("loginScreen").classList.add("hidden");
  $("app").classList.remove("hidden");


  updateUserUI(user);

  await loadSettings();

  listenToTrades();

  updateTopDate();

  setInterval(updateTopDate, 60000);

});


/* =========================================================
   USER UI
========================================================= */

function updateUserUI(user) {

  const photo = user.photoURL || "logo.png";
  const name = user.displayName || "Trader";
  const email = user.email || "";

  $("userPhoto").src = photo;
  $("userName").textContent = name;
  $("userEmail").textContent = email;

  $("settingsPhoto").src = photo;
  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;

  $("dashboardUserName").textContent =
    name.split(" ")[0] || "Trader";

}


function updateTopDate() {

  const d = new Date();

  $("topDate").textContent =
    d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

}


/* =========================================================
   SETTINGS
========================================================= */

async function loadSettings() {

  if (!currentUser) return;

  try {

    const settingsRef =
      doc(db, "users", currentUser.uid);

    const snapshot = await getDoc(settingsRef);

    if (snapshot.exists()) {

      const data = snapshot.data();

      startingBalance = number(data.startingBalance);

      window.appCurrency =
        data.currency || "$";

    } else {

      startingBalance = 0;
      window.appCurrency = "$";

      await setDoc(settingsRef, {
        startingBalance: 0,
        currency: "$"
      });

    }

    $("startingBalance").value = startingBalance;
    $("currency").value = window.appCurrency;

    $("calcBalance").value = startingBalance;

  } catch (error) {

    console.error("Settings error:", error);

  }

}


$("saveSettingsBtn").addEventListener("click", async () => {

  if (!currentUser) return;

  const balance =
    number($("startingBalance").value);

  const currency =
    $("currency").value || "$";

  try {

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        startingBalance: balance,
        currency
      },
      { merge: true }
    );

    startingBalance = balance;
    window.appCurrency = currency;

    $("calcBalance").value = balance;

    renderAll();

    showToast("Settings saved.");

  } catch (error) {

    console.error(error);
    showToast("Could not save settings.");

  }

});


/* =========================================================
   FIRESTORE TRADES
========================================================= */

function getTradesCollection() {

  return collection(
    db,
    "users",
    currentUser.uid,
    "trades"
  );

}


function listenToTrades() {

  if (!currentUser) return;

  if (unsubscribeTrades) {
    unsubscribeTrades();
  }

  const tradesRef = getTradesCollection();

  const q = query(
    tradesRef,
    orderBy("createdAt", "desc")
  );

  unsubscribeTrades = onSnapshot(
    q,
    snapshot => {

      trades = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      renderAll();

    },
    error => {

      console.error("Trades listener:", error);

      showToast(
        "Could not load trades. Check Firestore rules."
      );

    }
  );

}


/* =========================================================
   TRADE CALCULATIONS
========================================================= */

function calculateTradeRR() {

  const entry = number($("entry").value);
  const sl = number($("sl").value);
  const tp = number($("tp").value);
  const direction = $("direction").value;

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

  if (risk <= 0 || reward <= 0) {

    $("rr").value = "Invalid";

    return 0;
  }

  const rr = reward / risk;

  $("rr").value =
    `1:${rr.toFixed(2)}`;

  return rr;

}


function calculateRiskAmount() {

  const balance = startingBalance ||
    number($("startingBalance").value);

  const riskPercent =
    number($("riskPercent").value);

  const riskAmount =
    balance * riskPercent / 100;

  $("riskAmount").value =
    riskAmount > 0
      ? riskAmount.toFixed(2)
      : "";

  return riskAmount;

}


function calculateAutoLot() {

  const riskAmount =
    calculateRiskAmount();

  const entry =
    number($("entry").value);

  const sl =
    number($("sl").value);

  if (
    riskAmount <= 0 ||
    entry <= 0 ||
    sl <= 0
  ) {
    return 0;
  }

  const distance =
    Math.abs(entry - sl);

  if (distance <= 0) {
    return 0;
  }

  // Simplified XAUUSD:
  // 1 lot = 100 oz

  const lot =
    riskAmount / (distance * 100);

  return lot;
}


function updateLotSize() {

  if (manualLotSize) return;

  const lot = calculateAutoLot();

  $("lotSize").value =
    lot > 0
      ? lot.toFixed(2)
      : "";

}


/* =========================================================
   PROFIT / LOSS AUTO SIGN
========================================================= */

function updateProfitLossSign() {

  const result =
    $("result").value;

  const input =
    $("profitLoss");

  const raw =
    number(input.value);

  const absolute =
    Math.abs(raw);


  if (result === "Win") {

    input.value =
      absolute > 0
        ? absolute
        : "";

  }

  else if (result === "Loss") {

    input.value =
      absolute > 0
        ? -absolute
        : "";

  }

  else if (result === "Breakeven") {

    input.value = "0";

  }

}


/* =========================================================
   IMAGE SYSTEM
========================================================= */

$("tradeImage").addEventListener(
  "change",
  event => {

    const file =
      event.target.files?.[0];

    if (!file) return;


    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp"
    ];

    if (!allowed.includes(file.type)) {

      showToast(
        "Only PNG, JPG and WEBP images are allowed."
      );

      event.target.value = "";
      return;

    }


    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {

      showToast(
        "Image must be smaller than 5MB."
      );

      event.target.value = "";
      return;

    }


    pendingImageFile = file;
    removeExistingImage = false;

    const reader =
      new FileReader();

    reader.onload = e => {

      $("imagePreview").src =
        e.target.result;

      $("imagePreviewWrap")
        .classList.remove("hidden");

      $("imageUploadStatus").textContent =
        "New image selected";

    };

    reader.readAsDataURL(file);

  }
);


$("removeImageBtn").addEventListener(
  "click",
  () => {

    pendingImageFile = null;

    if (existingImageUrl) {
      removeExistingImage = true;
    }

    $("tradeImage").value = "";

    $("imagePreview").src = "";

    $("imagePreviewWrap")
      .classList.add("hidden");

    $("imageUploadStatus").textContent =
      "";

  }
);


async function uploadTradeImage(
  file,
  tradeId
) {

  const filename =
    `${Date.now()}_${safeFileName(file.name)}`;

  const path =
    `users/${currentUser.uid}/trades/${tradeId}/${filename}`;

  const storageRef =
    ref(storage, path);

  await uploadBytes(
    storageRef,
    file,
    {
      contentType: file.type
    }
  );

  const url =
    await getDownloadURL(storageRef);

  return {
    url,
    path
  };

}


async function deleteTradeImage(path) {

  if (!path) return;

  try {

    const imageRef =
      ref(storage, path);

    await deleteObject(imageRef);

  } catch (error) {

    // Image may already be deleted.
    console.warn(
      "Could not delete image:",
      error
    );

  }

}


/* =========================================================
   OPEN TRADE MODAL
========================================================= */

function openTradeModal(trade = null) {

  $("tradeForm").reset();

  $("tradeError").textContent = "";

  pendingImageFile = null;
  existingImageUrl = "";
  existingImagePath = "";
  removeExistingImage = false;

  manualLotSize = false;

  $("tradeId").value = "";

  $("tradeDate").value =
    todayString();

  $("tradeTime").value =
    nowTimeString();

  $("pair").value =
    "XAUUSD";

  $("direction").value =
    "Buy";

  $("riskPercent").value =
    "1";

  $("modalTitle").textContent =
    trade ? "Edit Trade" : "Add Trade";


  if (trade) {

    $("tradeId").value =
      trade.id || "";

    $("tradeDate").value =
      trade.date || todayString();

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


    existingImageUrl =
      trade.imageUrl || "";

    existingImagePath =
      trade.imagePath || "";


    if (existingImageUrl) {

      $("imagePreview").src =
        existingImageUrl;

      $("imagePreviewWrap")
        .classList.remove("hidden");

      $("imageUploadStatus").textContent =
        "Current screenshot";

    }


    manualLotSize =
      !!trade.manualLotSize;

  }


  calculateTradeRR();

  if (!trade) {
    updateLotSize();
  }


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

}


/* =========================================================
   SAVE TRADE
========================================================= */

$("tradeForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!currentUser) return;


    $("tradeError").textContent =
      "Saving...";


    try {

      const tradeId =
        $("tradeId").value.trim();

      const tradesRef =
        getTradesCollection();

      let tradeRef;


      if (tradeId) {

        tradeRef =
          doc(tradesRef, tradeId);

      } else {

        tradeRef =
          doc(tradesRef);

      }


      const rr =
        calculateTradeRR();

      const entry =
        number($("entry").value);

      const sl =
        number($("sl").value);

      const tp =
        number($("tp").value);


      if (
        entry <= 0 ||
        sl <= 0 ||
        tp <= 0
      ) {

        throw new Error(
          "Enter valid Entry, SL and TP."
        );

      }


      if (!rr || rr <= 0) {

        throw new Error(
          "Entry, SL and TP create an invalid R:R."
        );

      }


      const riskAmount =
        calculateRiskAmount();


      let lotSize =
        number($("lotSize").value);


      if (!manualLotSize) {

        const autoLot =
          calculateAutoLot();

        lotSize =
          autoLot;

      }


      const result =
        $("result").value;


      if (!result) {

        throw new Error(
          "Please select a trade result."
        );

      }


      let profitLoss =
        number($("profitLoss").value);


      // FORCE correct P/L sign

      if (result === "Win") {

        profitLoss =
          Math.abs(profitLoss);

      }

      else if (result === "Loss") {

        profitLoss =
          -Math.abs(profitLoss);

      }

      else if (result === "Breakeven") {

        profitLoss = 0;

      }


      let imageUrl =
        existingImageUrl;

      let imagePath =
        existingImagePath;


      /* ---------- UPLOAD NEW IMAGE ---------- */

      if (pendingImageFile) {

        $("imageUploadStatus").textContent =
          "Uploading screenshot...";


        const uploaded =
          await uploadTradeImage(
            pendingImageFile,
            tradeRef.id
          );


        imageUrl =
          uploaded.url;

        imagePath =
          uploaded.path;


        // Delete old image only after
        // new image successfully uploaded

        if (
          existingImagePath &&
          existingImagePath !== imagePath
        ) {

          await deleteTradeImage(
            existingImagePath
          );

        }

      }

      else if (removeExistingImage) {

        if (existingImagePath) {

          await deleteTradeImage(
            existingImagePath
          );

        }

        imageUrl = "";
        imagePath = "";

      }


      const now =
        Date.now();


      const tradeData = {

        date:
          $("tradeDate").value,

        time:
          $("tradeTime").value,

        pair:
          $("pair").value.trim().toUpperCase(),

        direction:
          $("direction").value,

        entry,

        sl,

        tp,

        rr,

        riskPercent:
          number($("riskPercent").value),

        riskAmount,

        lotSize,

        manualLotSize,

        setup:
          $("setup").value.trim(),

        session:
          $("session").value,

        htfBias:
          $("htfBias").value,

        liquidity:
          $("liquidity").value.trim(),

        confirmation:
          $("confirmation").value.trim(),

        result,

        profitLoss,

        confidence:
          $("confidence").value,

        psychology:
          $("psychology").value,

        mistake:
          $("mistake").value.trim(),

        notes:
          $("notes").value.trim(),

        imageUrl,

        imagePath,

        updatedAt:
          now

      };


      if (tradeId) {

        await updateDoc(
          tradeRef,
          tradeData
        );

        showToast(
          "Trade updated successfully."
        );

      } else {

        await setDoc(
          tradeRef,
          {
            ...tradeData,
            createdAt: now
          }
        );

        showToast(
          "Trade added successfully."
        );

      }


      closeTradeModal();

    } catch (error) {

      console.error(error);

      $("tradeError").textContent =
        error.message ||
        "Could not save trade.";

    }

  }
);


/* =========================================================
   DELETE TRADE
========================================================= */

async function deleteTrade(trade) {

  if (!currentUser) return;

  const confirmed =
    confirm(
      "Delete this trade permanently?"
    );

  if (!confirmed) return;


  try {

    if (trade.imagePath) {

      await deleteTradeImage(
        trade.imagePath
      );

    }


    await deleteDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "trades",
        trade.id
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
   IMAGE LIGHTBOX
========================================================= */

function openLightbox(url) {

  if (!url) return;

  $("lightboxImage").src =
    url;

  $("imageLightbox")
    .classList.remove("hidden");

}


function closeLightbox() {

  $("imageLightbox")
    .classList.add("hidden");

  $("lightboxImage").src = "";

}


$("closeLightbox").addEventListener(
  "click",
  closeLightbox
);


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderDashboard();

  renderJournal();

  renderAnalytics();

  renderCalendar();

  drawEquityChart();

}


/* =========================================================
   DASHBOARD
========================================================= */

function calculateStats(list = trades) {

  const wins =
    list.filter(t => t.result === "Win");

  const losses =
    list.filter(t => t.result === "Loss");

  const breakeven =
    list.filter(t => t.result === "Breakeven");


  const totalPL =
    list.reduce(
      (sum, t) =>
        sum + number(t.profitLoss),
      0
    );


  const winRate =
    list.length
      ? (wins.length / list.length) * 100
      : 0;


  const grossProfit =
    wins.reduce(
      (sum, t) =>
        sum + Math.max(0, number(t.profitLoss)),
      0
    );


  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, t) =>
          sum + Math.min(0, number(t.profitLoss)),
        0
      )
    );


  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;


  const avgR =
    list.length
      ? list.reduce(
          (sum, t) =>
            sum + number(t.rr),
          0
        ) / list.length
      : 0;


  return {
    wins,
    losses,
    breakeven,
    totalPL,
    winRate,
    grossProfit,
    grossLoss,
    profitFactor,
    avgR
  };

}


function renderDashboard() {

  const stats =
    calculateStats();


  $("totalTrades").textContent =
    trades.length;

  $("winRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("totalPL").textContent =
    money(stats.totalPL);

  $("totalPL").className =
    stats.totalPL >= 0
      ? "positive"
      : "negative";


  $("currentBalance").textContent =
    money(
      startingBalance +
      stats.totalPL
    );


  $("dashAvgR").textContent =
    `${stats.avgR.toFixed(2)}R`;


  $("dashProfitFactor").textContent =
    stats.profitFactor === Infinity
      ? "∞"
      : stats.profitFactor.toFixed(2);


  $("dashWins").textContent =
    stats.wins.length;

  $("dashLosses").textContent =
    stats.losses.length;

  $("dashBE").textContent =
    stats.breakeven.length;


  const recent =
    trades.slice(0, 7);


  $("recentTradesBody").innerHTML =
    recent.map(trade => {

      const pl =
        number(trade.profitLoss);

      return `
        <tr>

          <td>${escapeHTML(trade.date || "—")}</td>

          <td>${escapeHTML(trade.pair || "—")}</td>

          <td>
            <span class="direction-chip ${
              trade.direction === "Buy"
                ? "direction-buy"
                : "direction-sell"
            }">
              ${escapeHTML(trade.direction || "—")}
            </span>
          </td>

          <td>
            ${trade.rr
              ? `1:${number(trade.rr).toFixed(2)}`
              : "—"}
          </td>

          <td>
            <span class="result-chip ${
              trade.result === "Win"
                ? "result-win"
                : trade.result === "Loss"
                  ? "result-loss"
                  : "result-be"
            }">
              ${escapeHTML(trade.result || "—")}
            </span>
          </td>

          <td class="${
            pl > 0
              ? "positive"
              : pl < 0
                ? "negative"
                : ""
          }">
            ${money(pl)}
          </td>

        </tr>
      `;

    }).join("");


  $("recentEmpty").classList.toggle(
    "hidden",
    recent.length > 0
  );

}


/* =========================================================
   JOURNAL
========================================================= */

function getFilteredTrades() {

  const result =
    $("filterResult").value;

  const pair =
    $("filterPair").value
      .trim()
      .toLowerCase();

  const date =
    $("filterDate").value;


  return trades.filter(trade => {

    if (
      result &&
      trade.result !== result
    ) {
      return false;
    }

    if (
      pair &&
      !String(trade.pair || "")
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

  });

}


function renderJournal() {

  const filtered =
    getFilteredTrades();

  const stats =
    calculateStats(filtered);


  $("journalTrades").textContent =
    filtered.length;

  $("journalWins").textContent =
    stats.wins.length;

  $("journalLosses").textContent =
    stats.losses.length;

  $("journalPL").textContent =
    money(stats.totalPL);


  $("journalPL").className =
    stats.totalPL >= 0
      ? "positive"
      : "negative";


  $("journalTableBody").innerHTML =
    filtered.map(trade => {

      const pl =
        number(trade.profitLoss);

      const imageHTML =
        trade.imageUrl

          ? `
            <button
              class="trade-image-thumb"
              data-action="image"
              data-id="${escapeHTML(trade.id)}"
            >
              <img
                src="${escapeHTML(trade.imageUrl)}"
                alt="Chart"
              >
            </button>
          `

          : `<span class="no-image">—</span>`;


      return `
        <tr>

          <td>${imageHTML}</td>

          <td>${escapeHTML(trade.date || "—")}</td>

          <td>${escapeHTML(trade.pair || "—")}</td>

          <td>
            <span class="direction-chip ${
              trade.direction === "Buy"
                ? "direction-buy"
                : "direction-sell"
            }">
              ${escapeHTML(trade.direction || "—")}
            </span>
          </td>

          <td>${number(trade.entry).toFixed(2)}</td>

          <td>${number(trade.sl).toFixed(2)}</td>

          <td>${number(trade.tp).toFixed(2)}</td>

          <td>
            ${trade.rr
              ? `1:${number(trade.rr).toFixed(2)}`
              : "—"}
          </td>

          <td>
            <span class="result-chip ${
              trade.result === "Win"
                ? "result-win"
                : trade.result === "Loss"
                  ? "result-loss"
                  : "result-be"
            }">
              ${escapeHTML(trade.result || "—")}
            </span>
          </td>

          <td class="${
            pl > 0
              ? "positive"
              : pl < 0
                ? "negative"
                : ""
          }">
            ${money(pl)}
          </td>

          <td>

            <div class="row-actions">

              <button
                class="action-btn"
                data-action="edit"
                data-id="${escapeHTML(trade.id)}"
                title="Edit"
              >
                ✎
              </button>

              <button
                class="action-btn action-delete"
                data-action="delete"
                data-id="${escapeHTML(trade.id)}"
                title="Delete"
              >
                ×
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join("");


  $("journalEmpty").classList.toggle(
    "hidden",
    filtered.length > 0
  );

}


/* =========================================================
   JOURNAL EVENTS
========================================================= */

$("journalTableBody").addEventListener(
  "click",
  event => {

    const button =
      event.target.closest("[data-action]");

    if (!button) return;

    const action =
      button.dataset.action;

    const id =
      button.dataset.id;

    const trade =
      trades.find(t => t.id === id);

    if (!trade) return;


    if (action === "edit") {

      openTradeModal(trade);

    }


    if (action === "delete") {

      deleteTrade(trade);

    }


    if (action === "image") {

      openLightbox(
        trade.imageUrl
      );

    }

  }
);


/* =========================================================
   FILTERS
========================================================= */

[
  $("filterResult"),
  $("filterPair"),
  $("filterDate")
].forEach(element => {

  element.addEventListener(
    "input",
    renderJournal
  );

  element.addEventListener(
    "change",
    renderJournal
  );

});


$("clearFilters").addEventListener(
  "click",
  () => {

    $("filterResult").value = "";
    $("filterPair").value = "";
    $("filterDate").value = "";

    renderJournal();

  }
);


/* =========================================================
   ANALYTICS
========================================================= */

function renderAnalytics() {

  const stats =
    calculateStats();


  $("analyticsTrades").textContent =
    trades.length;

  $("analyticsWinRate").textContent =
    `${stats.winRate.toFixed(1)}%`;

  $("analyticsRR").textContent =
    `${stats.avgR.toFixed(2)}R`;

  $("analyticsPL").textContent =
    money(stats.totalPL);


  $("analyticsWins").textContent =
    stats.wins.length;

  $("analyticsLosses").textContent =
    stats.losses.length;

  $("analyticsBE").textContent =
    stats.breakeven.length;


  const total =
    trades.length || 1;


  $("winBar").style.width =
    `${stats.wins.length / total * 100}%`;

  $("lossBar").style.width =
    `${stats.losses.length / total * 100}%`;

  $("beBar").style.width =
    `${stats.breakeven.length / total * 100}%`;


  const winPL =
    stats.wins.map(
      t => number(t.profitLoss)
    );

  const lossPL =
    stats.losses.map(
      t => number(t.profitLoss)
    );


  const avgWin =
    winPL.length
      ? winPL.reduce((a,b) => a+b,0)
        / winPL.length
      : 0;


  const avgLoss =
    lossPL.length
      ? lossPL.reduce((a,b) => a+b,0)
        / lossPL.length
      : 0;


  const allPL =
    trades.map(
      t => number(t.profitLoss)
    );


  const best =
    allPL.length
      ? Math.max(...allPL)
      : 0;

  const worst =
    allPL.length
      ? Math.min(...allPL)
      : 0;


  $("avgWin").textContent =
    money(avgWin);

  $("avgLoss").textContent =
    money(avgLoss);

  $("bestTrade").textContent =
    money(best);

  $("worstTrade").textContent =
    money(worst);


  renderBreakdown(
    "sessionBreakdown",
    "session"
  );

  renderBreakdown(
    "setupBreakdown",
    "setup"
  );

}


function renderBreakdown(
  elementId,
  field
) {

  const map = new Map();


  trades.forEach(trade => {

    const name =
      String(trade[field] || "Not set");

    if (!map.has(name)) {

      map.set(name, {
        trades: 0,
        pl: 0,
        wins: 0
      });

    }


    const item =
      map.get(name);

    item.trades++;

    item.pl +=
      number(trade.profitLoss);

    if (trade.result === "Win") {
      item.wins++;
    }

  });


  const entries =
    [...map.entries()]
      .sort((a,b) =>
        b[1].pl - a[1].pl
      );


  $(elementId).innerHTML =
    entries.length

      ? entries.map(([name, item]) => {

          const rate =
            item.trades
              ? item.wins / item.trades * 100
              : 0;

          return `
            <div class="breakdown-item">

              <div class="breakdown-item-top">

                <span>
                  ${escapeHTML(name)}
                </span>

                <strong class="${
                  item.pl >= 0
                    ? "positive"
                    : "negative"
                }">
                  ${money(item.pl)}
                </strong>

              </div>

              <small>
                ${item.trades} trades •
                ${rate.toFixed(0)}% win rate
              </small>

            </div>
          `;

        }).join("")

      : `
        <div class="empty-state">
          No data yet.
        </div>
      `;

}


/* =========================================================
   EQUITY CHART
========================================================= */

function drawEquityChart() {

  const canvas =
    $("equityCanvas");

  if (!canvas) return;


  const rect =
    canvas.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return;
  }


  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    rect.width * dpr;

  canvas.height =
    rect.height * dpr;


  const ctx =
    canvas.getContext("2d");


  ctx.scale(dpr, dpr);


  const width =
    rect.width;

  const height =
    rect.height;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const ordered =
    [...trades]
      .sort(
        (a,b) =>
          number(a.createdAt) -
          number(b.createdAt)
      );


  let balance =
    startingBalance;


  const points =
    [balance];


  ordered.forEach(trade => {

    balance +=
      number(trade.profitLoss);

    points.push(balance);

  });


  if (points.length === 1) {

    points.push(balance);

  }


  const min =
    Math.min(...points);

  const max =
    Math.max(...points);

  const range =
    max - min || 1;


  // Grid

  ctx.strokeStyle =
    "rgba(255,255,255,.06)";

  ctx.lineWidth = 1;


  for (let i = 1; i < 5; i++) {

    const y =
      (height / 5) * i;

    ctx.beginPath();

    ctx.moveTo(0, y);

    ctx.lineTo(width, y);

    ctx.stroke();

  }


  // Line

  ctx.beginPath();


  points.forEach(
    (value, index) => {

      const x =
        points.length === 1
          ? 0
          : index /
              (points.length - 1) *
              (width - 20) +
            10;

      const y =
        height -
        ((value - min) / range) *
          (height - 30) -
        10;


      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

    }
  );


  ctx.strokeStyle =
    "#d7ad55";

  ctx.lineWidth = 2.5;

  ctx.lineJoin = "round";

  ctx.lineCap = "round";

  ctx.stroke();


  // Current point

  const lastIndex =
    points.length - 1;

  const lastX =
    lastIndex /
      (points.length - 1) *
      (width - 20) +
    10;

  const lastY =
    height -
    ((points[lastIndex] - min) / range) *
      (height - 30) -
    10;


  ctx.beginPath();

  ctx.arc(
    lastX,
    lastY,
    4,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#f1d58a";

  ctx.fill();

}


/* =========================================================
   RISK CALCULATOR
========================================================= */

function calculateRiskCalculator() {

  const balance =
    number($("calcBalance").value);

  const riskPercent =
    number($("calcRisk").value);

  const entry =
    number($("calcEntry").value);

  const sl =
    number($("calcSL").value);

  const tp =
    number($("calcTP").value);

  const direction =
    $("calcDirection").value;


  const riskAmount =
    balance *
    riskPercent /
    100;


  const distance =
    Math.abs(entry - sl);


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


  const rr =
    risk > 0 && reward > 0
      ? reward / risk
      : 0;


  const lot =
    riskAmount > 0 &&
    distance > 0
      ? riskAmount /
        (distance * 100)
      : 0;


  $("calcRiskAmount").textContent =
    money(riskAmount);

  $("calcDistance").textContent =
    distance > 0
      ? distance.toFixed(2)
      : "0.00";

  $("calcRR").textContent =
    rr > 0
      ? `1:${rr.toFixed(2)}`
      : "Invalid";

  $("calcLot").textContent =
    lot > 0
      ? lot.toFixed(2)
      : "0.00";

}


$("calculateRiskBtn").addEventListener(
  "click",
  calculateRiskCalculator
);


[
  $("calcBalance"),
  $("calcRisk"),
  $("calcEntry"),
  $("calcSL"),
  $("calcTP"),
  $("calcDirection")
].forEach(element => {

  element.addEventListener(
    "input",
    calculateRiskCalculator
  );

  element.addEventListener(
    "change",
    calculateRiskCalculator
  );

});


/* =========================================================
   CALENDAR
========================================================= */

function renderCalendar() {

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();


  $("calendarMonthLabel").textContent =
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


  const dayMap = {};


  trades.forEach(trade => {

    if (!trade.date) return;

    const d =
      new Date(
        `${trade.date}T00:00:00`
      );


    if (
      d.getFullYear() === year &&
      d.getMonth() === month
    ) {

      const day =
        d.getDate();

      if (!dayMap[day]) {

        dayMap[day] = {
          pl: 0,
          trades: 0
        };

      }

      dayMap[day].pl +=
        number(trade.profitLoss);

      dayMap[day].trades++;

    }

  });


  let monthPL = 0;
  let wins = 0;
  let losses = 0;


  trades.forEach(trade => {

    if (!trade.date) return;

    const d =
      new Date(
        `${trade.date}T00:00:00`
      );


    if (
      d.getFullYear() === year &&
      d.getMonth() === month
    ) {

      monthPL +=
        number(trade.profitLoss);

      if (trade.result === "Win") {
        wins++;
      }

      if (trade.result === "Loss") {
        losses++;
      }

    }

  });


  $("calendarMonthPL").textContent =
    money(monthPL);

  $("calendarMonthPL").className =
    monthPL >= 0
      ? "positive"
      : "negative";

  $("calendarWins").textContent =
    wins;

  $("calendarLosses").textContent =
    losses;


  const grid =
    $("calendarGrid");

  grid.innerHTML = "";


  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const empty =
      document.createElement("div");

    empty.className =
      "calendar-day empty";

    grid.appendChild(empty);

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const cell =
      document.createElement("div");

    cell.className =
      "calendar-day";


    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


    if (
      dateString === todayString()
    ) {

      cell.classList.add("today");

    }


    const data =
      dayMap[day];


    let plHTML =
      `<div class="calendar-day-pl">No trade</div>`;

    let tradeHTML = "";


    if (data) {

      const pl =
        data.pl;

      plHTML = `
        <div class="calendar-day-pl ${
          pl > 0
            ? "positive"
            : pl < 0
              ? "negative"
              : ""
        }">
          ${money(pl)}
        </div>
      `;

      tradeHTML = `
        <div class="calendar-trades">
          ${data.trades} trade${data.trades === 1 ? "" : "s"}
        </div>
      `;

    }


    cell.innerHTML = `
      <div class="calendar-day-number">
        ${day}
      </div>

      ${plHTML}

      ${tradeHTML}
    `;


    grid.appendChild(cell);

  }

}


$("prevMonth").addEventListener(
  "click",
  () => {

    calendarDate.setMonth(
      calendarDate.getMonth() - 1
    );

    renderCalendar();

  }
);


$("nextMonth").addEventListener(
  "click",
  () => {

    calendarDate.setMonth(
      calendarDate.getMonth() + 1
    );

    renderCalendar();

  }
);


$("todayMonth").addEventListener(
  "click",
  () => {

    calendarDate = new Date();

    renderCalendar();

  }
);


/* =========================================================
   CSV EXPORT
========================================================= */

$("exportCsvBtn").addEventListener(
  "click",
  () => {

    if (!trades.length) {

      showToast(
        "No trades to export."
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
      "Notes",
      "Image URL"
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
        t.confidence,
        t.psychology,
        t.mistake,
        t.notes,
        t.imageUrl

      ]);


    const csv = [
      headers,
      ...rows
    ]
      .map(row =>
        row.map(value =>
          `"${String(value ?? "")
            .replaceAll('"', '""')}"`
        ).join(",")
      )
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


    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `ujr-fx-trading-journal-${todayString()}.csv`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);


    showToast(
      "CSV exported."
    );

  }
);


/* =========================================================
   PAGE NAVIGATION
========================================================= */

const pageInfo = {

  dashboardPage: [
    "Dashboard",
    "Your trading performance overview"
  ],

  journalPage: [
    "Trading Journal",
    "Record and review every execution"
  ],

  analyticsPage: [
    "Analytics",
    "Understand your trading statistics"
  ],

  riskPage: [
    "Risk Calculator",
    "Calculate risk, R:R and estimated lot size"
  ],

  calendarPage: [
    "Trading Calendar",
    "See your daily and monthly performance"
  ],

  settingsPage: [
    "Settings",
    "Configure your journal"
  ]

};


function showPage(pageId) {

  document.querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove(
        "active-page"
      );

    });


  const page =
    $(pageId);

  if (!page) return;

  page.classList.add(
    "active-page"
  );


  document.querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === pageId
      );

    });


  const info =
    pageInfo[pageId];

  if (info) {

    $("pageTitle").textContent =
      info[0];

    $("pageSubtitle").textContent =
      info[1];

  }


  $("sidebar")
    .classList.remove("open");

  $("overlay")
    .classList.remove("active");


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (pageId === "riskPage") {
    calculateRiskCalculator();
  }

  if (pageId === "calendarPage") {
    renderCalendar();
  }

}


document.querySelectorAll(".nav-item")
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


document.querySelectorAll("[data-page-target]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.pageTarget
        );

      }
    );

  });


/* =========================================================
   MOBILE MENU
========================================================= */

$("mobileMenuBtn").addEventListener(
  "click",
  () => {

    $("sidebar")
      .classList.toggle("open");

    $("overlay")
      .classList.toggle("active");

  }
);


$("overlay").addEventListener(
  "click",
  () => {

    $("sidebar")
      .classList.remove("open");

    $("overlay")
      .classList.remove("active");

  }
);


/* =========================================================
   TRADE BUTTONS
========================================================= */

$("journalAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("quickAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);

$("mobileAddBtn").addEventListener(
  "click",
  () => openTradeModal()
);


$("closeModal").addEventListener(
  "click",
  closeTradeModal
);

$("cancelTrade").addEventListener(
  "click",
  closeTradeModal
);

$("modalBackdrop").addEventListener(
  "click",
  closeTradeModal
);


/* =========================================================
   TRADE INPUT EVENTS
========================================================= */

[
  $("entry"),
  $("sl"),
  $("tp")
].forEach(input => {

  input.addEventListener(
    "input",
    () => {

      calculateTradeRR();

      updateLotSize();

    }
  );

});


$("direction").addEventListener(
  "change",
  () => {

    calculateTradeRR();

    updateLotSize();

  }
);


$("riskPercent").addEventListener(
  "input",
  () => {

    calculateRiskAmount();

    updateLotSize();

  }
);


$("lotSize").addEventListener(
  "input",
  () => {

    manualLotSize = true;

  }
);


$("result").addEventListener(
  "change",
  updateProfitLossSign
);


$("profitLoss").addEventListener(
  "input",
  updateProfitLossSign
);


/* =========================================================
   KEYBOARD SHORTCUT
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key.toLowerCase() === "n" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA" &&
      document.activeElement.tagName !== "SELECT"
    ) {

      openTradeModal();

    }


    if (
      event.key === "Escape"
    ) {

      closeTradeModal();

      closeLightbox();

    }

  }
);


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  const toast =
    $("toast");

  toast.textContent =
    message;

  toast.classList.add("show");


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove("show");

      },
      2600
    );

}


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    drawEquityChart();

  }
);


/* =========================================================
   INITIAL DEFAULTS
========================================================= */

$("tradeDate").value =
  todayString();

$("tradeTime").value =
  nowTimeString();

$("pair").value =
  "XAUUSD";

$("riskPercent").value =
  "1";
