import { DashboardNav } from "@/components/DashboardNav";
import { Logo } from "@/components/Logo";
import { SyncPosthogEvents } from "@/components/SyncPosthogEvents";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200/80 p-4 md:p-6 box-border">
      <SyncPosthogEvents />
      <div className="mx-auto flex h-full w-full max-w-[1920px] min-h-0 overflow-hidden rounded-3xl border border-white/60 bg-white shadow-xl shadow-primary/5">
        <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-primary-darker to-primary-dark">
          <div className="flex h-16 shrink-0 items-center px-6">
            <Logo href="/dashboard" size="md" variant="light" />
          </div>
          <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4 min-h-0">
            <DashboardNav />
          </nav>
        </aside>

        <div className="flex w-6 shrink-0 items-stretch" aria-hidden>
          <div className="w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col min-h-0 pl-1">
          <main className="flex-1 min-h-0 overflow-auto bg-gradient-to-b from-[#F9FAFB] to-gray-50/50">{children}</main>
        </div>
      </div>
    </div>
  );
}
