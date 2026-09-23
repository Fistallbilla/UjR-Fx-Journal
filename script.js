:root {
  --bg: #07090d;
  --bg2: #0b0e14;
  --panel: rgba(17, 21, 29, 0.82);
  --panel-solid: #11151d;
  --panel-hover: #151a23;

  --border: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.13);

  --text: #f5f7fa;
  --muted: #8d96a5;
  --muted2: #626b79;

  --gold: #d8aa45;
  --gold-light: #f0c96b;

  --green: #3ed598;
  --red: #ff6677;
  --blue: #62a7ff;

  --radius: 18px;
  --shadow: 0 20px 60px rgba(0,0,0,.28);

  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
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
    radial-gradient(circle at 80% -10%, rgba(216,170,69,.08), transparent 28%),
    radial-gradient(circle at 10% 100%, rgba(98,167,255,.05), transparent 30%),
    var(--bg);

  color: var(--text);
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


/* LOGIN */

.login-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
}

.login-card {
  width: min(420px, 100%);
  padding: 42px 34px;
  text-align: center;

  background:
    linear-gradient(145deg, rgba(255,255,255,.06), rgba(255,255,255,.015)),
    rgba(11,14,20,.92);

  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);

  animation: rise .5s ease;
}

.login-logo {
  width: 92px;
  height: 92px;
  object-fit: contain;
  border-radius: 22px;
  margin-bottom: 18px;
}

.login-brand {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: -1.5px;
}

.login-brand span {
  color: var(--gold);
}

.login-subtitle {
  color: var(--muted);
  margin: 8px 0 28px;
}

.google-btn {
  width: 100%;
  border: 1px solid var(--border-strong);
  background: #fff;
  color: #111;
  border-radius: 13px;
  padding: 14px;
  font-weight: 700;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;

  transition: .2s;
}

.google-btn:hover {
  transform: translateY(-2px);
}

.google-icon {
  font-weight: 900;
  font-size: 20px;
}


/* APP */

.app {
  min-height: 100vh;
  display: flex;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;

  width: 255px;
  padding: 24px 16px;

  background: rgba(9,12,17,.88);
  backdrop-filter: blur(20px);

  border-right: 1px solid var(--border);

  display: flex;
  flex-direction: column;
  z-index: 100;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 30px;
}

.sidebar-logo img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  border-radius: 12px;
}

.sidebar-logo strong {
  font-size: 18px;
}

.sidebar-logo strong span {
  color: var(--gold);
}

.sidebar-logo small {
  display: block;
  color: var(--muted2);
  font-size: 10px;
  margin-top: 2px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nav-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--muted);

  padding: 12px 14px;
  border-radius: 12px;

  display: flex;
  align-items: center;
  gap: 13px;

  text-align: left;
  transition: .2s;
}

.nav-item span {
  width: 20px;
  text-align: center;
  font-size: 17px;
}

.nav-item:hover {
  color: var(--text);
  background: rgba(255,255,255,.045);
}

.nav-item.active {
  color: var(--gold-light);
  background:
    linear-gradient(90deg, rgba(216,170,69,.14), rgba(216,170,69,.035));
  border: 1px solid rgba(216,170,69,.12);
}

.sidebar-bottom {
  margin-top: auto;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 12px;
  border-radius: 14px;

  background: rgba(255,255,255,.035);
  border: 1px solid var(--border);
}

.user-card img {
  width: 38px;
  height: 38px;
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
  font-size: 13px;
}

.user-info small {
  color: var(--muted);
  font-size: 10px;
  margin-top: 3px;
}

.logout-btn {
  width: 100%;
  margin-top: 10px;
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 10px;
  border-radius: 10px;
  text-align: left;
}

.logout-btn:hover {
  background: rgba(255,255,255,.04);
  color: var(--red);
}


/* MAIN */

.main {
  margin-left: 255px;
  min-width: 0;
  flex: 1;
}

.topbar {
  height: 78px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 0 34px;

  position: sticky;
  top: 0;
  z-index: 50;

  background: rgba(7,9,13,.72);
  backdrop-filter: blur(18px);

  border-bottom: 1px solid var(--border);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 16px;
  font-weight: 800;
}

.page-subtitle {
  color: var(--muted2);
  font-size: 11px;
  margin-top: 2px;
}

.top-date {
  color: var(--muted);
  font-size: 12px;
}

.content {
  max-width: 1600px;
  margin: auto;
  padding: 34px;
}

.page {
  animation: fade .25s ease;
}

.hero-row,
.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

.eyebrow {
  color: var(--gold);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.8px;
  margin: 0 0 7px;
}

