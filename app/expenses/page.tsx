import BottomNav from "@/app/components/BottomNav";

export default function ExpensesPage() {
  return (
    <main className="min-h-screen bg-zinc-100 pb-20">
      <div className="mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold">Expenses</h1>
      </div>

      <BottomNav />
    </main>
  );
}