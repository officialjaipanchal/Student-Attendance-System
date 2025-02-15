const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const os = require("os");

const app = express();
const PORT = 8088;

app.use(express.json());
app.use(cors());

const getHostIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "0.0.0.0";
};

const db = new sqlite3.Database("./attendance.db", (err) => {
  if (err) console.error("Database Connection Error:", err.message);
  else console.log("Connected to SQLite database.");
});

const createTables = () => {
  const queries = [
    `CREATE TABLE IF NOT EXISTS student_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      userId TEXT UNIQUE NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS event_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT,
      details TEXT,
      ip TEXT,
      timestamp TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      userId TEXT,
      email TEXT,
      date TEXT,
      time TEXT,
      token TEXT,
      ip TEXT UNIQUE,
      UNIQUE(userId, date)
    )`,
    `CREATE TABLE IF NOT EXISTS flaggedstudents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      t_name TEXT,
      t_userId TEXT,
      t_email TEXT,
      t_date TEXT,
      t_time TEXT,
      t_token TEXT,
      s_name TEXT,
      s_userId TEXT,
      s_email TEXT,
      ip TEXT
    )`,
  ];
  queries.forEach((query) =>
    db.run(query, (err) => {
      if (err) console.error("Error creating table:", err.message);
    })
  );
};

const insertDefaultStudent = () => {
  db.get(`SELECT COUNT(*) AS count FROM student_details`, (err, row) => {
    if (!err && row.count === 0) {
      db.run(
        `INSERT INTO student_details (name, userId) VALUES ('Whohoo Jerry', 'jerry')`
      );
    }
  });
};

createTables();
insertDefaultStudent();

app.get("/getStudent/:userId", (req, res) => {
  const { userId } = req.params;
  db.get(
    `SELECT name, userId FROM student_details WHERE userId = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (!row) return res.status(404).json({ message: "Student not found" });
      res.json({
        name: row.name,
        userId: row.userId,
        email: `${row.userId}@userid.edu`,
      });
    }
  );
});

app.post("/submit", (req, res) => {
  const { name, userId, email, date, time, token } = req.body;
  if (!name || !userId || !email || !date || !time || !token) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const userIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  db.get(
    `SELECT COUNT(*) AS count FROM attendance WHERE userId = ? AND date = ?`,
    [userId, date],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (row.count > 0)
        return res
          .status(200)
          .json({ message: "Attendance already submitted" });

      db.run(
        `INSERT INTO attendance (name, userId, email, date, time, token, ip) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, userId, email, date, time, token, userIP],
        function (err) {
          if (err) {
            if (err.message.includes("attendance.ip")) {
              db.get(
                `SELECT name, userId, email FROM attendance WHERE ip = ?`,
                [userIP],
                (err, row) => {
                  if (!err && row) {
                    db.run(
                      `INSERT INTO flaggedstudents (t_name, t_userId, t_email, t_date, t_time, t_token, s_name, s_userId, s_email, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        name,
                        userId,
                        email,
                        date,
                        time,
                        token,
                        row.name,
                        row.userId,
                        row.email,
                        userIP,
                      ],
                      (err) => {
                        if (err)
                          return res
                            .status(500)
                            .json({ message: "Database error" });
                        return res
                          .status(409)
                          .json({ message: "Multiple IP attempts detected" });
                      }
                    );
                  }
                }
              );
            } else {
              return res.status(500).json({ message: "Database error" });
            }
          } else {
            res
              .status(201)
              .json({ message: "Attendance submitted successfully!" });
          }
        }
      );
    }
  );
});

const logEvent = (event, details, ip) => {
  db.run(
    `INSERT INTO event_logs (event, details, ip, timestamp) VALUES (?, ?, ?, ?)`,
    [event, JSON.stringify(details), ip, new Date().toISOString()],
    (err) => {
      if (err) console.error("Error logging event:", err.message);
    }
  );
};

app.post("/logEvent", (req, res) => {
  const { event, details } = req.body;
  logEvent(
    event,
    details,
    req.headers["x-forwarded-for"] || req.socket.remoteAddress
  );
  res.json({ message: "Event logged successfully" });
});

app.get("/getLogs", (req, res) => {
  db.all(
    "SELECT * FROM event_logs ORDER BY timestamp DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

const hostIP = getHostIP();
app.listen(PORT, hostIP, () =>
  console.log(`Server running at http://${hostIP}:${PORT}`)
);
