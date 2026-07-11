const { execSync } = require("child_process");

const MAX_ATTEMPTS = 5;
const DELAY_MS = 6000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`prisma migrate deploy failed after ${MAX_ATTEMPTS} attempts.`);
        process.exit(1);
      }
      console.warn(
        `prisma migrate deploy failed on attempt ${attempt}/${MAX_ATTEMPTS} (likely a Neon cold-start advisory-lock timeout). Retrying in ${DELAY_MS / 1000}s...`
      );
      await sleep(DELAY_MS);
    }
  }
}

main();
