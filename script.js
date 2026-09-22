// ===============================
// UjR Fx Trading Journal
// ===============================


// LOAD SAVED TRADES
let trades = JSON.parse(localStorage.getItem("ujrFxTrades")) || [];


// ===============================
// SAVE TRADES
// ===============================

function saveTrades() {
    localStorage.setItem("ujrFxTrades", JSON.stringify(trades));
}


// ===============================
// CALCULATE R:R
// ===============================

function calculateRR(trade) {

    const risk = Math.abs(
        Number(trade.entry) - Number(trade.sl)
    );

    const reward = Math.abs(
        Number(trade.tp) - Number(trade.entry)
    );

    if (risk === 0) {
        return "—";
    }

    const rr = reward / risk;

    return "1:" + rr.toFixed(2);
}


// ===============================
// DASHBOARD
// ===============================

function updateDashboard() {

    const total = trades.length;

    const wins = trades.filter(
        trade => trade.result === "Win"
    ).length;

    const losses = trades.filter(
        trade => trade.result === "Loss"
    ).length;

    const totalPL = trades.reduce(
        (sum, trade) => sum + Number(trade.profit || 0),
        0
    );

    const winRate = total > 0
        ? (wins / total) * 100
        : 0;


    document.getElementById("totalTrades").textContent = total;

    document.getElementById("wins").textContent = wins;

    document.getElementById("losses").textContent = losses;

    document.getElementById("winRate").textContent =
        winRate.toFixed(1) + "%";

    document.getElementById("totalPL").textContent =
        totalPL.toFixed(2);

    updatePLColor(
        document.getElementById("totalPL"),
        totalPL
    );
}


// ===============================
// P/L COLOR
// ===============================

function updatePLColor(element, value) {

    element.classList.remove("green", "red");

    if (value > 0) {
        element.classList.add("green");
    }

    if (value < 0) {
        element.classList.add("red");
    }
}


// ===============================
// DISPLAY TRADE HISTORY
// ===============================

function displayTrades() {

    const table = document.getElementById("tradeHistory");

    const emptyMessage =
        document.getElementById("emptyMessage");


    table.innerHTML = "";


    if (trades.length === 0) {

        emptyMessage.style.display = "block";

        return;
    }


    emptyMessage.style.display = "none";


    trades.forEach((trade, index) => {

        const row = document.createElement("tr");


        let resultClass = "";

        if (trade.result === "Win") {
            resultClass = "result-win";
        }

        if (trade.result === "Loss") {
            resultClass = "result-loss";
        }

        if (trade.result === "Breakeven") {
            resultClass = "result-breakeven";
        }


        let profitClass = "";

        if (Number(trade.profit) > 0) {
            profitClass = "green";
        }

        if (Number(trade.profit) < 0) {
            profitClass = "red";
        }


        row.innerHTML = `

            <td>${formatDate(trade.date)}</td>

            <td>${trade.pair}</td>

            <td>${trade.direction}</td>

            <td>${trade.entry}</td>

            <td>${trade.sl}</td>

            <td>${trade.tp}</td>

            <td>${calculateRR(trade)}</td>

            <td>${trade.setup || "—"}</td>

            <td class="${resultClass}">
                ${trade.result}
            </td>

            <td class="${profitClass}">
                ${Number(trade.profit).toFixed(2)}
            </td>

            <td>${trade.mistake || "No mistake"}</td>

            <td>${trade.notes || "—"}</td>

            <td>
                <button
                    class="delete-btn"
                    onclick="deleteTrade(${index})">
                    Delete
                </button>
            </td>

        `;


        table.appendChild(row);

    });
}


// ===============================
// ADD TRADE
// ===============================

