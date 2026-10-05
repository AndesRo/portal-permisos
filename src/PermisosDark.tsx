import { Fragment, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

// Cambia el nombre que aparece en la cabecera
const EMPRESA = "andes.cl";

// Tecnologías que se muestran en la cabecera
const STACK = ["React", "TypeScript", "Vite", "Tailwind", "Supabase", "Power Automate"];

// .env: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type Estado = "pendiente" | "aprobado" | "rechazado";
type Filtro = "todas" | Estado;
type Vista = "nueva" | "historial";

interface Solicitud {
  id: string;
  empleado_nombre: string;
  empleado_email: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  estado: Estado;
  comentario_aprobador: string | null;
  creado_en: string;
}

const TIPOS: Record<string, string> = {
  vacaciones: "Vacaciones",
  administrativo: "Día administrativo",
  medico: "Médico",
  otro: "Otro",
};

const ESTADOS: Record<Estado, { etiqueta: string; pill: string; punto: string }> = {
  pendiente: {
    etiqueta: "Pendiente",
    pill: "bg-[#FBBF24]/10 text-[#FCD34D] ring-1 ring-[#FBBF24]/25",
    punto: "bg-[#FBBF24]",
  },
  aprobado: {
    etiqueta: "Aprobada",
    pill: "bg-[#34D399]/10 text-[#6EE7B7] ring-1 ring-[#34D399]/25",
    punto: "bg-[#34D399]",
  },
  rechazado: {
    etiqueta: "Rechazada",
    pill: "bg-[#FB7185]/10 text-[#FDA4AF] ring-1 ring-[#FB7185]/25",
    punto: "bg-[#FB7185]",
  },
};

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "aprobado", etiqueta: "Aprobadas" },
  { valor: "rechazado", etiqueta: "Rechazadas" },
];

const vacio = {
  empleado_nombre: "",
  empleado_email: "",
  tipo: "vacaciones",
  fecha_inicio: "",
  fecha_fin: "",
  motivo: "",
};

const CLAVE_CORREO = "permisos:correo";
const leerCorreo = () => {
  try {
    return localStorage.getItem(CLAVE_CORREO) ?? "";
  } catch {
    return "";
  }
};
const guardarCorreo = (valor: string) => {
  try {
    if (valor) localStorage.setItem(CLAVE_CORREO, valor);
    else localStorage.removeItem(CLAVE_CORREO);
  } catch {
    /* sin almacenamiento disponible */
  }
};

const fecha = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

const diasEntre = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000) + 1;

