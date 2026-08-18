require("dotenv").config();
const crypto = require("crypto");
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
            stripe_customer_id: stripeCustomer.id,
            metronome_customer_id: metronomeCustomer.data.id
        });
    }
    catch (error) {
        console.error('Failed to create customer', error.message);
        res.status(500).json({ error: error.message });
    }
})

app.post('/create-subscription', async (req, res) => {
    try {
        const { customer_id } = req.body;
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{
                price:"price_1S5TCxQ6edAtiKkxNZRLjseA",
                quantity: 1
            }],
            customer: customer_id,
            ui_mode: "hosted_page",
            success_url: "https://stripe.com"
        });

        res.status(200).json({ url: session.url });
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.error("Failed to create subscription: ", error.message);
    }
})

app.post('/create-checkout-session', async (req, res) => {
    try {
        const { customer_id } = req.body;
        const session = await stripe.checkout.sessions.create({
            mode: "setup",
            customer: customer_id,
            payment_method_types: ["card"],
            ui_mode: "hosted_page",
            success_url: "https://stripe.com"
        });
        res.status(200).json({ url: session.url });  
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.error("Failed to save payment method: " ,error.message);
    }   
})

app.post('/set-default-payment-method', async (req, res) => {
    try {
        const { customer_id } = req.body;
        const payment_method = await stripe.customers.listPaymentMethods(
            customer_id, 
            {limit: 1}
        );
        const payment_method_id = payment_method.data[0].id
        const customer = await stripe.customers.update(
            customer_id, 
            {
                invoice_settings: {
                    default_payment_method: payment_method_id
                }
            }
        );
        res.status(200).json({ message: "Customer default payment method has been updated"});
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.error("Failed to update customer's default payment method: ", error.message);
    }
})

app.post('/create-credits-contract', async (req, res) => {
    try {
        const { customer_id } = req.body;
        const date = new Date();
        date.setMinutes(0, 0, 0);
        const startingAt = date.toISOString();
        const contract = await metronome.v1.contracts.create({
            customer_id: customer_id,
            rate_card_id: '9baa9942-a550-47b0-80ed-637c51c87118',
            starting_at: startingAt,
            recurring_credits: [{
                starting_at: startingAt,
                product_id: '266900ae-f09a-4df9-ac09-fdc3bd2fe2c6',
                access_amount: {
                    unit_price: 1000,
                    credit_type_id: 'f984e650-b20d-4a95-af49-970d4e233cdb',
                    quantity: 1,
                },
                priority: 1,
                commit_duration: {
                    value: 1,
                    unit:'periods'
                },
                recurrence_frequency: 'monthly',
            }],
        });

        res.status(200).json({ contract: contract.data.id });
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.error("Failed to create credits contract: ", error.message);
    }
})

app.post('/create-contract', async (req, res) => {
    try {
        const { customer_id } = req.body;
        const date = new Date();
        date.setMinutes(0, 0, 0);
        const startingAt = date.toISOString();
        const contract = await metronome.v1.contracts.create({
            customer_id: customer_id,
            rate_card_id: '9baa9942-a550-47b0-80ed-637c51c87118',
            starting_at: startingAt,
            billing_provider_configuration: {
                billing_provider: 'stripe',
                delivery_method: 'direct_to_billing_provider'
            },
            subscriptions:[{
                initial_quantity: 1,
                subscription_rate: {
                    billing_frequency: 'monthly',
                    product_id: 'a627786d-00c3-42df-99d1-d5787791b5e7',
                },
                temporary_id: 'monthly_plan',
                collection_schedule: 'advance',
                proration: {
                    is_prorated: true,
                    invoice_behavior: 'bill_immediately'
                },
                billing_cycle_config: {
                    anchor_date: date,
                    invoice_placement: 'ON_SCHEDULED_INVOICE'
                },
            }],
            recurring_credits: [{
                starting_at: startingAt,
                product_id: '266900ae-f09a-4df9-ac09-fdc3bd2fe2c6',
                access_amount: {
                    unit_price: 1000,
                    credit_type_id: 'f984e650-b20d-4a95-af49-970d4e233cdb',
                },
                priority: 1,
                commit_duration: {
                    value: 1,
                    unit:'periods'
                },
                recurrence_frequency: 'monthly',
                subscription_config: {
                    subscription_id: "monthly_plan",
                    apply_seat_increase_config: {
                        is_prorated: true
                    },
                },
            }],
        });
        res.status(200).json({ 
            id: contract.data.id
        });
        console.log('Contract Created');
        
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.error('Failed to create contract', error.message);
    }
})

app.post('/post-usage', async (req, res) => {
    try {
        const { customer_id } = req.body
        const date = new Date();
        const timeStamp = date.toISOString();
        const usage = await metronome.v1.usage.ingest({ usage: [{
            transaction_id: crypto.randomUUID(),
            customer_id: customer_id,
            event_type: 'usage',
            timestamp: timeStamp,
            properties: {
                input_tokens: 20,
                user_id: customer_id,
            }
        }]});
        res.status(200).json({  });
        console.log('usage logged');
    } catch (error) {
        res.status(400).json({ error: error.message });
        console.error('Failed to log usage ', error.message);
    }
})
 
app.listen(4242, () => console.log('Runing on port 4242'));