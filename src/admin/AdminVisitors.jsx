import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";
import ListToolbar, { ShowMore } from "../component/admin/ListToolbar";
import { useListControls, byText, byNumber, byDate } from "../lib/useListControls";

const toInputDate = (date) => date.toISOString().slice(0, 10);
const number = (value) => new Intl.NumberFormat("en-NG").format(value || 0);
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
const dateLabel = (value) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never";

const countryName = (code) => {
  if (!code || code === "??") return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
};

const Stat = ({ label, value, hint }) => (
  <div className="border border-[var(--line)] p-5">
    <p className="eyebrow">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--ink-900)]">{value}</p>
    {hint && <p className="meta-text mt-1">{hint}</p>}
  </div>
);

// Proportional bars: the longest row is full width, the rest scale to it.
const BarList = ({ rows, label, value, empty = "No data in this period." }) => {
  const max = Math.max(...rows.map((row) => row[value]), 1);
  return (
    <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--ink-900)]">
      {rows.map((row) => (
        <div key={label(row)} className="relative py-2.5 text-sm">
          <div className="absolute inset-y-1 left-0 bg-[var(--surface-muted)]" style={{ width: `${(row[value] / max) * 100}%` }} />
          <div className="relative flex justify-between gap-4 px-2">
            <span className="truncate">{label(row)}</span>
            <span className="font-medium tabular-nums">{number(row[value])}</span>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="py-4 text-sm text-[var(--ink-500)]">{empty}</p>}
    </div>
  );
};

