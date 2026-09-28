const express = require("express");
const app = express();
const PORT = 3000;

app.use(express.json());

const Database = require("better-sqlite3");
const db = new Database("tasks.db");

db.pragma("journal_mode = WAL");

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));


db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);

const countRow = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
if (countRow.count === 0) {
  const insertSeed = db.prepare(
    "INSERT INTO tasks (title, done) VALUES (?, ?)",
  );
  const seedTransaction = db.transaction(() => {
    insertSeed.run("Review FlyRank lecture", 1);
    insertSeed.run("Build Project", 0);
    insertSeed.run("Push to GitHub", 0);
  });
  seedTransaction();
}

// Helper to normalize SQLite numeric booleans (0/1) to JavaScript booleans (false/true)
function formatTask(row) {
  if (!row) return null;
  return {
    ...row,
    done: Boolean(row.done)
  };
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.status(200).json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks"],
  });
});

// GET /tasks - List all tasks
app.get("/tasks", (req, res) => {
  const rows = db.prepare("SELECT id, title, done FROM tasks").all();
  res.status(200).json(rows.map(formatTask));
});

// GET /tasks/:id - Retrieve single task
app.get("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db
    .prepare("SELECT id, title, done FROM tasks WHERE id = ?")
    .get(id);

  if (!row) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.status(200).json(formatTask(row));
});

// POST /tasks - Create task
app.post("/tasks", (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return res
      .status(400)
      .json({ error: "Field 'title' is required and cannot be empty" });
  }

  const cleanTitle = title.trim();
  const info = db
    .prepare("INSERT INTO tasks (title, done) VALUES (?, 0)")
    .run(cleanTitle);

  const newTask = {
    id: Number(info.lastInsertRowid),
    title: cleanTitle,
    done: false,
  };

  res.status(201).json(newTask);
});

// PUT /tasks/:id - Replace task fields
app.put("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body;

  if (
    title !== undefined &&
    (typeof title !== "string" || title.trim() === "")
  ) {
    return res.status(400).json({ error: "Field 'title' cannot be empty" });
  }

  if (done !== undefined && typeof done !== "boolean") {
    return res.status(400).json({ error: "Field 'done' must be a boolean" });
  }

  if (title === undefined && done === undefined) {
    return res
      .status(400)
      .json({ error: "Provide at least 'title' or 'done' to update" });
  }

  const updatedTitle = title !== undefined ? title.trim() : existing.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : existing.done;

  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(
    updatedTitle,
    updatedDone,
    id,
  );

  const updated = db
    .prepare("SELECT id, title, done FROM tasks WHERE id = ?")
    .get(id);
  res.status(200).json(formatTask(updated));
});

// DELETE /tasks/:id - Remove task
app.delete("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  if (info.changes === 0) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
