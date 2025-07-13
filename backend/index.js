const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const routes = require('./routes');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Network Inventory Backend API');
});

app.use('/', routes);

app.listen(PORT, () => {
  console.log(`Network Inventory Server running on port ${PORT}`);
}); 