h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  letter-spacing: -1.5px;
}

h2 {
  margin: 0;
  font-size: 17px;
}

h3 {
  font-size: 13px;
  margin: 0 0 17px;
  color: #dfe4eb;
}

.muted {
  color: var(--muted);
  margin: 7px 0 0;
  font-size: 13px;
}


/* BUTTONS */

.primary-btn,
.secondary-btn,
.text-btn,
.icon-btn {
  border: 0;
  transition: .2s;
}

.primary-btn {
  background: linear-gradient(135deg, var(--gold-light), var(--gold));
  color: #161108;
  font-weight: 800;
  padding: 11px 17px;
  border-radius: 11px;
  box-shadow: 0 8px 25px rgba(216,170,69,.14);
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(216,170,69,.22);
}

.secondary-btn {
  color: var(--text);
  background: rgba(255,255,255,.045);
  border: 1px solid var(--border);
  padding: 10px 14px;
  border-radius: 10px;
}

.secondary-btn:hover {
  background: rgba(255,255,255,.08);
}

.text-btn {
  background: transparent;
  color: var(--gold-light);
  font-size: 12px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: var(--text);
  background: rgba(255,255,255,.05);
  border: 1px solid var(--border);
}

.icon-btn:hover {
  background: rgba(255,255,255,.09);
}

.full {
  width: 100%;
  margin-top: 22px;
}


/* STAT CARDS */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat-card {
  padding: 20px;

  background:
    linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.012)),
    var(--panel);

  border: 1px solid var(--border);
  border-radius: var(--radius);

  display: flex;
  align-items: center;
  gap: 15px;

  box-shadow: 0 10px 35px rgba(0,0,0,.12);

  transition: .2s;
}

.stat-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
}

.stat-icon {
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;

  border-radius: 13px;
  background: rgba(216,170,69,.08);
  font-size: 19px;
}

.stat-card span,
.stat-card strong {
  display: block;
}

.stat-card span {
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 5px;
}

.stat-card strong {
  font-size: 21px;
}

.mini-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 14px 0 24px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.018);
  border-radius: 14px;
  overflow: hidden;
}

.mini-stats > div {
  padding: 13px 17px;
  border-right: 1px solid var(--border);
}

.mini-stats > div:last-child {
  border-right: 0;
}

.mini-stats span,
.mini-stats strong {
  display: block;
}

.mini-stats span {
  color: var(--muted);
  font-size: 10px;
}

.mini-stats strong {
  margin-top: 5px;
  font-size: 14px;
}


/* PANELS */

.panel {
  background:
    linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,.012)),
    var(--panel);

  border: 1px solid var(--border);
  border-radius: var(--radius);

  box-shadow: 0 15px 45px rgba(0,0,0,.12);
  overflow: hidden;
}

.panel-header {
  padding: 20px 20px 15px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: 1px solid var(--border);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
}

.chart-container {
  height: 310px;
  position: relative;
  padding: 15px;
}

#equityCanvas {
  width: 100%;
  height: 100%;
}

.chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted2);
  font-size: 12px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

th,
td {
  padding: 13px 15px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  white-space: nowrap;
}

th {
  color: var(--muted2);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .8px;
}

td {
  color: #dce1e8;
}

tr:hover td {
  background: rgba(255,255,255,.018);
}

.empty-state {
  text-align: center;
  padding: 55px 20px;
  color: var(--muted);
}

.empty-state.small {
  padding: 30px;
}

.empty-icon {
  font-size: 30px;
  opacity: .5;
}

.empty-state h3 {
  margin: 10px 0 5px;
}

.empty-state p {
  margin: 0;
  font-size: 12px;
}


/* JOURNAL */

.heading-actions {
  display: flex;
  gap: 9px;
}

.journal-summary,
.calendar-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 17px;
}

.journal-summary > div,
.calendar-summary > div {
  padding: 16px 18px;
  background: rgba(255,255,255,.025);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.journal-summary span,
.journal-summary strong,
.calendar-summary span,
.calendar-summary strong {
  display: block;
}

.journal-summary span,
.calendar-summary span {
  color: var(--muted);
  font-size: 10px;
}

.journal-summary strong,
.calendar-summary strong {
  font-size: 18px;
  margin-top: 5px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 16px;
}

.filter-bar input,
.filter-bar select {
  width: auto;
  min-width: 150px;
}

.result-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 100px;
  padding: 5px 9px;
  font-size: 9px;
  font-weight: 800;
}

.result-chip.win {
  color: var(--green);
  background: rgba(62,213,152,.09);
}

