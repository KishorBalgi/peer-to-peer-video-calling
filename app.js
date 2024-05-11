import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { initSocketIO } from "./src/socketConfig.js";
import path from "path";
import fs from "fs";

const app = express();
export const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

app.set("io", io);

app.get("/", (req, res, next) => {
  res.send("<h1>Hello World!</h1>");
});

// Serve the output.txt file:
app.get("/output", (req, res, next) => {
  const filePath = path.join("public", "output.txt");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      res.status(500).send("Error reading file");
      return;
    }
    res.send(data);
  });
});

initSocketIO(io);
