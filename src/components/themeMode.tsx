import  Link  from "next/link";
export default function ThemeMode({ darkMode, toggleDarkMode }) {
  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold dark:text-white">
          Your Logo
        </Link>
        <button 
          onClick={toggleDarkMode}
          className="p-2 rounded-full focus:outline-none"
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <i className="bi bi-sun-fill text-yellow-400"></i>
          ) : (
            <i className="bi bi-moon-fill text-gray-700"></i>
          )}
        </button>
      </div>
    </header>
  );
}