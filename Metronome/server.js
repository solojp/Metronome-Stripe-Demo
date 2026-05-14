require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Metronome } = require("@metronome/sdk");
const metronome = new Metronome({ bearerToken: process.env.METRONOME_SECRET_KEY });

const express = require("express");
const app = express();
app.use(express.static('public'));

app.use(express.json());

app.post('/sign-up', async (req, res) => {
    try { const stripeCustomer = await stripe.customers.create ({
            name: req.body.name,
            email: req.body.email,
            metadata: {
                'username': req.body.username
            }
        });
        const metronomeCustomer = await metronome.v1.customers.create({
            name: stripeCustomer.name,
            ingest_aliases: [stripeCustomer.email],
            customer_billing_provider_configurations: [{
                billing_provider: "stripe",
                delivery_method: "direct_to_billing_provider",
                configuration: {
                    stripe_customer_id: stripeCustomer.id,
                    stripe_collection_method: "charge_automatically",
                }
            }]
        });
        res.json({
            username: stripeCustomer.metadata.username, id: stripeCustomer.id
            // To do: Cache username to simulate logged in user. 
        });
    }
    catch (error) {
        console.error('Failed to create customer', error.message);
        res.status(500).json({ error: error.message });
    }
})

app.post('/create-checkout-session', async (req, res) => {
    const session = await stripe.checkout.session.create({
        mode: "setup",
        customer: customer.stripeCustomerId,
        payment_method_types: ["card"],
        ui_mode: "form",
        success_url: "https://stripe.com"
    })
})

app.listen(4242, () => console.log('Runing on port 4242'));