import { useAuth } from "react-oidc-context";
import { useState, useEffect, useCallback } from "react";

interface Book {
  id?: string;
  title: string;
  author: string;
  isbn: string;
  availableCopies: number;
}

interface Review {
  id?: string;
  bookId: string;
  userEmail: string;
  rating: number;
  comment: string;
}

const API_URL =
  (import.meta.env.VITE_API_URL as string) ??
  "https://jsmyy5o0id.execute-api.us-east-1.amazonaws.com";

function App() {
  const auth = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Estados de navegación y libro seleccionado
  const [activeTab, setActiveTab] = useState<"catalog" | "addBook">("catalog");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Estado del formulario para crear libro
  const [newBook, setNewBook] = useState<Book>({
    title: "",
    author: "",
    isbn: "",
    availableCopies: 1,
  });

  // Estado del servicio de reseñas
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // ──────────────────────────────────────────────
  // Logout
  // ──────────────────────────────────────────────
  const handleLogout = () => {
    auth.removeUser();
    const cognitoDomain = "us-east-1izeh6x7sm.auth.us-east-1.amazoncognito.com";
    const clientId = "4pfpui5gm8026lfqdtpcdmth6r";
    const logoutUri = "http://localhost:5173";

    window.location.href = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  const authHeaders = useCallback((): Record<string, string> => {
    const token = auth.user?.id_token;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [auth.user]);

  const notify = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 3500);
  };

  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch(`${API_URL}/api/books`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      notify(`Error al cargar libros: ${e.message}`, false);
    } finally {
      setLoadingBooks(false);
    }
  }, [authHeaders]);

  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch(`${API_URL}/api/health`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      notify(`Estado Backend: ${text || "En línea (200 OK)"}`, true);
    } catch (e: any) {
      notify(`Salud Backend: ${e.message}`, false);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (auth.isAuthenticated) fetchBooks();
  }, [auth.isAuthenticated, fetchBooks]);

  // ──────────────────────────────────────────────
  // CRUD Libros
  // ──────────────────────────────────────────────
  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/books`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newBook),
      });

      if (res.ok || res.status === 201) {
        notify("Libro creado con éxito.", true);
        setNewBook({ title: "", author: "", isbn: "", availableCopies: 1 });
        setActiveTab("catalog");
        fetchBooks();
      } else {
        notify(`Error al crear libro: HTTP ${res.status}`, false);
      }
    } catch (e: any) {
      notify(`Error de red: ${e.message}`, false);
    }
  };

  const deleteBook = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/books/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 204 || res.ok) {
        notify("Libro eliminado con éxito.", true);
        if (selectedBook?.id === id) setSelectedBook(null);
        fetchBooks();
      } else {
        notify(`Error al eliminar: HTTP ${res.status}`, false);
      }
    } catch (e: any) {
      notify(`Error de red: ${e.message}`, false);
    }
  };

  // ──────────────────────────────────────────────
  // Reseñas (Rutas Anidadas /api/books/{id}/reviews)
  // ──────────────────────────────────────────────
  const fetchReviews = async (bookId: string) => {
  try {
    const res = await fetch(`${API_URL}/api/reviews/book/${bookId}`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : []);
    } else {
      setReviews([]);
    }
  } catch (e: any) {
    console.error("Error al obtener reseñas:", e);
    setReviews([]);
  }
};



  const handleSelectBookForReviews = (book: Book) => {
    setSelectedBook(book);
    if (book.id) {
      fetchReviews(book.id);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook?.id || !newComment.trim() || submittingReview) return;

    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_URL}/api/books/${selectedBook.id}/reviews`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          bookId: selectedBook.id,
          userEmail: (auth.user?.profile?.email as string) || "Anónimo",
          rating: newRating,
          comment: newComment,
        }),
      });

      if (res.ok || res.status === 201) {
        notify("Reseña agregada correctamente.", true);
        setNewComment("");
        await fetchReviews(selectedBook.id);
      } else {
        const errText = await res.text().catch(() => "");
        notify(`Error al publicar reseña (${res.status}): ${errText || "No encontrado"}`, false);
      }
    } catch (e: any) {
      notify(`Error al enviar reseña: ${e.message}`, false);
    } finally {
      setSubmittingReview(false);
    }
  };

  // ──────────────────────────────────────────────
  // Vistas auxiliares (Carga y Error)
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

  // ──────────────────────────────────────────────
  // Vista Principal Autenticada
  // ──────────────────────────────────────────────
  if (auth.isAuthenticated) {
    const groups = (auth.user?.profile?.["cognito:groups"] as string[]) ?? [];
    const email = auth.user?.profile?.email as string;
    const isAdmin = groups.includes("Admin");
    const isColaborador = groups.includes("Colaborador");
    const canCreate = isAdmin || isColaborador;
    const canModify = isAdmin;

    const roleLabel = isAdmin ? "Administrador" : isColaborador ? "Colaborador" : "Cliente";

    return (
      <div style={s.shell}>
        {/* ── Sidebar ── */}
        <aside style={s.sidebar}>
          <div style={s.brand}>
            <div style={s.brandMark}>B</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Biblioteca 360</div>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>
                BIBLIOTECA DIGITAL
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, marginTop: 20 }}>
            <div
              style={activeTab === "catalog" ? s.navActive : s.navItem}
              onClick={() => setActiveTab("catalog")}
            >
              Catálogo
            </div>
            {canCreate && (
              <div
                style={activeTab === "addBook" ? s.navActive : s.navItem}
                onClick={() => setActiveTab("addBook")}
              >
                Agregar libro
              </div>
            )}
            {isAdmin && <div style={s.navItem}>Configuración</div>}
          </nav>

          <div style={s.sidebarFooter}>
            <div style={s.avatar}>{email?.[0]?.toUpperCase() || "U"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.sidebarEmail}>{email || "Usuario"}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{roleLabel}</div>
            </div>
            <button onClick={handleLogout} style={s.iconBtn} title="Cerrar sesión">
              X
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main style={s.main}>
          <header style={s.topbar}>
            <div>
              <h1 style={s.pageTitle}>
                {activeTab === "catalog" ? "Catálogo de Libros" : "Nuevo Libro"}
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                {isAdmin
                  ? "Acceso total: puede ver, agregar, editar y eliminar libros."
                  : isColaborador
                  ? "Puede ver y agregar libros."
                  : "Solo lectura. Consulta el catálogo disponible."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={s.roleBadge}>{roleLabel}</span>

              <button onClick={checkHealth} style={s.btnHealth} disabled={checkingHealth}>
                {checkingHealth ? "Verificando..." : "Estado Backend"}
              </button>

              <button onClick={fetchBooks} style={s.btnOutline} disabled={loadingBooks}>
                {loadingBooks ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </header>

          {/* Notificación de Sistema */}
          {actionMsg && (
            <div style={{ ...s.alert, ...(actionMsg.ok ? s.alertOk : s.alertErr) }}>
              {actionMsg.text}
            </div>
          )}

          {/* TAB 1: CATÁLOGO */}
          {activeTab === "catalog" && (
            <>
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
                          <th style={s.th}>ISBN</th>
                          <th style={s.th}>Copias</th>
                          <th style={s.th}>Acciones</th>
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
                            <td style={{ ...s.td, display: "flex", gap: 8 }}>
                              <button
                                onClick={() => handleSelectBookForReviews(book)}
                                style={s.btnSecondary}
                              >
                                Reseñas
                              </button>
                              {canModify && book.id && (
                                <button
                                  onClick={() => deleteBook(book.id!)}
                                  style={s.btnDanger}
                                >
                                  Eliminar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* SECCIÓN DE RESEÑAS */}
              {selectedBook && (
                <section style={s.card}>
                  <h3 style={{ margin: "0 0 16px", color: "#f8fafc" }}>
                    Opiniones de: <span style={{ color: "#818cf8" }}>{selectedBook.title}</span>
                  </h3>

                  <form onSubmit={handleCreateReview} style={s.reviewForm}>
                    <select
                      value={newRating}
                      onChange={(e) => setNewRating(Number(e.target.value))}
                      style={s.input}
                      disabled={submittingReview}
                    >
                      <option value={5}>5 ★★★★★</option>
                      <option value={4}>4 ★★★★☆</option>
                      <option value={3}>3 ★★★☆☆</option>
                      <option value={2}>2 ★★☆☆☆</option>
                      <option value={1}>1 ★☆☆☆☆</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Escribe una pequeña reseña sobre este libro..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      style={{ ...s.input, flex: 1 }}
                      disabled={submittingReview}
                      required
                    />
                    <button
                      type="submit"
                      style={s.btnPrimarySmall}
                      disabled={submittingReview}
                    >
                      {submittingReview ? "Enviando..." : "Enviar"}
                    </button>
                  </form>

                  <div style={{ marginTop: 16 }}>
                    {reviews.length === 0 ? (
                      <p style={{ color: "#64748b", fontSize: 13 }}>
                        No existen valoraciones registradas para este libro.
                      </p>
                    ) : (
                      reviews.map((rev, idx) => (
                        <div key={rev.id || idx} style={s.reviewBox}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                              {rev.userEmail || "Anónimo"}
                            </span>
                            <span style={{ fontSize: 12, color: "#fbbf24" }}>
                              {"★".repeat(rev.rating || 5)}
                            </span>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8" }}>
                            {rev.comment}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {/* TAB 2: AGREGAR LIBRO */}
          {activeTab === "addBook" && canCreate && (
            <section style={s.card}>
              <form onSubmit={handleCreateBook} style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={s.label}>Título del Libro</label>
                  <input
                    type="text"
                    style={{ ...s.input, width: "100%" }}
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={s.label}>Autor</label>
                  <input
                    type="text"
                    style={{ ...s.input, width: "100%" }}
                    value={newBook.author}
                    onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={s.label}>ISBN</label>
                  <input
                    type="text"
                    style={{ ...s.input, width: "100%" }}
                    value={newBook.isbn}
                    onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={s.label}>Copias Disponibles</label>
                  <input
                    type="number"
                    min="1"
                    style={{ ...s.input, width: "100%" }}
                    value={newBook.availableCopies}
                    onChange={(e) =>
                      setNewBook({ ...newBook, availableCopies: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <button type="submit" style={s.btnPrimary}>
                  Guardar Libro
                </button>
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
                Solo los miembros del grupo <strong>Admin</strong> en Cognito ven esta
                sección. Desde aquí puedes gestionar usuarios y configurar el sistema.
              </p>
            </section>
          )}
        </main>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Vista Login
  // ──────────────────────────────────────────────
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
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#fff",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  },
  reviewForm: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  reviewBox: {
    background: "rgba(15,23,42,.6)",
    border: "1px solid rgba(148,163,184,.1)",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  btnPrimary: {
    width: "100%",
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
  },
  btnPrimarySmall: {
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    background: "#6366f1",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: "rgba(99,102,241,.15)",
    border: "1px solid rgba(99,102,241,.3)",
    color: "#a5b4fc",
    borderRadius: 7,
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
    background: "rgba(56,189,248,.1)",
    border: "1px solid rgba(56,189,248,.3)",
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