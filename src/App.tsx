import { useAuth } from "react-oidc-context";
import { useState } from "react";

function App() {
  const auth = useAuth();
  const [apiResponse, setApiResponse] = useState<string>("");
  const [loadingApi, setLoadingApi] = useState<boolean>(false);

  // 1. Estados de carga y error del flujo de Cognito
  if (auth.isLoading) {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <div style={s.spinner}></div>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>Cargando sesión...</h3>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <h3 style={{ color: "#f87171" }}>Error al autenticar</h3>
          <p style={{ color: "#94a3b8" }}>{auth.error.message}</p>
          <button onClick={() => auth.signinRedirect()} style={s.btn}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // 2. Vista si el usuario ya inició sesión
  if (auth.isAuthenticated) {
    const roles = (auth.user?.profile["cognito:groups"] as string[]) || [];
    const email = auth.user?.profile.email;
    const isAdmin = roles.includes("Admin");

    const consultarBackend = async (endpoint: string, metodo: string = "GET") => {
      setLoadingApi(true);
      setApiResponse("");

      try {
        const token = auth.user?.id_token;
        if (!token) {
          setApiResponse("Error: No hay un token de sesión activo.");
          setLoadingApi(false);
          return;
        }

        const apiGatewayUrl =
          "https://yxpnxitdnh.execute-api.us-east-2.amazonaws.com";

        const response = await fetch(`${apiGatewayUrl}${endpoint}`, {
          method: metodo,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        setApiResponse(JSON.stringify(data, null, 2));
      } catch (error: any) {
        setApiResponse(`Error de red o conexión: ${error.message}`);
      } finally {
        setLoadingApi(false);
      }
    };

    return (
      <div style={s.shell}>
        {/* Sidebar */}
        <aside style={s.sidebar}>
          <div style={s.brand}>
            <div style={s.brandMark}>N</div>
            <div>
              <div style={{ fontWeight: 700 }}>Nexus</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>CONTROL DE ACCESO</div>
            </div>
          </div>

          <nav style={{ flex: 1, marginTop: 16 }}>
            <div style={s.navActive}>📊 Dashboard</div>
            <div style={s.navItem}>📦 Productos</div>
            <div style={s.navItem}>👥 Usuarios</div>
            {isAdmin && <div style={s.navItem}>⚙️ Configuración</div>}
          </nav>

          <div style={s.sidebarFooter}>
            <div style={s.avatar}>{email?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.sidebarEmail}>{email}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {roles.join(", ") || "Sin rol"}
              </div>
            </div>
            <button onClick={() => auth.removeUser()} style={s.iconBtn} title="Cerrar Sesión">
              ⏻
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={s.main}>
          <header style={s.topbar}>
            <div>
              <h1 style={s.pageTitle}>Panel de Control</h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>
                Bienvenido, {email?.split("@")[0]}
              </p>
            </div>
            <div style={s.statusPill}>
              <span style={s.statusDot}></span> Sesión activa
            </div>
          </header>

          <section style={s.card}>
            <h3 style={s.cardTitle}>👤 Perfil del Usuario</h3>
            <div style={s.row}>
              <span style={s.rowLabel}>📧 Email</span>
              <span style={s.rowValue}>{email}</span>
            </div>
            <div style={s.row}>
              <span style={s.rowLabel}>🔑 Roles</span>
              <div>
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <span key={r} style={s.badge}>{r}</span>
                  ))
                ) : (
                  <span style={s.noneBadge}>Ninguno</span>
                )}
              </div>
            </div>
          </section>

          {/* Vista condicional por rol */}
          {isAdmin && (
            <section style={{ ...s.card, ...s.adminCard }}>
              <h4 style={{ color: "#fca5a5", margin: 0 }}>
                ⚙️ Panel Exclusivo Admin
              </h4>
              <p style={{ fontSize: 13, color: "#fecaca", margin: "8px 0 0" }}>
                Solo miembros del grupo <strong>Admin</strong> en Cognito ven esta sección.
              </p>
            </section>
          )}

          <section style={s.card}>
            <h3 style={s.cardTitle}>
              🌐 Interactuar con Backend · API Gateway
            </h3>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px" }}>
              Endpoints protegidos con <code style={s.inlineCode}>@SecuredRoles</code>:
            </p>

            <div style={s.btnGroup}>
              <button onClick={() => consultarBackend("/health", "GET")} style={s.btnSuccess}>
                🟢 Ver Estado del Backend
              </button>
              <button onClick={() => consultarBackend("/api/productos", "POST")} style={s.btnPrimary}>
                ➕ Crear Producto
              </button>
              <button onClick={() => consultarBackend("/api/productos/1", "DELETE")} style={s.btnDanger}>
                🗑️ Eliminar Producto
              </button>
            </div>

            <div style={s.terminal}>
              <div style={s.termBar}>
                <span style={{ ...s.dot, background: "#ef4444" }}></span>
                <span style={{ ...s.dot, background: "#f59e0b" }}></span>
                <span style={{ ...s.dot, background: "#22c55e" }}></span>
                <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>response.log</span>
                {loadingApi && <span style={{ marginLeft: "auto", fontSize: 11, color: "#38bdf8" }}>● ejecutando…</span>}
              </div>
              <pre style={s.termBody}>
                {loadingApi
                  ? "Consultando pasarela de AWS..."
                  : apiResponse || "// Ninguna petición enviada aún."}
              </pre>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // 3. Vista inicial si el usuario no está logueado
  return (
    <div style={s.center}>
      <div style={s.card}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
        <h2 style={{ margin: "0 0 8px", color: "#f1f5f9" }}>Bienvenido a Nexus</h2>
        <p style={{ color: "#94a3b8", marginBottom: 24 }}>
          Accede con tu cuenta gestionada por AWS Cognito.
        </p>
        <button onClick={() => auth.signinRedirect()} style={s.btn}>
          Ingresar con Cognito →
        </button>
      </div>
    </div>
  );
}

// 🎨 Estilos — tema oscuro con sidebar
const s: { [k: string]: React.CSSProperties } = {
  center: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0b1120", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" },
  card: { background: "rgba(17,24,39,.85)", border: "1px solid rgba(148,163,184,.15)", borderRadius: 16, padding: 24, marginBottom: 20 },
  spinner: { width: 20, height: 20, border: "3px solid #334155", borderTopColor: "#6366f1", borderRadius: "50%", marginBottom: 12 },
  btn: { width: "100%", padding: "13px 20px", fontSize: 15, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, cursor: "pointer" },
  shell: { display: "flex", minHeight: "100vh", background: "#0b1120", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" },
  sidebar: { width: 260, flexShrink: 0, background: "#0f172a", borderRight: "1px solid rgba(148,163,184,.1)", display: "flex", flexDirection: "column", padding: 24 },
  brand: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 20, borderBottom: "1px solid rgba(148,163,184,.1)" },
  brandMark: { width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff" },
  navItem: { padding: "11px 14px", borderRadius: 10, color: "#94a3b8", fontSize: 14, marginBottom: 4, cursor: "pointer" },
  navActive: { padding: "11px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff", background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.4)", marginBottom: 4 },
  sidebarFooter: { display: "flex", alignItems: "center", gap: 10, paddingTop: 16, borderTop: "1px solid rgba(148,163,184,.1)" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", flexShrink: 0 },
  sidebarEmail: { fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  iconBtn: { background: "rgba(148,163,184,.1)", border: "1px solid rgba(148,163,184,.2)", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", flexShrink: 0 },
  main: { flex: 1, padding: "32px 40px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 16 },
  pageTitle: { margin: 0, fontSize: 26, fontWeight: 700, color: "#f8fafc" },
  statusPill: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.3)", color: "#4ade80", fontSize: 12, fontWeight: 600 },
  statusDot: { width: 8, height: 8, borderRadius: "50%", background: "#22c55e" },
  cardTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(148,163,184,.08)", fontSize: 13 },
  rowLabel: { color: "#64748b" },
  rowValue: { color: "#e2e8f0", fontWeight: 600 },
  badge: { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.4)", color: "#c7d2fe", marginLeft: 6 },
  noneBadge: { color: "#64748b", fontStyle: "italic", fontSize: 12 },
  adminCard: { background: "linear-gradient(135deg,rgba(239,68,68,.12),rgba(139,92,246,.12))", border: "1px solid rgba(239,68,68,.35)" },
  inlineCode: { background: "rgba(99,102,241,.15)", color: "#c7d2fe", padding: "2px 7px", borderRadius: 5, fontSize: 12 },
  btnGroup: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 },
  btnSuccess: { padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.4)", color: "#4ade80" },
  btnPrimary: { padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.4)", color: "#c7d2fe" },
  btnDanger: { padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.4)", color: "#fca5a5" },
  terminal: { borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,.15)", background: "#020617" },
  termBar: { display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#0f172a", borderBottom: "1px solid rgba(148,163,184,.1)" },
  dot: { width: 10, height: 10, borderRadius: "50%", display: "inline-block" },
  termBody: { margin: 0, padding: 16, color: "#4ade80", fontSize: 13, fontFamily: "monospace", overflowX: "auto", minHeight: 60, maxHeight: 260 },
};

export default App;