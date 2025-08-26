import express from 'express';
import dotenv from 'dotenv';
import app from './app.js'; // Import the app from app.js
import { extractAndValidateAddress } from './utils/addressValidator.js';

dotenv.config();

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

