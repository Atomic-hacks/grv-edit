// Single source of truth for Nigerian shipping geography.
//
// State names here match exactly what `country-state-city` returns for NG,
// which is what the checkout address form renders — so what the customer
// picks, what the admin sees listed under each region, and what the server
// prices are all the same strings. Add a state here and it flows to all
// three automatically.
export const NIGERIAN_REGIONS = [
  "South-South",
  "South-West",
  "South-East",
  "North-Central",
  "North-West",
  "North-East",
];

export const NIGERIAN_STATES = [
  { name: "Abia", region: "South-East" },
  { name: "Abuja Federal Capital Territory", region: "North-Central" },
  { name: "Adamawa", region: "North-East" },
  { name: "Akwa Ibom", region: "South-South" },
  { name: "Anambra", region: "South-East" },
  { name: "Bauchi", region: "North-East" },
  { name: "Bayelsa", region: "South-South" },
  { name: "Benue", region: "North-Central" },
  { name: "Borno", region: "North-East" },
  { name: "Cross River", region: "South-South" },
  { name: "Delta", region: "South-South" },
  { name: "Ebonyi", region: "South-East" },
  { name: "Edo", region: "South-South" },
  { name: "Ekiti", region: "South-West" },
  { name: "Enugu", region: "South-East" },
  { name: "Gombe", region: "North-East" },
  { name: "Imo", region: "South-East" },
  { name: "Jigawa", region: "North-West" },
  { name: "Kaduna", region: "North-West" },
  { name: "Kano", region: "North-West" },
  { name: "Katsina", region: "North-West" },
  { name: "Kebbi", region: "North-West" },
  { name: "Kogi", region: "North-Central" },
  { name: "Kwara", region: "North-Central" },
  { name: "Lagos", region: "South-West" },
  { name: "Nasarawa", region: "North-Central" },
  { name: "Niger", region: "North-Central" },
  { name: "Ogun", region: "South-West" },
  { name: "Ondo", region: "South-West" },
  { name: "Osun", region: "South-West" },
  { name: "Oyo", region: "South-West" },
  { name: "Plateau", region: "North-Central" },
  { name: "Rivers", region: "South-South" },
  { name: "Sokoto", region: "North-West" },
  { name: "Taraba", region: "North-East" },
  { name: "Yobe", region: "North-East" },
  { name: "Zamfara", region: "North-West" },
];

const normalizeState = (state) =>
  String(state || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Extra spellings that must resolve to the same state. The FCT is the one
// that actually varies in the wild (and the one the address picker used to
// fall through on, silently charging DEFAULT instead of North-Central).
const STATE_ALIASES = {
  abuja: "Abuja Federal Capital Territory",
  fct: "Abuja Federal Capital Territory",
  fctabuja: "Abuja Federal Capital Territory",
  federalcapitalterritory: "Abuja Federal Capital Territory",
  federalcapitalterritoryabuja: "Abuja Federal Capital Territory",
  abujafct: "Abuja Federal Capital Territory",
};

const REGION_BY_NORMALIZED_STATE = NIGERIAN_STATES.reduce((map, state) => {
  map[normalizeState(state.name)] = state.region;
  return map;
}, {});

for (const [alias, canonicalName] of Object.entries(STATE_ALIASES)) {
  const region = NIGERIAN_STATES.find(
    (state) => state.name === canonicalName,
  )?.region;
  if (region) REGION_BY_NORMALIZED_STATE[alias] = region;
}

// Kept for backwards compatibility with existing imports.
export const NIGERIAN_STATE_REGIONS = REGION_BY_NORMALIZED_STATE;

export const getRegionForState = (state) =>
  REGION_BY_NORMALIZED_STATE[normalizeState(state)] || null;

// Display names of every state in a region, alphabetical. Drives the admin
// shipping screen so an operator never has to recall Nigerian geography.
export const getStatesInRegion = (region) =>
  NIGERIAN_STATES.filter((state) => state.region === region)
    .map((state) => state.name)
    .sort((a, b) => a.localeCompare(b));
