:root {
    --bg: #080a0f;
    --bg2: #0d1017;
    --panel: rgba(18, 22, 31, 0.88);
    --panel2: #11151e;
    --border: rgba(255,255,255,0.08);

    --text: #f4f6f8;
    --muted: #8992a3;

    --gold: #d7ad55;
    --gold2: #f0cf78;

    --green: #43d19e;
    --red: #ff6675;
    --blue: #6ea8ff;

    --radius: 18px;
    --shadow: 0 20px 70px rgba(0,0,0,.28);
}

* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    margin: 0;
    background:
        radial-gradient(circle at 80% 0%, rgba(215,173,85,.08), transparent 30%),
        radial-gradient(circle at 0% 100%, rgba(60,100,180,.06), transparent 30%),
        var(--bg);

    color: var(--text);
    font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    min-height: 100vh;
}

button,
input,
select,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

.hidden {
    display: none !important;
}


/* =========================
   LOGIN
========================= */

.login-screen {
    min-height: 100vh;
    display: grid;
    place-items: center;
    position: relative;
    overflow: hidden;
    padding: 20px;
}

.login-background {
    position: absolute;
    inset: 0;

    background:
        radial-gradient(circle at 50% 30%, rgba(215,173,85,.14), transparent 28%),
        linear-gradient(135deg, #080a0f, #11151d);
}

.login-background::before {
    content: "";
    position: absolute;
    inset: 0;

    background-image:
        linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);

    background-size: 55px 55px;
}

.login-card {
    position: relative;
    z-index: 2;

    width: min(430px, 100%);

    padding: 42px;

    border: 1px solid var(--border);
    border-radius: 28px;

    background: rgba(15,18,25,.84);
    backdrop-filter: blur(24px);

    box-shadow: var(--shadow);

    text-align: center;

    animation: fadeUp .6s ease;
}

.login-logo-wrap {
    width: 86px;
    height: 86px;

    margin: 0 auto 20px;

    border-radius: 24px;

    display: grid;
    place-items: center;

    background: rgba(255,255,255,.04);
    border: 1px solid rgba(215,173,85,.2);
}

.login-logo {
    width: 62px;
    height: 62px;
    object-fit: contain;
}

.login-brand {
    font-size: 34px;
    font-weight: 900;
    letter-spacing: -1px;
}

.login-brand span {
    color: var(--gold2);
}

.login-subtitle {
    color: var(--muted);
    margin: 8px 0 32px;
}

.google-login-btn {
    width: 100%;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    padding: 14px 18px;

    border: 1px solid rgba(255,255,255,.1);
    border-radius: 13px;

    color: var(--text);
    background: #fff;
    color: #111;

    font-weight: 700;

    transition: .2s ease;
}

.google-login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 35px rgba(255,255,255,.12);
}

.google-login-btn:disabled {
    opacity: .55;
    cursor: wait;
}

.google-icon {
    font-size: 20px;
    font-weight: 900;
}

.login-error {
    min-height: 20px;
    margin: 14px 0 0;

    color: var(--red);
    font-size: 13px;
}

.login-footer {
    margin-top: 30px;
    color: #5f6878;
    font-size: 12px;
}


/* =========================
   APP
========================= */

.app {
    min-height: 100vh;
}

.sidebar {
    position: fixed;
    inset: 0 auto 0 0;

    width: 250px;

    display: flex;
    flex-direction: column;

    padding: 24px 16px;

    background: rgba(10,13,18,.94);
    border-right: 1px solid var(--border);

    backdrop-filter: blur(20px);

    z-index: 100;
}

.sidebar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 8px 28px;
}

.brand {
    display: flex;
    align-items: center;
    gap: 11px;
}

.brand img {
    width: 38px;
    height: 38px;
    object-fit: contain;
}

.brand strong {
    display: block;
    font-size: 17px;
}

.brand strong span {
    color: var(--gold2);
}

