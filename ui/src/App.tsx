import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEventsQuery,
  useHealthQuery,
  useOrdersQuery,
  useReservationsQuery,
  useUsersQuery
} from './query/useTicketingQueries';
import { useReservationMutations } from './query/useReservationMutations';
import { ticketingKeys } from './query/queryKeys';
import ReservationCard from './components/ReservationCard';
import {
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface ToastState {
  msg: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Composes inventory, demo buyer, reservation and order sections for the ticket portal.
 * @returns Complete ticketing page.
 */
export default function App() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  const healthQuery = useHealthQuery();
  const usersQuery = useUsersQuery();
  const eventsQuery = useEventsQuery();
  const reservationsQuery = useReservationsQuery(selectedUser);
  const ordersQuery = useOrdersQuery(selectedUser);

  const users = usersQuery.data || [];
  const events = eventsQuery.data || [];
  const reservations = reservationsQuery.data || [];
  const orders = ordersQuery.data || [];
  const apiOnline = !healthQuery.isError && healthQuery.data?.status === 'ok';

  // Automatically select the first user once the list loads if none is selected.
  useEffect(() => {
    if (users.length > 0 && (!selectedUser || !users.some((u) => u.id === selectedUser))) {
      setSelectedUser(users[0].id);
    }
  }, [users, selectedUser]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
  };

  const { loading, reserveTickets, checkoutReservation } = useReservationMutations({
    selectedUser,
    notify: (message, type) => showToast(message, type)
  });

  // A changed message restarts its dismissal timer; cleanup prevents stale toast updates.
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const activeBuyer = users.find((u) => u.id === selectedUser) || {
    name: selectedUser || 'Demo User',
    id: selectedUser || ''
  };

  const dataError =
    eventsQuery.isError || healthQuery.isError
      ? 'The ticketing service is unavailable. Retry in a moment.'
      : '';

  const handleRetry = () => {
    void queryClient.invalidateQueries({ queryKey: ticketingKeys.all });
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background:
              toast.type === 'error' ? '#450a0a' : toast.type === 'info' ? '#0f172a' : '#064e3b',
            border: `1px solid ${
              toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#38bdf8' : '#10b981'
            }`,
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 600
          }}
          className="animate-in"
          role="status"
          aria-live="polite"
        >
          {toast.type === 'error' ? (
            <AlertCircle size={18} color="#f87171" />
          ) : (
            <CheckCircle2 size={18} color="#34d399" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Top Navbar */}
      <header
        className="site-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              boxShadow: '0 0 16px rgba(14, 165, 233, 0.3)'
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '9999px',
              background: apiOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${
                apiOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
              }`,
              color: apiOnline ? '#34d399' : '#f87171'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: apiOnline ? '#10b981' : '#ef4444'
              }}
              className={apiOnline ? 'animate-pulse' : ''}
            />
            {apiOnline ? 'API Connected' : 'API Offline'}
          </div>
        </div>
      </header>

      <p className="glass-panel demo-notice" role="note">
        Demo mode: buyer profiles are examples. Checkout is simulated and does not charge a payment method.
      </p>

      {/* 3-Step Lifecycle Visual Guide */}
      <section className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.75rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              1
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                Select Profile
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Choose active demo buyer
              </div>
            </div>
          </div>
          <ChevronRight size={18} color="#475569" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              2
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                Reserve Tickets
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Five-minute hold; row locks end with each transaction
              </div>
            </div>
          </div>
          <ChevronRight size={18} color="#475569" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              3
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                Pay &amp; Confirm
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Idempotent order &amp; digital ticket pass
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active Buyer Selection Tabs */}
      <section style={{ marginBottom: '2rem' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
            marginBottom: '0.65rem'
          }}
        >
          Active Purchasing Account
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0.85rem'
          }}
        >
          {users.map((u) => {
            const isSelected = selectedUser === u.id;
            return (
              <button
                type="button"
                aria-pressed={isSelected}
                key={u.id}
                onClick={() => setSelectedUser(u.id)}
                style={{
                  textAlign: 'left',
                  color: 'inherit',
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
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isSelected ? '#0284c7' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700
                  }}
                >
                  {u.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '14px',
                      color: isSelected ? '#38bdf8' : 'var(--text-main)'
                    }}
                  >
                    {u.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }} className="mono">
                    {u.id}
                  </div>
                </div>
                {isSelected && <CheckCircle2 size={18} color="#38bdf8" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Dashboard */}
      <div
        className="dashboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '2rem',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Available tickets */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Available tickets</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Inventory is refreshed from PostgreSQL.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {dataError ? (
              <div
                className="glass-panel"
                role="alert"
                style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                {dataError}{' '}
                <button className="btn btn-secondary" onClick={handleRetry}>
                  Retry
                </button>
              </div>
            ) : eventsQuery.isLoading && events.length === 0 ? (
              <div
                className="glass-panel"
                style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                Loading event inventory…
              </div>
            ) : events.length === 0 ? (
              <div
                className="glass-panel"
                style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                No ticket tiers are available.
              </div>
            ) : (
              events.map((tier, index) => {
                const total = Number(tier.total_capacity);
                const remaining = Number(tier.remaining_capacity);
                const price = Number(tier.price).toFixed(2);
                const isVip = tier.ticket_type === 'VIP';
                const ratio = total > 0 ? (remaining / total) * 100 : 0;
                const isSoldOut = remaining <= 0;
                const now = Date.now();
                const saleOpen =
                  tier.status === 'ACTIVE' &&
                  new Date(tier.sale_starts_at).getTime() <= now &&
                  new Date(tier.sale_ends_at).getTime() > now;
                const formKey = `${tier.event_id}_${tier.ticket_type}`;
                const currentQty = Math.min(quantities[formKey] || 1, Math.max(remaining, 1));

                const beginsEvent = index === 0 || events[index - 1].event_id !== tier.event_id;
                return (
                  <React.Fragment key={`${tier.event_id}:${tier.ticket_type}`}>
                    {beginsEvent && (
                      <div className="event-group-heading">
                        <h3>{tier.title}</h3>
                        <span className={`badge ${saleOpen ? 'badge-in-stock' : 'badge-low-stock'}`}>
                          {saleOpen ? 'Sale open' : 'Sale closed'}
                        </span>
                      </div>
                    )}
                    <div
                      className="glass-panel"
                      style={{
                        padding: '1.4rem',
                        borderLeft: `5px solid ${isVip ? '#f59e0b' : '#38bdf8'}`,
                        transition: 'border-color 0.2s ease'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${isVip ? 'badge-vip' : 'badge-general'}`}>
                            {isVip && <Sparkles size={12} />}
                            {tier.ticket_type} Tier
                          </span>
                          <span
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              color: 'var(--text-main)'
                            }}
                          >
                            ${price}
                          </span>
                        </div>

                        <span
                          className={`badge ${
                            isSoldOut
                              ? 'badge-sold-out'
                              : remaining <= 2
                              ? 'badge-low-stock'
                              : 'badge-in-stock'
                          }`}
                        >
                          {isSoldOut ? 'SOLD OUT' : `${remaining} OF ${total} LEFT`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ marginBottom: '1.2rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginBottom: '4px'
                          }}
                        >
                          <span>Capacity</span>
                          <span>
                            {remaining} / {total} remaining
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            background: '#334155',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${ratio}%`,
                              height: '100%',
                              background: isSoldOut
                                ? '#ef4444'
                                : isVip
                                ? 'linear-gradient(to right, #f59e0b, #d97706)'
                                : 'linear-gradient(to right, #0284c7, #38bdf8)',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                      </div>

                      {/* Quantity Selector & Reserve Button */}
                      <div
                        className="tier-actions"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <label
                            htmlFor={`quantity-${formKey}`}
                            style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                          >
                            Quantity:
                          </label>
                          <select
                            id={`quantity-${formKey}`}
                            disabled={isSoldOut || !saleOpen}
                            value={currentQty}
                            onChange={(e) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [formKey]: parseInt(e.target.value, 10)
                              }))
                            }
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
                            {[1, 2, 3, 4, 5]
                              .filter((q) => q <= remaining)
                              .map((q) => (
                                <option key={q} value={q}>
                                  {q}
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          disabled={isSoldOut || !saleOpen || loading || !selectedUser}
                          onClick={() => reserveTickets(tier.event_id, tier.ticket_type, currentQty)}
                          className={`btn ${isVip ? 'btn-primary' : 'btn-primary'}`}
                          style={{ flex: 1 }}
                        >
                          <Zap size={16} />
                          {isSoldOut
                            ? 'Sold Out'
                            : !saleOpen
                            ? 'Sale closed'
                            : `Reserve ${currentQty} ticket${
                                currentQty === 1 ? '' : 's'
                              } · hold 5m`}
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
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
              Demo profile: <strong>{activeBuyer.name}</strong>. Profile selection is not authentication.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reservations.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                <Clock size={36} color="#475569" style={{ margin: '0 auto 0.75rem' }} />
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--text-muted)'
                  }}
                >
                  No Active Holds
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Select tickets on the left and click Reserve to lock seats for 5 minutes.
                </p>
              </div>
            ) : (
              reservations.map((res) => (
                <ReservationCard
                  key={res.reservationId}
                  res={res}
                  onCheckout={checkoutReservation}
                  loading={loading}
                />
              ))
            )}
          </div>

          {/* Confirmed Orders (Digital Wallet) */}
          <div style={{ marginTop: '2.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              <ShieldCheck size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>My Confirmed Tickets</h2>
            </div>

            {orders.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  fontSize: '13px'
                }}
              >
                No completed purchases yet. Complete a checkout above to view your digital ticket passes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {orders.map((ord) => (
                  <div key={ord.id} className="ticket-stub" style={{ padding: '1.2rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: '15px' }}>
                        {ord.eventTitle || 'Demo Concert'}
                      </span>
                      <span className="badge badge-in-stock">CONFIRMED</span>
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        marginBottom: '0.5rem'
                      }}
                    >
                      Tier: <b>{ord.ticketType}</b> &nbsp;|&nbsp; Quantity: <b>{ord.quantity}</b> &nbsp;|&nbsp; Demo total: <b>${ord.amount}</b>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-dim)'
                      }}
                      className="mono"
                    >
                      <span>Order: {ord.id}</span>
                      <span>{new Date(ord.createdAt).toLocaleString()}</span>
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
