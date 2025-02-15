const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const db = new sqlite3.Database("./attendance.db");

// Create the exports folder if it doesn't exist
const EXPORT_FOLDER = path.join(__dirname, "exports");
if (!fs.existsSync(EXPORT_FOLDER)) {
  fs.mkdirSync(EXPORT_FOLDER);
  console.log("📁 Created 'exports' folder.");
}

function exportTableToCSV(tableName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(EXPORT_FOLDER, `${tableName}.csv`);
    const writeStream = fs.createWriteStream(filePath);

    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
      if (err) return reject(`❌ Error exporting ${tableName}: ${err.message}`);
      if (rows.length === 0) return resolve(`⚠️ ${tableName} is empty.`);

      // Write headers
      const headers = Object.keys(rows[0]).join(",");
      writeStream.write(headers + "\n");

      // Write data rows
      rows.forEach((row) => {
        writeStream.write(
          Object.values(row)
            .map((val) => `"${val}"`)
            .join(",") + "\n"
        );
      });

      writeStream.end(() => resolve(`✅ ${tableName} exported successfully.`));
    });
  });
}

function clearDatabase() {
  return new Promise((resolve, reject) => {
    const tables = ["attendance", "flaggedstudents", "event_logs"];
    let clearedCount = 0;

    tables.forEach((table) => {
      db.run(`DELETE FROM ${table}`, (err) => {
        if (err) return reject(`❌ Error clearing ${table}: ${err.message}`);
        clearedCount++;
        if (clearedCount === tables.length)
          resolve("🗑️ All tables cleared successfully.");
      });
    });
  });
}

(async () => {
  try {
    console.log("📤 Starting database export...");
    const tables = ["attendance", "flaggedstudents", "event_logs"];

    for (const table of tables) {
      const message = await exportTableToCSV(table);
      console.log(message);
    }

    console.log("\n🗑️ Export complete. Now clearing database...");
    const clearMessage = await clearDatabase();
    console.log(clearMessage);

    db.close();
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
