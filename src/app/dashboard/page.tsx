export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <div className="flex items-center gap-6">
          <span className="text-xs tracking-[2px] uppercase text-[#666]">Admin</span>
          <button className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 px-8 py-12 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">Welcome back</p>
          <h1 className="text-4xl font-black tracking-tight uppercase">Dashboard</h1>
        </div>

        {/* PLACEHOLDER CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {[
            { label: "Revenue This Month", value: "—" },
            { label: "Revenue YTD", value: "—" },
            { label: "Shoots Completed", value: "—" },
            { label: "Avg / Shoot", value: "—" },
          ].map((card) => (
            <div key={card.label} className="bg-[#111] border border-white/10 p-6">
              <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">{card.label}</p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="border border-white/10 bg-[#111] p-8 text-center">
          <p className="text-xs tracking-[4px] uppercase text-[#444] mb-3">Coming Soon</p>
          <p className="text-[#666] text-sm">
            KPI Dashboard — QuickBooks integration in progress
          </p>
        </div>
      </div>

    </main>
  );
}
