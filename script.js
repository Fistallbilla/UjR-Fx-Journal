:root {
  --bg: #08090c;
  --bg2: #0d0f14;
  --panel: #11141a;
  --panel2: #151820;
  --border: rgba(255,255,255,.08);
  --text: #f3f4f6;
  --muted: #8c929e;
  --gold: #d6ae55;
  --gold2: #f0cf79;
  --green: #36d399;
  --red: #ff5c70;
  --blue: #66a8ff;
  --shadow: 0 20px 60px rgba(0,0,0,.35);
  --radius: 18px;
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
    radial-gradient(circle at top right, rgba(214,174,85,.07), transparent 28%),
    var(--bg);
  color: var(--text);
  font-family: Inter, Arial, sans-serif;
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


/* ================= LOGIN ================= */

.login-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
}

.login-card {
  width: min(420px, 100%);
  background: rgba(17,20,26,.92);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 40px 30px;
  text-align: center;
  box-shadow: var(--shadow);
}

.login-logo {
  width: 90px;
  height: 90px;
  object-fit: contain;
  border-radius: 22px;
  margin-bottom: 15px;
}

.login-card h1 {
  margin: 0;
  font-size: 30px;
}

.login-card p {
  margin: 7px 0 28px;
  color: var(--muted);
}

.google-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: #fff;
  color: #111;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-weight: 800;
}

.google-icon {
  font-size: 20px;
  font-weight: 900;
}


/* ================= APP ================= */

.app {
  min-height: 100vh;
  display: flex;
}

.sidebar {
  width: 250px;
  flex-shrink: 0;
  background: rgba(13,15,20,.96);
  border-right: 1px solid var(--border);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand,
.mobile-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.brand img,
.mobile-brand img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  border-radius: 12px;
}

.brand div,
.mobile-brand div {
  display: flex;
  flex-direction: column;
}

.brand strong,
.mobile-brand strong {
  font-size: 15px;
}

.brand span,
.mobile-brand span {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 32px;
}

.nav-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  min-height: 44px;
  border-radius: 12px;
  padding: 10px 13px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 11px;
  font-weight: 700;
}

.nav-btn:hover {
  color: var(--text);
  background: rgba(255,255,255,.035);
}

.nav-btn.active {
  color: #111;
  background: linear-gradient(135deg,var(--gold),var(--gold2));
}

.sidebar-bottom {
  margin-top: auto;
}

.user-mini {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
  background: rgba(255,255,255,.025);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.user-mini img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}

.user-mini div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-mini strong {
  font-size: 12px;
}

.user-mini span {
  color: var(--muted);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  width: 100%;
  margin-top: 9px;
  border: 1px solid rgba(255,92,112,.2);
  background: rgba(255,92,112,.07);
  color: var(--red);
  border-radius: 11px;
  min-height: 40px;
  font-weight: 700;
}


/* ================= MAIN ================= */

.main {
  flex: 1;
  min-width: 0;
  padding: 28px;
}

.mobile-header,
.mobile-nav {
  display: none;
}

.page {
  display: none;
  max-width: 1500px;
  margin: auto;
}

.page.active-page {
  display: block;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  color: var(--gold2);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .12em;
  font-weight: 900;
}

.page-header h1 {
  margin: 5px 0;
  font-size: clamp(25px, 3vw, 36px);
}

.page-header p {
  margin: 0;
  color: var(--muted);
}


/* ================= BUTTONS ================= */

.add-trade-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 10px 15px;
  border: 1px solid rgba(214,174,85,.45);
  border-radius: 12px;
  background: linear-gradient(135deg,var(--gold),var(--gold2));
  color: #111;
  font-weight: 900;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(214,174,85,.16);
}

.primary-btn {
  border: 0;
  background: linear-gradient(135deg,var(--gold),var(--gold2));
  color: #111;
  border-radius: 11px;
  min-height: 42px;
  padding: 10px 16px;
  font-weight: 900;
}

.secondary-btn,
.quick-btn {
  border: 1px solid var(--border);
  background: var(--panel2);
  color: var(--text);
  border-radius: 11px;
  min-height: 42px;
  padding: 9px 14px;
  font-weight: 700;
}

.secondary-btn:hover,
.quick-btn:hover {
  border-color: rgba(214,174,85,.35);
}


/* ================= PANELS ================= */

