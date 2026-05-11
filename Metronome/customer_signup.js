require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Metronome } = require("@metronome/sdk");

function getMetronomeClient() {
  if (!process.env.METRONOME_SECRET_KEY) {
    throw new Error("METRONOME_SECRET_KEY is not set");
  }
  return new Metronome({ bearerToken: process.env.METRONOME_SECRET_KEY });
}

//Parameters to create a customer
const cusParams = {
  name: "Metronome",
  email: "email",
};

// Create a Stripe Customer
async function createStripeCustomer(params = cusParams) {
  const stripeCustomer = await stripe.customers.create({
    name: params.name,
    email: params.email,
  });
  return stripeCustomer;
}

// Create a Metronome Customer
async function createMetronomeCustomer(params = cusParams) {
  const stripeCustomer = await createStripeCustomer(params);
  const client = getMetronomeClient();
  const body = {
    name: params.name,
    ingest_aliases: [params.email],
    customer_billing_provider_configurations: [{
        billing_provider: "stripe",
        delivery_method: "direct_to_billing_provider",
        configuration: {
            stripe_customer_id: stripeCustomer.id,
            stripe_collection_method: "charge_automatically",
        }
    }]
  };
  const metronomeCustomer = await client.v1.customers.create(body);
  return {
    stripeCustomerId: stripeCustomer.id,
    metronomeCustomerId: metronomeCustomer.data.id,
    stripeCustomer,
    metronomeCustomer
  };
}

module.exports = {
  createMetronomeCustomer,
  createStripeCustomer,
};
