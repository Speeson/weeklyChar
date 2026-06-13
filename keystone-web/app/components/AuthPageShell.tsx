import Link from 'next/link'

export default function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070d14] p-4 text-gray-100">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{ backgroundImage: "url('/client-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,0.24),transparent_34%),linear-gradient(180deg,rgba(7,13,20,0.72),#070d14_88%)]" />

      <div className="relative w-full max-w-md rounded-2xl border border-yellow-400/25 bg-[#0b121b]/90 p-7 shadow-2xl shadow-black/70 backdrop-blur-xl">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <img src="/app-icon.png" alt="" className="h-10 w-10 rounded-full object-contain" />
          <span className="text-xl font-black text-yellow-400">KeystoneSync</span>
        </Link>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
