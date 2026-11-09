// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { Timeline } from './Timeline';
import { sampleEvent, sampleSession, sampleSnapshot } from './fixtures.test-support';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function bootstrap() { return vi.fn<typeof fetch>().mockResolvedValueOnce(json(sampleSession)).mockResolvedValueOnce(json(sampleSnapshot)); }
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('calendar journeys', () => {
  it('opens full travel details, contains focus and restores focus with Escape', async () => {
    vi.stubGlobal('fetch', bootstrap()); const user = userEvent.setup(); render(<App />);
    const trigger = (await screen.findAllByRole('button', { name: /Flight to Lisbon/ }))[0]!;
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Flight to Lisbon' });
    expect(within(dialog).getByText('SFO · Terminal 2')).toBeVisible();
    expect(within(dialog).getByText('Bring passports.')).toBeVisible();
    expect(within(dialog).getByText('DEMO42')).toBeVisible();
    expect(within(dialog).getByText('America/Los_Angeles')).toBeVisible();
    expect(within(dialog).getByText('Alex Rivera')).toBeVisible();
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    expect(close).toHaveFocus(); await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Back to the calendar' })).toHaveFocus();
    await user.tab(); expect(close).toHaveFocus();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  });
  it('traps account-dialog focus at visible summaries when every profile is connected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ ...sampleSession, profiles: sampleSession.profiles.slice(0, 1) })).mockResolvedValueOnce(json(sampleSnapshot)));
    const user = userEvent.setup(); render(<App />);
    await user.click(await screen.findByRole('button', { name: /Manage accounts/ }));
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    const summary = within(dialog).getByText('Demo tools');
    expect(close).toHaveFocus(); await user.tab({ shift: true }); expect(summary).toHaveFocus();
    await user.tab(); expect(close).toHaveFocus();
    await user.click(summary);
    await user.click(close); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('waits for source confirmation and then removes source events', async () => {
    let confirm: (response: Response) => void = () => {};
    const fetcher = bootstrap().mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; })).mockResolvedValueOnce(json({ ...sampleSnapshot, sources: [{ ...sampleSnapshot.sources[0]!, selected: false }], events: [] }));
    vi.stubGlobal('fetch', fetcher); const user = userEvent.setup(); render(<App />);
    const checkbox = await screen.findByRole('checkbox', { name: 'Family plans' }); await user.click(checkbox);
    expect(checkbox).toBeChecked(); expect(checkbox).toBeDisabled(); expect(screen.getAllByRole('button', { name: /Flight to Lisbon/ }).length).toBeGreaterThan(0);
    confirm(json({ ...sampleSnapshot.sources[0]!, selected: false }));
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.queryByRole('button', { name: /Flight to Lisbon/ })).not.toBeInTheDocument(); expect(checkbox).not.toBeDisabled();
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe('PATCH');
  });
  it('refreshes persisted error after failed sync and recovers without losing events', async () => {
    const failedSnapshot = { ...sampleSnapshot, accounts: [{ ...sampleSnapshot.accounts[0]!, syncStatus: 'error', error: 'Demo provider unavailable' }] };
    const fetcher = bootstrap().mockResolvedValueOnce(json({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Demo provider unavailable', retryable: true } }, 502)).mockResolvedValueOnce(json(failedSnapshot)).mockResolvedValueOnce(json(sampleSnapshot.accounts[0])).mockResolvedValueOnce(json(sampleSnapshot));
    vi.stubGlobal('fetch', fetcher); const user = userEvent.setup(); render(<App />);
    await user.click(await screen.findByRole('button', { name: /Manage accounts/ }));
    await user.click(screen.getByText('Demo tools')); await user.click(screen.getByRole('button', { name: 'Simulate sync failure' }));
    const retry = await screen.findByRole('button', { name: 'Retry sync' });
    expect(screen.getByText('Needs attention')).toBeVisible(); expect(screen.getAllByRole('button', { name: /Flight to Lisbon/ }).length).toBeGreaterThan(0);
    await user.click(retry); await screen.findByRole('button', { name: 'Sync now' });
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/snapshot'))).toHaveLength(3);
  });
  it('keeps last data when a write and its refresh both fail', async () => {
    vi.stubGlobal('fetch', bootstrap().mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new TypeError('offline')));
    const user = userEvent.setup(); render(<App />); await user.click(await screen.findByRole('checkbox', { name: 'Family plans' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your last loaded calendar is still shown.');
    expect(screen.getByRole('checkbox')).toBeChecked(); expect(screen.getByRole('checkbox')).not.toBeDisabled();
    expect(screen.getAllByRole('button', { name: /Flight to Lisbon/ }).length).toBeGreaterThan(0);
  });
  it('rejects invalid bootstrap data and provides retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ mode: 'real', households: [] }))); render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected data'); expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
  it('connects available simulated accounts then refreshes the snapshot', async () => {
    const sam = { ...sampleSnapshot.accounts[0]!, id: 'account-sam', profileId: 'sam', displayName: 'Sam Rivera', email: 'sam@family.example' };
    const fetcher = bootstrap().mockResolvedValueOnce(json(sam, 201)).mockResolvedValueOnce(json({ ...sampleSnapshot, accounts: [...sampleSnapshot.accounts, sam] }));
    vi.stubGlobal('fetch', fetcher); const user = userEvent.setup(); render(<App />);
    await user.click(await screen.findByRole('button', { name: /Manage accounts/ })); await user.click(screen.getByRole('button', { name: 'Connect Sam’s demo account' }));
    await waitFor(() => expect(screen.getAllByText('Connected')).toHaveLength(2));
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe('{"profileId":"sam"}');
  });
});

describe('timeline interactions', () => {
  it('keeps rendered center stable across preset and slider zoom and supports keyboard navigation', async () => {
    const user = userEvent.setup(); render(<Timeline snapshot={sampleSnapshot} onOpen={() => {}} />);
    const viewport = screen.getByTestId('timeline-viewport'); const anchor = Number(viewport.dataset.center);
    for (const label of ['Week', 'Day', 'Month']) { await user.click(screen.getByRole('button', { name: label })); const pixel = (anchor - Number(viewport.dataset.origin)) * Number(viewport.dataset.scale); expect(Math.abs(pixel - Number(viewport.dataset.width) / 2)).toBeLessThan(1); }
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom level' }), { target: { value: '64.5' } });
    expect(Math.abs((anchor - Number(viewport.dataset.origin)) * Number(viewport.dataset.scale) - Number(viewport.dataset.width) / 2)).toBeLessThan(1);
    const pan = screen.getByRole('region', { name: 'Spatial calendar' }).querySelector<HTMLElement>('.timeline-pan')!;
    pan.focus(); await user.keyboard('{ArrowRight}'); expect(Number(viewport.dataset.center)).toBeGreaterThan(anchor);
  });
  it('renders text safely and displays empty state for distant ranges', () => {
    const open = vi.fn(); render(<Timeline snapshot={{ ...sampleSnapshot, events: [{ ...sampleEvent, title: '<img src=x onerror=alert(1)>' }] }} onOpen={open} />);
    expect(screen.getByRole('button', { name: /<img src=x/ }).querySelector('img')).toBeNull();
    fireEvent.change(screen.getByRole('slider', { name: 'Move through time' }), { target: { value: String(Number(screen.getByTestId('timeline-viewport').dataset.center) + 500) } });
    expect(screen.getByText('A little breathing room.')).toBeVisible();
  });
});
