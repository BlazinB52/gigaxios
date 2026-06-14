type AppLoadingScreenProps = {
  message?: string;
};

const loadingWords = ["Fetching", "Hookin UP", "Wranglig", "Grabling", "Snagin", "Yoinking"];

function getRandomLoadingWord() {
  return loadingWords[Math.floor(Math.random() * loadingWords.length)];
}

export default function AppLoadingScreen({
  message,
}: AppLoadingScreenProps) {
  const loadingWord = getRandomLoadingWord();
  const loadingMessage = message ?? `${loadingWord} what you really made...`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#020814] px-5 pb-24 text-center text-white">
      <p className="text-sm font-semibold tracking-wide text-blue-300">
        GigAxios
      </p>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {loadingMessage}
      </h1>

      <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-transparent" />
    </main>
  );
}