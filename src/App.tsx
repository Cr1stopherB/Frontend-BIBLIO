import { useAuth } from "react-oidc-context";
import { useState, useEffect, useCallback } from "react";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  availableCopies: number;
}

const API_URL =
  (import.meta.env.VITE_API_URL as string) ??
  "https://7vndo5ubd6.execute-api.us-east-1.amazonaws.com";

function App() {
  const auth = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Control de vistas (Catálogo / Agregar)
  const [activeTab, setActiveTab] = useState<"catalogo" | "agregar">("catalogo");

  // Estado del formulario de agregar libro
  const [newBook, setNewBook] = useState({
    titulo: "",
    autor: "",
    categoria: "",
    copias: 1,
  });

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  const authHeaders = useCallback((): Record<string, string> => {
    const token = auth.user?.id_token || auth.user?.access_token;
    return {
      "Content-Type": "application/json",
      "x-api-secret": "HolaMundo123",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [auth.user]);

  const notify = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch(`${API_URL}/api/books`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rawData = await res.json();

      const mappedBooks: Book[] = rawData.map((item: any, index: number) => {
        const b = item.book || item.libro || item;
        return {
          id: String(b.id || b._id || b.id_libro || index + 1),
          title: b.titulo || b.title || b.nombre || "Sin título registrado",
          author: b.autor || b.author || b.writer || "Autor desconocido",
          isbn: b.isbn || b.ISBN || b.categoria || "N/A",
          availableCopies: Number(
            b.copias ?? b.availableCopies ?? b.available_copies ?? b.stock ?? 0
          ),
        };
      });

      setBooks(mappedBooks);
    } catch (e: any) {
      notify(`Error al cargar libros: ${e.message}`, false);
    } finally {
      setLoadingBooks(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (auth.isAuthenticated) fetchBooks();
  }, [auth.isAuthenticated, fetchBooks]);

  // ──────────────────────────────────────────────
  // Agregar Libro (POST /api/books)
  // ──────────────────────────────────────────────
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.titulo || !newBook.autor) {
      notify("Por favor completa al menos el título y el autor.", false);
      return;
    }

    setLoadingAdd(true);
    try {
      const res = await fetch(`${API_URL}/api/books`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          titulo: newBook.titulo,
          autor: newBook.autor,
          categoria: newBook.categoria || "General",
          copias: Number(newBook.copias) || 1,
        }),
      });

      if (res.ok || res.status === 201) {
        notify("¡Libro agregado exitosamente a la base de datos!", true);
        setNewBook({ titulo: "", autor: "", categoria: "", copias: 1 });
        setActiveTab("catalogo");
        fetchBooks();
      } else {
        const errJson = await res.json().catch(() => ({}));
        notify(`Error al agregar libro: HTTP ${res.status} (${errJson.message || 'Error'})`, false);
      }
    } catch (e: any) {
      notify(`Error de red al agregar libro: ${e.message}`, false);
    } finally {
      setLoadingAdd(false);
    }
  };

  const deleteBook = async (id: string | number) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/books/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 204 || res.ok) {
        notify("Libro eliminado.", true);
        fetchBooks();
      } else {
        notify(`Error al eliminar: HTTP ${res.status}`, false);
      }
    } catch (e: any) {
      notify(`Error de red: ${e.message}`, false);
    }
  };

  const probarHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      if (res.ok) {
        notify("Health Check Exitoso (HTTP 200). Conexión correcta con API Gateway.", true);
      } else {
        notify(`Health Check falló: HTTP ${res.status}`, false);
      }
    } catch (e: any) {
      notify(`Error de conexión en Health Check: ${e.message}`, false);
    }
  };

  const generarInforme = async () => {
    setLoadingReport(true);
    try {
      const healthRes = await fetch(`${API_URL}/api/health`);
      if (!healthRes.ok) {
        throw new Error(`Health Check falló con HTTP ${healthRes.status}`);
      }

      const userEmail =
        auth.user?.profile?.email ||
        auth.user?.profile?.["preferred_username"] ||
        "admin@biblionexus.com";

      const userId = auth.user?.profile?.sub || "usr-001";

      const reportRes = await fetch(`${API_URL}/api/reports`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          type: "informe",
          username: userEmail,
          userId: userId,
        }),
      });

      if (reportRes.ok) {
        notify("Informe solicitado exitosamente. Iniciando flujo SNS - SQS - Lambda.", true);
      } else {
        const errJson = await reportRes.json().catch(() => ({}));
        notify(`Error al solicitar informe: HTTP ${reportRes.status} (${errJson.error || errJson.message || 'Error'})`, false);
      }
    } catch (e: any) {
      notify(`Error en el proceso: ${e.message}`, false);
    } finally {
      setLoadingReport(false);
    }
  };

  // ──────────────────────────────────────────────
  // Vistas de Sesión
  // ──────────────────────────────────────────────
  if (auth.isLoading) {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <div style={s.spinner} />
          <p style={{ margin: 0, color: "#94a3b8" }}>Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <h3 style={{ color: "#f87171", margin: "0 0 8px" }}>Error de autenticación</h3>
          <p style={{ color: "#94a3b8", margin: "0 0 16px" }}>{auth.error.message}</p>
          <button onClick={() => auth.signinRedirect()} style={s.btnPrimary}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    const groups = (auth.user?.profile["cognito:groups"] as string[]) ?? [];
    const email = auth.user?.profile.email as string;
    const isAdmin = groups.includes("Admin");
    const isColaborador = groups.includes("Colaborador");
    const canCreate = isAdmin || isColaborador;
    const canModify = isAdmin;

    const roleLabel = isAdmin
      ? "Administrador"
      : isColaborador
        ? "Colaborador"
        : "Cliente";

    return (
      <div style={s.shell}>
        {/* Sidebar */}
        <aside style={s.sidebar}>
          <div style={s.brand}>
            <div style={s.brandMark}>B</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>BiblioNexus</div>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>
                BIBLIOTECA DIGITAL
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, marginTop: 20 }}>
            <div
              onClick={() => setActiveTab("catalogo")}
              style={activeTab === "catalogo" ? s.navActive : s.navItem}
            >
              Catálogo
            </div>
            {canCreate && (
              <div
                onClick={() => setActiveTab("agregar")}
                style={activeTab === "agregar" ? s.navActive : s.navItem}
              >
                Agregar libro
              </div>
            )}
          </nav>

          <div style={s.sidebarFooter}>
            <div style={s.avatar}>{email?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.sidebarEmail}>{email}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{roleLabel}</div>
            </div>
            <button
              onClick={() => auth.removeUser()}
              style={s.iconBtn}
              title="Cerrar sesión"
            >
              X
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={s.main}>
          <header style={s.topbar}>
            <div>
              <h1 style={s.pageTitle}>
                {activeTab === "catalogo" ? "Catálogo de Libros" : "Nuevo Libro"}
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                {isAdmin
                  ? "Acceso total: puede ver, agregar, editar y eliminar libros."
                  : isColaborador
                    ? "Puede ver y agregar libros."
                    : "Solo lectura. Consulta el catálogo disponible."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={s.roleBadge}>{roleLabel}</span>

              <button onClick={probarHealth} style={s.btnHealth}>
                Probar Health
              </button>

              <button
                onClick={generarInforme}
                style={s.btnReport}
                disabled={loadingReport}
              >
                {loadingReport ? "Generando..." : "Generar Informe"}
              </button>

              <button onClick={fetchBooks} style={s.btnOutline} disabled={loadingBooks}>
                {loadingBooks ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </header>

          {/* Notificación */}
          {actionMsg && (
            <div style={{ ...s.alert, ...(actionMsg.ok ? s.alertOk : s.alertErr) }}>
              {actionMsg.text}
            </div>
          )}

          {/* Tab 1: Tabla de Libros */}
          {activeTab === "catalogo" && (
            <section style={s.card}>
              {loadingBooks && books.length === 0 ? (
                <p style={{ color: "#64748b", textAlign: "center", padding: 32 }}>
                  Cargando libros...
                </p>
              ) : books.length === 0 ? (
                <p style={{ color: "#64748b", textAlign: "center", padding: 32 }}>
                  No hay libros disponibles.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Título</th>
                        <th style={s.th}>Autor</th>
                        <th style={s.th}>Categoría / ISBN</th>
                        <th style={s.th}>Copias</th>
                        {canModify && <th style={s.th}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {books.map((book, i) => (
                        <tr key={book.id || i} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                          <td style={s.td}>{book.title}</td>
                          <td style={s.td}>{book.author}</td>
                          <td style={{ ...s.td, ...s.tdMono }}>{book.isbn}</td>
                          <td style={{ ...s.td, textAlign: "center" }}>
                            <span
                              style={{
                                ...s.copiesBadge,
                                ...(book.availableCopies === 0 ? s.copiesZero : {}),
                              }}
                            >
                              {book.availableCopies}
                            </span>
                          </td>
                          {canModify && (
                            <td style={s.td}>
                              <button
                                onClick={() => deleteBook(book.id)}
                                style={s.btnDanger}
                              >
                                Eliminar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Tab 2: Formulario Agregar Libro */}
          {activeTab === "agregar" && canCreate && (
            <section style={{ ...s.card, maxWidth: 600 }}>
              <h2 style={{ fontSize: 18, margin: "0 0 16px", color: "#f8fafc" }}>
                Registrar un Nuevo Libro
              </h2>
              <form onSubmit={handleAddBook} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={s.label}>Título</label>
                  <input
                    type="text"
                    placeholder="Ej: Cien Años de Soledad"
                    value={newBook.titulo}
                    onChange={(e) => setNewBook({ ...newBook, titulo: e.target.value })}
                    style={s.input}
                    required
                  />
                </div>

                <div>
                  <label style={s.label}>Autor</label>
                  <input
                    type="text"
                    placeholder="Ej: Gabriel García Márquez"
                    value={newBook.autor}
                    onChange={(e) => setNewBook({ ...newBook, autor: e.target.value })}
                    style={s.input}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Categoría / ISBN</label>
                    <input
                      type="text"
                      placeholder="Ej: Novela"
                      value={newBook.categoria}
                      onChange={(e) => setNewBook({ ...newBook, categoria: e.target.value })}
                      style={s.input}
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={s.label}>Copias</label>
                    <input
                      type="number"
                      min="1"
                      value={newBook.copias}
                      onChange={(e) => setNewBook({ ...newBook, copias: Number(e.target.value) })}
                      style={s.input}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="submit" style={s.btnPrimary} disabled={loadingAdd}>
                    {loadingAdd ? "Guardando..." : "Guardar Libro"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("catalogo")}
                    style={s.btnOutline}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Panel Admin */}
          {isAdmin && (
            <section style={{ ...s.card, ...s.adminCard }}>
              <h3 style={{ color: "#fca5a5", margin: "0 0 8px", fontSize: 15 }}>
                Panel Administrador
              </h3>
              <p style={{ fontSize: 13, color: "#fecaca", margin: 0 }}>
                Solo los miembros del grupo Admin en Cognito ven esta sección. Desde aquí puede gestionar usuarios y configurar el sistema.
              </p>
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div style={s.center}>
      <div style={s.card}>
        <div style={s.brandMark}>B</div>
        <h2 style={{ margin: "16px 0 6px", color: "#f1f5f9", fontSize: 22 }}>
          BiblioNexus
        </h2>
        <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14 }}>
          Sistema de gestión de biblioteca. Accede con tu cuenta de AWS Cognito.
        </p>
        <button onClick={() => auth.signinRedirect()} style={s.btnPrimary}>
          Iniciar sesión
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Estilos
// ──────────────────────────────────────────────
const s: { [k: string]: React.CSSProperties } = {
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e2e8f0",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e2e8f0",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: "#0f172a",
    borderRight: "1px solid rgba(148,163,184,.1)",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingBottom: 20,
    borderBottom: "1px solid rgba(148,163,184,.1)",
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },
  navItem: {
    padding: "10px 12px",
    borderRadius: 8,
    color: "#64748b",
    fontSize: 14,
    marginBottom: 4,
    cursor: "pointer",
    transition: "0.2s",
  },
  navActive: {
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    background: "rgba(99,102,241,.18)",
    border: "1px solid rgba(99,102,241,.35)",
    marginBottom: 4,
    cursor: "pointer",
  },
  sidebarFooter: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
    borderTop: "1px solid rgba(148,163,184,.1)",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
    fontSize: 14,
  },
  sidebarEmail: {
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  iconBtn: {
    background: "rgba(148,163,184,.1)",
    border: "1px solid rgba(148,163,184,.15)",
    color: "#94a3b8",
    width: 30,
    height: 30,
    borderRadius: 7,
    cursor: "pointer",
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
  },
  main: {
    flex: 1,
    padding: "32px 36px",
    maxWidth: 1100,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  pageTitle: { margin: 0, fontSize: 24, fontWeight: 700, color: "#f8fafc" },
  card: {
    background: "rgba(17,24,39,.85)",
    border: "1px solid rgba(148,163,184,.12)",
    borderRadius: 14,
    padding: 24,
    marginBottom: 20,
  },
  adminCard: {
    background: "linear-gradient(135deg,rgba(239,68,68,.08),rgba(139,92,246,.08))",
    border: "1px solid rgba(239,68,68,.3)",
  },
  spinner: {
    width: 22,
    height: 22,
    border: "3px solid #334155",
    borderTopColor: "#6366f1",
    borderRadius: "50%",
    marginBottom: 14,
  },
  roleBadge: {
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(99,102,241,.18)",
    border: "1px solid rgba(99,102,241,.4)",
    color: "#c7d2fe",
  },
  copiesBadge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(34,197,94,.12)",
    border: "1px solid rgba(34,197,94,.3)",
    color: "#4ade80",
  },
  copiesZero: {
    background: "rgba(239,68,68,.1)",
    border: "1px solid rgba(239,68,68,.3)",
    color: "#f87171",
  },
  alert: {
    padding: "12px 16px",
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: 500,
  },
  alertOk: {
    background: "rgba(34,197,94,.1)",
    border: "1px solid rgba(34,197,94,.3)",
    color: "#4ade80",
  },
  alertErr: {
    background: "rgba(239,68,68,.1)",
    border: "1px solid rgba(239,68,68,.3)",
    color: "#f87171",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148,163,184,.12)",
  },
  td: {
    padding: "12px 14px",
    color: "#e2e8f0",
    verticalAlign: "middle",
  },
  tdMono: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#94a3b8",
  },
  trEven: { background: "transparent" },
  trOdd: { background: "rgba(148,163,184,.03)" },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,.2)",
    background: "#0f172a",
    color: "#f8fafc",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    width: "100%",
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnOutline: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#94a3b8",
    background: "transparent",
    border: "1px solid rgba(148,163,184,.25)",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnHealth: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#38bdf8",
    background: "transparent",
    border: "1px solid rgba(56,189,248,.4)",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnReport: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: "rgba(239,68,68,.1)",
    border: "1px solid rgba(239,68,68,.35)",
    color: "#f87171",
    borderRadius: 7,
  },
};

export default App;