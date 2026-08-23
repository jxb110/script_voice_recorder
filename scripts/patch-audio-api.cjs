const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native-audio-api",
  "android",
  "src",
  "main",
  "cpp",
  "audioapi",
  "android",
  "core",
  "AndroidAudioRecorder.cpp",
);

const original = `return Result<std::string, std::string>::Err(
        "FFmpeg backend is disabled. Cannot create file writer for the requested format. Use WAV format instead.");`;
const patched = `return Result<NoneType, std::string>::Err(
        "FFmpeg backend is disabled. Cannot create file writer for the requested format. Use WAV format instead.");`;

if (!fs.existsSync(target)) {
  console.log(
    "react-native-audio-api is not installed; skipping audio API patch.",
  );
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");
if (source.includes(patched)) {
  console.log("react-native-audio-api compatibility patch is already applied.");
  process.exit(0);
}

if (!source.includes(original)) {
  throw new Error(
    "Unable to apply react-native-audio-api compatibility patch: expected source text was not found.",
  );
}

fs.writeFileSync(target, source.replace(original, patched));
console.log("Applied react-native-audio-api compatibility patch.");
