import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createAuthenticatedRequest } from '../lib/apiClient';
import { formatPrice } from '../lib/productHelpers';
import InlineNotice from '../component/ui/InlineNotice';

export default function AdminOperations() {
  const { session } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const request = createAuthenticatedRequest(session);
  const query = useQuery({ queryKey: ['admin', 'operations', page], queryFn: () => request(`/api/admin/operations?page=${page}`), enabled: Boolean(session), staleTime: 0 });
  const recover = async () => {
    setRunning(true); setError(''); setResult(null);
    try { setResult(await request('/api/admin/reminders/run', { method: 'POST' })); await client.invalidateQueries({ queryKey: ['admin', 'operations'] }); }
    catch (cause) { setError(cause.message); }
    finally { setRunning(false); }
  };
  return <section className="py-10">
    <h1 className="text-3xl font-semibold">Delivery & payment recovery</h1>
    <p className="mt-4 max-w-2xl text-sm">Payment attempts are retained until resolved. Recovery checks verify older attempts with Paystack and retry queued emails. A pending payment is not proof of a failed charge.</p>
    <button onClick={recover} disabled={running} className="mt-6 border border-black px-5 py-3 disabled:opacity-50">{running ? 'Checking…' : 'Run recovery checks'}</button>
    {(error || query.error) && <InlineNotice tone="error" className="mt-5">{error || query.error.message}</InlineNotice>}
    {result && <div role="status" className="mt-5 text-sm">Recovered payments: {result.paymentReconciliation?.recovered ?? 0}. Released reservations: {result.paymentReconciliation?.released ?? 0}. Notification emails accepted: {result.notificationRetries?.succeeded ?? 0}.
      {(result.errors?.length > 0 || result.paymentReconciliation?.errors?.length > 0) && <p className="mt-2 text-red-700">Some checks need attention. Review the errors below before running again.</p>}
      <ul>{[...(result.errors || []), ...(result.paymentReconciliation?.errors || []).map((item) => `${item.reference}: ${item.error}`)].map((item, index) => <li key={index}>{item}</li>)}</ul>
    </div>}
    <p className="mt-8 text-sm">{query.isPending ? 'Loading…' : `${query.data?.pendingCount ?? 0} retained attempts · ${query.data?.reservedCount ?? 0} active stock holds · ${query.data?.unsentNotifications ?? 0} queued emails`}</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Reference', 'Created', 'Amount', 'Stock held', 'Payment status'].map((label) => <th key={label} className="border-b p-3">{label}</th>)}</tr></thead><tbody>
      {(query.data?.attempts || []).map((attempt) => <tr key={attempt.reference}><td className="border-b p-3 font-mono text-xs">{attempt.reference}</td><td className="border-b p-3">{new Date(attempt.createdAt).toLocaleString()}</td><td className="border-b p-3">{formatPrice(attempt.total)}</td><td className="border-b p-3">{attempt.reserved ? 'Yes' : 'No'}</td><td className="border-b p-3">{attempt.status}</td></tr>)}
    </tbody></table></div>
    <nav aria-label="Attempt pages" className="mt-6 flex gap-5"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 50 >= (query.data?.pendingCount || 0)} onClick={() => setPage(page + 1)}>Next</button></nav>
  </section>;
}
