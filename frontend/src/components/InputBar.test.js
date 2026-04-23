import React from 'react';
import { render, screen } from '@testing-library/react';
import { InputBar } from './InputBar';

jest.mock('@/lib/useGateway', () => ({
  useGateway: () => ({
    models: [],
    providers: [],
    activeModel: null,
    webSearchEnabled: false,
    enabledSkills: [],
    activeThreadId: null,
    threads: [],
    spaces: [],
  }),
  switchModel: jest.fn(),
}));

jest.mock('@/components/ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector">model-selector</div>,
}));

jest.mock('@/components/PlusMenu', () => ({
  PlusMenu: ({ disabled }) => (
    <button data-testid="plus-menu-trigger" disabled={disabled} type="button">
      plus
    </button>
  ),
}));

describe('InputBar', () => {
  test('keeps chat input and plus menu available when gateway is disconnected', () => {
    render(
      <InputBar onSend={jest.fn()} disabled={true} placeholder="Message OpenClaw..." />
    );

    expect(screen.getByTestId('chat-input')).not.toBeDisabled();
    expect(screen.getByTestId('plus-menu-trigger')).not.toBeDisabled();
  });
});
