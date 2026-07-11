import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
      style={{ background: "#070d0a" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0) 70%), radial-gradient(40% 40% at 85% 90%, rgba(45,212,191,0.10) 0%, rgba(45,212,191,0) 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div
          className="rounded-2xl border p-7 shadow-2xl"
          style={{
            background: "linear-gradient(180deg, #0e1712 0%, #0b120e 100%)",
            borderColor: "rgba(52,211,153,0.18)",
            boxShadow:
              "0 0 0 1px rgba(52,211,153,0.05), 0 30px 60px -20px rgba(0,0,0,0.6), 0 0 40px -10px rgba(16,185,129,0.15)",
          }}
        >
          <div className="mb-7 flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-wide text-emerald-950"
              style={{
                background: "linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%)",
                boxShadow: "0 0 18px rgba(16,185,129,0.45)",
              }}
            >
              EL
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">Eagle Labs Australia</h1>
              <p className="text-xs leading-tight text-emerald-100/40">
                BlendCaps Dashboard
              </p>
            </div>
          </div>

          <p className="mb-5 text-sm text-emerald-50/60">Sign in to continue.</p>

          <LoginForm next={next ?? "/"} />

          <p className="mt-5 text-center text-xs text-emerald-100/40">
            Need an account? Contact your Super Admin.
          </p>
        </div>
      </div>
    </div>
  );
}