.brand small {
    display: block;
    color: var(--muted);
    font-size: 10px;
    margin-top: 2px;
}

.nav {
    display: grid;
    gap: 7px;
}

.nav-item {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 13px;

    padding: 13px 14px;

    border: 1px solid transparent;
    border-radius: 12px;

    color: var(--muted);
    background: transparent;

    text-align: left;

    transition: .2s ease;
}

.nav-item span:first-child {
    width: 20px;
    text-align: center;
}

.nav-item:hover {
    color: var(--text);
    background: rgba(255,255,255,.04);
}

.nav-item.active {
    color: var(--gold2);
    background: rgba(215,173,85,.08);
    border-color: rgba(215,173,85,.14);
}

.sidebar-bottom {
    margin-top: auto;
}

.sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;

    padding: 13px;

    border: 1px solid var(--border);
    border-radius: 14px;

    background: rgba(255,255,255,.025);
}

.sidebar-user img {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    object-fit: cover;
}

.user-info {
    min-width: 0;
}

.user-info strong,
.user-info small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.user-info strong {
    font-size: 12px;
}

.user-info small {
    color: var(--muted);
    font-size: 10px;
    margin-top: 3px;
}

.logout-btn {
    width: 100%;

    margin-top: 10px;

    padding: 11px;

    border: 0;
    border-radius: 11px;

    color: var(--muted);
    background: transparent;

    text-align: left;
}

.logout-btn:hover {
    color: var(--red);
    background: rgba(255,102,117,.06);
}

.main {
    margin-left: 250px;
    min-height: 100vh;
}

.topbar {
    height: 82px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 32px;

    border-bottom: 1px solid var(--border);

    background: rgba(8,10,15,.72);
    backdrop-filter: blur(18px);

    position: sticky;
    top: 0;
    z-index: 50;
}

.page-heading h1 {
    margin: 2px 0 0;
    font-size: 20px;
}

.page-heading span {
    color: var(--muted);
    font-size: 11px;
}

.top-actions {
    display: flex;
    align-items: center;
    gap: 15px;
}

.top-profile img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;

    border: 1px solid var(--border);
}

.quick-add-btn,
.primary-btn {
    border: 0;
    border-radius: 11px;

    padding: 11px 17px;

    background: linear-gradient(135deg, var(--gold2), var(--gold));
    color: #111;

    font-weight: 800;

    box-shadow: 0 8px 25px rgba(215,173,85,.12);

    transition: .2s ease;
}

.quick-add-btn:hover,
.primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 35px rgba(215,173,85,.2);
}

.mobile-menu-btn,
.mobile-close-btn {
    display: none;
}


/* =========================
   PAGES
========================= */

.page {
    display: none;
    padding: 32px;
    max-width: 1600px;
    margin: auto;
}

.page.active-page {
    display: block;
    animation: fadeUp .35s ease;
}

.page-intro {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;

    margin-bottom: 28px;
}

.page-intro h2 {
    margin: 6px 0;
    font-size: clamp(25px, 3vw, 34px);
    letter-spacing: -.8px;
}

.page-intro p {
    color: var(--muted);
    margin: 0;
}

.eyebrow {
    color: var(--gold2);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.7px;
}


/* =========================
   PANELS
========================= */

.panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);

    background: linear-gradient(
        145deg,
        rgba(20,24,33,.9),
        rgba(13,16,23,.9)
    );

    box-shadow: 0 15px 50px rgba(0,0,0,.12);

    padding: 22px;

    margin-bottom: 20px;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-bottom: 20px;
}

.panel-header h3 {
    margin: 4px 0 0;
    font-size: 17px;
}

.text-btn {
    background: none;
    border: 0;
    color: var(--gold2);
    font-size: 12px;
}

.secondary-btn {
    border: 1px solid var(--border);
    border-radius: 10px;

    background: rgba(255,255,255,.035);
    color: var(--text);

    padding: 10px 13px;

    transition: .2s ease;
}