.panel {
  background: rgba(17,20,26,.88);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 10px 35px rgba(0,0,0,.12);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 18px;
}

.panel-header h2 {
  margin: 0;
  font-size: 16px;
}

.panel-header span {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}


/* ================= STATS ================= */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(6,1fr);
  gap: 13px;
  margin-bottom: 20px;
}

.stat-card,
.analytics-card,
.streak-card,
.risk-result-card {
  background: linear-gradient(
    145deg,
    rgba(255,255,255,.035),
    rgba(255,255,255,.015)
  );
  border: 1px solid var(--border);
  border-radius: 15px;
  padding: 17px;
}

.stat-card span,
.analytics-card span,
.streak-card span,
.risk-result-card span {
  color: var(--muted);
  font-size: 11px;
  display: block;
}

.stat-card strong,
.analytics-card strong,
.streak-card strong,
.risk-result-card strong {
  display: block;
  font-size: 21px;
  margin-top: 7px;
}


/* ================= GRIDS ================= */

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
}

.chart-panel {
  min-height: 390px;
}

canvas {
  width: 100% !important;
  height: 310px !important;
  display: block;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}


/* ================= ANALYTICS ================= */

.analytics-controls {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.analytics-controls .field {
  min-width: 190px;
}

.analytics-stats {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 12px;
  margin-bottom: 18px;
}

.streak-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.large-chart {
  min-height: 390px;
}


/* ================= FORMS ================= */

.form-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field.full {
  grid-column: 1 / -1;
}

.field > span {
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  min-height: 43px;
  background: #0b0d11;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;
}

textarea {
  resize: vertical;
  min-height: 100px;
}

input:focus,
select:focus,
textarea:focus {
  border-color: rgba(214,174,85,.55);
  box-shadow: 0 0 0 3px rgba(214,174,85,.07);
}

input[readonly] {
  opacity: .7;
}


/* ================= JOURNAL FILTER ================= */

.filter-panel {
  display: grid;
  grid-template-columns: 1.5fr repeat(3,1fr) auto;
  gap: 12px;
  align-items: end;
  background: rgba(17,20,26,.88);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 15px;
  margin-bottom: 20px;
}


/* ================= TABLE ================= */

.table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;

  scrollbar-width: none;
}

.table-wrap::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  color: var(--muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .06em;
  text-align: left;
  padding: 11px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.data-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(255,255,255,.045);
  font-size: 12px;
  white-space: nowrap;
}

.data-table tbody tr:hover {
  background: rgba(255,255,255,.025);
}

.analytics-table {
  min-width: 760px;
}

.result-win {
  color: var(--green);
  font-weight: 800;
}

.result-loss {
  color: var(--red);
  font-weight: 800;
}

.result-be {
  color: var(--muted);
  font-weight: 800;
}

.pl-positive {
  color: var(--green);
  font-weight: 800;
}

.pl-negative {
  color: var(--red);
  font-weight: 800;
}

.action-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 11px;
}

.action-btn.delete {
  color: var(--red);
}


/* ================= RECENT TRADES ================= */

.recent-trades {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 310px;
  overflow-y: auto;
}

.recent-trade {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.05);
  border-radius: 11px;
}

.recent-trade-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.recent-trade-left strong {
  font-size: 12px;
}

.recent-trade-left span {
  color: var(--muted);
  font-size: 10px;
}


/* ================= RISK ================= */

.risk-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.risk-results {
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 13px;
  align-content: start;
}


/* ================= CALENDAR ================= */

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 15px;
}

.calendar-header h2 {
  min-width: 200px;
  text-align: center;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel2);
  color: var(--text);
  font-size: 23px;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7,1fr);
  gap: 6px;
}

.calendar-weekdays span {
  text-align: center;
  color: var(--muted);
  font-size: 10px;
  padding: 8px 0;
  text-transform: uppercase;
}

.calendar-day {
  min-height: 95px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255,255,255,.018);
  padding: 9px;
  cursor: pointer;
}

.calendar-day:hover {
  border-color: rgba(214,174,85,.4);
}

.calendar-day.empty {
  opacity: .25;
  cursor: default;
}

.calendar-day.today {
  border-color: var(--gold);
}

.calendar-number {
  font-size: 12px;
  font-weight: 800;
}

.calendar-pl {
  margin-top: 16px;
  font-size: 12px;
  font-weight: 900;
}

.calendar-trades {
  color: var(--muted);
  font-size: 9px;
  margin-top: 3px;
}


