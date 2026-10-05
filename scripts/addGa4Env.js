// Copies the Google service-account details into .env.local so you never have
// to hand-edit the private key (its line breaks are what usually go wrong).
// Prints nothing secret.
//
//   node scripts/addGa4Env.js ~/Downloads/your-key.json 123456789
//                                  ^ the JSON key file   ^ GA4 numeric Property ID
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [keyFile, propertyId, envFile = ".env.local"] = process.argv.slice(2);
if (!keyFile || !/^\d+$/.test(propertyId || "")) {
  console.error("Usage: node scripts/addGa4Env.js <service-account.json> <numeric property id>");
  process.exit(1);
}

const key = JSON.parse(readFileSync(keyFile.replace(/^~/, process.env.HOME), "utf8"));
if (!key.client_email || !key.private_key) {
  console.error("That file doesn't look like a service-account key (no client_email / private_key).");
  process.exit(1);
}

const values = {
  GA4_PROPERTY_ID: propertyId,
  GA4_CLIENT_EMAIL: key.client_email,
  // One line, with \n written out, inside quotes.
  GA4_PRIVATE_KEY: JSON.stringify(key.private_key),
};

let env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${name === "GA4_PRIVATE_KEY" ? value : JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, () => line) : `${env.replace(/\n*$/, "\n")}${line}\n`;
}
writeFileSync(envFile, env);
console.log(`Saved GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY to ${envFile}.`);
console.log(`Now in GA4, give ${key.client_email} the Viewer role (step 6).`);
