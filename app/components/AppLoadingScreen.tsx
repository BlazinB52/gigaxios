type AppLoadingScreenProps = {
  message?: string;
};

export default function AppLoadingScreen({
  message = "Fetching what you really made...",
}: AppLoadingScreenProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#020814] px-5 pb-24 text-center text-white">
      <p className="text-sm font-semibold tracking-wide text-blue-300">
        GigAxios
      </p>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {message}
      </h1>

      <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-transparent" />
    </main>
  );
}