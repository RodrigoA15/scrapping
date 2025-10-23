import app from "./app.js";

const PORT = 4500;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, (error) => {
  if (error) {
    console.log(`error server: ${error}`);
  } else {
    console.log(`Server listening on ${PORT}`);
  }
});
