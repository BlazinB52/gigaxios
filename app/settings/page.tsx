import BottomNav from "../components/BottomNav";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-slate-400">
          Settings will be added here.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}
