'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Borrower = Database['public']['Tables']['borrowers']['Row']

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingBorrowerId, setEditingBorrowerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    full_name: '',
    birth_date: '',
    phone: '',
    address: '',
    employer: '',
    monthly_income: '',
    id_type: '',
    id_number: '',
    notes: '',
  })

  useEffect(() => {
    fetchBorrowers()
  }, [])

  const fetchBorrowers = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from('borrowers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        const details = [
          error.message,
          error.details,
          error.hint,
          error.code ? `Code: ${error.code}` : null,
        ].filter(Boolean).join(' — ')
        console.error('Error fetching borrowers:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        setFetchError(details || 'The database returned an empty error. Check the browser Network tab for the Supabase request response.')
      } else {
        setBorrowers(data || [])
      }
    } catch (err) {
      console.error('Unexpected error fetching borrowers:', err)
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const borrowerData = {
      full_name: formData.full_name,
      birth_date: formData.birth_date,
      phone: formData.phone,
      address: formData.address,
      employer: formData.employer || null,
      monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
      id_type: formData.id_type || null,
      id_number: formData.id_number || null,
      notes: formData.notes || null,
    }
    const { error } = editingBorrowerId
      ? await supabase.from('borrowers').update(borrowerData).eq('id', editingBorrowerId)
      : await supabase.from('borrowers').insert(borrowerData)

    if (error) {
      console.error('Error saving borrower:', error)
      alert(`Failed to ${editingBorrowerId ? 'update' : 'create'} borrower: ${error.message}`)
    } else {
      setShowForm(false)
      setEditingBorrowerId(null)
      setFormData({
        full_name: '',
        birth_date: '',
        phone: '',
        address: '',
        employer: '',
        monthly_income: '',
        id_type: '',
        id_number: '',
        notes: '',
      })
      fetchBorrowers()
    }
  }

  const handleEdit = (borrower: Borrower) => {
    setEditingBorrowerId(borrower.id)
    setFormData({
      full_name: borrower.full_name,
      birth_date: borrower.birth_date,
      phone: borrower.phone,
      address: borrower.address,
      employer: borrower.employer || '',
      monthly_income: borrower.monthly_income?.toString() || '',
      id_type: borrower.id_type || '',
      id_number: borrower.id_number || '',
      notes: borrower.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (borrower: Borrower) => {
    const [applicationsResult, loansResult] = await Promise.all([
      supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('borrower_id', borrower.id),
      supabase
        .from('loans')
        .select('id', { count: 'exact', head: true })
        .eq('borrower_id', borrower.id),
    ])

    if (applicationsResult.error || loansResult.error) {
      const error = applicationsResult.error || loansResult.error
      console.error('Error checking borrower references before deletion:', error)
      alert(`Could not verify whether ${borrower.full_name} has linked applications or loans. No data was deleted.`)
      return
    }

    const applicationCount = applicationsResult.count || 0
    const loanCount = loansResult.count || 0
    if (applicationCount > 0 || loanCount > 0) {
      alert(
        `Cannot delete ${borrower.full_name}: this borrower is linked to ${applicationCount} application${applicationCount === 1 ? '' : 's'} and ${loanCount} loan${loanCount === 1 ? '' : 's'}. Keep the borrower record to preserve financial history.`,
      )
      return
    }

    if (!window.confirm(`Delete borrower ${borrower.full_name}? This cannot be undone.`)) {
      return
    }

    const { data, error } = await supabase
      .from('borrowers')
      .delete()
      .eq('id', borrower.id)
      .select('id')
    if (error) {
      console.error('Error deleting borrower:', error)
      if (error.code === '23503') {
        alert('This borrower is linked to an application or loan and cannot be deleted. Keep the record to preserve financial history.')
        return
      }
      alert(`Could not delete borrower: ${error.message}`)
      return
    }
    if (!data?.length) {
      alert('No borrower was deleted. Apply the admin record-management SQL migration in Supabase to enable deletes.')
      return
    }
    fetchBorrowers()
  }

  const filteredBorrowers = borrowers.filter(
    (b) =>
      b.full_name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone.includes(search)
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">Borrowers</h1>
          <p className="mt-1 text-sm text-slate-500">Manage borrower profiles and contact details.</p>
        </div>
        <button
          onClick={() => {
            setEditingBorrowerId(null)
            setFormData({
              full_name: '', birth_date: '', phone: '', address: '', employer: '',
              monthly_income: '', id_type: '', id_number: '', notes: '',
            })
            setShowForm(true)
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 md:text-base"
        >
          Add Borrower
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {showForm && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 mb-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">{editingBorrowerId ? 'Edit Borrower' : 'Add New Borrower'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birth Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employer
                </label>
                <input
                  type="text"
                  value={formData.employer}
                  onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Income
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monthly_income}
                  onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Type
                </label>
                <input
                  type="text"
                  value={formData.id_type}
                  onChange={(e) => setFormData({ ...formData, id_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Number
                </label>
                <input
                  type="text"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {editingBorrowerId ? 'Save Changes' : 'Save Borrower'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingBorrowerId(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {fetchError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load borrowers: {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <table className="w-full min-w-[760px] divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Address
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Monthly Income
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBorrowers.map((borrower) => (
                  <tr key={borrower.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{borrower.full_name}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{borrower.phone}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-500">{borrower.address}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-500">
                        {borrower.monthly_income ? `₱${borrower.monthly_income.toLocaleString()}` : '-'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={`/borrowers/${borrower.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => handleEdit(borrower)}
                        className="ml-2 md:ml-3 text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(borrower)}
                        className="ml-2 md:ml-3 text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBorrowers.length === 0 && (
            <div className="text-center py-8 text-gray-500">No borrowers found</div>
          )}
        </div>
      )}
    </div>
  )
}