// Bars are capped in width and kept light, so a handful of days doesn't
// become a few huge black slabs. Hover a bar for the exact figures.
const DailyChart = ({ days, valueKey, secondaryKey, unit }) => {
  const peak = Math.max(...days.map((day) => day[valueKey]), 1);
  const short = (day) => new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div className="mt-4">
      <div className="flex h-40 items-stretch gap-1 border-b border-[var(--line)]">
        {days.map((day) => (
          <div key={day.day} className="group flex min-w-0 flex-1 items-end justify-center" title={`${short(day.day)}: ${day[valueKey]} ${unit}${secondaryKey ? `, ${day[secondaryKey]} views` : ""}`}>
            <div
              className="w-full max-w-10 bg-[var(--ink-300)] transition-colors group-hover:bg-[var(--ink-900)]"
              style={{ height: `${Math.max((day[valueKey] / peak) * 100, 3)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[var(--ink-500)]">
        <span>{short(days[0].day)}</span>
        <span>Busiest day: {number(peak)} {unit}</span>
        <span>{short(days[days.length - 1].day)}</span>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <section>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">{title}</h2>
    {children}
  </section>
);

const duration = (seconds) => `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;

// Google Analytics' own numbers, fetched through the GA4 Data API. Shown
// beside the first-party counts above: GA also covers visitors our own
// counter can't see (e.g. before sign-in on another device), and the two
// should be broadly similar — a big gap usually means ad-blockers.
const Ga4Panel = ({ request, from, to, enabled }) => {
  const query = useQuery({
    queryKey: ["admin", "ga4", from, to],
    queryFn: () => request(`/api/admin/ga4?from=${from}&to=${to}`),
    enabled,
    retry: false,
  });
  const data = query.data;

  return (
    <div className="mt-16 border-t border-[var(--ink-900)] pt-8">
      <h2 className="text-lg font-semibold">Google Analytics</h2>
      {query.isPending && <div className="mt-4"><Spinner label="Loading Google Analytics" /></div>}
      {query.isError && (
        <p className="mt-4 text-sm text-red-700">{query.error?.message || "Could not load Google Analytics."}</p>
      )}
      {data?.configured === false && (
        <div className="mt-4 border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-sm leading-relaxed">
          <p className="font-medium">Not connected yet.</p>
          <p className="mt-1 text-[var(--ink-500)]">
            Add <code>GA4_PROPERTY_ID</code>, <code>GA4_CLIENT_EMAIL</code> and <code>GA4_PRIVATE_KEY</code> to your
            environment (see <code>.env.example</code>), give that service-account email Viewer access on the GA4
            property, then redeploy.
          </p>
        </div>
      )}
      {data?.configured && !data.error && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Active right now" value={number(data.activeNow)} hint="Last 30 minutes" />
            <Stat label="Users" value={number(data.activeUsers)} />
            <Stat label="New users" value={number(data.newUsers)} hint={percent(data.newUsers, data.activeUsers)} />
            <Stat label="Sessions" value={number(data.sessions)} />
            <Stat label="Page views" value={number(data.pageViews)} />
            <Stat label="Engaged sessions" value={`${Math.round(data.engagementRate * 100)}%`} />
            <Stat label="Avg. session" value={duration(data.avgSessionSeconds)} />
          </div>
          <div className="mt-8">
            <Section title="Users per day">
              {data.daily.length > 0 && <DailyChart days={data.daily} valueKey="users" unit="users" />}
            </Section>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            <Section title="Channels (sessions)">
              <BarList rows={data.channels} label={(row) => row.channel} value="sessions" />
            </Section>
            <Section title="Countries (users)">
              <BarList rows={data.countries} label={(row) => countryName(row.country)} value="users" />
            </Section>
            <Section title="Top pages (views)">
              <BarList rows={data.pages} label={(row) => row.path} value="views" />
            </Section>
          </div>
        </>
      )}
    </div>
  );
};

const LAPSED_SORTS = [
  { value: "orders", label: "Most orders", compare: byNumber((c) => c.orders, -1) },
  { value: "recent", label: "Seen most recently", compare: byDate((c) => c.lastVisit, -1) },
  { value: "longest", label: "Gone longest", compare: byDate((c) => c.lastVisit) },
  { value: "joined", label: "Newest accounts", compare: byDate((c) => c.signedUpAt, -1) },
  { value: "name", label: "Name A–Z", compare: byText((c) => c.name || c.email) },
];
const EMPTY_LIST = [];

// The "haven't visited" list gets its own search/sort so it can be worked
// through without scrolling.
const LapsedCustomers = ({ customers, inactive }) => {
  const controls = useListControls(customers, {
    searchText: (c) => `${c.name || ""} ${c.email}`,
    sorts: LAPSED_SORTS,
  });
  return (
    <>
      <div className="mt-4">
        <ListToolbar controls={controls} placeholder="Search by name or email" noun="customers" />
      </div>
      <div className="divide-y divide-[var(--line)]">
        {controls.visible.map((customer) => (
          <Link
            key={customer.id}
            to={`/admin/customers/${customer.id}`}
            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 text-sm hover:bg-[var(--surface-muted)] md:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <span className="min-w-0 truncate">{customer.name || customer.email}
              {customer.name && <span className="meta-text ml-2">{customer.email}</span>}</span>
            <span className="meta-text">Last seen: {dateLabel(customer.lastVisit)}</span>
            <span className="meta-text hidden md:inline">Joined {dateLabel(customer.signedUpAt)}</span>
            <span className="text-right font-medium">{customer.orders} order{customer.orders === 1 ? "" : "s"}</span>
          </Link>
        ))}
        {customers.length === 0 && (
          <p className="py-6 text-sm text-[var(--ink-500)]">Every customer has visited recently.</p>
        )}
      </div>
      <ShowMore controls={controls} />
      {inactive > customers.length && (
        <p className="meta-text mt-3">Showing the first {number(customers.length)} of {number(inactive)} quiet accounts.</p>
      )}
    </>
  );
};

const AdminVisitors = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [from, setFrom] = useState(toInputDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(toInputDate(new Date()));
  const [inactiveDays, setInactiveDays] = useState(30);

  const query = useQuery({
    queryKey: ["admin", "visitors", from, to, inactiveDays],
    queryFn: () => request(`/api/admin/visitors?from=${from}&to=${to}&inactiveDays=${inactiveDays}`),
    enabled: Boolean(session),
  });
  const data = query.data;

  // Customers can only be called "inactive" for the time we have been
  // watching: right after launch everyone looks inactive.
  const trackedDays = data?.trackingSince
    ? Math.floor((Date.now() - new Date(data.trackingSince).getTime()) / 86_400_000)
    : 0;

  const inputClass = "border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link to="/admin" className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">Admin</Link>
          <h1 className="mt-3 text-3xl font-semibold">Visitors</h1>
          <p className="mt-2 text-sm text-[var(--ink-500)]">
            Who comes to the site, where from, and which customers have stopped.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-sm"><span className="mb-1.5 block font-medium">From</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
          <label className="text-sm"><span className="mb-1.5 block font-medium">To</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={inputClass} /></label>
        </div>
      </div>

      {query.isPending && <div className="mt-10"><Spinner label="Loading visitors" /></div>}
      {query.isError && <p className="mt-10 text-sm text-red-700">Could not load visitor data.</p>}

      {data && (
        <>
          {!data.trackingSince && (
            <p className="mt-8 border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-sm">
              No visits recorded yet. Counting starts once this version is live — open the storefront in a
              private window (not logged in as staff) and refresh this page.
            </p>
          )}

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Unique visitors" value={number(data.visitors)} />
            <Stat label="Page views" value={number(data.views)} />
            <Stat label="New visitors" value={number(data.newVisitors)} hint={percent(data.newVisitors, data.visitors)} />
            <Stat label="Returning visitors" value={number(data.returningVisitors)} hint={percent(data.returningVisitors, data.visitors)} />
            <Stat label="Signed-in visitors" value={number(data.signedInVisitors)} hint="Have an account" />
            <Stat label="Anonymous visitors" value={number(data.anonymousVisitors)} hint="Never signed in this period" />
            <Stat label="Customers seen" value={number(data.customers.activeInPeriod)} hint={`of ${number(data.customers.total)} accounts`} />
            <Stat label={`Quiet ${data.inactiveDays}+ days`} value={number(data.customers.inactive)} hint="Accounts not seen" />
          </div>

          <div className="mt-10">
            <Section title="Visitors per day">
              {data.daily.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--ink-500)]">No data in this period.</p>
              ) : (
                <DailyChart days={data.daily} valueKey="visitors" secondaryKey="views" unit="visitors" />
              )}
            </Section>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <Section title="Shopping funnel (visitors)">
              <BarList
                rows={[
                  { name: "Visited the site", count: data.funnel.visitors },
                  { name: "Looked at a product", count: data.funnel.viewedProduct },
                  { name: "Opened the bag", count: data.funnel.openedCart },
                  { name: "Reached checkout", count: data.funnel.reachedCheckout },
                  { name: "Paid orders", count: data.funnel.paidOrders },
                ]}
                label={(row) => row.name}
                value="count"
              />
            </Section>
            <Section title="Where visitors come from">
              <BarList rows={data.sources} label={(row) => row.source} value="visitors" />
            </Section>
            <Section title="Most viewed pages">
              <BarList rows={data.topPages} label={(row) => row.path} value="views" />
            </Section>
            <div className="grid gap-8 sm:grid-cols-2">
              <Section title="Devices">
                <BarList rows={data.devices} label={(row) => row.device} value="visitors" />
              </Section>
              <Section title="Countries">
                <BarList rows={data.countries} label={(row) => countryName(row.country)} value="visitors" />
              </Section>
            </div>
          </div>

          <div className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--ink-900)] pb-3">
              <div>
                <h2 className="text-lg font-semibold">Customers who haven&apos;t visited</h2>
                <p className="meta-text mt-1">
                  Accounts with no visit in the last {data.inactiveDays} days
                  {data.customers.neverSeen > 0 && ` (${number(data.customers.neverSeen)} never seen since tracking began)`}.
                  Customers who ordered come first.
                </p>
              </div>
              <label className="text-sm"><span className="mb-1.5 block font-medium">Quiet for</span>
                <select value={inactiveDays} onChange={(event) => setInactiveDays(Number(event.target.value))} className={inputClass}>
                  {[7, 14, 30, 60, 90].map((days) => <option key={days} value={days}>{days}+ days</option>)}
                </select>
              </label>
            </div>

            {data.trackingSince && trackedDays < inactiveDays && (
              <p className="mt-4 border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-xs">
                Tracking began {trackedDays} day{trackedDays === 1 ? "" : "s"} ago, so anyone who last visited
                before then shows as &ldquo;Never&rdquo;. This list becomes reliable after {inactiveDays} days of data.
              </p>
            )}

            <LapsedCustomers customers={data.customers.list || EMPTY_LIST} inactive={data.customers.inactive} />
            <p className="meta-text mt-6">
              To win these customers back, send them a <Link to="/admin/campaigns" className="underline">campaign</Link>.
              Visitors who never created an account are anonymous by design and can only be counted, not named.
            </p>
          </div>
        </>
      )}

      <Ga4Panel request={request} from={from} to={to} enabled={Boolean(session)} />
    </main>
  );
};

export default AdminVisitors;
