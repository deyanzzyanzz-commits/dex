import { useEffect, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "careflow-queues";
const CALL_KEY = "careflow-calling";
const STAFF_KEY = "careflow-staff";
const STAFF_PASSWORD = "petugas123";

const digitWords = [
  "nol",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
];

function callText(call) {
  const letter = call.number.charAt(0);
  const digits = call.number
    .slice(1)
    .split("")
    .map((d) => digitWords[Number(d)] ?? d)
    .join(" ");

  return `Nomor antrean ${letter} ${digits}, atas nama ${call.name}, silakan menuju ${call.clinic}.`;
}

function speakCall(call) {
  if (!("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(callText(call));
    utterance.lang = "id-ID";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Suara tidak tersedia di browser ini.
  }
}

function loadCalling() {
  try {
    const saved = localStorage.getItem(CALL_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

const clinics = [
  "Poli Umum",
  "Poli Gigi",
  "Poli Anak",
  "Poli Kandungan",
  "Poli Mata",
];

const prefixes = {
  "Poli Umum": "U",
  "Poli Gigi": "G",
  "Poli Anak": "A",
  "Poli Kandungan": "K",
  "Poli Mata": "M",
};

const statuses = ["Menunggu", "Dipanggil", "Diperiksa", "Selesai", "Batal"];

const queueActions = {
  Menunggu: [
    { label: "Panggil", status: "Dipanggil", variant: "action-primary" },
    { label: "Batal", status: "Batal", variant: "action-ghost" },
  ],
  Dipanggil: [
    { label: "Mulai periksa", status: "Diperiksa", variant: "action-primary" },
    { label: "Batal", status: "Batal", variant: "action-ghost" },
  ],
  Diperiksa: [
    { label: "Selesai", status: "Selesai", variant: "action-primary" },
  ],
  Selesai: [],
  Batal: [],
};

function loadQueues() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function LogoMark() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" fill="none">
      <defs>
        <linearGradient
          id="logo-gradient"
          x1="6"
          y1="6"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#logo-gradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 15H15V8" />
        <path d="M25 8V15H32" />
        <path d="M8 25H15V32" />
        <path d="M25 32V25H32" />
      </g>
    </svg>
  );
}

function App() {
  const [queues, setQueues] = useState(loadQueues);
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState(clinics[0]);
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState("Semua Poli");
  const [statusFilter, setStatusFilter] = useState("Semua Status");
  const [page, setPage] = useState(() =>
    sessionStorage.getItem(STAFF_KEY) === "1" ? "dashboard" : "register"
  );
  const [notice, setNotice] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [isStaff, setIsStaff] = useState(
    () => sessionStorage.getItem(STAFF_KEY) === "1"
  );
  const [showLogin, setShowLogin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);
  const [calling, setCalling] = useState(loadCalling);

  function loginStaff(event) {
    event.preventDefault();

    if (pin === STAFF_PASSWORD) {
      setIsStaff(true);
      sessionStorage.setItem(STAFF_KEY, "1");
      setShowLogin(false);
      setPin("");
      setPinError("");
      setPage("dashboard");
      setNotice("Berhasil masuk sebagai petugas.");
    } else {
      setPinError("Sandi salah. Coba lagi.");
    }
  }

  function logoutStaff() {
    setIsStaff(false);
    sessionStorage.removeItem(STAFF_KEY);
    setPage("register");
    setNotice("Anda telah keluar dari mode petugas.");
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queues));
    } catch {
      // Data tetap dapat digunakan selama halaman terbuka.
    }
  }, [queues]);

  useEffect(() => {
    try {
      if (calling) {
        localStorage.setItem(CALL_KEY, JSON.stringify(calling));
      }
    } catch {
      // Panggilan tetap tampil selama halaman terbuka.
    }
  }, [calling]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === STORAGE_KEY) setQueues(loadQueues());
      if (event.key === CALL_KEY) setCalling(loadCalling());
      if (event.key === null) {
        setQueues(loadQueues());
        setCalling(loadCalling());
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const waiting = queues.filter((q) => q.status === "Menunggu").length;
  const examining = queues.filter((q) => q.status === "Diperiksa").length;
  const completed = queues.filter((q) => q.status === "Selesai").length;

  function registerPatient(event) {
    event.preventDefault();

    const patientName = name.trim();

    if (!patientName) {
      setNotice("Nama pasien wajib diisi.");
      return;
    }

    const prefix = prefixes[clinic];

    const highestNumber = queues
      .filter((q) => q.clinic === clinic)
      .reduce((max, q) => {
        const number = Number(String(q.number).slice(1));
        return Math.max(max, Number.isFinite(number) ? number : 0);
      }, 0);

    const number = `${prefix}${String(highestNumber + 1).padStart(3, "0")}`;

    const newQueue = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      number,
      name: patientName,
      clinic,
      status: "Menunggu",
      time: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setQueues((current) => [...current, newQueue]);
    setName("");
    setLastTicket(newQueue);
    setNotice(`Pendaftaran berhasil. Nomor antrean: ${number}`);
    setPage("ticket");
  }

  function changeStatus(id, status) {
    if (!isStaff) return;

    if (status === "Dipanggil") {
      const target = queues.find((q) => q.id === id);

      if (target) {
        setCalling({
          id: target.id,
          number: target.number,
          name: target.name,
          clinic: target.clinic,
          at: Date.now(),
        });
      }
    }

    setQueues((current) =>
      current.map((q) => (q.id === id ? { ...q, status } : q))
    );
    setNotice(`Status antrean berhasil diubah menjadi ${status}.`);
  }

  function removeQueue(id) {
    if (!isStaff) return;
    setQueues((current) => current.filter((q) => q.id !== id));
    setNotice("Antrean berhasil dihapus.");
  }

  function resetQueues() {
    if (!isStaff) return;
    setQueues([]);
    setCalling(null);
    setLastTicket(null);
    try {
      localStorage.removeItem(CALL_KEY);
    } catch {
      // Abaikan jika penyimpanan tidak tersedia.
    }
    setShowReset(false);
    setNotice("Semua antrean berhasil direset.");
  }

  const filteredQueues = queues.filter((q) => {
    const keyword = search.trim().toLowerCase();

    const matchesSearch =
      q.name.toLowerCase().includes(keyword) ||
      q.number.toLowerCase().includes(keyword) ||
      q.clinic.toLowerCase().includes(keyword);

    const matchesClinic =
      clinicFilter === "Semua Poli" || q.clinic === clinicFilter;

    const matchesStatus =
      statusFilter === "Semua Status" || q.status === statusFilter;

    return matchesSearch && matchesClinic && matchesStatus;
  });

  const nextQueues = clinics
    .map((currentClinic) =>
      queues.find(
        (q) => q.clinic === currentClinic && q.status === "Menunggu"
      )
    )
    .filter(Boolean);

  if (window.location.hash === "#layar") {
    return <DisplayScreen calling={calling} queues={queues} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">
            <LogoMark />
          </div>

          <div className="brand-text">
            <h2>CareFlow</h2>
            <p>Hospital Queue System</p>
          </div>
        </div>

        {isStaff && <p className="nav-label">MENU UTAMA</p>}

        <nav className={`navigation ${isStaff ? "" : "navigation-guest"}`}>
          {isStaff && (
            <button
              type="button"
              className={`nav-item ${page === "dashboard" ? "active" : ""}`}
              onClick={() => setPage("dashboard")}
            >
              <span className="nav-icon">▦</span>
              <span>Dashboard</span>
            </button>
          )}

          <button
            type="button"
            className={`nav-item ${page === "register" ? "active" : ""}`}
            onClick={() => setPage("register")}
          >
            <span className="nav-icon">＋</span>
            <span>Buat Nomor Antrean</span>
          </button>

          {isStaff && (
            <button
              type="button"
              className={`nav-item ${page === "patients" ? "active" : ""}`}
              onClick={() => setPage("patients")}
            >
              <span className="nav-icon">☷</span>
              <span>Data Antrean</span>
            </button>
          )}

          {isStaff && (
            <button
              type="button"
              className="nav-item"
              onClick={() =>
                window.open(`${window.location.pathname}#layar`, "_blank")
              }
            >
              <span className="nav-icon">◉</span>
              <span>Layar Panggilan</span>
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="online-dot" />
            Sistem aktif
            <p>Mode demo lokal</p>
          </div>

          <p className="sidebar-footer">CareFlow © 2026</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="page-heading">
            <p className="eyebrow">HOSPITAL MANAGEMENT</p>
            <h1>
              {page === "dashboard"
                ? "Dashboard"
                : page === "register"
                  ? "Buat Nomor Antrean"
                  : page === "ticket"
                    ? "Tiket Antrean"
                    : "Data Antrean"}
            </h1>
          </div>

          <div className="profile">
            <div className="profile-icon">{isStaff ? "P" : "T"}</div>
            <div>
              <strong>{isStaff ? "Petugas" : "Tamu"}</strong>
              <p>{isStaff ? "Administrator" : "Hanya lihat"}</p>
            </div>
            {isStaff ? (
              <button
                type="button"
                className="auth-button"
                onClick={logoutStaff}
              >
                Keluar
              </button>
            ) : (
              <button
                type="button"
                className="auth-button"
                onClick={() => setShowLogin(true)}
              >
                Masuk Petugas
              </button>
            )}
          </div>
        </header>

        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Tutup notifikasi"
            >
              ×
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <>
            <section className="welcome-panel">
              <div className="welcome-content">
                <p className="welcome-label">SELAMAT DATANG</p>
                <h2>Kelola antrean lebih mudah.</h2>
                <p>
                  Pantau pendaftaran dan status pemeriksaan pasien
                  dalam satu dashboard.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setPage("register")}
                >
                  + Daftarkan Pasien
                </button>
              </div>

              <div className="welcome-art" aria-hidden="true">
                <div className="medical-cross">✚</div>
                <div className="art-circle art-circle-one" />
                <div className="art-circle art-circle-two" />
              </div>
            </section>

            <section className="stats-grid">
              <StatCard
                icon="☷"
                tone="cyan"
                label="Total Pasien"
                value={queues.length}
                description="Semua antrean terdaftar"
              />
              <StatCard
                icon="◷"
                tone="orange"
                label="Menunggu"
                value={waiting}
                description="Belum dipanggil"
              />
              <StatCard
                icon="♧"
                tone="blue"
                label="Diperiksa"
                value={examining}
                description="Pemeriksaan berlangsung"
              />
              <StatCard
                icon="✓"
                tone="green"
                label="Selesai"
                value={completed}
                description="Pemeriksaan selesai"
              />
            </section>

            {waiting > 0 && (
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Antrean Berikutnya</h2>
                    <p>Pasien yang masih menunggu di setiap poli.</p>
                  </div>
                  <span className="count-badge">{waiting} menunggu</span>
                </div>

                <div className="next-queue-grid">
                  {nextQueues.map((q) => (
                    <div className="next-queue-card" key={q.id}>
                      <div>
                        <span className="queue-number">{q.number}</span>
                        <h3>{q.name}</h3>
                        <p>{q.clinic}</p>
                      </div>
                      {isStaff && (
                        <button
                          type="button"
                          className="small-primary"
                          onClick={() => changeStatus(q.id, "Dipanggil")}
                        >
                          Panggil
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Antrean Terbaru</h2>
                  <p>Ringkasan pendaftaran pasien terbaru.</p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setPage("patients")}
                >
                  Lihat semua →
                </button>
              </div>

              {queues.length === 0 ? (
                <EmptyState
                  title="Belum ada antrean"
                  description="Daftarkan pasien untuk mulai menggunakan CareFlow."
                  action={
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setPage("register")}
                    >
                      Buat Antrean Pertama
                    </button>
                  }
                />
              ) : (
                <QueueTable
                  queues={[...queues].reverse().slice(0, 5)}
                  canManage={isStaff}
                  onStatusChange={changeStatus}
                  onDelete={removeQueue}
                />
              )}
            </section>
          </>
        )}

        {page === "register" && (
          <section className="panel form-panel">
            <form className="queue-form" onSubmit={registerPatient}>
              <label htmlFor="patient-name">Nama lengkap pasien</label>
              <input
                id="patient-name"
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />

              <label htmlFor="clinic">Pilih poli pemeriksaan</label>
              <select
                id="clinic"
                value={clinic}
                onChange={(event) => setClinic(event.target.value)}
              >
                {clinics.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <div className="form-info">
                <span>ⓘ</span>
                Nomor antrean dibuat otomatis sesuai poli.
              </div>

              <button className="primary-button full-button" type="submit">
                Buat Nomor Antrean →
              </button>
            </form>
          </section>
        )}

        {page === "ticket" && lastTicket && (
          <section className="panel ticket-panel">
            <TicketCard
              ticket={lastTicket}
              queues={queues}
              onNew={() => setPage("register")}
            />
          </section>
        )}

        {page === "patients" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Semua Antrean</h2>
                <p>Cari pasien dan kelola status pemeriksaannya.</p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => setPage("register")}
              >
                + Tambah Pasien
              </button>
            </div>

            <div className="table-toolbar">
              <input
                type="search"
                aria-label="Cari antrean"
                placeholder="Cari nama, nomor, atau poli..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                aria-label="Filter poli"
                value={clinicFilter}
                onChange={(event) => setClinicFilter(event.target.value)}
              >
                <option>Semua Poli</option>
                {clinics.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>Semua Status</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <span className="result-count">
                {filteredQueues.length} data
              </span>
            </div>

            {filteredQueues.length === 0 ? (
              <EmptyState
                title="Data tidak ditemukan"
                description="Coba kata kunci atau filter yang berbeda."
                action={
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setClinicFilter("Semua Poli");
                      setStatusFilter("Semua Status");
                    }}
                  >
                    Reset Filter
                  </button>
                }
              />
            ) : (
              <QueueTable
                queues={[...filteredQueues].reverse()}
                canManage={isStaff}
                onStatusChange={changeStatus}
                onDelete={removeQueue}
              />
            )}

            {queues.length > 0 && (
              <div className="table-footer">
                <span>{queues.length} antrean tersimpan</span>
                {isStaff && (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => setShowReset(true)}
                  >
                    Reset Semua Antrean
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {showReset && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <div className="modal-box">
              <h3 id="reset-title">Reset semua antrean?</h3>
              <p>
                Semua data antrean akan dihapus dan tidak bisa dikembalikan.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel"
                  onClick={() => setShowReset(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={resetQueues}
                >
                  Ya, reset
                </button>
              </div>
            </div>
          </div>
        )}

        {showLogin && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <form className="modal-box" onSubmit={loginStaff}>
              <h3 id="login-title">Masuk sebagai petugas</h3>
              <p>Masukkan sandi petugas untuk mengelola antrean.</p>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  className="modal-input"
                  placeholder="Sandi"
                  aria-label="Sandi petugas"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value);
                    setPinError("");
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className={`toggle-password ${showPassword ? "is-on" : ""}`}
                  aria-label={
                    showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"
                  }
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {pinError && <p className="modal-error">{pinError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel"
                  onClick={() => {
                    setShowLogin(false);
                    setPin("");
                    setPinError("");
                  }}
                >
                  Batal
                </button>
                <button type="submit" className="primary-button">
                  Masuk
                </button>
              </div>
            </form>
          </div>
        )}

        <footer className="main-footer">
          <span>CareFlow — Sistem Antrean Digital</span>
          <span>Prototype untuk demonstrasi</span>
        </footer>
      </main>
    </div>
  );
}

function EyeIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.1-5M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2" />
          <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
          <path d="M2 2l20 20" />
        </>
      )}
    </svg>
  );
}

function DisplayScreen({ calling, queues }) {
  const [soundOn, setSoundOn] = useState(false);
  const lastSpoken = useRef(calling ? calling.at : null);

  useEffect(() => {
    if (!soundOn || !calling) return;
    if (lastSpoken.current === calling.at) return;

    lastSpoken.current = calling.at;
    speakCall(calling);
  }, [calling, soundOn]);

  const current = calling
    ? queues.find((q) => q.id === calling.id)
    : null;
  const active = calling && current && current.status === "Dipanggil";
  const waitingList = queues.filter((q) => q.status === "Menunggu").slice(0, 6);

  return (
    <div className="display-screen">
      <div className={`display-main ${active ? "" : "display-idle"}`}>
        <div className="display-brand">
          CareFlow
          <small>Layar Panggilan Antrean</small>
        </div>

        <p className="display-label">
          {active ? "SEDANG DIPANGGIL" : "MENUNGGU PANGGILAN"}
        </p>
        <div className="display-number" key={active ? calling.at : "idle"}>
          {active ? calling.number : "—"}
        </div>
        <h2 className="display-name">
          {active ? calling.name : "Belum ada pasien dipanggil"}
        </h2>
        {active && (
          <p className="display-clinic">Silakan menuju {calling.clinic}</p>
        )}
      </div>

      <div className="display-side">
        <h2>Antrean Berikutnya</h2>
        <p>Pasien yang masih menunggu.</p>

        <div className="display-list">
          {waitingList.length === 0 ? (
            <span className="display-hint">Tidak ada antrean menunggu.</span>
          ) : (
            waitingList.map((q) => (
              <div className="display-item" key={q.id}>
                <b>{q.number}</b>
                <div>{q.name}</div>
                <span>{q.clinic}</span>
              </div>
            ))
          )}
        </div>

        {soundOn && (
          <div className="display-controls">
            <button
              type="button"
              className="display-button"
              onClick={() => calling && speakCall(calling)}
            >
              Ulangi panggilan
            </button>
            <button
              type="button"
              className="display-button display-ghost"
              onClick={() => {
                window.speechSynthesis?.cancel();
                setSoundOn(false);
              }}
            >
              Matikan suara
            </button>
          </div>
        )}
      </div>

      {!soundOn && (
        <button
          type="button"
          className="display-enable"
          onClick={() => setSoundOn(true)}
        >
          🔊 Klik untuk mengaktifkan suara panggilan
        </button>
      )}
    </div>
  );
}

function TicketCard({ ticket, queues, onNew }) {
  const current = queues.find((q) => q.id === ticket.id) || ticket;
  const index = queues.findIndex((q) => q.id === ticket.id);
  const ahead = queues.filter(
    (q, i) =>
      q.clinic === ticket.clinic && q.status === "Menunggu" && i < index
  ).length;

  let info = `Status: ${current.status}`;

  if (current.status === "Menunggu") {
    info =
      ahead === 0
        ? "Anda adalah antrean berikutnya."
        : `${ahead} pasien di depan Anda.`;
  } else if (current.status === "Dipanggil") {
    info = `Anda dipanggil. Silakan menuju ${current.clinic}.`;
  }

  return (
    <div className="ticket">
      <p className="ticket-label">NOMOR ANTREAN ANDA</p>
      <div className="ticket-number">{current.number}</div>
      <h2 className="ticket-name">{current.name}</h2>
      <p className="ticket-clinic">{current.clinic}</p>

      <div className="ticket-meta">
        <div>
          <span>Waktu daftar</span>
          <strong>{current.time}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{current.status}</strong>
        </div>
      </div>

      <div className="form-info">
        <span>ⓘ</span>
        {info} Simpan atau screenshot tiket ini, lalu tunggu nomor Anda
        dipanggil di layar.
      </div>

      <button
        type="button"
        className="primary-button full-button"
        onClick={onNew}
      >
        Daftarkan pasien lain
      </button>
    </div>
  );
}

function StatCard({ icon, tone, label, value, description }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <p>{label}</p>
      <h2>{value}</h2>
      <span>{description}</span>
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">☷</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function QueueTable({ queues, canManage, onStatusChange, onDelete }) {
  return (
    <div className="table-wrapper">
      <table className="queue-table">
        <thead>
          <tr>
            <th>No. Antrean</th>
            <th>Nama Pasien</th>
            <th>Poli</th>
            <th>Waktu</th>
            <th>Status</th>
            {canManage && <th>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {queues.map((q) => (
            <tr key={q.id}>
              <td>
                <span className="queue-number">{q.number}</span>
              </td>
              <td className="patient-cell">{q.name}</td>
              <td>{q.clinic}</td>
              <td>{q.time}</td>
              <td>
                <span
                  className={`status-badge status-${q.status
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {q.status}
                </span>
              </td>
              {canManage && (
              <td>
                <div className="action-buttons">
                  {(queueActions[q.status] || []).map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className={`action-btn ${action.variant}`}
                      onClick={() => onStatusChange(q.id, action.status)}
                    >
                      {action.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="delete-button"
                    aria-label={`Hapus antrean ${q.number}`}
                    title={`Hapus antrean ${q.number}`}
                    onClick={() => {
                      if (window.confirm(`Hapus antrean ${q.number}?`)) {
                        onDelete(q.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
