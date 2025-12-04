const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const pensionRoutes = require('./routes/pension');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/pension', pensionRoutes);

app.get('/', (req, res) => {
    res.send('Pension Payment Platform API is running.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