/* ================= SETTINGS ================= */

.settings-panel {
  max-width: 800px;
}

.profile-panel {
  max-width: 800px;
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-info img {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-info div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.profile-info span {
  color: var(--muted);
  font-size: 12px;
}

.success-text {
  color: var(--green);
  font-size: 12px;
  margin-top: 10px;
}

.error-text {
  color: var(--red);
  font-size: 12px;
  margin-top: 10px;
}


/* ================= MODAL ================= */

.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,.78);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal-card {
  width: min(900px,100%);
  max-height: 92vh;
  overflow-y: auto;
  background: #101319;
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 22px;
  box-shadow: var(--shadow);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 5px 0 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--panel2);
  color: var(--text);
  border-radius: 9px;
  font-size: 22px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}


/* ================= MOBILE ================= */

@media (max-width: 1100px) {

  .sidebar {
    width: 220px;
  }

  .stats-grid {
    grid-template-columns: repeat(3,1fr);
  }

  .analytics-stats {
    grid-template-columns: repeat(3,1fr);
  }

  .dashboard-grid,
  .analytics-grid,
  .risk-layout {
    grid-template-columns: 1fr;
  }

  .filter-panel {
    grid-template-columns: repeat(2,1fr);
  }

}


@media (max-width: 800px) {

  .sidebar {
    display: none;
  }

  .main {
    padding: 15px;
  }

  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
  }

  .mobile-menu-btn {
    width: 42px;
    height: 42px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--panel2);
    color: var(--text);
    font-size: 20px;
  }

  .mobile-nav {
    display: none;
    flex-direction: column;
    gap: 5px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 10px;
    margin-bottom: 15px;
  }

  .mobile-nav.open {
    display: flex;
  }

  .mobile-nav .nav-btn {
    width: 100%;
  }

  .page-header {
    align-items: center;
  }

  .page-header h1 {
    font-size: 25px;
  }

  .stats-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .analytics-stats {
    grid-template-columns: repeat(2,1fr);
  }

  .streak-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .filter-panel {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field.full {
    grid-column: auto;
  }

  .calendar-day {
    min-height: 75px;
  }

  .calendar-weekdays span {
    font-size: 8px;
  }

}


@media (max-width: 680px) {

  .main {
    padding: 12px;
  }

  .page-header {
    gap: 10px;
    margin-bottom: 18px;
  }

  .page-header p {
    font-size: 11px;
  }

  .page-header .add-trade-btn {
    min-height: 40px;
    padding: 9px 12px;
    border-radius: 11px;
  }

  .page-header .add-trade-btn .label {
    display: none;
  }

  .stats-grid {
    gap: 8px;
  }

  .stat-card {
    padding: 13px;
  }

  .stat-card strong {
    font-size: 17px;
  }

  .analytics-stats {
    gap: 8px;
  }

  .analytics-card {
    padding: 13px;
  }

  .analytics-card strong {
    font-size: 16px;
  }

  .streak-card {
    padding: 13px;
  }

  .panel {
    padding: 14px;
    border-radius: 15px;
  }

  .analytics-controls {
    display: grid;
    grid-template-columns: 1fr;
  }

  .analytics-controls .field {
    min-width: 0;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .risk-results {
    grid-template-columns: 1fr 1fr;
  }

  .calendar-header h2 {
    min-width: 150px;
    font-size: 16px;
  }

  .calendar-grid {
    gap: 3px;
  }

  .calendar-day {
    min-height: 65px;
    padding: 6px;
    border-radius: 8px;
  }

  .calendar-pl {
    margin-top: 10px;
    font-size: 9px;
  }

  .calendar-trades {
    font-size: 8px;
  }

  .modal {
    padding: 8px;
  }

  .modal-card {
    max-height: 96vh;
    padding: 15px;
    border-radius: 17px;
  }

  .modal-actions {
    position: sticky;
    bottom: -15px;
    background: #101319;
    padding: 12px 0 0;
  }

}


@media (max-width: 430px) {

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .analytics-stats {
    grid-template-columns: 1fr 1fr;
  }

  .streak-grid {
    grid-template-columns: 1fr 1fr;
  }

  .risk-results {
    grid-template-columns: 1fr;
  }

  .calendar-weekdays {
    gap: 2px;
  }

  .calendar-weekdays span {
    font-size: 7px;
  }

}
