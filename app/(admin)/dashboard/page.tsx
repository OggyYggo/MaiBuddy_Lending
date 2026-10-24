export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Active Loans</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Outstanding Principal</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">₱0.00</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Overdue Loans</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Pending Applications</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Welcome to Mai Lending Admin</h2>
        <p className="text-gray-600">
          This is the admin dashboard for managing loans, borrowers, and payments.
          Use the sidebar to navigate to different sections.
        </p>
      </div>
    </div>
  )
}
