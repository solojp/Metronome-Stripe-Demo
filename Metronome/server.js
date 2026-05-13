require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Metronome } = require("@metronome/sdk");

const express = require("express");
const app = express();
app.use(express.static('public'));

app.listen(4242, () => console.log('Runing on port 4242'));