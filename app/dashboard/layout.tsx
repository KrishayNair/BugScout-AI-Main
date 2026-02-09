import { DashboardNav } from "@/components/DashboardNav";
import { Logo } from "@/components/Logo";
import { SyncPosthogEvents } from "@/components/SyncPosthogEvents";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-200 p-4 md:p-6">
      <SyncPosthogEvents />
      <div className="mx-auto flex max-w-[1920px] overflow-hidden rounded-3xl bg-white shadow-sm min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)]">
        <aside className="flex w-64 shrink-0 flex-col bg-primary-darker">
          <div className="flex h-16 shrink-0 items-center px-6">
            <Logo href="/dashboard" size="md" variant="light" />
          </div>
          <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
            <DashboardNav />
          </nav>
        </aside>

        <div className="flex w-6 shrink-0 items-stretch" aria-hidden>
          <div className="w-px bg-gray-200" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col pl-1">
          <main className="flex-1 overflow-auto bg-[#F9FAFB]">{children}</main>
        </div>
      </div>
    </div>
  );
}