document
    .getElementById("tradeForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        const trade = {

            date: document.getElementById("date").value,

            pair: document.getElementById("pair").value,

            direction:
                document.getElementById("direction").value,

            entry:
                Number(document.getElementById("entry").value),

            sl:
                Number(document.getElementById("sl").value),

            tp:
                Number(document.getElementById("tp").value),

            setup:
                document.getElementById("setup").value,

            result:
                document.getElementById("result").value,

            profit:
                Number(document.getElementById("profit").value),

            mistake:
                document.getElementById("mistake").value,

            notes:
                document.getElementById("notes").value

        };


        trades.push(trade);

        saveTrades();

        updateAll();


        this.reset();


        // Put XAUUSD back after reset
        document.getElementById("pair").value = "XAUUSD";


        // Scroll to history
        document
            .getElementById("tradeHistory")
            .scrollIntoView({
                behavior: "smooth"
            });

    });


// ===============================
// DELETE TRADE
// ===============================

function deleteTrade(index) {

    trades.splice(index, 1);

    saveTrades();

    updateAll();
}


// ===============================
// CLEAR ALL TRADES
// ===============================

function clearAllTrades() {

    if (trades.length === 0) {
        return;
    }


    const confirmDelete = confirm(
        "Are you sure you want to delete all trades?"
    );


    if (!confirmDelete) {
        return;
    }


    trades = [];

    saveTrades();

    updateAll();
}


// ===============================
// GET WEEK START
// ===============================

function getWeekStart(date) {

    const d = new Date(date);

    const day = d.getDay();

    const difference =
        day === 0 ? -6 : 1 - day;


    d.setDate(d.getDate() + difference);

    d.setHours(0, 0, 0, 0);

    return d;
}


// ===============================
// WEEKLY STATISTICS
// ===============================

function updateWeeklyStats() {

    const today = new Date();

    const weekStart =
        getWeekStart(today);


    const weekTrades = trades.filter(trade => {

        const tradeDate =
            new Date(trade.date);

        return tradeDate >= weekStart;

    });


    const total = weekTrades.length;


    const wins = weekTrades.filter(
        trade => trade.result === "Win"
    ).length;


    const losses = weekTrades.filter(
        trade => trade.result === "Loss"
    ).length;


    const pl = weekTrades.reduce(
        (sum, trade) =>
            sum + Number(trade.profit || 0),
        0
    );


    const winRate =
        total > 0
            ? (wins / total) * 100
            : 0;


    document.getElementById("weekTrades")
        .textContent = total;


    document.getElementById("weekWins")
        .textContent = wins;


    document.getElementById("weekLosses")
        .textContent = losses;


    document.getElementById("weekWinRate")
        .textContent = winRate.toFixed(1) + "%";


    document.getElementById("weekPL")
        .textContent = pl.toFixed(2);


    updatePLColor(
        document.getElementById("weekPL"),
        pl
    );


    createWeeklyChart();

}


// ===============================
// MONTHLY STATISTICS
// ===============================

function updateMonthlyStats() {

    const now = new Date();


    const currentYear =
        now.getFullYear();

    const currentMonth =
        now.getMonth();


    const monthTrades = trades.filter(trade => {

        const d =
            new Date(trade.date);

        return (
            d.getFullYear() === currentYear &&
            d.getMonth() === currentMonth
        );

    });


    const total = monthTrades.length;


    const wins = monthTrades.filter(
        trade => trade.result === "Win"
    ).length;


    const losses = monthTrades.filter(
        trade => trade.result === "Loss"
    ).length;


    const pl = monthTrades.reduce(
        (sum, trade) =>
            sum + Number(trade.profit || 0),
        0
    );


    const winRate =
        total > 0
            ? (wins / total) * 100
            : 0;


    document.getElementById("monthTrades")
        .textContent = total;


    document.getElementById("monthWins")
        .textContent = wins;


    document.getElementById("monthLosses")
        .textContent = losses;


    document.getElementById("monthWinRate")
        .textContent = winRate.toFixed(1) + "%";


    document.getElementById("monthPL")
        .textContent = pl.toFixed(2);


    updatePLColor(
        document.getElementById("monthPL"),
        pl
    );


    createMonthlyChart();

}


// ===============================
// WEEKLY CHART
// ===============================

