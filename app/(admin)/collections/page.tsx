'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type OverdueLoan = Database['public']['Tables']['loans']['Row'] & {
  borrowers: Database['public']['Tables']['borrowers']['Row']
}

type CollectionNote = Database['public']['Tables']['collection_notes']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row']
}

export default function CollectionsPage() {
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([])
  const [agingBuckets, setAgingBuckets] = useState<any[]>([])
  const [selectedLoan, setSelectedLoan] = useState<OverdueLoan | null>(null)
  const [collectionNotes, setCollectionNotes] = useState<CollectionNote[]>([])
  const [showNotes, setShowNotes] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const [newNote, setNewNote] = useState({
    note: '',
    promise_date: '',
  })

  useEffect(() => {
    fetchOverdueLoans()
    fetchAgingBuckets()
  }, [])

  const fetchOverdueLoans = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('loans')
      .select('*, borrowers(*)')
      .eq('status', 'overdue')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching overdue loans:', error)
    } else {
      setOverdueLoans(data || [])
    }
    setLoading(false)
  }

  const fetchAgingBuckets = async () => {
    const { data, error } = await supabase
      .from('v_aging_buckets')
      .select('*')

    if (error) {
      console.error('Error fetching aging buckets:', error)
    } else {
      setAgingBuckets(data || [])
    }
  }

  const fetchCollectionNotes = async (loanId: string) => {
    const { data, error } = await supabase
      .from('collection_notes')
      .select('*, profiles(*)')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching collection notes:', error)
    } else {
      setCollectionNotes(data || [])
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLoan) return

    const { data: { user } } = await supabase.auth.getUser()

    const result = editingNoteId
      ? await supabase
          .from('collection_notes')
          .update({ note: newNote.note, promise_date: newNote.promise_date || null })
          .eq('id', editingNoteId)
          .eq('loan_id', selectedLoan.id)
      : await supabase.from('collection_notes').insert({
          loan_id: selectedLoan.id,
          note: newNote.note,
          promise_date: newNote.promise_date || null,
          created_by: user?.id,
        })
    const { error } = result

    if (error) {
      console.error('Error saving collection note:', error)
      alert(`Failed to ${editingNoteId ? 'update' : 'add'} note: ${error.message}`)
    } else {
      setEditingNoteId(null)
      setNewNote({ note: '', promise_date: '' })
      fetchCollectionNotes(selectedLoan.id)
    }
  }

  const handleEditNote = (note: CollectionNote) => {
    setEditingNoteId(note.id)
    setNewNote({ note: note.note, promise_date: note.promise_date || '' })
  }

  const handleDeleteNote = async (note: CollectionNote) => {
    if (!window.confirm('Delete this collection note?')) return

    const { data, error } = await supabase
      .from('collection_notes')
      .delete()
      .eq('id', note.id)
      .select('id')
    if (error) {
      console.error('Error deleting collection note:', error)
      alert(`Could not delete note: ${error.message}`)
      return
    }
    if (!data?.length) {
      alert('No note was deleted. Apply the admin record-management SQL migration in Supabase to enable deletes.')
      return
    }
    if (editingNoteId === note.id) {
      setEditingNoteId(null)
      setNewNote({ note: '', promise_date: '' })
    }
    if (selectedLoan) fetchCollectionNotes(selectedLoan.id)
  }

  const handleSelectLoan = (loan: OverdueLoan) => {
    setSelectedLoan(loan)
    setShowNotes(true)
    setEditingNoteId(null)
    setNewNote({ note: '', promise_date: '' })
    fetchCollectionNotes(loan.id)
  }

  const getDaysLate = (loan: OverdueLoan) => {
    if (!loan.maturity_date) return 0
    const maturity = new Date(loan.maturity_date)
    const today = new Date()
    const diffTime = today.getTime() - maturity.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getAgingBucket = (daysLate: number) => {
    if (daysLate <= 30) return '1-30 days'
    if (daysLate <= 60) return '31-60 days'
    if (daysLate <= 90) return '61-90 days'
    return 'Over 90 days'
  }

  const bucketColors: Record<string, string> = {
    '1-30 days': 'bg-yellow-100 text-yellow-800',
    '31-60 days': 'bg-orange-100 text-orange-800',
    '61-90 days': 'bg-red-100 text-red-800',
    'Over 90 days': 'bg-red-200 text-red-900',
  }

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Collections</h1>

      {/* Aging Buckets Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {agingBuckets.map((bucket) => (
          <div key={bucket.bucket} className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200">
            <h3 className="text-xs md:text-sm font-medium text-gray-500 mb-2">{bucket.bucket}</h3>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{bucket.loan_count} loans</p>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              ₱{bucket.total_amount?.toLocaleString() || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Overdue Loans List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
        <h2 className="text-base md:text-lg font-semibold p-4 md:p-6 border-b border-gray-200">Overdue Loans</h2>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[32%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:w-[24%] xl:w-[20%] md:px-4">
                      Borrower
                    </th>
                    <th className="hidden w-[18%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:table-cell xl:w-[16%] md:px-4">
                      Phone
                    </th>
                    <th className="w-[24%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:w-[18%] xl:w-[17%] md:px-4">
                      Principal
                    </th>
                    <th className="w-[20%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:w-[15%] xl:w-[12%] md:px-4">
                      Days Late
                    </th>
                    <th className="hidden w-[17%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider xl:table-cell md:px-4">
                      Aging Bucket
                    </th>
                    <th className="w-[24%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider lg:w-[25%] xl:w-[18%] md:px-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overdueLoans.map((loan) => {
                    const daysLate = getDaysLate(loan)
                    const bucket = getAgingBucket(daysLate)
                    return (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="break-words px-2 py-4 text-xs sm:text-sm md:px-4">
                          <div className="font-medium text-gray-900">
                            {(loan as any).borrowers?.full_name || 'Unknown'}
                          </div>
                        </td>
                        <td className="hidden break-words px-2 py-4 text-sm text-gray-500 lg:table-cell md:px-4">
                          <div>
                            {(loan as any).borrowers?.phone || '-'}
                          </div>
                        </td>
                        <td className="break-words px-2 py-4 text-xs text-gray-900 sm:text-sm md:px-4">
                          <div>
                            ₱{loan.principal.toLocaleString()}
                          </div>
                        </td>
                        <td className="break-words px-2 py-4 text-xs font-medium text-gray-900 sm:text-sm md:px-4">
                          {daysLate}
                        </td>
                        <td className="hidden break-words px-2 py-4 xl:table-cell md:px-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${bucketColors[bucket]}`}
                          >
                            {bucket}
                          </span>
                        </td>
                        <td className="break-words px-2 py-4 text-xs font-medium md:px-4">
                          <button
                            onClick={() => handleSelectLoan(loan)}
                            className="text-left text-indigo-600 hover:text-indigo-900"
                          >
                            Add Note
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {overdueLoans.length === 0 && (
              <div className="text-center py-8 text-gray-500">No overdue loans</div>
            )}
          </>
        )}
      </div>

      {/* Collection Notes Panel */}
      {showNotes && selectedLoan && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-4 md:p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-base md:text-lg font-semibold">
              Collection Notes - {(selectedLoan as any).borrowers?.full_name}
            </h2>
            <button
              onClick={() => setShowNotes(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          <div className="p-4 md:p-6">
            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note *
                </label>
                <textarea
                  required
                  value={newNote.note}
                  onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promise Date
                </label>
                <input
                  type="date"
                  value={newNote.promise_date}
                  onChange={(e) => setNewNote({ ...newNote, promise_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {editingNoteId ? 'Save Changes' : 'Add Note'}
                </button>
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null)
                      setNewNote({ note: '', promise_date: '' })
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            {/* Notes History */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Note History</h3>
              {collectionNotes.length === 0 ? (
                <div className="text-sm text-gray-500">No notes yet</div>
              ) : (
                collectionNotes.map((note) => (
                  <div key={note.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{note.note}</p>
                        {note.promise_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Promise Date: {new Date(note.promise_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {(note as any).profiles?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                        <div className="mt-2 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleEditNote(note)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
