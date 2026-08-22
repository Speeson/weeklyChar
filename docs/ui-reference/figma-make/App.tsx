import { useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  Database,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Tag,
  X,
} from "lucide-react";

const addonPath = "C:\\Program Files (x86)\\World of Warcraft\\_retail_\\Interface\\AddOns";

function Crest() {
  return (
    <div className="relative grid size-11 shrink-0 place-items-center rounded-full border border-primary/75 bg-[#06192e] shadow-[0_0_0_3px_rgba(5,20,37,.88),0_0_22px_rgba(246,178,26,.18)]">
      <div className="absolute inset-1 rotate-45 border border-primary/55" />
      <span className="relative font-[Marcellus] text-lg leading-none text-primary">K</span>
    </div>
  );
}

export default function App() {
  const [installed, setInstalled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const checkUpdates = () => {
    setChecking(true);
    window.setTimeout(() => setChecking(false), 900);
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(addonPath);
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background font-[DM_Sans] text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_47%_44%,rgba(18,88,145,.36),transparent_29%),radial-gradient(circle_at_88%_0%,rgba(21,74,137,.22),transparent_31%),linear-gradient(135deg,#020a15_0%,#06182c_51%,#030a15_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-25 [background-image:linear-gradient(rgba(134,171,207,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(134,171,207,.08)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />

      <header className="relative z-10 flex h-[88px] items-center border-b border-white/10 bg-[#030c18]/90 px-5 backdrop-blur-xl md:px-9">
        <div className="flex items-center gap-4 border-r border-white/15 pr-10">
          <Crest />
          <span className="font-[Marcellus] text-[26px] tracking-[-0.02em] text-primary">KeystoneClient</span>
        </div>
        <nav className="ml-10 hidden h-full items-center gap-9 text-[18px] text-[#d8d4cd] md:flex">
          <button className="h-full border-b-[3px] border-transparent px-1 transition hover:text-white">Sincronización</button>
          <button className="h-full border-b-[3px] border-primary px-1 font-semibold text-primary">Addon</button>
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <button aria-label="Configuración" className="grid size-12 place-items-center rounded-full border border-white/15 bg-white/[.025] text-white transition hover:border-primary/65 hover:text-primary"><Settings2 size={20} /></button>
          <button className="hidden items-center gap-3 sm:flex"><span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#d54b34] via-[#f0a05f] to-[#392f58] text-sm font-bold text-white">SP</span><span className="text-[17px]">Spee</span><ChevronDown size={16} /></button>
          <div className="hidden overflow-hidden rounded-md border border-white/15 md:flex">
            <button aria-label="Minimizar" className="grid size-12 place-items-center border-r border-white/15 text-[#d5d3d0] hover:bg-white/5">−</button>
            <button aria-label="Maximizar" className="grid size-12 place-items-center border-r border-white/15 text-[#d5d3d0] hover:bg-white/5"><Square size={13} /></button>
            <button aria-label="Cerrar" className="grid size-12 place-items-center text-[#d5d3d0] hover:bg-red-500/20 hover:text-red-200"><X size={18} /></button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto my-5 max-w-[1600px] px-4 pb-8 md:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#041428]/78 p-5 shadow-[0_18px_70px_rgba(0,0,0,.35)] backdrop-blur-sm md:p-9">
          <div className="pointer-events-none absolute left-[28%] top-[8%] size-[590px] rounded-full border border-cyan-400/10 opacity-80 shadow-[0_0_0_55px_rgba(10,89,150,.06),0_0_0_105px_rgba(10,89,150,.045)]" />
          <div className="pointer-events-none absolute left-[38%] top-[25%] size-[320px] rounded-full border border-primary/15 opacity-75 [background:repeating-conic-gradient(from_0deg,transparent_0deg,transparent_12deg,rgba(105,209,255,.22)_13deg,transparent_14deg)]" />
          <div className="pointer-events-none absolute left-[45%] top-[36%] size-[115px] rounded-full border border-primary/30 bg-primary/5 shadow-[0_0_45px_rgba(246,178,26,.13)]" />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.62fr)_minmax(400px,.9fr)] xl:gap-9">
            <div className="min-w-0">
              <div className="flex items-center gap-5">
                <Crest />
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">KeystoneSync</p>
                  <h1 className="font-[Marcellus] text-[clamp(2.4rem,4vw,4.25rem)] leading-none tracking-[-0.025em]">Addon</h1>
                </div>
              </div>
              <p className="mt-8 max-w-[590px] text-[19px] leading-[1.65] text-[#d6d1c9]">Instala o actualiza KeystoneSync desde las releases oficiales en tu carpeta de World of Warcraft.</p>

              <div className="mt-14 rounded-xl border border-border bg-[#06192d]/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
                <div className="flex items-center gap-4"><FolderOpen className="text-primary" size={28} /><h2 className="text-[21px] font-semibold">Ruta de AddOns</h2></div>
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-[#020e1d]/75 px-5 py-4 text-[15px] text-[#d9d1c9] md:text-[17px]">
                  <span className="min-w-0 flex-1 truncate">{addonPath}</span>
                  <button onClick={copyPath} aria-label="Copiar ruta" className="shrink-0 text-[#c9c3bc] hover:text-primary">{copied ? <Check size={22} className="text-lime-400" /> : <Copy size={22} />}</button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <button className="flex min-h-16 items-center justify-center gap-4 rounded-lg border border-border bg-[#0c2540]/80 px-5 text-[16px] transition hover:border-primary/70 hover:bg-[#123454]"><FolderOpen className="text-primary" size={25} />Seleccionar carpeta de AddOns</button>
                  <button className="flex min-h-16 items-center justify-center gap-4 rounded-lg border border-border bg-[#0c2540]/80 px-5 text-[16px] transition hover:border-primary/70 hover:bg-[#123454]"><ExternalLink className="text-[#d8d3cd]" size={24} />Abrir carpeta del addon</button>
                </div>
              </div>

              {installed ? (
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <button onClick={checkUpdates} className="group flex min-h-[106px] items-center justify-center gap-4 rounded-xl border-2 border-[#ffc929] bg-[linear-gradient(105deg,#f5a90a,#ffc737_50%,#ed9e04)] px-5 text-[clamp(1.05rem,1.8vw,1.4rem)] font-bold text-[#121619] shadow-[0_0_0_2px_rgba(100,52,0,.75),0_12px_30px_rgba(0,0,0,.24)] transition hover:brightness-110 active:translate-y-px">
                    <RefreshCw className="transition group-hover:rotate-180" size={31} />Actualizar KeystoneSync
                  </button>
                  <button onClick={() => setInstalled(false)} className="group flex min-h-[106px] items-center justify-center gap-4 rounded-xl border-2 border-[#ffc929] bg-[linear-gradient(105deg,#f5a90a,#ffc737_50%,#ed9e04)] px-5 text-[clamp(1.05rem,1.8vw,1.4rem)] font-bold text-[#121619] shadow-[0_0_0_2px_rgba(100,52,0,.75),0_12px_30px_rgba(0,0,0,.24)] transition hover:brightness-110 active:translate-y-px">
                    <Download className="transition group-hover:translate-y-0.5" size={32} />Reinstalar KeystoneSync
                  </button>
                </div>
              ) : (
                <button onClick={() => setInstalled(true)} className="group mt-7 flex min-h-[106px] w-full items-center justify-center gap-5 rounded-xl border-2 border-[#ffc929] bg-[linear-gradient(105deg,#f5a90a,#ffc737_50%,#ed9e04)] px-7 text-[clamp(1.1rem,2vw,1.55rem)] font-bold text-[#121619] shadow-[0_0_0_2px_rgba(100,52,0,.75),0_12px_30px_rgba(0,0,0,.24)] transition hover:brightness-110 active:translate-y-px">
                  <Download size={35} />Instalar KeystoneSync
                </button>
              )}
            </div>

            <aside className="border-l-0 border-border xl:border-l xl:pl-8">
              <div className="rounded-xl border border-border bg-[#041426]/88 p-6 md:p-7">
                <div className="flex items-center gap-4 border-b border-white/15 pb-6"><ShieldCheck size={28} className="text-primary" /><h2 className="text-[21px] font-semibold text-primary">Estado del addon</h2></div>
                <StatusRow icon={Download} label="Instalado" value={installed ? "Sí" : "No"} tone={installed ? "good" : "bad"} badge />
                <StatusRow icon={Tag} label="Última versión" value="v0.1.17" />
                <StatusRow icon={Activity} label="Estado" value={installed ? "Actualización disponible" : "Instalación disponible"} tone="notice" />
                <StatusRow icon={Globe} label="Origen" value="KeystoneSync releases" />
                <StatusRow icon={Database} label="Caché local" value="disponible" tone="good" />
                <StatusRow icon={Clock3} label="Última comprobación" value="hace 2 min" />
                <button onClick={checkUpdates} disabled={checking} className="mt-6 flex min-h-16 w-full items-center justify-center gap-4 rounded-lg border border-border bg-[#0d2844] text-[17px] transition hover:border-primary/70 hover:bg-[#123553] disabled:opacity-80"><Search size={26} />{checking ? <><LoaderCircle className="animate-spin" size={18} />Comprobando…</> : "Buscar actualizaciones"}</button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusRow({ icon: Icon, label, value, tone, badge = false }: { icon: typeof Activity; label: string; value: string; tone?: "good" | "bad" | "notice"; badge?: boolean }) {
  const toneClass = badge
    ? tone === "good"
      ? "rounded-md border border-lime-500/65 bg-lime-950/70 px-3 py-1 text-lime-300"
      : "rounded-md border border-red-500/70 bg-red-950/70 px-3 py-1 text-red-300"
    : tone === "good"
      ? "text-lime-400"
      : tone === "notice"
        ? "text-primary"
        : "text-[#f3eee8]";
  return <div className="flex min-h-[82px] items-center gap-4 border-b border-white/15 py-3"><Icon size={26} className="shrink-0 text-[#d1cbc4]" /><span className="text-[17px] text-[#d6d0c9]">{label}</span><strong className={`ml-auto text-right text-[16px] font-medium ${toneClass}`}>{value}</strong></div>;
}
