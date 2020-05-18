// server.js
// where your node app starts
// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
const app = express();
const path = require("path");
var session = require("express-session");
const exphbs = require("express-handlebars");
const config = require("./config");
app.engine(".html", exphbs({ extname: ".html" }));
app.set("view engine", ".html");
var SQLiteStore = require("connect-sqlite3")(session);
let sess = session({
  store: new SQLiteStore(),
  secret: process.env.SECRET,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  resave: true,
  saveUninitialized: false
});
app.use(sess);
var bodyParser = require("body-parser");
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var http = require("http").createServer(app);
//var server = http.Server(app);
var io = require("socket.io")(http);
// Setup sessions for socketio
var ios = require("socket.io-express-session");
io.use(ios(sess));
// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (req, res) => {
  res.render(__dirname + "/views/index.html", config.webexports);
});
app.get("/demo", (req, res) => {
  res.render(__dirname + "/views/demolaunch.html", config.webexports);
});
app.get("/name-prompt", (req, res) => {
  res.sendFile(__dirname + "/views/prompt.html");
});

app.post("/joinbuzzer", (req, res) => {
  req.session.name = req.body.name;
  res.render(__dirname + "/views/buzzer.html", {
    ...config.webexports,
    ...{ name: req.body.name }
  });
});

// listen for requests :)
const listener = http.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
