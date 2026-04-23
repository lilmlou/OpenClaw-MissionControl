import { useGateway } from './useGateway';

beforeAll(() => {
  global.crypto = global.crypto || { randomUUID: () => `test-${Math.random().toString(16).slice(2)}` };
});

beforeEach(() => {
  localStorage.clear();
  useGateway.persist?.clearStorage?.();
  useGateway.setState({
    activeRuntime: 'openclaw',
    runtimeMeta: {},
    threads: [],
    activeThreadId: null,
    messages: [],
    activeModel: null,
  });
});

test('defaults active runtime to openclaw', () => {
  expect(useGateway.getState().activeRuntime).toBe('openclaw');
});

test('new threads inherit the active runtime', () => {
  useGateway.getState().setActiveRuntime('hermes');
  const id = useGateway.getState().createThread('Runtime test');
  const created = useGateway.getState().threads.find((thread) => thread.id === id);

  expect(created.runtime).toBe('hermes');
});

test('getRuntimeForActiveThread returns the thread runtime when a thread is active', () => {
  useGateway.getState().setActiveRuntime('openclaw');
  const id = useGateway.getState().createThread('Hermes thread');
  useGateway.setState({
    threads: useGateway.getState().threads.map((thread) =>
      thread.id === id ? { ...thread, runtime: 'hermes' } : thread
    ),
    activeThreadId: id,
  });

  expect(useGateway.getState().getRuntimeForActiveThread()).toBe('hermes');
});
