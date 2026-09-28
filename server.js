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
app.get('/tasks', (req, res) => {
  res.status(200).json(tasks);
});

// GET /tasks/:id - Retrieve single task
app.get('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = tasks.find(t => t.id === id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.status(200).json(task);
});

// POST /tasks - Create task
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  // Validation: ensure title exists and is not an empty/whitespace string
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: "Field 'title' is required and cannot be empty" });
  }

  const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
  const newTask = {
    id: nextId,
    title: title.trim(),
    done: false
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

// PUT /tasks/:id - Replace task fields
app.put('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const taskIndex = tasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: "Field 'title' cannot be empty" });
  }

  if (done !== undefined && typeof done !== 'boolean') {
    return res.status(400).json({ error: "Field 'done' must be a boolean" });
  }

  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: "Provide at least 'title' or 'done' to update" });
  }

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...(title !== undefined && { title: title.trim() }),
    ...(done !== undefined && { done })
  };

  res.status(200).json(tasks[taskIndex]);
});

// DELETE /tasks/:id - Remove a task
app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const taskIndex = tasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  tasks.splice(taskIndex, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
