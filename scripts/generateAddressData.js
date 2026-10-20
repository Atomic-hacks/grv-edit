// Retain the full country/state coverage but ship only fields used by forms.
// Source remains the installed country-state-city dataset; no remote lookup.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const assets = resolve(dirname(require.resolve('country-state-city')), '..', 'assets');
const countries = JSON.parse(readFileSync(resolve(assets, 'country.json'), 'utf8')).map(({ name, isoCode, flag }) => ({ name, isoCode, flag }));
const statesByCountry = {};
for (const { name, isoCode, countryCode } of JSON.parse(readFileSync(resolve(assets, 'state.json'), 'utf8'))) (statesByCountry[countryCode] ||= []).push({ name, isoCode });
for (const states of Object.values(statesByCountry)) states.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(new URL('../src/data/addressLocations.json', import.meta.url), JSON.stringify({ countries, statesByCountry }) + '\n');
console.log('Address location data generated.');
