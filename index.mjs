import express from "express";
import mysql from "mysql2/promise";

const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
    host: "au77784bkjx6ipju.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "p0e4qo04vustpxtg",
    password: "azpf0p33rpe1x41a",
    database: "nmw0vhdzusae9axq",
    connectionLimit: 10,
    waitForConnections: true
});

import session from "express-session";
app.use(session({
  secret: "secretkey",
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// --------------------------------------------------
// HOME
// --------------------------------------------------
app.get("/", (req, res) => {
    res.render("home");
});

// --------------------------------------------------
// AUTHORS
// --------------------------------------------------

app.get("/authors", async (req, res) => {
    try {
        const [authors] = await pool.query(`
            SELECT *
            FROM authors
            ORDER BY lastName, firstName
        `);
        res.render("authors", { authors });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading authors");
    }
});

app.get("/addAuthor", (req, res) => {
    res.render("addAuthor");
});

app.post("/addAuthor", requireAuth, async (req, res) => {
    try {
        const { firstName, lastName, dob, dod, sex, profession, country, portrait, biography } = req.body;
        const sql = `INSERT INTO authors (firstName, lastName, dob, dod, sex, profession, country, portrait, biography) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(sql, [firstName, lastName, dob || null, dod || null, sex || null, profession || null, country || null, portrait || null, biography || null]);
        res.redirect("/authors");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding author");
    }
});

app.get("/updateAuthors", async (req, res) => {
    try {
        const [authors] = await pool.query(`SELECT * FROM authors ORDER BY lastName, firstName`);
        res.render("updateAuthors", { authors });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading update authors page");
    }
});

app.get("/updateAuthor/:authorId", async (req, res) => {
    try {
        const authorId = parseInt(req.params.authorId);
        if (!authorId) return res.status(400).send("Invalid author ID");
        const [rows] = await pool.query("SELECT * FROM authors WHERE authorId = ?", [authorId]);
        if (rows.length === 0) return res.status(404).send("Author not found");
        res.render("updateAuthor", { author: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading author");
    }
});

app.post("/updateAuthor", requireAuth, async (req, res) => {
    try {
        const { authorId, firstName, lastName, dob, dod, sex, profession, country, portrait, biography } = req.body;
        const sql = `UPDATE authors SET firstName = ?, lastName = ?, dob = ?, dod = ?, sex = ?, profession = ?, country = ?, portrait = ?, biography = ? WHERE authorId = ?`;
        const [result] = await pool.query(sql, [firstName, lastName, dob || null, dod || null, sex || null, profession || null, country || null, portrait || null, biography || null, authorId]);
        if (result.affectedRows === 0) return res.status(404).send("Author not found");
        res.redirect("/updateAuthors");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating author");
    }
});

app.get("/deleteAuthors", async (req, res) => {
    try {
        const [authors] = await pool.query(`SELECT * FROM authors ORDER BY lastName, firstName`);
        res.render("deleteAuthors", { authors });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading delete authors page");
    }
});

app.post("/deleteAuthor", requireAuth, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const authorId = parseInt(req.body.authorId);
        if (!authorId) { conn.release(); return res.status(400).send("Invalid author ID"); }
        await conn.beginTransaction();
        await conn.query("DELETE FROM quotes WHERE authorId = ?", [authorId]);
        const [result] = await conn.query("DELETE FROM authors WHERE authorId = ?", [authorId]);
        if (result.affectedRows === 0) { await conn.rollback(); conn.release(); return res.status(404).send("Author not found"); }
        await conn.commit();
        res.redirect("/deleteAuthors");
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send("Error deleting author");
    } finally {
        conn.release();
    }
});

// --------------------------------------------------
// QUOTES
// --------------------------------------------------

app.get("/quotes", async (req, res) => {
    try {
        const [quotes] = await pool.query(`
            SELECT q.quoteId, q.quote, q.authorId, q.category, q.likes,
                   a.firstName, a.lastName
            FROM quotes q
            LEFT JOIN authors a ON q.authorId = a.authorId
            ORDER BY q.quoteId
        `);
        res.render("quotes", { quotes });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading quotes");
    }
});

app.get("/addQuote", async (req, res) => {
    try {
        const [authors] = await pool.query(`SELECT authorId, firstName, lastName FROM authors ORDER BY lastName, firstName`);
        const categories = ["Motivation", "Life", "Science", "Love"];
        res.render("addQuote", { authors, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading add quote page");
    }
});

app.post("/addQuote", requireAuth, async (req, res) => {
    try {
        const { quote, authorId, category, likes } = req.body;
        await pool.query(`INSERT INTO quotes (quote, authorId, category, likes) VALUES (?, ?, ?, ?)`, [quote, authorId, category, likes || 0]);
        res.redirect("/quotes");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding quote");
    }
});

app.get("/updateQuotes", async (req, res) => {
    try {
        const [quotes] = await pool.query(`
            SELECT q.quoteId, q.quote, q.authorId, q.category, q.likes,
                   a.firstName, a.lastName
            FROM quotes q
            LEFT JOIN authors a ON q.authorId = a.authorId
            ORDER BY q.quoteId
        `);
        res.render("updateQuotes", { quotes });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading update quotes page");
    }
});

app.get("/updateQuote/:quoteId", async (req, res) => {
    try {
        const quoteId = parseInt(req.params.quoteId);
        if (!quoteId) return res.status(400).send("Invalid quote ID");
        const [rows] = await pool.query("SELECT * FROM quotes WHERE quoteId = ?", [quoteId]);
        if (rows.length === 0) return res.status(404).send("Quote not found");
        const [authors] = await pool.query(`SELECT authorId, firstName, lastName FROM authors ORDER BY lastName, firstName`);
        const categories = ["Motivation", "Life", "Science", "Love"];
        res.render("updateQuote", { quoteItem: rows[0], authors, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading quote");
    }
});

app.post("/updateQuote", requireAuth, async (req, res) => {
    try {
        const { quoteId, quote, authorId, category, likes } = req.body;
        const sql = `UPDATE quotes SET quote = ?, authorId = ?, category = ?, likes = ? WHERE quoteId = ?`;
        const [result] = await pool.query(sql, [quote, authorId, category, likes || 0, quoteId]);
        if (result.affectedRows === 0) return res.status(404).send("Quote not found");
        res.redirect("/updateQuotes");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating quote");
    }
});

// Show quotes list for delete
app.get("/deleteQuotes", async (req, res) => {
    try {
        const [quotes] = await pool.query(`
            SELECT q.quoteId, q.quote, q.authorId, q.category, q.likes,
                   a.firstName, a.lastName
            FROM quotes q
            LEFT JOIN authors a ON q.authorId = a.authorId
            ORDER BY q.quoteId
        `);
        res.render("deleteQuotes", { quotes });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading delete quotes page");
    }
});

// Delete quote — redirects back to deleteQuotes
app.post("/deleteQuote", requireAuth, async (req, res) => {
    try {
        const quoteId = parseInt(req.body.quoteId);
        if (!quoteId) return res.status(400).send("Invalid quote ID");
        const [result] = await pool.query("DELETE FROM quotes WHERE quoteId = ?", [quoteId]);
        if (result.affectedRows === 0) return res.status(404).send("Quote not found");
        res.redirect("/deleteQuotes");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting quote");
    }
});

// --------------------------------------------------
// AUTH
// --------------------------------------------------
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
    if (rows.length > 0) {
        req.session.user = rows[0];
        return res.redirect("/");
    }
    res.send("Invalid credentials");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

function requireAuth(req, res, next) {
    if (req.session.user) return next();
    res.send(`<script>alert("You must be logged in to perform this action."); history.back();</script>`);
}

// --------------------------------------------------
// DB TEST
// --------------------------------------------------
app.get("/dbTest", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT CURDATE() AS today");
        res.send(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
