'use client'

import { useState } from 'react'

export default function AdminSidebar({ profile }: { profile: any }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-md bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition"
        aria-label="Toggle menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:shrink-0 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <h1 className="text-xl font-bold">Mai Lending</h1>
          <p className="text-sm text-gray-400 mt-1">Admin Portal</p>
        </div>

        <nav className="mt-6">
          <div className="px-4 space-y-2">
            <a
              href="/dashboard"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </a>
            <a
              href="/borrowers"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Borrowers
            </a>
            <a
              href="/applications"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Applications
            </a>
            <a
              href="/loans"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Loans
            </a>
            <a
              href="/payments"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Payments
            </a>
            <a
              href="/collections"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Collections
            </a>
            <a
              href="/reports"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Reports
            </a>
            <a
              href="/calculator"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Calculator
            </a>
            {profile.role === 'admin' && (
              <a
                href="/settings"
                className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
                onClick={() => setIsOpen(false)}
              >
                Settings
              </a>
            )}
            <a
              href="/audit-log"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              onClick={() => setIsOpen(false)}
            >
              Audit Log
            </a>
          </div>
        </nav>

        <div className="absolute bottom-0 w-64 p-4 bg-gray-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-gray-400 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