.secondary-btn:hover {
    background: rgba(255,255,255,.07);
}

.full-btn {
    width: 100%;
    margin-top: 20px;
}


/* =========================
   DASHBOARD
========================= */

.stats-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;

    margin-bottom: 20px;
}

.stat-card,
.analytics-card {
    min-width: 0;

    padding: 20px;

    border: 1px solid var(--border);
    border-radius: 16px;

    background: rgba(16,20,28,.78);

    transition: .2s ease;
}

.stat-card:hover,
.analytics-card:hover {
    transform: translateY(-2px);
    border-color: rgba(215,173,85,.18);
}

.stat-label,
.analytics-card span {
    color: var(--muted);
    font-size: 11px;
}

.stat-value {
    margin-top: 9px;

    font-size: 23px;
    font-weight: 800;
}

.stat-small {
    color: #677080;
    font-size: 10px;
    margin-top: 6px;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 20px;
}

.chart-panel {
    min-height: 390px;
}

#equityCanvas,
#analyticsEquityCanvas {
    width: 100%;
    height: 300px;
    display: block;
}

.performance-pill {
    padding: 7px 10px;
    border-radius: 20px;
    background: rgba(67,209,158,.08);
    color: var(--green);
    font-size: 11px;
}

.mini-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;

    background: var(--border);

    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.mini-metrics div {
    padding: 17px;
    background: #11151d;
}

.mini-metrics span {
    display: block;
    color: var(--muted);
    font-size: 10px;
}

.mini-metrics strong {
    display: block;
    margin-top: 5px;
    font-size: 14px;
}


/* =========================
   TABLE
========================= */

.table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    min-width: 650px;
}

th {
    color: #687283;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .7px;

    padding: 11px;

    border-bottom: 1px solid var(--border);

    text-align: left;
}

td {
    padding: 13px 11px;

    border-bottom: 1px solid rgba(255,255,255,.045);

    font-size: 12px;
}

tr:hover td {
    background: rgba(255,255,255,.018);
}

.result-chip {
    display: inline-flex;

    padding: 5px 8px;

    border-radius: 7px;

    font-size: 10px;
    font-weight: 800;
}

.result-win {
    color: var(--green);
    background: rgba(67,209,158,.09);
}

.result-loss {
    color: var(--red);
    background: rgba(255,102,117,.09);
}

.result-be {
    color: var(--muted);
    background: rgba(255,255,255,.06);
}

.pl-positive {
    color: var(--green);
}

.pl-negative {
    color: var(--red);
}

.action-btn {
    border: 0;
    background: transparent;
    color: var(--muted);
    padding: 5px;
}

.action-btn:hover {
    color: var(--text);
}

.delete-btn:hover {
    color: var(--red);
}


/* =========================
   JOURNAL
========================= */

.journal-stats {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 12px;

    margin-bottom: 18px;
}

.journal-stats > div {
    padding: 15px 18px;

    border: 1px solid var(--border);
    border-radius: 14px;

    background: rgba(255,255,255,.025);
}

.journal-stats span {
    display: block;
    color: var(--muted);
    font-size: 10px;
}

.journal-stats strong {
    display: block;
    margin-top: 5px;
    font-size: 17px;
}

.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-bottom: 18px;
}

.filter-bar input,
.filter-bar select {
    min-width: 150px;
}


/* =========================
   FORMS
========================= */

