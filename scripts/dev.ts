import { program } from "commander";

program.argument("<name>", "The UI interface to show in the browser");
program.parse();

async function runViteOnInterface(name: string) {
  const vite = await import("vite");

  const htmlPath = `/src/${name}/index.html`;

  console.log(`Starting Vite dev server for ${htmlPath}`);

  const server = await vite.createServer({
    logLevel: "info",
    clearScreen: false,
    server: { port: 5173, open: htmlPath },
  });

  await server.listen();

  server.printUrls();

  console.log(
    `If the browser didn't open, visit ${htmlPath} on the dev server.`
  );

  const close = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

const selected = (program.args[0] as string | undefined) ?? "options";
runViteOnInterface(selected).catch((err) => {
  console.error(err);
  process.exit(1);
});
