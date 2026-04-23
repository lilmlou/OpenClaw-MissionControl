import {
  DEFAULT_RUNTIME,
  RUNTIME_THEMES,
  RUNTIME_META,
  getRuntimeTheme,
  getRuntimeMeta,
  getRuntimeBackground,
  getRuntimeChrome,
} from './constants';

test('exports openclaw as the default runtime', () => {
  expect(DEFAULT_RUNTIME).toBe('openclaw');
});

test('defines both openclaw and hermes themes', () => {
  expect(RUNTIME_THEMES.openclaw).toBeDefined();
  expect(RUNTIME_THEMES.hermes).toBeDefined();
  expect(RUNTIME_THEMES.hermes.accent).not.toBe(RUNTIME_THEMES.openclaw.accent);
});

test('defines an image-backed openclaw background profile', () => {
  const openclawBackground = getRuntimeBackground('openclaw');

  expect(openclawBackground.mode).toBe('image');
  expect(openclawBackground.image).toContain('813a2b5f-2185-438b-b547-9e13ee28e8ea.jpg');
  expect(openclawBackground.overlay).toContain('rgba(');
});

test('defines a hazy hermes background profile', () => {
  const hermesBackground = getRuntimeBackground('hermes');

  expect(hermesBackground.mode).toBe('haze');
  expect(hermesBackground.base).toContain('radial-gradient');
  expect(hermesBackground.overlay).toContain('rgba(');
  expect(hermesBackground.orbs.length).toBeGreaterThanOrEqual(2);
});

test('defines reusable hermes chrome styling', () => {
  const hermesChrome = getRuntimeChrome('hermes');

  expect(hermesChrome.panel).toContain('rgba(');
  expect(hermesChrome.panelBorder).toContain('rgba(');
  expect(hermesChrome.nav).toContain('rgba(');
  expect(hermesChrome.glow).toContain('rgba(');
});

test('defines Hermes Agent naming', () => {
  expect(RUNTIME_META.hermes.title).toBe('Hermes Agent');
  expect(RUNTIME_META.hermes.assistantName).toBe('Hermes Agent');
  expect(RUNTIME_META.hermes.placeholder).toBe('Message Hermes Agent...');
});

test('returns fallback theme/meta for unknown runtimes', () => {
  expect(getRuntimeTheme('unknown')).toEqual(RUNTIME_THEMES.openclaw);
  expect(getRuntimeMeta('unknown')).toEqual(RUNTIME_META.openclaw);
  expect(getRuntimeBackground('unknown')).toEqual(getRuntimeBackground('openclaw'));
  expect(getRuntimeChrome('unknown')).toEqual(getRuntimeChrome('openclaw'));
});
