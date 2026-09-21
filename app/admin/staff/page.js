'use client';

import { useState, useEffect, useCallback } from 'react';

const ROLE_LABELS = {
  owner: 'Owner (everything)',
  retail: 'Retail admin',
  trade: 'Trade admin',
};

const ROLE_BADGE_COLOR = {
  owner: { bg: '#f5e6eb', color: '#840037' },
  retail: { bg: '#e6f4ea', color: '#1a7f37' },
  trade: { bg: '#e8effc', color: '#1d4ed8' },
};

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'retail' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load staff roster');
      setStaff(data.staff || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add staff member');
      setShowAdd(false);
      setForm({ email: '', name: '', role: 'retail' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id, role) => {
    try {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (member) => {
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update staff member');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove ${member.email} from the staff roster? They will immediately lose admin access.`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove staff member');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Staff &amp; Access
          </h1>
          <p className="text-xs text-gray-500 max-w-2xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Who can sign in to /admin, and what they can see. Retail admins never see trade accounts, orders or
            pricing; trade admins never see retail products, orders or customers. Only an owner sees everything —
            including this page.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:bg-[#6b002c] transition-all cursor-pointer"
          style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          + Add Staff Member
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse bg-gray-200" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            No staff added yet — only the owner account can sign in.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <thead>
              <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                <th className="py-3 px-4">Name / Email</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {staff.map((member) => {
                const badge = ROLE_BADGE_COLOR[member.role];
                return (
                  <tr key={member.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{member.name || member.email}</div>
                      <div className="text-[10px] text-gray-400">{member.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold border-0 cursor-pointer"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          member.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRemove(member)}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <form
            onSubmit={handleAdd}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            <h2 className="text-sm font-bold text-gray-900">Add Staff Member</h2>
            <p className="text-[11px] text-gray-500">
              They sign in with their WordPress admin/shop_manager account — this just decides what they can see once
              they do.
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Email (WordPress login)</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Name (optional)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200 cursor-pointer"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                style={{ backgroundColor: '#840037' }}
              >
                {saving ? 'Adding…' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
