import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  RefreshCw, 
  Trash2, 
  CreditCard, 
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const API_BASE = 'http://localhost:3000';

export default function App() {
  const [users, setUsers] = useState([
    { id: 'usr_alice', name: 'Alice Demo', email: 'alice@example.com' },
    { id: 'usr_bob', name: 'Bob VIP', email: 'bob@example.com' },
    { id: 'usr_charlie', name: 'Charlie Fan', email: 'charlie@example.com' }
  ]);
  const [selectedUser, setSelectedUser] = useState('usr_alice');
  const [events, setEvents] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch system status and initial data
  const fetchData = async () => {
    try {
      // Check health
      const healthRes = await fetch(`${API_BASE}/health`).catch(() => null);
      if (healthRes && healthRes.ok) {
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }

      // Fetch users
      const usersRes = await fetch(`${API_BASE}/api/users`).catch(() => null);
      if (usersRes && usersRes.ok) {
        const uData = await usersRes.json();
        if (uData && uData.length > 0) setUsers(uData);
      }

      // Fetch events with deterministic tier ordering
      const eventsRes = await fetch(`${API_BASE}/api/events`).catch(() => null);
      if (eventsRes && eventsRes.ok) {
        const eData = await eventsRes.json();
        setEvents(eData);
      }

      // Fetch reservations for active buyer
      if (selectedUser) {
        const resRes = await fetch(`${API_BASE}/api/reservations?userId=${selectedUser}`).catch(() => null);
        if (resRes && resRes.ok) {
          const rData = await resRes.json();
          setReservations(rData);
        }

        // Fetch confirmed orders
        const ordRes = await fetch(`${API_BASE}/api/orders?userId=${selectedUser}`).catch(() => null);
        if (ordRes && ordRes.ok) {
          const oData = await ordRes.json();
          setOrders(oData);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  // Handle Reserve Action
  const handleReserve = async (eventId, ticketType) => {
    const qty = quantities[`${eventId}_${ticketType}`] || 1;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          eventId,
          ticketType,
          quantity: qty,
          idempotencyKey: `idem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        })
      });

      const data = await res.json();
      if (res.status === 201) {
        showToast(`🎉 Reserved ${qty} ${ticketType} tickets! 5-minute hold active.`, 'success');
        fetchData();
      } else if (res.status === 409) {
        showToast('❌ Sold Out! Insufficient inventory remaining.', 'error');
      } else {
        showToast(`❌ ${data.error || 'Reservation failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Checkout Action
  const handleCheckout = async (reservationId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/checkout/${reservationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          paymentReference: `pay_demo_${Math.random().toString(36).substring(2, 8)}`,
          idempotencyKey: `pay_idem_${Date.now()}`
        })
      });

      const data = await res.json();
      if (res.status === 200 || res.status === 201) {
        showToast(`🎟️ Payment confirmed! Order ${data.orderId} placed successfully.`, 'success');
        fetchData();
      } else if (res.status === 410) {
        showToast('⚠️ Reservation expired! Tickets have been returned to available stock.', 'error');
        fetchData();
      } else {
        showToast(`❌ ${data.error || 'Payment failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Checkout error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sweep Expired Holds
  const handleSweep = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/worker/expire-now`, { method: 'POST' });
      const data = await res.json();
      if (data.expiredCount > 0) {
        showToast(`🧹 Swept and freed ${data.expiredCount} expired ticket hold(s)!`, 'success');
      } else {
        showToast('No holds currently expired.', 'info');
      }
      fetchData();
    } catch (err) {
      showToast(`Sweep failed: ${err.message}`, 'error');
    }
  };

  // Admin Database Reset
  const handleResetDb = async () => {
    if (!window.confirm('Reset database? This will clear all holds/orders and restore tickets to full capacity.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/reset`, { method: 'POST' });
      if (res.ok) {
        showToast('🔄 Database reset to clean initial state. Full capacity restored.', 'success');
        fetchData();
      } else {
        showToast('Failed to reset database.', 'error');
      }
    } catch (err) {
      showToast(`Reset error: ${err.message}`, 'error');
    }
  };

  const activeBuyer = users.find(u => u.id === selectedUser) || { name: selectedUser, id: selectedUser };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#450a0a' : toast.type === 'info' ? '#0f172a' : '#064e3b',
          border: `1px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#38bdf8' : '#10b981'}`,
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 600
        }} className="animate-in">
          {toast.type === 'error' ? <AlertCircle size={18} color="#f87171" /> : <CheckCircle2 size={18} color="#34d399" />}
          {toast.msg}
        </div>
      )}

      {/* Top Navbar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.3)'
          }}>
            <Zap size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Flash-Sale Ticketing Portal
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              High-concurrency reservation engine with PostgreSQL row-level locks
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: '9999px',
            background: apiOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${apiOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: apiOnline ? '#34d399' : '#f87171'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: apiOnline ? '#10b981' : '#ef4444'
            }} className={apiOnline ? 'animate-pulse' : ''} />
            {apiOnline ? 'API Connected' : 'API Offline'}
          </div>

          <button onClick={handleSweep} className="btn btn-secondary" title="Sweep expired holds" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Clock size={14} /> Sweep Expired
          </button>

          <button onClick={handleResetDb} className="btn btn-danger" title="Clean database and restore full stock" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Trash2 size={14} /> Reset Database
          </button>
        </div>
      </header>

      {/* 3-Step Lifecycle Visual Guide */}
      <section className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>1</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Select Profile</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Choose active demo buyer</div>
            </div>
          </div>
          <ChevronRight size={18} color="#475569" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>2</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Reserve Tickets</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>5-minute temporary DB row-lock</div>
            </div>
          </div>
          <ChevronRight size={18} color="#475569" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>3</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Pay & Confirm</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Idempotent order & digital ticket pass</div>
            </div>
          </div>
        </div>
      </section>

      {/* Active Buyer Selection Tabs */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: '0.65rem' }}>
          Active Purchasing Account
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {users.map(u => {
            const isSelected = selectedUser === u.id;
            return (
              <div 
                key={u.id}
                onClick={() => setSelectedUser(u.id)}
                style={{
                  cursor: 'pointer',
                  padding: '1rem',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card)',
                  border: `2px solid ${isSelected ? '#38bdf8' : 'var(--border-subtle)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 16px rgba(56, 189, 248, 0.2)' : 'none'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: isSelected ? '#0284c7' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700
                }}>
                  {u.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#38bdf8' : 'var(--text-main)' }}>
                    {u.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }} className="mono">
                    {u.id}
                  </div>
                </div>
                {isSelected && <CheckCircle2 size={18} color="#38bdf8" />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Live Event & Deterministic Tiers */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Demo Concert Flash-Sale</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tiers sorted deterministically by price (VIP first, General second)
              </p>
            </div>
            <span className="badge badge-in-stock">Sale Live</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {events.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading event inventory...
              </div>
            ) : (
              events.map((tier) => {
                const total = parseInt(tier.total_capacity, 10);
                const remaining = parseInt(tier.remaining_capacity, 10);
                const price = parseFloat(tier.price).toFixed(2);
                const isVip = tier.ticket_type === 'VIP';
                const ratio = total > 0 ? (remaining / total) * 100 : 0;
                const isSoldOut = remaining <= 0;
                const formKey = `${tier.event_id}_${tier.ticket_type}`;
                const currentQty = quantities[formKey] || 1;

                return (
                  <div 
                    key={tier.ticket_type} 
                    className="glass-panel" 
                    style={{
                      padding: '1.4rem',
                      borderLeft: `5px solid ${isVip ? '#f59e0b' : '#38bdf8'}`,
                      transition: 'border-color 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge ${isVip ? 'badge-vip' : 'badge-general'}`}>
                          {isVip && <Sparkles size={12} />}
                          {tier.ticket_type} Tier
                        </span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          ${price}
                        </span>
                      </div>

                      <span className={`badge ${isSoldOut ? 'badge-sold-out' : remaining <= 2 ? 'badge-low-stock' : 'badge-in-stock'}`}>
                        {isSoldOut ? 'SOLD OUT' : `${remaining} OF ${total} LEFT`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Capacity</span>
                        <span>{remaining} / {total} remaining</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${ratio}%`,
                          height: '100%',
                          background: isSoldOut ? '#ef4444' : isVip ? 'linear-gradient(to right, #f59e0b, #d97706)' : 'linear-gradient(to right, #0284c7, #38bdf8)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    {/* Quantity Selector & Reserve Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Qty:</label>
                        <select 
                          disabled={isSoldOut}
                          value={currentQty}
                          onChange={(e) => setQuantities({ ...quantities, [formKey]: parseInt(e.target.value, 10) })}
                          style={{
                            background: '#0f172a',
                            color: '#fff',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          {[1, 2, 3, 4, 5].filter(q => q <= remaining).map(q => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </div>

                      <button 
                        disabled={isSoldOut || loading}
                        onClick={() => handleReserve(tier.event_id, tier.ticket_type)}
                        className={`btn ${isVip ? 'btn-primary' : 'btn-primary'}`}
                        style={{ flex: 1 }}
                      >
                        <Zap size={16} />
                        {isSoldOut ? 'Sold Out' : `Reserve ${(currentQty * parseFloat(tier.price)).toFixed(2)} USD (Hold 5m)`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Holds Station (5-Min Countdown) */}
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Active 5-Minute Holds</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Reserved for <strong>{activeBuyer.name}</strong> with database lock
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reservations.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                <Clock size={36} color="#475569" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)' }}>No Active Holds</div>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Select tickets on the left and click Reserve to lock seats for 5 minutes.
                </p>
              </div>
            ) : (
              reservations.map((res) => (
                <ReservationCard 
                  key={res.reservationId} 
                  res={res} 
                  onCheckout={handleCheckout} 
                  loading={loading}
                />
              ))
            )}
          </div>

          {/* Confirmed Orders (Digital Wallet) */}
          <div style={{ marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <ShieldCheck size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>My Confirmed Tickets</h2>
            </div>

            {orders.length === 0 ? (
              <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                No completed purchases yet. Complete a checkout above to view your digital ticket passes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {orders.map((ord) => (
                  <div key={ord.id} className="ticket-stub" style={{ padding: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px' }}>{ord.event_title || 'Demo Concert'}</span>
                      <span className="badge badge-in-stock">CONFIRMED</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Tier: <b>{ord.ticket_type}</b> &nbsp;|&nbsp; Quantity: <b>{ord.quantity}</b> &nbsp;|&nbsp; Paid: <b>${ord.amount}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }} className="mono">
                      <span>Order: {ord.id}</span>
                      <span>{new Date(ord.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Subcomponent: Reservation Card with Live Second-by-Second Countdown
function ReservationCard({ res, onCheckout, loading }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const expiresAt = new Date(res.expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.floor((expiresAt - now) / 1000);
      if (diff <= 0 || res.status === 'EXPIRED') {
        setTimeLeft(0);
        setIsExpired(true);
      } else {
        setTimeLeft(diff);
        setIsExpired(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [res.expiresAt, res.status]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isPaid = res.status === 'PAID';

  return (
    <div 
      className="glass-panel" 
      style={{
        padding: '1.25rem',
        borderLeft: `4px solid ${isPaid ? '#10b981' : isExpired ? '#ef4444' : '#38bdf8'}`,
        boxShadow: isPaid ? 'var(--glow-emerald)' : isExpired ? 'none' : 'var(--glow-cyan)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '14px' }}>{res.eventTitle || 'Demo Concert'}</strong>
        <span className={`badge ${isPaid ? 'badge-in-stock' : isExpired ? 'badge-sold-out' : 'badge-vip'}`}>
          {isPaid ? 'PAID' : isExpired ? 'EXPIRED' : 'HOLD ACTIVE'}
        </span>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
        Buyer: <b>{res.userName}</b> ({res.userId})
      </div>

      <div style={{ fontSize: '13px', marginBottom: '0.85rem' }}>
        Tier: <b>{res.ticketType}</b> &nbsp;|&nbsp; Qty: <b>{res.quantity}</b> &nbsp;|&nbsp; Total: <b>${res.totalPrice}</b>
      </div>

      {/* Live Second-by-Second Countdown Bar */}
      {!isPaid && (
        <div style={{
          background: isExpired ? '#450a0a' : '#0f172a',
          border: `1px solid ${isExpired ? '#dc2626' : '#0284c7'}`,
          borderRadius: '6px',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.85rem',
          fontSize: '13px',
          fontWeight: 600,
          color: isExpired ? '#fca5a5' : '#38bdf8'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isExpired ? '#ef4444' : '#38bdf8'
            }} className={!isExpired ? 'animate-pulse' : ''} />
            <span>{isExpired ? 'Hold Expired' : 'Hold Window:'}</span>
          </div>
          <div className="mono">
            {isExpired ? '00:00 (Stock freed)' : `⏳ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} left`}
          </div>
        </div>
      )}

      {/* Action Button */}
      {res.status === 'PENDING' && !isExpired && (
        <button 
          disabled={loading}
          onClick={() => onCheckout(res.reservationId)}
          className="btn btn-success" 
          style={{ width: '100%' }}
        >
          <CreditCard size={16} /> Pay & Confirm Order (${res.totalPrice})
        </button>
      )}

      {isPaid && (
        <div style={{ fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={14} /> Order completed. View ticket pass below.
        </div>
      )}

      {isExpired && (
        <div style={{ fontSize: '12px', color: '#f87171' }}>
          ⚠️ Hold timed out. Tickets have been automatically returned to inventory.
        </div>
      )}
    </div>
  );
}
