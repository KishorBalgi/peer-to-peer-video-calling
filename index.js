import { httpServer } from "./app.js";

httpServer.listen(3000, () => {
  console.log("Server connected: " + "http://localhost:3000");
});
