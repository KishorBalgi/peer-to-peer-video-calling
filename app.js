import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { initSocketIO } from "./src/socketConfig.js";

const app = express();
export const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

app.set("io", io);

app.get("/", (req, res, next) => {
  res.send("<h1>Hello World!</h1>");
});

initSocketIO(io);
