// /pages/index.js
import Link from "next/link";

const pages = [
  { href: "/bestiary", label: "Kaorti Bestiary" },
  { href: "/npcs", label: "NPCs" },
  { href: "/items", label: "Items" },
  { href: "/map", label: "Map" },
  { href: "/alchemy", label: "Alchemy" },
  // Add/remove pages here as your project grows
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-xl p-8 bg-gray-800 rounded-xl shadow-xl">
        <h1 className="text-4xl font-bold mb-4 text-yellow-400 text-center">Welcome to the D&D Campaign Site</h1>
        <p className="mb-8 text-lg text-center text-gray-300">
          Explore the world of Mercia! Choose a section to begin:
        </p>
        <ul className="space-y-4">
          {pages.map((page) => (
            <li key={page.href}>
              <Link href={page.href}>
                <a className="block w-full text-center py-3 px-6 rounded-lg bg-blue-700 hover:bg-blue-600 font-semibold text-xl transition">
                  {page.label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Your D&D Campaign
        </div>
      </div>
    </main>
  );
}
