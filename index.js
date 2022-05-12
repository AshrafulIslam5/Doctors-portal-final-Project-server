const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middletier
app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Doctor on Fire')
})

app.listen(port, () => {
    console.log(`Doctor is in Port: ${port}`)
})