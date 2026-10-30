'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Setting = Database['public']['Tables']['settings']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'limits' | 'staff'>('general')
  const [settings, setSettings] = useState<Setting[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState({
    email: '',
    full_name: '',
    role: 'loan_officer' as 'admin' | 'loan_officer',
  })

  useEffect(() => {
    fetchSettings()
    fetchProfiles()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key', { ascending: true })

    if (error) {
      console.error('Error fetching settings:', error)
    } else {
      setSettings(data || [])
      const formDataMap: Record<string, string> = {}
      data?.forEach((setting) => {
        formDataMap[setting.key] = setting.value
      })
      setFormData(formDataMap)
    }
    setLoading(false)
  }

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching profiles:', error)
    } else {
      setProfiles(data || [])
    }
  }

  const handleSettingChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value })
  }

  const handleSaveSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    for (const [key, value] of Object.entries(formData)) {
      const { error } = await supabase
        .from('settings')
        .update({ value, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq('key', key)

      if (error) {
        console.error(`Error updating setting ${key}:`, error)
        alert(`Failed to update ${key}`)
        return
      }
    }

    alert('Settings saved successfully')
    fetchSettings()
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()

    // This would typically involve Supabase Auth to create the user
    // For now, we'll just show a message
    alert(
      'To add a new staff member, please use the Supabase dashboard to create a new user, then they will appear here. In production, this would be done through a server action with admin privileges.'
    )
    setShowAddStaff(false)
    setNewStaff({ email: '', full_name: '', role: 'loan_officer' })
  }

  const handleToggleStaffStatus = async (profileId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', profileId)

    if (error) {
      console.error('Error updating profile status:', error)
      alert('Failed to update status')
    } else {
      fetchProfiles()
    }
  }

  const handleDeleteStaff = async (profileId: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) {
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', profileId)

    if (error) {
      console.error('Error deactivating profile:', error)
      alert('Failed to deactivate staff member')
    } else {
      fetchProfiles()
    }
  }

  const getSettingLabel = (key: string) => {
    const labels: Record<string, string> = {
      monthly_rate: 'Default Monthly Interest Rate (%)',
      min_rate: 'Minimum Monthly Interest Rate (%)',
      max_rate: 'Maximum Monthly Interest Rate (%)',
      default_repayment_style: 'Default Repayment Style',
      min_loan_amount: 'Minimum Loan Amount (₱)',
      max_loan_amount: 'Maximum Loan Amount (₱)',
      min_term_months: 'Minimum Term (months)',
      max_term_months: 'Maximum Term (months)',
      income_ratio_limit: 'Income Ratio Limit (%)',
      grace_days: 'Grace Days',
      late_payment_penalty_rate: 'Late Payment Penalty Rate (%)',
    }
    return labels[key] || key
  }

  const getSettingType = (key: string) => {
    if (key.includes('rate') || key.includes('ratio') || key.includes('limit')) return 'number'
    if (key === 'default_repayment_style') return 'select'
    return 'text'
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('limits')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'limits'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Loan Limits
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'staff'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Staff Management
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>

              <div className="space-y-4">
                {settings
                  .filter((s) => ['monthly_rate', 'min_rate', 'max_rate', 'default_repayment_style', 'grace_days', 'late_payment_penalty_rate'].includes(s.key))
                  .map((setting) => (
                    <div key={setting.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getSettingLabel(setting.key)}
                      </label>
                      {getSettingType(setting.key) === 'select' ? (
                        <select
                          value={formData[setting.key] || ''}
                          onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="EQUAL_PRINCIPAL">Installment</option>
                          <option value="EQUAL_PAYMENT">Equal Payment (legacy)</option>
                          <option value="LUMP_SUM">Lump Sum</option>
                        </select>
                      ) : (
                        <input
                          type={getSettingType(setting.key)}
                          step="0.01"
                          value={formData[setting.key] || ''}
                          onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  ))}
              </div>

              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Save Settings
              </button>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Loan Limits</h2>

              <div className="space-y-4">
                {settings
                  .filter((s) => ['min_loan_amount', 'max_loan_amount', 'min_term_months', 'max_term_months', 'income_ratio_limit'].includes(s.key))
                  .map((setting) => (
                    <div key={setting.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getSettingLabel(setting.key)}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData[setting.key] || ''}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
              </div>

              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Save Settings
              </button>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Add Staff Member
                </button>
              </div>

              {showAddStaff && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-md font-medium text-gray-900 mb-4">Add New Staff Member</h3>
                  <form onSubmit={handleAddStaff} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={newStaff.email}
                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newStaff.full_name}
                        onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                      </label>
                      <select
                        required
                        value={newStaff.role}
                        onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="loan_officer">Loan Officer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      >
                        Add Staff
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddStaff(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {profile.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm capitalize text-gray-900">
                          {profile.role.replace('_', ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              profile.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {profile.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleToggleStaffStatus(profile.id, profile.status)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            {profile.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {profiles.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No staff members found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