function hace(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (abs < 60) return "hace un momento";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/* Estilos compartidos */
const input =
  "mt-1 w-full rounded-lg border border-[#2E2250] bg-[#0F0A1C] px-3 py-2 text-sm text-[#EDE9FE] [color-scheme:dark] " +
  "placeholder:text-[#6F6590] outline-none transition focus:border-[#8B5CF6] focus:ring-4 focus:ring-[#8B5CF6]/20";
const label = "block text-[13px] font-semibold text-[#DDD6FE]";
const panel =
  "relative min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2A1F45] bg-[#140D24]/85 backdrop-blur-xl";
const lineaSuperior =
  "pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#A78BFA] to-transparent";

/* Recorrido de la solicitud: enviada, en revisión, resuelta */
function Recorrido({ estado }: { estado: Estado }) {
  const resuelta = estado !== "pendiente";
  const glow = "bg-[#8B5CF6] shadow-[0_0_10px_rgba(139,92,246,.85)]";
  const final =
    estado === "aprobado"
      ? "bg-[#34D399] shadow-[0_0_10px_rgba(52,211,153,.8)]"
      : estado === "rechazado"
      ? "bg-[#FB7185] shadow-[0_0_10px_rgba(251,113,133,.8)]"
      : "bg-[#2E2250]";
  const nodos = [
    { texto: "Enviada", clase: glow },
    {
      texto: "En revisión",
      clase: resuelta ? glow : "bg-[#FBBF24] shadow-[0_0_10px_rgba(251,191,36,.8)] motion-safe:animate-pulse",
    },
    {
      texto: resuelta ? (estado === "aprobado" ? "Aprobada" : "Rechazada") : "Respuesta",
      clase: final,
    },
  ];
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="flex items-center">
        {nodos.map((n, i) => (
          <Fragment key={n.texto}>
            {i > 0 && (
              <span className={`h-px flex-1 ${i === 1 || resuelta ? "bg-[#8B5CF6]/60" : "bg-[#2E2250]"}`} />
            )}
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${n.clase}`} />
          </Fragment>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-[11px] text-[#9C90BB]">
        <span className="text-left">{nodos[0].texto}</span>
        <span className="text-center">{nodos[1].texto}</span>
        <span className="text-right">{nodos[2].texto}</span>
      </div>
    </div>
  );
}

export default function PermisosDark() {
  const [form, setForm] = useState(vacio);
  const [vista, setVista] = useState<Vista>("nueva");
  const [lista, setLista] = useState<Solicitud[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [miCorreo, setMiCorreo] = useState(leerCorreo);
  const [consulta, setConsulta] = useState("");
  const [error, setError] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [destacados, setDestacados] = useState<string[]>([]);

  // Carga las solicitudes del correo indicado y escucha cambios en tiempo real
  useEffect(() => {
    if (!miCorreo) {
      setLista([]);
      return;
    }

    const destacar = (id: string) => {
      setDestacados((p) => [...p.filter((x) => x !== id), id]);
      window.setTimeout(() => setDestacados((p) => p.filter((x) => x !== id)), 2600);
    };

    supabase
      .from("solicitudes_permiso")
      .select("*")
      .eq("empleado_email", miCorreo)
      .order("creado_en", { ascending: false })
      .then(({ data }) => setLista((data as Solicitud[]) ?? []));

    const canal = supabase
      .channel("solicitudes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitudes_permiso" },
        (payload) => {
          const fila = payload.new as Solicitud;
          if (!fila?.empleado_email || fila.empleado_email.toLowerCase() !== miCorreo) return;
          if (payload.eventType === "INSERT") {
            setLista((prev) => [fila, ...prev.filter((s) => s.id !== fila.id)]);
          } else if (payload.eventType === "UPDATE") {
            setLista((prev) => prev.map((s) => (s.id === fila.id ? fila : s)));
            destacar(fila.id);
          }
        }
      )
      .subscribe((status) => setConectado(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(canal);
    };
  }, [miCorreo]);

  const conteo = useMemo(
    () => ({
      todas: lista.length,
      pendiente: lista.filter((s) => s.estado === "pendiente").length,
      aprobado: lista.filter((s) => s.estado === "aprobado").length,
      rechazado: lista.filter((s) => s.estado === "rechazado").length,
    }),
    [lista]
  );

  const visibles = filtro === "todas" ? lista : lista.filter((s) => s.estado === filtro);

  const diasForm =
    form.fecha_inicio && form.fecha_fin && form.fecha_fin >= form.fecha_inicio
      ? diasEntre(form.fecha_inicio, form.fecha_fin)
      : null;

  const cambiar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setCodigo("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCodigo("");
    if (form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de término no puede ser anterior a la de inicio.");
      return;
    }
    const correo = form.empleado_email.trim().toLowerCase();
    setEnviando(true);
    const { data, error } = await supabase
      .from("solicitudes_permiso")
      .insert({ ...form, empleado_nombre: form.empleado_nombre.trim(), empleado_email: correo })
      .select("id")
      .single();
    setEnviando(false);

    if (error) {
      setError(`No pudimos enviar la solicitud. ${error.message}`);
      return;
    }
    setForm(vacio);
    setCodigo(String(data?.id ?? "").slice(0, 6).toUpperCase());
    guardarCorreo(correo);
    setMiCorreo(correo);
    setFiltro("todas");
    setVista("historial");
  }

  function consultar(e: FormEvent) {
    e.preventDefault();
    const correo = consulta.trim().toLowerCase();
    if (!correo) return;
    guardarCorreo(correo);
    setMiCorreo(correo);
    setConsulta("");
  }

  function cambiarCorreo() {
    guardarCorreo("");
    setMiCorreo("");
    setCodigo("");
  }

  const tab = (v: Vista, texto: string) => (
    <button
      type="button"
      onClick={() => setVista(v)}
      aria-pressed={vista === v}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A78BFA]/40 ${
        vista === v
          ? "bg-[#8B5CF6]/20 text-[#E9D5FF] ring-1 ring-[#8B5CF6]/50"
          : "text-[#A79BC4] hover:bg-[#1B1230]"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-[#0B0714] text-[#EDE9FE]"
      style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
        .pz-scroll { scrollbar-width: thin; scrollbar-color: #3B2D63 transparent; }
      `}</style>

      {/* Fondo: resplandores y cuadrícula */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 8% -10%, rgba(139,92,246,.28), transparent 60%), radial-gradient(40rem 30rem at 100% 100%, rgba(217,70,239,.14), transparent 60%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(167,139,250,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black, transparent 78%)",
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Cabecera */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2A1F45] bg-[#0B0714]/70 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#D946EF] text-white shadow-[0_0_24px_-4px_rgba(168,85,247,.9)]"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
                <path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15l2 2 4-4" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold">Permisos</p>
              <p className="text-xs text-[#A79BC4]">{EMPRESA}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ul className="hidden gap-1.5 xl:flex" aria-label="Tecnologías">
              {STACK.map((t) => (
                <li key={t} className="rounded-full border border-[#2E2250] bg-[#140D24] px-2.5 py-1 text-xs text-[#C4B5FD]">
                  {t}
                </li>
              ))}
            </ul>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-[#A79BC4]" role="status">
              <span
                className={`h-2 w-2 rounded-full ${
                  conectado ? "bg-[#34D399] shadow-[0_0_10px_rgba(52,211,153,.9)]" : "bg-[#4A3D70]"
                }`}
                aria-hidden="true"
              />
              {conectado ? "Actualización en vivo" : miCorreo ? "Conectando" : "Sin consulta activa"}
            </span>
          </div>
        </header>

        {/* Pestañas en pantallas pequeñas */}
        <div className="flex shrink-0 gap-1 border-b border-[#2A1F45] bg-[#0B0714]/70 px-3 py-2 lg:hidden">
          {tab("nueva", "Nueva solicitud")}
          {tab("historial", `Mis solicitudes${lista.length ? ` (${lista.length})` : ""}`)}
        </div>

        <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:p-6">
          {/* Formulario */}
          <form onSubmit={enviar} className={`${vista === "nueva" ? "flex" : "hidden"} lg:flex ${panel}`}>
            <span aria-hidden="true" className={lineaSuperior} />
            <div className="shrink-0 border-b border-[#2A1F45] px-5 py-4">
              <h1 className="text-lg font-bold leading-tight">Solicitar permiso</h1>
              <p className="mt-0.5 text-[13px] text-[#A79BC4]">
                El aprobador recibe tu solicitud por correo y te avisamos el resultado.
              </p>
            </div>

            <div className="pz-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <div>
                <label htmlFor="empleado_nombre" className={label}>Nombre completo</label>
                <input id="empleado_nombre" name="empleado_nombre" autoComplete="name" className={input}
                  placeholder="Ana Pérez" required value={form.empleado_nombre} onChange={cambiar} />
              </div>
              <div>
                <label htmlFor="empleado_email" className={label}>Correo corporativo</label>
                <input id="empleado_email" name="empleado_email" type="email" autoComplete="email" className={input}
                  placeholder="nombre@empresa.com" required value={form.empleado_email} onChange={cambiar} />
              </div>
              <div className="grid grid-cols-[1fr_88px] gap-3">
                <div>
                  <label htmlFor="tipo" className={label}>Tipo de permiso</label>
                  <select id="tipo" name="tipo" className={input} value={form.tipo} onChange={cambiar}>
                    {Object.entries(TIPOS).map(([valor, texto]) => (
                      <option key={valor} value={valor}>{texto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Total</span>
                  <p
                    className="mt-1 flex h-[38px] items-center justify-center rounded-lg border border-[#2E2250] bg-[#0F0A1C] text-sm font-bold text-[#E9D5FF]"
                    aria-live="polite"
                  >
                    {diasForm ? `${diasForm} ${diasForm === 1 ? "día" : "días"}` : "—"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fecha_inicio" className={label}>Desde</label>
                  <input id="fecha_inicio" name="fecha_inicio" type="date" className={input} required
                    value={form.fecha_inicio} onChange={cambiar} />
                </div>
                <div>
                  <label htmlFor="fecha_fin" className={label}>Hasta</label>
                  <input id="fecha_fin" name="fecha_fin" type="date" className={input} required
                    min={form.fecha_inicio} value={form.fecha_fin} onChange={cambiar} />
                </div>
              </div>
              <div>
                <label htmlFor="motivo" className={label}>
                  Motivo <span className="font-normal text-[#8E82AE]">(opcional)</span>
                </label>
                <textarea id="motivo" name="motivo" rows={2} maxLength={300} className={`${input} resize-none`}
                  placeholder="Agrega contexto para quien aprueba" value={form.motivo} onChange={cambiar} />
              </div>
            </div>

            <div className="shrink-0 border-t border-[#2A1F45] px-5 py-4">
              {error && (
                <p role="alert" className="mb-3 rounded-lg bg-[#FB7185]/10 px-3 py-2 text-[13px] text-[#FDA4AF] ring-1 ring-[#FB7185]/25">
                  {error}
                </p>
              )}
              <button
                disabled={enviando}
                className="w-full rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#C026D3] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_30px_-8px_rgba(168,85,247,.8)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A78BFA]/40 disabled:opacity-60"
              >
                {enviando ? "Enviando solicitud…" : "Enviar solicitud"}
              </button>
            </div>
          </form>

          {/* Historial */}
          <section className={`${vista === "historial" ? "flex" : "hidden"} lg:flex ${panel}`}>
            <span aria-hidden="true" className={lineaSuperior} />
            {!miCorreo ? (
              <div className="pz-scroll grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
                <form onSubmit={consultar} className="w-full max-w-sm">
                  <h2 className="text-lg font-bold">Consulta tus solicitudes</h2>
                  <p className="mt-1 text-[13px] text-[#A79BC4]">
                    Ingresa el correo con el que enviaste la solicitud para ver su estado.
                  </p>
                  <label htmlFor="consulta" className={`${label} mt-4`}>Correo corporativo</label>
                  <input id="consulta" type="email" autoComplete="email" className={input} required
                    placeholder="nombre@empresa.com" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
                  <button className="mt-3 w-full rounded-lg border border-[#8B5CF6]/50 bg-[#8B5CF6]/15 px-4 py-2.5 text-sm font-bold text-[#E9D5FF] transition hover:bg-[#8B5CF6]/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A78BFA]/40">
                    Ver mis solicitudes
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-[#2A1F45] px-5 pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold leading-tight">Mis solicitudes</h2>
                      <p className="truncate text-[13px] text-[#A79BC4]">{miCorreo}</p>
                    </div>
                    <button
                      type="button"
                      onClick={cambiarCorreo}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#C4B5FD] transition hover:bg-[#8B5CF6]/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A78BFA]/40"
                    >
                      Cambiar correo
                    </button>
                  </div>

                  {codigo && (
                    <p role="status" className="mt-3 rounded-lg bg-[#34D399]/10 px-3 py-2 text-[13px] text-[#6EE7B7] ring-1 ring-[#34D399]/25">
                      Solicitud enviada con el código <strong>{codigo}</strong>. Te avisaremos por correo cuando se resuelva.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {FILTROS.map((f) => {
                      const activo = filtro === f.valor;
                      return (
                        <button
                          key={f.valor}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => setFiltro(f.valor)}
                          className={`rounded-full px-3 py-1 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A78BFA]/40 ${
                            activo
                              ? "bg-[#8B5CF6] text-white shadow-[0_0_18px_-4px_rgba(139,92,246,.9)]"
                              : "bg-[#1B1230] text-[#C4B5FD] hover:bg-[#241A3F]"
                          }`}
                        >
                          {f.etiqueta}{" "}
                          <span className={activo ? "text-white/70" : "text-[#8E82AE]"}>{conteo[f.valor]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ul className="pz-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 [scrollbar-gutter:stable]">
                  {visibles.length === 0 && (
                    <li className="px-2 py-10 text-center text-sm text-[#A79BC4]">
                      {lista.length === 0
                        ? "Todavía no hay solicitudes con este correo."
                        : "No hay solicitudes con este estado."}
                    </li>
                  )}
                  {visibles.map((s) => {
                    const est = ESTADOS[s.estado] ?? ESTADOS.pendiente;
                    const dias = diasEntre(s.fecha_inicio, s.fecha_fin);
                    const resaltada = destacados.includes(s.id);
                    return (
                      <li
                        key={s.id}
                        className={`rounded-xl border p-3.5 motion-safe:transition-all motion-safe:duration-700 ${
                          resaltada
                            ? "border-[#8B5CF6] bg-[#8B5CF6]/15 shadow-[0_0_28px_-6px_rgba(139,92,246,.75)]"
                            : "border-[#2A1F45] bg-[#0F0A1C]/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold">{TIPOS[s.tipo] ?? s.tipo}</p>
                            <p className="text-[13px] text-[#A79BC4]">
                              {fecha(s.fecha_inicio)} al {fecha(s.fecha_fin)} ({dias} {dias === 1 ? "día" : "días"})
                            </p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${est.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${est.punto}`} aria-hidden="true" />
                            {est.etiqueta}
                          </span>
                        </div>

                        <Recorrido estado={s.estado} />

                        {s.comentario_aprobador && (
                          <p className="mt-3 rounded-lg bg-[#1B1230] px-3 py-2 text-[13px] text-[#DDD6FE]">
                            {s.comentario_aprobador}
                          </p>
                        )}
                        <p className="mt-2.5 text-xs text-[#9C90BB]">
                          Enviada {hace(s.creado_en)}. Código {s.id.slice(0, 6).toUpperCase()}.
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}