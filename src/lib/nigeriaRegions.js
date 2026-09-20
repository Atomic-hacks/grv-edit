export const NIGERIAN_STATE_REGIONS = {
  abia: "South-East",
  adamawa: "North-East",
  akwaibom: "South-South",
  anambra: "South-East",
  bauchi: "North-East",
  bayelsa: "South-South",
  benue: "North-Central",
  borno: "North-East",
  crossriver: "South-South",
  delta: "South-South",
  ebonyi: "South-East",
  edo: "South-South",
  ekiti: "South-West",
  enugu: "South-East",
  fct: "North-Central",
  gombe: "North-East",
  imo: "South-East",
  jigawa: "North-West",
  kaduna: "North-West",
  kano: "North-West",
  katsina: "North-West",
  kebbi: "North-West",
  kogi: "North-Central",
  kwara: "North-Central",
  lagos: "South-West",
  nasarawa: "North-Central",
  niger: "North-Central",
  ogun: "South-West",
  ondo: "South-West",
  osun: "South-West",
  oyo: "South-West",
  plateau: "North-Central",
  rivers: "South-South",
  sokoto: "North-West",
  taraba: "North-East",
  yobe: "North-East",
  zamfara: "North-West",
};

export const NIGERIAN_REGIONS = [
  "South-South",
  "South-West",
  "South-East",
  "North-Central",
  "North-West",
  "North-East",
];

const normalizeState = (state) =>
  String(state || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

export const getRegionForState = (state) => {
  const normalizedState = normalizeState(state);
  if (
    normalizedState === "abuja" ||
    normalizedState === "federalcapitalterritory" ||
    normalizedState === "fctabuja" ||
    normalizedState === "federalcapitalterritoryabuja"
  ) {
    return "North-Central";
  }
  return NIGERIAN_STATE_REGIONS[normalizedState] || null;
};