.form-grid {
    display: grid;
    grid-template-columns: repeat(2,1fr);
    gap: 15px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.field label {
    color: #aab1be;
    font-size: 11px;
    font-weight: 600;
}

.field input,
.field select,
.field textarea,
.filter-bar input,
.filter-bar select {
    width: 100%;

    padding: 11px 12px;

    border: 1px solid var(--border);
    border-radius: 10px;

    background: #0b0f15;
    color: var(--text);

    outline: none;

    transition: .2s ease;
}

.field textarea {
    resize: vertical;
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.filter-bar input:focus,
.filter-bar select:focus {
    border-color: rgba(215,173,85,.45);
    box-shadow: 0 0 0 3px rgba(215,173,85,.06);
}

.field input[readonly] {
    color: var(--gold2);
    background: rgba(215,173,85,.035);
}

.field-hint {
    color: #606a7b;
    font-size: 9px;
}

.full-field {
    margin-top: 15px;
}

.form-error {
    min-height: 18px;
    color: var(--red);
    font-size: 11px;
}

.calculator-note {
    margin: 15px 0 0;
    color: #626c7d;
    font-size: 10px;
    line-height: 1.6;
}


/* =========================
   ANALYTICS
========================= */

.analytics-grid {
    display: grid;
    grid-template-columns: repeat(8,1fr);
    gap: 12px;

    margin-bottom: 20px;
}

.analytics-card strong {
    display: block;

    margin-top: 8px;

    font-size: 20px;
}

.analytics-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.breakdown-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.large-panel {
    margin-top: 20px;
}

.outcome-chart {
    display: grid;
    gap: 18px;
}

.outcome-row > div:first-child {
    display: flex;
    justify-content: space-between;
    margin-bottom: 7px;
}

.outcome-row span {
    color: var(--muted);
    font-size: 11px;
}

.outcome-row strong {
    font-size: 11px;
}

.progress {
    height: 7px;

    border-radius: 20px;

    background: rgba(255,255,255,.06);

    overflow: hidden;
}

.progress span {
    display: block;

    height: 100%;

    width: 0;

    border-radius: inherit;

    background: var(--gold);
}

.streak-grid {
    display: grid;
    grid-template-columns: repeat(2,1fr);
    gap: 1px;

    background: var(--border);

    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.streak-grid > div {
    padding: 14px;
    background: #10141b;
}

.streak-grid span {
    display: block;
    color: var(--muted);
    font-size: 9px;
}

.streak-grid strong {
    display: block;
    margin-top: 5px;
    font-size: 14px;
}

.breakdown-list {
    display: grid;
    gap: 8px;
}

.breakdown-item {
    padding: 12px;

    border: 1px solid rgba(255,255,255,.05);
    border-radius: 10px;

    background: rgba(255,255,255,.02);
}

.breakdown-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
}

.breakdown-name {
    font-size: 11px;
    font-weight: 700;
}

.breakdown-pl {
    font-size: 11px;
    font-weight: 800;
}

.breakdown-meta {
    display: flex;
    gap: 12px;
    margin-top: 6px;

    color: var(--muted);
    font-size: 9px;
}

.breakdown-bar {
    height: 4px;
    margin-top: 8px;

    border-radius: 10px;

    background: rgba(255,255,255,.05);
    overflow: hidden;
}

.breakdown-bar span {
    display: block;
    height: 100%;
    background: var(--gold);
}

.mistake-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 10px;
}

.mistake-card {
    padding: 14px;

    border: 1px solid rgba(255,255,255,.06);
    border-radius: 12px;

    background: rgba(255,255,255,.025);
}

.mistake-card strong {
    display: block;
    font-size: 12px;
}

.mistake-card span {
    display: block;
    color: var(--muted);
    font-size: 9px;
    margin-top: 5px;
}


/* =========================
   RISK
========================= */

.risk-layout {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 20px;
}

.calculator-results {
    min-height: 100%;
}

.result-box {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 15px;

    margin-top: 10px;

    border: 1px solid rgba(255,255,255,.05);
    border-radius: 11px;

    background: rgba(255,255,255,.02);
}

.result-box span {
    color: var(--muted);
    font-size: 11px;
}

.result-box strong {
    font-size: 15px;
}

.result-box.highlight {
    border-color: rgba(215,173,85,.2);
    background: rgba(215,173,85,.05);
}

.result-box.highlight strong {
    color: var(--gold2);
}


/* =========================
   CALENDAR
========================= */

.calendar-summary {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 12px;
    margin-bottom: 18px;
}

.calendar-summary > div {
    padding: 17px;

    border: 1px solid var(--border);
    border-radius: 14px;

    background: rgba(255,255,255,.025);
}

.calendar-summary span {
    display: block;
    color: var(--muted);
    font-size: 10px;
}

.calendar-summary strong {
    display: block;
    margin-top: 6px;
    font-size: 19px;
}

.calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.calendar-header h3 {
    margin: 0;
}

.calendar-nav {
    width: 36px;
    height: 36px;

    border: 1px solid var(--border);
    border-radius: 10px;

    background: rgba(255,255,255,.03);
    color: var(--text);

    font-size: 20px;
}

.calendar-header > div {
    display: flex;
    align-items: center;
    gap: 7px;
}

.calendar-grid {
    display: grid;
    grid-template-columns: repeat(7,1fr);
    gap: 7px;
}

.calendar-day-name {
    color: var(--muted);
    font-size: 9px;
    text-align: center;
    padding: 7px;
}

.calendar-day {
    min-height: 90px;

    padding: 9px;

    border: 1px solid rgba(255,255,255,.05);
    border-radius: 11px;

    background: rgba(255,255,255,.018);
}

.calendar-day.muted {
    opacity: .25;
}

.calendar-day.today {
    border-color: rgba(215,173,85,.45);
}

.calendar-number {
    font-size: 10px;
    color: #aab1bd;
}

.calendar-pl {
    margin-top: 20px;
    font-size: 10px;
    font-weight: 800;
}

.calendar-trades {
    margin-top: 5px;
    color: #6d7685;
    font-size: 8px;
}


/* =========================
   SETTINGS
========================= */

.settings-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.profile-large {
    display: flex;
    align-items: center;
    gap: 15px;

    padding: 15px;

    border: 1px solid var(--border);
    border-radius: 14px;

    background: rgba(255,255,255,.025);
}

.profile-large img {
    width: 55px;
    height: 55px;

    object-fit: cover;
    border-radius: 50%;
}

.profile-large strong,
.profile-large span {
    display: block;
}

.profile-large strong {
    font-size: 15px;
}

.profile-large span {
    color: var(--muted);
    font-size: 11px;
    margin-top: 5px;
}

.settings-note {
    margin-top: 15px;

    padding: 12px;

    color: var(--muted);
    font-size: 10px;
    line-height: 1.6;

    border: 1px solid rgba(255,255,255,.05);
    border-radius: 10px;
}


/* =========================
   MODAL
========================= */

.modal {
    position: fixed;
    inset: 0;

    display: grid;
    place-items: center;

    z-index: 300;

    padding: 20px;
}

.modal-backdrop {
    position: absolute;
    inset: 0;

    background: rgba(0,0,0,.72);
    backdrop-filter: blur(8px);
}

.modal-card {
    position: relative;
    z-index: 2;

    width: min(850px,100%);

    max-height: 92vh;

    overflow-y: auto;

    padding: 25px;

    border: 1px solid var(--border);
    border-radius: 22px;

    background: #10141c;

    box-shadow: 0 30px 100px rgba(0,0,0,.5);

    animation: modalIn .25s ease;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    margin-bottom: 22px;
}

.modal-header h2 {
    margin: 4px 0 0;
}

.modal-close {
    width: 35px;
    height: 35px;

    border: 1px solid var(--border);
    border-radius: 10px;

    background: rgba(255,255,255,.03);
    color: var(--muted);

    font-size: 20px;
}

.modal-close:hover {
    color: var(--text);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;

    margin-top: 20px;
}


/* =========================
   EMPTY
========================= */

.empty-state {
    padding: 35px 15px;
    text-align: center;
    color: #626c7b;
    font-size: 12px;
}

.empty-state.small {
    padding: 20px;
}


/* =========================
   TOAST
========================= */

.toast {
    position: fixed;

    right: 25px;
    bottom: 25px;

    z-index: 500;

    padding: 12px 17px;

    border: 1px solid var(--border);
    border-radius: 11px;

    background: #171c26;

    color: var(--text);

    font-size: 11px;

    opacity: 0;
    pointer-events: none;

    transform: translateY(10px);

    transition: .25s ease;
}

.toast.show {
    opacity: 1;
    transform: translateY(0);
}


/* =========================
   OVERLAY
========================= */

.overlay {
    display: none;

    position: fixed;
    inset: 0;

    z-index: 90;

    background: rgba(0,0,0,.6);
}


/* =========================
   ANIMATIONS
========================= */

@keyframes fadeUp {
    from {
        opacity: 0;
        transform: translateY(12px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes modalIn {
    from {
        opacity: 0;
        transform: scale(.97) translateY(10px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}


/* =========================
   RESPONSIVE
========================= */

@media (max-width: 1250px) {

    .stats-grid {
        grid-template-columns: repeat(3,1fr);
    }

    .analytics-grid {
        grid-template-columns: repeat(4,1fr);
    }

}

@media (max-width: 1000px) {

    .sidebar {
        transform: translateX(-100%);
        transition: .25s ease;
    }

    .sidebar.open {
        transform: translateX(0);
    }

    .overlay.show {
        display: block;
    }

    .main {
        margin-left: 0;
    }

    .mobile-menu-btn {
        display: block;

        border: 0;
        background: transparent;
        color: var(--text);

        font-size: 21px;

        margin-right: 13px;
    }

    .mobile-close-btn {
        display: block;

        border: 0;
        background: transparent;
        color: var(--muted);

        font-size: 24px;
    }

    .dashboard-grid,
    .analytics-layout,
    .breakdown-grid,
    .risk-layout,
    .settings-layout {
        grid-template-columns: 1fr;
    }

}

@media (max-width: 700px) {

    .page {
        padding: 20px 14px;
    }

    .topbar {
        padding: 0 15px;
        height: 70px;
    }

    .top-profile {
        display: none;
    }

    .quick-add-btn {
        padding: 9px 11px;
        font-size: 11px;
    }

    .page-intro {
        align-items: flex-start;
        flex-direction: column;
        gap: 15px;
    }

    .page-intro h2 {
        font-size: 26px;
    }

    .stats-grid {
        grid-template-columns: repeat(2,1fr);
    }

    .analytics-grid {
        grid-template-columns: repeat(2,1fr);
    }

    .journal-stats {
        grid-template-columns: repeat(2,1fr);
    }

    .calendar-summary {
        grid-template-columns: 1fr;
    }

    .form-grid {
        grid-template-columns: 1fr;
    }

    .mistake-grid {
        grid-template-columns: 1fr 1fr;
    }

    .calendar-day {
        min-height: 65px;
        padding: 6px;
    }

    .calendar-pl {
        margin-top: 12px;
        font-size: 8px;
    }

    .calendar-trades {
        display: none;
    }

    .calendar-header h3 {
        font-size: 15px;
    }

    .modal {
        padding: 8px;
    }

    .modal-card {
        max-height: 96vh;
        padding: 18px;
        border-radius: 17px;
    }

}

@media (max-width: 450px) {

    .stats-grid,
    .analytics-grid {
        grid-template-columns: 1fr 1fr;
    }

    .stat-card,
    .analytics-card {
        padding: 14px;
    }

    .stat-value {
        font-size: 18px;
    }

    .analytics-card strong {
        font-size: 17px;
    }

    .mistake-grid {
        grid-template-columns: 1fr;
    }

    .top-actions .quick-add-btn {
        display: none;
    }

}
