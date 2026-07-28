import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const outputDir = process.argv[3];

if (!inputPath || !outputDir) {
  throw new Error("Usage: inspect_indian_ports.mjs <input.xlsx> <output-dir>");
}

await fs.mkdir(outputDir, { recursive: true });
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 12,
  tableMaxCols: 30,
  tableMaxCellChars: 160,
});
await fs.writeFile(path.join(outputDir, "inspect.ndjson"), summary.ndjson, "utf8");

const sheetSummary = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});
await fs.writeFile(
  path.join(outputDir, "sheets.ndjson"),
  sheetSummary.ndjson,
  "utf8",
);

const sheetValues = {};
for (let index = 0; index < workbook.worksheets.items.length; index += 1) {
  const currentSheet = workbook.worksheets.getItemAt(index);
  const currentUsed = currentSheet.getUsedRange(true);
  sheetValues[currentSheet.name] = currentUsed.values;
}
await fs.writeFile(
  path.join(outputDir, "values.json"),
  JSON.stringify(sheetValues, null, 2),
  "utf8",
);
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange(true);
const preview = await workbook.render({
  sheetName: sheet.name,
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);
console.log(
  JSON.stringify({
    sheet: sheet.name,
    rows: used.values.length,
    columns: Math.max(...used.values.map((row) => row.length), 0),
    outputDir,
  }),
);