.result-chip.loss {
  color: var(--red);
  background: rgba(255,102,119,.09);
}

.result-chip.be {
  color: var(--muted);
  background: rgba(255,255,255,.06);
}

.direction-buy {
  color: var(--green);
}

.direction-sell {
  color: var(--red);
}

.pl-positive {
  color: var(--green) !important;
}

.pl-negative {
  color: var(--red) !important;
}

.action-group {
  display: flex;
  gap: 5px;
}

.action-btn {
  border: 1px solid var(--border);
  background: rgba(255,255,255,.035);
  color: var(--muted);
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 10px;
}

.action-btn:hover {
  color: var(--text);
  background: rgba(255,255,255,.08);
}

.action-btn.delete:hover {
  color: var(--red);
}


/* ANALYTICS */

.analytics-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.analytics-card {
  padding: 20px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--panel);
}

.analytics-card span,
.analytics-card strong {
  display: block;
}

.analytics-card span {
  color: var(--muted);
  font-size: 11px;
}

.analytics-card strong {
  font-size: 25px;
  margin-top: 8px;
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.result-bars {
  padding: 20px;
}

.bar-row {
  margin-bottom: 20px;
}

.bar-row > div:first-child {
  display: flex;
  justify-content: space-between;
  margin-bottom: 7px;
  font-size: 11px;
}

.bar-bg {
  height: 8px;
  border-radius: 20px;
  background: rgba(255,255,255,.06);
  overflow: hidden;
}

.bar {
  height: 100%;
  width: 0;
  border-radius: inherit;
  transition: width .5s ease;
}

.bar.win {
  background: var(--green);
}

.bar.loss {
  background: var(--red);
}

.bar.be {
  background: var(--muted);
}

.metric-list {
  padding: 10px 20px;
}

.metric-list > div {
  display: flex;
  justify-content: space-between;
  padding: 13px 0;
  border-bottom: 1px solid var(--border);
}

.metric-list > div:last-child {
  border-bottom: 0;
}

.metric-list span {
  color: var(--muted);
  font-size: 11px;
}

.metric-list strong {
  font-size: 12px;
}

.breakdown-list {
  padding: 10px 20px;
}

.breakdown-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.breakdown-item:last-child {
  border-bottom: 0;
}

.breakdown-item span {
  color: var(--muted);
}


/* FORMS */

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 15px;
}

.form-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}

.form-section:first-child {
  padding-top: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-full {
  grid-column: 1 / -1;
}

.field label {
  color: #c8ced8;
  font-size: 10px;
  font-weight: 700;
}

.field small {
  color: var(--muted2);
  font-size: 9px;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--border);
  outline: none;

  color: var(--text);
  background: rgba(0,0,0,.23);

  border-radius: 10px;
  padding: 11px 12px;

  transition: .2s;
}

select option {
  background: #11151d;
  color: #fff;
}

textarea {
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  border-color: rgba(216,170,69,.5);
  box-shadow: 0 0 0 3px rgba(216,170,69,.06);
}

.calculated input {
  color: var(--gold-light);
  font-weight: 800;
}


/* RISK */

.risk-layout {
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 16px;
}

.risk-layout > .panel {
  padding: 20px;
}

.risk-results {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.result-card {
  padding: 20px;
  min-height: 125px;

  display: flex;
  flex-direction: column;
  justify-content: space-between;

  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--panel);
}

.result-card span {
  color: var(--muted);
  font-size: 11px;
}

.result-card strong {
  font-size: 24px;
}

.result-card.highlight {
  border-color: rgba(216,170,69,.28);
  background: linear-gradient(
    145deg,
    rgba(216,170,69,.12),
    rgba(216,170,69,.025)
  );
}

.info-box {
  margin-top: 16px;
  padding: 18px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.025);
  border-radius: 14px;
}

.info-box strong {
  color: var(--gold-light);
  font-size: 11px;
}

.info-box p {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
  margin: 7px 0 0;
}


/* CALENDAR */

.calendar-panel {
  padding-bottom: 20px;
}

.calendar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
}

.calendar-header > div {
  flex: 1;
  text-align: center;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  padding: 0 20px;
}

.calendar-weekdays {
  margin-bottom: 8px;
}

.calendar-weekdays span {
  color: var(--muted2);
  font-size: 9px;
  text-align: center;
  text-transform: uppercase;
}

.calendar-day {
  min-height: 95px;
  padding: 9px;

  border: 1px solid var(--border);
  border-radius: 10px;

  background: rgba(255,255,255,.018);
}

.calendar-day.empty {
  opacity: .25;
}

