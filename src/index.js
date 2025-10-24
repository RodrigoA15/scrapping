import app from "./app.js";

const PORT = 4500;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const HOST = process.env.HOST_PRODUCTION;

app.listen(PORT, HOST, (error) => {
  if (error) {
    console.log(`error server: ${error}`);
  } else {
    console.log(`Server listening on ${PORT}`);
  }
});
