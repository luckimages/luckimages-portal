export default function DashboardPage() {
  // Data pulled from QuickBooks — June 10, 2026
  const revMonth = 640;
  const revYTD = 10095;
  const shootsCompleted = 231;
  const ytdInvoices = 39;
  const avgPerShoot = Math.round(revYTD / ytdInvoices);

  const kpis = [
    { label: "Revenue This Month", value: `$${revMonth.toLocaleString()}`, accent: "#4ade80" },
    { label: "Revenue YTD", value: `$${revYTD.toLocaleString()}`, accent: "#4ade80" },
    { label: "Shoots Completed", value: shootsCompleted.toString(), accent: "#60a5fa", sub: "Total invoices all-time" },
    { label: "Avg Revenue / Shoot", value: `$${avgPerShoot.toLocaleString()}`, accent: "#fbbf24", sub: "YTD average" },
  ];

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <span className="text-xl font-black tracking-tight uppercase">Luck Images</span>
        <div className="flex items-center gap-6">
          <span className="text-xs tracking-[2px] uppercase text-[#666]">Admin</span>
          <a href="/login" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">
            Sign Out
          </a>
        </div>
      </header>

      <div className="flex-1 px-8 py-12 max-w-7xl mx-auto w-full">

        {/* PAGE TITLE */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[4px] uppercase text-[#666] mb-2">Welcome back</p>
            <h1 className="text-4xl font-black tracking-tight uppercase">KPI Dashboard</h1>
          </div>
          <p className="text-xs tracking-[2px] uppercase text-[#444]">Last synced: June 10, 2026</p>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {kpis.map((card) => (
            <div
              key={card.label}
              className="bg-[#111] border border-white/10 p-6"
              style={{ borderBottom: `2px solid ${card.accent}` }}
            >
              <p className="text-xs tracking-[2px] uppercase text-[#666] mb-4">{card.label}</p>
              <p className="text-3xl font-bold">{card.value}</p>
              {card.sub && <p className="text-xs text-[#444] mt-2">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* MONTHLY BREAKDOWN */}
        <div className="mb-3">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Monthly Revenue — 2026</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-12">
          {[
            { month: "Jan", rev: 700 },
            { month: "Feb", rev: 1680 },
            { month: "Mar", rev: 2575 },
            { month: "Apr", rev: 1650 },
            { month: "May", rev: 2850 },
            { month: "Jun", rev: 640 },
          ].map((m) => {
            const pct = Math.round((m.rev / 2850) * 100);
            return (
              <div key={m.month} className="bg-[#111] border border-white/10 p-5">
                <p className="text-xs tracking-[2px] uppercase text-[#666] mb-3">{m.month}</p>
                <p className="text-xl font-bold mb-3">${m.rev.toLocaleString()}</p>
                <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                  <div className="h-full bg-white/40 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* RECENT INVOICES */}
        <div className="mb-3">
          <p className="text-xs tracking-[4px] uppercase text-[#666] mb-4">Recent Invoices</p>
        </div>
        <div className="bg-[#111] border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">Invoice</th>
                <th className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">Client</th>
                <th className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">Date</th>
                <th className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">Amount</th>
                <th className="text-left px-5 py-3 text-xs tracking-[2px] uppercase text-[#555] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { num: "1254", client: "Mrs Natasha Park", date: "Jun 5", amount: "$200", paid: false },
                { num: "1253", client: "Candice Putter", date: "Jun 4", amount: "$150", paid: false },
                { num: "1252", client: "Beverly Ortiz", date: "Jun 4", amount: "$150", paid: false },
                { num: "1251", client: "Mackenzie Smith", date: "Jun 4", amount: "$140", paid: false },
                { num: "1249", client: "Elizabeth Spiva", date: "May 16", amount: "$2,400", paid: false },
                { num: "1248", client: "Mr Doyle Wilson", date: "May 4", amount: "$450", paid: true },
                { num: "1246", client: "Mr Greg Gibson", date: "Apr 30", amount: "$300", paid: true },
                { num: "1245", client: "Mrs Iris Tombari", date: "Apr 24", amount: "$150", paid: true },
              ].map((inv) => (
                <tr key={inv.num} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-[#888]">#{inv.num}</td>
                  <td className="px-5 py-3">{inv.client}</td>
                  <td className="px-5 py-3 text-[#888]">{inv.date}</td>
                  <td className="px-5 py-3 font-medium">{inv.amount}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs tracking-[1px] uppercase px-2 py-1 ${inv.paid ? "bg-[#4ade8018] text-[#4ade80]" : "bg-[#fbbf2418] text-[#fbbf24]"}`}>
                      {inv.paid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </main>
  );
}