.calendar-day.today {
  border-color: rgba(216,170,69,.55);
}

.calendar-number {
  font-size: 11px;
  color: var(--muted);
}

.calendar-pl {
  margin-top: 15px;
  font-size: 11px;
  font-weight: 800;
}

.calendar-count {
  margin-top: 5px;
  color: var(--muted2);
  font-size: 9px;
}


/* SETTINGS */

.settings-card {
  max-width: 750px;
}

.setting-section {
  padding: 24px;
  border-bottom: 1px solid var(--border);
}

.setting-section:last-child {
  border-bottom: 0;
}

.setting-section h2 {
  margin-bottom: 18px;
}

.account-preview {
  display: flex;
  align-items: center;
  gap: 13px;
}

.account-preview img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.account-preview strong,
.account-preview span {
  display: block;
}

.account-preview strong {
  font-size: 14px;
}

.account-preview span {
  color: var(--muted);
  font-size: 11px;
  margin-top: 4px;
}


/* MODAL */

.modal {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.76);
  backdrop-filter: blur(8px);
}

.modal-box {
  position: relative;
  z-index: 1;

  width: min(850px, 100%);
  max-height: 92vh;
  overflow-y: auto;

  background:
    linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.01)),
    #0e1219;

  border: 1px solid var(--border-strong);
  border-radius: 22px;

  box-shadow: 0 30px 100px rgba(0,0,0,.6);

  padding: 25px;

  animation: rise .25s ease;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.close-btn {
  border: 0;
  background: rgba(255,255,255,.05);
  color: var(--muted);
  width: 34px;
  height: 34px;
  border-radius: 9px;
  font-size: 22px;
}

.close-btn:hover {
  color: var(--text);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding-top: 20px;
}

.error-text {
  color: var(--red);
  font-size: 11px;
  min-height: 16px;
  margin: 10px 0 0;
}


/* TOAST */

.toast {
  position: fixed;
  right: 22px;
  bottom: 22px;

  padding: 12px 17px;
  border-radius: 10px;

  background: #151b24;
  border: 1px solid var(--border-strong);

  box-shadow: var(--shadow);

  font-size: 12px;

  transform: translateY(20px);
  opacity: 0;
  pointer-events: none;

  transition: .25s;
  z-index: 1000;
}

.toast.show {
  transform: translateY(0);
  opacity: 1;
}


/* MOBILE */

.mobile-only {
  display: none;
}

.overlay {
  display: none;
}

@media (max-width: 1100px) {

  .stats-grid,
  .analytics-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid,
  .risk-layout {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 800px) {

  .sidebar {
    transform: translateX(-100%);
    transition: .25s;
    box-shadow: 30px 0 80px rgba(0,0,0,.35);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0,0,0,.6);
  }

  .overlay.show {
    display: block;
  }

  .main {
    margin-left: 0;
  }

  .mobile-only {
    display: block;
  }

  .mobile-add {
    border: 0;
    background: var(--gold);
    color: #171208;
    padding: 8px 11px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
  }

  .topbar {
    padding: 0 16px;
  }

  .content {
    padding: 22px 15px;
  }

  .hero-row,
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions {
    width: 100%;
  }

  .heading-actions button {
    flex: 1;
  }

  .stats-grid,
  .analytics-stats,
  .journal-summary,
  .calendar-summary {
    grid-template-columns: 1fr 1fr;
  }

  .mini-stats {
    grid-template-columns: 1fr 1fr;
  }

  .mini-stats > div:nth-child(2) {
    border-right: 0;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-full {
    grid-column: auto;
  }

  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .calendar-day {
    min-height: 72px;
    padding: 6px;
  }

  .calendar-pl {
    margin-top: 10px;
    font-size: 9px;
  }

  .calendar-weekdays,
  .calendar-grid {
    padding: 0 10px;
    gap: 4px;
  }

}

@media (max-width: 500px) {

  .top-date {
    display: none;
  }

  .stats-grid,
  .analytics-stats,
  .journal-summary,
  .calendar-summary,
  .risk-results {
    grid-template-columns: 1fr;
  }

  .mini-stats {
    grid-template-columns: 1fr 1fr;
  }

  .mini-stats > div {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .mini-stats > div:nth-last-child(-n+2) {
    border-bottom: 0;
  }

  .modal {
    padding: 8px;
  }

  .modal-box {
    max-height: 96vh;
    border-radius: 16px;
    padding: 18px;
  }

  h1 {
    font-size: 29px;
  }

}


/* ANIMATIONS */

@keyframes fade {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(15px) scale(.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
