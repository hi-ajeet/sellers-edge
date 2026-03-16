import { useState, useEffect } from 'react';

const api = (window as any).sellersEdge;

interface Account {
  id?: number;
  name: string;
  account_number: string;
  email: string;
  password: string;
  notes: string;
}

const empty: Account = { name: '', account_number: '', email: '', password: '', notes: '' };

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editing, setEditing] = useState<Account | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  const load = async () => {
    const list = await api?.getAccounts();
    setAccounts(list || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing?.name) return;
    await api?.saveAccount(editing);
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return;
    await api?.deleteAccount(id);
    load();
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-xl" style={{ color: 'var(--se-text)' }}>Whatnot Accounts</h1>
          <p style={{ fontSize: 13, color: 'var(--se-muted)', marginTop: 2 }}>
            Credentials are stored encrypted on your device
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing({ ...empty }); setShowForm(true); }}>
          + Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3"
          style={{ color: 'var(--se-muted)', border: '2px dashed var(--se-border)', borderRadius: 12 }}>
          <div style={{ fontSize: 40 }}>👤</div>
          <div style={{ fontWeight: 600 }}>No accounts yet</div>
          <div style={{ fontSize: 13 }}>Add your Whatnot seller account to get started</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((acc: any) => (
            <div key={acc.id} className="rounded-xl p-5 flex items-start justify-between"
              style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                  style={{ background: 'var(--se-blue)', color: 'white' }}>
                  {acc.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-bold" style={{ color: 'var(--se-text)', fontSize: 15 }}>{acc.name}</div>
                  {acc.account_number && (
                    <div style={{ fontSize: 12, color: 'var(--se-muted)', marginTop: 2 }}>
                      Account # {acc.account_number}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--se-muted)', marginTop: 1 }}>{acc.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ fontSize: 12, color: 'var(--se-muted)' }}>
                      {showPasswords[acc.id] ? acc.password : '••••••••'}
                    </span>
                    <button style={{ fontSize: 11, color: 'var(--se-blue)', cursor: 'pointer', background: 'none', border: 'none' }}
                      onClick={() => setShowPasswords(p => ({ ...p, [acc.id]: !p[acc.id] }))}>
                      {showPasswords[acc.id] ? 'hide' : 'show'}
                    </button>
                  </div>
                  {acc.notes && (
                    <div style={{ fontSize: 12, color: 'var(--se-muted)', marginTop: 4, fontStyle: 'italic' }}>{acc.notes}</div>
                  )}
                  {acc.last_used && (
                    <div style={{ fontSize: 11, color: 'var(--se-muted)', marginTop: 3 }}>
                      Last used: {new Date(acc.last_used).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" style={{ fontSize: 12 }}
                  onClick={() => { setEditing(acc); setShowForm(true); }}>Edit</button>
                <button className="btn-ghost" style={{ fontSize: 12, borderColor: 'var(--se-error)', color: 'var(--se-error)' }}
                  onClick={() => handleDelete(acc.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Form Modal */}
      {showForm && editing && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>

          <div className="rounded-xl p-6 w-[460px]"
            style={{ background: 'var(--se-surface)', border: '1px solid var(--se-border)' }}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editing.id ? 'Edit Account' : 'Add Account'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--se-muted)', fontSize: 20 }}>×</button>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { key: 'name', label: 'STORE / ACCOUNT NAME', placeholder: 'My Card Shop' },
                { key: 'account_number', label: 'WHATNOT ACCOUNT NUMBER', placeholder: 'Optional' },
                { key: 'email', label: 'LOGIN EMAIL', placeholder: 'seller@example.com' },
                { key: 'password', label: 'PASSWORD', placeholder: '••••••••', type: 'password' },
                { key: 'notes', label: 'NOTES', placeholder: 'Optional notes' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: 'var(--se-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6, display: 'block' }}>
                    {f.label}
                  </label>
                  <input className="input-field" type={f.type || 'text'}
                    value={(editing as any)[f.key] || ''} placeholder={f.placeholder}
                    onChange={e => setEditing((a: any) => ({ ...a, [f.key]: e.target.value }))} />
                </div>
              ))}

              <div style={{ fontSize: 11, color: 'var(--se-muted)', padding: '8px 10px', background: 'var(--se-surface2)', borderRadius: 6 }}>
                🔒 Credentials are encrypted with AES-256 and stored locally on your device only.
              </div>

              <div className="flex gap-3 pt-1">
                <button className="btn-ghost flex-1" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={handleSave} disabled={!editing.name}>
                  {editing.id ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
