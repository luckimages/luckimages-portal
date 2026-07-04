export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1350px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
