import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { createAuthenticatedRequest } from '../lib/apiClient';
import { variantLabel } from '../lib/variantOptions';
import InlineNotice from '../component/ui/InlineNotice';
import Spinner from '../component/ui/Spinner';

export default function Waitlist() {
  const { user, session } = useAuth();
  const client = useQueryClient();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['waitlist', user?.id], queryFn: () => createAuthenticatedRequest(session)('/api/waitlist'), enabled: Boolean(session && user) });
  const remove = async (id) => {
    setPending(id); setError('');
    try {
      await createAuthenticatedRequest(session)(`/api/waitlist/${encodeURIComponent(id)}`, { method: 'DELETE' });
      client.setQueryData(['waitlist', user.id], (entries = []) => entries.filter((entry) => entry.id !== id));
    } catch (cause) { setError(cause.message || 'Unable to remove this subscription.'); }
    finally { setPending(null); }
  };
  return <div>
    <h2 className="border-b border-[var(--line)] pb-5 text-2xl font-semibold">Restock notifications</h2>
    <p className="mt-4 text-sm">Manage the product options you asked us to email you about.</p>
    {(error || query.error) && <InlineNotice tone="error" className="mt-4">{error || query.error.message}<button className="ml-3 underline" onClick={() => query.refetch()}>Try again</button></InlineNotice>}
    {query.isPending && <Spinner label="Loading subscriptions" className="mt-6" />}
    {query.data?.length === 0 && <p className="py-8">You have no restock subscriptions. <Link to="/shop" className="underline">Browse the shop</Link></p>}
    <ul className="mt-6 divide-y divide-[var(--line)]">
      {(query.data || []).map((entry) => <li key={entry.id} className="flex items-center justify-between gap-4 py-5">
        <div><Link className="font-semibold underline" to={`/product/${entry.variant.product.id}?variant=${encodeURIComponent(entry.variantId)}`}>{entry.variant.product.name}</Link><p className="mt-1 text-sm">{variantLabel(entry.variant)} · {entry.status === 'WAITING' ? 'Waiting for restock' : 'Restock notification queued'}</p></div>
        <button disabled={pending !== null} onClick={() => remove(entry.id)} className="border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-50">{pending === entry.id ? 'Removing…' : 'Remove'}</button>
      </li>)}
    </ul>
  </div>;
}
