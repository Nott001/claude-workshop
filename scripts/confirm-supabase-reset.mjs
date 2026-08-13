import { spawn } from "node:child_process";

const confirmed = await new Promise((resolve) => {
  process.stdout.write("This wipes LOCAL data and replays migrations + seed. Continue? [y/N] ");
  process.stdin.once("data", (chunk) => {
    resolve(/^y(es)?$/i.test(chunk.toString().trim()));
  });
});

if (!confirmed) {
  console.log("Aborted. No local data was touched.");
  process.exit(1);
}

const child = spawn("supabase", ["db", "reset"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
