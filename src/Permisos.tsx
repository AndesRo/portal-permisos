import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

// Cambia el nombre que aparece en la cabecera
const EMPRESA = "ABC Corp";

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
  pendiente: { etiqueta: "Pendiente", pill: "bg-[#FBF1DC] text-[#8A5A0B]", punto: "bg-[#C98A1B]" },
  aprobado: { etiqueta: "Aprobada", pill: "bg-[#E0F2E8] text-[#17623D]", punto: "bg-[#1F8A57]" },
  rechazado: { etiqueta: "Rechazada", pill: "bg-[#F9E3E0] text-[#9C2F26]", punto: "bg-[#C4443A]" },
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

const input =
  "mt-1 w-full rounded-lg border border-[#C8D1D9] bg-white px-3 py-2 text-sm text-[#14212B] " +
  "placeholder:text-[#8C99A5] outline-none transition focus:border-[#0F5C6E] focus:ring-4 focus:ring-[#0F5C6E]/15";
const label = "block text-[13px] font-semibold text-[#14212B]";
const panel = "min-h-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-[#D5DCE2]";

export default function Permisos() {
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
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F5C6E]/25 ${
        vista === v ? "bg-[#14212B] text-white" : "text-[#3E4C58] hover:bg-[#EEF1F4]"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-[#F3F5F7] text-[#14212B]"
      style={{ fontFamily: "'Schibsted Grotesk', system-ui, sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Cabecera */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#D5DCE2] bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0F5C6E] text-white" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15l2 2 4-4" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold">Permisos</p>
            <p className="text-xs text-[#5B6B78]">{EMPRESA}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[#5B6B78]" role="status">
          <span
            className={`h-2 w-2 rounded-full ${conectado ? "bg-[#1F8A57]" : "bg-[#B6C0C9]"}`}
            aria-hidden="true"
          />
          {conectado ? "Actualización en vivo" : miCorreo ? "Conectando" : "Sin sesión de consulta"}
        </span>
      </header>

      {/* Pestañas en pantallas pequeñas */}
      <div className="flex shrink-0 gap-1 border-b border-[#D5DCE2] bg-white px-3 py-2 lg:hidden">
        {tab("nueva", "Nueva solicitud")}
        {tab("historial", `Mis solicitudes${lista.length ? ` (${lista.length})` : ""}`)}
      </div>

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:p-6">
        {/* Formulario */}
        <form onSubmit={enviar} className={`${vista === "nueva" ? "flex" : "hidden"} lg:flex ${panel}`}>
          <div className="shrink-0 border-b border-[#E1E7EC] px-5 py-4">
            <h1 className="text-lg font-extrabold leading-tight">Solicitar permiso</h1>
            <p className="mt-0.5 text-[13px] text-[#5B6B78]">
              El aprobador recibe tu solicitud por correo y te avisamos el resultado.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
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
                <p className="mt-1 flex h-[38px] items-center justify-center rounded-lg bg-[#EEF1F4] text-sm font-bold text-[#14212B]" aria-live="polite">
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
                Motivo <span className="font-normal text-[#7A8896]">(opcional)</span>
              </label>
              <textarea id="motivo" name="motivo" rows={2} maxLength={300} className={`${input} resize-none`}
                placeholder="Agrega contexto para quien aprueba" value={form.motivo} onChange={cambiar} />
            </div>
          </div>

          <div className="shrink-0 border-t border-[#E1E7EC] px-5 py-4">
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-[#F9E3E0] px-3 py-2 text-[13px] text-[#9C2F26]">{error}</p>
            )}
            <button
              disabled={enviando}
              className="w-full rounded-lg bg-[#0F5C6E] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0B4A59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F5C6E]/30 disabled:opacity-60"
            >
              {enviando ? "Enviando solicitud…" : "Enviar solicitud"}
            </button>
          </div>
        </form>

        {/* Historial */}
        <section className={`${vista === "historial" ? "flex" : "hidden"} lg:flex ${panel}`}>
          {!miCorreo ? (
            <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
              <form onSubmit={consultar} className="w-full max-w-sm">
                <h2 className="text-lg font-extrabold">Consulta tus solicitudes</h2>
                <p className="mt-1 text-[13px] text-[#5B6B78]">
                  Ingresa el correo con el que enviaste la solicitud para ver su estado.
                </p>
                <label htmlFor="consulta" className={`${label} mt-4`}>Correo corporativo</label>
                <input id="consulta" type="email" autoComplete="email" className={input} required
                  placeholder="nombre@empresa.com" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
                <button className="mt-3 w-full rounded-lg bg-[#14212B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0B141B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#14212B]/25">
                  Ver mis solicitudes
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-[#E1E7EC] px-5 pb-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold leading-tight">Mis solicitudes</h2>
                    <p className="truncate text-[13px] text-[#5B6B78]">{miCorreo}</p>
                  </div>
                  <button
                    type="button"
                    onClick={cambiarCorreo}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0F5C6E] transition hover:bg-[#E6F2F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F5C6E]/25"
                  >
                    Cambiar correo
                  </button>
                </div>

                {codigo && (
                  <p role="status" className="mt-3 rounded-lg bg-[#E0F2E8] px-3 py-2 text-[13px] text-[#17623D]">
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
                        className={`rounded-full px-3 py-1 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F5C6E]/25 ${
                          activo ? "bg-[#14212B] text-white" : "bg-[#EEF1F4] text-[#3E4C58] hover:bg-[#E1E7EC]"
                        }`}
                      >
                        {f.etiqueta}{" "}
                        <span className={activo ? "text-white/70" : "text-[#7A8896]"}>{conteo[f.valor]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 [scrollbar-gutter:stable]">
                {visibles.length === 0 && (
                  <li className="px-2 py-10 text-center text-sm text-[#5B6B78]">
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
                      className={`rounded-xl border p-3.5 motion-safe:transition-colors motion-safe:duration-700 ${
                        resaltada ? "border-[#0F5C6E] bg-[#E6F2F4]" : "border-[#E1E7EC] bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold">{TIPOS[s.tipo] ?? s.tipo}</p>
                          <p className="text-[13px] text-[#5B6B78]">
                            {fecha(s.fecha_inicio)} al {fecha(s.fecha_fin)} ({dias} {dias === 1 ? "día" : "días"})
                          </p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${est.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${est.punto}`} aria-hidden="true" />
                          {est.etiqueta}
                        </span>
                      </div>

                      {s.comentario_aprobador && (
                        <p className="mt-2.5 rounded-lg bg-[#F3F5F7] px-3 py-2 text-[13px] text-[#3E4C58]">
                          {s.comentario_aprobador}
                        </p>
                      )}
                      <p className="mt-2.5 text-xs text-[#7A8896]">
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
  );
}