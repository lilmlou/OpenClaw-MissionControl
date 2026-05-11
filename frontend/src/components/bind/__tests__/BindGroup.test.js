/**
 * Phase 0.3 — BindGroup prefix rendering tests
 *
 * BindGroup queries /api/v2/config, filters keys by prefix, and renders
 * a <Bind> for each matching key. It subscribes to WS for live updates
 * (tested separately in Bind.test.js for the hook-level wiring).
 *
 * We mock <Bind> (which internally calls useConfigBus hooks with CRA5/React 19
 * complexity) and test BindGroup's key-fetching, filtering, and container.
 *
 * CODED_NOT_TESTED → CODED_AND_TESTED (2026-05-11).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ── Mock fetch ────────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Mock apiUrl ───────────────────────────────────────────────────────────
jest.mock('@/lib/useGateway', () => ({
  apiUrl: (url) => url.startsWith('http') ? url : `http://localhost:8000${url}`,
}));

// ── Mock useConfigBus — minimal, only what BindGroup imports ──────────────
jest.mock('@/hooks/useConfigBus', () => ({
  subscribeConfigWs: jest.fn(() => () => {}),
  ensureConfigWs: jest.fn(),
}));

// ── Mock <Bind> — avoids React 19/CRA5 hook mocking complexity ──────────
jest.mock('../Bind', () => ({
  Bind: ({ to, dataTestid }) =>
    require('react').createElement('div', {
      'data-testid': dataTestid || `bind-${to}`,
    }, to),
  default: ({ to, dataTestid }) =>
    require('react').createElement('div', {
      'data-testid': dataTestid || `bind-${to}`,
    }, to),
}));

import BindGroup from '../BindGroup';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('BindGroup', () => {
  it('renders with custom data-testid from prop', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { items: [] } }),
    });

    render(<BindGroup prefix="ui.theme" dataTestid="custom-bind-group" />);
    await waitFor(() => {
      expect(screen.getByTestId('custom-bind-group')).toBeInTheDocument();
    });
  });

  it('derives data-testid from prefix if no dataTestid prop', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { items: [] } }),
    });

    render(<BindGroup prefix="cron.watcher" />);
    await waitFor(() => {
      expect(screen.getByTestId('bind-group-cron.watcher')).toBeInTheDocument();
    });
  });

  it('renders <Bind> for each key matching the prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            { key: 'ui.theme.default' },
            { key: 'ui.theme.font' },
            { key: 'cron.watcher' },
            { key: 'ui.theme.accent' },
          ],
        },
      }),
    });

    render(<BindGroup prefix="ui.theme." />);
    await waitFor(() => {
      expect(screen.getByTestId('bind-ui.theme.default')).toBeInTheDocument();
      expect(screen.getByTestId('bind-ui.theme.font')).toBeInTheDocument();
      expect(screen.getByTestId('bind-ui.theme.accent')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bind-cron.watcher')).not.toBeInTheDocument();
  });

  it('shows EmptyState when no keys match the prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: { items: [{ key: 'other.namespace.x' }] },
      }),
    });

    render(<BindGroup prefix="ui.theme." />);
    await waitFor(() => {
      expect(screen.getByText(/No keys match this prefix/)).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<BindGroup prefix="ui.theme." />);
    await waitFor(() => {
      expect(screen.getByTestId('bind-group-ui.theme.-error')).toBeInTheDocument();
    });
  });

  it('renders title when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { items: [] } }),
    });

    render(<BindGroup prefix="ui.appearance." title="Appearance" />);
    await waitFor(() => {
      expect(screen.getByText('Appearance')).toBeInTheDocument();
    });
  });

  it('fetches from /api/v2/config on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { items: [] } }),
    });

    render(<BindGroup prefix="test.prefix" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/config')
      );
    });
  });
});