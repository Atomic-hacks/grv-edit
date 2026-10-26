import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import locations from '../../data/addressLocations.json';
it('retains every source country and state while removing unused metadata', () => {
  const require = createRequire(import.meta.url);
  const assets = resolve(dirname(require.resolve('country-state-city')), '..', 'assets');
  const countries = JSON.parse(readFileSync(resolve(assets, 'country.json'), 'utf8'));
  const states = JSON.parse(readFileSync(resolve(assets, 'state.json'), 'utf8'));
  expect(locations.countries.map((item) => item.isoCode)).toEqual(countries.map((item) => item.isoCode));
  expect(Object.values(locations.statesByCountry).flat()).toHaveLength(states.length);
  for (const state of states) expect(locations.statesByCountry[state.countryCode]).toContainEqual({ name: state.name, isoCode: state.isoCode });
});
