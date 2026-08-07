const fs = require("node:fs");
const path = require("node:path");
const target = path.join(__dirname, "..", "dist", "shared");
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, "package.json"), '{"type":"module"}\n');
