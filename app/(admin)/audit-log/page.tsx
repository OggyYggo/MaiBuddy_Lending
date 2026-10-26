'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type AuditLog = Database['public']['Tables']['audit_logs']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row']
}

export default function AuditLogPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    startDate: '',
    endDate: '',
  })
  const supabase = createClient()

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const fetchAuditLogs = async () => {
    setLoading(true)

    let query = supabase
      .from('audit_logs')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filters.action) {
      query = query.ilike('action', `%${filters.action}%`)
    }

    if (filters.entity) {
      query = query.ilike('entity', `%${filters.entity}%`)
    }

    if (filters.startDate) {
      query = query.gte('created_at', new Date(filters.startDate).toISOString())
    }

    if (filters.endDate) {
      query = query.lte('created_at', new Date(filters.endDate).toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
    } else {
      setAuditLogs(data || [])
    }

    setLoading(false)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleClearFilters = () => {
    setFilters({ action: '', entity: '', startDate: '', endDate: '' })
    fetchAuditLogs()
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      approve: 'bg-purple-100 text-purple-800',
      decline: 'bg-red-100 text-red-800',
      disburse: 'bg-yellow-100 text-yellow-800',
      payment: 'bg-green-100 text-green-800',
    }
    return colors[action.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const formatJson = (data: any) => {
    if (!data) return '-'
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              placeholder="e.g., create, update"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
            <input
              type="text"
              value={filters.entity}
              onChange={(e) => handleFilterChange('entity', e.target.value)}
              placeholder="e.g., loans, borrowers"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-4">
          <button
            onClick={fetchAuditLogs}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entity ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(log as any).profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.entity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.entity_id ? log.entity_id.slice(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <details className="cursor-pointer">
                        <summary className="text-indigo-600 hover:text-indigo-900">
                          View Details
                        </summary>
                        <div className="mt-2 space-y-2">
                          {log.before_data && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Before:</p>
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                {formatJson(log.before_data)}
                              </pre>
                            </div>
                          )}
                          {log.after_data && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">After:</p>
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                {formatJson(log.after_data)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {auditLogs.length === 0 && (
              <div className="text-center py-8 text-gray-500">No audit logs found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
