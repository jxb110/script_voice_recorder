try {
  const config = require("../metro.config.js");
  console.log("Metro config loaded successfully:", Boolean(config));
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}