function createWeeklyChart() {

    const chart =
        document.getElementById("weeklyChart");


    chart.innerHTML = "";


    const today = new Date();

    const currentWeek =
        getWeekStart(today);


    let weeks = [];


    for (let i = 7; i >= 0; i--) {

        const start =
            new Date(currentWeek);

        start.setDate(
            start.getDate() - i * 7
        );


        const end =
            new Date(start);

        end.setDate(
            end.getDate() + 7
        );


        const pl = trades
            .filter(trade => {

                const d =
                    new Date(trade.date);

                return d >= start && d < end;

            })
            .reduce(
                (sum, trade) =>
                    sum + Number(trade.profit || 0),
                0
            );


        weeks.push({
            start,
            pl
        });

    }


    const max =
        Math.max(
            ...weeks.map(w =>
                Math.abs(w.pl)
            ),
            1
        );


    weeks.forEach(week => {

        const container =
            document.createElement("div");

        container.className =
            "bar-container";


        const value =
            document.createElement("div");

        value.className =
            "bar-value";

        value.textContent =
            week.pl.toFixed(0);


        const bar =
            document.createElement("div");

        bar.className = "bar";


        if (week.pl < 0) {
            bar.classList.add("negative");
        }


        bar.style.height =
            Math.max(
                3,
                (Math.abs(week.pl) / max) * 150
            ) + "px";


        const label =
            document.createElement("div");

        label.className =
            "bar-label";

        label.textContent =
            formatShortDate(week.start);


        container.appendChild(value);

        container.appendChild(bar);

        container.appendChild(label);

        chart.appendChild(container);

    });

}


// ===============================
// MONTHLY CHART
// ===============================

function createMonthlyChart() {

    const chart =
        document.getElementById("monthlyChart");


    chart.innerHTML = "";


    const now = new Date();


    let months = [];


    for (let i = 11; i >= 0; i--) {

        const date =
            new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );


        const year =
            date.getFullYear();

        const month =
            date.getMonth();


        const pl = trades
            .filter(trade => {

                const d =
                    new Date(trade.date);

                return (
                    d.getFullYear() === year &&
                    d.getMonth() === month
                );

            })
            .reduce(
                (sum, trade) =>
                    sum + Number(trade.profit || 0),
                0
            );


        months.push({
            date,
            pl
        });

    }


    const max =
        Math.max(
            ...months.map(m =>
                Math.abs(m.pl)
            ),
            1
        );


    months.forEach(month => {

        const container =
            document.createElement("div");

        container.className =
            "bar-container";


        const value =
            document.createElement("div");

        value.className =
            "bar-value";

        value.textContent =
            month.pl.toFixed(0);


        const bar =
            document.createElement("div");

        bar.className =
            "bar";


        if (month.pl < 0) {
            bar.classList.add("negative");
        }


        bar.style.height =
            Math.max(
                3,
                (Math.abs(month.pl) / max) * 150
            ) + "px";


        const label =
            document.createElement("div");

        label.className =
            "bar-label";

        label.textContent =
            month.date.toLocaleDateString(
                "en-US",
                { month: "short" }
            );


        container.appendChild(value);

        container.appendChild(bar);

        container.appendChild(label);

        chart.appendChild(container);

    });

}


// ===============================
// DATE FORMAT
// ===============================

function formatDate(dateString) {

    if (!dateString) {
        return "—";
    }


    const parts =
        dateString.split("-");


    if (parts.length !== 3) {
        return dateString;
    }


    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}


// ===============================
// SHORT DATE
// ===============================

function formatShortDate(date) {

    return date.toLocaleDateString(
        "en-US",
        {
            day: "numeric",
            month: "short"
        }
    );

}


// ===============================
// SCROLL TO TRADE
// ===============================

function scrollToTrade() {

    document
        .getElementById("tradeSection")
        .scrollIntoView({
            behavior: "smooth"
        });

}


// ===============================
// UPDATE EVERYTHING
// ===============================

function updateAll() {

    updateDashboard();

    displayTrades();

    updateWeeklyStats();

    updateMonthlyStats();

}


// ===============================
// START APP
// ===============================

updateAll();